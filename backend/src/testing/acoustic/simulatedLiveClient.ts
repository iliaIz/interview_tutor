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
import { SimulatedClientOptions, ClientTelemetry } from './simulatedLiveClientTypes';
import { SimulatedLiveClientAwaits, AwaitContext } from './simulatedLiveClientAwaits';

export { SimulatedClientOptions, ClientTelemetry };

export class SimulatedLiveClient {
  public ws: WebSocket | null = null;
  public isConnected = false;
  public options: SimulatedClientOptions;

  public telemetry: ClientTelemetry = {
    ttfrMs: null,
    ttftMs: null,
    ttfaMs: null,
    isInterrupted: false,
    interruptionLatencyMs: null,
    thoughtTokens: [],
    replyText: '',
    audioBytesReceived: 0,
    isTurnComplete: false,
    toolCallsReceived: [],
    canonicalTurnEvent: null
  };

  private candidateSpeechEndedAt: number | null = null;
  private interruptionTriggeredAt: number | null = null;
  private firstAudioReceivedAt: number | null = null;
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
      turnMode: options.turnMode || 'auto',
      customPrompt: options.customPrompt,
      questionId: options.questionId || 'TST-01',
      sessionId: options.sessionId,
      maxProbes: options.maxProbes
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

    this.beginTurn();
    const params = new URLSearchParams({
      ...(ticket ? { ticket } : {}),
      ...(envConfig.proxy.apiKey ? { token: envConfig.proxy.apiKey } : {}),
      sessionId: this.options.sessionId || `sim_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      questionId: this.options.questionId || 'TST-01',
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
      maxProbes: String(this.options.maxProbes || 2),
      ...(this.options.customPrompt ? { customPrompt: this.options.customPrompt } : {})
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

      // 0. Check for canonical turn telemetry
      if (parsed.type === 'turn_telemetry' && parsed.data) {
        this.telemetry.canonicalTurnEvent = parsed.data;
      }

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
          // Extended Thinking Token Frame (TTFR)
          const thoughtText = p.text || (typeof p.thought === 'string' ? p.thought : '');
          if (thoughtText) {
            this.telemetry.thoughtTokens.push(thoughtText);
            if (this.candidateSpeechEndedAt && this.telemetry.ttfrMs === null) {
              this.telemetry.ttfrMs = Date.now() - this.candidateSpeechEndedAt;
            }
          }
        } else if (p.text) {
          // First response text token (TTFT)
          this.telemetry.replyText += p.text;
          if (this.candidateSpeechEndedAt && this.telemetry.ttftMs === null) {
            this.telemetry.ttftMs = Date.now() - this.candidateSpeechEndedAt;
          }
        }

        const pcmBase64 = p.inlineData?.data || p.inline_data?.data;
        if (pcmBase64) {
          if (!this.firstAudioReceivedAt) {
            this.firstAudioReceivedAt = Date.now();
          }
          const chunkLen = Buffer.from(pcmBase64, 'base64').length;
          this.telemetry.audioBytesReceived += chunkLen;
          if (this.candidateSpeechEndedAt && this.telemetry.ttfaMs === null) {
            this.telemetry.ttfaMs = Date.now() - this.candidateSpeechEndedAt;
          }
        }
      }

      // 5. Output audio transcription text (Gemini Live outputAudioTranscription)
      const outputTranscription = parsed.serverContent?.outputTranscription?.text || parsed.serverContent?.output_transcription?.text;
      if (outputTranscription) {
        this.telemetry.replyText += outputTranscription;
        if (this.candidateSpeechEndedAt && this.telemetry.ttftMs === null) {
          this.telemetry.ttftMs = Date.now() - this.candidateSpeechEndedAt;
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
   * Resets the turn completion latch and clears per-turn telemetry for a new candidate turn.
   */
  public beginTurn(): void {
    this.telemetry.isTurnComplete = false;
    this.telemetry.replyText = '';
    this.telemetry.audioBytesReceived = 0;
    this.telemetry.thoughtTokens = [];
    this.telemetry.toolCallsReceived = [];
    this.telemetry.canonicalTurnEvent = null;
    this.telemetry.ttfrMs = null;
    this.telemetry.ttftMs = null;
    this.telemetry.ttfaMs = null;
    this.candidateSpeechEndedAt = null;
    this.firstAudioReceivedAt = null;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'turn_reset' }));
      } catch {}
    }
  }

  /**
   * Marks the timestamp when candidate speech concluded and trailing silence began.
   */
  public markCandidateSpeechEnd(): void {
    this.candidateSpeechEndedAt = Date.now();
    this.firstAudioReceivedAt = null;
    this.telemetry.ttfrMs = null;
    this.telemetry.ttftMs = null;
    this.telemetry.ttfaMs = null;
    this.telemetry.canonicalTurnEvent = null;
    this.telemetry.isTurnComplete = false;
    this.telemetry.replyText = '';
    this.telemetry.audioBytesReceived = 0;
    this.telemetry.thoughtTokens = [];
  }

  /**
   * Marks the timestamp when a barge-in interruption audio stream was initiated.
   */
  public markInterruptionTriggered(): void {
    this.interruptionTriggeredAt = Date.now();
    this.telemetry.isInterrupted = false;
  }

  private getAwaitContext(): AwaitContext {
    return {
      telemetry: this.telemetry,
      firstAudioReceivedAt: this.firstAudioReceivedAt,
      messageListeners: this.messageListeners,
      closeListeners: this.closeListeners
    };
  }

  public async waitForGreeting(timeoutMs: number = 40000): Promise<string> {
    return SimulatedLiveClientAwaits.waitForGreeting(this.getAwaitContext(), Math.max(timeoutMs, 40000));
  }

  public async waitForAudioPlayoutToDrain(reverbBufferMs: number = 450): Promise<void> {
    return SimulatedLiveClientAwaits.waitForAudioPlayoutToDrain(this.getAwaitContext(), reverbBufferMs);
  }

  public async waitForTurnComplete(timeoutMs: number = 20000): Promise<ClientTelemetry> {
    return SimulatedLiveClientAwaits.waitForTurnComplete(this.getAwaitContext(), timeoutMs);
  }

  public async waitForInterruption(timeoutMs: number = 5000): Promise<number> {
    return SimulatedLiveClientAwaits.waitForInterruption(this.getAwaitContext(), timeoutMs);
  }

  public async waitForFirstThought(timeoutMs: number = 8000): Promise<string> {
    return SimulatedLiveClientAwaits.waitForFirstThought(this.getAwaitContext(), timeoutMs);
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
