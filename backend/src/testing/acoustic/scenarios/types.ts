/**
 * types.ts
 *
 * Types and interfaces for Auto-VAD Acoustic Scenarios.
 */

export interface ScenarioResult {
  scenarioName: string;
  engine: string;
  passed: boolean;
  durationMs: number;
  ttftMs?: number | null;
  ttfaMs?: number | null;
  interruptionLatencyMs?: number | null;
  failureReason?: string;
  details?: Record<string, any>;
}
