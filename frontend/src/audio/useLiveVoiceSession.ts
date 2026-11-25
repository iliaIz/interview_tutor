/**
 * useLiveVoiceSession.ts
 * Authoritative React hook bridging Headless NativeLiveVoiceEngine and UI components (Spec 47 <= 250 lines).
 * Enforces reactive isMuted state, 0Hz parent re-render isolation via subscribeAudioLevel,
 * and command dispatch through NativeLiveVoiceEngine.dispatch().
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

export type AudioLevelSubscriber = (listener: (db: number) => void) => () => void;

export interface UseLiveVoiceSessionReturn {
  state: VoiceEngineState;
  statusMessage: string;
  dialogueTurns: DialogueTurnItem[];
  activeScorecard: HrScorecard | VoiceEvaluationResult | null;
  vadActive: boolean;
  connect: (params: LiveAudioSessionParams) => Promise<void>;
  disconnect: () => void;
  toggleMic: () => void;
  handleInteraction: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  sendCustomFrame: (frame: any) => void;
  sendCanvasDelta: (delta: any) => void;
  subscribeAudioLevel: AudioLevelSubscriber;
  engineRef?: React.MutableRefObject<NativeLiveVoiceEngine | null>;
  isConnected: boolean;
  isAiSpeaking: boolean;
  isListening: boolean;
  isRecording: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  isError: boolean;
  lastError: string | null;
}

export function useLiveVoiceSession(options: UseLiveVoiceSessionOptions = {}): UseLiveVoiceSessionReturn {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const [state, setState] = useState<VoiceEngineState>('IDLE');
  const [vadActive, setVadActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurnItem[]>([]);
  const [activeScorecard, setActiveScorecard] = useState<HrScorecard | VoiceEvaluationResult | null>(null);

  const engineRef = useRef<NativeLiveVoiceEngine | null>(null);
  const isMutedRef = useRef(false);
  const vadActiveRef = useRef(false);
  const audioLevelListenersRef = useRef(new Set<(db: number) => void>());

  if (!engineRef.current) {
    engineRef.current = new NativeLiveVoiceEngine({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'IDLE' || newState === 'COMPLETED') {
          vadActiveRef.current = false;
          setVadActive(false);
          optionsRef.current.onDisconnect?.();
        }
      },
      onAudioLevel: (db) => {
        audioLevelListenersRef.current.forEach((cb) => cb(db));
        const nextVad = db > -45;
        if (nextVad !== vadActiveRef.current) {
          vadActiveRef.current = nextVad;
          setVadActive(nextVad);
        }
      },
      onStatusMessage: (msg) => setStatusMessage(msg),
      onDialogueTurnsUpdate: (turns) => setDialogueTurns(turns),
      onEvaluationReceived: (res) => {
        setActiveScorecard(res);
        optionsRef.current.onEvaluationCompleted?.(res);
      },
      onWhiteboardUpdate: (payload) => {
        try { useAppStore.getState().setWhiteboardState(payload); } catch {}
        optionsRef.current.onWhiteboardUpdate?.(payload);
      },
      onChaosInjected: (payload) => optionsRef.current.onChaosInjected?.(payload),
      onHiringCommitteeVerdict: (payload) => optionsRef.current.onHiringCommitteeVerdict?.(payload),
      onBugSolved: (payload) => optionsRef.current.onBugSolved?.(payload),
      onCandidateObservationRecorded: (payload) => optionsRef.current.onCandidateObservationRecorded?.(payload),
      onHrPhaseTransition: (payload) => {
        try { useHrSimulatorStore.getState().setPhase(payload.toPhase); } catch {}
      },
      onHrScorecardReady: (scorecard) => {
        setActiveScorecard(scorecard);
        try { useHrSimulatorStore.getState().setScorecard(scorecard); } catch {}
      },
      onHrTranscriptDelta: (delta) => {
        try { useHrSimulatorStore.getState().appendTranscriptDelta(delta); } catch {}
      },
      onHrStepState: (stepState) => {
        try { useHrSimulatorStore.getState().setGuidedStepState(stepState); } catch {}
      },
      onError: (err) => {
        setLastError(err);
        optionsRef.current.onError?.(err);
      }
    });
  }

  const subscribeAudioLevel = useCallback<AudioLevelSubscriber>((listener) => {
    audioLevelListenersRef.current.add(listener);
    return () => { audioLevelListenersRef.current.delete(listener); };
  }, []);

  const connect = useCallback(async (params: LiveAudioSessionParams) => {
    setActiveScorecard(null);
    setLastError(null);
    setDialogueTurns([]);
    vadActiveRef.current = false;
    setVadActive(false);
    isMutedRef.current = false;
    setIsMuted(false);
    engineRef.current?.dispatch({ type: 'SET_MUTED', muted: false });

    const config: VoiceEngineConfig = resolveLiveSessionConfig(params, {
      activeCode: optionsRef.current.getActiveCode?.()
    });
    await engineRef.current?.connect(config);
    optionsRef.current.onSetupComplete?.();
  }, []);

  const disconnect = useCallback(() => {
    engineRef.current?.disconnect();
  }, []);

  const toggleMic = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    engineRef.current?.dispatch({ type: 'SET_MUTED', muted: next });
  }, []);

  const handleInteraction = useCallback(() => {
    engineRef.current?.dispatch({ type: 'CENTRAL_ACTION' });
  }, []);

  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    engineRef.current?.dispatch({ type: 'SEND_TEXT', text, displayText });
  }, []);

  const sendCustomFrame = useCallback((frame: any) => {
    engineRef.current?.dispatch({ type: 'SEND_FRAME', frame });
  }, []);

  const sendCanvasDelta = useCallback((delta: any) => {
    engineRef.current?.dispatch({ type: 'SEND_FRAME', frame: { type: 'canvas_delta', payload: delta } });
  }, []);

  useEffect(() => () => { engineRef.current?.disconnect(); }, []);

  const isConnected = state !== 'IDLE' && state !== 'ERROR' && state !== 'COMPLETED';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isListening = state === 'LISTENING';

  return {
    state,
    statusMessage,
    lastError,
    isError: state === 'ERROR',
    vadActive,
    dialogueTurns,
    activeScorecard,
    connect,
    disconnect,
    toggleMic,
    handleInteraction,
    sendTextMessage,
    sendCustomFrame,
    sendCanvasDelta,
    subscribeAudioLevel,
    engineRef,
    isConnected,
    isAiSpeaking,
    isListening,
    isRecording: isListening,
    isMuted,
    isUserSpeaking: vadActive,
    isPauseHolding: state === 'AI_THINKING' || state === 'COMMITTING'
  };
}
