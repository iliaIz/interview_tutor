import { StateCreator } from 'zustand';
import { AppState, PracticeSlice } from '../types';
import { CodingChallenge, FileNode, EvaluationResult } from '../../types/practice';

export const createPracticeSlice: StateCreator<AppState, [], [], PracticeSlice> = (set) => ({
  activePracticeChallenge: null,
  practiceWorkspaceFiles: [],
  activeWorkspaceFileIndex: 0,
  activePracticePhase: 1,
  isPracticeEvaluating: false,
  activePracticeReport: null,
  practiceElapsedSeconds: 0,

  openPracticeChallenge: (challenge: CodingChallenge, draftFiles?: FileNode[]) => {
    const filesToUse = (draftFiles && draftFiles.length > 0)
      ? draftFiles
      : (challenge.workspaceFiles && challenge.workspaceFiles.length > 0)
        ? challenge.workspaceFiles
        : (challenge.phases?.[0]?.addedFiles || []);

    const mainIndex = filesToUse.findIndex(f => f.isMainEntryPoint);
    set({
      activePracticeChallenge: challenge,
      practiceWorkspaceFiles: filesToUse,
      activeWorkspaceFileIndex: mainIndex >= 0 ? mainIndex : 0,
      activePracticePhase: 1,
      activePracticeReport: null,
      isPracticeEvaluating: false,
      practiceElapsedSeconds: 0
    });
  },

  closePracticeChallenge: () => set({
    activePracticeChallenge: null,
    practiceWorkspaceFiles: [],
    activeWorkspaceFileIndex: 0,
    activePracticeReport: null
  }),

  // Spring Transaction Playground (@Transactional Lab)
  activeTransactionLabScenarioId: null,
  openTransactionLab: (scenarioId?: string) => set({
    activeTransactionLabScenarioId: scenarioId || 'self_invocation_bypass',
    currentStudioTab: 'practice'
  }),
  closeTransactionLab: () => set({ activeTransactionLabScenarioId: null }),

  updateWorkspaceFileContent: (index: number, content: string) => set((state) => {
    const updated = [...state.practiceWorkspaceFiles];
    if (updated[index]) {
      updated[index] = { ...updated[index], content };
    }
    return { practiceWorkspaceFiles: updated };
  }),

  setActiveWorkspaceFileIndex: (idx: number) => set({ activeWorkspaceFileIndex: idx }),
  setActivePracticePhase: (phase: number) => set({ activePracticePhase: phase }),
  setIsPracticeEvaluating: (isEval: boolean) => set({ isPracticeEvaluating: isEval }),
  setActivePracticeReport: (report: EvaluationResult | null) => set({ activePracticeReport: report }),
  setPracticeElapsedSeconds: (val: number | ((prev: number) => number)) => set((state) => ({
    practiceElapsedSeconds: typeof val === 'function' ? val(state.practiceElapsedSeconds) : val
  }))
});
