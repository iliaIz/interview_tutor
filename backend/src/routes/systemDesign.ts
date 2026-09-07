import { Router } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import { callLiteLlmChat, parseJsonFromLlm } from '../services/llmClient';
import { getAuthUserId } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { safeJsonParse } from '../utils/safeJson';
import { getRequestAbortSignal } from '../utils/requestAbort';

export const systemDesignRouter = Router();

export interface CanvasTopologyNode {
  id: string;
  label?: string;
  type?: string;
  config?: {
    technology?: string;
    replicas?: number;
  };
}

export interface CanvasTopologyEdge {
  source: string;
  target: string;
  config?: {
    protocol?: string;
    isAsync?: boolean;
  };
}

export interface CanvasTopologyPayload {
  nodes?: CanvasTopologyNode[];
  edges?: CanvasTopologyEdge[];
  simulationMetrics?: {
    globalInputRps?: number;
    globalProcessedRps?: number;
    globalP99LatencyMs?: number;
    globalErrorRate?: number;
    antiPatterns?: Array<{ title: string; description?: string }>;
  };
}

export interface SystemDesignEvaluateBody {
  scenarioId: string;
  architectureMermaid?: string;
  notesMarkdown?: string;
  canvasTopology?: CanvasTopologyPayload;
}

// GET /api/system-design/scenarios
systemDesignRouter.get('/scenarios', asyncHandler(async (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT id, scenario_number, slug, title, category, difficulty, manifest_json FROM system_design_challenges WHERE 1=1';
  const params: any[] = [];

  if (category && typeof category === 'string' && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (search && typeof search === 'string' && search.trim()) {
    query += ' AND (title LIKE ? OR category LIKE ?)';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  query += ' ORDER BY scenario_number ASC';
  const rows = db.prepare(query).all(...params) as any[];
  
  const scenarios = rows.map(r => safeJsonParse(r.manifest_json, r));
  res.json(scenarios);
}));

// GET /api/system-design/scenarios/:id
systemDesignRouter.get('/scenarios/:id', asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as any;
  if (!row) {
    throw new AppError('Scenario not found', 404);
  }
  const manifest = safeJsonParse(row.manifest_json, null);
  if (!manifest) {
    throw new AppError('Invalid scenario manifest data', 500);
  }
  res.json(manifest);
}));

