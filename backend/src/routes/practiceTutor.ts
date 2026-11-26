import { Router, Request, Response } from 'express';
import { envConfig } from '../config/env';
import { TreeEditDistanceGuard } from '../services/sandbox/TreeEditDistanceGuard';
import {
  buildPracticeTutorSystemPrompt,
  TESTING_COMPASS_RULES,
  LLD_COMPASS_RULES,
  TRANSACTION_COMPASS_RULES,
  CONCURRENCY_COMPASS_RULES,
  REFACTORING_COMPASS_RULES,
  TutorPersona,
  HintTier,
  PracticeTutorContext
} from '../prompts/practiceTutorPrompts';
import { buildPolymorphicTutorSystemPrompt } from '../prompts/tutor/polymorphicPromptBuilder';
import { streamTutorSse } from './practiceTutorStreaming';
import { llmGateway, LlmGatewayUnavailableError } from '../services/LlmGatewayClient';
import { ALL_MUTATION_CHALLENGES } from '../services/mutationChallenges';
import { db } from '../services/db';
import { pruneTutorContext } from '../services/practiceContextPruner';

const router = Router();

// Cache of solution sources per challenge for the AST guard
function getChallengeCanonicalSolutions(challengeId: string): string[] {
  const challenge = ALL_MUTATION_CHALLENGES.find((c) => c.id === challengeId);
  return challenge ? challenge.workspaceFiles.filter((f) => f.path.includes('Test.java')).map((f) => f.content) : [];
}

