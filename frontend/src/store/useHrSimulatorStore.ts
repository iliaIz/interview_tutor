/**
 * useHrSimulatorStore.ts
 * Dedicated Zustand Store for Generic HR Voice Simulator Engine.
 * Implements Monotonic State Latch and Speech Telemetry Tracking.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import { create } from 'zustand';
import {
  HrSessionMode,
  HrPersonaId,
  HrSimulationPhase,
  HrAnchorCard,
  HrQuestionRubricItem,
  HrTelemetryTick,
  HrScorecard
} from '@interview-prep/shared';

export interface HrSimulatorState {
  // Session Configuration
  mode: HrSessionMode;
  personaId: HrPersonaId;
  currentPhase: HrSimulationPhase;
  activeQuestion: HrQuestionRubricItem | null;
  anchorCards: HrAnchorCard[];
  drillAttemptsCount: number;

  // Real-Time Speech Telemetry
  elapsedTurnSec: number;
  rollingWpm: number;
  pacingStatus: 'too_slow' | 'optimal' | 'too_fast';
  pacingWindowStatus: 'building' | 'optimal' | 'overflow';
  hesitationCount: number;
  fillerWordsSpotted: string[];
  liveCandidateTranscript: string;

  // Evaluation & Scorecards
  latestScorecard: HrScorecard | null;
  isScorecardOpen: boolean;

  // Actions
  initializeSession: (mode: HrSessionMode, personaId: HrPersonaId, question: HrQuestionRubricItem) => void;
  setPhase: (phase: HrSimulationPhase) => void;
  registerFastKwsHit: (anchorId: string, latencyMs: number) => void;
  reconcileServerHit: (anchorId: string) => void;
  updateTelemetryTick: (tick: HrTelemetryTick) => void;
  appendTranscriptDelta: (delta: string) => void;
  setScorecard: (scorecard: HrScorecard) => void;
  closeScorecard: () => void;
  resetForRetry: () => void;
}

const FILLER_REGEX = /\b(ну|как бы|в общем|в общем-то|типа|наверное|э-э-э|м-м-м|так сказать|собственно говоря)\b/gi;

export const useHrSimulatorStore = create<HrSimulatorState>((set, get) => ({
  mode: 'rapid_fire_micro_drill',
  personaId: 'friendly_sourcer',
  currentPhase: 'phase2_elevator_pitch',
  activeQuestion: null,
  anchorCards: [],
  drillAttemptsCount: 1,

  elapsedTurnSec: 0,
  rollingWpm: 0,
  pacingStatus: 'optimal',
  pacingWindowStatus: 'building',
  hesitationCount: 0,
  fillerWordsSpotted: [],
  liveCandidateTranscript: '',

  latestScorecard: null,
  isScorecardOpen: false,

  initializeSession: (mode, personaId, question) => {
    const cards = (question.requiredAnchors || []).map((card) => ({
      ...card,
      status: 'PENDING' as const,
      hitTimestampMs: undefined,
      detectionLatencyMs: undefined
    }));

    set({
      mode,
      personaId,
      currentPhase: mode === 'rapid_fire_micro_drill' ? 'phase2_elevator_pitch' : 'phase1_small_talk',
      activeQuestion: question,
      anchorCards: cards,
      drillAttemptsCount: 1,
      elapsedTurnSec: 0,
      rollingWpm: 0,
      pacingStatus: 'optimal',
      pacingWindowStatus: 'building',
      hesitationCount: 0,
      fillerWordsSpotted: [],
      liveCandidateTranscript: '',
      latestScorecard: null,
      isScorecardOpen: false
    });
  },

  setPhase: (phase) => {
    set({ currentPhase: phase, elapsedTurnSec: 0 });
  },

  // Monotonic State Latch: PENDING -> OPTIMISTIC_HIT
  registerFastKwsHit: (anchorId, latencyMs) => {
    set((state) => ({
      anchorCards: state.anchorCards.map((card) => {
        if (card.id === anchorId && card.status === 'PENDING') {
          return {
            ...card,
            status: 'OPTIMISTIC_HIT' as const,
            hitTimestampMs: Date.now(),
            detectionLatencyMs: latencyMs,
            source: 'client_fast_kws' as const
          };
        }
        return card;
      })
    }));
  },

  // Monotonic State Latch: OPTIMISTIC_HIT / PENDING -> CONFIRMED_HIT
  reconcileServerHit: (anchorId) => {
    set((state) => ({
      anchorCards: state.anchorCards.map((card) => {
        if (card.id === anchorId && card.status !== 'CONFIRMED_HIT') {
          return {
            ...card,
            status: 'CONFIRMED_HIT' as const,
            source: 'server_reconciled' as const
          };
        }
        return card;
      })
    }));
  },

  updateTelemetryTick: (tick) => {
    set({
      elapsedTurnSec: tick.elapsedTurnSec,
      rollingWpm: tick.rollingWpm,
      pacingStatus: tick.pacingStatus,
      pacingWindowStatus: tick.pacingWindowStatus,
      hesitationCount: tick.hesitationCount,
      fillerWordsSpotted: tick.fillerWordsSpotted
    });
  },

  appendTranscriptDelta: (delta) => {
    const prev = get().liveCandidateTranscript;
    const updated = (prev + ' ' + delta).trim();

    // Check fillers
    const matches = updated.match(FILLER_REGEX) || [];
    const uniqueFillers = Array.from(new Set(matches.map((m) => m.toLowerCase())));

    // Compute simple rolling WPM
    const wordsCount = updated.split(/\s+/).filter(Boolean).length;
    const elapsedSec = Math.max(1, get().elapsedTurnSec);
    const calculatedWpm = Math.round((wordsCount / elapsedSec) * 60);

    set({
      liveCandidateTranscript: updated,
      fillerWordsSpotted: uniqueFillers,
      rollingWpm: calculatedWpm
    });
  },

  setScorecard: (scorecard) => {
    set({
      latestScorecard: scorecard,
      isScorecardOpen: true
    });
  },

  closeScorecard: () => {
    set({ isScorecardOpen: false });
  },

  resetForRetry: () => {
    const activeQ = get().activeQuestion;
    const cards = (activeQ?.requiredAnchors || []).map((card) => ({
      ...card,
      status: 'PENDING' as const,
      hitTimestampMs: undefined,
      detectionLatencyMs: undefined
    }));

    set((state) => ({
      anchorCards: cards,
      drillAttemptsCount: state.drillAttemptsCount + 1,
      elapsedTurnSec: 0,
      rollingWpm: 0,
      pacingStatus: 'optimal',
      pacingWindowStatus: 'building',
      hesitationCount: 0,
      fillerWordsSpotted: [],
      liveCandidateTranscript: '',
      latestScorecard: null,
      isScorecardOpen: false
    }));
  }
}));
