/**
 * LiveAudioStreamManager.ts
 * Manages outgoing microphone audio streaming, in-place transient clamping, and speculative ducking.
 * Cognitive bounding limit: <= 350 lines.
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneMetrics } from './MicrophoneCapture';

const STATIC_SILENCE_BASE64 = 'A'.repeat(1366) + '==';

export interface AudioStreamContext {
  ws: WebSocket | null;
  playoutManager: AudioPlayoutManager;
  getState: () => string;
  isMuted: boolean;
  isAudioMutexLocked: boolean;
  isTurn0Lockdown: boolean;
  isSessionReady: boolean;
  onBargeIn: (source: 'acoustic') => void;
  onTransientFiltered?: () => void;
}

export class LiveAudioStreamManager {
  private consecutiveVoicingFrames = 0;

  public reset(): void {
    this.consecutiveVoicingFrames = 0;
  }

  public processMicrophoneChunk(
    base64Pcm: string,
    metrics: MicrophoneMetrics | undefined,
    ctx: AudioStreamContext
  ): void {
    if (ctx.isMuted || ctx.isAudioMutexLocked) return;

    // 1. Transient / Cough Suppression during AI_SPEAKING (Local False Interruption Protection)
    if (ctx.getState() === 'AI_SPEAKING') {
      if (ctx.isTurn0Lockdown) return;

      if (metrics?.isTransientSpike) {
        if (this.consecutiveVoicingFrames > 0) {
          ctx.playoutManager.rollbackDucking(15);
          this.consecutiveVoicingFrames = 0;
        }
        ctx.onTransientFiltered?.();
        return;
      }

      if (metrics?.speechDetected || (metrics && metrics.rmsDb > -38)) {
        if (metrics?.speechDetected) {
          ctx.onBargeIn('acoustic');
          this.consecutiveVoicingFrames = 0;
          return;
        }
        ctx.playoutManager.speculativeDuck(0.35, 15);
        this.consecutiveVoicingFrames++;
        if (this.consecutiveVoicingFrames >= 7) {
          ctx.onBargeIn('acoustic');
          this.consecutiveVoicingFrames = 0;
        }
      } else if (this.consecutiveVoicingFrames > 0) {
        ctx.playoutManager.rollbackDucking(15);
        ctx.onTransientFiltered?.();
        this.consecutiveVoicingFrames = 0;
      }
      return;
    }

    if (!ctx.isSessionReady || ctx.getState() !== 'LISTENING') return;

    // 2. In-Place Clamping for Continuous PCM Streaming during LISTENING (Cloud VAD Protection)
    if (ctx.ws && ctx.ws.readyState === WebSocket.OPEN) {
      if (metrics?.isTransientSpike) {
        ctx.onTransientFiltered?.();
        ctx.ws.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: STATIC_SILENCE_BASE64 } }
        }));
      } else {
        ctx.ws.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm } }
        }));
      }
    }
  }
}
