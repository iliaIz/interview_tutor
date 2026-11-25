import http from 'http';
import type { HrQuestionRubricItem } from '@interview-prep/shared';
import { TargetGrade } from '../../prompts/personas';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { CandidateGap, findRelevantCandidateGaps, getUserProfile } from '../vectorMemoryService';
import type { HrGuidedSessionState } from './hrGuidedStepper';

export interface AuthenticatedWsUser {
  id: string;
  name?: string;
  role?: 'owner' | 'user' | string;
  created_at?: string;
}

export interface ChallengeResolutionInput {
  challengeId: string;
  questionId: string;
  queryTopic?: string;
  queryBugTitle?: string;
  queryQuestionText?: string;
  queryReferenceAnswer?: string;
  queryBugExplanation?: string;
  queryFixedCode?: string;
  queryCodeSnippet?: string;
  queryChallengeCategory?: string;
  queryChallengeTrack?: string;
  queryActiveFilePath?: string;
}

export interface ResolvedChallengeContext {
  topic: string;
  bugTitle: string;
  questionText: string;
  referenceAnswer: string;
  bugExplanation: string;
  fixedCode: string;
  codeSnippet: string;
  challengeCategory: string;
  challengeTrack: string;
  workspaceManifest: any | null;
  activeFilePath: string;
}

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
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor';
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
  chunkId?: string;
  startBeatId?: string;
  beatScope?: 'all_from_beat' | 'single_beat';
  hrPersonaId?: any;
  targetQuestionId?: string;
  resumptionHandle?: string;
}

export type LiveSessionConfig = LiveSessionResolvedConfig;

export interface Turn0GreetingRuntime {
  seniorReview?: any;
  hrGuidedState?: HrGuidedSessionState | null;
  replayOverride?: string;
  hrQuestion?: HrQuestionRubricItem;
}

export interface LiveSessionBlueprint {
  readonly config: LiveSessionResolvedConfig;
  readonly systemPromptText: string;
  readonly toolDeclarations: any[];
  buildUpstreamSetup(resumptionHandle?: string): Record<string, unknown>;
  buildTurn0Greeting(runtime?: Turn0GreetingRuntime): string;
}

export interface BlueprintDependencies {
  authenticate?: (req: http.IncomingMessage, query: Record<string, unknown>) => AuthenticatedWsUser | null;
  findGaps?: typeof findRelevantCandidateGaps;
  getUserProfile?: typeof getUserProfile;
  resolveChallenge?: (input: ChallengeResolutionInput) => ResolvedChallengeContext;
}

export interface ResolveTurn0GreetingOptions {
  sessionType: string;
  tutorMode?: string;
  bugTitle?: string;
  questionText?: string;
  topic?: string;
  questionId?: string;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  initialUserMessage?: string;
  challengeCategory?: string;
  challengeTrack?: string;
  seniorReview?: any;
  hrMode?: string;
  startBeatId?: string;
  beatScope?: 'all_from_beat' | 'single_beat';
  hrGuidedState?: HrGuidedSessionState | null;
  hrQuestion?: HrQuestionRubricItem;
  replayOverride?: string;
}

export interface LiveSessionBlueprintParams {
  sessionId?: string;
  userId?: string;
  authenticatedUser?: AuthenticatedWsUser;
  sessionType?: LiveSessionResolvedConfig['sessionType'];
  tutorMode?: any;
  questionId?: string;
  challengeId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  bugTitle?: string;
  bugExplanation?: string;
  fixedCode?: string;
  codeSnippet?: string;
  unitTest?: string;
  incidentContext?: any;
  hints?: string[];
  parsedHints?: string[];
  challengeCategory?: string;
  challengeTrack?: string;
  activeFilePath?: string;
  workspaceManifest?: any;
  activeCodeArtifact?: any;
  codeRevisionsSummary?: any;
  academyCourse?: string;
  academyStep?: string;
  academyBridgeContext?: any;
  seniorReview?: any;
  voice?: string;
  voiceName?: string;
  userGender?: 'female' | 'male' | 'neutral';
  turnMode?: 'manual' | 'auto';
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  persona?: any;
  targetGrade?: TargetGrade;
  maxProbes?: number;
  deepDive?: boolean;
  liveCoaching?: boolean;
  strictness?: StrictnessLevel;
  customPromptOverride?: string;
  customPrompt?: string;
  customAnchors?: string[];
  anchors?: string[];
  initialUserMessage?: string;
  temperature?: number;
  questionIndex?: number;
  totalQuestions?: number;
  isRetry?: boolean;
  isResumed?: boolean;
  initialProbesCount?: number;
  liveModel?: string;
  vadPauseMs?: number;
  enableSilenceClarification?: boolean;
  debugStep?: number;
  hrMode?: any;
  hrPersonaId?: any;
  chunkId?: string;
  startBeatId?: string;
  beatScope?: 'all_from_beat' | 'single_beat';
  resumptionHandle?: string;
  rawInitFrame?: any;
}
