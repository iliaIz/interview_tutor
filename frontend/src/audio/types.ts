/**
 * types.ts
 * Canonical TypeScript types for Headless NativeLiveVoiceEngine (SOTA Late 2026).
 */

import type { MicrophoneMetrics } from './MicrophoneCapture';
import type { VoiceInternalState } from './LiveVoiceStateMachine';

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

export interface CodeArtifactPayload {
  id: string;
  title: string;
  language: string;
  code: string;
}

export interface WorkspaceManifestPayload {
  activeFile?: { path: string; content: string; isReadOnly?: boolean };
  fileCount?: number;
  projectTree?: string[];
  secondaryFiles?: Array<{ path: string; content: string; isReadOnly?: boolean }>;
  xmlManifest?: string;
}

export interface AcademyBridgeContextPayload {
  courseId?: string;
  stepId?: string;
  moduleTitle?: string;
  learningObjective?: string;
  targetConcepts?: string[];
}

export interface LiveSessionCommonFields {
  tutorMode?: string;
  voice?: string;
  userGender?: string;
  turnMode?: 'auto' | 'manual';
  liveModel?: string;
  vadPauseMs?: number;
  enableSilenceClarification?: boolean;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  persona?: string;
  strategy?: string;
  targetGrade?: string;
  strictness?: string;
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  customPrompt?: string;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  activeCodeArtifact?: CodeArtifactPayload;
  academyBridgeContext?: AcademyBridgeContextPayload;
  seniorReview?: any;
  hrMode?: string;
  dossierId?: string;
  jobId?: string;
  hrPersonaId?: string;
  questionMatrixId?: string;
  chunkId?: string;
  startBeatId?: string;
  beatScope?: 'all_from_beat' | 'single_beat';
  academyCourse?: string;
  academyStep?: string;
}

export interface VoiceEngineConfig extends LiveSessionCommonFields {
  sessionId: string;
  questionId: string;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'incident' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor' | string;
  targetQuestionId?: string;
  hrMode?: 'full_screening_simulation' | 'rapid_fire_micro_drill' | 'tutor_rehearsal' | 'guided_zero_start';
  initialUserMessage?: string;
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
  codeRevisionsSummary?: Array<{ id: string; title: string }>;
  workspaceManifest?: WorkspaceManifestPayload;
  turn0Lockdown?: boolean;
  debugStep?: number;
  temperature?: number;
}

export interface LiveSessionInitFrame extends LiveSessionCommonFields {
  type: 'session_init';
  sessionId: string;
  sessionType?: string;
  challenge?: {
    id?: string;
    title?: string;
    category?: string;
    track?: string;
    domain?: string;
    instructions?: string;
    activeFilePath?: string;
    activeFileContent?: string;
    workspaceManifest?: WorkspaceManifestPayload;
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
  onBugSolved?: (payload: any) => void;
  onCandidateObservationRecorded?: (payload: any) => void;
  onSmellDiscovered?: (payload: any) => void;
  onTransientFiltered?: () => void;
  onHrPhaseTransition?: (payload: any) => void;
  onHrScorecardReady?: (scorecard: any) => void;
  onHrTranscriptDelta?: (delta: string) => void;
  onHrStepState?: (payload: any) => void;
}

export interface LiveTransportConnection {
  send(payload: string): void;
  close(code?: number, reason?: string): void;
  isOpen(): boolean;
}

export interface LiveTransportPort {
  connect(
    url: string,
    handlers: {
      onOpen: () => void;
      onMessage: (data: unknown) => void;
      onClose: (code?: number) => void;
      onError: (err: unknown) => void;
    }
  ): LiveTransportConnection;
}

export interface LiveAudioIOPort {
  startCapture(onFrame: (pcm: string, metrics?: MicrophoneMetrics) => void, onLevel: (db: number) => void): Promise<void>;
  stopCapture(): void;
  setMuted(muted: boolean): void;
  enqueuePcm(pcm: string): void;
  interruptPlayout(): void;
  notifyTurnComplete(): void;
  handlePlayoutFinished(cb: () => void): void;
  isPlaying(): boolean;
  clearPlayout(): void;
}

export interface VoiceEnginePorts {
  transport?: LiveTransportPort;
  audio?: LiveAudioIOPort;
}

export type VoiceEngineCommand =
  | { type: 'COMMIT_TURN' }
  | { type: 'BARGE_IN'; source?: 'tactile' | 'acoustic' }
  | { type: 'CENTRAL_ACTION' }
  | { type: 'SEND_TEXT'; text: string; displayText?: string }
  | { type: 'SEND_FRAME'; frame: unknown }
  | { type: 'SET_MUTED'; muted: boolean };

export interface VoiceEngineSnapshot {
  readonly state: VoiceEngineState;
  readonly internalState: VoiceInternalState;
  readonly isCandidateTurnActive: boolean;
  readonly isSessionReady: boolean;
  readonly isMuted: boolean;
  readonly isTurn0Lockdown: boolean;
  readonly isAudioMutexLocked: boolean;
  readonly dialogueTurns: readonly DialogueTurnItem[];
}

export interface ILiveVoiceEngine {
  connect(config: VoiceEngineConfig): Promise<void>;
  disconnect(): void;
  dispatch(command: VoiceEngineCommand): void;
  getSnapshot(): VoiceEngineSnapshot;
  getState(): VoiceEngineState;
}
