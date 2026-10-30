import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CodingChallenge, FileNode, EvaluationResult, SandboxExecutionResponse, MutationExecutionResponse } from '../types/practice';
import { ScenarioEvaluationResult } from '../types/transactionLab';
import { SystemDesignScenario, ProductionIncident, RoadmapStep } from '../types/nextgen';
import { getLocalDraft } from '../services/practiceDraftStorage';

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
  shuffle: boolean;
  batchSize: number;
  completedIds: string[];
  masteredIds: string[];
}

export interface ActiveAudioJob {
  jobId: string;
  audioUrl: string;
  title: string;
  topic?: string;
  transcript?: string;
  metadata?: any;
}

export interface ToastNotification {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message?: string;
  technicalDetails?: string;
}

export interface SystemHealth {
  status: 'ready' | 'warming_up' | 'unreachable' | 'checking';
  isAiReady: boolean;
  message?: string;
  latencyMs?: number;
  error?: string;
  commitSha?: string;
}

export interface RecapTarget {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  title: string;
}

export interface CheatSheetBookmark {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  takeaways: string[];
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
}

export interface WhiteboardState {
  isOpen?: boolean;
  action: 'write' | 'patch' | 'highlight' | 'clear';
  title?: string;
  language?: string;
  code?: string;
  highlightLines?: number[];
  explanation?: string;
  updatedAt?: number;
}

export interface CodeArtifactRevision {
  id: string;             // e.g. 'rev_1', 'rev_2'
  index: number;          // 1 .. 10
  title: string;          // e.g. "2. Оптимизация Stream"
  language: string;       // "java" | "sql"
  code: string;
  timestamp: number;
  author: 'ai' | 'user';
  diffFromPrev?: string;
  explanation?: string;
  highlightLines?: number[];
}

export interface ActiveWhiteboardArtifact {
  id: string;
  title: string;
  language: string;
  code: string;
  explanation?: string;
  highlightLines?: number[];
  action?: 'write' | 'patch' | 'highlight' | 'clear';
}

/**
 * SOTA 2026 Canonical Selector: Resolves the active code artifact from Whiteboard / Revisions.
 * Absolute SSOT: Timeline active revision takes strict precedence over fallback activeWhiteboardState.
 */
