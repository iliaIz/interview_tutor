import { WebSocket } from 'ws';
import { db } from '../db';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { calculateFaangScorecard } from '../../prompts/personas';
import { buildWeightedRubric } from './livePromptBuilder';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { LiveToolContext } from './liveToolDispatcher';

export async function handleEvaluationToolCall(ctx: LiveToolContext): Promise<boolean> {
  const { call, clientSocket, geminiSocket, session, liveCoaching = false } = ctx;

  if (call.name !== 'submit_interview_evaluation') {
    return false;
  }

  // SOTA First-Turn Guard: Reject premature evaluation if candidate has not yet responded
  if (!session.hasCandidateResponded) {
    console.warn('🛡️ [First-Turn Guard] Blocked premature submit_interview_evaluation before candidate spoke. Re-prompting AI to speak question...');
    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              response: {
                error: 'Кандидат еще не отвечал на вопрос. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выставлять оценку на этапе первого приветствия. Пожалуйста, поприветствуйте кандидата голосом и четко зачитайте вопрос темы вслух.'
              },
              id: call.id,
              scheduling: 'SILENT'
            }
          ]
        }
      }));
    }
    return true;
  }

  const args = call.args || {};
  const score = typeof args.score === 'number' ? args.score : 75;
  const isPassed = args.isPassed ?? (score >= 70);
  const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
  const missingPoints = Array.isArray(args.missingPoints) ? args.missingPoints : [];
  const feedback = args.spokenFeedback || args.feedback || 'Ответ принят.';
  const questionType = args.questionType || 'definitional';
  const speechCoaching = args.speechCoaching || null;

  const rawCriteriaBreakdown = Array.isArray(args.criteriaBreakdown) ? args.criteriaBreakdown : [];
  let rawDeductions = Array.isArray(args.deductions) ? args.deductions : [];
  const upgradeSnippet = typeof args.upgradeSnippet === 'string' ? args.upgradeSnippet : '';

  // Auto-Balancer & Fallback: If model did not supply criteriaBreakdown, build it from default rubric
  let criteriaBreakdown = rawCriteriaBreakdown;
  if (criteriaBreakdown.length === 0) {
    const defaultRubric = buildWeightedRubric(session.referenceAnswer || '', session.questionText || '');
    let remainingScore = score;
    criteriaBreakdown = defaultRubric.map((r, idx) => {
      let earned = 0;
      if (remainingScore >= r.weight) {
        earned = r.weight;
        remainingScore -= r.weight;
      } else {
        earned = remainingScore;
        remainingScore = 0;
      }
      const isFull = earned === r.weight;
      const isZero = earned === 0;
      return {
        id: r.id,
        title: r.title,
        maxPoints: r.weight,
        earnedPoints: earned,
        status: isFull ? 'covered' : (isZero ? 'missed' : 'partial'),
        probeAssisted: (session.probesCount || 0) > 0 && !isFull && earned > 0,
        evidence: isFull ? 'Критерий раскрыт в ответе' : undefined,
        gap: isFull ? undefined : (missingPoints[idx] || `Недостаточно полно раскрыты ${r.title.toLowerCase()}`)
      };
    });
  }

  // Auto-Balancer for deductions: if score < 100 and deductions is empty, derive deductions from criteria gaps
  const totalLostPoints = Math.max(0, 100 - score);
  let deductions = rawDeductions;
  if (totalLostPoints > 0 && deductions.length === 0) {
    const gapCriteria = criteriaBreakdown.filter((c: any) => (c.maxPoints - c.earnedPoints) > 0);
    if (gapCriteria.length > 0) {
      deductions = gapCriteria.map((c: any) => ({
        penalty: c.maxPoints - c.earnedPoints,
        criteria: c.title,
        reason: c.gap || `Неполный ответ по критерию «${c.title}»`
      }));
    } else if (missingPoints.length > 0) {
      const perPoint = Math.max(1, Math.round(totalLostPoints / missingPoints.length));
      deductions = missingPoints.map((mp: string, i: number) => ({
        penalty: i === missingPoints.length - 1 ? (totalLostPoints - perPoint * (missingPoints.length - 1)) : perPoint,
        criteria: 'Зоны роста',
        reason: mp
      }));
    } else {
      deductions = [{
        penalty: totalLostPoints,
        criteria: 'Подводные камни и глубина раскрытия',
        reason: 'Ответ не содержит разбора подводных камней, граничных условий или production best practices.'
      }];
    }
  }

  // Synchronize missingPoints so legacy views and users never see an empty list when score < 100
  if (missingPoints.length === 0 && deductions.length > 0) {
    missingPoints.push(...deductions.map((d: any) => `${d.criteria}: ${d.reason} (-${d.penalty} б.)`));
  }

  // FAANG Calibration Scorecard calculation
  const calculatedScorecard = calculateFaangScorecard({
    score,
    persona: session.persona || 'mentor',
    targetGrade: session.targetGrade || 'L5_SENIOR',
    positivePoints,
    missingPoints,
    questionType
  });

  const faangScorecard = args.faangScorecard ? {
    ...calculatedScorecard,
    ...args.faangScorecard,
    dimensionScores: {
      ...calculatedScorecard.dimensionScores,
      ...(args.faangScorecard.dimensionScores || {})
    }
  } : calculatedScorecard;

  let savedEvalId = '';
  if (session.questionId) {
    try {
      const mem = session.sessionId ? getOrCreateSessionMemory(session.sessionId, session.questionId || '') : null;
      const dialogueTranscript = mem && mem.turns && mem.turns.length > 0
        ? mem.turns.map(t => `${t.role === 'user' ? 'Кандидат' : 'Интервьюер'}: ${t.text}`).join('\n\n')
        : (session.turnTelemetryHistory && session.turnTelemetryHistory.length > 0
            ? session.turnTelemetryHistory.map(t => `Turn ${t.turnIndex} (${t.speaker}): duration ${t.speechDurationMs}ms`).join('\n')
            : 'Устный диалог в Gemini Live');

      const syncResult = recordEvaluationAndSyncProgress({
        userId: session.userId || 'default_user',
        questionId: session.questionId,
        topic: session.topic || 'General',
        mode: 'voice',
        score,
        isPassed,
        positivePoints,
        missingPoints,
        feedback,
        speechCoaching: {
          ...(speechCoaching || {}),
          questionType,
          faangScorecard,
          criteriaBreakdown,
          deductions,
          upgradeSnippet
        },
        turnTelemetry: session.turnTelemetryHistory || [],
        transcript: dialogueTranscript,
        userAnswer: dialogueTranscript
      });
      savedEvalId = syncResult.evalId;
      console.log(`💾 Live evaluation saved & progress synced to DB: ${savedEvalId} (Score: ${score}, Topic: ${syncResult.progress.topic}, Percentage: ${syncResult.progress.percentage}%)`);
    } catch (dbErr) {
      console.error('Error saving Live evaluation to DB:', dbErr);
    }

    // If this session is for a System Design scenario, persist into user_progress_ledger
    try {
      const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(session.questionId) as any;
      const canonicalId = aliasRow ? aliasRow.canonical_id : session.questionId;
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
      if (manifestRow) {
        const ledgerId = `prog_live_${canonicalId}_${session.userId || 'default_user'}_${Date.now()}`;
        const status = isPassed ? 'PASSED' : 'FAILED';
        db.prepare(`
          INSERT INTO user_progress_ledger (
            id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          ledgerId,
          session.userId || 'default_user',
          canonicalId,
          'STUDIO_3_DEFENSE',
          status,
          score,
          JSON.stringify({
            savedEvalId,
            feedback,
            positivePoints,
            missingPoints,
            faangScorecard,
            criteriaBreakdown,
            deductions
          })
        );
        console.log(`📊 [Ledger] Live evaluation persisted to user_progress_ledger: ${ledgerId} (${status}, score: ${score})`);
      }
    } catch (ledgerErr) {
      console.warn('⚠️ [Ledger] Could not persist live evaluation to user_progress_ledger:', ledgerErr);
    }
  }

  // Determine assistance level for knowledge tracing
  const probes = session.probesCount || 0;
  let assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse' = 'solo';
  if (session.isRetry) {
    assistanceLevel = isPassed ? 'assisted' : 'relapse';
  } else if (score >= 80 && probes <= 2 && !liveCoaching) {
    assistanceLevel = 'solo';
  } else if (score >= 70) {
    assistanceLevel = 'guided';
  } else if (liveCoaching || (score >= 60 && score < 70)) {
    assistanceLevel = isPassed ? 'assisted' : 'relapse';
  } else {
    assistanceLevel = 'relapse';
  }

  // Apply knowledge decay & record new gap if failed
  let decayResult: any = null;
  try {
    decayResult = await applyKnowledgeDecay({
      questionId: session.questionId,
      topic: session.topic || 'General',
      assistanceLevel,
      resolvedGapIds: session.relevantGapIds
    });
    console.log(`🧠 Knowledge decay applied (${assistanceLevel}):`, JSON.stringify(decayResult));
  } catch (decayErr) {
    console.error('Error applying knowledge decay:', decayErr);
  }

  if (!isPassed && missingPoints.length > 0) {
    try {
      void recordNewErrorGap({
        questionId: session.questionId,
        topic: session.topic || 'General',
        errorConcept: missingPoints[0],
        initialDeficit: 1.0
      });
    } catch (recErr) {
      console.warn('Could not record new gap:', recErr);
    }
  }

  // Return tool response to Gemini Live with WHEN_IDLE scheduling (SOTA Late 2026)
  const toolResponse = {
    toolResponse: {
      functionResponses: [
        {
          id: call.id,
          name: call.name,
          response: {
            result: {
              success: true,
              saved: true,
              score,
              isPassed,
              evaluationId: savedEvalId,
              message: 'Оценка сохранена в ведомость.',
              directive: 'Кратко подведи итог (1-2 предложения), поблагодари за ответ и назови вердикт. Не молчи.'
            }
          },
          scheduling: 'WHEN_IDLE'
        }
      ]
    }
  };

  if (geminiSocket.readyState === WebSocket.OPEN) {
    geminiSocket.send(JSON.stringify(toolResponse));
  }

  // Notify frontend client with evaluation data (both evaluation and payload for zero-drift compatibility)
  const evaluationPayload = {
    id: savedEvalId,
    questionId: session.questionId,
    score,
    isPassed,
    positivePoints,
    missingPoints,
    feedback,
    spokenFeedback: feedback,
    questionType,
    speechCoaching,
    faangScorecard,
    criteriaBreakdown,
    deductions,
    upgradeSnippet,
    assistanceLevel,
    knowledgeUpdate: decayResult
  };

  if (clientSocket.readyState === WebSocket.OPEN) {
    clientSocket.send(JSON.stringify({
      type: 'evaluation_completed',
      evaluation: evaluationPayload,
      payload: evaluationPayload
    }));
  }

  console.log('✅ Evaluation delivered to client. Keeping session lifeline open for Q&A and transition.');
  return true;
}
