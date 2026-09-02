import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { AstSecurityScanner, SecurityViolation } from './AstSecurityScanner';

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

            resolve({
              success: parsed.isCompilable && (parsed.failedCount === 0),
              isCompilable: Boolean(parsed.isCompilable),
              compilationTimeMs: parsed.compilationTimeMs || 0,
              executionTimeMs: parsed.executionTimeMs || 0,
              totalDurationMs: parsed.totalDurationMs || (Date.now() - startTime),
              passedCount: parsed.passedCount || 0,
              failedCount: parsed.failedCount || 0,
              testResults: parsed.testResults || [],
              concurrencyHarness: parsed.concurrencyHarness,
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
}
