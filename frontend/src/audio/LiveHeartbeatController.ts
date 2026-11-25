/**
 * LiveHeartbeatController.ts
 * Symmetrical WebSocket Ping/Pong keepalive controller (SOTA Late 2026).
 * Single responsibility: ping/pong cadence & proxy idle protection (< 60 lines).
 */

import { LiveTransportConnection } from './types';

export class LiveHeartbeatController {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private getConnection: () => LiveTransportConnection | null) {}

  public start(): void {
    this.stop();
    this.interval = setInterval(() => {
      const conn = this.getConnection();
      if (conn && conn.isOpen()) {
        try {
          conn.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {}
      }
    }, 20000);
    const timerHandle: unknown = this.interval;
    if (timerHandle && typeof (timerHandle as { unref?: () => void }).unref === 'function') {
      (timerHandle as { unref: () => void }).unref();
    }
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public handleIncomingPing(sentTimestamp?: number): void {
    const conn = this.getConnection();
    if (conn && conn.isOpen()) {
      try {
        conn.send(JSON.stringify({ type: 'pong', timestamp: sentTimestamp || Date.now() }));
      } catch {}
    }
  }
}
