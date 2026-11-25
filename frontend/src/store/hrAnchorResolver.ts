/**
 * hrAnchorResolver.ts
 * Pure anchor-card filtering and UI label resolution for HR Screening & Guided Micro-Chunking (Spec 48 <= 90 lines).
 */

import {
  HrAnchorCard,
  HrBeatScope,
  HrQuestionRubricItem,
  HrSessionMode
} from '@interview-prep/shared';

export interface AnchorScopeOptions {
  mode?: HrSessionMode;
  chunkId?: string | null;
  startBeatId?: string | null;
  beatScope?: HrBeatScope;
}

export function resolveQuestionAnchorCards(
  question: HrQuestionRubricItem | null | undefined,
  opts: AnchorScopeOptions = {}
): HrAnchorCard[] {
  if (!question) return [];
  let targetAnchors = question.requiredAnchors || [];

  if (opts.mode === 'guided_zero_start') {
    if (opts.beatScope === 'single_beat' && opts.startBeatId && question.microBeats) {
      const beat = question.microBeats.find((b) => b.id === opts.startBeatId);
      if (beat) {
        targetAnchors = targetAnchors.filter((a) => beat.anchorIds.includes(a.id));
      }
    }
  } else if (opts.chunkId && question.chunks) {
    const chunk = question.chunks.find((c) => c.id === opts.chunkId);
    if (chunk) {
      targetAnchors = targetAnchors.filter((a) => chunk.anchorIds.includes(a.id));
    }
  }

  return targetAnchors.map((card) => ({
    ...card,
    status: 'PENDING' as const,
    hitTimestampMs: undefined,
    detectionLatencyMs: undefined
  }));
}

export function resolveDisplayAnchors(
  question: HrQuestionRubricItem | null | undefined,
  storeAnchorCards: HrAnchorCard[],
  mode: HrSessionMode,
  selectedStartBeatId: string | null,
  guidedBeatScope: HrBeatScope
): HrAnchorCard[] {
  if (mode !== 'guided_zero_start' || !question) {
    return storeAnchorCards || [];
  }
  const beats = question.microBeats || [];
  const activeBeat = beats.find((b) => b.id === selectedStartBeatId) || beats[0];
  if (guidedBeatScope === 'single_beat' && activeBeat) {
    return (question.requiredAnchors || []).filter((a) => activeBeat.anchorIds.includes(a.id));
  }
  return question.requiredAnchors || [];
}

export function formatHrStartCtaLabel(
  question: HrQuestionRubricItem | null | undefined,
  mode: HrSessionMode,
  selectedStartBeatId: string | null,
  guidedBeatScope: HrBeatScope
): string {
  const minSec = question?.targetDurationSec.minSec || 60;
  const maxSec = question?.targetDurationSec.maxSec || 80;
  if (mode !== 'guided_zero_start') {
    return mode === 'tutor_rehearsal'
      ? `Начать репетицию (${minSec}–${maxSec}с)`
      : `Начать созвон (${minSec}–${maxSec}с)`;
  }
  const beats = question?.microBeats || [];
  const idx = selectedStartBeatId
    ? Math.max(0, beats.findIndex((b) => b.id === selectedStartBeatId))
    : 0;
  if (guidedBeatScope === 'single_beat' && beats[idx]) {
    return `Отработать только Блок ${idx + 1}: «${beats[idx].title}»`;
  }
  return `Начать с Блока ${idx + 1} из ${beats.length || 1} (весь маршрут)`;
}
