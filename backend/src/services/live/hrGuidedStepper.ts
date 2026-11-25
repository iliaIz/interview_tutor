/**
 * hrGuidedStepper.ts
 * Pure deterministic Finite State Machine & SSOT Directive Builder for Spec 40/41 Guided Micro-Chunking ("С нуля").
 * Zero WebSocket / transport coupling (Spec 48 <= 230 lines).
 */

import {
  HrBeatScope,
  HrLearningRung,
  HrMicroBeat,
  HrQuestionRubricItem,
  HrStepControlAction,
  HrStepStatePayload
} from '@interview-prep/shared';
import { getHrQuestion } from './hrContextResolver';

export interface HrGuidedSessionState {
  questionId: string;
  chunkId?: string;
  startBeatId?: string;
  beatScope: HrBeatScope;
  beatIndex: number;
  rung: HrLearningRung;
  variantIndex: number;
  cueVisible: boolean;
  masteredBeatIds: string[];
}

export interface GuidedStepActionOptions {
  beatIndex?: number;
  cueVisible?: boolean;
  masteredCurrentBeat?: boolean;
}

export function resolveQuestionMicroBeats(
  question?: HrQuestionRubricItem,
  chunkId?: string
): HrMicroBeat[] {
  if (!question) return [];
  const rawBeats = Array.isArray(question.microBeats) ? question.microBeats : [];
  if (rawBeats.length > 0) {
    if (!chunkId) return rawBeats;
    const chunkBeats = rawBeats.filter((b) => b.chunkId === chunkId);
    return chunkBeats.length > 0 ? chunkBeats : rawBeats;
  }

  const chunk = chunkId ? question.chunks?.find((c) => c.id === chunkId) : undefined;
  const fallbackAnchors = (chunk ? chunk.anchorIds : question.requiredAnchors.map((a) => a.id)) || [];
  const anchorLabels = question.requiredAnchors
    .filter((a) => fallbackAnchors.length === 0 || fallbackAnchors.includes(a.id))
    .slice(0, 3)
    .map((a) => a.label);
  const summary = question.referenceAnswer.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const firstSentence = summary[0] || question.canonicalQuestion;
  const secondSentence = summary[1] || firstSentence;

  return [{
    id: `${question.id}_fallback_beat_1`,
    chunkId: chunk?.id || 'default',
    title: chunk?.title || question.title,
    anchorIds: fallbackAnchors,
    immutableFacts: anchorLabels.length > 0 ? anchorLabels : [question.title],
    spokenVariants: [firstSentence, secondSentence],
    hrTriggerPrompt: question.canonicalQuestion,
    cueHints: anchorLabels.length > 0 ? anchorLabels : [question.title]
  }];
}

export function resolveGuidedSessionBeats(
  question?: HrQuestionRubricItem,
  opts?: { startBeatId?: string; beatScope?: HrBeatScope }
): HrMicroBeat[] {
  const allBeats = resolveQuestionMicroBeats(question);
  if (opts?.beatScope === 'single_beat' && opts?.startBeatId) {
    const matched = allBeats.find((b) => b.id === opts.startBeatId);
    if (matched) return [matched];
  }
  return allBeats;
}

export function createInitialGuidedState(
  question?: HrQuestionRubricItem,
  optsOrChunkId?: string | { chunkId?: string; startBeatId?: string; beatScope?: HrBeatScope }
): HrGuidedSessionState | null {
  if (!question) return null;
  const opts = typeof optsOrChunkId === 'string' ? { chunkId: optsOrChunkId } : optsOrChunkId || {};
  const isGuidedOpts = Boolean(opts.startBeatId || opts.beatScope || typeof optsOrChunkId === 'object');
  const beats = isGuidedOpts
    ? resolveGuidedSessionBeats(question, { startBeatId: opts.startBeatId, beatScope: opts.beatScope })
    : resolveQuestionMicroBeats(question, opts.chunkId);
  if (beats.length === 0) return null;

  const matchedIdx = opts.startBeatId ? beats.findIndex((b) => b.id === opts.startBeatId) : -1;
  const initialIndex = matchedIdx >= 0 ? matchedIdx : 0;
  const beatScope: HrBeatScope =
    opts.beatScope === 'single_beat' && beats.length === 1 ? 'single_beat' : 'all_from_beat';

  return {
    questionId: question.id,
    chunkId: opts.chunkId,
    startBeatId: opts.startBeatId,
    beatScope,
    beatIndex: initialIndex,
    rung: 1,
    variantIndex: 0,
    cueVisible: true,
    masteredBeatIds: []
  };
}

