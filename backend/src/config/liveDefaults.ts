/**
 * liveDefaults.ts
 * Backend Single Source of Truth (SSOT) for voice, turn mode, and Auto-VAD defaults/clamping.
 * Cognitive Bounding Limit: <= 100 lines (Rule 8).
 */

export const VALID_VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'] as const;
export type ValidVoiceName = typeof VALID_VOICES[number];

export const DEFAULT_VOICE_NAME: ValidVoiceName = VALID_VOICES.includes(
  process.env.GEMINI_DEFAULT_VOICE as ValidVoiceName
)
  ? (process.env.GEMINI_DEFAULT_VOICE as ValidVoiceName)
  : 'Kore';

export const DEFAULT_SECONDARY_VOICE_NAME: ValidVoiceName = 'Puck';

export const DEFAULT_TURN_MODE: 'auto' | 'manual' =
  process.env.DEFAULT_LIVE_TURN_MODE === 'manual' ? 'manual' : 'auto';

export const MIN_VAD_SILENCE_MS = 500;
export const MAX_VAD_SILENCE_MS = 2500;
export const DEFAULT_VAD_PAUSE_MS = 1800;
export const VAD_PAUSE_PRESETS_MS = [800, 1200, 1500, 1800, 2400] as const;

/**
 * Validates any raw voice string against known Gemini Live voice personas.
 */
export function sanitizeVoiceName(
  voice: unknown,
  fallback: string = DEFAULT_VOICE_NAME
): string {
  if (typeof voice === 'string' && VALID_VOICES.includes(voice as ValidVoiceName)) {
    return voice;
  }
  return VALID_VOICES.includes(fallback as ValidVoiceName) ? fallback : DEFAULT_VOICE_NAME;
}

/**
 * Clamps candidate VAD silence threshold into safe Gemini Cloud VAD boundaries [500, 2500] ms.
 */
export function clampVadPauseMs(
  rawValue: unknown,
  fallback: number = DEFAULT_VAD_PAUSE_MS
): number {
  const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  const candidate = Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  return Math.max(MIN_VAD_SILENCE_MS, Math.min(MAX_VAD_SILENCE_MS, Math.round(candidate)));
}
