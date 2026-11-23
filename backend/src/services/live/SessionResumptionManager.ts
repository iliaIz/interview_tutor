/**
 * SessionResumptionManager.ts
 *
 * Manages native Gemini 3.8 Live session resumption tokens and lifecycle.
 * Ported faithfully from gemini_live_reference/packages/core/src/context/SessionResumptionManager.ts.
 * Prevents loss of context, prosody distortion, and quota explosion on reconnects.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

export interface SessionResumptionUpdate {
  newHandle?: string;
  resumable?: boolean;
}

export class SessionResumptionManager {
  private activeHandle: string | null = null;
  private lastUpdateTimestamp: number = 0;

  constructor(initialHandle?: string) {
    if (initialHandle) {
      this.activeHandle = initialHandle;
    }
  }

  /**
   * Processes incoming SessionResumptionUpdate frame from upstream.
   * Updates internal cryptographic token strictly when resumable === true.
   * Returns true if handle was successfully rotated, false otherwise.
   */
  public update(update: SessionResumptionUpdate): boolean {
    if (update && update.resumable && update.newHandle) {
      this.activeHandle = update.newHandle;
      this.lastUpdateTimestamp = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Retrieves the latest active resumption handle.
   */
  public getLatestHandle(): string | null {
    return this.activeHandle;
  }

  /**
   * Returns true if a valid resumption handle is currently cached.
   */
  public hasValidHandle(): boolean {
    return this.activeHandle !== null && this.activeHandle.length > 0;
  }

  /**
   * Returns the timestamp when the handle was last rotated.
   */
  public getLastUpdated(): number {
    return this.lastUpdateTimestamp;
  }

  /**
   * Clears the active handle (e.g. on clean session termination).
   */
  public clear(): void {
    this.activeHandle = null;
    this.lastUpdateTimestamp = 0;
  }
}
