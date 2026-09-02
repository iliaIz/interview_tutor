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

// GET /api/triage/submissions/:incidentId - Fetch latest saved triage submission for user
triageRouter.get('/submissions/:incidentId', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'default_user';
    const row = db.prepare(`
      SELECT id, incident_id, rca_hypothesis, prevention_plan, evaluation_json, score, created_at
      FROM triage_submissions
      WHERE incident_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.incidentId, userId) as any;

    res.json({ submission: row || null });
  } catch (err: any) {
    console.error('Error fetching triage submission:', err);
    res.status(500).json({ error: 'Failed to fetch triage submission', message: err.message });
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
      signal: AbortSignal.timeout(45_000),
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
    let content = (data.choices?.[0]?.message?.content || '{}').trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    const parsed = JSON.parse(content);

    // Persist triage evaluation attempt
    try {
      const userId = (req as any).user?.id || 'default_user';
      const challengeId = incidentId || req.body.challengeId || 'incident';
      const score = typeof parsed.score === 'number'
        ? parsed.score
        : (typeof parsed.totalScore === 'number'
          ? parsed.totalScore
          : (parsed.verdict === 'RESOLVED' ? 100 : parsed.verdict === 'PARTIALLY_RESOLVED' ? 60 : 20));
      db.prepare(`
        INSERT INTO triage_submissions (id, incident_id, user_id, rca_hypothesis, prevention_plan, evaluation_json, score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        `triage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        challengeId,
        userId,
        rcaHypothesis || '',
        preventionPlan || '',
        JSON.stringify(parsed),
        score
      );
    } catch (persistErr) {
      console.warn('Could not persist triage evaluation:', persistErr);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Triage eval error:', err);
    res.status(500).json({ error: 'Triage evaluation failed', message: err.message });
  }
});
