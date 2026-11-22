import { CodingChallenge } from '../challengeSeedData';
import { evaluateChallengeSubmission, EvaluationResult } from '../codeEvaluator';
import { JvmExecutionService, SandboxExecutionResponse } from './JvmExecutionService';
import { RefactoringAstVerifier } from './RefactoringAstVerifier';
import { JvmMutationEngine } from './JvmMutationEngine';
import { EvaluationPipelinePersistence } from './evaluationPipelinePersistence';
import {
  ChallengeEvaluationInput,
  EvaluationCodeFile,
  EvaluationPipelineEvent,
  EvaluationAstViolation,
  EvaluationMutationScorePayload,
  EvaluationAiFeedbackPayload,
  EvaluationTestResultsPayload
} from './evaluationPipelineTypes';

/**
 * ChallengeEvaluationPipeline.ts
 * Authoritative 5-Gate Async Generator Pipeline for Challenge Evaluation (SPEC-004).
 * Decoupled from transport (SSE / WebSocket).
 *
 * Gate 1: JVM_UNIT_TESTS via JvmExecutionService
 * Gate 2: AST_INVARIANTS via RefactoringAstVerifier
 * Gate 3: MUTATION_TESTS via JvmMutationEngine
 * Gate 4: AI_EVALUATION via LiteLLM client (evaluateChallengeSubmission)
 * Gate 5: PERSISTENCE atomic write to SQLite database
 *
 * Cognitive Bounding Limit: <= 350 lines (Rule 8).
 * Strict Invariant: Zero Express imports in domain logic.
 */
