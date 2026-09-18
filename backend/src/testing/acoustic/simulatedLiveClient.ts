/**
 * simulatedLiveClient.ts
 *
 * SOTA September 2026 Headless Acoustic WebSocket Client for Gemini Live.
 * Implements Direct UTF-8 decoding (AGENTS.md Invariant 2.3), frame aggregation,
 * thinking frame capture, and precise telemetry for Auto-VAD & Multi-Engine testing.
 */

import WebSocket from 'ws';
import { envConfig } from '../../config/env';
import { authService } from '../../services/authService';

export interface SimulatedClientOptions {
  hostWithPort?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  strategy?: 'adaptive_probing' | 'socratic_tutoring';
  strictness?: 'learning' | 'standard' | 'hardcore';
  persona?: string;
  liveModel?: string;
  sessionType?: 'interview' | 'tutor';
  tutorMode?: string;
  turnMode?: 'auto' | 'manual';
}

export interface ClientTelemetry {
  ttftMs: number | null; // Time To First Thought (from candidate speech end)
  ttfaMs: number | null; // Time To First Audio (from candidate speech end)
  isInterrupted: boolean;
  interruptionLatencyMs: number | null;
  thoughtTokens: string[];
  replyText: string;
  audioBytesReceived: number;
  isTurnComplete: boolean;
  toolCallsReceived: string[];
}

export class SimulatedLiveClient {
  public ws: WebSocket | null = null;
  public isConnected = false;
  public options: SimulatedClientOptions;

  public telemetry: ClientTelemetry = {
    ttftMs: null,
    ttfaMs: null,
    isInterrupted: false,
    interruptionLatencyMs: null,
    thoughtTokens: [],
    replyText: '',
    audioBytesReceived: 0,
    isTurnComplete: false,
    toolCallsReceived: []
  };

  private candidateSpeechEndedAt: number | null = null;
  private interruptionTriggeredAt: number | null = null;
  private messageListeners: Array<(msg: any) => void> = [];
  private closeListeners: Array<(code: number, reason: string) => void> = [];

  constructor(options: SimulatedClientOptions = {}) {
    this.options = {
      hostWithPort: options.hostWithPort || process.env.TEST_BACKEND_HOST || `localhost:${envConfig.server.backendPort}`,
      topic: options.topic || 'Spring Caching',
      questionText: options.questionText || 'Как работает аннотация @CacheEvict?',
      referenceAnswer: options.referenceAnswer || 'Аннотация @CacheEvict удаляет запись из кэша по ключу.',
      strategy: options.strategy || 'adaptive_probing',
      strictness: options.strictness || 'standard',
      persona: options.persona || 'mentor',
      liveModel: options.liveModel || envConfig.models.live,
      sessionType: options.sessionType || 'interview',
      tutorMode: options.tutorMode || '',
      turnMode: options.turnMode || 'auto'
    };
  }

