/**
 * Types for Spring Transaction Playground (@Transactional Lab) SOTA 2026
 */

export type PropagationType =
  | 'REQUIRED'
  | 'REQUIRES_NEW'
  | 'NESTED'
  | 'MANDATORY'
  | 'SUPPORTS'
  | 'NOT_SUPPORTED'
  | 'NEVER'
  | 'NONE';

export type IsolationLevel =
  | 'DEFAULT'
  | 'READ_COMMITTED'
  | 'REPEATABLE_READ'
  | 'SERIALIZABLE';

export interface TransactionAnnotationConfig {
  propagation: PropagationType;
  readOnly?: boolean;
  rollbackFor?: string[];
  isolation?: IsolationLevel;
  timeout?: number; // seconds
}

export interface ServiceMethodSpec {
  id: string;
  name: string;
  returnType: string;
  parameters: string;
  businessContract: string;
  codeSnippet: string;
  correctConfig: TransactionAnnotationConfig;
  traps: string[];
  explanation: string;
}

export interface ServiceClassSpec {
  className: string;
  methods: ServiceMethodSpec[];
}

export interface SimulatedLoadConfig {
  defaultThreads: number;
  poolCapacity: number;
  depthPerThread: number;
}

export interface ProbingQuestion {
  question: string;
  idealKeypoints: string[];
}

export interface TransactionScenario {
  id: string;
  title: string;
  domain: string;
  difficulty: 'Junior' | 'Middle' | 'Senior' | 'Lead';
  level: 'L0' | 'L1' | 'L2' | 'L3';
  badge: string;
  problemStatement: string;
  services: ServiceClassSpec[];
  simulatedLoad: SimulatedLoadConfig;
  probingQuestions: ProbingQuestion[];
}

export interface MethodEvaluationResult {
  methodId: string;
  isCorrect: boolean;
  score: number; // 0 to 100
  violations: string[];
  tips: string[];
}

export interface ScenarioEvaluationResult {
  scenarioId: string;
  overallScore: number; // 0 to 100
  isPassed: boolean;
  hasDeadlockHazard: boolean;
  hasSelfInvocationHazard: boolean;
  methodResults: Record<string, MethodEvaluationResult>;
  summary: string;
}
