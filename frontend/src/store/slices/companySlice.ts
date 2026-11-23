/**
 * companySlice.ts
 * Domain slice for curated company preparation, pipelines, and readiness telemetry (SPEC-27).
 * Cognitive Bounding SLA: <= 200 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';
import { CompanyProfile } from '@interview-prep/shared';

export type CompanySubTab =
  | 'pipeline'
  | 'theory'
  | 'challenges'
  | 'dossier'
  | 'runbook'
  | 'sql_arena'
  | 'take_home';

export interface CompanySlice {
  companyProfiles: CompanyProfile[];
  selectedCompanyProfileId: string;
  activeCompanySubTab: CompanySubTab;
  completedCompanyStageIds: string[];
  companyReadinessData: any;
  targetSqlChallengeId?: string;
  isCompanyVoiceOpen: boolean;
  isCompanyLoading: boolean;
  companyLoadError: string | null;

  setCompanyProfiles: (profiles: CompanyProfile[]) => void;
  setSelectedCompanyProfileId: (id: string) => void;
  setActiveCompanySubTab: (subTab: CompanySubTab) => void;
  setCompletedCompanyStageIds: (stageIds: string[]) => void;
  toggleCompanyStageComplete: (stageId: string) => void;
  setCompanyReadinessData: (data: any) => void;
  setTargetSqlChallengeId: (id?: string) => void;
  setIsCompanyVoiceOpen: (open: boolean) => void;
  setIsCompanyLoading: (loading: boolean) => void;
  setCompanyLoadError: (error: string | null) => void;
  resetCompanyState: () => void;
}

export const createCompanySlice: StateCreator<CompanySlice, [], [], CompanySlice> = (set) => ({
  companyProfiles: [],
  selectedCompanyProfileId: 'raiffeisen_dgtl',
  activeCompanySubTab: 'pipeline',
  completedCompanyStageIds: [],
  companyReadinessData: null,
  targetSqlChallengeId: undefined,
  isCompanyVoiceOpen: false,
  isCompanyLoading: true,
  companyLoadError: null,

  setCompanyProfiles: (profiles) => set({ companyProfiles: profiles }),
  setSelectedCompanyProfileId: (id) => set({ selectedCompanyProfileId: id }),
  setActiveCompanySubTab: (activeCompanySubTab) => set({ activeCompanySubTab }),
  setCompletedCompanyStageIds: (completedCompanyStageIds) => set({ completedCompanyStageIds }),
  toggleCompanyStageComplete: (stageId) =>
    set((state) => {
      const exists = state.completedCompanyStageIds.includes(stageId);
      const next = exists
        ? state.completedCompanyStageIds.filter((id) => id !== stageId)
        : [...state.completedCompanyStageIds, stageId];
      try {
        localStorage.setItem(`company_stages_${state.selectedCompanyProfileId}`, JSON.stringify(next));
      } catch {}
      return { completedCompanyStageIds: next };
    }),
  setCompanyReadinessData: (data) => set({ companyReadinessData: data }),
  setTargetSqlChallengeId: (id) => set({ targetSqlChallengeId: id }),
  setIsCompanyVoiceOpen: (open) => set({ isCompanyVoiceOpen: open }),
  setIsCompanyLoading: (loading) => set({ isCompanyLoading: loading }),
  setCompanyLoadError: (error) => set({ companyLoadError: error }),
  resetCompanyState: () =>
    set({
      selectedCompanyProfileId: 'raiffeisen_dgtl',
      activeCompanySubTab: 'pipeline',
      completedCompanyStageIds: [],
      companyReadinessData: null,
      targetSqlChallengeId: undefined,
      isCompanyVoiceOpen: false,
      isCompanyLoading: false,
      companyLoadError: null
    })
});
