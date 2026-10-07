import { useState, useRef, useEffect, useCallback } from 'react';
import { LiveVoiceEngine } from '../audio/LiveVoiceEngine';
import { VoiceEngineState, VoiceEngineConfig, DialogueTurnItem } from '../audio/types';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { useAppStore } from '../store/useAppStore';

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

export interface DialogueTurn {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface UseLiveAudioSessionOptions {
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: any) => void;
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

/**
 * useLiveAudioSession (SOTA Late 2026 Adapter).
 * Lightweight React binding wrapping the authoritative Headless LiveVoiceEngine.
 * Eliminates legacy duplicate hooks across arenas.
 * Cognitive bounding limit: <= 350 lines.
 */
export function useLiveAudioSession(options: UseLiveAudioSessionOptions = {}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<VoiceEngineState>('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const [rmsDb, setRmsDb] = useState(-100);
  const [statusMessage, setStatusMessage] = useState('');
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurn[]>([]);
  const [aiTranscript, setAiTranscript] = useState('');

  const engineRef = useRef<LiveVoiceEngine | null>(null);
  const playoutManagerRef = useRef<AudioPlayoutManager | null>(null);

  if (!engineRef.current) {
    engineRef.current = new LiveVoiceEngine({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'IDLE' || newState === 'COMPLETED') {
          optionsRef.current.onDisconnect?.();
        }
      },
      onAudioLevel: (db) => setRmsDb(db),
      onStatusMessage: (msg) => setStatusMessage(msg),
      onTranscriptDelta: (role, text) => {
        if (role === 'ai') setAiTranscript((prev) => prev + text);
      },
      onDialogueTurnsUpdate: (turns: DialogueTurnItem[]) => {
        setDialogueTurns(turns.map(t => ({ role: t.role, text: t.text })));
      },
      onEvaluationReceived: (res) => {
        optionsRef.current.onEvaluationCompleted?.(res);
      },
      onError: (err) => {
        optionsRef.current.onError?.(err);
      },
      onWhiteboardUpdate: (payload) => {
        try {
          useAppStore.getState().setWhiteboardState(payload);
        } catch (e) {
          console.warn('[useLiveAudioSession] Failed to update whiteboard store:', e);
        }
        optionsRef.current.onWhiteboardUpdate?.(payload);
      },
      onChaosInjected: (payload) => {
        optionsRef.current.onChaosInjected?.(payload);
      },
      onHiringCommitteeVerdict: (payload) => {
        optionsRef.current.onHiringCommitteeVerdict?.(payload);
      }
    });

    playoutManagerRef.current = engineRef.current.getPlayoutManager();
  }

  const startSession = useCallback(async (params: LiveAudioSessionParams) => {
    setAiTranscript('');
    setDialogueTurns([]);

    const config: VoiceEngineConfig = {
      sessionId: params.sessionId || `session_${Date.now()}`,
      questionId: params.questionId || 'default_question',
      topic: params.topic,
      questionText: params.questionText,
      referenceAnswer: params.referenceAnswer,
      sessionType: params.sessionType || 'interview',
      tutorMode: params.tutorMode,
      voice: params.voice || 'Kore',
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

    await engineRef.current?.connect(config);
    optionsRef.current.onSetupComplete?.();
  }, []);

  const disconnectSession = useCallback(() => {
    engineRef.current?.disconnect();
  }, []);

  const toggleMic = useCallback(() => {
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
    engineRef.current?.handleBargeInInterruption();
  }, []);

  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    engineRef.current?.sendTextMessage(text, displayText);
  }, []);

  const sendCanvasDelta = useCallback((delta: any) => {
    engineRef.current?.sendCustomFrame({
      type: 'canvas_delta',
      delta
    });
  }, []);

  const sendActionEventMessage = useCallback((eventName: string, payload?: any) => {
    engineRef.current?.sendCustomFrame({
      type: 'action_event',
      eventName,
      payload
    });
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.disconnect();
    };
  }, []);

  const isConnected = state !== 'IDLE' && state !== 'ERROR';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isRecording = state === 'LISTENING';

  return {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking: isRecording && rmsDb > -45,
    isPauseHolding: false,
    rmsDb,
    statusMessage,
    aiTranscript,
    dialogueTurns,
    startSession,
    disconnectSession,
    toggleMic,
    toggleMute: toggleMic,
    finishManualTurn,
    handleBargeIn,
    sendTextMessage,
    sendCanvasDelta,
    sendCustomFrame: (frame: any) => engineRef.current?.sendCustomFrame(frame),
    sendActionEventMessage,
    playoutManagerRef,
    handleCentralButtonClick: () => engineRef.current?.handleCentralButtonClick()
  };
}
