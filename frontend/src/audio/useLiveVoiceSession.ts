/**
 * useLiveVoiceSession.ts
 * Authoritative Unified React hook for NativeLiveVoiceEngine (SOTA Late 2026).
 * Single responsibility: reactive bridge between Headless LiveVoiceEngine and React components.
 * Bounded cognitive size: <= 250 lines.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { NativeLiveVoiceEngine } from './NativeLiveVoiceEngine';
import { useAppStore } from '../store/useAppStore';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import {
  VoiceEngineState,
  VoiceEngineConfig,
  DialogueTurnItem,
  VoiceEvaluationResult,
  ILiveVoiceEngine
} from './types';

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
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'incident' | string;
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

export type UseLiveAudioSessionOptions = UseLiveVoiceSessionOptions;

export interface UseLiveVoiceSessionReturn {
  state: VoiceEngineState;
  isConnected: boolean;
  isAiSpeaking: boolean;
  isListening: boolean;
  isRecording: boolean;
  isEvaluating: boolean;
  isDraining: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  statusMessage: string;
  aiTranscript: string;
  dialogueTurns: DialogueTurnItem[];
  evaluation: VoiceEvaluationResult | null;
  error: string | null;
  connect: (config: VoiceEngineConfig) => Promise<void>;
  startSession: (params: LiveAudioSessionParams) => Promise<void>;
  disconnect: () => void;
  disconnectSession: () => void;
  toggleMute: () => void;
  toggleMic: () => void;
  finishManualTurn: () => void;
  handleBargeIn: () => void;
  handleCentralButtonClick: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  sendCanvasDelta: (delta: any) => void;
  sendCustomFrame: (frame: any) => void;
  sendActionEventMessage: (eventName: string, payload?: any) => void;
  engineRef: React.MutableRefObject<ILiveVoiceEngine | null>;
  playoutManagerRef: React.MutableRefObject<AudioPlayoutManager | null>;
}

export type UseLiveAudioSessionReturn = UseLiveVoiceSessionReturn;

export function useLiveVoiceSession(options: UseLiveVoiceSessionOptions = {}): UseLiveVoiceSessionReturn {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<VoiceEngineState>('IDLE');
  const [isDraining, setIsDraining] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [rmsDb, setRmsDb] = useState<number>(-100);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurnItem[]>([]);
  const [aiTranscript, setAiTranscript] = useState<string>('');
  const [evaluation, setEvaluation] = useState<VoiceEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<ILiveVoiceEngine | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);

  if (!engineRef.current) {
    engineRef.current = new NativeLiveVoiceEngine({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'IDLE' || newState === 'COMPLETED') {
          optionsRef.current.onDisconnect?.();
        }
      },
      onAudioLevel: (db) => setRmsDb(db),
      onStatusMessage: (msg) => setStatusMessage(msg),
      onDrainingStateChange: (draining) => setIsDraining(draining),
      onTranscriptDelta: (role, text) => {
        if (role === 'ai') setAiTranscript((prev) => prev + text);
      },
      onDialogueTurnsUpdate: (turns) => setDialogueTurns(turns),
      onEvaluationReceived: (res) => {
        setEvaluation(res);
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
      onError: (err) => {
        setError(err);
        optionsRef.current.onError?.(err);
      }
    });

    playoutManagerRef.current = engineRef.current.getPlayoutManager();
  }

  const connect = useCallback(async (config: VoiceEngineConfig) => {
    setError(null);
    setEvaluation(null);
    setDialogueTurns([]);
    setAiTranscript('');
    await engineRef.current?.connect(config);
    optionsRef.current.onSetupComplete?.();
  }, []);

  const startSession = useCallback(async (params: LiveAudioSessionParams) => {
    const config: VoiceEngineConfig = {
      sessionId: params.sessionId || `session_${Date.now()}`,
      questionId: params.questionId || 'default_question',
      topic: params.topic,
      questionText: params.questionText,
      referenceAnswer: params.referenceAnswer,
      sessionType: params.sessionType || 'interview',
      tutorMode: params.tutorMode,
      voice: params.voice || 'Kore',
      userGender: params.userGender,
      turnMode: params.turnMode || 'auto',
      liveModel: params.liveModel,
      vadPauseMs: params.vadPauseMs,
      persona: params.persona || params.tutorPersona,
      targetGrade: params.targetGrade,
      strategy: params.strategy,
      bugTitle: params.bugTitle,
      bugExplanation: params.bugExplanation,
      codeSnippet: params.codeSnippet || optionsRef.current.getActiveCode?.(),
      fixedCode: params.fixedCode,
      unitTest: params.unitTest,
      scenarioId: params.scenarioId,
      incidentContext: params.incidentContext,
      customPrompt: params.customPrompt,
      challengeCategory: params.challengeCategory,
      challengeTrack: params.challengeTrack,
      challengeDomain: params.challengeDomain,
      initialUserMessage: params.initialUserMessage,
      isResumed: params.isResumed,
      enableSilenceClarification: params.enableSilenceClarification,
      workspaceManifest: params.workspaceManifest,
      activeCodeArtifact: params.activeCodeArtifact as any
    };
    await connect(config);
  }, [connect]);

  const disconnect = useCallback(() => {
    engineRef.current?.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const finishManualTurn = useCallback(() => {
    engineRef.current?.commitSpokenTurn();
  }, []);

  const handleBargeIn = useCallback(() => {
    engineRef.current?.handleBargeInInterruption('tactile');
  }, []);

  const handleCentralButtonClick = useCallback(() => {
    engineRef.current?.handleCentralButtonClick();
  }, []);

  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    engineRef.current?.sendTextMessage(text, displayText);
  }, []);

  const sendCanvasDelta = useCallback((delta: any) => {
    engineRef.current?.sendCustomFrame({ type: 'canvas_delta', delta });
  }, []);

  const sendCustomFrame = useCallback((frame: any) => {
    engineRef.current?.sendCustomFrame(frame);
  }, []);

  const sendActionEventMessage = useCallback((eventName: string, payload?: any) => {
    engineRef.current?.sendCustomFrame({ type: 'action_event', eventName, payload });
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.disconnect();
    };
  }, []);

  const isConnected = state !== 'IDLE' && state !== 'ERROR';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isListening = state === 'LISTENING';

  return {
    state,
    isConnected,
    isAiSpeaking,
    isListening,
    isRecording: isListening,
    isEvaluating: state === 'EVALUATING',
    isDraining,
    isMuted,
    isUserSpeaking: isListening && rmsDb > -45,
    isPauseHolding: false,
    rmsDb,
    statusMessage,
    aiTranscript,
    dialogueTurns,
    evaluation,
    error,
    connect,
    startSession,
    disconnect,
    disconnectSession: disconnect,
    toggleMute,
    toggleMic: toggleMute,
    finishManualTurn,
    handleBargeIn,
    handleCentralButtonClick,
    sendTextMessage,
    sendCanvasDelta,
    sendCustomFrame,
    sendActionEventMessage,
    engineRef,
    playoutManagerRef
  };
}
