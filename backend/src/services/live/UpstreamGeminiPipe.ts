/**
 * UpstreamGeminiPipe.ts
 * Manages the upstream WebSocket connection to LiteLLM / Gemini Live gateway.
 * Encapsulates connection lifecycle, dynamic setup construction, UTF-8 decoding,
 * Full-Jitter backoff reconnection, cross-key resumption fallback, and zero-zombie teardown.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { WebSocket, RawData } from 'ws';
import { toRawBuffer } from './liveSessionTypes';
import { isNonRetryableUpstreamError } from './liveStreamErrorDetector';
import { envConfig } from '../../config/env';

export interface UpstreamGeminiPipeOptions {
  upstreamWsUrl: string;
  setupMessage: any;
  getSetupMessage?: () => any;
  liveModel?: string;
  maxReconnectAttempts?: number;
  onOpen?: (socket: WebSocket) => void;
  onMessage?: (parsed: any, rawStr: string) => Promise<void> | void;
  onDisconnect?: (source: string, code?: number, reason?: Buffer, isNonRetryable?: boolean) => void;
  onReconnecting?: (attempt: number, maxAttempts: number, delayMs: number) => void;
  onResumptionRejectedBeforeSetup?: () => void;
  onError?: (err: Error) => void;
}

export class UpstreamGeminiPipe {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosed = false;
  private setupCompletedOnCurrentSocket = false;
  private lastSetupHadResumption = false;
  private lastUpstreamCloseMeta: { code?: number; reason?: string } | null = null;

  constructor(private readonly options: UpstreamGeminiPipeOptions) {}

  public connect(isInternalReconnect = false): WebSocket | null {
    if (this.isClosed) return null;

    if (this.socket) {
      this.detachAndCloseSocket(this.socket);
    }

    const { upstreamWsUrl, liveModel = envConfig.models.live } = this.options;
    const activeSetup = this.options.getSetupMessage
      ? this.options.getSetupMessage()
      : this.options.setupMessage;

    this.setupCompletedOnCurrentSocket = false;
    this.lastUpstreamCloseMeta = null;
    this.lastSetupHadResumption = Boolean(
      activeSetup?.setup?.sessionResumption?.handle || activeSetup?.setup?.sessionResumptionConfig?.handle
    );

    console.log(
      `⚡ ${isInternalReconnect ? 'Reconnecting' : 'Connecting'} UpstreamGeminiPipe (${upstreamWsUrl}, resumed=${this.lastSetupHadResumption})...`
    );

    const ws = new WebSocket(upstreamWsUrl);
    this.socket = ws;
    this.attachSocketListeners(ws, activeSetup, liveModel);

    return ws;
  }

  /**
   * Opens a standby socket cleanly for Make-Before-Break hot handoff without disturbing active socket.
   */
  public openStandbySocket(setupPayload: any): WebSocket {
    const ws = new WebSocket(this.options.upstreamWsUrl);
    ws.on('open', () => {
      try {
        ws.send(JSON.stringify(setupPayload));
      } catch (err: any) {
        console.error('Failed to send setup over standby hot-handoff socket:', err.message);
      }
    });
    return ws;
  }

  /**
   * Atomically adopts a pre-connected standby Socket B as primary upstream and closes old Socket A.
   */
  public adoptSocket(newWs: WebSocket): void {
    if (this.isClosed) {
      this.detachAndCloseSocket(newWs);
      return;
    }

    const oldSocket = this.socket;
    this.socket = newWs;
    this.setupCompletedOnCurrentSocket = true;
    this.reconnectAttempts = 0;
    this.lastUpstreamCloseMeta = null;

    newWs.removeAllListeners();
    this.bindActiveMessageAndLifecycleHandlers(newWs);

    if (this.options.onOpen) {
      this.options.onOpen(newWs);
    }

    if (oldSocket && oldSocket !== newWs) {
      this.detachAndCloseSocket(oldSocket, 1000, 'HotHandoffCompleted');
    }
  }

  public recordUpstreamMeta(code?: number, reason?: string): void {
    this.lastUpstreamCloseMeta = { code, reason };
  }

  public markSetupComplete(): void {
    this.setupCompletedOnCurrentSocket = true;
  }

  public send(payload: string | Record<string, any>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.socket.send(data);
      return true;
    } catch (err: any) {
      console.error('Failed to send message over UpstreamGeminiPipe:', err.message);
      return false;
    }
  }

  public getSocket(): WebSocket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  public resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  public close(code?: number, reason?: string): void {
    this.isClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.detachAndCloseSocket(this.socket, code, reason);
      this.socket = null;
    }
  }

  private attachSocketListeners(ws: WebSocket, activeSetup: any, liveModel: string): void {
    ws.on('open', () => {
      if (this.socket !== ws || this.isClosed) return;
      console.log(`✅ Connected UpstreamGeminiPipe (${liveModel}), sending setup frame...`);
      try {
        ws.send(JSON.stringify(activeSetup));
      } catch (err: any) {
        console.error('Failed to send setup message over upstream pipe:', err.message);
      }
      if (this.options.onOpen) {
        this.options.onOpen(ws);
      }
    });

    this.bindActiveMessageAndLifecycleHandlers(ws);
  }

  private bindActiveMessageAndLifecycleHandlers(ws: WebSocket): void {
    ws.on('close', (code, reason) => {
      if (this.socket !== ws) return;
      this.handleSocketClose('UpstreamPipeClose', code, reason);
    });

    ws.on('error', (err) => {
      if (this.socket !== ws) return;
      console.error('UpstreamGeminiPipe WS error:', err.message);
      if (this.options.onError) {
        this.options.onError(err);
      }
      this.handleSocketClose('UpstreamPipeError');
    });

    ws.on('message', async (data: RawData) => {
      if (this.socket !== ws || this.isClosed) return;
      const buffer = toRawBuffer(data);
      const str = buffer.toString('utf8');

      let parsed: any = null;
      try {
        parsed = JSON.parse(str);
      } catch {
        parsed = null;
      }

      if (parsed?.setupComplete) {
        this.setupCompletedOnCurrentSocket = true;
      }

      if (parsed?.type === 'upstream_closed') {
        this.recordUpstreamMeta(parsed.upstreamCode, parsed.upstreamReason);
        return;
      }

      if (parsed?.type === 'key_rotated') {
        console.warn(`🔁 Upstream rotated key [${parsed.previousKeyMask} -> ${parsed.activeKeyMask}]: clearing local stale resumption handle.`);
        this.options.onResumptionRejectedBeforeSetup?.();
        return;
      }

      if (this.options.onMessage) {
        await this.options.onMessage(parsed, str);
      }
    });
  }

  private detachAndCloseSocket(ws: WebSocket, code?: number, reason?: string): void {
    try {
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        if (code !== undefined) {
          ws.close(code, reason);
        } else {
          ws.close();
        }
      }
    } catch {}
  }

  private handleSocketClose(source: string, code?: number, reason?: Buffer): void {
    // Only suppress reconnect when pipe was explicitly closed by application/client teardown!
    if (this.isClosed) return;

    const effectiveCode =
      this.lastUpstreamCloseMeta?.code !== undefined ? this.lastUpstreamCloseMeta.code : code;
    const reasonStr =
      this.lastUpstreamCloseMeta?.reason || (reason ? reason.toString() : '');

    // If a resumed setup failed before setupComplete, immediately fall back without resumption handle
    if (!this.setupCompletedOnCurrentSocket && this.lastSetupHadResumption) {
      console.warn(
        `🔄 Upstream rejected resumption handle before setupComplete (code=${effectiveCode}, reason="${reasonStr}"). Falling back to clean replay reconnect.`
      );
      this.options.onResumptionRejectedBeforeSetup?.();
      this.scheduleReconnect(60);
      return;
    }

    const isNonRetryable = isNonRetryableUpstreamError(reasonStr, effectiveCode);
    const maxAttempts = this.options.maxReconnectAttempts ?? 3;

    if (isNonRetryable || this.reconnectAttempts >= maxAttempts) {
      if (this.options.onDisconnect) {
        this.options.onDisconnect(
          source,
          effectiveCode,
          reasonStr ? Buffer.from(reasonStr) : reason,
          isNonRetryable
        );
      }
      return;
    }

    this.reconnectAttempts += 1;
    const baseDelay = 1200 * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.floor(Math.random() * 800);
    const backoffDelay = Math.min(4500, Math.floor(baseDelay + jitter));

    console.log(
      `⏱️ Upstream hot reconnect scheduled: ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${maxAttempts}, code=${effectiveCode}, reason="${reasonStr.slice(0, 80)}")`
    );

    this.scheduleReconnect(backoffDelay, maxAttempts);
  }

  private scheduleReconnect(delayMs: number, maxAttempts: number = this.options.maxReconnectAttempts ?? 3): void {
    if (this.options.onReconnecting) {
      this.options.onReconnecting(this.reconnectAttempts, maxAttempts, delayMs);
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isClosed) {
        this.connect(true);
      }
    }, delayMs);
  }
}
