import { AstSecurityScanner, SecurityViolation } from './AstSecurityScanner';
import { JvmDaemonClient } from './JvmDaemonClient';
import {
  JvmMutationEngine,
  MutantDefinition,
  MutantResult,
  MutationExecutionRequest,
  MutationExecutionResponse
} from './JvmMutationEngine';
import { TestQualityViolation } from './TestQualityScanner';

export {
  MutantDefinition,
  MutantResult,
  MutationExecutionRequest,
  MutationExecutionResponse,
  TestQualityViolation
};

export interface SandboxExecutionRequest {
  challengeId?: string;
  files: Array<{ path: string; content: string }>;
  activePhase?: number;
  timeoutMs?: number;
  isRefactoring?: boolean;
  skipPreScan?: boolean;
}

export interface TestCaseResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  durationMs: number;
  failureReason?: string;
}

export interface ConcurrencyReport {
  threadsRan: number;
  deadlockDetected: boolean;
  raceConditionDetected: boolean;
}

export interface SandboxExecutionResponse {
  success: boolean;
  isCompilable: boolean;
  compilationTimeMs: number;
  executionTimeMs: number;
  totalDurationMs: number;
  passedCount: number;
  failedCount: number;
  testResults: TestCaseResult[];
  concurrencyHarness?: ConcurrencyReport;
  syntaxErrors?: Array<{ lineNumber: number; errorMessage: string }>;
  securityViolations?: SecurityViolation[];
  error?: string;
}

/**
 * JvmExecutionService.ts
 * Authoritative Facade for In-Memory JVM Sandbox Compilation and Mutation Testing (< 80ms).
 * Decomposed into single-responsibility modules:
 * - JvmDaemonClient: Socket transport, connection resilience, fallback CLI.
 * - JvmMutationEngine: Mutation testing pipeline, mutant enrichment, and quality gating.
 * Cognitive bounding limit: <= 350 lines.
 */
export class JvmExecutionService {
  /**
   * Compiles and executes Java 21 code using In-Memory CompilerService
   */
  public static async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResponse> {
    JvmDaemonClient.ensureCompiled();
    const startTime = Date.now();

    // 1. Level 1 Defense: AST Security Pre-Scan
    if (!request.skipPreScan) {
      const scanResult = AstSecurityScanner.scan(request.files, { isRefactoring: request.isRefactoring });
      if (!scanResult.isSafe) {
        const primaryViolation = scanResult.violations[0];
        return {
          success: false,
          isCompilable: false,
          compilationTimeMs: 0,
          executionTimeMs: 0,
          totalDurationMs: Date.now() - startTime,
          passedCount: 0,
          failedCount: 1,
          testResults: [],
          securityViolations: scanResult.violations,
          error: `Нарушение политики безопасности: ${primaryViolation.message} (${primaryViolation.file}:${primaryViolation.lineNumber})`
        };
      }
    }

    // 2. Run Compiler (Hot Daemon -> Fallback CLI)
    const payloadJson = JSON.stringify({ files: request.files });
    const timeoutMs = request.timeoutMs || 10000;
    const { output, error } = await JvmDaemonClient.runCompiler(payloadJson, timeoutMs);

    if (error) {
      return {
        success: false,
        isCompilable: false,
        compilationTimeMs: 0,
        executionTimeMs: 0,
        totalDurationMs: Date.now() - startTime,
        passedCount: 0,
        failedCount: 1,
        testResults: [],
        error
      };
    }

    try {
      const parsed = JSON.parse(output);

      const concurrencyData = parsed.concurrencyDiagnostics || parsed.concurrencyHarness;
      const concurrencyHarness = concurrencyData ? {
        threadsRan: concurrencyData.concurrentThreadsRan ?? concurrencyData.threadsRan ?? 0,
        deadlockDetected: Boolean(concurrencyData.deadlockDetected),
        raceConditionDetected: Boolean(concurrencyData.raceConditionDetected)
      } : undefined;

      return {
        success: parsed.isCompilable && (parsed.failedCount === 0),
        isCompilable: Boolean(parsed.isCompilable),
        compilationTimeMs: parsed.compilationTimeMs || 0,
        executionTimeMs: parsed.executionTimeMs || 0,
        totalDurationMs: parsed.totalDurationMs || (Date.now() - startTime),
        passedCount: parsed.passedCount || 0,
        failedCount: parsed.failedCount || 0,
        testResults: parsed.testResults || [],
        concurrencyHarness,
        syntaxErrors: parsed.syntaxErrors,
        error: parsed.error
      };
    } catch {
      return {
        success: false,
        isCompilable: false,
        compilationTimeMs: 0,
        executionTimeMs: 0,
        totalDurationMs: Date.now() - startTime,
        passedCount: 0,
        failedCount: 1,
        testResults: [],
        error: `Некорректный вывод компилятора: ${output.slice(0, 300)}`
      };
    }
  }

  /**
   * Delegates mutation execution to JvmMutationEngine
   */
  public static async executeMutation(request: MutationExecutionRequest): Promise<MutationExecutionResponse> {
    return JvmMutationEngine.execute(request);
  }
}
