import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';
import {
  buildSystemDesignProbePrompt,
  SystemDesignTutorMode
} from '../prompts/systemDesign/systemDesignPrompts';
import { wrapUntrustedContext } from '../prompts/core/sandboxDirectives';
import { resolveScenarioManifest, resolveCanonicalId } from '../services/scenarioResolver';
import { evaluateSystemDesign } from '../services/systemDesignEvaluator';

export { resolveScenarioManifest, resolveCanonicalId };
export const systemDesignRouter = Router();

// GET /api/system-design/scenarios
systemDesignRouter.get('/scenarios', (req: Request, res: Response) => {
  try {
    const { category, search, level } = req.query;

    const countRow = db.prepare('SELECT COUNT(*) as count FROM system_design_manifests').get() as any;
    if (countRow && countRow.count > 0) {
      let query = 'SELECT canonical_id, target_level, archetype, title, subtitle, pedagogical_mode, manifest_json FROM system_design_manifests WHERE 1=1';
      const params: any[] = [];

      if (level && typeof level === 'string' && level !== 'all') {
        query += ' AND target_level = ?';
        params.push(level.toUpperCase());
      }
      if (category && typeof category === 'string' && category !== 'all') {
        query += ' AND (archetype = ? OR target_level = ?)';
        params.push(category, category);
      }
      if (search && typeof search === 'string' && search.trim()) {
        query += ' AND (title LIKE ? OR problem_statement LIKE ? OR archetype LIKE ?)';
        params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
      }

      query += ' ORDER BY target_level ASC, canonical_id ASC';
      const rows = db.prepare(query).all(...params) as any[];
      const scenarios = rows.map(r => {
        try {
          return JSON.parse(r.manifest_json);
        } catch {
          return r;
        }
      });
      return res.json(scenarios);
    }

    // Fallback if no canonical manifests
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
      let item: any;
      try {
        item = JSON.parse(r.manifest_json);
      } catch {
        item = r;
      }
      if (!item.target_level) {
        const lvl = item.level || '';
        const diff = (item.difficulty || '').toLowerCase();
        const id = (item.canonical_id || item.id || '').toLowerCase();
        if (lvl === 'L0' || diff === 'junior' || id.startsWith('hld-micro')) {
          item.target_level = 'L3_JUNIOR';
        } else if (lvl === 'L2' || id.includes('faded')) {
          item.target_level = 'L4_MIDDLE';
        } else if (lvl === 'L3' || diff === 'senior' || diff === 'lead' || id.startsWith('hld-scenario')) {
          item.target_level = diff === 'lead' ? 'L6_STAFF' : 'L5_SENIOR';
        } else {
          item.target_level = 'L5_SENIOR';
        }
      }
      return item;
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
    const scenarioId = String(req.params.id);
    const scenario = resolveScenarioManifest(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found', requestedId: scenarioId });
    }
    res.json(scenario);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch scenario details', message: err.message });
  }
});

// POST /api/system-design/probe (Universal Multi-Mode AI Tutor Probing)
systemDesignRouter.post('/probe', async (req: Request, res: Response) => {
  try {
    const { 
      scenarioId, 
      userMessage, 
      conversationHistory,
      mode = 'free_chat',
      contextType = 'scenario',
      mathContext,
      currentTopology,
      candidateNotes
    } = req.body;

    const scenario = contextType === 'scenario' ? resolveScenarioManifest(scenarioId) : null;
    const systemPrompt = buildSystemDesignProbePrompt({
      scenarioTitle: scenario?.title,
      category: scenario?.category,
      archetype: scenario?.archetype,
      targetLevel: scenario?.target_level,
      trafficProfile: scenario?.trafficProfile,
      bottlenecksMarkdown: scenario?.bottlenecksMarkdown,
      tradeOffProbes: scenario?.tradeOffProbes,
      mode: mode as SystemDesignTutorMode,
      contextType: contextType as 'scenario' | 'math_coach',
      mathContext,
      currentTopology,
      candidateNotes
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: wrapUntrustedContext('user_message', userMessage) }
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

    let response: any;
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
          temperature: mode === 'deep_dive' ? 0.4 : mode === 'socratic' ? 0.7 : 0.6,
          max_tokens: 1000
        })
      });
    } catch (err: any) {
      if (endpointUrl.includes('host.docker.internal')) {
        const localUrl = endpointUrl.replace('host.docker.internal', 'localhost');
        response = await fetch(localUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyApiKey}`
          },
          signal: abortController.signal,
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: mode === 'deep_dive' ? 0.4 : mode === 'socratic' ? 0.7 : 0.6,
            max_tokens: 1000
          })
        });
      } else {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`LLM Gateway HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Не удалось сформировать ответ тьютора. Попробуйте уточнить вопрос.';
    res.json({ reply, mode });
  } catch (err: any) {
    console.error('System design probe error:', err);
    res.status(500).json({ error: 'AI probe failed', message: err.message });
  }
});

// POST /api/system-design/evaluate
systemDesignRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'default_user';
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45_000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    try {
      const evaluation = await evaluateSystemDesign(req.body, userId, abortController.signal);
      res.json(evaluation);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('System design eval error:', err);
    res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
});

// GET /api/system-design/submissions/:scenarioId
systemDesignRouter.get('/submissions/:scenarioId', (req: Request, res: Response) => {
  try {
    const scenarioId = String(req.params.scenarioId);
    const userId = (req as any).user?.id || 'default_user';
    const canonicalId = resolveCanonicalId(scenarioId);

    const row: any = db.prepare(`
      SELECT id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
      FROM system_design_submissions
      WHERE (scenario_id = ? OR scenario_id = ?) AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(scenarioId, canonicalId, userId);

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
        architectureMermaid,
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

// GET /api/system-design/ledger/:scenarioId
systemDesignRouter.get('/ledger/:scenarioId', (req: Request, res: Response) => {
  try {
    const scenarioId = String(req.params.scenarioId);
    const userId = (req as any).user?.id || 'default_user';
    const canonicalId = resolveCanonicalId(scenarioId);

    const row: any = db.prepare(`
      SELECT id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
      FROM user_progress_ledger
      WHERE canonical_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(canonicalId, userId);

    if (!row) {
      return res.json({ progress: null });
    }

    let parsedArtifacts = null;
    try {
      if (row.artifacts_json) parsedArtifacts = JSON.parse(row.artifacts_json);
    } catch (_) {}

    res.json({
      progress: {
        id: row.id,
        userId: row.user_id,
        canonicalId: row.canonical_id,
        studioStage: row.studio_stage,
        status: row.status,
        score: row.score,
        artifacts: parsedArtifacts,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err: any) {
    console.error('Fetch ledger error:', err);
    res.status(500).json({ error: 'Failed to fetch ledger progress' });
  }
});
