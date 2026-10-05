/**
 * types.ts
 * Canonical TypeScript types for Headless LiveVoiceEngine (SOTA Late 2026).
 */

export type VoiceEngineState =
  | 'IDLE'
  | 'CONNECTING'
  | 'AI_SPEAKING'
  | 'LISTENING'
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
  sessionType: 'interview' | 'tutor' | 'system_design' | 'incident' | string;
  tutorMode?: string;
  voice?: string;
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
}

export interface LiveSessionInitFrame {
  type: 'session_init';
  sessionId: string;
  sessionType?: string;
  tutorMode?: string;
  topic?: string;
  persona?: string;
  strategy?: string;
  targetGrade?: string;
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
}
