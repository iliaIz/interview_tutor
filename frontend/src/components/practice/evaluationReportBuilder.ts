import { EvaluationResult } from '../../types/practice';

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

export interface GateState {
  gate: EvaluationGateType;
  status: EvaluationGateStatus;
  progressPercent: number;
  payload?: any;
}

export const INITIAL_GATES: Record<EvaluationGateType, GateState> = {
  JVM_UNIT_TESTS: { gate: 'JVM_UNIT_TESTS', status: 'PENDING', progressPercent: 0 },
  AST_INVARIANTS: { gate: 'AST_INVARIANTS', status: 'PENDING', progressPercent: 0 },
  MUTATION_TESTS: { gate: 'MUTATION_TESTS', status: 'PENDING', progressPercent: 0 },
  AI_EVALUATION: { gate: 'AI_EVALUATION', status: 'PENDING', progressPercent: 0 },
  PERSISTENCE: { gate: 'PERSISTENCE', status: 'PENDING', progressPercent: 0 }
};

export function buildEvaluationReport(payload: any, gates: Record<EvaluationGateType, GateState>): EvaluationResult {
  if (payload?.evaluation?.scoreBreakdown) {
    return payload.evaluation;
  }
  const testResults = payload?.testResults || gates.JVM_UNIT_TESTS.payload?.testResults;
  const astViolations = payload?.astViolations || gates.AST_INVARIANTS.payload?.astViolations || [];
  const aiFeedback = payload?.aiFeedback || gates.AI_EVALUATION.payload?.aiFeedback;
  const error = payload?.error || gates.JVM_UNIT_TESTS.payload?.error || gates.AST_INVARIANTS.payload?.error;

  const passed = testResults?.passed ?? 0;
  const failed = testResults?.failed ?? 0;
  const total = testResults?.total ?? (passed + failed);
  const score = aiFeedback?.score ?? (failed === 0 && passed > 0 ? 75 : 0);

  return {
    compilationStatus: {
      isCompilable: failed === 0 || passed > 0,
      syntaxErrors: []
    },
    virtualExecutionResult: {
      passCount: passed,
      failCount: failed,
      testCases: []
    },
    concurrencyAnalysis: {
      hasRaceConditions: false,
      hasJmmVisibilityIssues: false,
      hasCarrierThreadPinning: false,
      findings: []
    },
    architecturalCompliance: {
      isSolidCompliant: astViolations.length === 0,
      springBootBestPracticesViolations: aiFeedback?.missingPoints || [],
      modernJava21IdiomAdoption: aiFeedback?.positivePoints || []
    },
    scoreBreakdown: {
      correctnessScore: total > 0 ? Math.round((passed / total) * 100) : 0,
      concurrencyScore: 80,
      architectureScore: score,
      modernIdiomsScore: 80,
      overallScore: score,
      summaryReview: aiFeedback?.critique || error || 'Оценка решения завершена.'
    },
    evaluationTimestamp: new Date().toISOString(),
    astSignalsSummary: astViolations.map((v: any) => v.message || v.rule)
  };
}