export function ensureSessionGuidedState(
  session: {
    questionId?: string;
    startBeatId?: string;
    beatScope?: HrBeatScope;
    hrGuidedState?: HrGuidedSessionState | null;
  },
  explicitQuestion?: HrQuestionRubricItem
): { state: HrGuidedSessionState; beats: HrMicroBeat[]; question: HrQuestionRubricItem } | null {
  const question = explicitQuestion || getHrQuestion(session.questionId);
  const beats = resolveGuidedSessionBeats(question, {
    startBeatId: session.startBeatId,
    beatScope: session.beatScope
  });
  if (beats.length === 0) return null;

  if (!session.hrGuidedState) {
    session.hrGuidedState = createInitialGuidedState(question, {
      startBeatId: session.startBeatId,
      beatScope: session.beatScope
    });
  }
  if (!session.hrGuidedState) return null;
  return { state: session.hrGuidedState, beats, question };
}

function withMasteredBeat(mastered: string[], beatId: string): string[] {
  return mastered.includes(beatId) ? mastered : [...mastered, beatId];
}

export function applyGuidedStepAction(
  state: HrGuidedSessionState,
  beats: HrMicroBeat[],
  action: HrStepControlAction,
  opts: GuidedStepActionOptions = {}
): HrGuidedSessionState {
  if (beats.length === 0) return state;
  const safeIdx = Math.max(0, Math.min(beats.length - 1, state.beatIndex));
  const currentBeat = beats[safeIdx];
  const variantCount = Math.max(1, currentBeat.spokenVariants.length);

  switch (action) {
    case 'toggle_cue':
      return { ...state, cueVisible: typeof opts.cueVisible === 'boolean' ? opts.cueVisible : !state.cueVisible };
    case 'next_variant':
      return { ...state, variantIndex: (state.variantIndex + 1) % variantCount };
    case 'repeat_beat':
      return { ...state, rung: 1, cueVisible: true, variantIndex: (state.variantIndex + 1) % variantCount };
    case 'prev_beat':
      return { ...state, beatIndex: Math.max(0, safeIdx - 1), rung: 1, variantIndex: 0, cueVisible: true };
    case 'select_beat': {
      const requested = typeof opts.beatIndex === 'number' ? opts.beatIndex : safeIdx;
      return { ...state, beatIndex: Math.max(0, Math.min(beats.length - 1, requested)), rung: 1, variantIndex: 0, cueVisible: true };
    }
    case 'next_beat': {
      const mastered = opts.masteredCurrentBeat !== false ? withMasteredBeat(state.masteredBeatIds, currentBeat.id) : state.masteredBeatIds;
      return { ...state, beatIndex: (safeIdx + 1) % beats.length, rung: 1, variantIndex: 0, cueVisible: true, masteredBeatIds: mastered };
    }
    case 'next_rung': {
      if (state.rung === 1) return { ...state, rung: 2, variantIndex: (state.variantIndex + 1) % variantCount };
      if (state.rung === 2) return { ...state, rung: 3, cueVisible: false };
      if (state.rung === 3 && beats.length >= 2 && state.masteredBeatIds.length >= 1) return { ...state, rung: 4, cueVisible: false };
      const mastered = opts.masteredCurrentBeat !== false ? withMasteredBeat(state.masteredBeatIds, currentBeat.id) : state.masteredBeatIds;
      return { ...state, beatIndex: (safeIdx + 1) % beats.length, rung: 1, variantIndex: 0, cueVisible: true, masteredBeatIds: mastered };
    }
  }
}

