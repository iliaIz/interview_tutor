/**
 * IdeBridgeConnection.ts
 * Headless Loopback IDE Companion Service (SOTA Late 2026).
 * Encapsulates WebSocket transport, 15s heartbeats, reconnect backoff, and port multiplexing.
 * Eliminates duplicate transport logic and unifies cross-arena companion synchronization.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

export type IdeBridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing';

export interface IdeBridgeMessage {
  type: string;
  origin?: 'ide' | 'web';
  path?: string;
  content?: string;
  challengeId?: string;
  workspaceDir?: string;
  timestamp?: number;
}

export interface IdeBridgeConnectionOptions {
  port: number;
  channel: 'task' | 'whiteboard';
  onFileUpdated: (filePath: string, content: string) => void;
  onStatusChange?: (status: IdeBridgeStatus) => void;
  onWorkspaceDirChange?: (dir: string | null) => void;
}

export class IdeBridgeConnection {
  private socket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentStatus: IdeBridgeStatus = 'disconnected';
  private workspaceDir: string | null = null;
  private isDisposed = false;

  private readonly port: number;
  private readonly channel: 'task' | 'whiteboard';
  private readonly onFileUpdated: (filePath: string, content: string) => void;
  private readonly onStatusChange?: (status: IdeBridgeStatus) => void;
  private readonly onWorkspaceDirChange?: (dir: string | null) => void;

  constructor(options: IdeBridgeConnectionOptions) {
    this.port = options.port;
    this.channel = options.channel;
    this.onFileUpdated = options.onFileUpdated;
    this.onStatusChange = options.onStatusChange;
    this.onWorkspaceDirChange = options.onWorkspaceDirChange;
  }

  public get status(): IdeBridgeStatus {
    return this.currentStatus;
  }

  public get currentWorkspaceDir(): string | null {
    return this.workspaceDir;
  }

  private setStatus(status: IdeBridgeStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.onStatusChange?.(status);
  }

  public connect(): void {
    if (this.isDisposed) return;
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const url = `ws://127.0.0.1:${this.port}`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        if (this.isDisposed) return;
        this.setStatus('connected');

        // Request initial handshake & workspace info
        this.socket?.send(
          JSON.stringify({
            type: 'handshake',
            origin: 'web',
            channel: this.channel,
            timestamp: Date.now()
          })
        );

        // Start 15s heartbeat
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(
              JSON.stringify({
                type: 'ping',
                origin: 'web',
                timestamp: Date.now()
              })
            );
          }
        }, 15_000);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        if (this.isDisposed) return;
        try {
          const msg: IdeBridgeMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (err) {
          console.warn(`[IdeBridge:${this.port}] Failed to parse message:`, err);
        }
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        if (!this.isDisposed) {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };
    } catch {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(msg: IdeBridgeMessage): void {
    const msgType = (msg.type || '').toUpperCase();

    if (msgType === 'HANDSHAKE_ACK' || msgType === 'WORKSPACE_INFO') {
      if (msg.workspaceDir) {
        this.workspaceDir = msg.workspaceDir;
        this.onWorkspaceDirChange?.(msg.workspaceDir);
      }
      return;
    }

    if (msgType === 'FILE_UPDATED' || msgType === 'FILE_SYNC' || msgType === 'FILE_UPDATE') {
      if (msg.path && typeof msg.content === 'string') {
        this.setStatus('syncing');
        this.onFileUpdated(msg.path, msg.content);
        setTimeout(() => {
          if (!this.isDisposed && this.currentStatus === 'syncing') {
            this.setStatus('connected');
          }
        }, 600);
      }
      return;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDisposed || this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 4_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public sendFileUpdate(filePath: string, content: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'file_sync',
          origin: 'web',
          path: filePath,
          content,
          timestamp: Date.now()
        })
      );
    }
  }

  public disconnect(): void {
    this.isDisposed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Helper to dispatch workspace file update event for live voice engine grounding.
   */
  public static notifyWorkspaceFileUpdated(detail: { path: string; content: string; language?: string }): void {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('workspace_file_updated', { detail }));
      } catch {}
    }
  }
}
