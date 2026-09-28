/**
 * wakeLockManager.ts
 * Manages screen wake lock to prevent mobile displays from sleeping during live voice sessions.
 * Cognitive bounding limit: <= 40 lines.
 */

export class WakeLockManager {
  private wakeLock: any = null;

  public async acquire(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  }

  public release(): void {
    try {
      this.wakeLock?.release();
    } catch {}
    this.wakeLock = null;
  }
}
