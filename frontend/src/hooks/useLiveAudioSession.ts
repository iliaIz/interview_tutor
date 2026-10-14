/**
 * useLiveAudioSession.ts
 * Re-export wrapper delegating strictly to authoritative useLiveVoiceSession.
 * Maintained for backward compatibility across Practice and System Design arenas.
 * Cognitive bounding limit: <= 40 lines.
 */

export {
  useLiveVoiceSession as useLiveAudioSession,
  useLiveVoiceSession
} from '../audio/useLiveVoiceSession';

export type {
  DialogueTurn,
  LiveAudioSessionParams,
  UseLiveAudioSessionOptions,
  UseLiveVoiceSessionOptions,
  UseLiveAudioSessionReturn,
  UseLiveVoiceSessionReturn
} from '../audio/useLiveVoiceSession';
