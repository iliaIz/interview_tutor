/**
 * useLiveAudioSession.ts
 * Adapter wrapper delegating strictly to authoritative useLiveVoiceSession (SPEC-002, Ticket #7).
 * Maintained for backward compatibility across Practice and System Design arenas.
 * Cognitive bounding limit: <= 80 lines.
 */

import {
  useLiveVoiceSession,
  UseLiveVoiceSessionOptions,
  LiveAudioSessionParams,
  DialogueTurnItem
} from '../audio/useLiveVoiceSession';

export { useLiveVoiceSession };

export type {
  DialogueTurn,
  LiveAudioSessionParams,
  UseLiveVoiceSessionOptions,
  UseLiveVoiceSessionOptions as UseLiveAudioSessionOptions,
  UseLiveVoiceSessionReturn,
  LiveAudioMetrics
} from '../audio/useLiveVoiceSession';

export interface UseLiveAudioSessionReturn {
  state: any;
  metrics: any;
  statusMessage: string;
  dialogueTurns: DialogueTurnItem[];
  activeScorecard: any;
  connect: (params: LiveAudioSessionParams) => Promise<void>;
  disconnect: () => void;
  toggleMic: () => void;
  handleInteraction: () => void;

  // Compatibility adapters
  isConnected: boolean;
  isAiSpeaking: boolean;
  isListening: boolean;
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  startSession: (params: LiveAudioSessionParams) => Promise<void>;
  disconnectSession: () => void;
  toggleMute: () => void;
  finishManualTurn: () => void;
  handleBargeIn: () => void;
  handleCentralButtonClick: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  sendCanvasDelta: (delta: any) => void;
  sendCustomFrame: (frame: any) => void;
  sendActionEventMessage: (eventName: string, payload?: any) => void;
  evaluation: any;
  error: string | null;
  engineRef: { current: null };
  playoutManagerRef: { current: null };
}

export function useLiveAudioSession(options: UseLiveVoiceSessionOptions = {}): UseLiveAudioSessionReturn {
  const session = useLiveVoiceSession(options);
  const isConnected = session.state !== 'IDLE' && session.state !== 'ERROR' && session.state !== 'COMPLETED';
  const isAiSpeaking = session.state === 'AI_SPEAKING';
  const isListening = session.state === 'LISTENING';

  return {
    ...session,
    isConnected,
    isAiSpeaking,
    isListening,
    isRecording: isListening,
    isUserSpeaking: session.metrics.vadActive,
    isPauseHolding: session.state === 'AI_THINKING' || session.state === 'COMMITTING',
    rmsDb: session.metrics.rmsDb,
    startSession: session.connect,
    disconnectSession: session.disconnect,
    toggleMute: session.toggleMic,
    finishManualTurn: session.handleInteraction,
    handleBargeIn: session.handleInteraction,
    handleCentralButtonClick: session.handleInteraction,
    sendTextMessage: () => {},
    sendCanvasDelta: () => {},
    sendCustomFrame: () => {},
    sendActionEventMessage: () => {},
    evaluation: session.activeScorecard,
    error: session.state === 'ERROR' ? session.statusMessage : null,
    engineRef: { current: null },
    playoutManagerRef: { current: null }
  };
}
