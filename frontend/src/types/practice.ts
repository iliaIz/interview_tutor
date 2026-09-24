export type ChallengeCategory = 'all' | 'machine_coding' | 'lld_bigtech' | 'lld_fintech' | 'lld_concurrency' | 'refactoring_kata' | 'concurrency_lab' | 'java21_idioms' | 'testing_mutation' | 'spring_transactions';

export interface MutantDefinition {
  id: string;
  name: string;
  description?: string;
  mutatorType?: string;
  file: string;
  line: number;
  mutatedContent?: string;
}

export interface MutantResult {
  id?: string;
  mutantId: string;
  name: string;
  file: string;
  line: number;
  status: 'KILLED' | 'SURVIVED' | 'STILLBORN';
  killedBy?: string;
  failureReason?: string;
  mutatorType?: string;
  description?: string;
  mutatedContent?: string;
  originalContent?: string;
  remediationHint?: string;
}

export interface TestQualityViolation {
  rule: string;
  file: string;
  lineNumber: number;
  snippet: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface MutationExecutionResponse {
  isMutationRun: true;
  baselinePassed: boolean;
  totalMutants: number;
  validMutants?: number;
  killedCount: number;
  survivedCount: number;
  stillbornCount?: number;
  mutationScore: number;
  passedThreshold: boolean;
  requiredScore: number;
  executionTimeMs: number;
  mutantResults: MutantResult[];
  qualityViolations?: TestQualityViolation[];
  error?: string;
}

export interface FileNode {
  path: string;
  content: string;
  readOnly: boolean;
  hidden: boolean;
  isMainEntryPoint?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  phase: number;
  weight: number;
  timeoutMs: number;
  input?: string;
  expectedOutput?: string;
  assertionScript?: string;
  isHidden: boolean;
}

export interface PhasedRequirement {
  phase: number;
  unlockTimeMinutes: number;
  title: string;
  descriptionMarkdown: string;
  addedFiles: FileNode[];
  testCases: TestCase[];
}

export interface GoldenMasterConfig {
  enabled: boolean;
  approvedSnapshotPath: string;
  receivedSnapshotPath: string;
  snapshotGeneratorClass: string;
  simulatedIterations: number;
  ignoreLineEndings: boolean;
  sampleBaselineText?: string;
}

export interface ConcurrencyHarnessConfig {
  enabled: boolean;
  useVirtualThreads: boolean;
  concurrentThreadCount: number;
  executionTimeoutMs: number;
  detectCarrierThreadPinning: boolean;
  detectThreadLeaks: boolean;
  stressLoopCount: number;
}

export interface JavaIdiomRequirements {
  requireSealedClasses?: boolean;
  requireRecords?: boolean;
  requirePatternMatching?: boolean;
  disallowSynchronizedKeyword?: boolean;
}

export type ChallengeCompletionStatus = 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';

export interface CodingChallenge {
  id: string;
  slug: string;
  title: string;
  taskCode?: string;
  category: string;
  track?: string;
  badge: string;
  difficulty: 'Junior' | 'Middle' | 'Senior' | 'Lead' | 'middle' | 'senior' | 'lead';
  targetStack: string;
  techStack?: string;
  architecturePattern?: string;
  timeLimitMinutes: number;
  shortDescription: string;
  instructionsMarkdown: string;
  scenarioMarkdown?: string;
  workspaceFiles?: FileNode[];
  phases?: PhasedRequirement[];
  phasedRequirements?: PhasedRequirement[];
  goldenMasterConfig?: GoldenMasterConfig;
  enforceSeamValidation?: boolean;
  allowedPublicSignatureChanges?: number;
  concurrencyConfig?: ConcurrencyHarnessConfig;
  idiomRequirements?: JavaIdiomRequirements;
  challengeMode?: 'machine_coding' | 'write_the_tests';
  requiredMutationScore?: number;
  mutants?: MutantDefinition[];
  astRules?: string[];
  hints?: string[];
  scoringWeights?: {
    functionalCorrectness: number;
    concurrencySafety: number;
    architectureAndCleanCode: number;
    modernIdioms: number;
  };
  isCompleted?: boolean;
  status?: ChallengeCompletionStatus;
  lastScore?: number;
  lastStatus?: string;
  timeSpentSeconds?: number;
  completedAt?: string;
}


export interface TestCaseResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'EXECUTION_ERROR';
  inputData: string;
  expectedOutput: string;
  actualVirtualOutput: string;
  failureReason?: string;
}

export interface ConcurrencyFinding {
  category: 'RACE_CONDITION' | 'NON_ATOMIC_COMPOUND' | 'JMM_VISIBILITY' | 'CARRIER_THREAD_PINNING' | 'DEADLOCK_RISK';
  location: string;
  description: string;
  remediation: string;
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

export interface SandboxExecutionResponse {
  success: boolean;
  isCompilable: boolean;
  compilationTimeMs: number;
  executionTimeMs: number;
  totalDurationMs: number;
  passedCount: number;
  failedCount: number;
  testResults: Array<{
    testName: string;
    status: 'PASSED' | 'FAILED' | 'ERROR';
    durationMs: number;
    failureReason?: string;
  }>;
  concurrencyHarness?: {
    threadsRan: number;
    deadlockDetected: boolean;
    raceConditionDetected: boolean;
  };
  syntaxErrors?: Array<{ lineNumber: number; errorMessage: string }>;
  securityViolations?: Array<{
    rule: string;
    file: string;
    lineNumber: number;
    snippet: string;
    message: string;
  }>;
  error?: string;
}
