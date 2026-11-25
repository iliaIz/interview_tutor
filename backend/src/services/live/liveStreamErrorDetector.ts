/**
 * liveStreamErrorDetector.ts
 * Upstream Live WebSocket Error Detection & Canned Acoustic Circuit Breaker.
 * SOTA Late September 2026.
 * Bounded cognitive size: <= 50 lines.
 */

export function isNonRetryableUpstreamError(text?: string, code?: number): boolean {
  if (code === 4001 || code === 4003 || code === 4403 || code === 4401) return true;
  const lower = (text || '').toLowerCase();

  if (
    lower.includes('forbidden') ||
    lower.includes('invalid or blocked virtual key') ||
    lower.includes('unauthorized') ||
    lower.includes('not allowed') ||
    lower.includes('no active models or api keys') ||
    lower.includes('thinking level must be specified')
  ) {
    return true;
  }

  if (code === 1008) {
    const isResumableLifecycle =
      !lower ||
      lower.includes('goaway') ||
      lower.includes('session durat') ||
      lower.includes('inactivity') ||
      lower.includes('expired') ||
      lower.includes('resum') ||
      lower.includes('try again');
    if (isResumableLifecycle) return false;
    return (
      lower.includes('invalid argument') ||
      lower.includes('permission') ||
      lower.includes('api key') ||
      lower.includes('unsupported')
    );
  }

  return false;
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

export const NON_SPEECH_PATTERNS = [
  /^<no\s*speech>$/i,
  /^<no\s*speech>\s*\{pause\}$/i,
  /^\[no\s*speech\]$/i,
  /^<pause>$/i
];

export function isNonSpeechUtterance(text?: string, audioBytes?: number): boolean {
  if (!text) return false;
  // If model produced substantial audio (>= 1200 bytes / ~250ms), it is genuine speech
  if (audioBytes !== undefined && audioBytes >= 1200) {
    return false;
  }
  const trimmed = text.trim();
  if (NON_SPEECH_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (audioBytes !== undefined && audioBytes < 200) {
    if (trimmed === '<no speech>' || trimmed.startsWith('<no speech>') || trimmed === '{pause}') {
      return true;
    }
  }
  return false;
}

export function isCannedErrorUtterance(text?: string, audioBytes?: number): boolean {
  if (!text) return false;
  return CANNED_ERROR_PATTERNS.some((pattern) => pattern.test(text)) || isNonSpeechUtterance(text, audioBytes);
}

