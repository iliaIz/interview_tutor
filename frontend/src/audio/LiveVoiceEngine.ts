/**
 * LiveVoiceEngine.ts
 * Unified Headless Voice Engine & State Machine (SOTA Late September 2026).
 * Enforces Client-Authoritative Duplex, Neural Silero VAD v5, and Dual-Sided Handshake.
 * Cognitive bounding limit: <= 390 lines.
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneCapture, MicrophoneMetrics } from './MicrophoneCapture';
import { SileroVadDetector } from './SileroVadDetector';
import { LiveVoiceStateMachine } from './LiveVoiceStateMachine';
import { AcousticBargeInGuard } from './AcousticBargeInGuard';
import { LiveVoiceFrameParser } from './LiveVoiceFrameParser';
import {
  VoiceEngineState, VoiceEngineConfig, VoiceEngineCallbacks,
  DialogueTurnItem, VoiceEvaluationResult
} from './types';

export class LiveVoiceEngine {
  private fsm: LiveVoiceStateMachine;
  private ws: WebSocket | null = null;
  private config: VoiceEngineConfig | null = null;
  private playoutManager: AudioPlayoutManager;
  private micCapture: MicrophoneCapture;
  private sileroVad: SileroVadDetector | null = null;
  private bargeInGuard: AcousticBargeInGuard;
  private dialogueTurns: DialogueTurnItem[] = [];
  private isServerTurnComplete: boolean = false;
  private hasSpokenInTurn: boolean = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isMuted: boolean = false;
  private currentAiTurnAccumulator: string = '';
  private wakeLock: any = null;

  constructor(private callbacks: VoiceEngineCallbacks = {}) {
    this.fsm = new LiveVoiceStateMachine((pubState) => {
      this.callbacks.onStateChange?.(pubState);
    });

    this.playoutManager = new AudioPlayoutManager();
    this.bargeInGuard = new AcousticBargeInGuard();

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
    this.fsm.transition({ type: 'CONNECT' });
    this.callbacks.onStatusMessage?.('⚡ Подключение к голосовому шлюзу...');

    const isMidDialogue = Boolean(config.isResumed || config.initialUserMessage);
    const shouldLockTurn0 = config.turn0Lockdown ?? !isMidDialogue;
    this.bargeInGuard.setTurn0Lockdown(shouldLockTurn0);

    try {
      void this.acquireWakeLock();
      await this.playoutManager.resume();
      const ctx = this.playoutManager.getContext();
      
      // Initialize Neural Silero VAD v5 with fallback to MicrophoneCapture
      try {
        const vad = new SileroVadDetector({
          vadPauseMs: config.vadPauseMs || 1800,
          callbacks: {
            onSpeechStart: () => this.handleSpeechStarted(),
            onSpeechEnd: () => this.handleSpeechEnded(),
            onAudioFrame: (base64, prob, isSpeech, rmsDb) => {
              this.callbacks.onAudioLevel?.(rmsDb);
              this.handleMicrophoneChunk(base64, { rmsDb, speechDetected: isSpeech });
            },
            onError: () => this.fallbackToMicrophoneCapture(ctx)
          }
        });
        await vad.start(this.playoutManager.getContext());
        this.sileroVad = vad;
      } catch {
        this.fallbackToMicrophoneCapture(ctx);
      }

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

      ws.onclose = () => {
        if (this.getState() !== 'COMPLETED' && this.getState() !== 'IDLE') {
          this.fsm.transition({ type: 'DISCONNECT' });
          this.callbacks.onStatusMessage?.('🔌 Сессия завершена.');
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handleFatalError(`Не удалось запустить аудио: ${msg}`, true);
    }
  }

  private fallbackToMicrophoneCapture(ctx?: AudioContext): void {
    if (!this.micCapture.isActive()) {
      void this.micCapture.start(ctx || this.playoutManager.getContext());
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
    this.sileroVad?.stop();
    this.sileroVad = null;
    this.micCapture.stop();
    this.playoutManager.handleInterruption();
    this.bargeInGuard.reset();
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'DISCONNECT' });
  }

  public handleCentralButtonClick(): void {
    const pub = this.fsm.getPublicState();
    if (pub === 'AI_SPEAKING') {
      this.handleBargeInInterruption('tactile');
    } else if (pub === 'LISTENING') {
      this.commitSpokenTurn();
    }
  }

  public handleBargeInInterruption(source: 'tactile' | 'acoustic' = 'tactile'): void {
    this.bargeInGuard.setTurn0Lockdown(false);
    this.callbacks.onDrainingStateChange?.(false);
    this.playoutManager.handleInterruption();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'barge_in',
        bargeIn: true,
        bargeInType: source,
        epoch: Date.now(),
        clientContent: { turnComplete: true, interrupted: true }
      }));
    }
    this.isServerTurnComplete = true;
    this.hasSpokenInTurn = source === 'acoustic';
    this.fsm.transition({ type: 'BARGE_IN_TRIGGERED', source });
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите...');
  }

  public commitSpokenTurn(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ формулирует ответ...');
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
    this.appendDialogueTurn('user', displayText || text);
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true
        }
      }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ отвечает...');
  }

  public sendCustomFrame(frame: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.sileroVad?.setMuted(muted);
    this.micCapture.setMuted(muted);
  }

  public getState(): VoiceEngineState {
    return this.fsm.getPublicState();
  }

  public getInternalState(): string {
    return this.fsm.getInternalState();
  }

  public getDialogueTurns(): DialogueTurnItem[] {
    return [...this.dialogueTurns];
  }

  public getPlayoutManager(): AudioPlayoutManager {
    return this.playoutManager;
  }

  private handleSpeechStarted(): void {
    if (this.fsm.isTurn0RecitationActive()) return;
    const pub = this.fsm.getPublicState();
    if (pub === 'AI_SPEAKING') {
      this.handleBargeInInterruption('acoustic');
    } else {
      this.fsm.transition({ type: 'SPEECH_STARTED' });
      this.hasSpokenInTurn = true;
    }
  }

  private handleSpeechEnded(): void {
    if (this.fsm.isCandidateTurnActive() && this.hasSpokenInTurn && this.config?.turnMode === 'auto') {
      this.commitSpokenTurn();
    }
  }

  private handleServerFrame(rawData: any): void {
    const parsed = LiveVoiceFrameParser.parse(rawData);
    if (!parsed) return;

    if (parsed.type === 'setupComplete') {
      const isTurn0 = this.bargeInGuard.isTurn0RecitationLocked();
      this.fsm.transition({ type: 'SETUP_COMPLETE', isTurn0 });
      return;
    }

    if (parsed.evaluation) {
      this.fsm.transition({ type: 'EVALUATION_COMPLETED' });
      this.callbacks.onEvaluationReceived?.(parsed.evaluation);
      return;
    }

    if (parsed.whiteboardPayload) return this.callbacks.onWhiteboardUpdate?.(parsed.whiteboardPayload);
    if (parsed.chaosPayload) return this.callbacks.onChaosInjected?.(parsed.chaosPayload);
    if (parsed.verdictPayload) return this.callbacks.onHiringCommitteeVerdict?.(parsed.verdictPayload);
    if (parsed.toolCallPayload) return this.callbacks.onToolCall?.(parsed.toolCallPayload);

    // Audio / transcript deltas
    if (parsed.hasAudio || parsed.hasText) {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' });
      this.callbacks.onStatusMessage?.('🔊 ИИ говорит...');

      for (const textChunk of parsed.textDeltas) {
        this.currentAiTurnAccumulator += textChunk;
        this.callbacks.onTranscriptDelta?.('ai', textChunk);
        this.updateLastAiDialogueTurn(this.currentAiTurnAccumulator);
      }

      for (const pcm of parsed.audioChunks) {
        this.playoutManager.enqueuePcmChunk(pcm);
      }
    }

    // Dual-Phase Turn Gate
    if (parsed.isTurnDone) {
      if (parsed.interactionStatus === 'IN_PROGRESS') return;
      this.isServerTurnComplete = true;
      this.playoutManager.notifyTurnComplete();
      this.currentAiTurnAccumulator = '';

      if (!this.playoutManager.isPlaying()) {
        this.unlockCandidateTurn();
      } else {
        this.callbacks.onDrainingStateChange?.(true);
      }
    }

    if (parsed.isInterrupted) {
      this.playoutManager.handleInterruption();
      this.isServerTurnComplete = true;
      this.unlockCandidateTurn();
    }
  }

  private handleAudioPlayoutFinished(): void {
    this.bargeInGuard.setTurn0Lockdown(false);
    if (this.isServerTurnComplete) {
      this.unlockCandidateTurn();
    }
  }

  private unlockCandidateTurn(): void {
    this.bargeInGuard.setTurn0Lockdown(false);
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'PLAYOUT_FINISHED' });
    this.hasSpokenInTurn = false;
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите в микрофон...');
  }

  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    if (this.isMuted) return;

    if (this.fsm.isTurn0RecitationActive()) return;

    const pub = this.fsm.getPublicState();
    if (pub === 'AI_SPEAKING') {
      if (this.bargeInGuard.evaluateAcousticBargeIn(metrics)) {
        this.handleBargeInInterruption('acoustic');
      }
      return;
    }

    if (!this.fsm.isCandidateTurnActive()) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }] }
      }));
    }

    // Fallback energy silence timer if Silero VAD is not handling endpoints
    if (!this.sileroVad && metrics?.speechDetected) {
      this.hasSpokenInTurn = true;
      if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    } else if (!this.sileroVad && this.hasSpokenInTurn && this.config?.turnMode === 'auto' && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null;
        if (this.hasSpokenInTurn) this.commitSpokenTurn();
      }, this.config.vadPauseMs || 1800);
    }
  }

  private handleFatalError(msg: string, retryable: boolean): void {
    this.fsm.transition({ type: 'ERROR_OCCURRED' });
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
    const host = window.location.port === '8090' ? `${window.location.hostname}:8091` : window.location.host;
    const p = new URLSearchParams({
      sessionId: cfg.sessionId, questionId: cfg.questionId, sessionType: cfg.sessionType,
      topic: cfg.topic || '', questionText: cfg.questionText || '', referenceAnswer: cfg.referenceAnswer || '',
      voice: cfg.voice || 'Kore', turnMode: cfg.turnMode || 'auto',
      liveModel: cfg.liveModel || 'gemini-live-v3', vadPauseMs: String(cfg.vadPauseMs || 1800)
    });
    for (const k of ['tutorMode', 'persona', 'targetGrade', 'strategy'] as const) {
      if (cfg[k]) p.set(k, String(cfg[k]));
    }
    return `${protocol}//${host}/ws/live?${p.toString()}`;
  }

  private async acquireWakeLock(): Promise<void> {
    try { if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch {}
  }

  private releaseWakeLock(): void {
    try { this.wakeLock?.release(); } catch {}
    this.wakeLock = null;
  }
}
