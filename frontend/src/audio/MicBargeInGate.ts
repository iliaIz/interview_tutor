/**
 * MicBargeInGate.ts — Acoustic echo immunity & 16kHz PCM clamping gate (Spec 53 / #192).
 */

import { MicrophoneMetrics } from './MicrophoneCapture';
import { LiveTransportConnection, VoiceEngineState } from './types';

const STATIC_SILENCE_BASE64 = 'A'.repeat(1366) + '==';

export interface MicGateSnapshot {
  state: VoiceEngineState;
  isMuted: boolean;
  isAudioMutexLocked: boolean;
  isTurn0Lockdown: boolean;
  isSessionReady: boolean;
  connection: LiveTransportConnection | null;
}

export interface MicGateCallbacks {
  onTransientFiltered?: () => void;
  onBargeIn: (source: 'acoustic') => void;
}

export class MicBargeInGate {
  private consecutiveVoicingFrames = 0;

  public resetCounters(): void {
    this.consecutiveVoicingFrames = 0;
  }

  public processChunk(
    base64Pcm: string,
    metrics: MicrophoneMetrics | undefined,
    snapshot: MicGateSnapshot,
    callbacks: MicGateCallbacks
  ): void {
    if (snapshot.isMuted || snapshot.isAudioMutexLocked) return;

    if (snapshot.state === 'AI_SPEAKING') {
      if (snapshot.isTurn0Lockdown) return;
      if (metrics?.isTransientSpike) {
        this.consecutiveVoicingFrames = 0;
        callbacks.onTransientFiltered?.();
        return;
      }
      if (metrics?.speechDetected) {
        callbacks.onBargeIn('acoustic');
        this.consecutiveVoicingFrames = 0;
        return;
      }
      if (metrics && typeof metrics.rmsDb === 'number' && metrics.rmsDb >= -29) {
        this.consecutiveVoicingFrames++;
        if (this.consecutiveVoicingFrames >= 7) {
          callbacks.onBargeIn('acoustic');
          this.consecutiveVoicingFrames = 0;
        }
      } else {
        if (this.consecutiveVoicingFrames > 0 && this.consecutiveVoicingFrames < 7) {
          callbacks.onTransientFiltered?.();
        }
        this.consecutiveVoicingFrames = 0;
      }
      return;
    }

    if (!snapshot.isSessionReady || snapshot.state !== 'LISTENING') return;

    const conn = snapshot.connection;
    if (conn && conn.isOpen()) {
      const payload = metrics?.isTransientSpike
        ? (callbacks.onTransientFiltered?.(), STATIC_SILENCE_BASE64)
        : base64Pcm;
      conn.send(JSON.stringify({
        realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: payload } }
      }));
    }
  }
}