export class ChallengeEvaluationPipeline {
  public static async *evaluate(
    input: ChallengeEvaluationInput
  ): AsyncIterable<EvaluationPipelineEvent> {
    const { challengeId, userId = 'default_user' } = input;
    const files: EvaluationCodeFile[] = input.codeFiles || input.files || [];
    const activePhase = input.activePhase ?? 1;
    const timeSpentSeconds = input.timeSpentSeconds ?? 0;

    const manifest: CodingChallenge | undefined =
      input.manifest || (challengeId ? EvaluationPipelinePersistence.loadManifest(challengeId) : undefined);

    if (input.abortSignal?.aborted) return;

    // Gate 1: JVM_UNIT_TESTS
    yield { gate: 'JVM_UNIT_TESTS', status: 'RUNNING', progressPercent: 10, timestamp: Date.now() };

    const isRefactoring = manifest?.category === 'refactoring_kata' || manifest?.category === 'design_patterns';
    let sandboxResult: SandboxExecutionResponse;
    try {
      sandboxResult = await JvmExecutionService.execute({ challengeId, files, activePhase, isRefactoring });
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
      EvaluationPipelinePersistence.persistRecord({
        challengeId, userId, files, activePhase, status: 'FAILED', score: 0,
        evaluation: failEval,
        timeSpentSeconds
      });

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

    // Gate 2: AST_INVARIANTS
    yield { gate: 'AST_INVARIANTS', status: 'RUNNING', progressPercent: 30, timestamp: Date.now() };
    const constraints = (input as any).structuralConstraints || (manifest as any)?.structuralConstraints || (manifest as any)?.designPatternContext?.structuralConstraints;
    const astResult = RefactoringAstVerifier.verify(files, constraints);
    const astViolations: EvaluationAstViolation[] = (astResult.violations || []).map(v => ({
      rule: v.rule, line: v.lineNumber, message: `${v.message} (${v.file}:${v.lineNumber})`
    }));

    if (!astResult.passed) {
      if (input.abortSignal?.aborted) return;
      const astEval = {
        compilationStatus: { isCompilable: true, syntaxErrors: [] },
        astViolations,
        scoreBreakdown: {
          overallScore: 30,
          summaryReview: `Отклонено Gate 2 AST: ${astViolations[0]?.message || 'нарушение инвариантов'}`
        }
      };
      EvaluationPipelinePersistence.persistRecord({
        challengeId, userId, files, activePhase, status: 'FAILED', score: 30,
        evaluation: astEval,
        timeSpentSeconds
      });

      yield {
        gate: 'AST_INVARIANTS', status: 'FAILED', progressPercent: 40,
        payload: {
          astViolations,
          evaluation: astEval,
          error: `Нарушены архитектурные AST-инварианты (${astViolations.length} нарушений).`
        },
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
        const requiredScore = manifest?.requiredMutationScore || 60;
        const mutationResult = await JvmMutationEngine.execute({ challengeId, files, mutants, requiredScore, timeoutMs: 8000 });
        const percentage = Math.round(mutationResult.mutationScore);
        mutationScorePayload = { killedMutants: mutationResult.killedCount, totalMutants: mutationResult.totalMutants, percentage };

        if (percentage < 60 || !mutationResult.passedThreshold) {
          mutationPassed = false;
          const hint = mutationResult.mutantResults?.filter(m => m.status === 'SURVIVED' && m.remediationHint).map(m => m.remediationHint).slice(0, 2).join(' ') || 'Добавьте тесты на граничные условия.';
          yield {
            gate: 'MUTATION_TESTS', status: 'FAILED', progressPercent: 60,
            payload: { mutationScore: mutationScorePayload, error: `Мутационный скор (${percentage}%) ниже порога 60%. Выжило мутантов: ${mutationResult.survivedCount}. ${hint}` },
            timestamp: Date.now()
          };
        } else {
          yield { gate: 'MUTATION_TESTS', status: 'PASSED', progressPercent: 60, payload: { mutationScore: mutationScorePayload }, timestamp: Date.now() };
        }
      } catch (mutationErr: any) {
        mutationPassed = false;
        yield { gate: 'MUTATION_TESTS', status: 'FAILED', progressPercent: 60, payload: { error: mutationErr?.message || 'Ошибка мутационных тестов' }, timestamp: Date.now() };
      }
    } else {
      yield { gate: 'MUTATION_TESTS', status: 'SKIPPED', progressPercent: 60, timestamp: Date.now() };
    }

    if (input.abortSignal?.aborted) return;

    // Gate 4: AI_EVALUATION
    yield { gate: 'AI_EVALUATION', status: 'RUNNING', progressPercent: 70, timestamp: Date.now() };
    let aiFeedbackPayload: EvaluationAiFeedbackPayload | undefined;
    let aiEvaluationResult: EvaluationResult | undefined;

    try {
      const evaluationChallenge: CodingChallenge = manifest || {
        id: challengeId, slug: challengeId, title: challengeId, category: 'machine_coding',
        badge: '⚡ Machine Coding', difficulty: 'Senior', targetStack: 'Java 21 LTS',
        timeLimitMinutes: 60, shortDescription: challengeId, instructionsMarkdown: '', workspaceFiles: []
      };

      aiEvaluationResult = await evaluateChallengeSubmission({
        challenge: evaluationChallenge, files, activePhase, timeSpentSeconds, sandboxResult, abortSignal: input.abortSignal
      });

      aiFeedbackPayload = {
        score: Math.round(aiEvaluationResult.scoreBreakdown?.overallScore ?? 75),
        critique: aiEvaluationResult.scoreBreakdown?.summaryReview || 'Код успешно прошел архитектурный аудит.',
        positivePoints: aiEvaluationResult.architecturalCompliance?.modernJava21IdiomAdoption || [],
        missingPoints: [
          ...(aiEvaluationResult.architecturalCompliance?.springBootBestPracticesViolations || []),
          ...(aiEvaluationResult.concurrencyAnalysis?.findings?.map(f => f.description) || [])
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
    const isPassed = testsPassed && astResult.passed && mutationPassed && finalScore >= 70 && !aiEvaluationResult?.concurrencyAnalysis?.hasCarrierThreadPinning;
    const finalStatus = isPassed ? 'PASSED' : 'FAILED';

    try {
      EvaluationPipelinePersistence.persistRecord({
        challengeId, userId, files, activePhase, status: finalStatus, score: finalScore,
        evaluation: { sandboxResult, astViolations, mutationScore: mutationScorePayload, aiFeedback: aiFeedbackPayload, aiEvaluationResult },
        timeSpentSeconds
      });

      yield {
        gate: 'PERSISTENCE', status: 'PASSED', progressPercent: 100,
        payload: {
          testResults: testResultsPayload,
          astViolations: astViolations.length > 0 ? astViolations : undefined,
          mutationScore: mutationScorePayload,
          aiFeedback: aiFeedbackPayload,
          evaluation: {
            ...aiEvaluationResult,
            compilationStatus: aiEvaluationResult?.compilationStatus || { isCompilable: testsPassed, syntaxErrors: sandboxResult.syntaxErrors || [] },
            scoreBreakdown: aiEvaluationResult?.scoreBreakdown || {
              overallScore: finalScore,
              summaryReview: aiFeedbackPayload?.critique || ''
            }
          }
        },
        timestamp: Date.now()
      };
    } catch (persistErr: any) {
      console.error('❌ Failed Gate 5 persistence:', persistErr?.message);
      yield { gate: 'PERSISTENCE', status: 'FAILED', progressPercent: 100, payload: { error: persistErr?.message || 'Persistence error' }, timestamp: Date.now() };
    }
  }
}

export default ChallengeEvaluationPipeline;
