import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState } from './types';
import { createAuthSlice } from './slices/createAuthSlice';
import { createAcademySlice } from './slices/createAcademySlice';
import { createTopicSlice } from './slices/createTopicSlice';
import { createPracticeSlice } from './slices/createPracticeSlice';
import { createWhiteboardSlice } from './slices/createWhiteboardSlice';
import { createBatchSlice } from './slices/createBatchSlice';
import { createEvaluationSlice } from './slices/createEvaluationSlice';
import { createSystemSlice } from './slices/createSystemSlice';

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createAcademySlice(...a),
      ...createTopicSlice(...a),
      ...createPracticeSlice(...a),
      ...createWhiteboardSlice(...a),
      ...createBatchSlice(...a),
      ...createEvaluationSlice(...a),
      ...createSystemSlice(...a),
    }),
    {
      name: 'interview-prep-storage-v2',
      partialize: (state) => ({
        currentStudioTab: state.currentStudioTab,
        currentView: state.currentView,
        selectedTopicId: state.selectedTopicId,
        selectedTopicName: state.selectedTopicName,
        activeAcademyCourseId: state.activeAcademyCourseId,
        shuffleMap: state.shuffleMap,
        batchSizeMap: state.batchSizeMap,
        // SSOT 2026: topicsProgress removed from persistent localStorage to avoid stale cache shadowing
        evaluationsMap: state.evaluationsMap,
        cheatSheetBookmarks: state.cheatSheetBookmarks,
        topicAccessMap: state.topicAccessMap,
        codeRevisions: state.codeRevisions,
        // SOTA 2026: Seamless Question & Portion Continuity across page reloads & browser restarts
        currentBatch: state.currentBatch,
        currentQuestionIndex: state.currentQuestionIndex,
        activeBatchSession: state.activeBatchSession,
      }),
      onRehydrateStorage: () => (state) => {
        // Sanitize legacy corrupted localStorage topicsProgress
        if (state) {
          state.topicsProgress = {};
          // Ensure currentQuestionIndex is strictly bounded within currentBatch length
          if (Array.isArray(state.currentBatch) && state.currentBatch.length > 0) {
            const maxIdx = state.currentBatch.length - 1;
            if (typeof state.currentQuestionIndex !== 'number' || state.currentQuestionIndex < 0) {
              state.currentQuestionIndex = 0;
            } else if (state.currentQuestionIndex > maxIdx) {
              state.currentQuestionIndex = maxIdx;
            }
          } else {
            state.currentBatch = [];
            state.currentQuestionIndex = 0;
          }
        }
      }
    }
  )
);

// Re-export all types and domain models for backward compatibility
export * from './types';
