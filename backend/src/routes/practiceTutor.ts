import { Router, Request, Response } from 'express';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
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
import { ALL_MUTATION_CHALLENGES } from '../services/mutationChallenges';

const router = Router();

// Cache of solution sources per challenge for the AST guard
function getChallengeCanonicalSolutions(challengeId: string): string[] {
  const challenge = ALL_MUTATION_CHALLENGES.find((c) => c.id === challengeId);
  if (!challenge) return [];
  // Return test files and solution templates
  return challenge.workspaceFiles
    .filter((f) => f.path.includes('Test.java'))
    .map((f) => f.content);
}

// GET /api/practice-tutor/compass-rules
router.get('/compass-rules', (_req: Request, res: Response) => {
  res.json({ rules: Object.values(TESTING_COMPASS_RULES) });
});

// GET /api/practice-tutor/lld-compass-rules
router.get('/lld-compass-rules', (_req: Request, res: Response) => {
  res.json({ rules: Object.values(LLD_COMPASS_RULES) });
});

router.get('/transaction-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(TRANSACTION_COMPASS_RULES) }));
router.get('/concurrency-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(CONCURRENCY_COMPASS_RULES) }));
router.get('/refactoring-compass-rules', (_req: Request, res: Response) => res.json({ rules: Object.values(REFACTORING_COMPASS_RULES) }));

// Helper for LiteLLM fetch with host.docker.internal -> localhost failover
async function callLiteLlm(payload: any, abortSignal?: AbortSignal): Promise<globalThis.Response> {
  const endpointUrl = envConfig.proxy.chatUrl;
  const proxyApiKey = envConfig.proxy.apiKey;

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyApiKey}`
      },
      signal: abortSignal,
      body: JSON.stringify(payload)
    });
    return res;
  } catch (err: any) {
    if (endpointUrl.includes('host.docker.internal')) {
      const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
      console.log(`🔄 Retrying LiteLLM Proxy with local URL: ${localUrl}`);
      return await fetch(localUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proxyApiKey}`
        },
        signal: abortSignal,
        body: JSON.stringify(payload)
      });
    }
    throw err;
  }
}

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
      messages = [],
      stream = true
    } = req.body;

    const context: PracticeTutorContext = {
      persona: persona as TutorPersona,
      assistanceLevel: Number(assistanceLevel),
      kataTitle: kataTitle || kataId,
      kataCategory,
      kataInstructions,
      activeFilePath: activeFilePath || 'src/test/java/ExampleTest.java',
      activeFileContent: activeFileContent || '',
      selectedCodeSnippet,
      cursorLine,
      cursorColumn,
      survivingMutants,
      compilerError,
      testFailureMessage,
      activeCompassRuleId,
      activeWhiteboardSnippet
    };

    const systemPrompt = buildPracticeTutorSystemPrompt(context);
    const targetSolutions = kataId ? getChallengeCanonicalSolutions(kataId) : [];
    const isSocratic = persona === 'senior_socratic' || persona === 'faang_interviewer' || assistanceLevel >= 3;

    const requestPayload = {
      model: envConfig.models.text,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content }))
      ],
      temperature: isSocratic ? 0.2 : 0.4,
      max_tokens: 1500,
      stream: Boolean(stream),
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.deepIncidentSynthesis)
    };

    const upstreamRes = await callLiteLlm(requestPayload, abortController.signal);

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => 'Unknown LiteLLM error');
      res.status(upstreamRes.status).json({
        error: `LiteLLM Proxy error (${upstreamRes.status}): ${errText}`,
        isGatewayUnavailable: upstreamRes.status === 503 || upstreamRes.status === 429
      });
      return;
    }

    if (!stream) {
      const data: any = await upstreamRes.json();
      let rawText = data.choices?.[0]?.message?.content || '';

      // AST Socratic Guard
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

    // Streaming SSE Response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    const reader = upstreamRes.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: 'No readable stream available' })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        if (trimmed === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmed.slice(5).trim());
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulatedContent += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            const resWithFlush = res as unknown as { flush?: () => void };
            if (typeof resWithFlush.flush === 'function') resWithFlush.flush();
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }

    // Final Post-Stream AST check on accumulated text
    const finalGuard = TreeEditDistanceGuard.guardResponse(accumulatedContent, targetSolutions, {
      leakThreshold: 0.40,
      isSocraticEnforced: isSocratic
    });

    res.write(`data: ${JSON.stringify({
      done: true,
      leakDetected: finalGuard.leakDetected,
      maxSimilarity: finalGuard.maxSimilarity
    })}\n\n`);
    res.end();

  } catch (err: any) {
    if (err.name === 'AbortError') {
      return;
    }
    console.error('Error in /api/practice-tutor/chat:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal tutor error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Stream error' })}\n\n`);
      res.end();
    }
  }
});

// POST /api/practice-tutor/hint (Progressive Hint Ladder Tiers 0..4)
router.post('/hint', async (req: Request, res: Response): Promise<void> => {
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

    const requestPayload = {
      model: envConfig.models.text,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.deepIncidentSynthesis)
    };

    const upstreamRes = await callLiteLlm(requestPayload);
    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => 'Error');
      res.status(upstreamRes.status).json({ error: errText });
      return;
    }

    const data: any = await upstreamRes.json();
    const rawText = data.choices?.[0]?.message?.content || '';

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
    console.error('Error in /api/practice-tutor/hint:', err);
    res.status(500).json({ error: err.message || 'Failed to generate hint' });
  }
});

// POST /api/practice-tutor/rule-grounding (Testing Compass 5 Golden Rules)
router.post('/rule-grounding', async (req: Request, res: Response): Promise<void> => {
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

    const requestPayload = {
      model: envConfig.models.text,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      extra_body: buildReasoningExtraBody(REASONING_PRESETS.deepIncidentSynthesis)
    };

    const upstreamRes = await callLiteLlm(requestPayload);
    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => 'Error');
      res.status(upstreamRes.status).json({ error: errText });
      return;
    }

    const data: any = await upstreamRes.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    res.json({
      ruleId,
      ruleName: rule.name,
      content: rawText
    });
  } catch (err: any) {
    console.error('Error in /api/practice-tutor/rule-grounding:', err);
    res.status(500).json({ error: err.message || 'Failed to ground rule' });
  }
});

export default router;
