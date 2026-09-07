import { StateCreator } from 'zustand';
import { AppState, EvaluationSlice, QuestionEvaluationSummary, CheatSheetBookmark } from '../types';

export const createEvaluationSlice: StateCreator<AppState, [], [], EvaluationSlice> = (set, get) => ({
  evaluationsMap: {},
  activeReportModal: null,
  cheatSheetBookmarks: [],
  activeTopicBugHunt: null,

  openReportModal: (report: QuestionEvaluationSummary) => set({ activeReportModal: report }),
  closeReportModal: () => set({ activeReportModal: null }),

  setQuestionEvaluation: (questionId: string, evaluation: QuestionEvaluationSummary) => set((state) => ({
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
        set((state) => ({
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

  addCheatSheetBookmark: (b: Omit<CheatSheetBookmark, 'id' | 'createdAt'> & { id?: string }) => set((state) => {
    const id = b.id || `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const exists = state.cheatSheetBookmarks.some((item) => item.id === id || (item.title === b.title && item.subtopic === b.subtopic));
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

  removeCheatSheetBookmark: (id: string) => set((state) => ({
    cheatSheetBookmarks: state.cheatSheetBookmarks.filter((item) => item.id !== id)
  })),

  isBookmarked: (id: string) => get().cheatSheetBookmarks.some((item) => item.id === id),

  openTopicBugHunt: (topicId: string, topicName: string) => {
    get().recordTopicAccess(topicId);
    set({
      currentStudioTab: 'incidents',
      activeTopicBugHunt: { topicId, topicName }
    });
  },

  closeTopicBugHunt: () => set({ activeTopicBugHunt: null })
});