export function buildStepStatePayload(
  state: HrGuidedSessionState,
  beats: HrMicroBeat[],
  source: 'session_init' | 'ai_tool' | 'client_button',
  reason?: string
): HrStepStatePayload {
  const safeIdx = Math.max(0, Math.min(Math.max(0, beats.length - 1), state.beatIndex));
  const beat = beats[safeIdx];
  const variantCount = Math.max(1, beat.spokenVariants.length);
  const safeVarIdx = ((state.variantIndex % variantCount) + variantCount) % variantCount;

  return {
    questionId: state.questionId,
    beatId: beat.id,
    beatIndex: safeIdx,
    totalBeats: beats.length,
    beatScope: beats.length === 1 ? 'single_beat' : state.beatScope,
    beats: beats.map((b) => ({ id: b.id, title: b.title })),
    beatTitle: beat.title,
    chunkId: beat.chunkId,
    rung: state.rung,
    variantIndex: safeVarIdx,
    variantCount,
    activeVariantText: beat.spokenVariants[safeVarIdx] || beat.spokenVariants[0] || '',
    immutableFacts: beat.immutableFacts,
    cueHints: beat.cueHints,
    hrTriggerPrompt: beat.hrTriggerPrompt,
    cueVisible: state.cueVisible,
    masteredBeatIds: state.masteredBeatIds,
    source,
    reason
  };
}

/**
 * Unified SSOT phrasing directive generator for Turn 0 greetings, voice tools, and UI step buttons (Spec 48).
 */
export function formatRungPromptDirective(
  payload: HrStepStatePayload,
  source: 'turn0_greeting' | 'ai_tool' | 'client_button',
  action?: HrStepControlAction
): string {
  const facts = payload.immutableFacts.join(', ');
  if (source === 'turn0_greeting') {
    const scopeHint = payload.beatScope === 'single_beat'
      ? 'Изолированная тренировка одного блока (разными формулировками).'
      : `Стартовый блок ${payload.beatIndex + 1} из ${payload.totalBeats}.`;
    return `Привет! Мы учим ответ «с полного нуля». ${scopeHint} Коротко поприветствуй кандидата уверенным теплым голосом тренера Ольги, назови блок «${payload.beatTitle}», естественно произнеси первую формулировку своими связками на основе ориентира: «${payload.activeVariantText}» (сохранив точные факты: ${facts}) и попроси повторить вслух. (ВАЖНО: сейчас Turn 0 — НЕ вызывай никаких инструментов!).`;
  }
  if (action === 'next_variant') {
    return `[КАНДИДАТ НАЖАЛ «ДРУГОЙ ВАРИАНТ»]: Озвучь блок «${payload.beatTitle}» совершенно другими связками на основе: «${payload.activeVariantText}», строго сохранив факты (${facts}), и попроси кандидата повторить.`;
  }
  const prefix = source === 'client_button'
    ? `[КАНДИДАТ ПЕРЕКЛЮЧИЛ ШАГ НА БЛОК ${payload.beatIndex + 1}/${payload.totalBeats}: «${payload.beatTitle}»]: `
    : '';
  if (payload.rung === 1) {
    return `${prefix}Ступень 1 (Эхо-повтор), блок «${payload.beatTitle}». Произнеси естественной речью (не дословно как робот!) короткую фразу 8–15 слов по смыслу варианта: «${payload.activeVariantText}», обязательно сохранив точные факты (${facts}). Попроси кандидата повторить.`;
  }
  if (payload.rung === 2) {
    return `${prefix}Ступень 2 (Свой перефраз), блок «${payload.beatTitle}». Скажи иначе или попроси кандидата переформулировать эту мысль СВОИМИ словами (другими связками!), строго сохранив факты: ${facts}. Ориентир нового варианта: «${payload.activeVariantText}».`;
  }
  if (payload.rung === 3) {
    return `${prefix}Ступень 3 (Без подсказки — шпаргалка скрыта!). Задай кандидату реалистичный вопрос рекрутера: «${payload.hrTriggerPrompt}» — НЕ подсказывай ответ заранее, дай вспомнить и произнести по памяти.`;
  }
  return `${prefix}Ступень 4 (Сборка — Снежный ком!). Предложи кандидату плавно соединить предыдущие освоенные блоки и блок «${payload.beatTitle}» в один связный ответ на 20–30 секунд с сохранением всех фактов (${facts}).`;
}
