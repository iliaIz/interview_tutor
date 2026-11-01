/**
 * WatchdogManager.ts
 * Dedicated two-phase watchdog timer lifecycle manager (Invariant 2.8).
 * Phase 1: Informational nudge (5.0s standard / 8.0s thinking) emitting 'thinking_delay'.
 * Phase 2: Generation timeout (22.0s standard / 25.0s thinking) emitting 'dead_air_recovery'.
 */

export const WATCHDOG_SLA = {
  STANDARD_NUDGE_MS: 5000,
  THINKING_NUDGE_MS: 8000,
  STANDARD_TIMEOUT_MS: 22000,
  THINKING_TIMEOUT_MS: 25000,
} as const;

export interface WatchdogOptions {
  onNudge?: (elapsedMs?: number) => void;
  onTimeout?: (reason?: string) => void;
  standardNudgeMs?: number;
  thinkingNudgeMs?: number;
  standardTimeoutMs?: number;
  thinkingTimeoutMs?: number;
  deadAirTimeoutMs?: number;
}

export class WatchdogManager {
  private nudgeTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private currentTimeoutMs: number = WATCHDOG_SLA.STANDARD_TIMEOUT_MS;
  private readonly options: WatchdogOptions;

  constructor(options: WatchdogOptions = {}) {
    this.options = { ...options };
  }

  get onNudge() { return this.options.onNudge; }
  set onNudge(cb: ((elapsedMs?: number) => void) | undefined) { this.options.onNudge = cb; }

  get onTimeout() { return this.options.onTimeout; }
  set onTimeout(cb: ((reason?: string) => void) | undefined) { this.options.onTimeout = cb; }

  public arm(extendedThinkingOrMode: boolean | 'standard' | 'thinking' = false, customTimeoutMs?: number): void {
    this.disarmAll();
    const isExtended = typeof extendedThinkingOrMode === 'boolean'
      ? extendedThinkingOrMode
      : extendedThinkingOrMode === 'thinking';

    const nudgeDelay = isExtended
      ? (this.options.thinkingNudgeMs ?? WATCHDOG_SLA.THINKING_NUDGE_MS)
      : (this.options.standardNudgeMs ?? WATCHDOG_SLA.STANDARD_NUDGE_MS);

    const defaultTimeout = isExtended
      ? (this.options.thinkingTimeoutMs ?? WATCHDOG_SLA.THINKING_TIMEOUT_MS)
      : (this.options.standardTimeoutMs ?? WATCHDOG_SLA.STANDARD_TIMEOUT_MS);

    this.currentTimeoutMs = customTimeoutMs ?? this.options.deadAirTimeoutMs ?? defaultTimeout;

    this.nudgeTimer = setTimeout(() => {
      this.nudgeTimer = null;
      this.options.onNudge?.(nudgeDelay);
    }, nudgeDelay);

    this.timeoutTimer = setTimeout(() => {
      this.timeoutTimer = null;
      this.disarmAll();
      this.options.onTimeout?.('upstream_timeout');
    }, this.currentTimeoutMs);
  }

  public disarmAll(): void {
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.nudgeTimer = null;
    this.timeoutTimer = null;
  }

  public disarm(): void { this.disarmAll(); }

  public heartbeat(): void {
    if (!this.isArmed()) return;
    if (this.nudgeTimer) { clearTimeout(this.nudgeTimer); this.nudgeTimer = null; }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = setTimeout(() => {
        this.timeoutTimer = null;
        this.disarmAll();
        this.options.onTimeout?.('upstream_timeout');
      }, this.currentTimeoutMs);
    }
  }

  public isArmed(): boolean { return this.nudgeTimer !== null || this.timeoutTimer !== null; }
  public isNudgePending(): boolean { return this.nudgeTimer !== null; }
  public isTimeoutPending(): boolean { return this.timeoutTimer !== null; }
  public getActiveTimeoutMs(): number { return this.currentTimeoutMs; }

  public dispose(): void {
    this.disarmAll();
    this.options.onNudge = undefined;
    this.options.onTimeout = undefined;
  }
}
