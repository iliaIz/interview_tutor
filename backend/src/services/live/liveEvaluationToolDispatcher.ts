import { db } from '../db';
import { applyKnowledgeDecay, recordNewErrorGap } from '../vectorMemoryService';
import { recordEvaluationAndSyncProgress } from '../progressService';
import { calculateFaangScorecard } from '../../prompts/personas';
import { buildWeightedRubric } from './livePromptBuilder';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';

export async function handleSubmitInterviewEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { session, liveCoaching } = ctx;

  const score = typeof args.score === 'number' ? Math.max(0, Math.min(100, Math.round(args.score))) : 70;
  const isPassed = typeof args.isPassed === 'boolean' ? args.isPassed : score >= 70;
  const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
  const missingPoints = Array.isArray(args.missingPoints) ? [...args.missingPoints] : [];
  const feedback = typeof args.spokenFeedback === 'string' ? args.spokenFeedback : (args.feedback || 'Ответ принят.');
  const questionType = args.questionType || 'definitional';
  const speechCoaching = args.speechCoaching || null;

  const rawCriteriaBreakdown = Array.isArray(args.criteriaBreakdown) ? args.criteriaBreakdown : [];
  const rawDeductions = Array.isArray(args.deductions) ? args.deductions : [];
  const upgradeSnippet = typeof args.upgradeSnippet === 'string' ? args.upgradeSnippet : '';

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

  if (missingPoints.length === 0 && deductions.length > 0) {
    missingPoints.push(...deductions.map((d: any) => `${d.criteria}: ${d.reason} (-${d.penalty} б.)`));
  }

  const calculatedScorecard = calculateFaangScorecard({
    score,
    persona: (session.persona as any) || 'mentor',
    targetGrade: session.targetGrade || 'L5_SENIOR',
    positivePoints,
    missingPoints,
    questionType
  });

  const faangScorecard = args.faangScorecard
    ? {
        ...calculatedScorecard,
        ...args.faangScorecard,
        dimensionScores: {
          ...calculatedScorecard.dimensionScores,
          ...(args.faangScorecard.dimensionScores || {})
        }
      }
    : calculatedScorecard;

  let savedEvalId = '';
  if (session.questionId) {
    try {
      const mem = session.sessionId ? getOrCreateSessionMemory(session.sessionId, session.questionId || '') : null;
      const dialogueTranscript =
        mem && mem.turns && mem.turns.length > 0
          ? mem.turns.map((t) => `${t.role === 'user' ? 'Кандидат' : 'Интервьюер'}: ${t.text}`).join('\n\n')
          : session.turnTelemetryHistory && session.turnTelemetryHistory.length > 0
            ? session.turnTelemetryHistory.map((t) => `Turn ${t.turnIndex} (${t.speaker}): duration ${t.speechDurationMs}ms`).join('\n')
            : 'Устный диалог в Gemini Live';

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

  let decayResult: any = null;
  try {
    decayResult = await applyKnowledgeDecay({
      userId: session.userId || 'anonymous',
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
        userId: session.userId || 'anonymous',
        questionId: session.questionId,
        topic: session.topic || 'General',
        errorConcept: missingPoints[0],
        initialDeficit: 1.0
      });
    } catch (recErr) {
      console.warn('Could not record new gap:', recErr);
    }
  }

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

  console.log('✅ Evaluation prepared for delivery to client. Keeping session lifeline open for Q&A and transition.');

  return {
    result: {
      success: true,
      saved: true,
      score,
      isPassed,
      evaluationId: savedEvalId,
      message: 'Оценка сохранена в ведомость.',
      directive: 'Кратко подведи итог (1-2 предложения), поблагодари за ответ и назови вердикт. Не молчи.'
    },
    clientEvent: {
      type: 'evaluation_completed',
      evaluation: evaluationPayload,
      payload: evaluationPayload
    },
    scheduling: 'WHEN_IDLE'
  };
}