export function selectActiveWhiteboardArtifact(state: {
  codeRevisions?: CodeArtifactRevision[];
  activeRevisionId?: string | null;
  activeWhiteboardState?: WhiteboardState | null;
}): ActiveWhiteboardArtifact | null {
  const revs = Array.isArray(state?.codeRevisions) ? state.codeRevisions : [];
  if (revs.length > 0) {
    const rev =
      (state?.activeRevisionId ? revs.find((r) => r && r.id === state.activeRevisionId) : null) ||
      revs[revs.length - 1];
    if (rev && typeof rev.code === 'string' && rev.code.trim().length > 0) {
      return {
        id: rev.id || 'rev_active',
        title: rev.title || 'Артефакт кода',
        language: rev.language || 'java',
        code: rev.code,
        explanation: rev.explanation || state?.activeWhiteboardState?.explanation,
        highlightLines: Array.isArray(rev.highlightLines)
          ? rev.highlightLines
          : Array.isArray(state?.activeWhiteboardState?.highlightLines)
          ? state.activeWhiteboardState.highlightLines
          : [],
        action: state?.activeWhiteboardState?.action || 'write'
      };
    }
  }

  const wb = state?.activeWhiteboardState;
  if (wb && typeof wb.code === 'string' && wb.code.trim().length > 0) {
    return {
      id: state?.activeRevisionId || 'initial',
      title: wb.title || 'Демонстрация кода',
      language: wb.language || 'java',
      code: wb.code,
      explanation: wb.explanation,
      highlightLines: Array.isArray(wb.highlightLines) ? wb.highlightLines : [],
      action: wb.action || 'write'
    };
  }

  return null;
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

export type StudioTab = 'academy' | 'roadmaps' | 'theory' | 'incidents' | 'practice' | 'system_design' | 'triage' | 'hr_screening' | 'live_debug';

export interface AcademyBreadcrumbContext {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  stepTitle: string;
  moduleTitle?: string;
  learningObjective?: string;
  targetConcepts?: string[];
}

interface AppState {
  currentStudioTab: StudioTab;
  setStudioTab: (tab: StudioTab) => void;

  // Academy Studio State
  activeAcademyCourseId: string;
  activeAcademyStepNumber: number;
  activeAcademyStepModal: RoadmapStep | null;
  academyBreadcrumbContext: AcademyBreadcrumbContext | null;
  setActiveAcademyCourseId: (id: string) => void;
  openAcademyStepModal: (step: RoadmapStep) => void;
  closeAcademyStepModal: () => void;
  setAcademyBreadcrumb: (ctx: AcademyBreadcrumbContext | null) => void;
  returnToAcademyStep: () => void;
  toggleAcademyStepProgress: (courseId: string, stepNumber: number, isCompleted: boolean) => Promise<void>;
  launchAcademyStepTarget: (step: RoadmapStep, courseId: string, courseTitle: string) => Promise<void>;

  // System Design Studio State
  activeSystemDesignScenario: any | null;
  activeTriStudioMode: 'runtime' | 'topology' | 'defense';
  setActiveTriStudioMode: (mode: 'runtime' | 'topology' | 'defense') => void;
  openSystemDesignById: (scenarioIdOrAlias: string, preferredStudio?: 'runtime' | 'topology' | 'defense') => Promise<void>;
  openSystemDesignScenario: (scenario: any) => void;
  closeSystemDesignScenario: () => void;

  // Production Incident Triage Lab State
  activeTriageIncident: ProductionIncident | null;
  openTriageIncident: (incident: ProductionIncident) => void;
  closeTriageIncident: () => void;

  // Guided Non-Linear Roadmaps State (Legacy & Compatibility)
  activeRoadmapId: string;
  setActiveRoadmapId: (id: string) => void;
  activeRoadmapStep: RoadmapStep | null;
  setActiveRoadmapStep: (step: RoadmapStep | null) => void;
  completedRoadmapSteps: Record<string, number[]>;
  toggleRoadmapStepCompleted: (roadmapId: string, stepNumber: number) => void;


  currentView: 'topics' | 'questions' | 'study' | 'quiz';
  selectedTopicId: string | null;
  selectedTopicName: string | null;
  currentBatch: Question[];
  currentQuestionIndex: number;
  shuffleMap: Record<string, boolean>;
  batchSizeMap: Record<string, number>;
  topicsProgress: Record<string, TopicProgress>;

  // Recency & Topic Access Map (MRU Sorting)
  topicAccessMap: Record<string, TopicAccessMeta>;
  recordTopicAccess: (topicId: string) => void;

  // Active Multi-Question Batch Session Checkpoint
  activeBatchSession: ActiveBatchSession | null;
  saveBatchSessionCheckpoint: (sessionId: string, patch: Partial<ActiveBatchSession>) => void;
  clearBatchSession: () => void;

  // AI Live Whiteboard State & Revision History (10-slot Ring Buffer)
  activeWhiteboardState: WhiteboardState | null;
  isWhiteboardOpen: boolean;
  codeRevisions: CodeArtifactRevision[];
  activeRevisionId: string | null;
  setWhiteboardState: (wb: WhiteboardState | null) => void;
  setIsWhiteboardOpen: (open: boolean) => void;
  addCodeRevision: (rev: { title: string; language?: string; code: string; author?: 'ai' | 'user' }) => void;
  setActiveRevision: (id: string) => void;
  clearCodeRevisions: () => void;

  // Practice Arena / Live-Coding State
  activePracticeChallenge: CodingChallenge | null;
  practiceWorkspaceFiles: FileNode[];
  activeWorkspaceFileIndex: number;
  activePracticePhase: number;
  isPracticeEvaluating: boolean;
  activePracticeReport: EvaluationResult | null;
  isPracticeReportModalOpen: boolean;
  practiceElapsedSeconds: number;

  // Real-Time Practice Execution Results (Sandbox, Mutations, Transactions)
  latestSandboxResult: SandboxExecutionResponse | null;
  latestMutationResult: MutationExecutionResponse | null;
  latestTxEvaluation: ScenarioEvaluationResult | null;
  setLatestSandboxResult: (res: SandboxExecutionResponse | null) => void;
  setLatestMutationResult: (res: MutationExecutionResponse | null) => void;
  setLatestTxEvaluation: (res: ScenarioEvaluationResult | null) => void;

  openPracticeChallenge: (challenge: CodingChallenge, draftFiles?: FileNode[]) => void;
  closePracticeChallenge: () => void;
  updateWorkspaceFileContent: (index: number, content: string) => void;
  setActiveWorkspaceFileIndex: (index: number) => void;
  setActivePracticePhase: (phase: number) => void;
  setIsPracticeEvaluating: (isEval: boolean) => void;
  setActivePracticeReport: (report: EvaluationResult | null) => void;
  setIsPracticeReportModalOpen: (open: boolean) => void;
  setPracticeElapsedSeconds: (sec: number | ((prev: number) => number)) => void;

  // Spring Transaction Playground (@Transactional Lab)
  activeTransactionLabScenarioId: string | null;
  openTransactionLab: (scenarioId?: string) => void;
  closeTransactionLab: () => void;

  // Cheat Sheet Bookmarks
  cheatSheetBookmarks: CheatSheetBookmark[];
  addCheatSheetBookmark: (bookmark: Omit<CheatSheetBookmark, 'id' | 'createdAt'> & { id?: string }) => void;
  removeCheatSheetBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;

  // Question Evaluations Cache & Report Modal
  evaluationsMap: Record<string, QuestionEvaluationSummary>;
  activeReportModal: QuestionEvaluationSummary | null;

  // System Readiness State
  systemHealth: SystemHealth;

  // Toast Notification State
  activeToast: ToastNotification | null;

  // Audio Recap State
  activeAudioJob: ActiveAudioJob | null;
  isRecapModalOpen: boolean;
  recapTarget: RecapTarget | null;

  // Topic Bug Hunt Arena State
  activeTopicBugHunt: { topicId: string; topicName: string } | null;
  openTopicBugHunt: (topicId: string, topicName: string) => void;
  closeTopicBugHunt: () => void;

  // Actions
  setView: (view: 'topics' | 'questions' | 'study' | 'quiz') => void;
  setSelectedTopic: (topicId: string, name: string) => void;
  setBatch: (questions: Question[]) => void;
  setQuestionIndex: (idx: number) => void;
  toggleShuffle: (topicId: string) => void;
  setBatchSize: (topicId: string, size: number) => void;
  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean, totalQuestions?: number) => void;
  syncTopicProgress: (topicId: string, completedCount: number, percentage: number, total?: number) => void;
  resetTopicProgress: (topicId: string) => void;

  // Granular Navigation Actions
  openTopicQuestions: (topicId: string, topicName: string) => void;
  startStudyWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
  startQuizWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;

  // Evaluation & Report Modal Actions
  openReportModal: (report: QuestionEvaluationSummary) => void;
  closeReportModal: () => void;
  setQuestionEvaluation: (questionId: string, evaluation: QuestionEvaluationSummary) => void;
  fetchTopicEvaluations: (topicId: string) => Promise<void>;

  // System Health Action
  checkHealth: () => Promise<void>;

  // Toast Actions
  showToast: (notification: Omit<ToastNotification, 'id'>) => void;
  hideToast: () => void;

  // Authentication State & Actions
  currentUser: { id: string; name: string; role: string } | null;
  isAuthChecking: boolean;
  isProfileModalOpen: boolean;
  isAdminInvitesModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openAdminInvitesModal: () => void;
  closeAdminInvitesModal: () => void;
  loginWithInviteCode: (inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  updateUserName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuthSession: () => Promise<void>;

  // Audio Recap Actions
  openRecapModal: (target: RecapTarget) => void;
  closeRecapModal: () => void;
  setActiveAudioJob: (job: ActiveAudioJob | null) => void;
  clearActiveAudioJob: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Authentication
      currentUser: null,
      isAuthChecking: true,
      isProfileModalOpen: false,
      isAdminInvitesModalOpen: false,

      openProfileModal: () => set({ isProfileModalOpen: true }),
      closeProfileModal: () => set({ isProfileModalOpen: false }),
      openAdminInvitesModal: () => set({ isAdminInvitesModalOpen: true }),
      closeAdminInvitesModal: () => set({ isAdminInvitesModalOpen: false }),

      loginWithInviteCode: async (inviteCode: string) => {

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ inviteCode })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({ currentUser: data.user });
            get().showToast({
              type: 'success',
              title: 'Добро пожаловать в Студию!',
              message: `Доступ активирован: ${data.user.name}`
            });
            return { success: true };
          } else {
            return { success: false, error: data.message || data.error || 'Неверный инвайт-код' };
          }
        } catch (err: any) {
          return { success: false, error: 'Сетевая ошибка при проверке инвайт-кода' };
        }
      },


      updateUserName: async (newName: string) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: newName })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({ currentUser: data.user });
            get().showToast({
              type: 'success',
              title: 'Профиль обновлен',
              message: `Ваше имя изменено на: ${data.user.name}`
            });
            return { success: true };
          } else {
            return { success: false, error: data.message || data.error || 'Ошибка обновления имени' };
          }
        } catch (err: any) {
          return { success: false, error: 'Сетевая ошибка при обновлении профиля' };
        }
      },

      logout: async () => {

        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch {}
        set({ currentUser: null });
        get().showToast({
          type: 'info',
          title: 'Сессия завершена',
          message: 'Вы успешно вышли из студии'
        });
      },

      checkAuthSession: async () => {
        set({ isAuthChecking: true });
        try {
          const res = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            set({ currentUser: data.user, isAuthChecking: false });
          } else {
            set({ currentUser: null, isAuthChecking: false });
          }
        } catch {
          set({ currentUser: null, isAuthChecking: false });
        }
      },

      currentStudioTab: 'academy',
      setStudioTab: (tab) => set({ currentStudioTab: tab }),

      // Academy Studio
      activeAcademyCourseId: 'senior-bigtech-sprint-25',
      activeAcademyStepNumber: 1,
      activeAcademyStepModal: null,
      academyBreadcrumbContext: null,
      setActiveAcademyCourseId: (id) => set({ activeAcademyCourseId: id, activeRoadmapId: id }),
      openAcademyStepModal: (step) => set({ activeAcademyStepModal: step, activeAcademyStepNumber: step.stepNumber }),
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

        // 1. Set breadcrumb context & close modal
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

        // 2. Dispatch to designated target arena
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
          // Default to theory view
          const topic = step.domain || step.coreRequirements?.theoryTopic || 'core';
          get().setSelectedTopic(topic, 'Java Core & Spring');
          set({
            currentStudioTab: 'theory',
            currentView: 'questions'
          });
        }
      },

      // System Design & Tri-Studio
      activeSystemDesignScenario: null,
      activeTriStudioMode: 'topology',
      setActiveTriStudioMode: (mode) => set({ activeTriStudioMode: mode }),
      openSystemDesignById: async (scenarioIdOrAlias: string, preferredStudio?: 'runtime' | 'topology' | 'defense') => {
        try {
          const res = await fetch(`/api/system-design/scenarios/${encodeURIComponent(scenarioIdOrAlias)}`, { credentials: 'include' });
          if (!res.ok) {
            console.error(`Scenario not found: ${scenarioIdOrAlias}`);
            set({ currentStudioTab: 'system_design' });
            return;
          }
          const manifest = await res.json();
          let activeStudio: 'runtime' | 'topology' | 'defense' = preferredStudio || 'topology';
          if (!preferredStudio) {
            if (manifest.target_level === 'L3_JUNIOR' && manifest.studio_1_runtime) {
              activeStudio = 'runtime';
            } else if (manifest.target_level === 'L7_PRINCIPAL' || manifest.archetype === 'PLANETARY_CELLULAR') {
              activeStudio = 'topology';
            }
          }
          set({
            activeSystemDesignScenario: manifest,
            currentStudioTab: 'system_design',
            activeTriStudioMode: activeStudio
          });
        } catch (err) {
          console.error('Failed to resolve system design scenario:', err);
          set({ currentStudioTab: 'system_design' });
        }
      },
      openSystemDesignScenario: (scenario) => set({ 
        activeSystemDesignScenario: scenario,
        currentStudioTab: 'system_design',
        activeTriStudioMode: (scenario?.target_level === 'L3_JUNIOR' && scenario?.studio_1_runtime) ? 'runtime' : 'topology'
      }),
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
      }),



      currentView: 'topics',
      selectedTopicId: null,
      selectedTopicName: null,
      currentBatch: [],
      currentQuestionIndex: 0,
      shuffleMap: { java: false, spring: false, hibernate: false, docker: false },
      batchSizeMap: { java: 5, spring: 5, hibernate: 5, docker: 5 },
      topicsProgress: {},
      evaluationsMap: {},
      activeReportModal: null,

      // Recency & Topic Access Map
      topicAccessMap: {},
      recordTopicAccess: (topicId) => {
        if (!topicId) return;
        set((state) => {
          const prev = state.topicAccessMap[topicId] || { lastAccessedAt: 0, count: 0 };
          return {
            topicAccessMap: {
              ...state.topicAccessMap,
              [topicId]: {
                lastAccessedAt: Date.now(),
                count: prev.count + 1
              }
            }
          };
        });
      },

      // Multi-Question Active Session Checkpoint State
      activeBatchSession: null,
      saveBatchSessionCheckpoint: (sessionId, patch) => set((state) => {
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

      // AI Live Whiteboard State & Revision History (10-slot Ring Buffer)
      activeWhiteboardState: null,
      isWhiteboardOpen: false,
      codeRevisions: [],
      activeRevisionId: null,

      setWhiteboardState: (wb) => {
        set((state) => {
          const newState = {
            activeWhiteboardState: wb,
            isWhiteboardOpen: wb ? (wb.action !== 'clear') : false
          };

          // If code is supplied, record as revision if distinct
          if (wb?.code && wb.code.trim().length > 0) {
            const currentRevs = state.codeRevisions || [];
            const lastRev = currentRevs[currentRevs.length - 1];
            if (!lastRev || lastRev.code !== wb.code) {
              const nextIndex = (lastRev ? lastRev.index : 0) + 1;
              const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
              const newRev: CodeArtifactRevision = {
                id: revId,
                index: nextIndex,
                title: wb.title || `Версия ${nextIndex}`,
                language: wb.language || 'java',
                code: wb.code,
                explanation: wb.explanation,
                highlightLines: wb.highlightLines,
                timestamp: Date.now(),
                author: 'ai'
              };
              const updatedRevs = [...currentRevs, newRev].slice(-10); // Keep last 10
              return {
                ...newState,
                codeRevisions: updatedRevs,
                activeRevisionId: revId
              };
            }
          }
          return newState;
        });
      },

      setIsWhiteboardOpen: (open) => set({ isWhiteboardOpen: open }),

      addCodeRevision: ({ title, language = 'java', code, author = 'ai' }) => {
        if (!code || !code.trim()) return;
        set((state) => {
          const currentRevs = state.codeRevisions || [];
          const lastRev = currentRevs[currentRevs.length - 1];
          if (lastRev && lastRev.code === code) return state;

          const nextIndex = (lastRev ? lastRev.index : 0) + 1;
          const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
          const newRev: CodeArtifactRevision = {
            id: revId,
            index: nextIndex,
            title: title || `Версия ${nextIndex}`,
            language,
            code,
            timestamp: Date.now(),
            author
          };
          const updatedRevs = [...currentRevs, newRev].slice(-10);
          return {
            codeRevisions: updatedRevs,
            activeRevisionId: revId
          };
        });
      },

      // SOTA 2026: Atomic SSOT synchronization between activeRevisionId and activeWhiteboardState
      setActiveRevision: (id) => {
        set((state) => {
          const revs = state.codeRevisions || [];
          const targetRev = revs.find((r) => r.id === id);
          if (!targetRev) {
            return { activeRevisionId: id };
          }
          const updatedWb: WhiteboardState = {
            action: 'write',
            title: targetRev.title,
            language: targetRev.language || 'java',
            code: targetRev.code,
            explanation: targetRev.explanation ?? state.activeWhiteboardState?.explanation,
            highlightLines: targetRev.highlightLines ?? [],
            updatedAt: Date.now()
          };
          return {
            activeRevisionId: id,
            activeWhiteboardState: updatedWb
          };
        });
      },
      clearCodeRevisions: () => set({ codeRevisions: [], activeRevisionId: null, activeWhiteboardState: null }),

      // Practice Arena State
      activePracticeChallenge: null,
      practiceWorkspaceFiles: [],
      activeWorkspaceFileIndex: 0,
      activePracticePhase: 1,
      isPracticeEvaluating: false,
      activePracticeReport: null,
      isPracticeReportModalOpen: false,
      practiceElapsedSeconds: 0,

      // Practice Runtime Execution Results
      latestSandboxResult: null,
      latestMutationResult: null,
      latestTxEvaluation: null,
      setLatestSandboxResult: (res) => set({ latestSandboxResult: res }),
      setLatestMutationResult: (res) => set({ latestMutationResult: res }),
      setLatestTxEvaluation: (res) => set({ latestTxEvaluation: res }),

      openPracticeChallenge: (challenge, draftFiles) => {
        let filesToUse = (draftFiles && draftFiles.length > 0) ? draftFiles : null;
        let activeIndex = 0;
        let activePhase = 1;

        if (!filesToUse) {
          const localDraft = getLocalDraft(challenge.id);
          if (localDraft && localDraft.files && localDraft.files.length > 0) {
            filesToUse = localDraft.files;
            activeIndex = localDraft.activeWorkspaceFileIndex ?? 0;
            activePhase = localDraft.activePhase ?? 1;
          }
        }

        if (!filesToUse) {
          filesToUse = (challenge.workspaceFiles && challenge.workspaceFiles.length > 0)
            ? challenge.workspaceFiles
            : (challenge.phases?.[0]?.addedFiles || []);
          const mainIndex = filesToUse.findIndex(f => f.isMainEntryPoint);
          activeIndex = mainIndex >= 0 ? mainIndex : 0;
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

      // Spring Transaction Playground (@Transactional Lab)
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

      updateWorkspaceFileContent: (index, content) => set((state) => {
        const updated = [...state.practiceWorkspaceFiles];
        if (updated[index]) {
          updated[index] = { ...updated[index], content };
        }
        return { practiceWorkspaceFiles: updated };
      }),

      setActiveWorkspaceFileIndex: (idx) => set({ activeWorkspaceFileIndex: idx }),
      setActivePracticePhase: (phase) => set({ activePracticePhase: phase }),
      setIsPracticeEvaluating: (isEval) => set({ isPracticeEvaluating: isEval }),
      setActivePracticeReport: (report) => set({ 
        activePracticeReport: report,
        isPracticeReportModalOpen: Boolean(report)
      }),
      setIsPracticeReportModalOpen: (open) => set({ isPracticeReportModalOpen: open }),
      setPracticeElapsedSeconds: (val) => set((state) => ({
        practiceElapsedSeconds: typeof val === 'function' ? val(state.practiceElapsedSeconds) : val
      })),

      // Cheat Sheet Bookmarks
      cheatSheetBookmarks: [],
      addCheatSheetBookmark: (b) => set((state) => {
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
      removeCheatSheetBookmark: (id) => set((state) => ({
        cheatSheetBookmarks: state.cheatSheetBookmarks.filter((item) => item.id !== id)
      })),
      isBookmarked: (id) => get().cheatSheetBookmarks.some((item) => item.id === id),

      systemHealth: {
        status: 'checking',
        isAiReady: false,
        message: 'Проверка готовности AI шлюза...'
      },

      activeToast: null,
      activeAudioJob: null,
      isRecapModalOpen: false,
      recapTarget: null,
      activeTopicBugHunt: null,

      openTopicBugHunt: (topicId, topicName) => {
        get().recordTopicAccess(topicId);
        set({ 
          currentStudioTab: 'incidents',
          activeTopicBugHunt: { topicId, topicName } 
        });
      },
      closeTopicBugHunt: () => set({ activeTopicBugHunt: null }),

      setView: (view) => set({ currentView: view }),
      setSelectedTopic: (topicId, name) => {
        get().recordTopicAccess(topicId);
        set({ selectedTopicId: topicId, selectedTopicName: name });
      },
      setBatch: (questions) => set({ currentBatch: questions, currentQuestionIndex: 0 }),
      setQuestionIndex: (idx) => set({ currentQuestionIndex: idx }),

      openTopicQuestions: (topicId, topicName) => {
        get().recordTopicAccess(topicId);
        set({
          selectedTopicId: topicId,
          selectedTopicName: topicName,
          currentView: 'questions'
        });
      },

      startStudyWithQuestions: (topicId, topicName, questions) => {
        get().recordTopicAccess(topicId);
        set({
          selectedTopicId: topicId,
          selectedTopicName: topicName,
          currentBatch: questions,
          currentQuestionIndex: 0,
          currentView: 'study'
        });
      },

      startQuizWithQuestions: (topicId, topicName, questions) => {
        get().recordTopicAccess(topicId);
        set({
          selectedTopicId: topicId,
          selectedTopicName: topicName,
          currentBatch: questions,
          currentQuestionIndex: 0,
          currentView: 'quiz'
        });
      },

      toggleShuffle: (topicId) => set((state) => ({
        shuffleMap: { ...state.shuffleMap, [topicId]: !state.shuffleMap[topicId] }
      })),

      setBatchSize: (topicId, size) => set((state) => ({
        batchSizeMap: { ...state.batchSizeMap, [topicId]: size }
      })),

      openReportModal: (report) => set({ activeReportModal: report }),
      closeReportModal: () => set({ activeReportModal: null }),

      setQuestionEvaluation: (questionId, evaluation) => set((state) => ({
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

      checkHealth: async () => {
        try {
          const res = await fetch('/api/health');
          if (res.ok) {
            const data = await res.json();
            set({
              systemHealth: {
                status: data.isAiReady ? 'ready' : (data.aiGateway?.status === 'connecting' ? 'warming_up' : 'unreachable'),
                isAiReady: !!data.isAiReady,
                latencyMs: data.aiGateway?.latencyMs,
                error: data.aiGateway?.error,
                commitSha: data.commitSha || data.version,
                message: data.isAiReady
                  ? 'AI Шлюз готов к работе'
                  : (data.aiGateway?.status === 'connecting' ? 'Инициализация AI шлюза...' : 'AI Шлюз недоступен')
              }
            });
          } else {
            const errData = await res.json().catch(() => ({}));
            set({
              systemHealth: {
                status: 'warming_up',
                isAiReady: false,
                error: errData.aiGateway?.error || `HTTP ${res.status}`,
                message: 'AI Шлюз запускается...'
              }
            });
          }
        } catch (err: any) {
          set({
            systemHealth: {
              status: 'unreachable',
              isAiReady: false,
              error: err?.message,
              message: 'Нет связи с сервером'
            }
          });
        }
      },

      showToast: (notification) => {
        const id = Math.random().toString(36).substring(2, 9);
        set({ activeToast: { ...notification, id } });
      },
      hideToast: () => set({ activeToast: null }),

      updateTopicProgress: (topicId, completedId, isMastered, totalQuestions) => set((state) => {
        const prev = state.topicsProgress[topicId] || {
          topicId, name: topicId, total: totalQuestions || 27, completedCount: 0, masteredCount: 0,
          percentage: 0, shuffle: false, batchSize: 5, completedIds: [], masteredIds: []
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
              ...prev,
              total: effectiveTotal,
              completedIds,
              masteredIds,
              completedCount: completedIds.length,
              masteredCount: masteredIds.length,
              percentage
            }
          }
        };
      }),

      syncTopicProgress: (topicId, completedCount, percentage, total) => set((state) => {
        const prev = state.topicsProgress[topicId] || {
          topicId, name: topicId, total: total || 27, completedCount: 0, masteredCount: 0,
          percentage: 0, shuffle: false, batchSize: 5, completedIds: [], masteredIds: []
        };
        return {
          topicsProgress: {
            ...state.topicsProgress,
            [topicId]: {
              ...prev,
              completedCount,
              percentage,
              total: total || prev.total || 27
            }
          }
        };
      }),

      resetTopicProgress: (topicId) => set((state) => {
        const prev = state.topicsProgress[topicId];
        if (!prev) return state;
        return {
          topicsProgress: {
            ...state.topicsProgress,
            [topicId]: {
              ...prev,
              completedIds: [],
              masteredIds: [],
              completedCount: 0,
              masteredCount: 0,
              percentage: 0
            }
          }
        };
      }),

      openRecapModal: (target) => {
        if (target?.topicId) {
          get().recordTopicAccess(target.topicId);
        }
        set({ isRecapModalOpen: true, recapTarget: target });
      },
      closeRecapModal: () => set({ isRecapModalOpen: false }),
      setActiveAudioJob: (job) => set({ activeAudioJob: job }),
      clearActiveAudioJob: () => set({ activeAudioJob: null }),
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
        // Sanitize legacy corrupted localStorage topicsProgress & codeRevisions
        if (state) {
          state.topicsProgress = {};
          if (!Array.isArray(state.codeRevisions)) {
            state.codeRevisions = [];
          } else {
            state.codeRevisions = state.codeRevisions.filter(
              (r) => r && typeof r.id === 'string' && typeof r.code === 'string'
            );
          }
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

