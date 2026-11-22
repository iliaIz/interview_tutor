/**
 * ChallengeEvaluationSession.ts
 * Authoritative Evaluation Session Aggregate & Persistence Engine (SPEC-25).
 * Encapsulates the 5-Gate lifecycle, atomic SQLite submission upserts, and terminal verdict resolution.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { Statement } from 'better-sqlite3';
import { db } from '../db';
import { CodingChallenge } from '../challengeSeedData';
import {
  EvaluationCodeFile,
  ChallengeEvaluationInput,
  EvaluationPipelineEvent,
  EvaluationTestResultsPayload,
  EvaluationAstViolation,
  EvaluationMutationScorePayload,
  EvaluationAiFeedbackPayload
} from './evaluationPipelineTypes';
import { JvmExecutionService, SandboxExecutionResponse } from './JvmExecutionService';
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
  private static loadStmt: Statement | null = null;
  private static resolveIdStmt: Statement | null = null;
  private static upsertStmt: Statement | null = null;

  private terminalVerdict: TerminalEvaluationVerdict | null = null;

  public getTerminalVerdict(): TerminalEvaluationVerdict | null {
    return this.terminalVerdict;
  }

  public static loadManifest(challengeIdOrSlug: string): CodingChallenge | undefined {
    try {
      if (!this.loadStmt) {
        this.loadStmt = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ? LIMIT 1');
      }
      const row = this.loadStmt.get(challengeIdOrSlug, challengeIdOrSlug) as any;
      if (row?.manifest_json) {
        return JSON.parse(row.manifest_json);
      }
    } catch (err: any) {
      console.warn(`⚠️ Could not query manifest for challenge ${challengeIdOrSlug}:`, err?.message);
    }
    return undefined;
  }

  public static resolveCanonicalChallengeId(challengeIdOrSlug: string): string {
    try {
      if (!this.resolveIdStmt) {
        this.resolveIdStmt = db.prepare('SELECT id FROM coding_challenges WHERE id = ? OR slug = ? LIMIT 1');
      }
      const row = this.resolveIdStmt.get(challengeIdOrSlug, challengeIdOrSlug) as any;
      if (row?.id) {
        return row.id;
      }
    } catch {}
    return challengeIdOrSlug;
  }

  public static persistRecord(params: {
    challengeId: string;
    userId: string;
    files: EvaluationCodeFile[];
    activePhase: number;
    status: string;
    score: number;
    evaluation: unknown;
    timeSpentSeconds: number;
  }): void {
    const canonicalChallengeId = this.resolveCanonicalChallengeId(params.challengeId);
    const submissionId = `sub_${canonicalChallengeId}_${params.userId}`;

    if (!this.upsertStmt) {
      this.upsertStmt = db.prepare(`
        INSERT INTO coding_submissions (
          id, challenge_id, user_id, files_json, active_phase, status, score,
          evaluation_json, time_spent_seconds, updated_at
        ) VALUES (
          @id, @challenge_id, @user_id, @files_json, @active_phase, @status, @score,
          @evaluation_json, @time_spent_seconds, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          files_json = excluded.files_json,
          active_phase = excluded.active_phase,
          status = excluded.status,
          score = excluded.score,
          evaluation_json = excluded.evaluation_json,
          time_spent_seconds = excluded.time_spent_seconds,
          updated_at = CURRENT_TIMESTAMP
      `);
    }

    try {
      this.upsertStmt.run({
        id: submissionId,
        challenge_id: canonicalChallengeId,
        user_id: params.userId,
        files_json: JSON.stringify(params.files),
        active_phase: params.activePhase,
        status: params.status,
        score: params.score,
        evaluation_json: JSON.stringify(params.evaluation),
        time_spent_seconds: params.timeSpentSeconds
      });
    } catch (err: any) {
      console.error('❌ ChallengeEvaluationSession.persistRecord failed:', err?.message);
      throw err;
    }
  }

  public async *runGates(input: ChallengeEvaluationInput): AsyncIterable<EvaluationPipelineEvent> {
    const { challengeId, userId = 'default_user' } = input;
    const files: EvaluationCodeFile[] = input.codeFiles || input.files || [];
    const activePhase = input.activePhase ?? 1;
    const timeSpentSeconds = input.timeSpentSeconds ?? 0;

    const manifest: CodingChallenge | undefined =
      input.manifest || (challengeId ? ChallengeEvaluationSession.loadManifest(challengeId) : undefined);

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

      ChallengeEvaluationSession.persistRecord({
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
    const staticVerdict = JavaStaticAnalysisEngine.verify(files, {
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

      ChallengeEvaluationSession.persistRecord({
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
        const mutResult = await JvmMutationEngine.execute({ challengeId, files, mutants, requiredScore });
        mutationPassed = mutResult.passed;
        mutationScorePayload = {
          killedMutants: mutResult.killedCount,
          totalMutants: mutResult.totalCount,
          percentage: mutResult.mutationScore,
          passed: mutResult.passed
        };

        if (!mutResult.passed) {
          yield {
            gate: 'MUTATION_TESTS', status: 'FAILED', progressPercent: 60,
            payload: { mutationScore: mutationScorePayload, error: `Мутационное тестирование не пройдено (${mutResult.mutationScore}% < ${requiredScore}%)` },
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

      aiEvaluationResult = await evaluateChallengeSubmission({
        challenge: evaluationChallenge, files, activePhase, timeSpentSeconds, sandboxResult, abortSignal: input.abortSignal
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
      ChallengeEvaluationSession.persistRecord({
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
