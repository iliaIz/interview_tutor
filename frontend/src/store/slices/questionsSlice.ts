/**
 * questionsSlice.ts
 * Theory Questions, Study/Quiz Sessions, Cheat Sheet Bookmarks & Topic Progress Slice.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';

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
  completedIds: string[];
  masteredIds: string[];
}

export interface CheatSheetBookmark {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic?: string;
  takeaways?: string[];
  codeSnippet?: string;
  fixedCode?: string;
  categoryBadge?: string;
  createdAt: string;
}

export interface QuestionEvaluationSummary {
  id: string;
  questionId: string;
  topic: string;
  mode: 'voice' | 'text';
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  userAnswer?: string;
  transcript?: string;
  audioMetrics?: any;
  createdAt?: string;
  questionText?: string;
  referenceAnswer?: string;
  verdict?: string;
  evaluatedAt?: string;
}

export interface TopicAccessMeta {
  lastAccessedAt: number;
  count: number;
}

export interface ActiveBatchSession {
  sessionId: string;
  topicId?: string;
  topicName: string;
  questions: Question[];
  currentIndex: number;
  results: Record<string, any>;
  startedAt: string;
  updatedAt: string;
  isComplete: boolean;
}

export interface QuestionsSlice {
  currentView: 'topics' | 'questions' | 'study' | 'quiz';
  selectedTopicId: string | null;
  selectedTopicName: string | null;
  currentBatch: Question[];
  currentQuestionIndex: number;
  topicsProgress: Record<string, TopicProgress>;
  topicAccessMap: Record<string, TopicAccessMeta>;
  activeBatchSession: ActiveBatchSession | null;
  cheatSheetBookmarks: CheatSheetBookmark[];
  evaluationsMap: Record<string, QuestionEvaluationSummary>;
  activeReportModal: QuestionEvaluationSummary | null;

  setView: (view: 'topics' | 'questions' | 'study' | 'quiz') => void;
  setSelectedTopic: (topicId: string, name: string) => void;
  setBatch: (questions: Question[]) => void;
  setQuestionIndex: (idx: number) => void;
  openTopicQuestions: (topicId: string, topicName: string) => void;
  startStudyWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
  startQuizWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean, totalQuestions?: number) => void;
  syncTopicProgress: (topicId: string, completedCount: number, percentage: number, total?: number) => void;
  resetTopicProgress: (topicId: string) => void;
  recordTopicAccess: (topicId: string) => void;
  saveBatchSessionCheckpoint: (sessionId: string, patch: Partial<ActiveBatchSession>) => void;
  clearBatchSession: () => void;
  addCheatSheetBookmark: (bookmark: Omit<CheatSheetBookmark, 'id' | 'createdAt'> & { id?: string }) => void;
  removeCheatSheetBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  openReportModal: (report: QuestionEvaluationSummary) => void;
  closeReportModal: () => void;
  setQuestionEvaluation: (questionId: string, evaluation: QuestionEvaluationSummary) => void;
  fetchTopicEvaluations: (topicId: string) => Promise<void>;
}

export const createQuestionsSlice: StateCreator<any, [], [], QuestionsSlice> = (set, get) => ({
  currentView: 'topics',
  selectedTopicId: null,
  selectedTopicName: null,
  currentBatch: [],
  currentQuestionIndex: 0,
  topicsProgress: {},
  topicAccessMap: {},
  activeBatchSession: null,
  cheatSheetBookmarks: [],
  evaluationsMap: {},
  activeReportModal: null,

  setView: (view) => set({ currentView: view }),
  setSelectedTopic: (topicId, name) => {
    get().recordTopicAccess(topicId);
    set({ selectedTopicId: topicId, selectedTopicName: name });
  },
  setBatch: (questions) => set({ currentBatch: questions, currentQuestionIndex: 0 }),
  setQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),

  openTopicQuestions: (topicId, topicName) => {
    get().recordTopicAccess(topicId);
    set({ selectedTopicId: topicId, selectedTopicName: topicName, currentView: 'questions' });
  },

  startStudyWithQuestions: (topicId, topicName, questions) => {
    get().recordTopicAccess(topicId);
    set({
      selectedTopicId: topicId, selectedTopicName: topicName,
      currentBatch: questions, currentQuestionIndex: 0, currentView: 'study'
    });
  },

  startQuizWithQuestions: (topicId, topicName, questions) => {
    get().recordTopicAccess(topicId);
    set({
      selectedTopicId: topicId, selectedTopicName: topicName,
      currentBatch: questions, currentQuestionIndex: 0, currentView: 'quiz'
    });
  },

  recordTopicAccess: (topicId) => {
    if (!topicId) return;
    set((state: any) => {
      const prev = state.topicAccessMap[topicId] || { lastAccessedAt: 0, count: 0 };
      return {
        topicAccessMap: { ...state.topicAccessMap, [topicId]: { lastAccessedAt: Date.now(), count: prev.count + 1 } }
      };
    });
  },

  saveBatchSessionCheckpoint: (sessionId, patch) => set((state: any) => {
    const prevSession = state.activeBatchSession?.sessionId === sessionId ? state.activeBatchSession : null;
    const updatedSession: ActiveBatchSession = {
      sessionId,
      topicId: patch.topicId || prevSession?.topicId || '',
      topicName: patch.topicName || prevSession?.topicName || 'Java Core & Spring',
      questions: patch.questions || prevSession?.questions || [],
      currentIndex: patch.currentIndex !== undefined ? patch.currentIndex : (prevSession?.currentIndex ?? 0),
      results: { ...(prevSession?.results || {}), ...(patch.results || {}) },
      startedAt: prevSession?.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isComplete: patch.isComplete !== undefined ? patch.isComplete : (prevSession?.isComplete ?? false)
    };
    return { activeBatchSession: updatedSession };
  }),

  clearBatchSession: () => set({ activeBatchSession: null }),

  addCheatSheetBookmark: (b) => set((state: any) => {
    const id = b.id || `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const exists = state.cheatSheetBookmarks.some((item: any) => item.id === id || (item.title === b.title && item.subtopic === b.subtopic));
    if (exists) return state;
    return {
      cheatSheetBookmarks: [
        {
          id,
          topicId: b.topicId,
          topicName: b.topicName,
          title: b.title,
          subtopic: b.subtopic,
          takeaways: b.takeaways,
          codeSnippet: b.codeSnippet,
          fixedCode: b.fixedCode,
          categoryBadge: b.categoryBadge,
          createdAt: new Date().toISOString()
        },
        ...state.cheatSheetBookmarks
      ]
    };
  }),

  removeCheatSheetBookmark: (id) => set((state: any) => ({
    cheatSheetBookmarks: state.cheatSheetBookmarks.filter((item: any) => item.id !== id)
  })),

  isBookmarked: (id) => get().cheatSheetBookmarks.some((item: any) => item.id === id),

  openReportModal: (report) => set({ activeReportModal: report }),
  closeReportModal: () => set({ activeReportModal: null }),

  setQuestionEvaluation: (questionId, evaluation) => set((state: any) => ({
    evaluationsMap: {
      ...state.evaluationsMap,
      [questionId]: evaluation
    }
  })),

  fetchTopicEvaluations: async (topicId: string) => {
    try {
      const res = await fetch(`/api/eval/topic/${encodeURIComponent(topicId)}`);
      if (res.ok) {
        const data: QuestionEvaluationSummary[] = await res.json();
        const mapUpdate: Record<string, QuestionEvaluationSummary> = {};
        data.forEach((item) => {
          if (item.questionId) {
            mapUpdate[item.questionId] = item;
          }
        });
        set((state: any) => ({
          evaluationsMap: {
            ...state.evaluationsMap,
            ...mapUpdate
          }
        }));
      }
    } catch (err) {
      console.error('Error fetching topic evaluations:', err);
    }
  },

  updateTopicProgress: (topicId, completedId, isMastered, totalQuestions) => set((state: any) => {
    const prev = state.topicsProgress[topicId] || {
      topicId, name: topicId, total: totalQuestions || 27, completedCount: 0, masteredCount: 0,
      percentage: 0, completedIds: [], masteredIds: []
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
          ...prev, total: effectiveTotal, completedIds, masteredIds,
          completedCount: completedIds.length, masteredCount: masteredIds.length, percentage
        }
      }
    };
  }),

  syncTopicProgress: (topicId, completedCount, percentage, total) => set((state: any) => {
    const prev = state.topicsProgress[topicId] || {
      topicId, name: topicId, total: total || 27, completedCount: 0, masteredCount: 0,
      percentage: 0, completedIds: [], masteredIds: []
    };
    return {
      topicsProgress: {
        ...state.topicsProgress,
        [topicId]: { ...prev, completedCount, percentage, total: total || prev.total || 27 }
      }
    };
  }),

  resetTopicProgress: (topicId) => set((state: any) => {
    const prev = state.topicsProgress[topicId];
    if (!prev) return state;
    return {
      topicsProgress: {
        ...state.topicsProgress,
        [topicId]: { ...prev, completedIds: [], masteredIds: [], completedCount: 0, masteredCount: 0, percentage: 0 }
      }
    };
  })
});
