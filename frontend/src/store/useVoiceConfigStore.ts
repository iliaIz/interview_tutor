/**
 * useVoiceConfigStore.ts
 * Consolidated Zustand store for voice configuration, runtime /api/config discovery,
 * and cross-tab storage synchronization (Spec 59 <= 230L).
 */

import { create } from 'zustand';
import { InterviewConfig, InterviewProfile } from '../types/interviewConfig';
import { RuntimeVoiceConfig } from '../config/voiceDefaults';
import { BUILT_IN_PROFILES, getCachedProfiles } from '../services/profileStorage';
import {
  VOICE_CONFIG_STORAGE_KEY,
  StoragePort,
  buildDefaultInterviewConfig,
  getDefaultStoragePort,
  parseStoredVoiceConfig,
  readVoiceConfigState,
  writeVoiceConfigState
} from '../services/voiceConfigStorage';

export interface VoiceConfigStoreState {
  config: InterviewConfig;
  runtimeConfig: RuntimeVoiceConfig | null;
  profiles: InterviewProfile[];
  explicitLiveModel: boolean;
  updateConfig: (patch: Partial<InterviewConfig>) => void;
  setConfig: (next: InterviewConfig) => void;
  setExplicitLiveModel: (flag: boolean) => void;
  applyProfile: (profileId: string) => void;
  fetchRuntimeConfig: (fetcher?: () => Promise<RuntimeVoiceConfig | null>) => Promise<RuntimeVoiceConfig | null>;
}

export function createVoiceConfigStore(
  storage: StoragePort = getDefaultStoragePort(),
  fallbackDefaults?: Partial<InterviewConfig>
) {
  const initial = readVoiceConfigState(storage, fallbackDefaults);
  let initialProfiles: InterviewProfile[] = BUILT_IN_PROFILES;
  try {
    initialProfiles = typeof localStorage !== 'undefined' ? getCachedProfiles() : BUILT_IN_PROFILES;
  } catch {
    initialProfiles = BUILT_IN_PROFILES;
  }

  return create<VoiceConfigStoreState>()((set, get) => {
    const commit = (config: InterviewConfig, explicitLiveModel: boolean) => {
      set({ config, explicitLiveModel });
      writeVoiceConfigState(storage, { config, explicitLiveModel });
    };

    return {
      config: initial.config,
      runtimeConfig: null,
      profiles: initialProfiles,
      explicitLiveModel: initial.explicitLiveModel,

      updateConfig: (patch) => {
        const state = get();
        const nextConfig: InterviewConfig = { ...state.config, ...patch };
        const hasModelChange = patch.liveModel !== undefined && patch.liveModel !== state.config.liveModel;
        const nextExplicit = state.explicitLiveModel || hasModelChange;
        commit(nextConfig, nextExplicit);
      },

      setConfig: (next) => {
        const state = get();
        const hasModelChange = Boolean(next.liveModel && next.liveModel !== state.config.liveModel);
        const nextExplicit = state.explicitLiveModel || hasModelChange;
        commit(next, nextExplicit);
      },

      setExplicitLiveModel: (flag) => {
        const state = get();
        commit(state.config, flag);
      },

      applyProfile: (profileId) => {
        const state = get();
        const profile = state.profiles.find((p) => p.id === profileId)
          || BUILT_IN_PROFILES.find((p) => p.id === profileId);
        if (!profile) return;
        const nextConfig: InterviewConfig = {
          ...state.config,
          ...profile.config,
          customPromptOverride: profile.config.customPromptOverride
        };
        commit(nextConfig, state.explicitLiveModel);
      },

      fetchRuntimeConfig: async (fetcher) => {
        let data: RuntimeVoiceConfig | null = null;
        try {
          if (fetcher) {
            data = await fetcher();
          } else if (typeof fetch === 'function') {
            const res = await fetch('/api/config');
            if (res.ok) {
              data = (await res.json()) as RuntimeVoiceConfig;
            }
          }
        } catch (err) {
          console.warn('[useVoiceConfigStore] Failed to fetch /api/config runtime defaults:', err);
          return null;
        }

        if (!data) return null;

        const resolved = data;
        set((state) => {
          const defaultModel = resolved.models?.defaultLiveModel;
          const nextConfig = !state.explicitLiveModel && defaultModel
            ? { ...state.config, liveModel: defaultModel }
            : state.config;
          return { runtimeConfig: resolved, config: nextConfig };
        });
        return resolved;
      }
    };
  });
}

export const useVoiceConfigStore = createVoiceConfigStore();

export function handleStorageSync(
  event: { key: string | null; newValue?: string | null },
  store: { setState: (partial: Partial<VoiceConfigStoreState>) => void } = useVoiceConfigStore
): void {
  if (event.key !== VOICE_CONFIG_STORAGE_KEY) return;
  if (event.newValue === null) {
    store.setState({
      config: buildDefaultInterviewConfig(),
      explicitLiveModel: false
    });
    return;
  }
  const parsed = parseStoredVoiceConfig(event.newValue ?? null);
  if (parsed) {
    store.setState({
      config: parsed.config,
      explicitLiveModel: parsed.explicitLiveModel
    });
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event: StorageEvent) => {
    handleStorageSync(event);
  });
}
