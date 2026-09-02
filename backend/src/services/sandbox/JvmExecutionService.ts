import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { AstSecurityScanner, SecurityViolation } from './AstSecurityScanner';
import { TestQualityScanner, TestQualityViolation } from './TestQualityScanner';

export interface SandboxExecutionRequest {
  challengeId?: string;
  files: Array<{ path: string; content: string }>;
  activePhase?: number;
  timeoutMs?: number;
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

export interface MutantDefinition {
  id: string;
  name: string;
  description?: string;
  mutatorType?: string;
  file: string;
  line: number;
  mutatedContent: string;
}

export interface MutantResult {
  mutantId: string;
  name: string;
  file: string;
  line: number;
  status: 'KILLED' | 'SURVIVED';
  killedBy?: string;
  failureReason?: string;
}

export interface MutationExecutionRequest {
  challengeId?: string;
  files: Array<{ path: string; content: string }>;
  mutants: MutantDefinition[];
  requiredScore?: number;
  timeoutMs?: number;
}

export interface MutationExecutionResponse {
  isMutationRun: true;
  baselinePassed: boolean;
  totalMutants: number;
  killedCount: number;
  survivedCount: number;
  mutationScore: number;
  passedThreshold: boolean;
  requiredScore: number;
  executionTimeMs: number;
  mutantResults: MutantResult[];
  qualityViolations?: TestQualityViolation[];
  error?: string;
}

export class JvmExecutionService {
  private static binPath = path.resolve(__dirname, '../../../bin');

  private static ensureCompiled(): void {
    const classFile = path.join(this.binPath, 'com/assessment/sandbox/CompilerService.class');
    if (!fs.existsSync(classFile)) {
      const sourceFile = path.resolve(__dirname, 'runner/CompilerService.java');
      if (!fs.existsSync(this.binPath)) {
        fs.mkdirSync(this.binPath, { recursive: true });
      }
      try {
        require('child_process').execSync(`javac -d "${this.binPath}" "${sourceFile}"`);
      } catch (e) {
        console.error('Failed to precompile CompilerService.java:', e);
      }
    }
  }

  /**
   * Compiles and executes Java 21 code using In-Memory CompilerService
   */
  public static async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResponse> {
    this.ensureCompiled();
    const startTime = Date.now();

    // 1. Level 1 Defense: AST Security Pre-Scan
    const scanResult = AstSecurityScanner.scan(request.files);
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

    // 2. Prepare JSON input payload
    const tempFilePath = path.join(os.tmpdir(), `sandbox_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`);
    const payloadJson = JSON.stringify({ files: request.files });
    fs.writeFileSync(tempFilePath, payloadJson, 'utf-8');

    const timeoutMs = request.timeoutMs || 4000;

    return new Promise((resolve) => {
      // Execute compiled CompilerService with lightweight heap limits
      execFile(
        'java',
        ['-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-cp', this.binPath, 'com.assessment.sandbox.CompilerService', tempFilePath],
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          // Clean up temp file safely
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch {}

          if (error) {
            if (error.killed) {
              return resolve({
                success: false,
                isCompilable: true,
                compilationTimeMs: 0,
                executionTimeMs: timeoutMs,
                totalDurationMs: Date.now() - startTime,
                passedCount: 0,
                failedCount: 1,
                testResults: [],
                error: `Превышен лимит времени выполнения (${timeoutMs} мс). Возможен бесконечный цикл или deadlock!`
              });
            }

            console.error('CompilerService execution error:', error, stderr);
            return resolve({
              success: false,
              isCompilable: false,
              compilationTimeMs: 0,
              executionTimeMs: 0,
              totalDurationMs: Date.now() - startTime,
              passedCount: 0,
              failedCount: 1,
              testResults: [],
              error: stderr || error.message || 'Ошибка запуска песочницы Java'
            });
          }

          try {
            const output = stdout.trim();
            const parsed = JSON.parse(output);

            const concurrencyData = parsed.concurrencyDiagnostics || parsed.concurrencyHarness;
            const concurrencyHarness = concurrencyData ? {
              threadsRan: concurrencyData.concurrentThreadsRan ?? concurrencyData.threadsRan ?? 0,
              deadlockDetected: Boolean(concurrencyData.deadlockDetected),
              raceConditionDetected: Boolean(concurrencyData.raceConditionDetected)
            } : undefined;

            resolve({
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
            });
          } catch (parseErr: any) {
            console.error('Failed to parse CompilerService output:', stdout, parseErr);
            resolve({
              success: false,
              isCompilable: false,
              compilationTimeMs: 0,
              executionTimeMs: 0,
              totalDurationMs: Date.now() - startTime,
              passedCount: 0,
              failedCount: 1,
              testResults: [],
              error: `Некорректный вывод компилятора: ${stdout.slice(0, 300)}`
            });
          }
        }
      );
    });
  }

