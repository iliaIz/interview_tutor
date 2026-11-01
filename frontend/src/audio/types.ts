/**
 * types.ts
 * Canonical TypeScript types for Headless NativeLiveVoiceEngine (SOTA Late 2026).
 */

export type VoiceEngineState =
  | 'IDLE'
  | 'CONNECTING'
  | 'AI_SPEAKING'
  | 'LISTENING'
  | 'COMMITTING'
  | 'AI_THINKING'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'ERROR';

export interface DialogueTurnItem {
  id: string;
  role: 'ai' | 'user' | 'system';
  text: string;
  timestamp: number;
}

export interface VoiceEngineConfig {
  sessionId: string;
  questionId: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'incident' | 'hr_simulation' | 'hr_micro_drill' | string;
  dossierId?: string;
  targetQuestionId?: string;
  hrMode?: 'full_screening_simulation' | 'rapid_fire_micro_drill';
  tutorMode?: string;
  voice?: string;
  userGender?: string;
  turnMode?: 'auto' | 'manual';
  liveModel?: string;
  vadPauseMs?: number;
  persona?: string;
  targetGrade?: string;
  strategy?: string;
  strictness?: string;
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  customPrompt?: string;
  initialUserMessage?: string;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  isResumed?: boolean;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  fixedCode?: string;
  unitTest?: string;
  scenarioId?: string;
  incidentContext?: any;
  challengeCategory?: string;
  challengeTrack?: string;
  challengeDomain?: string;
  activeCodeArtifact?: {
    id: string;
    title: string;
    language: string;
    code: string;
  };
  codeRevisionsSummary?: Array<{ id: string; title: string }>;
  workspaceManifest?: {
    activeFile?: { path: string; content: string; isReadOnly?: boolean };
    fileCount?: number;
    projectTree?: string[];
    secondaryFiles?: Array<{ path: string; content: string; isReadOnly?: boolean }>;
    xmlManifest?: string;
  };
  turn0Lockdown?: boolean;
  enableSilenceClarification?: boolean;
  debugStep?: number;
  temperature?: number;
  academyCourse?: string;
  academyStep?: string;
  academyBridgeContext?: {
    courseId?: string;
    stepId?: string;
    moduleTitle?: string;
    learningObjective?: string;
    targetConcepts?: string[];
  };
  seniorReview?: any;
  jobId?: string;
  hrPersonaId?: string;
  questionMatrixId?: string;
}

export interface LiveSessionInitFrame {
  type: 'session_init';
  sessionId: string;
  sessionType?: string;
  tutorMode?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  persona?: string;
  strategy?: string;
  targetGrade?: string;
  customPrompt?: string;
  challenge?: {
    id?: string;
    title?: string;
    category?: string;
    track?: string;
    domain?: string;
    instructions?: string;
    activeFilePath?: string;
    activeFileContent?: string;
    workspaceManifest?: {
      activeFile?: { path: string; content: string; isReadOnly?: boolean };
      fileCount?: number;
      projectTree?: string[];
      secondaryFiles?: Array<{ path: string; content: string; isReadOnly?: boolean }>;
      xmlManifest?: string;
    };
  };
  activeCodeArtifact?: {
    id: string;
    title: string;
    language: string;
    code: string;
  };
  academyBridgeContext?: {
    courseId?: string;
    stepId?: string;
    moduleTitle?: string;
    learningObjective?: string;
    targetConcepts?: string[];
  };
  seniorReview?: any;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  hrMode?: string;
  dossierId?: string;
  jobId?: string;
  hrPersonaId?: string;
  questionMatrixId?: string;
}

export interface VoiceEvaluationResult {
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  criteriaBreakdown?: Array<{
    id: string;
    title: string;
    maxPoints: number;
    earnedPoints: number;
    status: 'covered' | 'partial' | 'missed';
    probeAssisted?: boolean;
    evidence?: string;
    gap?: string;
  }>;
  deductions?: Array<{
    penalty: number;
    criteria: string;
    reason: string;
  }>;
  upgradeSnippet?: string;
  faangScorecard?: any;
  speechCoaching?: any;
}

export interface VoiceEngineCallbacks {
  onStateChange?: (state: VoiceEngineState) => void;
  onTranscriptDelta?: (role: 'ai' | 'user' | 'system', text: string) => void;
  onDialogueTurnsUpdate?: (turns: DialogueTurnItem[]) => void;
  onAudioLevel?: (rmsDb: number) => void;
  onEvaluationReceived?: (evaluation: VoiceEvaluationResult) => void;
  onError?: (error: string, retryable: boolean, errorCode?: string) => void;
  onStatusMessage?: (message: string) => void;
  onDrainingStateChange?: (isDraining: boolean) => void;
  onWhiteboardUpdate?: (payload: any) => void;
  onToolCall?: (data: any) => void;
  onChaosInjected?: (payload: any) => void;
  onHiringCommitteeVerdict?: (payload: any) => void;
  onBugSolved?: (payload: any) => void;
  onCandidateObservationRecorded?: (payload: any) => void;
  onSmellDiscovered?: (payload: any) => void;
  onTransientFiltered?: () => void;
  onHrPhaseTransition?: (payload: any) => void;
  onHrScorecardReady?: (scorecard: any) => void;
  onHrTranscriptDelta?: (delta: string) => void;
}

export interface ILiveVoiceEngine {
  connect(config: VoiceEngineConfig): Promise<void>;
  disconnect(): void;
  setMuted(muted: boolean): void;
  handleCentralButtonClick(): void;
  handleBargeInInterruption(source?: 'tactile' | 'acoustic'): void;
  handleUserBargeIn(): void;
  sendTextMessage(text: string, displayText?: string): void;
  commitSpokenTurn(): void;
  sendCustomFrame(frame: any): void;
  getState(): VoiceEngineState;
  getInternalState(): string;
  getDialogueTurns(): DialogueTurnItem[];
}

