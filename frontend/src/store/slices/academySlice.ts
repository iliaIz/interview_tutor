/**
 * academySlice.ts
 * Academy Studio Navigation, Step Launching & Roadmap Progress Slice.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';
import { RoadmapStep } from '../../types/nextgen';

export interface AcademyBreadcrumbContext {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  stepTitle: string;
  moduleTitle?: string;
  learningObjective?: string;
  targetConcepts?: string[];
}

export interface AcademySlice {
  activeAcademyCourseId: string;
  activeAcademyStepNumber: number;
  activeAcademyStepModal: RoadmapStep | null;
  academyBreadcrumbContext: AcademyBreadcrumbContext | null;
  activeRoadmapId: string;
  activeRoadmapStep: RoadmapStep | null;
  completedRoadmapSteps: Record<string, number[]>;

  setActiveAcademyCourseId: (id: string) => void;
  openAcademyStepModal: (step: RoadmapStep) => void;
  closeAcademyStepModal: () => void;
  setAcademyBreadcrumb: (ctx: AcademyBreadcrumbContext | null) => void;
  returnToAcademyStep: () => void;
  toggleAcademyStepProgress: (courseId: string, stepNumber: number, isCompleted: boolean) => Promise<void>;
  launchAcademyStepTarget: (step: RoadmapStep, courseId: string, courseTitle: string) => Promise<void>;

  setActiveRoadmapId: (id: string) => void;
  setActiveRoadmapStep: (step: RoadmapStep | null) => void;
  toggleRoadmapStepCompleted: (roadmapId: string, stepNumber: number) => void;
}

export const createAcademySlice: StateCreator<any, [], [], AcademySlice> = (set, get) => ({
  activeAcademyCourseId: 'senior-bigtech-sprint-25',
  activeAcademyStepNumber: 1,
  activeAcademyStepModal: null,
  academyBreadcrumbContext: null,
  activeRoadmapId: 'senior-bigtech-sprint-25',
  activeRoadmapStep: null,
  completedRoadmapSteps: {},

  setActiveAcademyCourseId: (id) => set({ activeAcademyCourseId: id, activeRoadmapId: id }),
  openAcademyStepModal: (step) => set({ activeAcademyStepModal: step }),
  closeAcademyStepModal: () => set({ activeAcademyStepModal: null }),
  setAcademyBreadcrumb: (ctx) => set({ academyBreadcrumbContext: ctx }),

  returnToAcademyStep: () => {
    const ctx = get().academyBreadcrumbContext;
    if (ctx) {
      set({
        currentStudioTab: 'academy',
        activeAcademyCourseId: ctx.courseId,
        activeAcademyStepNumber: ctx.stepNumber
      });
    } else {
      set({ currentStudioTab: 'academy' });
    }
  },

  toggleAcademyStepProgress: async (courseId, stepNumber, isCompleted) => {
    try {
      get().toggleRoadmapStepCompleted(courseId, stepNumber);
      await fetch('/api/roadmaps/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roadmapId: courseId,
          completedStep: stepNumber,
          isCompleted
        })
      });
    } catch (e) {
      console.error('Error saving academy progress:', e);
    }
  },

  launchAcademyStepTarget: async (step, courseId, courseTitle) => {
    const targetArena = step.targetArena || step.coreRequirements?.targetArena || step.coreRequirements?.taskType;
    const targetScenarioId = step.targetScenarioId || step.coreRequirements?.targetScenarioId;

    set({
      academyBreadcrumbContext: {
        courseId,
        courseTitle,
        stepNumber: step.stepNumber,
        stepTitle: step.title,
        moduleTitle: step.milestoneId || step.domain,
        learningObjective: step.seniorBarConcept || step.pedagogicalRationale,
        targetConcepts: step.masteryChecklist || []
      },
      activeAcademyStepModal: null
    });

    if (targetArena === 'transactions' || targetArena === 'spring_transactions') {
      const scenId = targetScenarioId || 'self_invocation_bypass';
      get().openTransactionLab(scenId);
    } else if (targetArena === 'system_design' || targetArena === 'hld') {
      const scenId = targetScenarioId || step.coreRequirements?.hldScenarioId || 'hld-scenario-01';
      await get().openSystemDesignById(scenId);
    } else if (targetArena === 'incident_triage' || targetArena === 'triage') {
      const incId = targetScenarioId || step.coreRequirements?.triageIncidentId || 'triage-l0-01';
      try {
        const res = await fetch('/api/triage/incidents', { credentials: 'include' });
        if (res.ok) {
          const incidents = await res.json();
          const found = incidents.find((i: any) => i.id === incId || i.slug === incId);
          if (found) {
            get().openTriageIncident(found);
            set({ currentStudioTab: 'triage' });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load triage incident:', e);
      }
      set({ currentStudioTab: 'triage' });
    } else if (targetArena === 'testing_mutation' || targetArena === 'machine_coding' || targetArena === 'lld') {
      const challId = targetScenarioId || step.coreRequirements?.lldChallengeSlug || 'rate-limiter-token-bucket';
      try {
        const res = await fetch('/api/practice/challenges', { credentials: 'include' });
        if (res.ok) {
          const challenges = await res.json();
          const found = challenges.find((c: any) => c.id === challId || c.slug === challId);
          if (found) {
            get().openPracticeChallenge(found);
            set({ currentStudioTab: 'practice' });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load practice challenge:', e);
      }
      set({ currentStudioTab: 'practice' });
    } else if (targetArena === 'oral_interview') {
      set({
        currentStudioTab: 'theory',
        currentView: 'questions'
      });
    } else {
      const topic = step.domain || step.coreRequirements?.theoryTopic || 'core';
      get().setSelectedTopic(topic, 'Java Core & Spring');
      set({
        currentStudioTab: 'theory',
        currentView: 'questions'
      });
    }
  },

  setActiveRoadmapId: (id) => set({ activeRoadmapId: id, activeAcademyCourseId: id }),
  setActiveRoadmapStep: (step) => set({ activeRoadmapStep: step }),
  toggleRoadmapStepCompleted: (roadmapId, stepNumber) => set((state: any) => {
    const current = state.completedRoadmapSteps[roadmapId] || [];
    const isCompleted = current.includes(stepNumber);
    const updated = isCompleted
      ? current.filter((s: number) => s !== stepNumber)
      : [...current, stepNumber];
    return {
      completedRoadmapSteps: {
        ...state.completedRoadmapSteps,
        [roadmapId]: updated
      }
    };
  })
});
