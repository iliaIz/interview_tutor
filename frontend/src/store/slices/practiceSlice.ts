/**
 * practiceSlice.ts
 * Practice Arena, Live-Coding Workspace, Sandbox Results & Transaction Lab Slice.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';
import {
  CodingChallenge,
  FileNode,
  EvaluationResult,
  SandboxExecutionResponse,
  MutationExecutionResponse
} from '../../types/practice';
import { ScenarioEvaluationResult } from '../../types/transactionLab';
import { getLocalDraft, removeLocalDraft } from '../../services/practiceDraftStorage';

/**
 * Resolves the initial active file index for a workspace manifest:
 * 1) Explicit `isMainEntryPoint`
 * 2) First editable (`!readOnly`) file
 * 3) Fallback index 0
 */
export function resolveInitialWorkspaceFileIndex(files: FileNode[]): number {
  if (!Array.isArray(files) || files.length === 0) return 0;
  const mainIdx = files.findIndex((f) => f.isMainEntryPoint);
  if (mainIdx >= 0) return mainIdx;
  const editableIdx = files.findIndex((f) => !f.readOnly);
  return editableIdx >= 0 ? editableIdx : 0;
}

/**
 * Purely appends phase files whose paths are not already mounted in `existing`.
 */
export function mergePhaseFiles(existing: FileNode[], added: FileNode[]): FileNode[] {
  const existingPaths = new Set(existing.map((f) => f.path));
  const newEntries = added
    .filter((f) => f && f.path && !existingPaths.has(f.path))
    .map((f) => ({ ...f }));
  return [...existing, ...newEntries];
}

export interface PracticeSlice {
  activePracticeChallenge: CodingChallenge | null;
  practiceWorkspaceFiles: FileNode[];
  activeWorkspaceFileIndex: number;
  activePracticePhase: number;
  isPracticeEvaluating: boolean;
  activePracticeReport: EvaluationResult | null;
  isPracticeReportModalOpen: boolean;
  practiceElapsedSeconds: number;

  latestSandboxResult: SandboxExecutionResponse | null;
  latestMutationResult: MutationExecutionResponse | null;
  latestTxEvaluation: ScenarioEvaluationResult | null;
  setLatestSandboxResult: (res: SandboxExecutionResponse | null) => void;
  setLatestMutationResult: (res: MutationExecutionResponse | null) => void;
  setLatestTxEvaluation: (res: ScenarioEvaluationResult | null) => void;

  openPracticeChallenge: (challenge: CodingChallenge, draftFiles?: FileNode[]) => void;
  openPracticeChallengeById: (idOrSlug: string) => Promise<boolean>;
  setPracticeWorkspaceFiles: (files: FileNode[]) => void;
  closePracticeChallenge: () => void;
  updateWorkspaceFileContent: (index: number, content: string) => void;
  setActiveWorkspaceFileIndex: (index: number) => void;
  setActivePracticePhase: (phase: number) => void;
  setIsPracticeEvaluating: (isEval: boolean) => void;
  setActivePracticeReport: (report: EvaluationResult | null) => void;
  setIsPracticeReportModalOpen: (open: boolean) => void;
  setPracticeElapsedSeconds: (sec: number | ((prev: number) => number)) => void;

  activeTransactionLabScenarioId: string | null;
  openTransactionLab: (scenarioId?: string) => void;
  closeTransactionLab: () => void;
}

