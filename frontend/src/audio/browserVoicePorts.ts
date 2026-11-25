/**
 * browserVoicePorts.ts
 * Default browser adapters for LiveTransportPort (WebSocket) and LiveAudioIOPort
 * (AudioPlayoutManager + MicrophoneCapture). Keeps NativeLiveVoiceEngine headless.
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneCapture } from './MicrophoneCapture';
import { LiveAudioIOPort, LiveTransportConnection, LiveTransportPort } from './types';

export function createBrowserTransportPort(): LiveTransportPort {
  return {
    connect(url, handlers): LiveTransportConnection {
      const ws = new WebSocket(url);
      let isLocallyClosed = false;

      ws.onopen = () => handlers.onOpen();
      ws.onmessage = (event) => handlers.onMessage(event.data);
      ws.onerror = (err) => handlers.onError(err);
      ws.onclose = (event: CloseEvent) => {
        if (!isLocallyClosed) {
          handlers.onClose(event?.code);
        }
      };

      return {
        send: (payload: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        },
        close: (code = 1000, reason = 'Normal Closure') => {
          isLocallyClosed = true;
          try {
            ws.onclose = null;
            ws.close(code, reason);
          } catch {}
        },
        isOpen: () => ws.readyState === WebSocket.OPEN
      };
    }
  };
}

export function createBrowserAudioIOPort(): LiveAudioIOPort {
  const playoutManager = new AudioPlayoutManager();
  let micCapture: MicrophoneCapture | null = null;
  let currentMuted = false;

  return {
    async startCapture(onFrame, onLevel): Promise<void> {
      micCapture?.stop();
      micCapture = new MicrophoneCapture({
        onAudioFrame: (base64Pcm, metrics) => onFrame(base64Pcm, metrics),
        onAudioLevel: (db) => onLevel(db)
      });
      micCapture.setMuted(currentMuted);
      await playoutManager.resume();
      const ctx = playoutManager.getContext();
      await micCapture.start(ctx);
    },
    stopCapture(): void {
      micCapture?.stop();
      micCapture = null;
    },
    setMuted(muted: boolean): void {
      currentMuted = muted;
      micCapture?.setMuted(muted);
    },
    enqueuePcm(pcm: string): void {
      playoutManager.enqueuePcmChunk(pcm);
    },
    interruptPlayout(): void {
      playoutManager.handleInterruption();
    },
    notifyTurnComplete(): void {
      playoutManager.notifyTurnComplete();
    },
    handlePlayoutFinished(cb: () => void): void {
      playoutManager.onPlaybackFinished = cb;
    },
    isPlaying(): boolean {
      return playoutManager.isPlaying();
    },
    clearPlayout(): void {
      playoutManager.clearQueue();
    }
  };
}
