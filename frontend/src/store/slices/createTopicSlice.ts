import { StateCreator } from 'zustand';
import { AppState, TopicSlice, Question } from '../types';

export const createTopicSlice: StateCreator<AppState, [], [], TopicSlice> = (set, get) => ({
  currentView: 'topics',
  selectedTopicId: null,
  selectedTopicName: null,
  currentBatch: [],
  currentQuestionIndex: 0,
  shuffleMap: { java: false, spring: false, hibernate: false, docker: false },
  batchSizeMap: { java: 5, spring: 5, hibernate: 5, docker: 5 },
  topicsProgress: {},
  topicAccessMap: {},

  recordTopicAccess: (topicId: string) => {
    if (!topicId) return;
    set((state) => {
      const prev = state.topicAccessMap[topicId] || { lastAccessedAt: 0, count: 0 };
      return {
        topicAccessMap: {
          ...state.topicAccessMap,
          [topicId]: {
            lastAccessedAt: Date.now(),
            count: prev.count + 1
          }
        }
      };
    });
  },

  setView: (view) => set({ currentView: view }),

  setSelectedTopic: (topicId: string, name: string) => {
    get().recordTopicAccess(topicId);
    set({ selectedTopicId: topicId, selectedTopicName: name });
  },

  setBatch: (questions: Question[]) => set({ currentBatch: questions, currentQuestionIndex: 0 }),
  setQuestionIndex: (idx: number) => set({ currentQuestionIndex: idx }),

  toggleShuffle: (topicId: string) => set((state) => ({
    shuffleMap: { ...state.shuffleMap, [topicId]: !state.shuffleMap[topicId] }
  })),

  setBatchSize: (topicId: string, size: number) => set((state) => ({
    batchSizeMap: { ...state.batchSizeMap, [topicId]: size }
  })),

  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean, totalQuestions?: number) => set((state) => {
    const prev = state.topicsProgress[topicId] || {
      topicId, name: topicId, total: totalQuestions || 27, completedCount: 0, masteredCount: 0,
      percentage: 0, shuffle: false, batchSize: 5, completedIds: [], masteredIds: []
    };
    const completedIds = Array.from(new Set([...prev.completedIds, completedId]));
    const masteredIds = isMastered
      ? Array.from(new Set([...prev.masteredIds, completedId]))
      : prev.masteredIds;

    const effectiveTotal = totalQuestions || prev.total || 27;
    const percentage = Math.round((completedIds.length / effectiveTotal) * 100);

    return {
      topicsProgress: {
        ...state.topicsProgress,
        [topicId]: {
          ...prev,
          total: effectiveTotal,
          completedIds,
          masteredIds,
          completedCount: completedIds.length,
          masteredCount: masteredIds.length,
          percentage
        }
      }
    };
  }),

  syncTopicProgress: (topicId: string, completedCount: number, percentage: number, total?: number) => set((state) => {
    const prev = state.topicsProgress[topicId] || {
      topicId, name: topicId, total: total || 27, completedCount: 0, masteredCount: 0,
      percentage: 0, shuffle: false, batchSize: 5, completedIds: [], masteredIds: []
    };
    return {
      topicsProgress: {
        ...state.topicsProgress,
        [topicId]: {
          ...prev,
          completedCount,
          percentage,
          total: total || prev.total || 27
        }
      }
    };
  }),

  resetTopicProgress: (topicId: string) => set((state) => {
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

  openTopicQuestions: (topicId: string, topicName: string) => {
    get().recordTopicAccess(topicId);
    set({
      selectedTopicId: topicId,
      selectedTopicName: topicName,
      currentView: 'questions'
    });
  },

  startStudyWithQuestions: (topicId: string, topicName: string, questions: Question[]) => {
    get().recordTopicAccess(topicId);
    set({
      selectedTopicId: topicId,
      selectedTopicName: topicName,
      currentBatch: questions,
      currentQuestionIndex: 0,
      currentView: 'study'
    });
  },

  startQuizWithQuestions: (topicId: string, topicName: string, questions: Question[]) => {
    get().recordTopicAccess(topicId);
    set({
      selectedTopicId: topicId,
      selectedTopicName: topicName,
      currentBatch: questions,
      currentQuestionIndex: 0,
      currentView: 'quiz'
    });
  }
});
