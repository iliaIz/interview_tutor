/**
 * liveHrToolDispatcher.ts
 * Чистые обработчики вызовов инструментов для HR Screening и Micro-Drill.
 * Не содержат прямых зависимостей от WebSocket (ws).
 */

import { HR_VOICE_EVENTS, HrScorecard, HrStepControlAction } from '@interview-prep/shared';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolExecutor';
import {
  applyGuidedStepAction,
  buildStepStatePayload,
  ensureSessionGuidedState,
  formatRungPromptDirective
} from './hrGuidedStepper';

const VALID_STEP_ACTIONS = new Set<HrStepControlAction>([
  'next_rung',
  'next_beat',
  'prev_beat',
  'next_variant',
  'repeat_beat',
  'select_beat',
  'toggle_cue'
]);

export function handleAdvanceHrLearningStep(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const guided = ensureSessionGuidedState(session);

  if (!guided) {
    return {
      result: { status: 'ERROR', message: 'Микро-блоки для вопроса не найдены.' },
      scheduling: 'WHEN_IDLE'
    };
  }

  const rawAction = String(args.action || 'next_rung') as HrStepControlAction;
  const action: HrStepControlAction = VALID_STEP_ACTIONS.has(rawAction) ? rawAction : 'next_rung';

  const nextState = applyGuidedStepAction(guided.state, guided.beats, action, {
    beatIndex: typeof args.beatIndex === 'number' ? args.beatIndex : undefined,
    masteredCurrentBeat: typeof args.masteredCurrentBeat === 'boolean' ? args.masteredCurrentBeat : undefined
  });
  session.hrGuidedState = nextState;

  const payload = buildStepStatePayload(nextState, guided.beats, 'ai_tool', args.reason ? String(args.reason) : undefined);

  console.log(
    `🪜 [HR_GUIDED] Tool ${action}: beat=${payload.beatIndex + 1}/${payload.totalBeats} (${payload.beatId}), rung=${payload.rung}, var=${payload.variantIndex}`
  );

  return {
    result: {
      status: 'SUCCESS',
      beatId: payload.beatId,
      beatTitle: payload.beatTitle,
      rung: payload.rung,
      cueVisible: payload.cueVisible,
      directive: formatRungPromptDirective(payload, 'ai_tool', action)
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_STEP_STATE,
      payload
    },
    scheduling: 'WHEN_IDLE'
  };
}

export function handleAdvanceHrPhase(
  args: Record<string, any>
): ToolExecutionResult {
  const fromPhase = args.fromPhase || 'unknown';
  const toPhase = args.toPhase || 'next_phase';
  const phaseSummary = args.phaseSummary || 'Фаза завершена.';

  console.log(`🧭 [HR_FSM] Phase transition requested: "${fromPhase}" -> "${toPhase}" (Summary: ${phaseSummary.slice(0, 80)}...)`);

  return {
    result: {
      status: 'SUCCESS',
      message: `Фаза успешно переключена на ${toPhase}.`,
      directive: `Ты перешла к фазе ${toPhase}. Задай следующий вопрос кандидату естественным речевым потоком согласно твоей роли рекрутера. Избегай сервисных комментариев («переходим к следующей фазе») — сразу задавай содержательный вопрос.`
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_PHASE_TRANSITION,
      payload: {
        fromPhase,
        toPhase,
        phaseSummary,
        timestamp: Date.now()
      }
    },
    scheduling: 'SILENT'
  };
}

