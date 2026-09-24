/**
 * useLiveVoiceSession.ts
 * React hook binding for Headless LiveVoiceEngine (SOTA Late 2026).
 * Single responsibility: reactive bridge between LiveVoiceEngine and React components.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveVoiceEngine } from './LiveVoiceEngine';
import {
  VoiceEngineState,
  VoiceEngineConfig,
  DialogueTurnItem,
  VoiceEvaluationResult
} from './types';

export interface UseLiveVoiceSessionReturn {
  state: VoiceEngineState;
  isConnected: boolean;
  isAiSpeaking: boolean;
  isListening: boolean;
  isEvaluating: boolean;
  isMuted: boolean;
  rmsDb: number;
  statusMessage: string;
  dialogueTurns: DialogueTurnItem[];
  evaluation: VoiceEvaluationResult | null;
  error: string | null;
  connect: (config: VoiceEngineConfig) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  handleCentralButtonClick: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  engineRef: React.MutableRefObject<LiveVoiceEngine | null>;
}

export function useLiveVoiceSession(): UseLiveVoiceSessionReturn {
  const [state, setState] = useState<VoiceEngineState>('IDLE');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [rmsDb, setRmsDb] = useState<number>(-100);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [dialogueTurns, setDialogueTurns] = useState<DialogueTurnItem[]>([]);
  const [evaluation, setEvaluation] = useState<VoiceEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<LiveVoiceEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new LiveVoiceEngine({
      onStateChange: (newState) => setState(newState),
      onAudioLevel: (db) => setRmsDb(db),
      onStatusMessage: (msg) => setStatusMessage(msg),
      onDialogueTurnsUpdate: (turns) => setDialogueTurns(turns),
      onEvaluationReceived: (res) => setEvaluation(res),
      onError: (err) => setError(err)
    });
  }

  const connect = useCallback(async (config: VoiceEngineConfig) => {
    setError(null);
    setEvaluation(null);
    setDialogueTurns([]);
    await engineRef.current?.connect(config);
  }, []);

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

  const handleCentralButtonClick = useCallback(() => {
    engineRef.current?.handleCentralButtonClick();
  }, []);

  const sendTextMessage = useCallback((text: string, displayText?: string) => {
    engineRef.current?.sendTextMessage(text, displayText);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.disconnect();
    };
  }, []);

  return {
    state,
    isConnected: state !== 'IDLE' && state !== 'ERROR',
    isAiSpeaking: state === 'AI_SPEAKING',
    isListening: state === 'LISTENING',
    isEvaluating: state === 'EVALUATING',
    isMuted,
    rmsDb,
    statusMessage,
    dialogueTurns,
    evaluation,
    error,
    connect,
    disconnect,
    toggleMute,
    handleCentralButtonClick,
    sendTextMessage,
    engineRef
  };
}