  /**
   * Executes Resident In-Memory Mutation Testing Pipeline:
   * 1. AST Security & Test Quality scans (Flaky Sleep, Over-mocking).
   * 2. Baseline run against original service.
   * 3. Defect injection run against in-memory mutants (< 120ms).
   * 4. Mutation Score calculation.
   */
  public static async executeMutation(request: MutationExecutionRequest): Promise<MutationExecutionResponse> {
    this.ensureCompiled();
    const startTime = Date.now();
    const requiredScore = request.requiredScore || 85;

    // 1. AST Security Check
    const secResult = AstSecurityScanner.scan(request.files);
    if (!secResult.isSafe) {
      const primaryViolation = secResult.violations[0];
      return {
        isMutationRun: true,
        baselinePassed: false,
        totalMutants: request.mutants?.length || 0,
        killedCount: 0,
        survivedCount: request.mutants?.length || 0,
        mutationScore: 0,
        passedThreshold: false,
        requiredScore,
        executionTimeMs: Date.now() - startTime,
        mutantResults: [],
        error: `Нарушение политики безопасности: ${primaryViolation.message}`
      };
    }

    // 2. AST Test Quality Check (Anti-Patterns)
    const qualityResult = TestQualityScanner.scan(request.files);
    if (!qualityResult.isValid) {
      const blocking = qualityResult.violations.find(v => v.severity === 'ERROR');
      return {
        isMutationRun: true,
        baselinePassed: false,
        totalMutants: request.mutants?.length || 0,
        killedCount: 0,
        survivedCount: request.mutants?.length || 0,
        mutationScore: 0,
        passedThreshold: false,
        requiredScore,
        executionTimeMs: Date.now() - startTime,
        mutantResults: [],
        qualityViolations: qualityResult.violations,
        error: `Антипаттерн тестирования: ${blocking?.message || 'Обнаружены критические ошибки тест-дизайна'}`
      };
    }

    // 3. Prepare JSON input payload with files + mutants
    const tempFilePath = path.join(os.tmpdir(), `mutation_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`);
    const payloadJson = JSON.stringify({
      files: request.files,
      mutants: request.mutants || []
    });
    fs.writeFileSync(tempFilePath, payloadJson, 'utf-8');

    const timeoutMs = request.timeoutMs || 8000;

    return new Promise((resolve) => {
      execFile(
        'java',
        ['-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-cp', this.binPath, 'com.assessment.sandbox.CompilerService', tempFilePath],
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch {}

          if (error) {
            console.error('Mutation CompilerService error:', error, stderr);
            return resolve({
              isMutationRun: true,
              baselinePassed: false,
              totalMutants: request.mutants?.length || 0,
              killedCount: 0,
              survivedCount: request.mutants?.length || 0,
              mutationScore: 0,
              passedThreshold: false,
              requiredScore,
              executionTimeMs: Date.now() - startTime,
              mutantResults: [],
              qualityViolations: qualityResult.violations,
              error: error.killed ? 'Превышен таймаут мутационного анализа' : (stderr || error.message)
            });
          }

          try {
            const output = stdout.trim();
            const parsed = JSON.parse(output);

            const score = typeof parsed.mutationScore === 'number'
              ? parsed.mutationScore
              : parseFloat(parsed.mutationScore || '0');

            resolve({
              isMutationRun: true,
              baselinePassed: Boolean(parsed.baselinePassed),
              totalMutants: parsed.totalMutants || (request.mutants?.length || 0),
              killedCount: parsed.killedCount || 0,
              survivedCount: parsed.survivedCount || 0,
              mutationScore: score,
              passedThreshold: Boolean(parsed.baselinePassed) && (score >= requiredScore),
              requiredScore,
              executionTimeMs: parsed.executionTimeMs || (Date.now() - startTime),
              mutantResults: parsed.mutantResults || [],
              qualityViolations: qualityResult.violations,
              error: parsed.error
            });
          } catch (parseErr: any) {
            console.error('Failed to parse mutation runner output:', stdout, parseErr);
            resolve({
              isMutationRun: true,
              baselinePassed: false,
              totalMutants: request.mutants?.length || 0,
              killedCount: 0,
              survivedCount: request.mutants?.length || 0,
              mutationScore: 0,
              passedThreshold: false,
              requiredScore,
              executionTimeMs: Date.now() - startTime,
              mutantResults: [],
              qualityViolations: qualityResult.violations,
              error: `Ошибка парсинга вывода мутационного раннера: ${stdout.slice(0, 300)}`
            });
          }
        }
      );
    });
  }
}
