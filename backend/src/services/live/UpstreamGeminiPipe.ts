/**
 * UpstreamGeminiPipe.ts
 * Manages the upstream WebSocket connection to LiteLLM / Gemini Live gateway.
 * Encapsulates connection lifecycle, Full-Jitter backoff reconnection, UTF-8 decoding,
 * and error classification (retryable vs terminal).
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { WebSocket, RawData } from 'ws';
import { toRawBuffer } from './liveSessionTypes';
import { isNonRetryableUpstreamError } from './liveStreamErrorDetector';

export interface UpstreamGeminiPipeOptions {
  upstreamWsUrl: string;
  setupMessage: any;
  liveModel?: string;
  maxReconnectAttempts?: number;
  onOpen?: (socket: WebSocket) => void;
  onMessage?: (parsed: any, rawStr: string) => Promise<void> | void;
  onDisconnect?: (source: string, code?: number, reason?: Buffer, isNonRetryable?: boolean) => void;
  onReconnecting?: (attempt: number, maxAttempts: number, delayMs: number) => void;
  onError?: (err: Error) => void;
}

export class UpstreamGeminiPipe {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(private readonly options: UpstreamGeminiPipeOptions) {}

  public connect(isInternalReconnect = false): WebSocket | null {
    if (this.isClosed) return null;

    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
        }
      } catch {}
    }

    const { upstreamWsUrl, setupMessage, liveModel = 'gemini-live-v3' } = this.options;
    console.log(`⚡ ${isInternalReconnect ? 'Reconnecting' : 'Connecting'} UpstreamGeminiPipe (${upstreamWsUrl})...`);

    const ws = new WebSocket(upstreamWsUrl);
    this.socket = ws;

    ws.on('open', () => {
      console.log(`✅ Connected UpstreamGeminiPipe (${liveModel}), sending setup frame...`);
      try {
        ws.send(JSON.stringify(setupMessage));
      } catch (err: any) {
        console.error('Failed to send setup message over upstream pipe:', err.message);
      }
      if (this.options.onOpen) {
        this.options.onOpen(ws);
      }
    });

    ws.on('close', (code, reason) => {
      this.handleSocketClose('UpstreamPipeClose', code, reason);
    });

    ws.on('error', (err) => {
      console.error('UpstreamGeminiPipe WS error:', err.message);
      if (this.options.onError) {
        this.options.onError(err);
      }
      this.handleSocketClose('UpstreamPipeError');
    });

    ws.on('message', async (data: RawData) => {
      if (this.isClosed) return;
      const buffer = toRawBuffer(data);
      const str = buffer.toString('utf8');

      let parsed: any = null;
      try {
        parsed = JSON.parse(str);
      } catch {
        parsed = null;
      }

      if (this.options.onMessage) {
        await this.options.onMessage(parsed, str);
      }
    });

    return ws;
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
      try {
        this.socket.removeAllListeners();
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(code, reason);
        }
      } catch {}
      this.socket = null;
    }
  }

  private handleSocketClose(source: string, code?: number, reason?: Buffer): void {
    if (this.isClosed || code === 1000 || code === 1001) return;

    const reasonStr = reason ? reason.toString() : '';
    const isNonRetryable = isNonRetryableUpstreamError(reasonStr, code);
    const maxAttempts = this.options.maxReconnectAttempts ?? 3;

    if (isNonRetryable || this.reconnectAttempts >= maxAttempts) {
      if (this.options.onDisconnect) {
        this.options.onDisconnect(source, code, reason, isNonRetryable);
      }
      return;
    }

    this.reconnectAttempts += 1;
    const baseDelay = 1200 * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.floor(Math.random() * 800);
    const backoffDelay = Math.min(4500, Math.floor(baseDelay + jitter));

    console.log(`⏱️ Upstream hot reconnect scheduled: ${backoffDelay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);

    if (this.options.onReconnecting) {
      this.options.onReconnecting(this.reconnectAttempts, maxAttempts, backoffDelay);
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isClosed) {
        this.connect(true);
      }
    }, backoffDelay);
  }
}
