import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { envConfig } from '../config/env';

export const systemDesignRouter = Router();

/**
 * Разрешает манифест сценария за O(1):
 * 1. Проверяет таблицу system_design_aliases (дуальные ключи, 49 historic roadmap IDs)
 * 2. Проверяет каноническую таблицу system_design_manifests
 * 3. Fallback на legacy system_design_challenges для обратной совместимости
 */
export function resolveScenarioManifest(scenarioId: string): any | null {
  // 1. Dual-key alias lookup
  const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
  const canonicalId = aliasRow ? aliasRow.canonical_id : scenarioId;

  // 2. Canonical manifests table lookup
  const manifestRow = db.prepare('SELECT manifest_json FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
  if (manifestRow) {
    try {
      return JSON.parse(manifestRow.manifest_json);
    } catch {
      return null;
    }
  }

  // 3. Fallback to legacy challenges table
  const legacyRow = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ? OR slug = ?').get(scenarioId, scenarioId) as any;
  if (legacyRow) {
    try {
      return JSON.parse(legacyRow.manifest_json);
    } catch {
      return null;
    }
  }

  return null;
}

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

// POST /api/system-design/probe (Staff AI Interactive Socratic Probing)
systemDesignRouter.post('/probe', async (req: Request, res: Response) => {
  try {
    const { scenarioId, userMessage, conversationHistory } = req.body;
    const scenario = resolveScenarioManifest(scenarioId);
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
          temperature: 0.7,
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
    const { scenarioId, architectureMermaid, notesMarkdown, canvasTopology } = req.body;
    const scenario = resolveScenarioManifest(scenarioId) || {};

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

    let parsed: any;
    if (req.body.verdict && typeof req.body.totalScore === 'number') {
      parsed = {
        totalScore: req.body.totalScore,
        verdict: req.body.verdict,
        radarMetrics: req.body.radarMetrics || {
          scalability: 85,
          faultTolerance: 80,
          dataConsistency: 85,
          tradeOffJustification: 80,
          costEfficiency: 75
        },
        strengths: req.body.strengths || ['Защищены ключевые компромиссы распределенной архитектуры'],
        vulnerabilities: req.body.vulnerabilities || [],
        barRaiserFeedback: req.body.barRaiserFeedback || 'Защита сценария успешно зарегистрирована.'
      };
    } else {
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
            messages: [{ role: 'user', content: prompt }],
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
      let content = data.choices?.[0]?.message?.content || '{}';
      if (typeof content === 'string') {
        content = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      }
      parsed = JSON.parse(content);
    }

    const userId = (req as any).user?.id || 'default_user';
    const submissionId = `sd_${scenarioId}_${userId}_${Date.now()}`;

    // 1. Persist into legacy system_design_submissions table
    try {
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

    // 2. Persist into SSOT user_progress_ledger with dual-key canonical resolution
    try {
      const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
      const canonicalId = aliasRow ? aliasRow.canonical_id : scenarioId;
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId);

      if (manifestRow) {
        const score = typeof parsed.totalScore === 'number' ? parsed.totalScore : (parsed.overall_score ? Math.round(parsed.overall_score * 20) : 75);
        const status = score >= 70 ? 'PASSED' : 'FAILED';
        const studioStage = canvasTopology ? 'STUDIO_2_SIMULATION' : 'STUDIO_3_DEFENSE';
        const ledgerId = `prog_${canonicalId}_${userId}_${Date.now()}`;

        db.prepare(`
          INSERT INTO user_progress_ledger (
            id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          ledgerId,
          userId,
          canonicalId,
          studioStage,
          status,
          score,
          JSON.stringify({
            submissionId,
            scenarioId,
            parsedEvaluation: parsed
          })
        );
        console.log(`📊 [Ledger] Evaluation persisted to user_progress_ledger: ${ledgerId} (${status}, score: ${score})`);
      }
    } catch (ledgerErr) {
      console.warn('⚠️ [Ledger] Could not persist to user_progress_ledger:', ledgerErr);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('System design eval error:', err);
    res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
});

// GET /api/system-design/submissions/:scenarioId - Retrieve latest evaluation and submission with dual-key resolution
systemDesignRouter.get('/submissions/:scenarioId', (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const userId = (req as any).user?.id || 'default_user';

    const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
    const canonicalId = aliasRow ? aliasRow.canonical_id : scenarioId;

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

// GET /api/system-design/ledger/:scenarioId - Retrieve latest progress from user_progress_ledger
systemDesignRouter.get('/ledger/:scenarioId', (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const userId = (req as any).user?.id || 'default_user';

    const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
    const canonicalId = aliasRow ? aliasRow.canonical_id : scenarioId;

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

