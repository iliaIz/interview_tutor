/**
 * liveMicChunkDispatcher.ts
 * Single-responsibility dispatcher for incoming microphone PCM frames.
 * Handles transient cough/spike suppression, acoustic barge-in triggering,
 * and client-side speech cessation detection for fast handoff.
 * Cognitive bounding limit: <= 120 lines (Rule 8).
 */

import { MicrophoneMetrics } from './MicrophoneCapture';
import { LiveTransportConnection, VoiceEngineState } from './types';

const STATIC_SILENCE_BASE64 = 'A'.repeat(1366) + '==';

export interface MicDispatcherCallbacks {
  onTransientFiltered?: () => void;
  onBargeIn: (source: 'acoustic') => void;
  onCommitSpokenTurn?: () => void;
}

export class LiveMicChunkDispatcher {
  private consecutiveVoicingFrames = 0;

  public resetCounters(): void {
    this.consecutiveVoicingFrames = 0;
  }

  public dispatchChunk(
    base64Pcm: string,
    metrics: MicrophoneMetrics | undefined,
    state: VoiceEngineState,
    isMuted: boolean,
    isAudioMutexLocked: boolean,
    isTurn0Lockdown: boolean,
    isSessionReady: boolean,
    _turnMode: 'auto' | 'manual' | undefined,
    connection: LiveTransportConnection | null,
    callbacks: MicDispatcherCallbacks
  ): void {
    if (isMuted || isAudioMutexLocked) return;

    // 1. Transient / Cough Suppression & Echo-Immune Acoustic Barge-In during AI_SPEAKING (SOTA Spec 17)
    if (state === 'AI_SPEAKING') {
      if (isTurn0Lockdown) return;

      // Transient spike (cough, key tap, desk bump) -> 100% filtered
      if (metrics?.isTransientSpike) {
        this.consecutiveVoicingFrames = 0;
        callbacks.onTransientFiltered?.();
        return;
      }

      // Explicit phonetic / neural speech detected -> immediate acoustic barge-in
      if (metrics?.speechDetected) {
        callbacks.onBargeIn('acoustic');
        this.consecutiveVoicingFrames = 0;
        return;
      }

      // SOTA Spec 17 & gemini_live_reference Invariant:
      // Energy threshold: RMS >= 0.035 (~ -29 dBFS).
      // Bleed from physical laptop/phone speakers (< -29 dBFS) is rejected to eliminate self-interruption.
      if (metrics && typeof metrics.rmsDb === 'number' && metrics.rmsDb >= -29) {
        this.consecutiveVoicingFrames++;
        // 7 frames @ 32ms = 224ms sustained vocal phonation (>= 180ms transient window)
        if (this.consecutiveVoicingFrames >= 7) {
          callbacks.onBargeIn('acoustic');
          this.consecutiveVoicingFrames = 0;
        }
      } else {
        if (this.consecutiveVoicingFrames > 0 && this.consecutiveVoicingFrames < 7) callbacks.onTransientFiltered?.();
        this.consecutiveVoicingFrames = 0;
      }
      return;
    }

    if (!isSessionReady || state !== 'LISTENING') {
      return;
    }

    // 2. In-Place Clamping for Continuous PCM Streaming during LISTENING (Cloud VAD Protection)
    if (connection && connection.isOpen()) {
      if (metrics?.isTransientSpike) {
        callbacks.onTransientFiltered?.();
        connection.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: STATIC_SILENCE_BASE64 } }
        }));
      } else {
        connection.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm } }
        }));
      }
    }
  }
}
