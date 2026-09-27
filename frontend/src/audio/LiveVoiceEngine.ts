/**
 * LiveVoiceEngine.ts
 * Unified Headless Voice Engine & State Machine (SOTA Late September 2026).
 * Enforces Dual-Sided Handshake, EchoGuard Gating, and Symmetrical Turn Custody.
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneCapture, MicrophoneMetrics } from './MicrophoneCapture';
import {
  VoiceEngineState,
  VoiceEngineConfig,
  VoiceEngineCallbacks,
  DialogueTurnItem,
  VoiceEvaluationResult
} from './types';

export class LiveVoiceEngine {
  private state: VoiceEngineState = 'IDLE';
  private ws: WebSocket | null = null;
  private config: VoiceEngineConfig | null = null;
  private playoutManager: AudioPlayoutManager;
  private micCapture: MicrophoneCapture;
  private dialogueTurns: DialogueTurnItem[] = [];
  private isServerTurnComplete: boolean = false;
  private hasSpokenInTurn: boolean = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAiSpeechEndedAt: number = 0;
  private isMuted: boolean = false;
  private currentAiTurnAccumulator: string = '';
  private wakeLock: any = null;

  constructor(private callbacks: VoiceEngineCallbacks = {}) {
    this.playoutManager = new AudioPlayoutManager();
    this.micCapture = new MicrophoneCapture({
      onAudioFrame: (base64Pcm, metrics) => this.handleMicrophoneChunk(base64Pcm, metrics),
      onAudioLevel: (db) => this.callbacks.onAudioLevel?.(db),
      onError: (err) => this.handleFatalError(err.message, false)
    });

    this.playoutManager.onPlaybackFinished = () => {
      this.handleAudioPlayoutFinished();
    };
  }

  public async connect(config: VoiceEngineConfig): Promise<void> {
    this.disconnect();
    this.config = config;
    this.transitionState('CONNECTING');
    this.callbacks.onStatusMessage?.('⚡ Подключение к голосовому шлюзу...');

    try {
      void this.acquireWakeLock();
      await this.playoutManager.resume();
      void this.micCapture.start(this.playoutManager.getContext());
      const wsUrl = this.buildWebSocketUrl(config);
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      ws.onopen = () => {
        this.callbacks.onStatusMessage?.('🔊 Ожидание приветствия...');
      };

      ws.onmessage = (event) => {
        this.handleServerFrame(event.data);
      };

      ws.onerror = (err) => {
        console.error('LiveVoiceEngine WebSocket error:', err);
      };

      ws.onclose = (ev) => {
        if (this.state !== 'COMPLETED' && this.state !== 'IDLE') {
          this.transitionState('IDLE');
          this.callbacks.onStatusMessage?.('🔌 Сессия завершена.');
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handleFatalError(`Не удалось запустить аудио: ${msg}`, true);
    }
  }

  public disconnect(): void {
    this.releaseWakeLock();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.micCapture.stop();
    this.playoutManager.handleInterruption();
    this.callbacks.onDrainingStateChange?.(false);
    this.transitionState('IDLE');
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try { this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {}
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLock) {
      try { this.wakeLock.release(); } catch {}
      this.wakeLock = null;
    }
  }

  public sendCustomFrame(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  public handleCentralButtonClick(): void {
    if (this.state === 'AI_SPEAKING') {
      this.handleBargeInInterruption();
    } else if (this.state === 'LISTENING') {
      this.commitSpokenTurn();
    }
  }

  public handleBargeInInterruption(): void {
    this.callbacks.onDrainingStateChange?.(false);
    this.playoutManager.handleInterruption();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'barge_in',
        bargeIn: true,
        epoch: Date.now(),
        clientContent: { turnComplete: true, interrupted: true }
      }));
    }
    this.isServerTurnComplete = true;
    this.hasSpokenInTurn = false;
    this.transitionState('LISTENING');
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите...');
  }

  public commitSpokenTurn(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
    this.transitionState('AI_SPEAKING');
    this.callbacks.onStatusMessage?.('🧠 ИИ формулирует ответ...');
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
    this.appendDialogueTurn('user', displayText || text);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true
        }
      }));
    }
    this.transitionState('AI_SPEAKING');
    this.callbacks.onStatusMessage?.('🧠 ИИ отвечает...');
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.micCapture.setMuted(muted);
  }

  public getState(): VoiceEngineState {
    return this.state;
  }

  public getDialogueTurns(): DialogueTurnItem[] {
    return [...this.dialogueTurns];
  }

  public getPlayoutManager(): AudioPlayoutManager {
    return this.playoutManager;
  }

  private handleServerFrame(rawData: any): void {
    try {
      const text = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
      const data = JSON.parse(text);

      if (data.type === 'setupComplete') {
        return;
      }

      if (data.type === 'evaluation_completed' || data.type === 'evaluation') {
        this.transitionState('COMPLETED');
        const evalPayload = (data.evaluation || data.payload) as VoiceEvaluationResult;
        this.callbacks.onEvaluationReceived?.(evalPayload);
        return;
      }

      if (data.type === 'whiteboard_update') {
        this.callbacks.onWhiteboardUpdate?.(data.payload);
        return;
      }

      if (data.type === 'chaos_injected') {
        this.callbacks.onChaosInjected?.(data.payload);
        return;
      }

      if (data.type === 'hiring_committee_verdict') {
        this.callbacks.onHiringCommitteeVerdict?.(data.payload);
        return;
      }

      if (data.type === 'tool_call') {
        this.callbacks.onToolCall?.(data);
        return;
      }

      if (data.serverContent?.modelTurn?.parts) {
        // AI has started responding; immediately cancel pending client silence timers to prevent premature turn commit
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        this.transitionState('AI_SPEAKING');
        this.callbacks.onStatusMessage?.('🔊 ИИ говорит...');
        for (const part of data.serverContent.modelTurn.parts) {
          if ((part as any).thought) continue;
          if (part.text) {
            this.currentAiTurnAccumulator += part.text;
            this.callbacks.onTranscriptDelta?.('ai', part.text);
            this.updateLastAiDialogueTurn(this.currentAiTurnAccumulator);
          }
          const pcm = part.inlineData?.data || part.inline_data?.data;
          if (pcm) {
            this.playoutManager.enqueuePcmChunk(pcm);
          }
        }
      }

      // SOTA Late 2026: Gemini 3.8 Live Dual-Phase Turn Gate
      const isTurnDone = Boolean(data.serverContent?.turnComplete || data.serverContent?.generationComplete);
      if (isTurnDone) {
        const interactionStatus = data.serverContent?.interactionStatus;
        if (interactionStatus === 'IN_PROGRESS') {
          console.log('⏳ Gemini Live interactionStatus is IN_PROGRESS (cognitive filler / intermediate thought). Holding candidate mic custody.');
          return;
        }

        this.isServerTurnComplete = true;
        this.playoutManager.notifyTurnComplete();
        this.currentAiTurnAccumulator = '';

        if (!this.playoutManager.isPlaying()) {
          this.unlockCandidateTurn();
        } else {
          this.callbacks.onDrainingStateChange?.(true);
        }
      }

      // Upstream interruption detected by Gemini native VAD
      if (data.serverContent?.interrupted) {
        this.playoutManager.handleInterruption();
        this.isServerTurnComplete = true;
        this.unlockCandidateTurn();
      }
    } catch (err) {
      console.error('Error handling server live frame:', err);
    }
  }

  private handleAudioPlayoutFinished(): void {
    this.lastAiSpeechEndedAt = Date.now();
    if (this.isServerTurnComplete && this.state === 'AI_SPEAKING') {
      this.unlockCandidateTurn();
    }
  }

  private unlockCandidateTurn(): void {
    this.callbacks.onDrainingStateChange?.(false);
    this.transitionState('LISTENING');
    this.hasSpokenInTurn = false;
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите в микрофон...');
  }

  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    if (this.isMuted) return;

    // SOTA Late 2026: Acoustic Barge-In during AI speech
    if (this.state === 'AI_SPEAKING') {
      if (metrics?.speechDetected) {
        this.callbacks.onDrainingStateChange?.(false);
        this.playoutManager.handleInterruption();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'barge_in',
            bargeIn: true,
            bargeInType: 'acoustic',
            epoch: Date.now(),
            realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }] }
          }));
        }
        this.isServerTurnComplete = true;
        this.hasSpokenInTurn = true;
        this.transitionState('LISTENING');
        this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите...');
      }
      return;
    }

    if (this.state !== 'LISTENING') return;
    if (Date.now() - this.lastAiSpeechEndedAt < 450 && !this.hasSpokenInTurn) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }] }
      }));
    }

    if (metrics?.speechDetected) {
      this.hasSpokenInTurn = true;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.hasSpokenInTurn && this.config?.turnMode === 'auto') {
      if (!this.silenceTimer) {
        const pauseLimit = this.config.vadPauseMs || 1800;
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null;
          if (this.state === 'LISTENING' && this.hasSpokenInTurn) {
            this.commitSpokenTurn();
          }
        }, pauseLimit);
      }
    }
  }

  private transitionState(newState: VoiceEngineState): void {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  private handleFatalError(msg: string, retryable: boolean): void {
    this.transitionState('ERROR');
    this.callbacks.onError?.(msg, retryable);
    this.callbacks.onStatusMessage?.(`❌ Ошибка: ${msg}`);
  }

  private appendDialogueTurn(role: 'ai' | 'user' | 'system', text: string): void {
    this.dialogueTurns.push({ id: `turn_${Date.now()}_${Math.random()}`, role, text, timestamp: Date.now() });
    this.callbacks.onDialogueTurnsUpdate?.([...this.dialogueTurns]);
  }

  private updateLastAiDialogueTurn(fullText: string): void {
    const last = this.dialogueTurns[this.dialogueTurns.length - 1];
    if (last && last.role === 'ai') {
      last.text = fullText;
    } else {
      this.dialogueTurns.push({ id: `turn_${Date.now()}`, role: 'ai', text: fullText, timestamp: Date.now() });
    }
    this.callbacks.onDialogueTurnsUpdate?.([...this.dialogueTurns]);
  }

  private buildWebSocketUrl(cfg: VoiceEngineConfig): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let hostWithPort = window.location.host;
    if (window.location.port === '8090') {
      hostWithPort = `${window.location.hostname}:8091`;
    }
    const params = new URLSearchParams({
      sessionId: cfg.sessionId,
      questionId: cfg.questionId,
      sessionType: cfg.sessionType,
      topic: cfg.topic || '',
      questionText: cfg.questionText || '',
      referenceAnswer: cfg.referenceAnswer || '',
      voice: cfg.voice || 'Kore',
      turnMode: cfg.turnMode || 'auto',
      liveModel: cfg.liveModel || 'gemini-live-v3',
      vadPauseMs: String(cfg.vadPauseMs || 1800)
    });
    if (cfg.tutorMode) params.set('tutorMode', cfg.tutorMode);
    if (cfg.persona) params.set('persona', cfg.persona);
    if (cfg.targetGrade) params.set('targetGrade', cfg.targetGrade);
    if (cfg.strategy) params.set('strategy', cfg.strategy);
    return `${protocol}//${hostWithPort}/ws/live?${params.toString()}`;
  }
}
