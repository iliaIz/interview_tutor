import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import { callLiteLlmChat, parseJsonFromLlm } from '../services/llmClient';

export const systemDesignRouter = Router();

// GET /api/system-design/scenarios
systemDesignRouter.get('/scenarios', (req: Request, res: Response) => {
  try {
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
    
    const scenarios = rows.map(r => {
      try {
        return JSON.parse(r.manifest_json);
      } catch {
        return r;
      }
    });

    res.json(scenarios);
  } catch (err: any) {
    console.error('Error fetching system design scenarios:', err);
    res.status(500).json({ error: 'Failed to fetch scenarios', message: err.message });
  }
});

// GET /api/system-design/scenarios/:id
systemDesignRouter.get('/scenarios/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(JSON.parse(row.manifest_json));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch scenario details', message: err.message });
  }
});

// POST /api/system-design/probe (Staff AI Interactive Socratic Probing)
systemDesignRouter.post('/probe', async (req: Request, res: Response) => {
  try {
    const { scenarioId, userMessage, conversationHistory } = req.body;
    const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ?').get(scenarioId) as any;
    
    const scenario = row ? JSON.parse(row.manifest_json) : null;
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
      signal: (req as any).signal,
      timeoutMs: 45_000,
      maxRetries: 2
    });

    const reply = chatResult.content || 'Как ваша система гарантирует идемпотентность при сетевых повторах?';
    res.json({ reply });
  } catch (err: any) {
    console.error('System design probe error:', err);
    res.status(500).json({ error: 'AI probe failed', message: err.message });
  }
});

// POST /api/system-design/evaluate
systemDesignRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { scenarioId, architectureMermaid, notesMarkdown, canvasTopology } = req.body;
    const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ?').get(scenarioId) as any;
    const scenario = row ? JSON.parse(row.manifest_json) : {};

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
      signal: (req as any).signal,
      timeoutMs: 45_000,
      maxRetries: 2
    });

    const parsed = parseJsonFromLlm<any>(chatResult.content, {});

    // Persist into system_design_submissions table
    try {
      const userId = (req as any).user?.id || 'default_user';
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
  } catch (err: any) {
    console.error('System design eval error:', err);
    res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
});

// GET /api/system-design/submissions/:scenarioId - Retrieve latest evaluation and submission for current user
systemDesignRouter.get('/submissions/:scenarioId', (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const userId = (req as any).user?.id || 'default_user';
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

    let parsedTopology = null;
    let architectureMermaid = null;
    try {
      if (row.architecture_mermaid) {
        const parsed = JSON.parse(row.architecture_mermaid);
        if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.edges)) {
          parsedTopology = parsed;
        } else {
          architectureMermaid = row.architecture_mermaid;
        }
      }
    } catch (_) {
      architectureMermaid = row.architecture_mermaid;
    }

    let parsedEvaluation = null;
    try {
      if (row.evaluation_json) parsedEvaluation = JSON.parse(row.evaluation_json);
    } catch (_) {}

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
  } catch (err: any) {
    console.error('Fetch submission error:', err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});
