/**
 * UpstreamLiveChannel.ts — Deep WebSocket custody channel implementing UpstreamTransportPort (Spec 51 / #187).
 * Unifies upstream connection, Full-Jitter reconnects, GoAway Make-Before-Break rotation, & pipeline delegation.
 */

import { WebSocket, RawData } from 'ws';
import { toRawBuffer, UpstreamTransportPort } from './liveSessionTypes';
import { isNonRetryableUpstreamError } from './liveStreamErrorDetector';
import { LiveSessionBlueprintBuilder } from './LiveSessionBlueprintBuilder';
import { dispatchReconnectContextReplay } from './LiveGreetingReplay';
import { UpstreamChannelOptions, UpstreamMessagePipeline } from './UpstreamMessagePipeline';
import { envConfig } from '../../config/env';

export type { UpstreamChannelOptions };

export function parseGoAwayTimeLeftSeconds(timeLeft: unknown, fallbackSeconds = 60): number {
  if (typeof timeLeft === 'number' && Number.isFinite(timeLeft)) return Math.max(5, Math.round(timeLeft));
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

function wrapOneShotSocketPort(ws: WebSocket): UpstreamTransportPort {
  return {
    connect: () => {},
    sendUpstream: (p) => (ws.readyState === WebSocket.OPEN ? (ws.send(p), true) : false),
    isUpstreamOpen: () => ws.readyState === WebSocket.OPEN,
    reconnect: () => {},
    close: () => {}
  };
}

export class UpstreamLiveChannel implements UpstreamTransportPort {
  private socket: WebSocket | null = null;
  private standbySocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private drainWaitTimer: NodeJS.Timeout | null = null;
  private isClosed = false;
  private handoffInProgress = false;
  private setupCompletedOnCurrentSocket = false;
  private lastSetupHadResumption = false;
  private lastUpstreamCloseMeta: { code?: number; reason?: string } | null = null;
  private readonly maxReconnectAttempts = 3;
  private readonly pipeline: UpstreamMessagePipeline;

  constructor(private readonly options: UpstreamChannelOptions) {
    options.session.upstreamTransport = this;
    this.pipeline = new UpstreamMessagePipeline(options, this, {
      resetReconnectAttempts: () => { this.reconnectAttempts = 0; },
      flushFrameQueue: () => this.flushPendingFrames(),
      onGoAway: (goAway) => this.handleGoAway(goAway)
    });
  }

  public connect(isInternalReconnect = false): void {
    if (this.isClosed) return;
    if (this.socket) this.detachAndCloseSocket(this.socket);

    const upstreamWsUrl = this.options.upstreamWsUrl || '';
    const liveModel = this.options.liveModel || this.options.session.liveModel || envConfig.models.live;
    const activeSetup = LiveSessionBlueprintBuilder.buildDynamicSetupMessage(
      this.options.setupMessage || {},
      this.options.session.resumptionHandle
    );

    this.setupCompletedOnCurrentSocket = false;
    this.lastUpstreamCloseMeta = null;
    this.lastSetupHadResumption = Boolean(
      (activeSetup as any)?.setup?.sessionResumption?.handle ||
      (activeSetup as any)?.setup?.sessionResumptionConfig?.handle
    );

    console.log(
      `⚡ ${isInternalReconnect ? 'Reconnecting' : 'Connecting'} UpstreamLiveChannel (${upstreamWsUrl}, resumed=${this.lastSetupHadResumption})...`
    );

    const ws = new WebSocket(upstreamWsUrl);
    this.socket = ws;
    ws.on('open', () => {
      if (this.socket !== ws || this.isClosed) return;
      console.log(`✅ Connected UpstreamLiveChannel (${liveModel}), sending setup frame...`);
      try { ws.send(JSON.stringify(activeSetup)); } catch (err: any) {
        console.error('Failed to send setup message over UpstreamLiveChannel:', err.message);
      }
    });
    this.bindSocketHandlers(ws);
  }

  public sendUpstream(payload: string | Buffer): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(payload);
      return true;
    } catch (err: any) {
      console.error('Failed to send frame over UpstreamLiveChannel:', err.message);
      return false;
    }
  }

  public isUpstreamOpen(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  public isHandoffActive(): boolean {
    return this.handoffInProgress;
  }

  public reconnect(_reason?: string): void {
    this.options.session.isUpstreamReconnecting = true;
    this.options.session.isSetupComplete = false;
    this.connect(true);
  }

  public close(code?: number, reason?: string): void {
    this.isClosed = true;
    this.handoffInProgress = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.cleanupStandby();
    if (this.socket) { this.detachAndCloseSocket(this.socket, code, reason); this.socket = null; }
  }

  private flushPendingFrames(): void {
    const queue = this.options.session.frameQueue;
    while (queue.length > 0 && this.isUpstreamOpen()) {
      const frame = queue.shift();
      if (frame) this.sendUpstream(frame);
    }
  }

  private bindSocketHandlers(ws: WebSocket): void {
    ws.on('close', (code, reason) => {
      if (this.socket === ws) this.handleSocketClose('UpstreamChannelClose', code, reason);
    });
    ws.on('error', (err) => {
      if (this.socket !== ws) return;
      console.error('UpstreamLiveChannel WS error:', err.message);
      this.handleSocketClose('UpstreamChannelError');
    });
    ws.on('message', async (data: RawData) => {
      if (this.socket !== ws || this.isClosed) return;
      const str = toRawBuffer(data).toString('utf8');
      let parsed: any = null;
      try { parsed = JSON.parse(str); } catch { parsed = null; }

      if (parsed?.setupComplete) this.setupCompletedOnCurrentSocket = true;
      if (parsed?.type === 'upstream_closed') {
        this.lastUpstreamCloseMeta = { code: parsed.upstreamCode, reason: parsed.upstreamReason };
        return;
      }
      if (parsed?.type === 'key_rotated') {
        console.warn(`🔁 Upstream rotated key [${parsed.previousKeyMask} -> ${parsed.activeKeyMask}]: clearing local stale resumption handle.`);
        this.clearResumptionState();
        return;
      }
      await this.pipeline.handleMessage(parsed, str);
    });
  }

  private clearResumptionState(): void {
    this.options.session.resumptionHandle = undefined;
    this.options.session.resumptionManager?.clear();
  }

  private handleSocketClose(source: string, code?: number, reason?: Buffer): void {
    if (this.isClosed) return;
    const effectiveCode = this.lastUpstreamCloseMeta?.code !== undefined ? this.lastUpstreamCloseMeta.code : code;
    const reasonStr = this.lastUpstreamCloseMeta?.reason || (reason ? reason.toString() : '');

    if (!this.setupCompletedOnCurrentSocket && this.lastSetupHadResumption) {
      console.warn(`🔄 Upstream rejected resumption handle before setupComplete (code=${effectiveCode}, reason="${reasonStr}"). Falling back to clean replay reconnect.`);
      this.clearResumptionState();
      this.scheduleReconnect(60);
      return;
    }

    const isNonRetryable = isNonRetryableUpstreamError(reasonStr, effectiveCode);
    if (isNonRetryable || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.pipeline.handleDisconnect(source, effectiveCode, reasonStr ? Buffer.from(reasonStr) : reason, isNonRetryable);
      return;
    }
    this.reconnectAttempts += 1;
    const backoffDelay = Math.min(4500, Math.floor(1200 * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 800));
    console.log(`⏱️ Upstream hot reconnect scheduled: ${backoffDelay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts}, code=${effectiveCode})`);
    this.scheduleReconnect(backoffDelay);
  }

  private scheduleReconnect(delayMs: number): void {
    this.pipeline.handleReconnecting(this.reconnectAttempts, this.maxReconnectAttempts);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => { if (!this.isClosed) this.connect(true); }, delayMs);
  }

  private handleGoAway(goAwayPayload: any): void {
    const { session, clientSocket } = this.options;
    if (this.isClosed || this.handoffInProgress || session.isTerminated || !session.isSetupComplete) return;
    const timeLeftSeconds = parseGoAwayTimeLeftSeconds(goAwayPayload?.timeLeft, 60);
    this.handoffInProgress = true;
    console.log(`⏳ [HOT_HANDOFF] Upstream GoAway received (timeLeft=${timeLeftSeconds}s, session=${session.sessionId || 'anon'}). Initiating Make-Before-Break handoff...`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      try { clientSocket.send(JSON.stringify({ type: 'hot_handoff_started', timeLeftSeconds })); } catch {}
    }
    this.startStandbyAttempt(session.resumptionHandle, timeLeftSeconds, false);
  }

  private startStandbyAttempt(resumptionHandle: string | undefined, timeLeftSeconds: number, isFallbackReplay: boolean): void {
    if (this.isClosed || this.options.session.isTerminated) { this.handoffInProgress = false; return; }
    this.cleanupStandby();
    const setupPayload = LiveSessionBlueprintBuilder.buildDynamicSetupMessage(this.options.setupMessage || {}, resumptionHandle);
    const ws = new WebSocket(this.options.upstreamWsUrl || '');
    this.standbySocket = ws;
    let setupCompleteReceived = false;
    let rotatedDuringSetup = false;

    ws.on('open', () => {
      try { ws.send(JSON.stringify(setupPayload)); } catch (err: any) {
        console.error('Failed to send setup over standby hot-handoff socket:', err.message);
      }
    });
    this.connectTimer = setTimeout(() => {
      if (!setupCompleteReceived && this.standbySocket === ws) {
        console.warn('⏱️ [HOT_HANDOFF] Standby socket setup timed out before setupComplete.');
        this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay);
      }
    }, 8000);

    ws.on('message', (raw: RawData) => {
      if (this.isClosed || this.standbySocket !== ws) return;
      let parsed: any = null;
      try { parsed = JSON.parse(toRawBuffer(raw).toString('utf8')); } catch { return; }
      if (parsed?.type === 'key_rotated') { rotatedDuringSetup = true; this.clearResumptionState(); return; }
      if (parsed?.setupComplete && !setupCompleteReceived) {
        setupCompleteReceived = true;
        if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
        const usedNativeResumption = Boolean(resumptionHandle && !rotatedDuringSetup && !isFallbackReplay);
        if (!usedNativeResumption) {
          dispatchReconnectContextReplay(this.options.session, wrapOneShotSocketPort(ws), {
            bugTitle: this.options.bugTitle,
            questionText: this.options.questionText,
            topic: this.options.topic
          });
        }
        this.scheduleAdoption(ws, timeLeftSeconds, usedNativeResumption ? 'resumption' : 'replay');
      }
    });

    ws.on('close', () => { if (!setupCompleteReceived && this.standbySocket === ws) this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay); });
    ws.on('error', () => { if (!setupCompleteReceived && this.standbySocket === ws) this.handleStandbyFailure(ws, resumptionHandle, timeLeftSeconds, isFallbackReplay); });
  }

  private handleStandbyFailure(failedWs: WebSocket, resumptionHandle: string | undefined, timeLeftSeconds: number, isFallbackReplay: boolean): void {
    if (this.standbySocket !== failedWs) return;
    this.cleanupStandby();
    if (!isFallbackReplay && resumptionHandle) {
      console.warn('🔄 [HOT_HANDOFF] Standby resumption rejected; retrying clean replay handoff across key pool...');
      this.clearResumptionState();
      this.startStandbyAttempt(undefined, timeLeftSeconds, true);
      return;
    }
    console.warn('⚠️ [HOT_HANDOFF] Standby handoff failed; deferring recovery to primary reconnect.');
    this.handoffInProgress = false;
  }

  private scheduleAdoption(ws: WebSocket, timeLeftSeconds: number, mode: 'resumption' | 'replay'): void {
    const { session } = this.options;
    const isBusy = () => Boolean(session.isAiGenerating || session.awaitingToolSpeech);
    if (!isBusy()) { this.completeAdoption(ws, mode); return; }

    const maxWaitMs = Math.max(1500, Math.min(15000, (timeLeftSeconds - 8) * 1000));
    const startedAt = Date.now();
    const checkReady = () => {
      if (this.isClosed || session.isTerminated || this.standbySocket !== ws) return;
      if (!isBusy() || Date.now() - startedAt >= maxWaitMs) { this.completeAdoption(ws, mode); return; }
      this.drainWaitTimer = setTimeout(checkReady, 120);
    };
    this.drainWaitTimer = setTimeout(checkReady, 120);
  }

  private completeAdoption(ws: WebSocket, mode: 'resumption' | 'replay'): void {
    const { session, clientSocket } = this.options;
    if (this.drainWaitTimer) { clearTimeout(this.drainWaitTimer); this.drainWaitTimer = null; }
    if (this.isClosed || session.isTerminated || ws.readyState !== WebSocket.OPEN) {
      this.cleanupStandby();
      this.handoffInProgress = false;
      return;
    }

    const oldSocket = this.socket;
    this.standbySocket = null;
    this.handoffInProgress = false;
    this.socket = ws;
    this.setupCompletedOnCurrentSocket = true;
    this.reconnectAttempts = 0;
    this.lastUpstreamCloseMeta = null;
    ws.removeAllListeners();
    this.bindSocketHandlers(ws);
    if (oldSocket && oldSocket !== ws) this.detachAndCloseSocket(oldSocket, 1000, 'HotHandoffCompleted');

    session.isSetupComplete = true;
    session.isUpstreamReconnecting = false;
    session.reconnectAttempts = 0;
    this.flushPendingFrames();

    console.log(`✅ [HOT_HANDOFF] Atomic socket swap complete (mode=${mode}, session=${session.sessionId || 'anon'})`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      try { clientSocket.send(JSON.stringify({ type: 'hot_handoff_complete', mode })); } catch {}
    }
  }

  private cleanupStandby(): void {
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    if (this.drainWaitTimer) { clearTimeout(this.drainWaitTimer); this.drainWaitTimer = null; }
    if (this.standbySocket) {
      this.detachAndCloseSocket(this.standbySocket, undefined, undefined, true);
      this.standbySocket = null;
    }
  }

  private detachAndCloseSocket(ws: WebSocket, code?: number, reason?: string, forceTerminate = false): void {
    try {
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        if (forceTerminate) ws.terminate();
        else if (code !== undefined) ws.close(code, reason);
        else ws.close();
      }
    } catch {}
  }
}

export function createUpstreamLiveChannel(options: UpstreamChannelOptions): UpstreamTransportPort {
  return new UpstreamLiveChannel(options);
}
