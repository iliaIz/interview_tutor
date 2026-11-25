/**
 * useLiveVoiceSession.ts
 * Authoritative Unified React hook for NativeLiveVoiceEngine (SOTA Late 2026).
 * Single responsibility: reactive bridge between Headless LiveVoiceEngine and React components.
 * Bounded cognitive size: <= 350 lines (SPEC-002, Ticket #7).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeLiveVoiceEngine } from './NativeLiveVoiceEngine';
import { useAppStore } from '../store/useAppStore';
import { useHrSimulatorStore } from '../store/useHrSimulatorStore';
import { resolveLiveSessionConfig } from './voiceConfigResolver';
import {
  VoiceEngineState,
  VoiceEngineConfig,
  DialogueTurnItem,
  VoiceEvaluationResult
} from './types';
import { HrScorecard } from '@interview-prep/shared';

export type { DialogueTurnItem };

export interface DialogueTurn {
  id?: string;
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface LiveAudioMetrics {
  rmsDb: number;
  vadActive: boolean;
  rttMs: number | null;
  audioChunksCount: number;
}

export interface LiveAudioSessionParams {
  sessionId?: string;
  questionId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'incident' | 'hr_simulation' | 'hr_micro_drill' | string;
  tutorMode?: string;
  voice?: string;
  userGender?: string;
  turnMode?: 'auto' | 'manual';
  liveModel?: string;
  vadPauseMs?: number;
  persona?: string;
  tutorPersona?: string;
  targetGrade?: string;
  strategy?: string;
  strictness?: string;
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  debugStep?: number;
  temperature?: number;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  fixedCode?: string;
  unitTest?: string;
  scenarioId?: string;
  incidentContext?: any;
  customPrompt?: string;
  challengeCategory?: string;
  challengeTrack?: string;
  challengeDomain?: string;
  activeCodeArtifact?: { id?: string; title?: string; language?: string; code?: string };
  codeRevisionsSummary?: Array<{ id: string; title: string }>;
  hints?: string[];
  initialUserMessage?: string;
  isResumed?: boolean;
  enableSilenceClarification?: boolean;
  workspaceManifest?: any;
  academyCourse?: string;
  academyStep?: string;
  academyBridgeContext?: {
    courseId?: string;
    stepId?: string;
    moduleTitle?: string;
    learningObjective?: string;
    targetConcepts?: string[];
  };
  seniorReview?: any;
  hrMode?: 'full_screening_simulation' | 'rapid_fire_micro_drill' | 'tutor_rehearsal' | 'guided_zero_start';
  dossierId?: string;
  jobId?: string;
  hrPersonaId?: string;
  questionMatrixId?: string;
  chunkId?: string;
  startBeatId?: string;
  beatScope?: 'all_from_beat' | 'single_beat';
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
}

export interface UseLiveVoiceSessionOptions {
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: VoiceEvaluationResult) => void;
  onBugSolved?: (payload: any) => void;
  onChaosInjected?: (payload: any) => void;
  onCandidateObservationRecorded?: (observation: any) => void;
  onHiringCommitteeVerdict?: (verdict: any) => void;
  onWhiteboardUpdate?: (payload: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
  getActiveCode?: () => string | undefined;
  getActiveLanguage?: () => string | undefined;
  getActiveFileName?: () => string | undefined;
  enableGlobalSelection?: boolean;
}

export interface UseLiveVoiceSessionReturn {
  // 1. Single discrete source of truth
  state: VoiceEngineState;
  // 2. Audio & network telemetry
  metrics: LiveAudioMetrics;
  // 3. Status prompt for UI rendering
  statusMessage: string;
  // 4. Dialogue turns history
  dialogueTurns: DialogueTurnItem[];
  // 5. Active evaluation scorecard (if emitted)
  activeScorecard: HrScorecard | VoiceEvaluationResult | null;
  // 6. Primary session lifecycle controls
  connect: (params: LiveAudioSessionParams) => Promise<void>;
  disconnect: () => void;
  // 7. Physical mic capture toggle (replaces toggleMute/toggleMic duplicates)
  toggleMic: () => void;
  // 8. Tactile interaction (barge-in if AI speaking; turn commit if candidate speaking)
  handleInteraction: () => void;
  // 9. Delegation seams for text & custom frames
  sendTextMessage: (text: string, displayText?: string) => void;
  sendCustomFrame: (frame: any) => void;
  engineRef?: React.MutableRefObject<NativeLiveVoiceEngine | null>;

  // Direct boolean & metric projections (eliminates shallow wrapper layer)
  isConnected: boolean;
  isAiSpeaking: boolean;
  isListening: boolean;
  isRecording: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  isError: boolean;
  lastError: string | null;
  rmsDb: number;
  aiTranscript: string;
  startSession: (params: LiveAudioSessionParams) => Promise<void>;
  disconnectSession: () => void;
  finishManualTurn: () => void;
  handleBargeIn: () => void;
  handleCentralButtonClick: () => void;
  sendCanvasDelta: (delta: any) => void;
}

export function useLiveVoiceSession(options: UseLiveVoiceSessionOptions = {}): UseLiveVoiceSessionReturn {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<VoiceEngineState>('IDLE');
  const [metrics, setMetrics] = useState<LiveAudioMetrics>({
    rmsDb: -100,
    vadActive: false,
    rttMs: null,
    audioChunksCount: 0
  });
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurnItem[]>([]);
  const [activeScorecard, setActiveScorecard] = useState<HrScorecard | VoiceEvaluationResult | null>(null);

  const engineRef = useRef<NativeLiveVoiceEngine | null>(null);
  const isMutedRef = useRef<boolean>(false);

  if (!engineRef.current) {
    engineRef.current = new NativeLiveVoiceEngine({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'IDLE' || newState === 'COMPLETED') {
          optionsRef.current.onDisconnect?.();
        }
      },
      onAudioLevel: (db) => {
        setMetrics((prev) => ({
          ...prev,
          rmsDb: db,
          vadActive: db > -45,
          audioChunksCount: prev.audioChunksCount + 1
        }));
      },
      onStatusMessage: (msg) => setStatusMessage(msg),
      onDialogueTurnsUpdate: (turns) => setDialogueTurns(turns),
      onEvaluationReceived: (res) => {
        setActiveScorecard(res);
        optionsRef.current.onEvaluationCompleted?.(res);
      },
      onWhiteboardUpdate: (payload) => {
        try {
          useAppStore.getState().setWhiteboardState(payload);
        } catch (e) {
          console.warn('[useLiveVoiceSession] Whiteboard store update failed:', e);
        }
        optionsRef.current.onWhiteboardUpdate?.(payload);
      },
      onChaosInjected: (payload) => optionsRef.current.onChaosInjected?.(payload),
      onHiringCommitteeVerdict: (payload) => optionsRef.current.onHiringCommitteeVerdict?.(payload),
      onBugSolved: (payload) => optionsRef.current.onBugSolved?.(payload),
      onCandidateObservationRecorded: (payload) => optionsRef.current.onCandidateObservationRecorded?.(payload),
      onHrPhaseTransition: (payload) => {
        try {
          useHrSimulatorStore.getState().setPhase(payload.toPhase);
        } catch (e) {
          console.warn('[useLiveVoiceSession] HR phase transition update failed:', e);
        }
      },
      onHrScorecardReady: (scorecard) => {
        setActiveScorecard(scorecard);
        try {
          useHrSimulatorStore.getState().setScorecard(scorecard);
        } catch (e) {
          console.warn('[useLiveVoiceSession] HR scorecard update failed:', e);
        }
      },
      onHrTranscriptDelta: (delta) => {
        try {
          useHrSimulatorStore.getState().appendTranscriptDelta(delta);
        } catch (e) {
          console.warn('[useLiveVoiceSession] HR transcript delta update failed:', e);
        }
      },
      onHrStepState: (stepState) => {
        try {
          useHrSimulatorStore.getState().setGuidedStepState(stepState);
        } catch (e) {
          console.warn('[useLiveVoiceSession] HR step state update failed:', e);
        }
      },
      onError: (err) => {
        setLastError(err);
        optionsRef.current.onError?.(err);
      }
    });
  }

  const connect = useCallback(async (params: LiveAudioSessionParams) => {
    setActiveScorecard(null);
    setLastError(null);
    setDialogueTurns([]);
    setMetrics({ rmsDb: -100, vadActive: false, rttMs: null, audioChunksCount: 0 });

    const config: VoiceEngineConfig = resolveLiveSessionConfig(params, {
      activeCode: optionsRef.current.getActiveCode?.(),
    });

    await engineRef.current?.connect(config);
    optionsRef.current.onSetupComplete?.();
  }, []);

  const disconnect = useCallback(() => {
    engineRef.current?.disconnect();
  }, []);

  const toggleMic = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    engineRef.current?.setMuted(isMutedRef.current);
  }, []);

  const handleInteraction = useCallback(() => {
    engineRef.current?.handleCentralButtonClick();
  }, []);

  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    engineRef.current?.sendTextMessage(text, displayText);
  }, []);

  const sendCustomFrame = useCallback((frame: any) => {
    engineRef.current?.sendCustomFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.disconnect();
    };
  }, []);

  const isConnected = state !== 'IDLE' && state !== 'ERROR' && state !== 'COMPLETED';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isListening = state === 'LISTENING';
  const isRecording = isListening;
  const isUserSpeaking = metrics.vadActive;
  const isPauseHolding = state === 'AI_THINKING' || state === 'COMMITTING';
  const isError = state === 'ERROR';
  const rmsDb = metrics.rmsDb;

  const sendCanvasDelta = useCallback((delta: any) => {
    engineRef.current?.sendCustomFrame({ type: 'canvas_delta', payload: delta });
  }, []);

  return {
    state,
    metrics,
    statusMessage,
    lastError,
    isError,
    dialogueTurns,
    activeScorecard,
    connect,
    disconnect,
    toggleMic,
    handleInteraction,
    sendTextMessage,
    sendCustomFrame,
    engineRef,

    // Direct projections
    isConnected,
    isAiSpeaking,
    isListening,
    isRecording,
    isMuted: isMutedRef.current,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    aiTranscript: '',
    startSession: connect,
    disconnectSession: disconnect,
    finishManualTurn: handleInteraction,
    handleBargeIn: handleInteraction,
    handleCentralButtonClick: handleInteraction,
    sendCanvasDelta
  };
}
