import { StateCreator } from 'zustand';
import { AppState, SystemSlice, ToastNotification, RecapTarget, ActiveAudioJob } from '../types';

export const createSystemSlice: StateCreator<AppState, [], [], SystemSlice> = (set, get) => ({
  systemHealth: {
    status: 'checking',
    isAiReady: false,
    message: 'Проверка готовности AI шлюза...'
  },
  activeToast: null,
  activeAudioJob: null,
  isRecapModalOpen: false,
  recapTarget: null,

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

  showToast: (notification: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    set({ activeToast: { ...notification, id } });
  },

  hideToast: () => set({ activeToast: null }),

  openRecapModal: (target: RecapTarget) => {
    if (target?.topicId) {
      get().recordTopicAccess(target.topicId);
    }
    set({ isRecapModalOpen: true, recapTarget: target });
  },

  closeRecapModal: () => set({ isRecapModalOpen: false }),
  setActiveAudioJob: (job: ActiveAudioJob | null) => set({ activeAudioJob: job }),
  clearActiveAudioJob: () => set({ activeAudioJob: null })
});