// GET /api/practice-tutor/*compass-rules
router.get('/compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(TESTING_COMPASS_RULES) }));
router.get('/lld-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(LLD_COMPASS_RULES) }));
router.get('/transaction-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(TRANSACTION_COMPASS_RULES) }));
router.get('/concurrency-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(CONCURRENCY_COMPASS_RULES) }));
router.get('/refactoring-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(REFACTORING_COMPASS_RULES) }));

// POST /api/practice-tutor/chat
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const {
      persona = 'middle_scaffold',
      assistanceLevel = 2,
      kataId,
      kataTitle,
      kataCategory = 'Testing & Mutation Katas',
      kataInstructions = '',
      activeFilePath,
      activeFileContent,
      selectedCodeSnippet,
      cursorLine,
      cursorColumn,
      survivingMutants,
      compilerError,
      testFailureMessage,
      activeCompassRuleId,
      activeWhiteboardSnippet,
      workspaceManifest,
      messages = [],
      academyBridgeContext,
      stream = true
    } = req.body;

    const isPolymorphic = Boolean(req.body.arena && req.body.arena !== 'practice');
    let systemPrompt: string;
    let targetSolutions: string[] = [];

    // Gate 04: Token Budgeting & Sliding Window Pruning
    const pruned = pruneTutorContext({
      messages,
      activeFilePath,
      activeFileContent,
      workspaceManifest,
      academyBridgeContext
    });

    if (isPolymorphic) {
      systemPrompt = buildPolymorphicTutorSystemPrompt(req.body);
    } else {
      let resolvedInstructions = (kataInstructions as string) || '';
      let resolvedTitle = (kataTitle as string) || kataId || '';
      let resolvedCategory = (kataCategory as string) || 'Testing & Mutation Katas';

      if (kataId && (!resolvedInstructions || resolvedInstructions.trim().length < 20)) {
        try {
          const row = db.prepare('SELECT title, category, short_description, instructions_markdown FROM coding_challenges WHERE id = ? OR slug = ?').get(kataId, kataId) as any;
          if (row) {
            resolvedInstructions = row.instructions_markdown || row.short_description || '';
            if (!resolvedTitle || resolvedTitle === kataId) resolvedTitle = row.title;
            if (!resolvedCategory || resolvedCategory === 'Testing & Mutation Katas') resolvedCategory = row.category;
          }
        } catch (dbErr) {
          console.warn('[practiceTutor] Failed to hydrate kata instructions from SQLite:', dbErr);
        }
      }

      const context: PracticeTutorContext = {
        persona: persona as TutorPersona,
        assistanceLevel: Number(assistanceLevel),
        kataTitle: resolvedTitle,
        kataCategory: resolvedCategory,
        kataInstructions: resolvedInstructions,
        activeFilePath: activeFilePath || 'src/test/java/ExampleTest.java',
        activeFileContent: activeFileContent || '',
        selectedCodeSnippet,
        cursorLine,
        cursorColumn,
        survivingMutants,
        compilerError,
        testFailureMessage,
        activeCompassRuleId,
        activeWhiteboardSnippet,
        workspaceManifest: pruned.prunedXmlManifest ? { xmlManifest: pruned.prunedXmlManifest } : workspaceManifest,
        academyBridgeContext,
        earlierTurnsSummary: pruned.earlierTurnsSummary
      };

      systemPrompt = buildPracticeTutorSystemPrompt(context);
      targetSolutions = kataId ? getChallengeCanonicalSolutions(kataId) : [];
    }

    const isSocratic = persona === 'senior_socratic' || persona === 'faang_interviewer' || assistanceLevel >= 3;
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...pruned.prunedMessages.map((m: any) => ({ role: m.role, content: m.content }))
    ];
    const execOpts = {
      messages: chatMessages,
      model: envConfig.models.text,
      temperature: isSocratic ? 0.2 : 0.4,
      maxTokens: 1500,
      presetKey: 'deepIncidentSynthesis' as const,
      abortSignal: abortController.signal
    };

    if (!stream) {
      const rawText = await llmGateway.completeText(execOpts);
      const guardResult = TreeEditDistanceGuard.guardResponse(rawText, targetSolutions, {
        leakThreshold: 0.40,
        isSocraticEnforced: isSocratic
      });
      res.json({
        content: guardResult.redactedText,
        leakDetected: guardResult.leakDetected,
        similarity: guardResult.maxSimilarity
      });
      return;
    }

    await streamTutorSse(llmGateway.streamChat(execOpts), res, { targetSolutions, isSocratic });

  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error('Error in /api/practice-tutor/chat:', err);
    if (!res.headersSent) {
      if (err instanceof LlmGatewayUnavailableError) {
        const status = err.reason === 'rate_limit_exceeded' ? 429 : 503;
        res.status(status).json({ error: err.userMessage, isGatewayUnavailable: true });
        return;
      }
      res.status(500).json({ error: err.message || 'Internal tutor error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err instanceof LlmGatewayUnavailableError ? err.userMessage : (err.message || 'Stream error') })}\n\n`);
      res.end();
    }
  }
});

// POST /api/practice-tutor/hint (Progressive Hint Ladder Tiers 0..4)
router.post('/hint', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());
  try {
    const {
      hintTier = 1,
      kataId,
      kataTitle,
      kataCategory,
      kataInstructions,
      activeFilePath,
      activeFileContent,
      survivingMutants,
      compilerError,
      testFailureMessage,
      activeWhiteboardSnippet
    } = req.body;

    const context: PracticeTutorContext = {
      persona: 'middle_scaffold',
      assistanceLevel: 2,
      kataTitle: kataTitle || kataId,
      kataCategory: kataCategory || 'Testing & Mutation Katas',
      kataInstructions: kataInstructions || '',
      activeFilePath: activeFilePath || 'src/test/java/Test.java',
      activeFileContent: activeFileContent || '',
      survivingMutants,
      compilerError,
      testFailureMessage,
      activeWhiteboardSnippet,
      hintTier: Number(hintTier) as HintTier
    };

    const systemPrompt = buildPracticeTutorSystemPrompt(context);
    const userPrompt = `Мне нужна подсказка уровня ${hintTier} по модели RIPR для решения этой задачи. Пожалуйста, дай четкий педагогический совет без списывания.`;

    const rawText = await llmGateway.completeText({
      systemPrompt,
      userPrompt,
      model: envConfig.models.text,
      temperature: 0.2,
      maxTokens: 800,
      presetKey: 'deepIncidentSynthesis',
      abortSignal: abortController.signal
    });

    const targetSolutions = kataId ? getChallengeCanonicalSolutions(kataId) : [];
    const guardResult = TreeEditDistanceGuard.guardResponse(rawText, targetSolutions, {
      leakThreshold: 0.40,
      isSocraticEnforced: true
    });

    res.json({
      hintTier: Number(hintTier),
      content: guardResult.redactedText,
      leakDetected: guardResult.leakDetected
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error('Error in /api/practice-tutor/hint:', err);
    res.status(500).json({ error: err.message || 'Failed to generate hint' });
  }
});

// POST /api/practice-tutor/rule-grounding (Testing Compass 5 Golden Rules)
router.post('/rule-grounding', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());
  try {
    const {
      ruleId,
      kataId,
      kataTitle,
      activeFilePath,
      activeFileContent,
      survivingMutants
    } = req.body;

    const rule = LLD_COMPASS_RULES[ruleId] || TESTING_COMPASS_RULES[ruleId];
    if (!rule) {
      res.status(400).json({ error: `Unknown ruleId: ${ruleId}` });
      return;
    }

    const context: PracticeTutorContext = {
      persona: 'middle_scaffold',
      assistanceLevel: 2,
      kataTitle: kataTitle || kataId,
      kataCategory: req.body.kataCategory || (LLD_COMPASS_RULES[ruleId] ? 'Low-Level Design (LLD)' : 'Testing & Mutation Katas'),
      kataInstructions: '',
      activeFilePath: activeFilePath || 'src/test/java/Test.java',
      activeFileContent: activeFileContent || '',
      survivingMutants,
      activeCompassRuleId: ruleId
    };

    const systemPrompt = buildPracticeTutorSystemPrompt(context);
    const userPrompt = `Проверь мой код на соответствие правилу Компаса "${rule.name}". Укажи, где в моем коде есть расхождения с этим правилом и как их устранить.`;

    const rawText = await llmGateway.completeText({
      systemPrompt,
      userPrompt,
      model: envConfig.models.text,
      temperature: 0.2,
      maxTokens: 1000,
      presetKey: 'deepIncidentSynthesis',
      abortSignal: abortController.signal
    });

    res.json({
      ruleId,
      ruleName: rule.name,
      content: rawText
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error('Error in /api/practice-tutor/rule-grounding:', err);
    res.status(500).json({ error: err.message || 'Failed to ground rule' });
  }
});

export default router;
