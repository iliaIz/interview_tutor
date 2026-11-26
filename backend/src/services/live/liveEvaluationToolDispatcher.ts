import { normalizeUserId } from '../evaluation/QuestionEvaluationRepository';
import { mergeFaangScorecard } from '../evaluation/QuestionEvaluationService';
import { calculateFaangScorecard } from '../../prompts/personas';
import { buildWeightedRubric } from './liveRubricBuilder';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolExecutor';

export async function handleSubmitInterviewEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { session, liveCoaching } = ctx;
  const userId = normalizeUserId(session.userId);

  const score = typeof args.score === 'number' ? Math.max(0, Math.min(100, Math.round(args.score))) : 70;
  const isPassed = typeof args.isPassed === 'boolean' ? args.isPassed : score >= 70;
  const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
  const missingPoints = Array.isArray(args.missingPoints) ? [...args.missingPoints] : [];
  const feedback = typeof args.spokenFeedback === 'string' ? args.spokenFeedback : (args.feedback || 'Ответ принят.');
  const questionType = args.questionType || 'definitional';
  const speechCoaching = args.speechCoaching || null;
  const upgradeSnippet = typeof args.upgradeSnippet === 'string' ? args.upgradeSnippet : '';

  let criteriaBreakdown = Array.isArray(args.criteriaBreakdown) ? args.criteriaBreakdown : [];
  if (criteriaBreakdown.length === 0) {
    const defaultRubric = buildWeightedRubric(session.referenceAnswer || '', session.questionText || '');
    let remainingScore = score;
    criteriaBreakdown = defaultRubric.map((r, idx) => {
      const earned = remainingScore >= r.weight ? r.weight : remainingScore;
      remainingScore = Math.max(0, remainingScore - earned);
      const isFull = earned === r.weight;
      return {
        id: r.id,
        title: r.title,
        maxPoints: r.weight,
        earnedPoints: earned,
        status: isFull ? 'covered' : (earned === 0 ? 'missed' : 'partial'),
        probeAssisted: (session.probesCount || 0) > 0 && !isFull && earned > 0,
        evidence: isFull ? 'Критерий раскрыт в ответе' : undefined,
        gap: isFull ? undefined : (missingPoints[idx] || `Недостаточно полно раскрыты ${r.title.toLowerCase()}`)
      };
    });
  }

  const totalLostPoints = Math.max(0, 100 - score);
  let deductions = Array.isArray(args.deductions) ? args.deductions : [];
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
  const faangScorecard = mergeFaangScorecard(calculatedScorecard, args.faangScorecard);

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

  let savedEvalId = '';
  let decayResult: any = null;
  if (session.questionId && ctx.persistencePort) {
    try {
      const mem = session.sessionId ? getOrCreateSessionMemory(session.sessionId, session.questionId) : null;
      const dialogueTranscript =
        mem && mem.turns && mem.turns.length > 0
          ? mem.turns.map((t) => `${t.role === 'user' ? 'Кандидат' : 'Интервьюер'}: ${t.text}`).join('\n\n')
          : session.turnTelemetryHistory && session.turnTelemetryHistory.length > 0
            ? session.turnTelemetryHistory.map((t) => `Turn ${t.turnIndex} (${t.speaker}): duration ${t.speechDurationMs}ms`).join('\n')
            : 'Устный диалог в Gemini Live';

      const saved = await ctx.persistencePort.saveEvaluationOutcome({
        userId,
        questionId: session.questionId,
        topic: session.topic || 'General',
        questionText: session.questionText,
        referenceAnswer: session.referenceAnswer,
        mode: 'voice',
        score,
        isPassed,
        positivePoints,
        missingPoints,
        feedback,
        faangScorecard,
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
        userAnswer: dialogueTranscript,
        assistanceLevelOverride: assistanceLevel,
        resolvedGapIds: session.relevantGapIds
      });
      savedEvalId = saved.evaluationId;
      decayResult = saved.knowledgeUpdate ?? (saved.deltaProgress as any)?.knowledgeUpdate ?? null;
      console.log(`💾 Live evaluation saved via ToolPersistencePort: ${savedEvalId} (Score: ${score}, User: ${userId})`);
    } catch (dbErr) {
      console.error('Error saving Live evaluation via ToolPersistencePort:', dbErr);
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
