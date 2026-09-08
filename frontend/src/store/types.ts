import { CodingChallenge, FileNode, EvaluationResult, ChallengeCategory, GradeLevel } from '../types/practice';
import { SystemDesignScenario, ProductionIncident, RoadmapStep } from '../types/nextgen';

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

export type StudioTab = 'academy' | 'roadmaps' | 'theory' | 'incidents' | 'practice' | 'system_design' | 'triage';

export interface AcademyBreadcrumbContext {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  stepTitle: string;
}

export interface AuthSlice {
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
}

export interface AcademySlice {
  currentStudioTab: StudioTab;
  setStudioTab: (tab: StudioTab) => void;

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

  activeSystemDesignScenario: SystemDesignScenario | null;
  openSystemDesignScenario: (scenario: SystemDesignScenario) => void;
  closeSystemDesignScenario: () => void;

  activeTriageIncident: ProductionIncident | null;
  openTriageIncident: (incident: ProductionIncident) => void;
  closeTriageIncident: () => void;

  activeRoadmapId: string;
  setActiveRoadmapId: (id: string) => void;
  activeRoadmapStep: RoadmapStep | null;
  setActiveRoadmapStep: (step: RoadmapStep | null) => void;
  completedRoadmapSteps: Record<string, number[]>;
  toggleRoadmapStepCompleted: (roadmapId: string, stepNumber: number) => void;
}

export interface TopicSlice {
  currentView: 'topics' | 'questions' | 'study' | 'quiz';
  selectedTopicId: string | null;
  selectedTopicName: string | null;
  currentBatch: Question[];
  currentQuestionIndex: number;
  shuffleMap: Record<string, boolean>;
  batchSizeMap: Record<string, number>;
  topicsProgress: Record<string, TopicProgress>;
  topicAccessMap: Record<string, TopicAccessMeta>;

  recordTopicAccess: (topicId: string) => void;
  setView: (view: 'topics' | 'questions' | 'study' | 'quiz') => void;
  setSelectedTopic: (topicId: string, name: string) => void;
  setBatch: (questions: Question[]) => void;
  setQuestionIndex: (idx: number) => void;
  toggleShuffle: (topicId: string) => void;
  setBatchSize: (topicId: string, size: number) => void;
  updateTopicProgress: (topicId: string, completedId: string, isMastered: boolean, totalQuestions?: number) => void;
  syncTopicProgress: (topicId: string, completedCount: number, percentage: number, total?: number) => void;
  resetTopicProgress: (topicId: string) => void;

  openTopicQuestions: (topicId: string, topicName: string) => void;
  startStudyWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
  startQuizWithQuestions: (topicId: string, topicName: string, questions: Question[]) => void;
}

export interface PracticeSlice {
  activePracticeChallenge: CodingChallenge | null;
  practiceWorkspaceFiles: FileNode[];
  activeWorkspaceFileIndex: number;
  activePracticePhase: number;
  isPracticeEvaluating: boolean;
  activePracticeReport: EvaluationResult | null;
  practiceElapsedSeconds: number;

  activeTransactionLabScenarioId: string | null;
  openTransactionLab: (scenarioId?: string) => void;
  closeTransactionLab: () => void;

  openPracticeChallenge: (challenge: CodingChallenge, draftFiles?: FileNode[]) => void;
  closePracticeChallenge: () => void;
  updateWorkspaceFileContent: (index: number, content: string) => void;
  setActiveWorkspaceFileIndex: (index: number) => void;
  setActivePracticePhase: (phase: number) => void;
  setIsPracticeEvaluating: (isEval: boolean) => void;
  setActivePracticeReport: (report: EvaluationResult | null) => void;
  setPracticeElapsedSeconds: (sec: number | ((prev: number) => number)) => void;
  practiceSelectedCategory: ChallengeCategory;
  practiceSelectedGrade: GradeLevel;
  practiceSelectedArchetype: string;
  practiceIsGroupedByGrade: boolean;
  practiceSelectedChallengeId: string | null;

  setPracticeSelectedCategory: (category: ChallengeCategory) => void;
  setPracticeSelectedGrade: (grade: GradeLevel) => void;
  setPracticeSelectedArchetype: (archetype: string) => void;
  setPracticeIsGroupedByGrade: (isGrouped: boolean) => void;
  setPracticeSelectedChallengeId: (id: string | null) => void;
}

export interface WhiteboardSlice {
  activeWhiteboardState: WhiteboardState | null;
  isWhiteboardOpen: boolean;
  codeRevisions: CodeArtifactRevision[];
  activeRevisionId: string | null;
  hasUnseenWhiteboardUpdate: boolean;
  activeWorkspaceView: 'editor' | 'whiteboard';

  setWhiteboardState: (wb: WhiteboardState | null) => void;
  setIsWhiteboardOpen: (open: boolean) => void;
  addCodeRevision: (rev: { title: string; language?: string; code: string; author?: 'ai' | 'user' }) => void;
  setActiveRevision: (id: string) => void;
  clearCodeRevisions: () => void;
  setActiveWorkspaceView: (view: 'editor' | 'whiteboard') => void;
  markWhiteboardSeen: () => void;
}

export interface BatchSlice {
  activeBatchSession: ActiveBatchSession | null;
  saveBatchSessionCheckpoint: (sessionId: string, patch: Partial<ActiveBatchSession>) => void;
  clearBatchSession: () => void;
}

export interface EvaluationSlice {
  evaluationsMap: Record<string, QuestionEvaluationSummary>;
  activeReportModal: QuestionEvaluationSummary | null;
  cheatSheetBookmarks: CheatSheetBookmark[];
  activeTopicBugHunt: { topicId: string; topicName: string } | null;

  openReportModal: (report: QuestionEvaluationSummary) => void;
  closeReportModal: () => void;
  setQuestionEvaluation: (questionId: string, evaluation: QuestionEvaluationSummary) => void;
  fetchTopicEvaluations: (topicId: string) => Promise<void>;

  addCheatSheetBookmark: (bookmark: Omit<CheatSheetBookmark, 'id' | 'createdAt'> & { id?: string }) => void;
  removeCheatSheetBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;

  openTopicBugHunt: (topicId: string, topicName: string) => void;
  closeTopicBugHunt: () => void;
}

export interface SystemSlice {
  systemHealth: SystemHealth;
  activeToast: ToastNotification | null;
  activeAudioJob: ActiveAudioJob | null;
  isRecapModalOpen: boolean;
  recapTarget: RecapTarget | null;

  checkHealth: () => Promise<void>;
  showToast: (notification: Omit<ToastNotification, 'id'>) => void;
  hideToast: () => void;

  openRecapModal: (target: RecapTarget) => void;
  closeRecapModal: () => void;
  setActiveAudioJob: (job: ActiveAudioJob | null) => void;
  clearActiveAudioJob: () => void;
}

export type AppState = AuthSlice &
  AcademySlice &
  TopicSlice &
  PracticeSlice &
  WhiteboardSlice &
  BatchSlice &
  EvaluationSlice &
  SystemSlice;
