import { InterviewConfig, StrictnessLevel, StudyModality, TurnMode, UserGender } from '../types/interviewConfig';
import { VOICE_DEFAULTS } from '../config/voiceDefaults';

export const VOICE_CONFIG_STORAGE_KEY = 'interview_voice_config_v2';
export const LEGACY_VOICE_KEYS = [
  'interview_prep_active_config_v1', 'interview_user_gender', 'interview_turn_mode',
  'interview_live_model', 'interview_live_model_explicit', 'interview_vad_pause_ms',
  'interview_silence_clarification', 'interview_always_show_preflight',
  'interview_study_modality', 'interview_strictness_level'
] as const;

export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface PersistedVoiceConfigState { config: InterviewConfig; explicitLiveModel: boolean; }

const NOOP_STORAGE: StoragePort = { getItem: () => null, setItem: () => {} };

export function getDefaultStoragePort(): StoragePort {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch { /* Restricted storage context */ }
  return NOOP_STORAGE;
}

export function buildDefaultInterviewConfig(overrides?: Partial<InterviewConfig>): InterviewConfig {
  return {
    strategy: 'adaptive_probing',
    voice: VOICE_DEFAULTS.voice,
    maxProbes: VOICE_DEFAULTS.maxProbes,
    persona: VOICE_DEFAULTS.persona,
    targetGrade: VOICE_DEFAULTS.targetGrade,
    userGender: VOICE_DEFAULTS.userGender,
    turnMode: VOICE_DEFAULTS.turnMode,
    liveModel: VOICE_DEFAULTS.liveModel,
    vadPauseMs: VOICE_DEFAULTS.vadPauseMs,
    enableSilenceClarification: VOICE_DEFAULTS.enableSilenceClarification,
    alwaysShowPreflight: false,
    studyModality: 'voice',
    strictness: VOICE_DEFAULTS.strictness,
    deepDive: VOICE_DEFAULTS.deepDive,
    liveCoaching: VOICE_DEFAULTS.liveCoaching,
    ...overrides
  };
}

function parseJsonObj(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch { return null; }
}

export function parseStoredVoiceConfig(
  raw: string | null,
  fallbackDefaults?: Partial<InterviewConfig>
): PersistedVoiceConfigState | null {
  const obj = parseJsonObj(raw);
  if (!obj) return null;
  const defaults = buildDefaultInterviewConfig(fallbackDefaults);
  const rawCfg = obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
    ? (obj.config as Partial<InterviewConfig>)
    : (obj as Partial<InterviewConfig>);
  const config: InterviewConfig = { ...defaults, ...rawCfg };
  const explicitLiveModel = typeof obj.explicitLiveModel === 'boolean'
    ? obj.explicitLiveModel
    : Boolean(config.liveModel && config.liveModel !== defaults.liveModel);
  return { config, explicitLiveModel };
}

const safeGet = (s: StoragePort, key: string): string | null => { try { return s.getItem(key); } catch { return null; } };
const pickEnum = <T extends string>(v: string | null, allowed: readonly T[], fb: T): T =>
  v && allowed.includes(v as T) ? (v as T) : fb;
const pickBool = (v: string | null, fb: boolean): boolean => (v !== null ? v === 'true' : fb);

function foldLegacyKeys(s: StoragePort, defaults: InterviewConfig): PersistedVoiceConfigState {
  const parsed = parseJsonObj(safeGet(s, 'interview_prep_active_config_v1')) as Partial<InterviewConfig> | null;
  const savedModel = safeGet(s, 'interview_live_model');
  const explicitRaw = safeGet(s, 'interview_live_model_explicit');
  const explicitLiveModel = explicitRaw === 'true'
    ? true : explicitRaw === 'false' ? false : Boolean(savedModel && savedModel !== VOICE_DEFAULTS.liveModel);
  const vadNum = Number(safeGet(s, 'interview_vad_pause_ms'));
  const vadFallback = Number.isFinite(vadNum) && vadNum > 0 ? vadNum : defaults.vadPauseMs!;
  const parsedVad = parsed?.vadPauseMs;
  return {
    explicitLiveModel,
    config: {
      ...defaults,
      ...(parsed || {}),
      userGender: parsed?.userGender || pickEnum<UserGender>(safeGet(s, 'interview_user_gender'), ['female', 'male', 'neutral'], defaults.userGender!),
      turnMode: parsed?.turnMode || pickEnum<TurnMode>(safeGet(s, 'interview_turn_mode'), ['manual', 'auto'], defaults.turnMode!),
      liveModel: explicitLiveModel ? (parsed?.liveModel || savedModel || defaults.liveModel) : defaults.liveModel,
      vadPauseMs: typeof parsedVad === 'number' && Number.isFinite(parsedVad) && parsedVad > 0 ? parsedVad : vadFallback,
      enableSilenceClarification: typeof parsed?.enableSilenceClarification === 'boolean'
        ? parsed.enableSilenceClarification : pickBool(safeGet(s, 'interview_silence_clarification'), defaults.enableSilenceClarification!),
      alwaysShowPreflight: typeof parsed?.alwaysShowPreflight === 'boolean'
        ? parsed.alwaysShowPreflight : pickBool(safeGet(s, 'interview_always_show_preflight'), defaults.alwaysShowPreflight!),
      studyModality: parsed?.studyModality || pickEnum<StudyModality>(safeGet(s, 'interview_study_modality'), ['voice', 'text'], defaults.studyModality!),
      strictness: parsed?.strictness || pickEnum<StrictnessLevel>(safeGet(s, 'interview_strictness_level'), ['learning', 'standard', 'hardcore'], defaults.strictness!)
    }
  };
}

export function writeVoiceConfigState(storage: StoragePort, state: PersistedVoiceConfigState): void {
  try { storage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify({ version: 2, ...state })); }
  catch (err) { console.error('[voiceConfigStorage] Failed to persist config:', err); }
}

export function readVoiceConfigState(
  storage: StoragePort = getDefaultStoragePort(),
  fallbackDefaults?: Partial<InterviewConfig>
): PersistedVoiceConfigState {
  const defaults = buildDefaultInterviewConfig(fallbackDefaults);
  try {
    const existing = parseStoredVoiceConfig(safeGet(storage, VOICE_CONFIG_STORAGE_KEY), defaults);
    if (existing) return existing;
    const hasAnyLegacy = LEGACY_VOICE_KEYS.some((key) => safeGet(storage, key) !== null);
    const migrated = foldLegacyKeys(storage, defaults);
    if (hasAnyLegacy) writeVoiceConfigState(storage, migrated);
    return migrated;
  } catch { return { config: defaults, explicitLiveModel: false }; }
}

export const migrateLegacyVoiceConfig = (storage: StoragePort, fallbackDefaults?: Partial<InterviewConfig>): InterviewConfig =>
  readVoiceConfigState(storage, fallbackDefaults).config;
