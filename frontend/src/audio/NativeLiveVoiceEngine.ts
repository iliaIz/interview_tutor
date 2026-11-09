/**
 * NativeLiveVoiceEngine.ts
 * SOTA Late-2026 Headless Clean Native Voice Engine for Gemini 3.8 Live.
 * 
 * Invariants:
 * - Direct 16kHz PCM continuous microphone streaming (100ms frames / 10 fps).
 * - Symmetrical Dual-Sided Handshake (turnComplete + DAC drain synchronization).
 * - Programmatic Audio Mutex: freezes microphone chunks during tool execution (prevents WS Close 1008).
 * - Server-driven Acoustic Barge-In: instantaneous de-click cut-off upon serverContent.interrupted.
 * - Zero client-side VAD middleware (relies strictly on Google native cloud VAD).
 * 
 * Bounded cognitive size: <= 300 lines (Rule 8).
 */

import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { MicrophoneCapture, MicrophoneMetrics } from './MicrophoneCapture';
import { LiveVoiceStateMachine } from './LiveVoiceStateMachine';
import { LiveVoiceFrameParser } from './LiveVoiceFrameParser';
import { buildLiveVoiceWebSocketUrl, sendLiveSessionInit } from './liveVoiceUrlBuilder';
import { DialogueTurnManager } from './dialogueTurnManager';
import { WakeLockManager } from './wakeLockManager';
import { dispatchDomainEvents } from './liveVoiceDomainEvents';
import {
  VoiceEngineState,
  VoiceEngineConfig,
  VoiceEngineCallbacks,
  DialogueTurnItem,
  ILiveVoiceEngine
} from './types';

const STATIC_SILENCE_BASE64 = 'A'.repeat(1366) + '==';

export class NativeLiveVoiceEngine implements ILiveVoiceEngine {
  private fsm: LiveVoiceStateMachine;
  private ws: WebSocket | null = null;
  private config: VoiceEngineConfig | null = null;
  private playoutManager: AudioPlayoutManager;
  private micCapture: MicrophoneCapture;
  private turnManager: DialogueTurnManager;
  private wakeLock = new WakeLockManager();

  private isServerTurnComplete = false;
  private isAudioMutexLocked = false;
  private isMuted = false;
  private isTurn0Lockdown = false;
  private isSessionReady = false;
  private currentAiTurnAccumulator = '';
  private clientSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveVoicingFrames = 0;
  private candidateVoicingFramesInTurn = 0;
  private candidateSilenceFramesAfterVoicing = 0;

  constructor(private callbacks: VoiceEngineCallbacks = {}) {
    this.fsm = new LiveVoiceStateMachine((pubState) => this.callbacks.onStateChange?.(pubState));
    this.turnManager = new DialogueTurnManager((turns) => this.callbacks.onDialogueTurnsUpdate?.(turns));
    this.playoutManager = new AudioPlayoutManager();

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
    this.isSessionReady = false;
    this.isAudioMutexLocked = false;
    this.isTurn0Lockdown = !config.isResumed && !config.initialUserMessage && (config as any).turn0Lockdown !== false;
    this.fsm.transition({ type: 'CONNECT' });
    this.callbacks.onStatusMessage?.('⚡ Подключение к нативному голосовому шлюзу...');

    try {
      void this.wakeLock.acquire();
      await this.playoutManager.resume();
      const ctx = this.playoutManager.getContext();

      await this.micCapture.start(ctx);

      const ws = new WebSocket(buildLiveVoiceWebSocketUrl(config));
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onStatusMessage?.('🔊 Ожидание приветствия...');
        sendLiveSessionInit(ws, config);
      };

      ws.onmessage = (event) => this.handleServerFrame(event.data);
      ws.onerror = (err) => console.error('[NativeLiveVoiceEngine] WebSocket error:', err);
      ws.onclose = (event: CloseEvent) => {
        this.isSessionReady = false;
        if (this.getState() !== 'COMPLETED' && this.getState() !== 'IDLE') {
          this.fsm.transition({ type: 'DISCONNECT' });
          const msg = event?.code === 1006 ? '🔌 Сбой соединения со шлюзом (1006).' :
            event?.code === 4401 ? '⛔ Требуется авторизация для голосовой сессии.' : '🔌 Сессия завершена.';
          this.callbacks.onStatusMessage?.(msg);
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handleFatalError(`Не удалось запустить аудио: ${msg}`, true);
    }
  }

  public disconnect(): void {
    this.wakeLock.release();
    this.clearClientSafetyTimer();
    this.isSessionReady = false;
    this.isAudioMutexLocked = false;

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close(1000, 'Normal Closure');
      } catch {}
      this.ws = null;
    }

