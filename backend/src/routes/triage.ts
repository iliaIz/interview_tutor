import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';

export const triageRouter = Router();

// GET /api/triage/challenges
triageRouter.get('/challenges', (req: Request, res: Response) => {
  try {
    const { category, severity } = req.query;
    let query = 'SELECT id, incident_number, slug, title, category, severity, manifest_json FROM production_triage_challenges WHERE 1=1';
    const params: any[] = [];

    if (category && typeof category === 'string' && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (severity && typeof severity === 'string' && severity !== 'all') {
      query += ' AND severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY incident_number ASC';
    const rows = db.prepare(query).all(...params) as any[];

    const incidents = rows.map(r => {
      try {
        return JSON.parse(r.manifest_json);
      } catch {
        return r;
      }
    });

    res.json(incidents);
  } catch (err: any) {
    console.error('Error fetching triage challenges:', err);
    res.status(500).json({ error: 'Failed to fetch triage challenges', message: err.message });
  }
});

// GET /api/triage/challenges/:id
triageRouter.get('/challenges/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT manifest_json FROM production_triage_challenges WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(JSON.parse(row.manifest_json));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch incident details', message: err.message });
  }
});

// POST /api/triage/evaluate
triageRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { incidentId, rcaHypothesis, preventionPlan } = req.body;
    const row = db.prepare('SELECT manifest_json FROM production_triage_challenges WHERE id = ?').get(incidentId) as any;
    const incident = row ? JSON.parse(row.manifest_json) : {};

    const prompt = `Ты — ведущий SRE & Principal Java Архитектор.
Оцени расследование производственного инцидента кандидатом.

Инцидент: ${incident.title || incidentId}
Категория: ${incident.category || 'JVM'}
Симптомы: ${incident.symptomsMarkdown}

Эталонный анализ корневой причины (Ground Truth RCA):
${incident.rootCauseAnalysis}

Эталонные превентивные меры (Ground Truth Remediation):
${incident.remediationMarkdown}

Ответ кандидата:
Гипотеза RCA:
${rcaHypothesis || 'Не заполнено'}

Превентивный план:
${preventionPlan || 'Не заполнено'}

Верни СТРОГИЙ JSON формат:
{
  "score": 85,
  "isRootCauseCorrect": true,
  "verdict": "RESOLVED | PARTIALLY_RESOLVED | INCORRECT",
  "rcaFeedback": "Разбор правильности понимания причины...",
  "remediationFeedback": "Разбор архитектурных мер...",
  "missingNuances": ["...", "..."],
  "seniorBarRating": "Senior / Lead Level"
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
    console.error('Triage eval error:', err);
    res.status(500).json({ error: 'Triage evaluation failed', message: err.message });
  }
});
