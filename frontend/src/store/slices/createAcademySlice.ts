import { StateCreator } from 'zustand';
import { AppState, AcademySlice } from '../types';
import { RoadmapStep } from '../../types/nextgen';

export const createAcademySlice: StateCreator<AppState, [], [], AcademySlice> = (set, get) => ({
  currentStudioTab: 'academy',
  setStudioTab: (tab) => set({ currentStudioTab: tab }),

  // Academy Studio
  activeAcademyCourseId: 'senior-bigtech-sprint-25',
  activeAcademyStepNumber: 1,
  activeAcademyStepModal: null,
  academyBreadcrumbContext: null,

  setActiveAcademyCourseId: (id: string) => set({ activeAcademyCourseId: id, activeRoadmapId: id }),
  openAcademyStepModal: (step: RoadmapStep) => set({ activeAcademyStepModal: step, activeAcademyStepNumber: step.stepNumber }),
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

  toggleAcademyStepProgress: async (courseId: string, stepNumber: number, isCompleted: boolean) => {
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

  launchAcademyStepTarget: async (step: RoadmapStep, courseId: string, courseTitle: string) => {
    const targetArena = step.targetArena || step.coreRequirements?.targetArena || step.coreRequirements?.taskType;
    const targetScenarioId = step.targetScenarioId || step.coreRequirements?.targetScenarioId;

    // 1. Set breadcrumb context & close modal
    set({
      academyBreadcrumbContext: {
        courseId,
        courseTitle,
        stepNumber: step.stepNumber,
        stepTitle: step.title
      },
      activeAcademyStepModal: null
    });

    // 2. Dispatch to designated target arena
    if (targetArena === 'transactions' || targetArena === 'spring_transactions') {
      const scenId = targetScenarioId || 'self_invocation_bypass';
      get().openTransactionLab(scenId);
    } else if (targetArena === 'system_design' || targetArena === 'hld') {
      const scenId = targetScenarioId || step.coreRequirements?.hldScenarioId || 'hld-scenario-01';
      try {
        const res = await fetch('/api/system-design/scenarios', { credentials: 'include' });
        if (res.ok) {
          const scenarios = await res.json();
          const found = scenarios.find((s: any) => s.id === scenId || s.slug === scenId);
          if (found) {
            get().openSystemDesignScenario(found);
            set({ currentStudioTab: 'system_design' });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load system design scenario:', e);
      }
      set({ currentStudioTab: 'system_design' });
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
      // Default to theory view
      const topic = step.domain || step.coreRequirements?.theoryTopic || 'core';
      get().setSelectedTopic(topic, 'Java Core & Spring');
      set({
        currentStudioTab: 'theory',
        currentView: 'questions'
      });
    }
  },

  // System Design
  activeSystemDesignScenario: null,
  openSystemDesignScenario: (scenario) => set({ activeSystemDesignScenario: scenario }),
  closeSystemDesignScenario: () => set({ activeSystemDesignScenario: null }),

  // Triage Lab
  activeTriageIncident: null,
  openTriageIncident: (incident) => set({ activeTriageIncident: incident }),
  closeTriageIncident: () => set({ activeTriageIncident: null }),

  // Guided Roadmaps (Legacy & Compatibility)
  activeRoadmapId: 'senior-bigtech-sprint-25',
  setActiveRoadmapId: (id) => set({ activeRoadmapId: id, activeAcademyCourseId: id }),
  activeRoadmapStep: null,
  setActiveRoadmapStep: (step) => set({ activeRoadmapStep: step }),
  completedRoadmapSteps: {},
  toggleRoadmapStepCompleted: (roadmapId, stepNumber) => set((state) => {
    const current = state.completedRoadmapSteps[roadmapId] || [];
    const isCompleted = current.includes(stepNumber);
    const updated = isCompleted
      ? current.filter(s => s !== stepNumber)
      : [...current, stepNumber];
    return {
      completedRoadmapSteps: {
        ...state.completedRoadmapSteps,
        [roadmapId]: updated
      }
    };
  })
});
