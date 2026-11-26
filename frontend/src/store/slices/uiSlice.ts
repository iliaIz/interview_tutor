/**
 * uiSlice.ts
 * Studio Shell Navigation, System Design, Triage, Health Diagnostics, Toasts & Audio Recaps.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';
import { ProductionIncident } from '../../types/nextgen';

export type StudioTab = 'academy' | 'roadmaps' | 'theory' | 'incidents' | 'practice' | 'system_design' | 'triage' | 'hr_screening' | 'live_debug' | 'companies';

export interface ActiveAudioJob {
  jobId: string;
  audioUrl: string;
  title: string;
  topic?: string;
  transcript?: string;
  metadata?: any;
}

export interface ToastNotification {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message?: string;
  technicalDetails?: string;
}

export interface SystemHealth {
  status: 'ready' | 'warming_up' | 'unreachable' | 'checking';
  isAiReady: boolean;
  message?: string;
  latencyMs?: number;
  error?: string;
  commitSha?: string;
}

export interface RecapTarget {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  title: string;
}

export interface UiSlice {
  currentStudioTab: StudioTab;
  setStudioTab: (tab: StudioTab) => void;

  activeSystemDesignScenario: any | null;
  activeTriStudioMode: 'runtime' | 'topology' | 'defense';
  setActiveTriStudioMode: (mode: 'runtime' | 'topology' | 'defense') => void;
  openSystemDesignById: (scenarioIdOrAlias: string, preferredStudio?: 'runtime' | 'topology' | 'defense') => Promise<void>;
  openSystemDesignScenario: (scenario: any) => void;
  closeSystemDesignScenario: () => void;

  activeTriageIncident: ProductionIncident | null;
  openTriageIncident: (incident: ProductionIncident) => void;
  closeTriageIncident: () => void;

  activeTopicBugHunt: { topicId: string; topicName: string } | null;
  openTopicBugHunt: (topicId: string, topicName: string) => void;
  closeTopicBugHunt: () => void;

  systemHealth: SystemHealth;
  checkHealth: () => Promise<void>;

  activeToast: ToastNotification | null;
  showToast: (notification: Omit<ToastNotification, 'id'>) => void;
  hideToast: () => void;

  activeAudioJob: ActiveAudioJob | null;
  isRecapModalOpen: boolean;
  recapTarget: RecapTarget | null;
  openRecapModal: (target: RecapTarget) => void;
  closeRecapModal: () => void;
  setActiveAudioJob: (job: ActiveAudioJob | null) => void;
  clearActiveAudioJob: () => void;
}

export const createUiSlice: StateCreator<any, [], [], UiSlice> = (set, get) => ({
  currentStudioTab: 'academy',
  setStudioTab: (tab) => set({ currentStudioTab: tab }),

  activeSystemDesignScenario: null,
  activeTriStudioMode: 'topology',
  setActiveTriStudioMode: (mode) => set({ activeTriStudioMode: mode }),

  openSystemDesignById: async (scenarioIdOrAlias: string, preferredStudio?: 'runtime' | 'topology' | 'defense') => {
    try {
      const res = await fetch(`/api/system-design/scenarios/${encodeURIComponent(scenarioIdOrAlias)}`, { credentials: 'include' });
      if (!res.ok) {
        console.error(`Scenario not found: ${scenarioIdOrAlias}`);
        set({ currentStudioTab: 'system_design' });
        return;
      }
      const manifest = await res.json();
      let activeStudio: 'runtime' | 'topology' | 'defense' = preferredStudio || 'topology';
      if (!preferredStudio) {
        if (manifest.target_level === 'L3_JUNIOR' && manifest.studio_1_runtime) {
          activeStudio = 'runtime';
        } else if (manifest.target_level === 'L7_PRINCIPAL' || manifest.archetype === 'PLANETARY_CELLULAR') {
          activeStudio = 'topology';
        }
      }
      set({
        activeSystemDesignScenario: manifest,
        currentStudioTab: 'system_design',
        activeTriStudioMode: activeStudio
      });
    } catch (err) {
      console.error('Failed to resolve system design scenario:', err);
      set({ currentStudioTab: 'system_design' });
    }
  },

  openSystemDesignScenario: (scenario) => set({
    activeSystemDesignScenario: scenario,
    currentStudioTab: 'system_design',
    activeTriStudioMode: (scenario?.target_level === 'L3_JUNIOR' && scenario?.studio_1_runtime) ? 'runtime' : 'topology'
  }),

  closeSystemDesignScenario: () => set({ activeSystemDesignScenario: null }),

  activeTriageIncident: null,
  openTriageIncident: (incident) => set({ activeTriageIncident: incident }),
  closeTriageIncident: () => set({ activeTriageIncident: null }),

  activeTopicBugHunt: null,
  openTopicBugHunt: (topicId, topicName) => {
    if (get().recordTopicAccess) {
      get().recordTopicAccess(topicId);
    }
    set({
      currentStudioTab: 'incidents',
      activeTopicBugHunt: { topicId, topicName }
    });
  },
  closeTopicBugHunt: () => set({ activeTopicBugHunt: null }),

  systemHealth: {
    status: 'checking',
    isAiReady: false,
    message: 'Проверка готовности AI шлюза...'
  },

  checkHealth: async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        set({
          systemHealth: {
            status: data.isAiReady ? 'ready' : (data.aiGateway?.status === 'connecting' ? 'warming_up' : 'unreachable'),
            isAiReady: !!data.isAiReady,
            latencyMs: data.aiGateway?.latencyMs,
            error: data.aiGateway?.error,
            commitSha: data.commitSha || data.version,
            message: data.isAiReady
              ? 'AI Шлюз готов к работе'
              : (data.aiGateway?.status === 'connecting' ? 'Инициализация AI шлюза...' : 'AI Шлюз недоступен')
          }
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        set({
          systemHealth: {
            status: 'warming_up',
            isAiReady: false,
            error: errData.aiGateway?.error || `HTTP ${res.status}`,
            message: 'AI Шлюз запускается...'
          }
        });
      }
    } catch (err: any) {
      set({
        systemHealth: {
          status: 'unreachable',
          isAiReady: false,
          error: err?.message,
          message: 'Нет связи с сервером'
        }
      });
    }
  },

  activeToast: null,
  showToast: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set({ activeToast: { ...notification, id } });
  },
  hideToast: () => set({ activeToast: null }),

  activeAudioJob: null,
  isRecapModalOpen: false,
  recapTarget: null,
  openRecapModal: (target) => {
    if (target?.topicId && get().recordTopicAccess) {
      get().recordTopicAccess(target.topicId);
    }
    set({ isRecapModalOpen: true, recapTarget: target });
  },
  closeRecapModal: () => set({ isRecapModalOpen: false }),
  setActiveAudioJob: (job) => set({ activeAudioJob: job }),
  clearActiveAudioJob: () => set({ activeAudioJob: null })
});
