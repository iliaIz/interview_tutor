/**
 * LiveVoiceEngine.ts
 * Unified Headless Voice Engine & State Machine (SOTA Late September 2026).
 * Enforces Client-Authoritative Duplex, Neural Silero VAD v5, and Dual-Sided Handshake.
 * Cognitive bounding limit: <= 370 lines.
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneCapture, MicrophoneMetrics } from './MicrophoneCapture';
import { SileroVadDetector } from './SileroVadDetector';
import { LiveVoiceStateMachine } from './LiveVoiceStateMachine';
import { AcousticBargeInGuard } from './AcousticBargeInGuard';
import { LiveVoiceFrameParser } from './LiveVoiceFrameParser';
import { buildLiveVoiceWebSocketUrl } from './liveVoiceUrlBuilder';
import { DialogueTurnManager } from './dialogueTurnManager';
import { WakeLockManager } from './wakeLockManager';
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
  private turnManager: DialogueTurnManager;
  private wakeLock = new WakeLockManager();
  private isServerTurnComplete: boolean = false;
  private hasSpokenInTurn: boolean = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private clientSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  private isMuted: boolean = false;
  private currentAiTurnAccumulator: string = '';

  constructor(private callbacks: VoiceEngineCallbacks = {}) {
    this.fsm = new LiveVoiceStateMachine((pubState) => this.callbacks.onStateChange?.(pubState));
    this.turnManager = new DialogueTurnManager((turns) => this.callbacks.onDialogueTurnsUpdate?.(turns));
    this.playoutManager = new AudioPlayoutManager();
    this.bargeInGuard = new AcousticBargeInGuard();

    this.micCapture = new MicrophoneCapture({
      onAudioFrame: (base64Pcm, metrics) => this.handleMicrophoneChunk(base64Pcm, metrics),
      onAudioLevel: (db) => this.callbacks.onAudioLevel?.(db),
      onError: (err) => this.handleFatalError(err.message, false)
    });

    this.playoutManager.onPlaybackFinished = () => this.handleAudioPlayoutFinished();
  }

  public async connect(config: VoiceEngineConfig): Promise<void> {
    this.disconnect();
    this.config = config;
    this.fsm.transition({ type: 'CONNECT' });
    this.callbacks.onStatusMessage?.('⚡ Подключение к голосовому шлюзу...');

    const isMidDialogue = Boolean(config.isResumed || config.initialUserMessage);
    this.bargeInGuard.setTurn0Lockdown(config.turn0Lockdown ?? !isMidDialogue);

    try {
      void this.wakeLock.acquire();
      await this.playoutManager.resume();
      const ctx = this.playoutManager.getContext();

      try {
        const vad = new SileroVadDetector({
          vadPauseMs: config.vadPauseMs || 1800,
          callbacks: {
            onSpeechStart: () => this.handleSpeechStarted(),
            onSpeechEnd: () => this.handleSpeechEnded(),
            onAudioFrame: (b64, _, isSpeech, rmsDb) => {
              this.callbacks.onAudioLevel?.(rmsDb);
              this.handleMicrophoneChunk(b64, { rmsDb, speechDetected: isSpeech });
            },
            onError: () => this.fallbackToMicrophoneCapture(ctx)
          }
        });
        await vad.start(ctx);
        this.sileroVad = vad;
      } catch {
        this.fallbackToMicrophoneCapture(ctx);
      }

      const ws = new WebSocket(buildLiveVoiceWebSocketUrl(config));
      this.ws = ws;
      ws.onopen = () => this.callbacks.onStatusMessage?.('🔊 Ожидание приветствия...');
      ws.onmessage = (event) => this.handleServerFrame(event.data);
      ws.onerror = (err) => console.error('LiveVoiceEngine WebSocket error:', err);
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
    this.wakeLock.release();
    this.clearClientSafetyTimer();
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
    this.clearClientSafetyTimer();
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
    this.armClientSafetyTimer();
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
    this.turnManager.appendTurn('user', displayText || text);
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
      }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ отвечает...');
    this.armClientSafetyTimer();
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
    return this.turnManager.getTurns();
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
    // In native Cloud VAD mode (Auto-VAD), Gemini natively endpoints the speech turn
    // after silenceDurationMs and generates the response automatically.
  }

  private handleServerFrame(rawData: any): void {
    const parsed = LiveVoiceFrameParser.parse(rawData);
    if (!parsed) return;

    if (parsed.type === 'setupComplete') {
      this.fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: this.bargeInGuard.isTurn0RecitationLocked() });
      return;
    }

    if (parsed.type === 'thinking_delay') {
      this.callbacks.onStatusMessage?.('🧠 ИИ обдумывает ответ...');
      return;
    }

    if (parsed.type === 'dead_air_recovery' || parsed.rawParsed?.type === 'dead_air_recovery') {
      this.handleDeadAirRecovery(parsed.rawParsed?.reason || 'server_watchdog');
      return;
    }

    if (parsed.evaluation) {
      this.clearClientSafetyTimer();
      this.fsm.transition({ type: 'EVALUATION_COMPLETED' });
      this.callbacks.onEvaluationReceived?.(parsed.evaluation);
      return;
    }

    if (parsed.whiteboardPayload) return this.callbacks.onWhiteboardUpdate?.(parsed.whiteboardPayload);
    if (parsed.chaosPayload) return this.callbacks.onChaosInjected?.(parsed.chaosPayload);
    if (parsed.verdictPayload) return this.callbacks.onHiringCommitteeVerdict?.(parsed.verdictPayload);
    if (parsed.toolCallPayload) return this.callbacks.onToolCall?.(parsed.toolCallPayload);

    if (parsed.hasAudio || parsed.hasText) {
      this.clearClientSafetyTimer();
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' });
      this.callbacks.onStatusMessage?.('🔊 ИИ говорит...');

      for (const textChunk of parsed.textDeltas) {
        this.currentAiTurnAccumulator += textChunk;
        this.callbacks.onTranscriptDelta?.('ai', textChunk);
        this.turnManager.updateLastAiTurn(this.currentAiTurnAccumulator);
      }

      for (const pcm of parsed.audioChunks) {
        this.playoutManager.enqueuePcmChunk(pcm);
      }
    }

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
    this.clearClientSafetyTimer();
    this.bargeInGuard.setTurn0Lockdown(false);
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'PLAYOUT_FINISHED' });
    this.hasSpokenInTurn = false;
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите в микрофон...');
  }

  private handleDeadAirRecovery(reason?: string): void {
    this.clearClientSafetyTimer();
    this.bargeInGuard.setTurn0Lockdown(false);
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'DEAD_AIR_RECOVERED', reason });
    this.hasSpokenInTurn = false;
    this.callbacks.onStatusMessage?.('🎙️ ИИ задержался с ответом. Ваша очередь говорить...');
  }

  private armClientSafetyTimer(): void {
    this.clearClientSafetyTimer();
    // SOTA Late 2026: Client local safety timer (22s) in case upstream hangs
    this.clientSafetyTimer = setTimeout(() => {
      const state = this.fsm.getInternalState();
      if (state === 'COMMITTING' || state === 'AI_THINKING') {
        this.handleDeadAirRecovery('client_safety_timeout');
      }
    }, 22000);
  }

  private clearClientSafetyTimer(): void {
    if (this.clientSafetyTimer) {
      clearTimeout(this.clientSafetyTimer);
      this.clientSafetyTimer = null;
    }
  }

  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    if (this.isMuted || this.fsm.isTurn0RecitationActive()) return;

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

    if (!this.sileroVad && metrics?.speechDetected) {
      this.hasSpokenInTurn = true;
    }
  }

  private handleFatalError(msg: string, retryable: boolean): void {
    this.clearClientSafetyTimer();
    this.fsm.transition({ type: 'ERROR_OCCURRED' });
    this.callbacks.onError?.(msg, retryable);
    this.callbacks.onStatusMessage?.(`❌ Ошибка: ${msg}`);
  }
}