export function handleEmitHrRoundEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const questionId = args.questionId || session.questionId || 'hr_q0_elevator_pitch';
  const passed = Boolean(args.passed ?? ((args.overallScore || 0) >= 85));
  const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 75)));
  const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || 75)));
  const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || 75)));
  const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || 75)));
  const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || 75)));
  const missedAnchors = Array.isArray(args.missedAnchors) ? args.missedAnchors.map(String) : [];
  const actionableCritique = args.actionableCritique || 'Хороший ответ, продолжайте отработку.';
  const nextAction = args.nextAction === 'advance_next_question' ? 'advance_next_question' : 'repeat_drill';

  console.log(`🎯 [HR_DRILL_EVAL] Question: ${questionId} | Score: ${overallScore} | Passed: ${passed} | Next: ${nextAction}`);

  const speechMs = session.currentTurnMetrics?.speechDurationMs
    ?? (session.currentTurnMetrics?.candidateSpeechEndedAt && session.currentTurnMetrics?.candidateSpeechStartedAt
      ? session.currentTurnMetrics.candidateSpeechEndedAt - session.currentTurnMetrics.candidateSpeechStartedAt
      : undefined);
  const turnDurationSec = typeof args.turnDurationSec === 'number' && Number.isFinite(args.turnDurationSec)
    ? Math.max(1, Math.round(args.turnDurationSec))
    : speechMs && speechMs > 0
    ? Math.max(1, Math.round(speechMs / 1000))
    : 0;
  const averageWpm = typeof args.averageWpm === 'number' && Number.isFinite(args.averageWpm)
    ? Math.max(0, Math.round(args.averageWpm))
    : Math.max(80, Math.min(180, Math.round(115 + (pacingScore - 70) * 0.4)));
  const fillerWordsSpotted = Array.isArray(args.fillerWordsSpotted) ? args.fillerWordsSpotted.map(String) : [];
  const anchorsHit = Array.isArray(args.anchorsHit) ? args.anchorsHit.map(String) : [];

  const scorecard: HrScorecard = {
    sessionId: session.sessionId || 'hr_session',
    turnId: `turn_${Date.now()}`,
    questionId,
    mode: 'rapid_fire_micro_drill',
    overallScore,
    passed,
    metrics: {
      substanceMatch,
      lexicalDensity,
      pacingScore,
      deliveryConfidence
    },
    turnDurationSec,
    averageWpm,
    fillerWordsSpotted,
    anchorsHit,
    anchorsMissed: missedAnchors,
    actionableCritique,
    nextAction
  };

  return {
    result: {
      status: 'SUCCESS',
      message: 'Оценка зафиксирована в системе.',
      directive:
        'Озвучь кандидату краткий вердикт голосом (СТРОГО НЕ БОЛЕЕ 15-20 СЕКУНД!). Сфокусируйся на 1-2 главных ошибках или зафиксируй высокую точность ответа без лести, если балл >= 85. Предложи повторить дубль или перейти дальше.'
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
      payload: scorecard
    },
    scheduling: 'SILENT'
  };
}

export function handleSubmitHrEvaluation(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const overallScore = Math.max(0, Math.min(100, Math.round(Number(args.overallScore) || 80)));
  const passed = overallScore >= 85;
  const substanceMatch = Math.max(0, Math.min(100, Math.round(Number(args.substanceMatch) || overallScore)));
  const lexicalDensity = Math.max(0, Math.min(100, Math.round(Number(args.lexicalDensity) || overallScore)));
  const pacingScore = Math.max(0, Math.min(100, Math.round(Number(args.pacingScore) || overallScore)));
  const deliveryConfidence = Math.max(0, Math.min(100, Math.round(Number(args.deliveryConfidence) || overallScore)));
  const spokenFeedback = args.spokenFeedback || 'Скрининг завершен.';
  const redFlags = Array.isArray(args.redFlags) ? args.redFlags.map(String) : [];
  const strengths = Array.isArray(args.strengths) ? args.strengths.map(String) : [];

  console.log(`📋 [HR_SIMULATION_SUMMARY] Full screening evaluated: ${overallScore}/100 (Passed: ${passed})`);

  const sessionDurationSec = session.sessionStartedAt
    ? Math.max(1, Math.round((Date.now() - session.sessionStartedAt) / 1000))
    : 0;
  const totalSpeechMs = Array.isArray(session.turnTelemetryHistory)
    ? session.turnTelemetryHistory.reduce((acc: number, t: any) => acc + (t.speechDurationMs || 0), 0)
    : 0;
  const measuredDurationSec = totalSpeechMs > 0 ? Math.round(totalSpeechMs / 1000) : sessionDurationSec;
  const averageWpm = typeof args.averageWpm === 'number' && Number.isFinite(args.averageWpm)
    ? Math.max(0, Math.round(args.averageWpm))
    : Math.max(80, Math.min(180, Math.round(115 + (pacingScore - 70) * 0.4)));
  const fillerWordsSpotted = Array.isArray(args.fillerWordsSpotted) ? args.fillerWordsSpotted.map(String) : [];

  const scorecard: HrScorecard = {
    sessionId: session.sessionId || 'hr_sim_session',
    turnId: `sim_turn_${Date.now()}`,
    questionId: 'full_screening_evaluation',
    mode: 'full_screening_simulation',
    overallScore,
    passed,
    metrics: {
      substanceMatch,
      lexicalDensity,
      pacingScore,
      deliveryConfidence
    },
    turnDurationSec: measuredDurationSec,
    averageWpm,
    fillerWordsSpotted,
    anchorsHit: strengths,
    anchorsMissed: redFlags,
    actionableCritique: spokenFeedback,
    nextAction: 'session_completed'
  };

  return {
    result: {
      status: 'SUCCESS',
      message: 'Сводный отчет по скринингу сформирован.',
      directive: 'Поблагодари кандидата за созвон, озвучь итоговое впечатление в 1-2 предложениях и попрощайся.'
    },
    clientEvent: {
      type: HR_VOICE_EVENTS.HR_SCORECARD_READY,
      payload: scorecard
    },
    scheduling: 'SILENT'
  };
}
