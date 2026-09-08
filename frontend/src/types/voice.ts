import { AcousticMetrics, SpeechClarityMetrics } from '../services/AcousticTelemetryService';
import { FaangScorecardData } from './personas';

export interface DialogueTurn {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface WhiteboardUpdatePayload {
  action: 'write' | 'patch' | 'highlight' | 'clear';
  title?: string;
  language?: string;
  code?: string;
  patch?: string;
  highlightLines?: number[];
  explanation?: string;
}

export interface RubricCriterionResult {
  id: string;
  title: string;
  maxPoints: number;
  earnedPoints: number;
  status: 'covered' | 'partial' | 'missed';
  probeAssisted?: boolean;
  evidence?: string;
  gap?: string;
}

export interface ScoreDeduction {
  penalty: number;
  criteria: string;
  reason: string;
}

export interface VoiceEvaluationResult {
  id?: string;
  questionId?: string;
  score?: number;
  isPassed?: boolean;
  positivePoints?: string[];
  missingPoints?: string[];
  criteriaBreakdown?: RubricCriterionResult[];
  deductions?: ScoreDeduction[];
  upgradeSnippet?: string;
  feedback?: string;
  spokenFeedback?: string;
  audioMetrics?: AcousticMetrics;
  clarityMetrics?: SpeechClarityMetrics;
  questionType?: 'definitional' | 'tradeoff' | 'behavioral';
  speechCoaching?: {
    structureType?: 'STAR' | 'PREP' | 'RULE_OF_3' | 'UNSTRUCTURED';
    rephrasedExample?: string;
    criteriaBreakdown?: RubricCriterionResult[];
    deductions?: ScoreDeduction[];
    upgradeSnippet?: string;
  };
  faangScorecard?: FaangScorecardData;
  userAnswer?: string;
  transcript?: string;
}

export type EvaluationResult = VoiceEvaluationResult;

export interface LiveAudioSessionOptions {
  // Session type & topic context
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'practice';
  tutorMode?: 'deep_dive' | 'free_chat' | 'socratic' | 'eli5' | 'bug_hunt' | 'practice_pair';
  topic?: string;
  questionId?: string;
  questionText?: string;
  referenceAnswer?: string;

  // Persona, voice & model configuration
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  vadPauseMs?: number;
  liveModel?: string;
  persona?: string;
  tutorPersona?: string;
  targetGrade?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  customAnchors?: string[];
  customPrompt?: string;

  // Batch navigation
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  isResumed?: boolean;

  category?: string;
  track?: string;
  scenarioId?: string;
  bugTitle?: string;
  bugExplanation?: string;
  codeSnippet?: string;
  hints?: string[];
  initialUserMessage?: string;
  sessionId?: string;

  // Event & Tool Callbacks
  onSetupComplete?: () => void;
  onEvaluationCompleted?: (evaluation: VoiceEvaluationResult) => void;
  onWhiteboardUpdate?: (payload: WhiteboardUpdatePayload) => void;
  onBugSolved?: (payload: any) => void;
  onChaosInjected?: (payload: any) => void;
  onCandidateObservationRecorded?: (observation: any) => void;
  onHiringCommitteeVerdict?: (verdict: any) => void;
  onError?: (errorMsg: string) => void;
  onDisconnect?: () => void;
}

export interface LiveAudioSessionState {
  // Connection & lifecycle states
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isThinking: boolean;
  isMuted: boolean;
  isSessionPaused: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  thinkingStage: 'idle' | 'processing' | 'delayed' | 'critical';

  // Metrics
  rmsDb: number;
  rttMs: number | null;
  statusMessage: string;

  // Dialogue turns & transcript
  dialogueTurns: DialogueTurn[];
  aiTranscript: string;

  // Commands & Methods
  startSession: (overrideParams?: Partial<LiveAudioSessionOptions>) => Promise<void>;
  stopSession: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  toggleMic: () => void;
  toggleMute: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  handleBargeIn: (reason?: string) => void;
  finishManualTurn: () => void;
  sendTextMessage: (text: string, displayText?: string) => Promise<void>;
  injectCodeRevisionGrounding: (title: string, code: string, language?: string) => void;
  sendCanvasDelta: (payload: any) => void;

  // Raw audio buffer for background Deepgram STT
  getRecordedPcmBase64: () => string;
  clearRecordedPcm: () => void;

  // Direct ref access for audio visualizers
  playoutManagerRef: React.MutableRefObject<any>;
}
