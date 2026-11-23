import { TargetGrade } from '../../prompts/personas';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { CandidateGap } from '../vectorMemoryService';

export interface LiveSessionPromptConfig {
  voiceName: string;
  userGender: 'female' | 'male' | 'neutral';
  turnMode: 'manual' | 'auto';
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  persona: any;
  targetGrade: TargetGrade;
  maxProbes: number;
  deepDive: boolean;
  liveCoaching: boolean;
  strictness?: StrictnessLevel;
  customPromptOverride: string;
  anchors: string[];
  initialUserMessage: string;
  temperature?: number;
}

export interface LiveSessionResolvedConfig extends LiveSessionPromptConfig {
  sessionId: string;
  userId: string;
  authenticatedUser: any;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill';
  tutorMode: any;
  questionId: string;
  topic: string;
  questionText: string;
  referenceAnswer: string;
  challengeCategory: string;
  challengeTrack: string;
  manifest?: any;
  workspaceManifest?: any;
  activeFilePath?: string;
  bugTitle: string;
  bugExplanation: string;
  codeSnippet: string;
  fixedCode: string;
  unitTest: string;
  incidentContext: any;
  parsedHints: string[];
  activeCodeArtifact: any;
  codeRevisionsSummary: any;
  academyBridgeContext?: any;
  seniorReview?: any;
  questionIndex: number;
  totalQuestions: number;
  isRetry: boolean;
  isResumed: boolean;
  initialProbesCount: number;
  promptConfig: LiveSessionPromptConfig;
  candidateGaps: CandidateGap[];
  relevantGapIds: string[];
  userProfile: any;
  liveModel: string;
  upstreamWsUrl: string;
  vadPauseMs: number;
  enableSilenceClarification: boolean;
  debugStep?: number;
  academyCourse?: string;
  academyStep?: string;
  candidateDossier?: any;
  jobContext?: any;
  hrQuestion?: any;
  hrMode?: any;
  targetQuestionId?: string;
  resumptionHandle?: string;
}

export type LiveSessionConfig = LiveSessionResolvedConfig;
