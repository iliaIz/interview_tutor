import { CodingChallenge } from './challengeSeedData';
import { SandboxExecutionResponse } from './sandbox/JvmExecutionService';
import { ConcurrencyFinding } from './codeEvaluatorSchema';

export interface EvaluationRequest {
  challenge: CodingChallenge;
  files: { path: string; content: string }[];
  activePhase: number;
  timeSpentSeconds?: number;
  sandboxResult?: SandboxExecutionResponse;
  abortSignal?: AbortSignal;
}

export interface TestCaseResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'EXECUTION_ERROR';
  inputData: string;
  expectedOutput: string;
  actualVirtualOutput: string;
  failureReason?: string;
}

export interface EvaluationResult {
  compilationStatus: {
    isCompilable: boolean;
    syntaxErrors: { lineNumber: number; errorMessage: string }[];
  };
  virtualExecutionResult: {
    passCount: number;
    failCount: number;
    testCases: TestCaseResult[];
  };
  concurrencyAnalysis: {
    hasRaceConditions: boolean;
    hasJmmVisibilityIssues: boolean;
    hasCarrierThreadPinning: boolean;
    findings: ConcurrencyFinding[];
  };
  architecturalCompliance: {
    isSolidCompliant: boolean;
    springBootBestPracticesViolations: string[];
    modernJava21IdiomAdoption: string[];
  };
  scoreBreakdown: {
    correctnessScore: number;
    concurrencyScore: number;
    architectureScore: number;
    modernIdiomsScore: number;
    overallScore: number;
    summaryReview: string;
  };
  evaluationTimestamp: string;
  astSignalsSummary: string[];
}
