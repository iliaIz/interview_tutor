import { db } from './db';
import { envConfig } from '../config/env';
import { buildSystemDesignEvaluationPrompt } from '../prompts/systemDesign/systemDesignPrompts';
import { resolveScenarioManifest, resolveCanonicalId } from './scenarioResolver';

export interface EvaluationPayload {
  scenarioId: string;
  architectureMermaid?: string;
  notesMarkdown?: string;
  canvasTopology?: any;
  verdict?: string;
  totalScore?: number;
  radarMetrics?: any;
  strengths?: string[];
  vulnerabilities?: string[];
  barRaiserFeedback?: string;
}

export async function evaluateSystemDesign(
  payload: EvaluationPayload,
  userId: string,
  abortSignal?: AbortSignal
): Promise<any> {
  const { scenarioId, architectureMermaid, notesMarkdown, canvasTopology } = payload;
  const scenario = resolveScenarioManifest(scenarioId) || {};

  let topologySection = architectureMermaid || 'Не предоставлена';
  if (canvasTopology) {
    topologySection = `
Интерактивная топология холста:
Узлы (${canvasTopology.nodes?.length || 0}): ${JSON.stringify(
      canvasTopology.nodes?.map((n: any) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        tech: n.config?.technology,
        replicas: n.config?.replicas
      }))
    )}
Связи: ${JSON.stringify(
      canvasTopology.edges?.map((e: any) => ({
        from: e.source,
        to: e.target,
        protocol: e.config?.protocol,
        isAsync: e.config?.isAsync
      }))
    )}
Результаты DES симуляции нагрузки:
- Входящий RPS: ${canvasTopology.simulationMetrics?.globalInputRps || 'N/A'}
- Пропускная способность: ${canvasTopology.simulationMetrics?.globalProcessedRps || 'N/A'} RPS
- p99 задержка: ${canvasTopology.simulationMetrics?.globalP99LatencyMs || 'N/A'} мс
- Ошибки (Error Rate): ${((canvasTopology.simulationMetrics?.globalErrorRate || 0) * 100).toFixed(1)}%
- Выявленные симулятором антипаттерны: ${JSON.stringify(
      canvasTopology.simulationMetrics?.antiPatterns?.map((ap: any) => ap.title) || []
    )}
`;
  }

  const prompt = buildSystemDesignEvaluationPrompt({
    scenarioTitle: scenario.title || scenarioId,
    scenarioCategory: scenario.category,
    trafficProfile: scenario.trafficProfile,
    topologySection,
    notesMarkdown
  });

  let parsed: any;
  if (payload.verdict && typeof payload.totalScore === 'number') {
    parsed = {
      totalScore: payload.totalScore,
      verdict: payload.verdict,
      radarMetrics: payload.radarMetrics || {
        scalability: 85,
        faultTolerance: 80,
        dataConsistency: 85,
        tradeOffJustification: 80,
        costEfficiency: 75
      },
      strengths: payload.strengths || ['Защищены ключевые компромиссы распределенной архитектуры'],
      vulnerabilities: payload.vulnerabilities || [],
      barRaiserFeedback: payload.barRaiserFeedback || 'Защита сценария успешно зарегистрирована.'
    };
  } else {
    const endpointUrl = envConfig.proxy.chatUrl;
    const proxyApiKey = envConfig.proxy.apiKey;
    const modelName = envConfig.models.text;

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyApiKey}`
      },
      signal: abortSignal,
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
    let content = data.choices?.[0]?.message?.content || '{}';
    if (typeof content === 'string') {
      content = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    }
    parsed = JSON.parse(content);
  }

  const submissionId = `sd_${scenarioId}_${userId}_${Date.now()}`;

  // Atomic Dual-Persistence via db.transaction
  try {
    const persistDualTx = db.transaction(() => {
      // 1. Persist into legacy system_design_submissions table
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

      // 2. Persist into SSOT user_progress_ledger with dual-key canonical resolution
      const canonicalId = resolveCanonicalId(scenarioId);
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId);

      if (manifestRow) {
        const score = typeof parsed.totalScore === 'number'
          ? parsed.totalScore
          : (parsed.overall_score ? Math.round(parsed.overall_score * 20) : 75);
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
        console.log(`📊 [Ledger] Evaluation atomically persisted: ${ledgerId} (${status}, score: ${score})`);
      }
    });

    persistDualTx();
  } catch (persistErr) {
    console.warn('Could not atomically persist system design submission / ledger:', persistErr);
  }

  return parsed;
}
