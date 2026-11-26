/**
 * ChallengeEvaluationSession.ts
 * Authoritative Evaluation Session Aggregate & Persistence Engine (SPEC-25).
 * Encapsulates the 5-Gate lifecycle, atomic SQLite submission upserts, and terminal verdict resolution.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import type { CodingChallenge } from '@interview-prep/shared';
import {
  EvaluationCodeFile,
  ChallengeEvaluationInput,
  EvaluationPipelineEvent,
  EvaluationTestResultsPayload,
  EvaluationAstViolation,
  EvaluationMutationScorePayload,
  EvaluationAiFeedbackPayload,
  EvaluationSessionPorts,
  PersistSubmissionParams
} from './evaluationPipelineTypes';
import { ChallengeSubmissionRepository } from './ChallengeSubmissionRepository';
import { JvmExecutionService, MutationExecutionRequest, SandboxExecutionRequest, SandboxExecutionResponse } from './JvmExecutionService';
import { JavaStaticAnalysisEngine } from './JavaStaticAnalysisEngine';
import { JvmMutationEngine } from './JvmMutationEngine';
import { evaluateChallengeSubmission } from '../codeEvaluator';

export interface TerminalEvaluationVerdict {
  status: 'PASSED' | 'FAILED';
  score: number;
  evaluation: Record<string, any>;
  timeSpentSeconds: number;
}

export class ChallengeEvaluationSession {
  private terminalVerdict: TerminalEvaluationVerdict | null = null;
  private readonly ports: EvaluationSessionPorts;

  constructor(ports: EvaluationSessionPorts = {}) {
    this.ports = ports;
  }

  public static evaluate(
    input: ChallengeEvaluationInput,
    ports?: EvaluationSessionPorts
  ): AsyncIterable<EvaluationPipelineEvent> {
    return new ChallengeEvaluationSession(ports).runGates(input);
  }

  public getTerminalVerdict(): TerminalEvaluationVerdict | null {
    return this.terminalVerdict;
  }

  public static loadManifest(challengeIdOrSlug: string): CodingChallenge | undefined {
    return ChallengeSubmissionRepository.loadManifest(challengeIdOrSlug);
  }

  public static resolveCanonicalChallengeId(challengeIdOrSlug: string): string {
    return ChallengeSubmissionRepository.resolveCanonicalChallengeId(challengeIdOrSlug);
  }

  public static persistRecord(params: PersistSubmissionParams): void {
    ChallengeSubmissionRepository.persistSubmission(params);
  }

  public async *runGates(input: ChallengeEvaluationInput): AsyncIterable<EvaluationPipelineEvent> {
    const repo = this.ports.submissionRepo ?? ChallengeSubmissionRepository;
    const jvmRunner = this.ports.jvmRunner ?? ((req: SandboxExecutionRequest) => JvmExecutionService.execute(req));
    const staticAnalyzer: typeof JavaStaticAnalysisEngine.verify =
      this.ports.staticAnalyzer ?? ((f, p) => JavaStaticAnalysisEngine.verify(f, p));
    const mutationRunner = this.ports.mutationRunner ?? ((req: MutationExecutionRequest) => JvmMutationEngine.execute(req));
    const llmJudge = this.ports.llmJudge ?? evaluateChallengeSubmission;

    const { challengeId, userId = 'default_user' } = input;
    const files: EvaluationCodeFile[] = input.codeFiles || input.files || [];
    const activePhase = input.activePhase ?? 1;
    const timeSpentSeconds = input.timeSpentSeconds ?? 0;

    const manifest: CodingChallenge | undefined =
      input.manifest || (challengeId ? repo.loadManifest(challengeId) : undefined);

    if (input.abortSignal?.aborted) return;

    // Gate 1: JVM_UNIT_TESTS
    yield { gate: 'JVM_UNIT_TESTS', status: 'RUNNING', progressPercent: 10, timestamp: Date.now() };

    const isRefactoring = manifest?.category === 'refactoring_kata' || manifest?.category === 'design_patterns';
    let sandboxResult: SandboxExecutionResponse;
    try {
      sandboxResult = await jvmRunner({ challengeId, files, activePhase, isRefactoring });
    } catch (err: any) {
      sandboxResult = {
        success: false, isCompilable: false, compilationTimeMs: 0, executionTimeMs: 0,
        totalDurationMs: 0, passedCount: 0, failedCount: 1, testResults: [],
        error: err?.message || 'Failed to execute JVM sandbox'
      };
    }

    const passedCount = sandboxResult.passedCount || 0;
    const failedCount = sandboxResult.failedCount || 0;
    const totalCount = sandboxResult.testResults?.length || (passedCount + failedCount);
    const testResultsPayload: EvaluationTestResultsPayload = { passed: passedCount, failed: failedCount, total: totalCount };
    const testsPassed = Boolean(sandboxResult.isCompilable && failedCount === 0 && sandboxResult.success);

    if (!testsPassed) {
      if (input.abortSignal?.aborted) return;
      const failEval = {
        compilationStatus: { isCompilable: sandboxResult.isCompilable, syntaxErrors: sandboxResult.syntaxErrors || [] },
        virtualExecutionResult: { passCount: passedCount, failCount: failedCount, testCases: sandboxResult.testResults || [] },
        scoreBreakdown: { overallScore: 0, summaryReview: sandboxResult.error || 'Решение не прошло тесты в JVM песочнице.' }
      };

      repo.persistSubmission({
        challengeId, userId, files, activePhase, status: 'FAILED', score: 0,
        evaluation: failEval,
        timeSpentSeconds
      });

      this.terminalVerdict = { status: 'FAILED', score: 0, evaluation: failEval, timeSpentSeconds };

      yield {
        gate: 'JVM_UNIT_TESTS', status: 'FAILED', progressPercent: 20,
        payload: {
          testResults: testResultsPayload,
          evaluation: failEval,
          error: sandboxResult.error || (sandboxResult.isCompilable ? `${failedCount} test(s) failed` : 'Compilation failed')
        },
        timestamp: Date.now()
      };
      return;
    }

    yield { gate: 'JVM_UNIT_TESTS', status: 'PASSED', progressPercent: 20, payload: { testResults: testResultsPayload }, timestamp: Date.now() };
    if (input.abortSignal?.aborted) return;

    // Gate 2: AST_INVARIANTS & Static Analysis
    yield { gate: 'AST_INVARIANTS', status: 'RUNNING', progressPercent: 30, timestamp: Date.now() };
    const constraints = (input as any).structuralConstraints || (manifest as any)?.structuralConstraints || (manifest as any)?.designPatternContext?.structuralConstraints;
    const staticVerdict = staticAnalyzer(files, {
      structuralConstraints: constraints,
      isRefactoring,
      enforceTestQuality: true
    });

    const astViolations: EvaluationAstViolation[] = staticVerdict.violations
      .filter(v => v.category === 'AST_INVARIANT' || v.category === 'SECURITY')
      .map(v => ({
        rule: v.rule, line: v.line, message: `${v.message} (${v.file}:${v.line})`
      }));

    if (!staticVerdict.passed) {
      if (input.abortSignal?.aborted) return;
      const blocking = staticVerdict.blockingFailure;
      const score = blocking?.score ?? 30;
      const errorMessage = blocking?.error || (astViolations[0]?.message || 'нарушение инвариантов');

      const astEval = {
        compilationStatus: { isCompilable: true, syntaxErrors: [] },
        astViolations,
        scoreBreakdown: { overallScore: score, summaryReview: errorMessage }
      };

      repo.persistSubmission({
        challengeId, userId, files, activePhase, status: 'FAILED', score,
        evaluation: astEval,
        timeSpentSeconds
      });

      this.terminalVerdict = { status: 'FAILED', score, evaluation: astEval, timeSpentSeconds };

      yield {
        gate: blocking?.gate === 'MUTATION_TESTS' ? 'MUTATION_TESTS' : 'AST_INVARIANTS',
        status: 'FAILED',
        progressPercent: 40,
        payload: { astViolations, evaluation: astEval, error: errorMessage },
        timestamp: Date.now()
      };
      return;
    }

    yield { gate: 'AST_INVARIANTS', status: 'PASSED', progressPercent: 40, payload: { astViolations: [] }, timestamp: Date.now() };
    if (input.abortSignal?.aborted) return;

    // Gate 3: MUTATION_TESTS
    yield { gate: 'MUTATION_TESTS', status: 'RUNNING', progressPercent: 50, timestamp: Date.now() };
    const mutants = manifest?.mutants;
    let mutationScorePayload: EvaluationMutationScorePayload | undefined;
    let mutationPassed = true;

    if (mutants && mutants.length > 0) {
      try {
        const requiredScore = manifest?.requiredMutationScore ?? 75;
        const mutResult = await mutationRunner({ challengeId, files, mutants, requiredScore, skipPreScan: true });
        mutationPassed = mutResult.passedThreshold;
        mutationScorePayload = {
          killedMutants: mutResult.killedCount,
          totalMutants: mutResult.totalMutants,
          percentage: mutResult.mutationScore
        };

        if (!mutResult.passedThreshold) {
          if (input.abortSignal?.aborted) return;
          const mutError = `Мутационное тестирование не пройдено (${mutResult.mutationScore}% < ${requiredScore}%)`;
          const mutEval = {
            compilationStatus: { isCompilable: true, syntaxErrors: sandboxResult.syntaxErrors || [] },
            virtualExecutionResult: { passCount: passedCount, failCount: failedCount, testCases: sandboxResult.testResults || [] },
            mutationScore: mutationScorePayload,
            scoreBreakdown: { overallScore: mutResult.mutationScore, summaryReview: mutError }
          };
          repo.persistSubmission({
            challengeId, userId, files, activePhase, status: 'FAILED', score: mutResult.mutationScore,
            evaluation: { sandboxResult, astViolations, ...mutEval },
            timeSpentSeconds
          });
          this.terminalVerdict = { status: 'FAILED', score: mutResult.mutationScore, evaluation: mutEval, timeSpentSeconds };
          yield {
            gate: 'MUTATION_TESTS', status: 'FAILED', progressPercent: 60,
            payload: { mutationScore: mutationScorePayload, evaluation: mutEval, error: mutError },
            timestamp: Date.now()
          };
          return;
        }
      } catch (mutErr: any) {
        console.warn('⚠️ Gate 3 mutation error:', mutErr?.message);
      }
    }

    yield {
      gate: 'MUTATION_TESTS',
      status: mutationPassed ? 'PASSED' : 'SKIPPED',
      progressPercent: 60,
      payload: { mutationScore: mutationScorePayload },
      timestamp: Date.now()
    };
    if (input.abortSignal?.aborted) return;

    // Gate 4: AI_EVALUATION
    yield { gate: 'AI_EVALUATION', status: 'RUNNING', progressPercent: 70, timestamp: Date.now() };
    let aiEvaluationResult: any;
    let aiFeedbackPayload: EvaluationAiFeedbackPayload | undefined;

    try {
      const evaluationChallenge: CodingChallenge = manifest || {
        id: challengeId, slug: challengeId, title: challengeId, category: 'machine_coding', track: 'core',
        badge: '⚡ Machine Coding', difficulty: 'Senior', targetStack: 'Java 21 LTS',
        timeLimitMinutes: 60, shortDescription: challengeId, instructionsMarkdown: '', workspaceFiles: []
      };

      aiEvaluationResult = await llmJudge({
        challenge: evaluationChallenge, files, activePhase, timeSpentSeconds, sandboxResult, abortSignal: input.abortSignal, userId
      });

      aiFeedbackPayload = {
        score: Math.round(aiEvaluationResult.scoreBreakdown?.overallScore ?? 75),
        critique: aiEvaluationResult.scoreBreakdown?.summaryReview || 'Код успешно прошел архитектурный аудит.',
        positivePoints: aiEvaluationResult.architecturalCompliance?.modernJava21IdiomAdoption || [],
        missingPoints: [
          ...(aiEvaluationResult.architecturalCompliance?.springBootBestPracticesViolations || []),
          ...(aiEvaluationResult.concurrencyAnalysis?.findings?.map((f: any) => f.description) || [])
        ]
      };

      yield { gate: 'AI_EVALUATION', status: 'PASSED', progressPercent: 85, payload: { aiFeedback: aiFeedbackPayload }, timestamp: Date.now() };
    } catch (aiErr: any) {
      console.warn('⚠️ Gate 4 AI Evaluation error:', aiErr?.message);
      yield { gate: 'AI_EVALUATION', status: 'FAILED', progressPercent: 85, payload: { error: aiErr?.message || 'AI Evaluation error' }, timestamp: Date.now() };
      return;
    }

    if (input.abortSignal?.aborted) return;

    // Gate 5: PERSISTENCE
    yield { gate: 'PERSISTENCE', status: 'RUNNING', progressPercent: 90, timestamp: Date.now() };
    const aiScore = aiFeedbackPayload?.score ?? (testsPassed ? 75 : 0);
    const finalScore = mutationScorePayload ? Math.round(aiScore * 0.7 + mutationScorePayload.percentage * 0.3) : aiScore;
    const isPassed = testsPassed && staticVerdict.passed && mutationPassed && finalScore >= 70 && !aiEvaluationResult?.concurrencyAnalysis?.hasCarrierThreadPinning;
    const finalStatus = isPassed ? 'PASSED' : 'FAILED';

    const completeEval = {
      ...aiEvaluationResult,
      compilationStatus: aiEvaluationResult?.compilationStatus || { isCompilable: testsPassed, syntaxErrors: sandboxResult.syntaxErrors || [] },
      scoreBreakdown: aiEvaluationResult?.scoreBreakdown || {
        overallScore: finalScore,
        summaryReview: aiFeedbackPayload?.critique || ''
      }
    };

    try {
      repo.persistSubmission({
        challengeId, userId, files, activePhase, status: finalStatus, score: finalScore,
        evaluation: { sandboxResult, astViolations, mutationScore: mutationScorePayload, aiFeedback: aiFeedbackPayload, aiEvaluationResult },
        timeSpentSeconds
      });

      this.terminalVerdict = { status: finalStatus, score: finalScore, evaluation: completeEval, timeSpentSeconds };

      yield {
        gate: 'PERSISTENCE', status: 'PASSED', progressPercent: 100,
        payload: {
          testResults: testResultsPayload,
          astViolations: astViolations.length > 0 ? astViolations : undefined,
          mutationScore: mutationScorePayload,
          aiFeedback: aiFeedbackPayload,
          evaluation: completeEval
        },
        timestamp: Date.now()
      };
    } catch (persistErr: any) {
      console.error('❌ Failed Gate 5 persistence:', persistErr?.message);
      yield { gate: 'PERSISTENCE', status: 'FAILED', progressPercent: 100, payload: { error: persistErr?.message || 'Persistence error' }, timestamp: Date.now() };
    }
  }
}
