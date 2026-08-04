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

export interface RecapTarget {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  title: string;
}

interface AppState {
  currentView: 'topics' | 'study' | 'quiz';
  selectedTopicId: string | null;
  selectedTopicName: string | null;
  currentBatch: Question[];
  currentQuestionIndex: number;
  shuffleMap: Record<string, boolean>;
  batchSizeMap: Record<string, number>;
  topicsProgress: Record<string, TopicProgress>;

  // Audio Recap State
  activeAudioJob: ActiveAudioJob | null;
  isRecapModalOpen: boolean;
  recapTarget: RecapTarget | null;

  // Actions
  setView: (view: 'topics' | 'study' | 'quiz') => void;
  setSelectedTopic: (topicId: string, name: string) => void;
  setBatch: (questions: Question[]) => void;
  setQuestionIndex: (idx: number) => void;
  toggleShuffle: (topicId: string) => void;
  setBatchSize: (topicId: string, size: number) => void;
  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean) => void;
  resetTopicProgress: (topicId: string) => void;

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

      activeAudioJob: null,
      isRecapModalOpen: false,
      recapTarget: null,

      setView: (view) => set({ currentView: view }),
      setSelectedTopic: (topicId, name) => set({ selectedTopicId: topicId, selectedTopicName: name }),
      setBatch: (questions) => set({ currentBatch: questions, currentQuestionIndex: 0 }),
      setQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),

      toggleShuffle: (topicId) => set((state) => ({
        shuffleMap: { ...state.shuffleMap, [topicId]: !state.shuffleMap[topicId] }
      })),

      setBatchSize: (topicId, size) => set((state) => ({
        batchSizeMap: { ...state.batchSizeMap, [topicId]: size }
      })),

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
      name: 'interview-prep-storage-v2'
    }
  )
);