    this.micCapture.stop();
    this.playoutManager.clearQueue();
    this.fsm.transition({ type: 'DISCONNECT' });
  }

  public commitSpokenTurn(): void {
    this.candidateVoicingFramesInTurn = 0;
    this.candidateSilenceFramesAfterVoicing = 0;
    this.isServerTurnComplete = false;
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: { audioStreamEnd: true },
        clientContent: { turnComplete: true }
      }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ формулирует ответ...');
    this.armClientSafetyTimer();
  }

  public handleUserBargeIn(): void {
    this.handleBargeInInterruption('tactile');
  }

  public handleBargeInInterruption(source: 'tactile' | 'acoustic' = 'tactile'): void {
    this.playoutManager.handleInterruption();
    this.isServerTurnComplete = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'barge_in',
        bargeIn: true,
        bargeInType: source,
        source
      }));
    }
    this.resetTurnCustody({ type: 'BARGE_IN_TRIGGERED', source }, '🎙️ Перебивание активно: говорите в микрофон...');
  }

  public handleCentralButtonClick(): void {
    const pub = this.getState();
    if (pub === 'AI_SPEAKING') {
      this.handleUserBargeIn();
    } else if (pub === 'LISTENING') {
      this.commitSpokenTurn();
    }
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
    this.isServerTurnComplete = false;
    this.turnManager.appendTurn('user', displayText || text);
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
      }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ отвечает...');
    this.armClientSafetyTimer();
  }

  public sendCustomFrame(frame: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
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


  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    if (this.isMuted || this.isAudioMutexLocked) return;

    // 1. Transient / Cough Suppression during AI_SPEAKING (Local False Interruption Protection)
    if (this.getState() === 'AI_SPEAKING') {
      if (this.isTurn0Lockdown) return;

      if (metrics?.isTransientSpike) {
        if (this.consecutiveVoicingFrames > 0) {
          this.playoutManager.rollbackDucking(15);
          this.consecutiveVoicingFrames = 0;
        }
        this.callbacks.onTransientFiltered?.();
        return;
      }

      if (metrics?.speechDetected || (metrics && metrics.rmsDb > -38)) {
        if (metrics?.speechDetected) {
          this.handleBargeInInterruption('acoustic');
          this.consecutiveVoicingFrames = 0;
          return;
        }
        this.playoutManager.speculativeDuck(0.35, 15);
        this.consecutiveVoicingFrames++;
        if (this.consecutiveVoicingFrames >= 7) {
          this.handleBargeInInterruption('acoustic');
          this.consecutiveVoicingFrames = 0;
        }
      } else if (this.consecutiveVoicingFrames > 0) {
        this.playoutManager.rollbackDucking(15);
        this.callbacks.onTransientFiltered?.();
        this.consecutiveVoicingFrames = 0;
      }
      return;
    }

    if (!this.isSessionReady || this.getState() !== 'LISTENING') {
      this.candidateVoicingFramesInTurn = 0;
      this.candidateSilenceFramesAfterVoicing = 0;
      return;
    }

    // Auto-VAD Speech Cessation Detection (Fast-Handoff)
    const isVoicing = Boolean(metrics?.speechDetected || (metrics && metrics.rmsDb > -42));
    if (isVoicing) {
      this.candidateVoicingFramesInTurn++;
      this.candidateSilenceFramesAfterVoicing = 0;
    } else if (this.candidateVoicingFramesInTurn >= 4) {
      // Candidate spoke for >= 80ms, now silent
      this.candidateSilenceFramesAfterVoicing++;
      // ~500ms trailing silence (25 frames at 20ms) triggers fast-handoff in auto mode
      if (this.config?.turnMode !== 'manual' && this.candidateSilenceFramesAfterVoicing >= 25) {
        this.candidateVoicingFramesInTurn = 0;
        this.candidateSilenceFramesAfterVoicing = 0;
        this.commitSpokenTurn();
        return;
      }
    }

    // 2. In-Place Clamping for Continuous PCM Streaming during LISTENING (Cloud VAD Protection)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (metrics?.isTransientSpike) {
        this.callbacks.onTransientFiltered?.();
        this.ws.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: STATIC_SILENCE_BASE64 } }
        }));
      } else {
        this.ws.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm } }
        }));
      }
    }
  }

  private handleServerFrame(rawData: any): void {
    const parsed = LiveVoiceFrameParser.parse(rawData);
    if (!parsed) return;

    // 1. Tool Call Execution & Audio Mutex
    if (parsed.rawParsed?.type === 'tool_executing' || parsed.rawParsed?.toolCall || parsed.type === 'tool_call') {
      this.isAudioMutexLocked = true;
    }
    if (parsed.rawParsed?.type === 'tool_execution_complete' || parsed.whiteboardPayload) {
      this.isAudioMutexLocked = false;
    }

    if (parsed.type === 'setupComplete') {
      this.isSessionReady = true;
      this.fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: this.isTurn0Lockdown });
      if (!this.isTurn0Lockdown) {
        this.unlockCandidateTurn();
      }
      return;
    }

    if (parsed.type === 'thinking_delay') {
      this.callbacks.onStatusMessage?.('🧠 ИИ обдумывает ответ...');
      return;
    }

    if (parsed.type === 'dead_air_recovery' || parsed.rawParsed?.type === 'dead_air_recovery') {
      this.handleDeadAirRecovery();
      return;
    }

    if (parsed.evaluation) {
      this.clearClientSafetyTimer();
      this.fsm.transition({ type: 'EVALUATION_COMPLETED' });
      this.callbacks.onEvaluationReceived?.(parsed.evaluation);
      return;
    }

    dispatchDomainEvents(this.callbacks, parsed);

    // 2. Incoming Model Speech / Audio
    if (parsed.hasAudio || parsed.hasText) {
      this.isSessionReady = true;
      this.isServerTurnComplete = false;
      this.clearClientSafetyTimer();
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

    // 3. Native Server-Driven Acoustic Barge-In
    if (parsed.isInterrupted) {
      this.playoutManager.handleInterruption();
      this.isServerTurnComplete = true;
      this.unlockCandidateTurn();
      return;
    }

    // 4. Turn Completion & Dual-Sided Handshake
    if (parsed.isTurnDone) {
      this.isSessionReady = true;
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
  }

  private handleAudioPlayoutFinished(): void {
    if (this.isServerTurnComplete) {
      this.unlockCandidateTurn();
    }
  }

  private unlockCandidateTurn(): void {
    this.resetTurnCustody({ type: 'PLAYOUT_FINISHED' }, '🎙️ Ваша очередь: говорите в микрофон...');
  }

  private handleDeadAirRecovery(): void {
    this.resetTurnCustody({ type: 'DEAD_AIR_RECOVERED' }, '🎙️ ИИ завершил размышление. Ваша очередь говорить...');
  }

  private resetTurnCustody(
    event: { type: 'PLAYOUT_FINISHED' } | { type: 'DEAD_AIR_RECOVERED' } | { type: 'BARGE_IN_TRIGGERED'; source: 'tactile' | 'acoustic' },
    msg: string
  ): void {
    this.isTurn0Lockdown = false;
    this.clearClientSafetyTimer();
    this.isAudioMutexLocked = false;
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition(event);
    this.callbacks.onStatusMessage?.(msg);
  }

  private armClientSafetyTimer(): void {
    this.clearClientSafetyTimer();
    this.clientSafetyTimer = setTimeout(() => {
      const state = this.fsm.getInternalState();
      if (state === 'COMMITTING' || state === 'AI_THINKING') {
        this.handleDeadAirRecovery();
      }
    }, 22000);
  }

  private clearClientSafetyTimer(): void {
    if (this.clientSafetyTimer) {
      clearTimeout(this.clientSafetyTimer);
      this.clientSafetyTimer = null;
    }
  }

  private handleFatalError(msg: string, retryable: boolean): void {
    this.isSessionReady = false;
    this.clearClientSafetyTimer();
    this.fsm.transition({ type: 'ERROR_OCCURRED' });
    this.callbacks.onError?.(msg, retryable);
    this.callbacks.onStatusMessage?.(`❌ Ошибка: ${msg}`);
  }
}
