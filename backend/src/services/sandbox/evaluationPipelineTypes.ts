import type { CodingChallenge } from '@interview-prep/shared';
import type { SandboxExecutionRequest, SandboxExecutionResponse } from './JvmExecutionService';
import type { MutationExecutionRequest, MutationExecutionResponse } from './JvmMutationEngine';
import type { JavaStaticAnalysisEngine } from './JavaStaticAnalysisEngine';
import type { EvaluationRequest, EvaluationResult } from '../codeEvaluatorTypes';
import type { ChallengeSubmissionRepository } from './ChallengeSubmissionRepository';

/**
 * Stages/Gates executed during the multi-pass challenge evaluation pipeline.
 */
export type EvaluationGateType =
  | 'JVM_UNIT_TESTS'
  | 'AST_INVARIANTS'
  | 'MUTATION_TESTS'
  | 'AI_EVALUATION'
  | 'PERSISTENCE';

export type EvaluationGateStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'SKIPPED';

export interface EvaluationTestResultsPayload {
  passed: number;
  failed: number;
  total: number;
}

export interface EvaluationAstViolation {
  rule: string;
  line: number;
  message: string;
}

export interface EvaluationMutationScorePayload {
  killedMutants: number;
  totalMutants: number;
  percentage: number;
}

export interface EvaluationAiFeedbackPayload {
  score: number;
  critique: string;
  positivePoints: string[];
  missingPoints: string[];
}

export interface EvaluationPipelinePayload {
  testResults?: EvaluationTestResultsPayload;
  astViolations?: EvaluationAstViolation[];
  mutationScore?: EvaluationMutationScorePayload;
  aiFeedback?: EvaluationAiFeedbackPayload;
  evaluation?: any;
  error?: string;
}

/**
 * Transport-agnostic evaluation event envelope streamed by the evaluation engine.
 * Decoupled from HTTP SSE and WebSockets.
 */
export interface EvaluationPipelineEvent {
  gate: EvaluationGateType;
  status: EvaluationGateStatus;
  progressPercent: number;
  payload?: EvaluationPipelinePayload;
  timestamp: number;
}

export interface EvaluationCodeFile {
  path: string;
  content: string;
}

/**
 * Pure domain input struct for the ChallengeEvaluationPipeline seam.
 * Strict invariant: ZERO Express Request or Response imports.
 */
export interface ChallengeEvaluationInput {
  challengeId: string;
  userId: string;
  codeFiles: EvaluationCodeFile[];
  /** Optional alias for codeFiles for backward compatibility with existing callers */
  files?: EvaluationCodeFile[];
  manifest?: CodingChallenge;
  activePhase?: number;
  timeSpentSeconds?: number;
  abortSignal?: AbortSignal;
}

export type EvaluationInput = ChallengeEvaluationInput;

export interface PersistSubmissionParams {
  challengeId: string;
  userId: string;
  files: EvaluationCodeFile[];
  activePhase: number;
  status: string;
  score: number;
  evaluation: unknown;
  timeSpentSeconds: number;
}

export interface CanonicalPersistedEvaluation {
  schemaVersion: 2;
  status: 'PASSED' | 'FAILED';
  compilationStatus: {
    isCompilable: boolean;
    syntaxErrors: Array<{ lineNumber: number; errorMessage: string }>;
  };
  sandboxResult?: SandboxExecutionResponse;
  astViolations?: EvaluationAstViolation[];
  mutationScore?: EvaluationMutationScorePayload;
  aiFeedback?: EvaluationAiFeedbackPayload;
  aiEvaluationResult?: EvaluationResult;
  scoreBreakdown: {
    overallScore: number;
    summaryReview: string;
    [k: string]: unknown;
  };
}

export type WorkspaceValidationErrorCode =
  | 'INVALID_FILES'
  | 'EMPTY_FILES'
  | 'MAX_FILES_EXCEEDED'
  | 'MAX_FILE_BYTES_EXCEEDED';

export interface ValidateWorkspaceFilesOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  allowEmpty?: boolean;
}

/** Injectable ports for testing ChallengeEvaluationSession deterministically without real JVM/LLM/SQLite. */
export interface EvaluationSessionPorts {
  jvmRunner?: (req: SandboxExecutionRequest) => Promise<SandboxExecutionResponse>;
  mutationRunner?: (req: MutationExecutionRequest) => Promise<MutationExecutionResponse>;
  staticAnalyzer?: typeof JavaStaticAnalysisEngine.verify;
  llmJudge?: (req: EvaluationRequest) => Promise<EvaluationResult>;
  submissionRepo?: Pick<typeof ChallengeSubmissionRepository, 'loadManifest' | 'persistSubmission'>;
}