export const createPracticeSlice: StateCreator<any, [], [], PracticeSlice> = (set, get) => ({
  activePracticeChallenge: null,
  practiceWorkspaceFiles: [],
  activeWorkspaceFileIndex: 0,
  activePracticePhase: 1,
  isPracticeEvaluating: false,
  activePracticeReport: null,
  isPracticeReportModalOpen: false,
  practiceElapsedSeconds: 0,

  latestSandboxResult: null,
  latestMutationResult: null,
  latestTxEvaluation: null,
  setLatestSandboxResult: (res) => set({ latestSandboxResult: res }),
  setLatestMutationResult: (res) => set({ latestMutationResult: res }),
  setLatestTxEvaluation: (res) => set({ latestTxEvaluation: res }),

  openPracticeChallenge: (challenge, draftFiles) => {
    const canonicalFiles = (challenge.workspaceFiles && challenge.workspaceFiles.length > 0)
      ? challenge.workspaceFiles
      : (challenge.phases?.[0]?.addedFiles || []);

    let rawDraft = (draftFiles && draftFiles.length > 0) ? draftFiles : null;
    let activeIndex = 0;
    let hasSavedFileIndex = false;
    let activePhase = 1;

    if (!rawDraft) {
      const localDraft = getLocalDraft(challenge.id);
      const challengeUpdatedEpoch = (challenge as any).updated_at ? new Date((challenge as any).updated_at).getTime() : 0;
      if (localDraft && localDraft.files && localDraft.files.length > 0) {
        if (challengeUpdatedEpoch === 0 || localDraft.updatedAt >= challengeUpdatedEpoch) {
          rawDraft = localDraft.files;
          if (typeof localDraft.activeWorkspaceFileIndex === 'number') {
            activeIndex = localDraft.activeWorkspaceFileIndex;
            hasSavedFileIndex = true;
          }
          activePhase = localDraft.activePhase ?? 1;
        } else {
          removeLocalDraft(challenge.id);
        }
      }
    }

    let filesToUse = canonicalFiles.map(f => ({ ...f }));
    if (rawDraft && rawDraft.length > 0) {
      const draftMap = new Map(rawDraft.filter(df => df && df.path).map(df => [df.path, df]));
      const matchCount = canonicalFiles.filter(cf => draftMap.has(cf.path)).length;
      if (matchCount > 0) {
        filesToUse = canonicalFiles.map(cf => {
          const df = draftMap.get(cf.path);
          if (df && !cf.readOnly && typeof df.content === 'string') {
            return { ...cf, content: df.content };
          }
          return { ...cf };
        });
      }
    }

    if (!hasSavedFileIndex || activeIndex < 0 || activeIndex >= filesToUse.length) {
      activeIndex = resolveInitialWorkspaceFileIndex(filesToUse);
    }

    set({
      activePracticeChallenge: challenge,
      practiceWorkspaceFiles: filesToUse,
      activeWorkspaceFileIndex: activeIndex,
      activePracticePhase: activePhase,
      activePracticeReport: null,
      isPracticeReportModalOpen: false,
      latestSandboxResult: null,
      latestMutationResult: null,
      latestTxEvaluation: null,
      isPracticeEvaluating: false,
      practiceElapsedSeconds: 0
    });
  },

  openPracticeChallengeById: async (idOrSlug: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/practice/challenges/${encodeURIComponent(idOrSlug)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const challenge = data.challenge || data;
        const draft = data.savedDraft;
        get().openPracticeChallenge(challenge, draft);
        set({ currentStudioTab: 'practice' });
        return true;
      } else {
        console.warn(`[useAppStore] Challenge ${idOrSlug} returned HTTP ${res.status}`);
        set({ currentStudioTab: 'practice' });
        return false;
      }
    } catch (err) {
      console.error(`[useAppStore] Failed to load challenge ${idOrSlug}:`, err);
      set({ currentStudioTab: 'practice' });
      return false;
    }
  },

  setPracticeWorkspaceFiles: (files) => set({
    practiceWorkspaceFiles: files.map(f => ({ ...f })),
    activeWorkspaceFileIndex: 0
  }),

  closePracticeChallenge: () => set({
    activePracticeChallenge: null,
    practiceWorkspaceFiles: [],
    activeWorkspaceFileIndex: 0,
    activePracticeReport: null,
    isPracticeReportModalOpen: false,
    latestSandboxResult: null,
    latestMutationResult: null,
    latestTxEvaluation: null
  }),

  activeTransactionLabScenarioId: null,
  openTransactionLab: (scenarioId) => set({
    activeTransactionLabScenarioId: scenarioId || 'self_invocation_bypass',
    currentStudioTab: 'practice',
    latestTxEvaluation: null
  }),
  closeTransactionLab: () => set({
    activeTransactionLabScenarioId: null,
    latestTxEvaluation: null
  }),

  updateWorkspaceFileContent: (index, content) => set((state: any) => {
    const updated = [...state.practiceWorkspaceFiles];
    if (updated[index]) {
      updated[index] = { ...updated[index], content };
    }
    return { practiceWorkspaceFiles: updated };
  }),

  setActiveWorkspaceFileIndex: (idx) => set({ activeWorkspaceFileIndex: idx }),
  setActivePracticePhase: (phase) => set((state: any) => {
    if (phase !== 2) {
      return { activePracticePhase: phase };
    }
    const added: FileNode[] = state.activePracticeChallenge?.phasedRequirements?.[0]?.addedFiles || [];
    if (!Array.isArray(added) || added.length === 0) {
      return { activePracticePhase: 2 };
    }
    const existing: FileNode[] = state.practiceWorkspaceFiles || [];
    const merged = mergePhaseFiles(existing, added);
    const firstNewIdx = merged.length > existing.length ? existing.length : state.activeWorkspaceFileIndex;
    return {
      activePracticePhase: 2,
      practiceWorkspaceFiles: merged,
      activeWorkspaceFileIndex: firstNewIdx
    };
  }),
  setIsPracticeEvaluating: (isEval) => set({ isPracticeEvaluating: isEval }),
  setActivePracticeReport: (report) => set({
    activePracticeReport: report,
    isPracticeReportModalOpen: Boolean(report)
  }),
  setIsPracticeReportModalOpen: (open) => set({ isPracticeReportModalOpen: open }),
  setPracticeElapsedSeconds: (val) => set((state: any) => ({
    practiceElapsedSeconds: typeof val === 'function' ? val(state.practiceElapsedSeconds) : val
  }))
});
