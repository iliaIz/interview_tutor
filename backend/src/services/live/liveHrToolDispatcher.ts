/**
 * liveHrToolDispatcher.ts
 * Чистые обработчики вызовов инструментов для HR Screening и Micro-Drill.
 * Не содержат прямых зависимостей от WebSocket (ws).
 */

import { HR_VOICE_EVENTS, HrScorecard, HrStepControlAction } from '@interview-prep/shared';
import { ToolExecutionContext, ToolExecutionResult } from './LiveToolEngine';
import { getHrQuestion } from './hrContextResolver';
import {
  resolveGuidedSessionBeats,
  createInitialGuidedState,
  applyGuidedStepAction,
  buildStepStatePayload
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

function buildGuidedToolDirective(payload: ReturnType<typeof buildStepStatePayload>): string {
  const facts = payload.immutableFacts.join(', ');
  if (payload.rung === 1) {
    return `Ступень 1 (Эхо-повтор), блок «${payload.beatTitle}». Произнеси естественной речью (не дословно как робот!) короткую фразу 8–15 слов по смыслу варианта: «${payload.activeVariantText}», обязательно сохранив точные факты (${facts}). Попроси кандидата повторить.`;
  }
  if (payload.rung === 2) {
    return `Ступень 2 (Свой перефраз), блок «${payload.beatTitle}». Скажи иначе или попроси кандидата переформулировать эту мысль СВОИМИ словами (другими связками!), строго сохранив факты: ${facts}. Ориентир нового варианта: «${payload.activeVariantText}».`;
  }
  if (payload.rung === 3) {
    return `Ступень 3 (Без подсказки — шпаргалка скрыта!). Задай кандидату реалистичный вопрос рекрутера: «${payload.hrTriggerPrompt}» — НЕ подсказывай ответ заранее, дай вспомнить и произнести по памяти.`;
  }
  return `Ступень 4 (Сборка — Снежный ком!). Предложи кандидату плавно соединить предыдущие освоенные блоки и блок «${payload.beatTitle}» в один связный ответ на 20–30 секунд с сохранением всех фактов (${facts}).`;
}

export function handleAdvanceHrLearningStep(
  args: Record<string, any>,
  ctx: ToolExecutionContext
): ToolExecutionResult {
  const { session } = ctx;
  const question = getHrQuestion(session.questionId);
  const beats = resolveGuidedSessionBeats(question, {
    startBeatId: session.startBeatId,
    beatScope: session.beatScope
  });

  if (beats.length === 0) {
    return {
      result: { status: 'ERROR', message: 'Микро-блоки для вопроса не найдены.' },
      scheduling: 'WHEN_IDLE'
    };
  }

  if (!session.hrGuidedState) {
    session.hrGuidedState = createInitialGuidedState(question, {
      startBeatId: session.startBeatId,
      beatScope: session.beatScope
    });
  }

  const rawAction = String(args.action || 'next_rung') as HrStepControlAction;
  const action: HrStepControlAction = VALID_STEP_ACTIONS.has(rawAction) ? rawAction : 'next_rung';

  const nextState = applyGuidedStepAction(session.hrGuidedState!, beats, action, {
    beatIndex: typeof args.beatIndex === 'number' ? args.beatIndex : undefined,
    masteredCurrentBeat: typeof args.masteredCurrentBeat === 'boolean' ? args.masteredCurrentBeat : undefined
  });
  session.hrGuidedState = nextState;

  const payload = buildStepStatePayload(nextState, beats, 'ai_tool', args.reason ? String(args.reason) : undefined);

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
      directive: buildGuidedToolDirective(payload)
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
    turnDurationSec: 75,
    averageWpm: 125,
    fillerWordsSpotted: [],
    anchorsHit: [],
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
    turnDurationSec: 900,
    averageWpm: 122,
    fillerWordsSpotted: [],
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
