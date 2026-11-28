import { Router, Request, Response } from 'express';
import { CodingChallenge } from '@interview-prep/shared';
import { envConfig } from '../config/env';
import { TreeEditDistanceGuard } from '../services/sandbox/TreeEditDistanceGuard';
import {
  buildPracticeTutorSystemPrompt,
  TESTING_COMPASS_RULES,
  LLD_COMPASS_RULES,
  TRANSACTION_COMPASS_RULES,
  CONCURRENCY_COMPASS_RULES,
  REFACTORING_COMPASS_RULES,
  CompassRule,
  HintTier
} from '../prompts/practiceTutorPrompts';
import { buildPolymorphicTutorSystemPrompt } from '../prompts/tutor/polymorphicPromptBuilder';
import { streamTutorSse } from './practiceTutorStreaming';
import { llmGateway, LlmGatewayUnavailableError } from '../services/LlmGatewayClient';
import { db, ChallengeCatalogLoader } from '../services/db';
import {
  resolveTutorRouteContext,
  toPracticeTutorContext,
  ResolvedTutorRouteContext
} from './tutorContextResolver';
import { resolveCompassRule } from './compassRuleResolver';
import { getBugChallengeGroundTruth, verifyBugDiagnosisOutcome } from './bugDiagnosisVerifier';

export { resolveTutorRouteContext } from './tutorContextResolver';

const router = Router();
let cachedMutationCatalog: CodingChallenge[] | null = null;

function extractSolutionsFromManifest(manifest: any): string[] {
  const refFiles = Array.isArray(manifest?.referenceSolutionFiles)
    ? manifest.referenceSolutionFiles
        .map((f: any) => f?.content)
        .filter((c: any): c is string => typeof c === 'string' && c.length > 0)
    : [];
  const testFiles = Array.isArray(manifest?.workspaceFiles)
    ? manifest.workspaceFiles
        .filter((f: any) => typeof f?.path === 'string' && f.path.includes('Test.java'))
        .map((f: any) => f?.content)
        .filter((c: any): c is string => typeof c === 'string' && c.length > 0)
    : [];
  return Array.from(new Set([...refFiles, ...testFiles]));
}

function getChallengeCanonicalSolutions(challengeId: string): string[] {
  if (!challengeId) return [];
  try {
    const row = db
      .prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?')
      .get(challengeId, challengeId) as { manifest_json?: string } | undefined;
    if (row?.manifest_json) {
      return extractSolutionsFromManifest(JSON.parse(row.manifest_json));
    }
  } catch (err) {
    console.warn('[practiceTutor] Failed to read canonical solutions from SQLite:', err);
  }
  try {
    if (!cachedMutationCatalog) {
      cachedMutationCatalog = ChallengeCatalogLoader.loadMutationChallenges();
    }
    const challenge = cachedMutationCatalog.find((c) => c.id === challengeId || c.slug === challengeId);
    return challenge ? extractSolutionsFromManifest(challenge) : [];
  } catch {
    return [];
  }
}

