import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Question {
  id: string;
  global_id: number;
  num: number;
  topic: string;
  question: string;
  answer: string;
  source_pages?: number[];
}

export interface TopicProgress {
  topicId: string;
  name: string;
  total: number;
  completedCount: number;
  masteredCount: number;
  percentage: number;
  shuffle: boolean;
  batchSize: number;
  completedIds: string[];
  masteredIds: string[];
}

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
}

export interface RecapTarget {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  title: string;
}

interface AppState {
  currentView: 'topics' | 'questions' | 'study' | 'quiz';
  selectedTopicId: string | null;
  selectedTopicName: string | null;
  currentBatch: Question[];
  currentQuestionIndex: number;
  shuffleMap: Record<string, boolean>;
  batchSizeMap: Record<string, number>;
  topicsProgress: Record<string, TopicProgress>;

  // System Readiness State
  systemHealth: SystemHealth;

  // Toast Notification State
  activeToast: ToastNotification | null;

  // Audio Recap State
  activeAudioJob: ActiveAudioJob | null;
  isRecapModalOpen: boolean;
  recapTarget: RecapTarget | null;

  // Actions
  setView: (view: 'topics' | 'questions' | 'study' | 'quiz') => void;
  setSelectedTopic: (topicId: string, name: string) => void;
  setBatch: (questions: Question[]) => void;
  setQuestionIndex: (idx: number) => void;
  toggleShuffle: (topicId: string) => void;
  setBatchSize: (topicId: string, size: number) => void;
  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean) => void;
  resetTopicProgress: (topicId: string) => void;

  // Granular Navigation Actions
  openTopicQuestions: (topicId: string, topicName: string) => void;
  startStudyWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
  startQuizWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;

  // System Health Action
  checkHealth: () => Promise<void>;

  // Toast Actions
  showToast: (notification: Omit<ToastNotification, 'id'>) => void;
  hideToast: () => void;

  // Audio Recap Actions
  openRecapModal: (target: RecapTarget) => void;
  closeRecapModal: () => void;
  setActiveAudioJob: (job: ActiveAudioJob | null) => void;
  clearActiveAudioJob: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'topics',
      selectedTopicId: null,
      selectedTopicName: null,
      currentBatch: [],
      currentQuestionIndex: 0,
      shuffleMap: { java: false, spring: false, hibernate: false, docker: false },
      batchSizeMap: { java: 5, spring: 5, hibernate: 5, docker: 5 },
      topicsProgress: {},

      systemHealth: {
        status: 'checking',
        isAiReady: false,
        message: 'Проверка готовности AI шлюза...'
      },

      activeToast: null,
      activeAudioJob: null,
      isRecapModalOpen: false,
      recapTarget: null,

      setView: (view) => set({ currentView: view }),
      setSelectedTopic: (topicId, name) => set({ selectedTopicId: topicId, selectedTopicName: name }),
      setBatch: (questions) => set({ currentBatch: questions, currentQuestionIndex: 0 }),
      setQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),

      openTopicQuestions: (topicId, topicName) => set({
        selectedTopicId: topicId,
        selectedTopicName: topicName,
        currentView: 'questions'
      }),

      startStudyWithQuestions: (topicId, topicName, questions) => set({
        selectedTopicId: topicId,
        selectedTopicName: topicName,
        currentBatch: questions,
        currentQuestionIndex: 0,
        currentView: 'study'
      }),

      startQuizWithQuestions: (topicId, topicName, questions) => set({
        selectedTopicId: topicId,
        selectedTopicName: topicName,
        currentBatch: questions,
        currentQuestionIndex: 0,
        currentView: 'quiz'
      }),

      toggleShuffle: (topicId) => set((state) => ({
        shuffleMap: { ...state.shuffleMap, [topicId]: !state.shuffleMap[topicId] }
      })),

      setBatchSize: (topicId, size) => set((state) => ({
        batchSizeMap: { ...state.batchSizeMap, [topicId]: size }
      })),

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

      showToast: (notification) => {
        const id = Math.random().toString(36).substring(2, 9);
        set({ activeToast: { ...notification, id } });
      },
      hideToast: () => set({ activeToast: null }),

      updateTopicProgress: (topicId, completedId, isMastered) => set((state) => {
        const prev = state.topicsProgress[topicId] || {
          topicId, name: topicId, total: 100, completedCount: 0, masteredCount: 0,
          percentage: 0, shuffle: false, batchSize: 5, completedIds: [], masteredIds: []
        };
        const completedIds = Array.from(new Set([...prev.completedIds, completedId]));
        const masteredIds = isMastered
          ? Array.from(new Set([...prev.masteredIds, completedId]))
          : prev.masteredIds;

        const percentage = Math.round((completedIds.length / (prev.total || 100)) * 100);

        return {
          topicsProgress: {
            ...state.topicsProgress,
            [topicId]: {
              ...prev,
              completedIds,
              masteredIds,
              completedCount: completedIds.length,
              masteredCount: masteredIds.length,
              percentage
            }
          }
        };
      }),

      resetTopicProgress: (topicId) => set((state) => {
        const prev = state.topicsProgress[topicId];
        if (!prev) return state;
        return {
          topicsProgress: {
            ...state.topicsProgress,
            [topicId]: {
              ...prev,
              completedIds: [],
              masteredIds: [],
              completedCount: 0,
              masteredCount: 0,
              percentage: 0
            }
          }
        };
      }),

      openRecapModal: (target) => set({ isRecapModalOpen: true, recapTarget: target }),
      closeRecapModal: () => set({ isRecapModalOpen: false }),
      setActiveAudioJob: (job) => set({ activeAudioJob: job }),
      clearActiveAudioJob: () => set({ activeAudioJob: null }),
    }),
    {
      name: 'interview-prep-storage-v2',
      partialize: (state) => ({
        currentView: state.currentView,
        selectedTopicId: state.selectedTopicId,
        selectedTopicName: state.selectedTopicName,
        shuffleMap: state.shuffleMap,
        batchSizeMap: state.batchSizeMap,
        topicsProgress: state.topicsProgress,
      })
    }
  )
);