// POST /api/system-design/probe (Staff AI Interactive Socratic Probing)
systemDesignRouter.post('/probe', asyncHandler(async (req, res) => {
  const { scenarioId, userMessage, conversationHistory } = req.body;
  if (!scenarioId || !userMessage) {
    throw new AppError('scenarioId and userMessage are required', 400);
  }

  const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ?').get(scenarioId) as any;
  const scenario = row ? safeJsonParse<any>(row.manifest_json, null) : null;
  const context = scenario ? `
Контекст задачи: ${scenario.title} (${scenario.category})
Трафик: ${JSON.stringify(scenario.trafficProfile)}
Узкие места и сбои: ${scenario.bottlenecksMarkdown}
Эталонные вопросы Staff-интервьюера:
${scenario.tradeOffProbes?.map((p: any) => `- Вопрос: ${p.question}\n  Эталон: ${p.modelAnswer}`).join('\n')}
` : '';

  const systemPrompt = `Ты — ведущий Staff/Principal Архитектор и интервьюер в BigTech (Яндекс, Т-Банк, Stripe).
Твоя цель: проводить глубокое, требовательное и реалистичное собеседование по System Design.
Подвергай сомнению архитектурные решения кандидата: находи Single Point of Failure (SPOF), спрашивай про поведение при Network Partition (CAP), Cache Stampede, Dual-Write, Backpressure, и шардирование БД.
Отвечай кратко, емко, задавай один точечный технический контр-вопрос.
${context}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []),
    { role: 'user', content: userMessage }
  ];

  const chatResult = await callLiteLlmChat({
    model: envConfig.models.text,
    messages,
    temperature: 0.7,
    max_tokens: 800
  }, {
    signal: getRequestAbortSignal(req),
    timeoutMs: 45_000,
    maxRetries: 2
  });

  const reply = chatResult.content || 'Как ваша система гарантирует идемпотентность при сетевых повторах?';
  res.json({ reply });
}));

// POST /api/system-design/evaluate
systemDesignRouter.post('/evaluate', asyncHandler(async (req, res) => {
  const { scenarioId, architectureMermaid, notesMarkdown, canvasTopology } = req.body as SystemDesignEvaluateBody;
  if (!scenarioId) {
    throw new AppError('scenarioId is required', 400);
  }

  const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ?').get(scenarioId) as any;
  const scenario = row ? safeJsonParse<any>(row.manifest_json, {}) : {};

  let topologySection = architectureMermaid || 'Не предоставлена';
  if (canvasTopology) {
    topologySection = `
Интерактивная топология холста:
Узлы (${canvasTopology.nodes?.length || 0}): ${JSON.stringify(canvasTopology.nodes?.map((n: any) => ({ id: n.id, label: n.label, type: n.type, tech: n.config?.technology, replicas: n.config?.replicas })))}
Связи: ${JSON.stringify(canvasTopology.edges?.map((e: any) => ({ from: e.source, to: e.target, protocol: e.config?.protocol, isAsync: e.config?.isAsync })))}
Результаты DES симуляции нагрузки:
- Входящий RPS: ${canvasTopology.simulationMetrics?.globalInputRps || 'N/A'}
- Пропускная способность: ${canvasTopology.simulationMetrics?.globalProcessedRps || 'N/A'} RPS
- p99 задержка: ${canvasTopology.simulationMetrics?.globalP99LatencyMs || 'N/A'} мс
- Ошибки (Error Rate): ${((canvasTopology.simulationMetrics?.globalErrorRate || 0) * 100).toFixed(1)}%
- Выявленные симулятором антипаттерны: ${JSON.stringify(canvasTopology.simulationMetrics?.antiPatterns?.map((ap: any) => ap.title) || [])}
`;
  }

  const prompt = `Ты — комитет оценки System Design собеседований (Staff Bar-Raiser).
Оцени архитектурное решение кандидата для задачи: ${scenario.title || scenarioId}.

ТЗ и профиль: ${JSON.stringify(scenario.trafficProfile || {})}
Предложенная архитектура:
${topologySection}

Пояснительная записка кандидата:
${notesMarkdown || 'Не предоставлена'}

Верни СТРОГИЙ JSON формат:
{
  "totalScore": 85,
  "verdict": "STRONG_HIRE | HIRE | LEANING_HIRE | NO_HIRE",
  "radarMetrics": {
    "scalability": 90,
    "faultTolerance": 80,
    "dataConsistency": 85,
    "tradeOffJustification": 80,
    "costEfficiency": 75
  },
  "strengths": ["...", "..."],
  "vulnerabilities": ["...", "..."],
  "barRaiserFeedback": "..."
}`;

  const chatResult = await callLiteLlmChat({
    model: envConfig.models.text,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2
  }, {
    signal: getRequestAbortSignal(req),
    timeoutMs: 45_000,
    maxRetries: 2
  });

  const parsed = parseJsonFromLlm<any>(chatResult.content, {});

  // Persist into system_design_submissions table
  try {
    const userId = getAuthUserId(req);
    const submissionId = `sd_${scenarioId}_${userId}_${Date.now()}`;
    db.prepare(`
      INSERT INTO system_design_submissions (
        id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      submissionId,
      scenarioId,
      userId,
      canvasTopology ? JSON.stringify(canvasTopology) : (architectureMermaid || ''),
      notesMarkdown || '',
      JSON.stringify(parsed)
    );
  } catch (persistErr) {
    console.warn('Could not persist system design submission:', persistErr);
  }

  res.json(parsed);
}));

// GET /api/system-design/submissions/:scenarioId - Retrieve latest evaluation and submission for current user
systemDesignRouter.get('/submissions/:scenarioId', asyncHandler(async (req, res) => {
  const { scenarioId } = req.params;
  const userId = getAuthUserId(req);
  const row: any = db.prepare(`
    SELECT id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
    FROM system_design_submissions
    WHERE scenario_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(scenarioId, userId);

  if (!row) {
    return res.json({ submission: null });
  }

  let parsedTopology: any = null;
  let architectureMermaid: string | null = null;
  if (row.architecture_mermaid) {
    const parsed = safeJsonParse<any>(row.architecture_mermaid, null);
    if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.edges)) {
      parsedTopology = parsed;
    } else {
      architectureMermaid = row.architecture_mermaid;
    }
  }

  const parsedEvaluation = row.evaluation_json ? safeJsonParse(row.evaluation_json, null) : null;

  res.json({
    submission: {
      id: row.id,
      scenarioId: row.scenario_id,
      canvasTopology: parsedTopology,
      architectureMermaid: architectureMermaid,
      architectureNotes: row.notes_markdown,
      candidateNotes: row.notes_markdown,
      evaluation: parsedEvaluation,
      evaluationJson: row.evaluation_json,
      createdAt: row.created_at
    }
  });
}));