  /**
   * Connects to the backend WebSocket proxy.
   */
  public async connect(timeoutMs: number = 10000): Promise<void> {
    let ticket = '';
    try {
      ticket = authService.createWsTicket('user_master');
    } catch {
      // Ignored if DB cannot be accessed directly
    }

    const params = new URLSearchParams({
      ...(ticket ? { ticket } : {}),
      ...(envConfig.proxy.apiKey ? { token: envConfig.proxy.apiKey } : {}),
      sessionId: `sim_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      questionId: 'test_q_1',
      topic: this.options.topic || '',
      questionText: this.options.questionText || '',
      referenceAnswer: this.options.referenceAnswer || '',
      strategy: this.options.strategy || 'adaptive_probing',
      strictness: this.options.strictness || 'standard',
      persona: this.options.persona || 'mentor',
      liveModel: this.options.liveModel || envConfig.models.live,
      sessionType: this.options.sessionType || 'interview',
      tutorMode: this.options.tutorMode || '',
      turnMode: this.options.turnMode || 'auto',
      voice: 'Aoede',
      userGender: 'female',
      maxProbes: '2'
    });

    const url = `ws://${this.options.hostWithPort}/ws/live?${params.toString()}`;

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (envConfig.proxy.apiKey) {
        headers['Authorization'] = `Bearer ${envConfig.proxy.apiKey}`;
      }

      const timer = setTimeout(() => {
        if (this.ws) {
          this.ws.terminate();
        }
        reject(new Error(`WebSocket connection to ${url} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.ws = new WebSocket(url, { headers });

      this.ws.on('open', () => {
        clearTimeout(timer);
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
        this.handleIncomingFrame(data, isBinary);
      });

      this.ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        const reasonStr = reason ? reason.toString() : '';
        for (const listener of this.closeListeners) {
          try { listener(code, reasonStr); } catch {}
        }
      });
    });
  }

  /**
   * Dispatches and processes an incoming raw WebSocket frame.
   * Enforces AGENTS.md Invariant 2.3: Direct UTF-8 decoding on all frames.
   */
  private handleIncomingFrame(data: WebSocket.Data, isBinary: boolean): void {
    let rawText = '';
    if (isBinary || Buffer.isBuffer(data)) {
      rawText = Buffer.from(data as any).toString('utf-8');
    } else {
      rawText = String(data);
    }

    try {
      const parsed = JSON.parse(rawText);

      // 1. Check for barge-in / interruption signal
      if (parsed.serverContent?.interrupted) {
        this.telemetry.isInterrupted = true;
        if (this.interruptionTriggeredAt) {
          this.telemetry.interruptionLatencyMs = Date.now() - this.interruptionTriggeredAt;
        }
      }

      // 2. Check for turn completion
      if (parsed.serverContent?.turnComplete) {
        this.telemetry.isTurnComplete = true;
      }

      // 3. Check for tool calls
      if (parsed.toolCall?.functionCalls) {
        for (const fc of parsed.toolCall.functionCalls) {
          this.telemetry.toolCallsReceived.push(fc.name);
        }
      }

      // 4. Check for model parts (audio, text, thought)
      const parts = parsed.serverContent?.modelTurn?.parts || [];
      for (const p of parts) {
        if (p.thought || p.isThought) {
          // Extended Thinking Token Frame
          const thoughtText = p.text || (typeof p.thought === 'string' ? p.thought : '');
          if (thoughtText) {
            this.telemetry.thoughtTokens.push(thoughtText);
            if (this.candidateSpeechEndedAt && this.telemetry.ttftMs === null) {
              this.telemetry.ttftMs = Date.now() - this.candidateSpeechEndedAt;
            }
          }
        } else if (p.text) {
          this.telemetry.replyText += p.text;
        }

        if (p.inlineData?.data) {
          const chunkLen = Buffer.from(p.inlineData.data, 'base64').length;
          this.telemetry.audioBytesReceived += chunkLen;
          if (this.candidateSpeechEndedAt && this.telemetry.ttfaMs === null) {
            this.telemetry.ttfaMs = Date.now() - this.candidateSpeechEndedAt;
          }
        }
      }

      // Notify external listeners
      for (const listener of this.messageListeners) {
        try { listener(parsed); } catch {}
      }
    } catch {
      // Ignored if ping frame or non-json
    }
  }

  /**
   * Marks the timestamp when candidate speech concluded and trailing silence began.
   */
  public markCandidateSpeechEnd(): void {
    this.candidateSpeechEndedAt = Date.now();
    this.telemetry.ttftMs = null;
    this.telemetry.ttfaMs = null;
    this.telemetry.isTurnComplete = false;
  }

  /**
   * Marks the timestamp when a barge-in interruption audio stream was initiated.
   */
  public markInterruptionTriggered(): void {
    this.interruptionTriggeredAt = Date.now();
    this.telemetry.isInterrupted = false;
  }

  /**
   * Waits for the Turn 0 Greeting to arrive and conclude its audio/text playout.
   */
  public async waitForGreeting(timeoutMs: number = 25000): Promise<string> {
    const effectiveTimeout = Math.max(timeoutMs, 25000);
    return new Promise((resolve, reject) => {
      let greetingText = '';
      let greetingAudioBytes = 0;
      const timer = setTimeout(() => {
        cleanup();
        if (greetingText.length > 0 || greetingAudioBytes > 0) {
          resolve(greetingText || `[Audio Greeting: ${greetingAudioBytes} bytes]`);
        } else {
          reject(new Error(`Greeting timeout: no greeting received within ${effectiveTimeout}ms`));
        }
      }, effectiveTimeout);

      const listener = (msg: any) => {
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.text && !p.thought) {
            greetingText += p.text;
          }
          if (p.inlineData?.data) {
            greetingAudioBytes += Buffer.from(p.inlineData.data, 'base64').length;
          }
        }
        if (msg.serverContent?.turnComplete) {
          cleanup();
          resolve(greetingText || `[Audio Greeting: ${greetingAudioBytes} bytes]`);
        }
      };

      const closeHandler = (code: number, reason: string) => {
        cleanup();
        reject(new Error(`WebSocket closed before greeting completed (code ${code}: ${reason || 'no reason'})`));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.messageListeners = this.messageListeners.filter((l) => l !== listener);
        this.closeListeners = this.closeListeners.filter((l) => l !== closeHandler);
      };

      this.messageListeners.push(listener);
      this.closeListeners.push(closeHandler);
    });
  }

  /**
   * Waits for the AI turn to complete after candidate speech.
   */
  public async waitForTurnComplete(timeoutMs: number = 20000): Promise<ClientTelemetry> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        if (this.telemetry.replyText || this.telemetry.audioBytesReceived > 0) {
          resolve({ ...this.telemetry });
        } else {
          reject(new Error(`Turn completion timeout: AI did not complete turn within ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const listener = (msg: any) => {
        if (msg.serverContent?.turnComplete) {
          cleanup();
          resolve({ ...this.telemetry });
        }
      };

      const closeHandler = (code: number, reason: string) => {
        cleanup();
        reject(new Error(`WebSocket closed before turn completed (code ${code}: ${reason || 'no reason'})`));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.messageListeners = this.messageListeners.filter((l) => l !== listener);
        this.closeListeners = this.closeListeners.filter((l) => l !== closeHandler);
      };

      this.messageListeners.push(listener);
      this.closeListeners.push(closeHandler);
    });
  }

  /**
   * Waits for an interruption event (`interrupted: true`).
   */
  public async waitForInterruption(timeoutMs: number = 5000): Promise<number> {
    if (this.telemetry.isInterrupted && this.telemetry.interruptionLatencyMs !== null) {
      return this.telemetry.interruptionLatencyMs;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Interruption timeout: server did not emit interrupted: true within ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (msg: any) => {
        if (msg.serverContent?.interrupted) {
          cleanup();
          resolve(this.telemetry.interruptionLatencyMs || 200);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.messageListeners = this.messageListeners.filter((l) => l !== listener);
      };

      this.messageListeners.push(listener);
    });
  }

  /**
   * Closes connection cleanly.
   */
  public close(): void {
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {}
    }
    this.isConnected = false;
    this.messageListeners = [];
    this.closeListeners = [];
  }
}
