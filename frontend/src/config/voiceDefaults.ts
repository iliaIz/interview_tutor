/**
 * voiceDefaults.ts
 * Frontend Single Source of Truth (SSOT) for default voice configuration,
 * dynamic backend /api/config runtime discovery types, and shared model/VAD presentation metadata.
 * Cognitive Bounding Limit: <= 150 lines (Rule 8).
 */

import { GeminiVoiceName, TurnMode } from '../types/interviewConfig';

export interface RuntimeVoiceConfig {
  models: {
    defaultLiveModel: string;
    defaultLivePreviewModel?: string;
    defaultLiveThinkingModel?: string;
    defaultTtsModel?: string;
    defaultTextModel?: string;
    defaultFastModel?: string;
    defaultEmbeddingModel?: string;
    supportedLiveModels: string[];
  };
  defaults?: {
    voice?: GeminiVoiceName | string;
    turnMode?: TurnMode;
    vadPauseMs?: number;
    enableSilenceClarification?: boolean;
  };
  vad?: {
    minMs: number;
    maxMs: number;
    presetsMs: number[];
  };
  voices?: string[];
  livekit?: {
    url?: string;
  };
}

export const VOICE_DEFAULTS = {
  voice: 'Kore' as GeminiVoiceName,
  secondaryVoice: 'Puck' as GeminiVoiceName,
  userGender: 'female' as const,
  turnMode: 'manual' as TurnMode,
  liveModel: 'gemini-live-v3',
  supportedLiveModels: ['gemini-live-v3', 'gemini-live-v2', 'gemini-live-thinking-v3'] as const,
  vadPauseMs: 1800,
  minVadPauseMs: 500,
  maxVadPauseMs: 2500,
  vadPresetsMs: [800, 1200, 1500, 1800, 2400] as const,
  enableSilenceClarification: false,
  persona: 'mentor' as const,
  targetGrade: 'L5_SENIOR' as const,
  strategy: 'socratic_tutoring' as const,
  strictness: 'standard' as const,
  maxProbes: 3,
  deepDive: true,
  liveCoaching: false,
};

export interface LiveModelUiMeta {
  id: string;
  label: string;
  shortBadge: string;
  description: string;
  icon: string;
}

const KNOWN_MODEL_META: Record<string, Omit<LiveModelUiMeta, 'id'>> = {
  'gemini-live-v3': {
    label: 'Gemini Live V3',
    shortBadge: 'По умолчанию',
    description: 'Сбалансированный двусторонний голосовой движок',
    icon: '🟣',
  },
  'gemini-live-v2': {
    label: 'Gemini Live V2',
    shortBadge: 'Резерв / 2.5',
    description: 'Стабильный голосовой поток на базе Gemini Live 2.5',
    icon: '🟢',
  },
  'gemini-live-thinking-v3': {
    label: 'Live Thinking V3',
    shortBadge: 'CoT Reasoning',
    description: 'Глубокий анализ со скрытыми рассуждениями (Extended Thinking)',
    icon: '🧠',
  },
};

export function getLiveModelUiMeta(modelId: string, defaultModelId?: string): LiveModelUiMeta {
  const known = KNOWN_MODEL_META[modelId];
  if (known) {
    return {
      id: modelId,
      ...known,
      shortBadge: defaultModelId && modelId === defaultModelId ? 'Основной' : known.shortBadge,
    };
  }
  return {
    id: modelId,
    label: modelId,
    shortBadge: defaultModelId && modelId === defaultModelId ? 'Основной' : 'Proxy Alias',
    description: `Удалённый голосовой движок (${modelId})`,
    icon: '⚡',
  };
}

export interface VadPresetOption {
  ms: number;
  label: string;
  desc: string;
}

const VAD_PRESET_DESCRIPTIONS: Record<number, string> = {
  800: 'Мгновенно (блиц)',
  1200: 'Быстро (без раздумий)',
  1500: 'Комфорт (сбалансированно)',
  1800: 'Оптимум (рекомендуется)',
  2400: 'Вдумчиво (сложный код)',
};

export function getVadPresetOptions(presetsMs?: readonly number[]): VadPresetOption[] {
  const list = presetsMs && presetsMs.length > 0 ? presetsMs : VOICE_DEFAULTS.vadPresetsMs;
  return list.map((ms) => ({
    ms,
    label: `${(ms / 1000).toFixed(1)} сек`,
    desc: VAD_PRESET_DESCRIPTIONS[ms] || `${ms} мс`,
  }));
}
