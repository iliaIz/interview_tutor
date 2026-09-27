import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { execFile, spawn } from 'child_process';

/**
 * JvmDaemonClient.ts
 * Manages low-latency communication with the Hot Resident JVM Sandbox Daemon (< 80ms)
 * and provides resilient fallback to isolated subprocess execution.
 * Single responsibility: socket transport, lifecycle management, and connection resilience.
 * Cognitive bounding limit: <= 350 lines.
 */
export class JvmDaemonClient {
  private static binPath = path.resolve(__dirname, '../../../bin');
  private static daemonPort = parseInt(process.env.SANDBOX_DAEMON_PORT || '8099', 10);
  private static daemonHost = process.env.SANDBOX_DAEMON_HOST || '127.0.0.1';
  private static isDaemonStarting = false;

  public static ensureCompiled(): void {
    if (this.daemonHost !== '127.0.0.1' && this.daemonHost !== 'localhost') {
      return;
    }
    const classFile = path.join(this.binPath, 'com/assessment/sandbox/CompilerService.class');
    if (!fs.existsSync(classFile)) {
      let runnerDir = path.resolve(__dirname, 'runner');
      if (!fs.existsSync(runnerDir) || !fs.existsSync(path.join(runnerDir, 'CompilerService.java'))) {
        const srcCandidate = path.resolve(__dirname, '../../../src/services/sandbox/runner');
        if (fs.existsSync(srcCandidate)) {
          runnerDir = srcCandidate;
        } else {
          runnerDir = path.resolve(process.cwd(), 'src/services/sandbox/runner');
        }
      }
      if (!fs.existsSync(this.binPath)) {
        fs.mkdirSync(this.binPath, { recursive: true });
      }
      try {
        const walk = (dir: string): string[] => {
          let r: string[] = [];
          for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            if (fs.statSync(p).isDirectory()) r = r.concat(walk(p));
            else if (p.endsWith('.java')) r.push(p);
          }
          return r;
        };
        const javaFiles = walk(runnerDir);
        const argFile = path.join(this.binPath, 'sources_argfile.txt');
        fs.writeFileSync(argFile, javaFiles.join('\n'), 'utf8');
        require('child_process').execSync(`javac -d "${this.binPath}" @"${argFile}"`);
        try { fs.unlinkSync(argFile); } catch {}
      } catch (e) {
        console.error('Failed to precompile CompilerService.java:', e);
      }
    }
  }

  /**
   * Deterministically polls daemon port until alive or timeout expires (Readiness Probe)
   */
  public static async waitForDaemonPort(timeoutMs = 2000, pollIntervalMs = 50): Promise<boolean> {
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
  public static async ensureDaemonRunning(): Promise<boolean> {
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

    return this.waitForDaemonPort(2000, 50);
  }

  /**
   * Sends execution request to Hot Resident JVM Daemon (< 80ms)
   */
  public static async sendToDaemon(payloadJson: string, timeoutMs = 4000): Promise<string> {
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
  public static async executeViaCli(payloadJson: string, timeoutMs = 4000): Promise<{ output: string; error?: string }> {
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
   * Dual-mode compiler runner: tries fast Hot Resident Daemon with transient retry, falls back to CLI.
   */
  public static async runCompiler(payloadJson: string, timeoutMs = 10000): Promise<{ output: string; error?: string }> {
    const isDaemonUp = await this.ensureDaemonRunning();
    if (isDaemonUp) {
      try {
        const output = await this.sendToDaemon(payloadJson, timeoutMs);
        return { output };
      } catch (err: any) {
        console.warn(`⚠️ Daemon failed during execution (${err?.message}), attempting 1 retry...`);
        try {
          await new Promise((r) => setTimeout(r, 120));
          const output = await this.sendToDaemon(payloadJson, timeoutMs);
          return { output };
        } catch (retryErr: any) {
          console.warn(`⚠️ Daemon retry failed (${retryErr?.message}), evaluating fallback options...`);
        }
      }
    }

    if (this.daemonHost !== '127.0.0.1' && this.daemonHost !== 'localhost') {
      return {
        output: '',
        error: `Sandbox daemon (${this.daemonHost}:${this.daemonPort}) недоступен. Убедитесь, что контейнер interview-sandbox запущен в Docker Compose.`
      };
    }

    // Transparent fallback to isolated CLI process on local dev
    return this.executeViaCli(payloadJson, timeoutMs);
  }
}
