/**
 * useHrSimulatorStore.ts
 * Dedicated Zustand Store for Generic HR Voice Simulator Engine.
 * Implements Monotonic State Latch, Speech Telemetry Tracking,
 * and Pedagogical Question Catalog & Multi-Mode Studio State.
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
  HrScorecard,
  HrStepStatePayload,
  HrBeatScope
} from '@interview-prep/shared';
import {
  HrMasteredBeatsMap,
  loadMasteredBeatsMap,
  mergeMasteredBeatsForQuestion
} from './hrMasteryStorage';
import { resolveQuestionAnchorCards } from './hrAnchorResolver';

export interface HrSimulatorState {
  // Session Configuration & Pedagogical State
  mode: HrSessionMode;
  personaId: HrPersonaId;
  currentPhase: HrSimulationPhase;
  activeQuestion: HrQuestionRubricItem | null;
  anchorCards: HrAnchorCard[];
  drillAttemptsCount: number;

  // Multi-Mode Studio Tab & Catalog State
  activeTab: 'study' | 'voice';
  questionsList: HrQuestionRubricItem[];
  selectedQuestionId: string | null;
  selectedChunkId: string | null;
  isLoadingQuestions: boolean;

  // Real-Time Speech Telemetry
  elapsedTurnSec: number;
  rollingWpm: number;
  pacingStatus: 'too_slow' | 'optimal' | 'too_fast';
  pacingWindowStatus: 'building' | 'optimal' | 'overflow';
  hesitationCount: number;
  fillerWordsSpotted: string[];
  liveCandidateTranscript: string;

  // Spec 40 & 41 Guided Micro-Chunking, Beat Focus Scope & Mastery Persistence
  guidedStepState: HrStepStatePayload | null;
  selectedStartBeatId: string | null;
  guidedBeatScope: HrBeatScope;
  masteredBeatsByQuestion: HrMasteredBeatsMap;

  // Evaluation & Scorecards
  latestScorecard: HrScorecard | null;
  isScorecardOpen: boolean;

  // Actions
  initializeSession: (
    mode: HrSessionMode,
    personaId: HrPersonaId,
    question: HrQuestionRubricItem,
    guidedOpts?: { startBeatId?: string | null; beatScope?: HrBeatScope }
  ) => void;
  setGuidedStepState: (stepState: HrStepStatePayload) => void;
  setSelectedStartBeatId: (beatId: string | null) => void;
  setGuidedBeatScope: (scope: HrBeatScope) => void;
  setPhase: (phase: HrSimulationPhase) => void;
  registerFastKwsHit: (anchorId: string, latencyMs: number) => void;
  reconcileServerHit: (anchorId: string) => void;
  updateTelemetryTick: (tick: HrTelemetryTick) => void;
  appendTranscriptDelta: (delta: string) => void;
  setScorecard: (scorecard: HrScorecard) => void;
  closeScorecard: () => void;
  resetForRetry: () => void;

  // Pedagogical Suite Actions
  setActiveTab: (tab: 'study' | 'voice') => void;
  fetchQuestions: () => Promise<void>;
  selectQuestion: (questionId: string) => void;
  setSelectedChunkId: (chunkId: string | null) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
}

const FILLER_REGEX = /\b(ну|как бы|в общем|в общем-то|типа|наверное|э-э-э|м-м-м|так сказать|собственно говоря)\b/gi;

export const useHrSimulatorStore = create<HrSimulatorState>((set, get) => ({
  mode: 'rapid_fire_micro_drill',
  personaId: 'friendly_sourcer',
  currentPhase: 'phase2_elevator_pitch',
  activeQuestion: null,
  anchorCards: [],
  drillAttemptsCount: 1,

  activeTab: 'study',
  questionsList: [],
  selectedQuestionId: null,
  selectedChunkId: null,
  isLoadingQuestions: false,

  elapsedTurnSec: 0,
  rollingWpm: 0,
  pacingStatus: 'optimal',
  pacingWindowStatus: 'building',
  hesitationCount: 0,
  fillerWordsSpotted: [],
  liveCandidateTranscript: '',

  latestScorecard: null,
  isScorecardOpen: false,
  guidedStepState: null,
  selectedStartBeatId: null,
  guidedBeatScope: 'all_from_beat',
  masteredBeatsByQuestion: loadMasteredBeatsMap(),

  initializeSession: (mode, personaId, question, guidedOpts) => {
    const chunkId = mode === 'guided_zero_start' ? null : get().selectedChunkId;
    const effectiveScope = guidedOpts?.beatScope || get().guidedBeatScope;
    const effectiveBeatId = guidedOpts?.startBeatId !== undefined ? guidedOpts.startBeatId : get().selectedStartBeatId;
    const cards = resolveQuestionAnchorCards(question, {
      mode,
      chunkId,
      startBeatId: effectiveBeatId,
      beatScope: effectiveScope
    });

    set({
      mode,
      personaId,
      currentPhase: mode === 'full_screening_simulation' ? 'phase1_small_talk' : 'phase2_elevator_pitch',
      activeQuestion: question,
      selectedQuestionId: question.id,
      anchorCards: cards,
      drillAttemptsCount: 1,
      elapsedTurnSec: 0,
      rollingWpm: 0,
      pacingStatus: 'optimal',
      pacingWindowStatus: 'building',
      hesitationCount: 0,
      fillerWordsSpotted: [],
      guidedStepState: null,
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

  setGuidedStepState: (stepState) => {
    set((state) => ({
      guidedStepState: stepState,
      masteredBeatsByQuestion: mergeMasteredBeatsForQuestion(
        state.masteredBeatsByQuestion,
        stepState.questionId,
        stepState.masteredBeatIds || []
      )
    }));
  },

  setSelectedStartBeatId: (beatId) => set({ selectedStartBeatId: beatId }),
  setGuidedBeatScope: (scope) => set({ guidedBeatScope: scope }),

  setScorecard: (scorecard) => {
    const m = get().mode;
    if (m === 'tutor_rehearsal' || m === 'guided_zero_start') return;
    set({
      latestScorecard: scorecard,
      isScorecardOpen: true
    });
  },

  closeScorecard: () => {
    set({ isScorecardOpen: false });
  },

  resetForRetry: () => {
    const state = get();
    const cards = resolveQuestionAnchorCards(state.activeQuestion, {
      mode: state.mode,
      chunkId: state.selectedChunkId,
      startBeatId: state.selectedStartBeatId,
      beatScope: state.guidedBeatScope
    });

    set((prev) => ({
      anchorCards: cards,
      drillAttemptsCount: prev.drillAttemptsCount + 1,
      elapsedTurnSec: 0,
      rollingWpm: 0,
      pacingStatus: 'optimal',
      pacingWindowStatus: 'building',
      hesitationCount: 0,
      fillerWordsSpotted: [],
      liveCandidateTranscript: '',
      guidedStepState: null,
      latestScorecard: null,
      isScorecardOpen: false
    }));
  },

  setSelectedChunkId: (chunkId) => {
    const state = get();
    if (!state.activeQuestion) {
      set({ selectedChunkId: chunkId });
      return;
    }
    const cards = resolveQuestionAnchorCards(state.activeQuestion, { mode: state.mode, chunkId });
    set({
      selectedChunkId: chunkId,
      anchorCards: cards
    });
  },

  // Pedagogical Suite Actions
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  fetchQuestions: async () => {
    if (get().questionsList.length > 0) return;
    set({ isLoadingQuestions: true });
    try {
      const res = await fetch('/api/hr/questions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list: HrQuestionRubricItem[] = data.questions || [];
        set({
          questionsList: list,
          isLoadingQuestions: false,
          activeQuestion: get().activeQuestion || list[0] || null,
          selectedQuestionId: get().selectedQuestionId || list[0]?.id || null
        });
      } else {
        set({ isLoadingQuestions: false });
      }
    } catch (err) {
      console.warn('Failed to fetch HR questions list:', err);
      set({ isLoadingQuestions: false });
    }
  },

  selectQuestion: (questionId) => {
    const list = get().questionsList;
    const found = list.find((q) => q.id === questionId);
    if (found) {
      const cards = resolveQuestionAnchorCards(found);

      set({
        selectedQuestionId: found.id,
        selectedChunkId: null,
        selectedStartBeatId: null,
        activeQuestion: found,
        anchorCards: cards,
        drillAttemptsCount: 1,
        elapsedTurnSec: 0,
        rollingWpm: 0,
        pacingStatus: 'optimal',
        pacingWindowStatus: 'building',
        hesitationCount: 0,
        fillerWordsSpotted: [],
        liveCandidateTranscript: '',
        guidedStepState: null,
        latestScorecard: null,
        isScorecardOpen: false
      });
    }
  },

  nextQuestion: () => {
    const { questionsList, selectedQuestionId } = get();
    if (!questionsList.length || !selectedQuestionId) return;
    const currentIndex = questionsList.findIndex((q) => q.id === selectedQuestionId);
    if (currentIndex >= 0 && currentIndex < questionsList.length - 1) {
      get().selectQuestion(questionsList[currentIndex + 1].id);
    }
  },

  prevQuestion: () => {
    const { questionsList, selectedQuestionId } = get();
    if (!questionsList.length || !selectedQuestionId) return;
    const currentIndex = questionsList.findIndex((q) => q.id === selectedQuestionId);
    if (currentIndex > 0) {
      get().selectQuestion(questionsList[currentIndex - 1].id);
    }
  }
}));