// Context pruning (pruneTutorContext) and academyBridgeContext normalization run inside resolveTutorRouteContext
function hydrateAndBuildPrompt(
  resolved: ResolvedTutorRouteContext,
  opts: { hintTier?: HintTier; activeCompassRuleId?: string; fallbackCategory?: string; extraRule?: CompassRule } = {}
): { systemPrompt: string; targetSolutions: string[] } {
  if (!resolved.isPracticeArena) {
    const incidentId = resolved.context.incidentMeta?.incidentId || resolved.rawEntityId;
    const bugGroundTruth =
      resolved.context.arena === 'incidents' && incidentId
        ? getBugChallengeGroundTruth(incidentId)
        : null;
    let prompt = buildPolymorphicTutorSystemPrompt(
      resolved.context,
      bugGroundTruth
        ? { bugExplanation: bugGroundTruth.bugExplanation, isSolved: bugGroundTruth.isSolved }
        : undefined
    );
    if (resolved.pruned.earlierTurnsSummary) {
      prompt += `\n\n=== РЕЗЮМЕ РАННЕГО ДИАЛОГА (СЖАТЫЙ КОНТЕКСТ) ===\n${resolved.pruned.earlierTurnsSummary}`;
    }
    if (resolved.pruned.academyDirectives) {
      prompt += `\n\n${resolved.pruned.academyDirectives}`;
    }
    if (opts.hintTier !== undefined) {
      prompt += `\n\nРЕЖИМ ПОДСКАЗКИ: УРОВЕНЬ ${opts.hintTier}. Дай сфокусированную Socratic-подсказку без раскрытия готового решения.`;
    }
    if (opts.extraRule) {
      prompt += `\n\nАКТИВНОЕ ПРАВИЛО КОМПАСА: "${opts.extraRule.name}" — ${opts.extraRule.shortFormula}`;
    }
    const targetSolutions =
      bugGroundTruth && !bugGroundTruth.isSolved && bugGroundTruth.fixedCode
        ? [bugGroundTruth.fixedCode]
        : [];
    return { systemPrompt: prompt, targetSolutions };
  }

  let resolvedInstructions = resolved.context.instructions || '';
  let resolvedTitle = resolved.context.entityTitle;
  let resolvedCategory = resolved.context.domain;

  if (resolved.rawEntityId && (!resolvedInstructions || resolvedInstructions.trim().length < 20)) {
    try {
      const row = db
        .prepare('SELECT title, category, short_description, instructions_markdown FROM coding_challenges WHERE id = ? OR slug = ?')
        .get(resolved.rawEntityId, resolved.rawEntityId) as any;
      if (row) {
        resolvedInstructions = row.instructions_markdown || row.short_description || '';
        if (!resolvedTitle || resolvedTitle === resolved.rawEntityId) resolvedTitle = row.title;
        if (!resolvedCategory || resolvedCategory === 'Testing & Mutation Katas') resolvedCategory = row.category;
      }
    } catch (dbErr) {
      console.warn('[practiceTutor] Failed to hydrate kata instructions from SQLite:', dbErr);
    }
  }

  if (opts.fallbackCategory && (!resolvedCategory || resolvedCategory === 'Testing & Mutation Katas')) {
    resolvedCategory = opts.fallbackCategory;
  }

  const practiceContext = toPracticeTutorContext(resolved, {
    kataTitle: resolvedTitle,
    kataCategory: resolvedCategory,
    kataInstructions: resolvedInstructions,
    hintTier: opts.hintTier,
    activeCompassRuleId: opts.activeCompassRuleId
  });

  return {
    systemPrompt: buildPracticeTutorSystemPrompt(practiceContext),
    targetSolutions: resolved.rawEntityId ? getChallengeCanonicalSolutions(resolved.rawEntityId) : []
  };
}

function handleTutorRouteError(err: any, res: Response, routeLabel: string, fallbackMessage: string): void {
  if (err?.name === 'AbortError') return;
  console.error(`Error in /api/practice-tutor/${routeLabel}:`, err);
  if (res.headersSent) {
    res.write(`data: ${JSON.stringify({ error: err instanceof LlmGatewayUnavailableError ? err.userMessage : (err?.message || 'Stream error') })}\n\n`);
    res.end();
    return;
  }
  if (err instanceof LlmGatewayUnavailableError || err?.name === 'LlmGatewayUnavailableError') {
    const status = err.reason === 'rate_limit_exceeded' ? 429 : 503;
    res.status(status).json({
      error: err.userMessage,
      isGatewayUnavailable: true,
      reason: err.reason,
      retryAfterSeconds: err.retryAfterSeconds
    });
    return;
  }
  res.status(500).json({ error: err?.message || fallbackMessage });
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
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const resolved = resolveTutorRouteContext(req.body);
    const { systemPrompt, targetSolutions } = hydrateAndBuildPrompt(resolved);
    const { persona, assistanceLevel } = resolved.context;
    const isSocratic = persona === 'senior_socratic' || persona === 'faang_interviewer' || assistanceLevel >= 3;

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...resolved.pruned.prunedMessages.map((m) => ({ role: m.role, content: m.content }))
    ];
    const execOpts = {
      messages: chatMessages,
      model: envConfig.models.text,
      temperature: isSocratic ? 0.2 : 0.4,
      maxTokens: 1500,
      presetKey: 'deepIncidentSynthesis' as const,
      abortSignal: abortController.signal
    };

    if (!resolved.stream) {
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
    handleTutorRouteError(err, res, 'chat', 'Internal tutor error');
  }
});

