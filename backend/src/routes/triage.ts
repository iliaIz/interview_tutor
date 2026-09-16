import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import {
  buildTriageEvaluationPrompt,
  buildTriageProbePrompt
} from '../prompts/triage/triagePrompts';
import { wrapUntrustedContext } from '../prompts/core/sandboxDirectives';

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

    const { systemPrompt, userPrompt: userMessageContent } = buildTriageEvaluationPrompt({
      incidentTitle: incident.title || incidentId,
      category: incident.category,
      severity: incident.severity,
      symptomsMarkdown: incident.symptomsMarkdown,
      rootCauseAnalysis: incident.rootCauseAnalysis,
      remediationMarkdown: incident.remediationMarkdown,
      rcaHypothesis,
      preventionPlan
    });

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45_000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    let response: Response | any;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });
    } finally {
      clearTimeout(timeoutId);
    }

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

// POST /api/triage/probe (Socratic AI Incident Commander Interactive Probing)
triageRouter.post('/probe', async (req: Request, res: Response) => {
  try {
    const { incidentId, userMessage, conversationHistory } = req.body;
    const row = db.prepare('SELECT manifest_json FROM production_triage_challenges WHERE id = ?').get(incidentId) as any;
    const incident = row ? JSON.parse(row.manifest_json) : null;

    const systemPrompt = buildTriageProbePrompt({
      incidentTitle: incident ? incident.title : (incidentId || 'P0 Incident'),
      category: incident?.category,
      severity: incident?.severity,
      symptomsMarkdown: incident?.symptomsMarkdown,
      rootCauseAnalysis: incident?.rootCauseAnalysis,
      remediationMarkdown: incident?.remediationMarkdown,
      keyMetricTrigger: incident?.keyMetricTrigger
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: wrapUntrustedContext('incident_commander_inquiry', userMessage) }
    ];

    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45_000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    let response: Response | any;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.6,
          max_tokens: 800
        })
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`LLM Gateway HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Что показывает дамп потоков относительно состояния рабочих воркеров?';
    res.json({ reply });
  } catch (err: any) {
    console.error('Triage probe error:', err);
    res.status(500).json({ error: 'Failed to communicate with Incident Commander', message: err.message });
  }
});
