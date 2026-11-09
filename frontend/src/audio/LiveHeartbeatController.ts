/**
 * LiveHeartbeatController.ts
 * Symmetrical WebSocket Ping/Pong keepalive controller (SOTA Late 2026).
 * Single responsibility: ping/pong cadence & proxy idle protection (< 60 lines).
 */

export class LiveHeartbeatController {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private getWs: () => WebSocket | null) {}

  public start(): void {
    this.stop();
    this.interval = setInterval(() => {
      const ws = this.getWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {}
      }
    }, 20000);
    if (this.interval && typeof (this.interval as any).unref === 'function') {
      (this.interval as any).unref();
    }
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public handleIncomingPing(sentTimestamp?: number): void {
    const ws = this.getWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'pong', timestamp: sentTimestamp || Date.now() }));
      } catch {}
    }
  }
}
