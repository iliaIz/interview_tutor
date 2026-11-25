/**
 * LiveHotHandoffCoordinator.ts
 * Proactive Make-Before-Break GoAway Hot Handoff Coordinator (Spec 42 / #156).
 * Prevents 1008 GoAway disconnects (~10 min) by spinning up Socket B with the latest
 * cryptographic resumptionHandle, swapping atomically, and falling back to replay
 * context hydration if cross-key rotation occurs.
 * Cognitive Bounding Limit: <= 250 lines (Rule 8 compliant).
 */

import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { UpstreamGeminiPipe } from './UpstreamGeminiPipe';

export interface HotHandoffCoordinatorOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  pipe: UpstreamGeminiPipe;
  buildSetupMessage: (resumptionHandle?: string) => any;
  sendContextReplay: (socket: WebSocket) => void;
  flushFrameQueue: (socket: WebSocket) => void;
}

export function parseGoAwayTimeLeftSeconds(timeLeft: unknown, fallbackSeconds = 60): number {
  if (typeof timeLeft === 'number' && Number.isFinite(timeLeft)) {
    return Math.max(5, Math.round(timeLeft));
  }
  if (typeof timeLeft === 'string') {
    const num = parseFloat(timeLeft.replace(/s$/i, '').trim());
    if (Number.isFinite(num)) return Math.max(5, Math.round(num));
  }
  if (timeLeft && typeof timeLeft === 'object' && 'seconds' in (timeLeft as any)) {
    const sec = Number((timeLeft as any).seconds);
    if (Number.isFinite(sec)) return Math.max(5, Math.round(sec));
  }
  return fallbackSeconds;
}

