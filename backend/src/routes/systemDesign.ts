import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';

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

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`LLM Gateway HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Как ваша система гарантирует идемпотентность при сетевых повторах?';
    res.json({ reply });
  } catch (err: any) {
    console.error('System design probe error:', err);
    res.status(500).json({ error: 'AI probe failed', message: err.message });
  }
});

// POST /api/system-design/evaluate
systemDesignRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { scenarioId, architectureMermaid, notesMarkdown } = req.body;
    const row = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ?').get(scenarioId) as any;
    const scenario = row ? JSON.parse(row.manifest_json) : {};

    const prompt = `Ты — комитет оценки System Design собеседований (Staff Bar-Raiser).
Оцени архитектурное решение кандидата для задачи: ${scenario.title || scenarioId}.

ТЗ и профиль: ${JSON.stringify(scenario.trafficProfile || {})}
Предложенная кандидатом архитектура (Mermaid):
${architectureMermaid || 'Не предоставлена'}

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

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`LLM Gateway HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err: any) {
    console.error('System design eval error:', err);
    res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
});
