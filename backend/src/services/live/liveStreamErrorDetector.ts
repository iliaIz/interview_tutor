/**
 * liveStreamErrorDetector.ts
 * Upstream Live WebSocket Error Detection & Canned Acoustic Circuit Breaker.
 * SOTA Late September 2026.
 * Bounded cognitive size: <= 50 lines.
 */

export function isNonRetryableUpstreamError(text?: string, code?: number): boolean {
  if (code === 1008 || code === 4001 || code === 4003 || code === 4403) return true;
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('forbidden') ||
    lower.includes('invalid or blocked virtual key') ||
    lower.includes('unauthorized') ||
    lower.includes('not allowed') ||
    lower.includes('no active models or api keys') ||
    lower.includes('thinking level must be specified')
  );
}

export const CANNED_ERROR_PATTERNS = [
  /произошла\s+системная\s+ошибка/i,
  /internal\s+error\s+occurred/i,
  /system\s+error\s+occurred/i,
  /повторите\s+попытку\s+позже/i,
  /an\s+error\s+occurred/i,
  /\[system error\]/i,
  /internal server error/i,
  /upstream error/i
];

export function isCannedErrorUtterance(text?: string): boolean {
  if (!text) return false;
  return CANNED_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}
