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
import {
  VoiceEngineState,
  VoiceEngineConfig,
  VoiceEngineCallbacks,
  DialogueTurnItem,
  ILiveVoiceEngine
} from './types';

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
  private currentAiTurnAccumulator = '';
  private clientSafetyTimer: ReturnType<typeof setTimeout> | null = null;

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
        if (this.getState() !== 'COMPLETED' && this.getState() !== 'IDLE') {
          this.fsm.transition({ type: 'DISCONNECT' });
          if (event?.code === 1006) {
            this.callbacks.onStatusMessage?.('🔌 Сбой соединения со шлюзом (1006).');
          } else if (event?.code === 4401) {
            this.callbacks.onStatusMessage?.('⛔ Требуется авторизация для голосовой сессии.');
          } else {
            this.callbacks.onStatusMessage?.('🔌 Сессия завершена.');
          }
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
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ формулирует ответ...');
    this.armClientSafetyTimer();
  }

  public handleBargeInInterruption(source: 'tactile' | 'acoustic' = 'tactile'): void {
    this.playoutManager.handleInterruption();
    this.isServerTurnComplete = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'barge_in', bargeIn: true, bargeInType: source, source }));
    }
    this.unlockCandidateTurn();
  }

  public handleCentralButtonClick(): void {
    const pub = this.getState();
    if (pub === 'AI_SPEAKING') {
      this.handleBargeInInterruption('tactile');
    } else if (pub === 'LISTENING') {
      this.commitSpokenTurn();
    }
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
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

  public getPlayoutManager(): AudioPlayoutManager {
    return this.playoutManager;
  }

  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    if (this.isMuted) return;
    // AUDIO MUTEX: Freeze mic chunks while tool call is executing to prevent Google Close 1008
    if (this.isAudioMutexLocked) return;

    if (this.getState() === 'AI_SPEAKING') {
      if (metrics?.speechDetected && !this.isTurn0Lockdown) {
        this.handleBargeInInterruption('acoustic');
      }
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm } }
      }));
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

    if (parsed.whiteboardPayload) this.callbacks.onWhiteboardUpdate?.(parsed.whiteboardPayload);
    if (parsed.chaosPayload) this.callbacks.onChaosInjected?.(parsed.chaosPayload);
    if (parsed.verdictPayload) this.callbacks.onHiringCommitteeVerdict?.(parsed.verdictPayload);
    if (parsed.bugSolvedPayload) this.callbacks.onBugSolved?.(parsed.bugSolvedPayload);
    if (parsed.candidateObservationPayload) this.callbacks.onCandidateObservationRecorded?.(parsed.candidateObservationPayload);
    if (parsed.toolCallPayload) this.callbacks.onToolCall?.(parsed.toolCallPayload);

    // 2. Incoming Model Speech / Audio
    if (parsed.hasAudio || parsed.hasText) {
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
    this.isTurn0Lockdown = false;
    this.clearClientSafetyTimer();
    this.isAudioMutexLocked = false;
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'PLAYOUT_FINISHED' });
    this.callbacks.onStatusMessage?.('🎙️ Ваша очередь: говорите в микрофон...');
  }

  private handleDeadAirRecovery(): void {
    this.isTurn0Lockdown = false;
    this.clearClientSafetyTimer();
    this.isAudioMutexLocked = false;
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition({ type: 'DEAD_AIR_RECOVERED' });
    this.callbacks.onStatusMessage?.('🎙️ ИИ завершил размышление. Ваша очередь говорить...');
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
    this.clearClientSafetyTimer();
    this.fsm.transition({ type: 'ERROR_OCCURRED' });
    this.callbacks.onError?.(msg, retryable);
    this.callbacks.onStatusMessage?.(`❌ Ошибка: ${msg}`);
  }
}