// POST /api/practice-tutor/hint (Progressive Hint Ladder Tiers 0..4)
router.post('/hint', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const resolved = resolveTutorRouteContext(req.body);
    const hintTier = Number(req.body?.hintTier ?? resolved.context.hintTier ?? 1);
    const { systemPrompt, targetSolutions } = hydrateAndBuildPrompt(resolved, { hintTier: hintTier as HintTier });
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

    const guardResult = TreeEditDistanceGuard.guardResponse(rawText, targetSolutions, {
      leakThreshold: 0.40,
      isSocraticEnforced: true
    });

    res.json({
      hintTier,
      content: guardResult.redactedText,
      leakDetected: guardResult.leakDetected
    });
  } catch (err: any) {
    handleTutorRouteError(err, res, 'hint', 'Failed to generate hint');
  }
});

// POST /api/practice-tutor/rule-grounding (All 5 Domain Compasses)
router.post('/rule-grounding', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const resolved = resolveTutorRouteContext(req.body);
    const ruleId = String(req.body?.ruleId || resolved.context.activeCompassRuleId || '');
    const matched = resolveCompassRule(ruleId);
    if (!matched) {
      res.status(400).json({ error: `Unknown ruleId: ${ruleId}` });
      return;
    }

    const { systemPrompt, targetSolutions } = hydrateAndBuildPrompt(resolved, {
      activeCompassRuleId: matched.resolvedRuleId,
      fallbackCategory: matched.defaultCategory,
      extraRule: matched.rule
    });
    const userPrompt = `Проверь мой код на соответствие правилу Компаса "${matched.rule.name}". Укажи, где в моем коде есть расхождения с этим правилом и как их устранить.`;

    const rawText = await llmGateway.completeText({
      systemPrompt,
      userPrompt,
      model: envConfig.models.text,
      temperature: 0.2,
      maxTokens: 1000,
      presetKey: 'deepIncidentSynthesis',
      abortSignal: abortController.signal
    });

    const guardResult = TreeEditDistanceGuard.guardResponse(rawText, targetSolutions, {
      leakThreshold: 0.40,
      isSocraticEnforced: true
    });

    res.json({
      ruleId,
      ruleName: matched.rule.name,
      content: guardResult.redactedText,
      leakDetected: guardResult.leakDetected
    });
  } catch (err: any) {
    handleTutorRouteError(err, res, 'rule-grounding', 'Failed to ground rule');
  }
});

// POST /api/practice-tutor/verify-diagnosis (Bug Hunt Root-Cause Check & FSRS Sync)
router.post('/verify-diagnosis', async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const diagnosis = String(req.body?.diagnosis || '').trim();
    if (!diagnosis) {
      res.status(400).json({ error: 'diagnosis must be a non-empty string' });
      return;
    }

    const rawCtx = req.body?.context && typeof req.body.context === 'object' ? req.body.context : req.body;
    const resolved = resolveTutorRouteContext(rawCtx);
    const bugId = String(req.body?.bugId || resolved.context.incidentMeta?.incidentId || resolved.rawEntityId || '');
    const userId = String((req as any).user?.id || req.headers['x-user-id'] || req.body?.userId || 'anonymous');

    const outcome = await verifyBugDiagnosisOutcome({
      bugId,
      diagnosis,
      context: resolved.context,
      userId,
      abortSignal: abortController.signal
    });

    if (outcome.notFound) {
      res.status(404).json({ error: `Bug challenge not found: ${bugId || 'unknown'}` });
      return;
    }

    res.json(outcome.result);
  } catch (err: any) {
    handleTutorRouteError(err, res, 'verify-diagnosis', 'Failed to verify bug diagnosis');
  }
});

export default router;