export class LiveHotHandoffCoordinator {
  private inProgress = false;
  private isDisposed = false;
  private standbySocket: WebSocket | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private drainWaitTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: HotHandoffCoordinatorOptions) {}

  public isHandoffActive(): boolean {
    return this.inProgress;
  }

  public handleGoAway(goAwayPayload: any): void {
    const { session, clientSocket } = this.options;
    if (this.isDisposed || this.inProgress || session.isTerminated || !session.isSetupComplete) {
      return;
    }

    const timeLeftSeconds = parseGoAwayTimeLeftSeconds(goAwayPayload?.timeLeft, 60);
    this.inProgress = true;
    console.log(
      `⏳ [HOT_HANDOFF] Upstream GoAway received (timeLeft=${timeLeftSeconds}s, session=${session.sessionId || 'anon'}). Initiating Make-Before-Break handoff...`
    );

    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        clientSocket.send(JSON.stringify({ type: 'hot_handoff_started', timeLeftSeconds }));
      } catch {}
    }

    this.startStandbyAttempt(session.resumptionHandle, timeLeftSeconds, false);
  }

  private startStandbyAttempt(
    resumptionHandle: string | undefined,
    timeLeftSeconds: number,
    isFallbackReplay: boolean
  ): void {
    if (this.isDisposed || this.options.session.isTerminated) {
      this.inProgress = false;
      return;
    }

    this.cleanupStandby();
    const setupPayload = this.options.buildSetupMessage(resumptionHandle);
    const ws = this.options.pipe.openStandbySocket(setupPayload);
    this.standbySocket = ws;

    let setupCompleteReceived = false;
    let rotatedDuringSetup = false;

    this.connectTimer = setTimeout(() => {
      if (!setupCompleteReceived && this.standbySocket === ws) {
        console.warn('⏱️ [HOT_HANDOFF] Standby socket setup timed out before setupComplete.');
        this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay);
      }
    }, 8000);

    ws.on('message', (raw: RawData) => {
      if (this.isDisposed || this.standbySocket !== ws) return;
      let parsed: any = null;
      try {
        parsed = JSON.parse(toRawBuffer(raw).toString('utf8'));
      } catch {
        return;
      }

      if (parsed?.type === 'key_rotated') {
        rotatedDuringSetup = true;
        this.options.session.resumptionHandle = undefined;
        this.options.session.resumptionManager?.clear();
        return;
      }

      if (parsed?.setupComplete && !setupCompleteReceived) {
        setupCompleteReceived = true;
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }

        const usedNativeResumption = Boolean(resumptionHandle && !rotatedDuringSetup && !isFallbackReplay);
        if (!usedNativeResumption) {
          this.options.sendContextReplay(ws);
        }
        this.scheduleAdoption(ws, timeLeftSeconds, usedNativeResumption ? 'resumption' : 'replay');
      }
    });

    ws.on('close', () => {
      if (!setupCompleteReceived && this.standbySocket === ws) {
        this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay);
      }
    });

    ws.on('error', () => {
      if (!setupCompleteReceived && this.standbySocket === ws) {
        this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay);
      }
    });
  }

  private handleStandbyFailure(
    failedWs: WebSocket,
    resumptionHandle: string | undefined,
    timeLeftSeconds: number,
    isFallbackReplay: boolean
  ): void {
    if (this.standbySocket !== failedWs) return;
    this.cleanupStandby();

    if (!isFallbackReplay && resumptionHandle) {
      console.warn('🔄 [HOT_HANDOFF] Standby resumption rejected; retrying clean replay handoff across key pool...');
      this.options.session.resumptionHandle = undefined;
      this.options.session.resumptionManager?.clear();
      this.startStandbyAttempt(undefined, timeLeftSeconds, true);
      return;
    }

    console.warn('⚠️ [HOT_HANDOFF] Standby handoff failed; deferring recovery to primary reconnect.');
    this.inProgress = false;
  }

  private scheduleAdoption(ws: WebSocket, timeLeftSeconds: number, mode: 'resumption' | 'replay'): void {
    const { session } = this.options;
    const isBusy = () => Boolean(session.isAiGenerating || session.awaitingToolSpeech);

    if (!isBusy()) {
      this.completeAdoption(ws, mode);
      return;
    }

    const maxWaitMs = Math.max(1500, Math.min(15000, (timeLeftSeconds - 8) * 1000));
    const startedAt = Date.now();

    const checkReady = () => {
      if (this.isDisposed || session.isTerminated || this.standbySocket !== ws) return;
      if (!isBusy() || Date.now() - startedAt >= maxWaitMs) {
        this.completeAdoption(ws, mode);
        return;
      }
      this.drainWaitTimer = setTimeout(checkReady, 120);
    };

    this.drainWaitTimer = setTimeout(checkReady, 120);
  }

  private completeAdoption(ws: WebSocket, mode: 'resumption' | 'replay'): void {
    const { session, clientSocket, pipe } = this.options;
    if (this.drainWaitTimer) {
      clearTimeout(this.drainWaitTimer);
      this.drainWaitTimer = null;
    }
    if (this.isDisposed || session.isTerminated || ws.readyState !== WebSocket.OPEN) {
      this.cleanupStandby();
      this.inProgress = false;
      return;
    }

    this.standbySocket = null;
    this.inProgress = false;
    pipe.adoptSocket(ws);
    session.isSetupComplete = true;
    session.isUpstreamReconnecting = false;
    session.reconnectAttempts = 0;
    this.options.flushFrameQueue(ws);

    console.log(`✅ [HOT_HANDOFF] Atomic socket swap complete (mode=${mode}, session=${session.sessionId || 'anon'})`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        clientSocket.send(JSON.stringify({ type: 'hot_handoff_complete', mode }));
      } catch {}
    }
  }

  private cleanupStandby(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.drainWaitTimer) {
      clearTimeout(this.drainWaitTimer);
      this.drainWaitTimer = null;
    }
    if (this.standbySocket) {
      try {
        this.standbySocket.removeAllListeners();
        if (this.standbySocket.readyState === WebSocket.OPEN || this.standbySocket.readyState === WebSocket.CONNECTING) {
          this.standbySocket.terminate();
        }
      } catch {}
      this.standbySocket = null;
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.inProgress = false;
    this.cleanupStandby();
  }
}
