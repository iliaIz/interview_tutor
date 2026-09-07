import { StateCreator } from 'zustand';
import { AppState, BatchSlice, ActiveBatchSession } from '../types';

export const createBatchSlice: StateCreator<AppState, [], [], BatchSlice> = (set) => ({
  activeBatchSession: null,

  saveBatchSessionCheckpoint: (sessionId: string, patch: Partial<ActiveBatchSession>) => set((state) => {
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

  clearBatchSession: () => set({ activeBatchSession: null })
});
