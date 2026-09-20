import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { execFile, spawn } from 'child_process';
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
  status: 'KILLED' | 'SURVIVED' | 'STILLBORN';
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

export class JvmExecutionService {
  private static binPath = path.resolve(__dirname, '../../../bin');
  private static daemonPort = parseInt(process.env.SANDBOX_DAEMON_PORT || '8099', 10);
  private static daemonHost = process.env.SANDBOX_DAEMON_HOST || '127.0.0.1';
  private static isDaemonStarting = false;

  private static ensureCompiled(): void {
    if (this.daemonHost !== '127.0.0.1' && this.daemonHost !== 'localhost') {
      return;
    }
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
   * Deterministically polls daemon port until alive or timeout expires (Readiness Probe)
   */
  private static async waitForDaemonPort(timeoutMs = 2000, pollIntervalMs = 50): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const isUp = await new Promise<boolean>((resolve) => {
        const socket = net.connect({ host: this.daemonHost, port: this.daemonPort }, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
      });
      if (isUp) return true;
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    return false;
  }

  /**
   * Ensures the resident hot JVM daemon is running on daemonHost:daemonPort
   * with deterministic readiness probe during cold start.
   */
  private static async ensureDaemonRunning(): Promise<boolean> {
    const isAlreadyUp = await new Promise<boolean>((resolve) => {
      let isDone = false;
      const client = net.connect({ host: this.daemonHost, port: this.daemonPort }, () => {
        if (!isDone) {
          isDone = true;
          client.destroy();
          resolve(true);
        }
      });

      client.setTimeout(1500, () => {
        if (!isDone) {
          isDone = true;
          client.destroy();
          resolve(false);
        }
      });

      client.on('error', () => {
        if (!isDone) {
          isDone = true;
          client.destroy();
          resolve(false);
        }
      });
    });

    if (isAlreadyUp) {
      return true;
    }

    if (this.daemonHost !== '127.0.0.1' && this.daemonHost !== 'localhost') {
      // Remote container host (e.g. 'interview-sandbox'): wait up to 2.5s for remote container readiness
      return this.waitForDaemonPort(2500, 100);
    }

    if (!this.isDaemonStarting) {
      this.isDaemonStarting = true;
      try {
        const child = spawn(
          'java',
          ['-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-cp', this.binPath, 'com.assessment.sandbox.ResidentSandboxDaemon', String(this.daemonPort)],
          { stdio: 'ignore', detached: true }
        );
        child.unref();
        setTimeout(() => {
          this.isDaemonStarting = false;
        }, 3000);
      } catch (e) {
        console.error('Failed to spawn ResidentSandboxDaemon:', e);
        this.isDaemonStarting = false;
        return false;
      }
    }

    // Deterministic readiness probe: wait up to 2000ms for daemon to bind TCP port
    return this.waitForDaemonPort(2000, 50);
  }

  /**
   * Sends execution request to Hot Resident JVM Daemon (< 80ms)
   */
  private static async sendToDaemon(payloadJson: string, timeoutMs = 4000): Promise<string> {
    return new Promise((resolve, reject) => {
      let isDone = false;
      const client = net.connect({ host: this.daemonHost, port: this.daemonPort });

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          client.destroy();
          reject(new Error(`Daemon timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      client.on('connect', () => {
        const payloadBuf = Buffer.from(payloadJson, 'utf-8');
        const header = Buffer.alloc(4);
        header.writeInt32BE(payloadBuf.length, 0);
        client.write(header);
        client.write(payloadBuf);
      });

      let responseBuffer = Buffer.alloc(0);
      let expectedLength = -1;

      client.on('data', (chunk) => {
        responseBuffer = Buffer.concat([responseBuffer, chunk]);
        if (expectedLength === -1 && responseBuffer.length >= 4) {
          expectedLength = responseBuffer.readInt32BE(0);
        }
        if (expectedLength !== -1 && responseBuffer.length >= 4 + expectedLength) {
          if (!isDone) {
            isDone = true;
            clearTimeout(timer);
            const body = responseBuffer.subarray(4, 4 + expectedLength).toString('utf-8');
            client.destroy();
            resolve(body);
          }
        }
      });

      client.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /**
   * Fallback: executes via classic isolated execFile subprocess
   */
  private static async executeViaCli(payloadJson: string, timeoutMs = 4000): Promise<{ output: string; error?: string }> {
    const tempFilePath = path.join(os.tmpdir(), `sandbox_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`);
    fs.writeFileSync(tempFilePath, payloadJson, 'utf-8');

    return new Promise((resolve) => {
      execFile(
        'java',
        ['-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-cp', this.binPath, 'com.assessment.sandbox.CompilerService', tempFilePath],
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch {}

          if (error) {
            if (error.killed) {
              return resolve({
                output: '',
                error: `Превышен лимит времени выполнения (${timeoutMs} мс). Возможен бесконечный цикл или deadlock!`
              });
            }
            return resolve({
              output: '',
              error: stderr || error.message || 'Ошибка запуска песочницы Java'
            });
          }

          resolve({ output: stdout.trim() });
        }
      );
    });
  }

  /**
   * Dual-mode compiler runner: tries fast Hot Resident Daemon, falls back to CLI
   */
  private static async runCompiler(payloadJson: string, timeoutMs = 10000): Promise<{ output: string; error?: string }> {
    const isDaemonUp = await this.ensureDaemonRunning();
    if (isDaemonUp) {
      try {
        const output = await this.sendToDaemon(payloadJson, timeoutMs);
        return { output };
      } catch (err: any) {
        console.warn(`⚠️ Daemon failed during execution (${err?.message}), falling back to CLI...`);
      }
    }

    if (this.daemonHost !== '127.0.0.1' && this.daemonHost !== 'localhost') {
      return {
        output: '',
        error: `Sandbox daemon (${this.daemonHost}:${this.daemonPort}) недоступен.`
      };
    }
    // Transparent fallback to isolated CLI process on local dev
    return this.executeViaCli(payloadJson, timeoutMs);
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

    // 2. Run Compiler (Hot Daemon -> Fallback CLI)
    const payloadJson = JSON.stringify({ files: request.files });
    const timeoutMs = request.timeoutMs || 10000;
    const { output, error } = await this.runCompiler(payloadJson, timeoutMs);

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
   * Executes Resident In-Memory Mutation Testing Pipeline
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

    // 3. Run Mutation Compiler (Hot Daemon -> Fallback CLI)
    const payloadJson = JSON.stringify({
      files: request.files,
      mutants: request.mutants || []
    });
    const timeoutMs = request.timeoutMs || 8000;
    const { output, error } = await this.runCompiler(payloadJson, timeoutMs);

    if (error) {
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
        error
      };
    }

    try {
      const parsed = JSON.parse(output);

      const score = typeof parsed.mutationScore === 'number'
        ? parsed.mutationScore
        : parseFloat(parsed.mutationScore || '0');

      return {
        isMutationRun: true,
        baselinePassed: Boolean(parsed.baselinePassed),
        totalMutants: parsed.totalMutants || (request.mutants?.length || 0),
        validMutants: parsed.validMutants !== undefined ? parsed.validMutants : (parsed.totalMutants || 0),
        killedCount: parsed.killedCount || 0,
        survivedCount: parsed.survivedCount || 0,
        stillbornCount: parsed.stillbornCount || 0,
        mutationScore: score,
        passedThreshold: Boolean(parsed.baselinePassed) && (score >= requiredScore),
        requiredScore,
        executionTimeMs: parsed.executionTimeMs || (Date.now() - startTime),
        mutantResults: parsed.mutantResults || [],
        qualityViolations: qualityResult.violations,
        error: parsed.error
      };
    } catch {
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
        error: `Ошибка парсинга вывода мутационного раннера: ${output.slice(0, 300)}`
      };
    }
  }
}
