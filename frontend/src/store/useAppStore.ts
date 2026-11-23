/**
 * useAppStore.ts
 * Root Composite Store combining domain-bounded slices (SOTA Late 2026).
 * Slices: uiSlice, questionsSlice, academySlice, whiteboardSlice, practiceSlice.
 * Purged dead duplicate ghost auth state (useAuthStore is the authoritative auth SSOT).
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  UiSlice,
  StudioTab,
  ActiveAudioJob,
  ToastNotification,
  SystemHealth,
  RecapTarget,
  createUiSlice
} from './slices/uiSlice';

import {
  QuestionsSlice,
  Question,
  TopicProgress,
  CheatSheetBookmark,
  QuestionEvaluationSummary,
  TopicAccessMeta,
  ActiveBatchSession,
  createQuestionsSlice
} from './slices/questionsSlice';

import {
  AcademySlice,
  AcademyBreadcrumbContext,
  createAcademySlice
} from './slices/academySlice';

import {
  WhiteboardSlice,
  WhiteboardState,
  CodeArtifactRevision,
  ActiveWhiteboardArtifact,
  selectActiveWhiteboardArtifact,
  pruneCodeRevisionsWithNonEviction,
  createWhiteboardSlice
} from './slices/whiteboardSlice';

import {
  PracticeSlice,
  createPracticeSlice
} from './slices/practiceSlice';

import {
  CompanySlice,
  CompanySubTab,
  createCompanySlice
} from './slices/companySlice';

// Re-export all domain types and canonical selectors for existing consumers
export type {
  StudioTab,
  ActiveAudioJob,
  ToastNotification,
  SystemHealth,
  RecapTarget,
  Question,
  TopicProgress,
  CheatSheetBookmark,
  QuestionEvaluationSummary,
  TopicAccessMeta,
  ActiveBatchSession,
  AcademyBreadcrumbContext,
  WhiteboardState,
  CodeArtifactRevision,
  ActiveWhiteboardArtifact,
  PracticeSlice,
  CompanySlice,
  CompanySubTab,
  UiSlice,
  QuestionsSlice,
  AcademySlice,
  WhiteboardSlice
};

export { selectActiveWhiteboardArtifact, pruneCodeRevisionsWithNonEviction };

export type AppState = UiSlice & QuestionsSlice & AcademySlice & WhiteboardSlice & PracticeSlice & CompanySlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createUiSlice(...a),
      ...createQuestionsSlice(...a),
      ...createAcademySlice(...a),
      ...createWhiteboardSlice(...a),
      ...createPracticeSlice(...a),
      ...createCompanySlice(...a)
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
        evaluationsMap: state.evaluationsMap,
        cheatSheetBookmarks: state.cheatSheetBookmarks,
        topicAccessMap: state.topicAccessMap,
        codeRevisions: state.codeRevisions,
        currentBatch: state.currentBatch,
        currentQuestionIndex: state.currentQuestionIndex,
        activeBatchSession: state.activeBatchSession
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.topicsProgress = {};
          if (!Array.isArray(state.codeRevisions)) {
            state.codeRevisions = [];
          } else {
            state.codeRevisions = state.codeRevisions.filter(
              (r) => r && typeof r.id === 'string' && typeof r.code === 'string'
            );
          }
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
