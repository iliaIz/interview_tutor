/**
 * NativeLiveVoiceEngine.ts
 * SOTA Late-2026 Headless Clean Native Voice Engine for Gemini 3.8 Live.
 * Enforces Dual-Sided Handshake, Audio Mutex, and injectable Transport/Audio ports.
 */

import { MicrophoneMetrics } from './MicrophoneCapture';
import { LiveVoiceStateMachine } from './LiveVoiceStateMachine';
import { LiveVoiceFrameParser } from './LiveVoiceFrameParser';
import { buildLiveVoiceWebSocketUrl, sendLiveSessionInit } from './liveVoiceUrlBuilder';
import { DialogueTurnManager } from './dialogueTurnManager';
import { WakeLockManager } from './wakeLockManager';
import { dispatchDomainEvents } from './liveVoiceDomainEvents';
import { LiveMicChunkDispatcher } from './liveMicChunkDispatcher';
import { LiveHeartbeatController } from './LiveHeartbeatController';
import { LiveVoiceRecoveryController } from './LiveVoiceRecoveryController';
import { createBrowserAudioIOPort, createBrowserTransportPort } from './browserVoicePorts';
import {
  VoiceEngineState, VoiceEngineConfig, VoiceEngineCallbacks,
  DialogueTurnItem, ILiveVoiceEngine, VoiceEvaluationResult,
  LiveTransportConnection, LiveTransportPort, LiveAudioIOPort,
  VoiceEnginePorts, VoiceEngineCommand, VoiceEngineSnapshot
} from './types';

export class NativeLiveVoiceEngine implements ILiveVoiceEngine {
  private fsm: LiveVoiceStateMachine;
  private transport: LiveTransportPort;
  private audio: LiveAudioIOPort;
  private connection: LiveTransportConnection | null = null;
  private config: VoiceEngineConfig | null = null;
  private turnManager: DialogueTurnManager;
  private wakeLock = new WakeLockManager();
  private micDispatcher = new LiveMicChunkDispatcher();
  private heartbeat = new LiveHeartbeatController(() => this.connection);
  private recovery: LiveVoiceRecoveryController;

  private isServerTurnComplete = false;
  private isAudioMutexLocked = false;
  private isMuted = false;
  private isTurn0Lockdown = false;
  private isSessionReady = false;
  private connectEpoch = 0;
  private currentAiTurnAccumulator = '';
  private pendingEvaluation: VoiceEvaluationResult | null = null;
  private hasPendingEvaluationDrain = false;

  constructor(private callbacks: VoiceEngineCallbacks = {}, ports: VoiceEnginePorts = {}) {
    this.fsm = new LiveVoiceStateMachine((pubState) => this.callbacks.onStateChange?.(pubState));
    this.turnManager = new DialogueTurnManager((turns) => this.callbacks.onDialogueTurnsUpdate?.(turns));
    this.transport = ports.transport ?? createBrowserTransportPort();
    this.audio = ports.audio ?? createBrowserAudioIOPort();
    this.audio.handlePlayoutFinished(() => this.handleAudioPlayoutFinished());

    this.recovery = new LiveVoiceRecoveryController({
      onStatusMessage: (msg) => this.callbacks.onStatusMessage?.(msg),
      onDeadAirTimeout: () => {
        const state = this.fsm.getInternalState();
        if (state === 'COMMITTING' || state === 'AI_THINKING') {
          this.handleDeadAirRecovery();
        }
      },
      onDeadAirRecovery: () => this.handleDeadAirRecovery(),
      onFatalError: (msg, retryable, code) => this.handleFatalError(msg, retryable, code),
      getConnection: () => this.connection,
      isSessionReady: () => this.isSessionReady
    });
  }

  public async connect(config: VoiceEngineConfig): Promise<void> {
    this.disconnect();
    const epoch = this.connectEpoch;
    this.config = config;
    this.isSessionReady = false;
    this.isAudioMutexLocked = false;
    this.currentAiTurnAccumulator = '';
    this.isTurn0Lockdown = !config.isResumed && !config.initialUserMessage && config.turn0Lockdown !== false;
    this.fsm.transition({ type: 'CONNECT' });
    this.callbacks.onStatusMessage?.('⚡ Подключение к нативному голосовому шлюзу...');

    try {
      void this.wakeLock.acquire();
      this.audio.setMuted(this.isMuted);
      await this.audio.startCapture(
        (base64Pcm, metrics) => this.handleMicrophoneChunk(base64Pcm, metrics),
        (db) => this.callbacks.onAudioLevel?.(db)
      );
      if (epoch !== this.connectEpoch) {
        this.audio.stopCapture();
        return;
      }

      let conn: LiveTransportConnection | null = null;
      conn = this.transport.connect(buildLiveVoiceWebSocketUrl(config), {
        onOpen: () => {
          if (conn && this.connection !== conn && this.connection === null) {
            this.connection = conn;
          }
          this.heartbeat.start();
          this.recovery.startSyncProbes();
          this.callbacks.onStatusMessage?.('🔊 Ожидание приветствия...');
          if (this.connection) sendLiveSessionInit(this.connection, config);
        },
        onMessage: (data) => this.handleServerFrame(data),
        onError: (err) => console.error('[NativeLiveVoiceEngine] WebSocket error:', err),
        onClose: (code) => {
          if (!conn || this.connection !== conn) return;
          this.connection = null;
          this.heartbeat.stop();
          this.recovery.dispose();
          this.isSessionReady = false;
          const curState = this.getState();
          if (curState !== 'COMPLETED' && curState !== 'IDLE' && curState !== 'ERROR') {
            this.fsm.transition({ type: 'DISCONNECT' });
            this.callbacks.onStatusMessage?.(LiveVoiceRecoveryController.formatCloseStatus(code));
          }
        }
      });
      this.connection = conn;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handleFatalError(`Не удалось запустить аудио: ${msg}`, true);
    }
  }

  public disconnect(): void {
    this.connectEpoch++;
    this.teardownTransport();
    this.pendingEvaluation = null;
    this.hasPendingEvaluationDrain = false;
    this.isAudioMutexLocked = false;
    this.fsm.transition({ type: 'DISCONNECT' });
  }

  private teardownTransport(reason = 'Normal Closure'): void {
    this.wakeLock.release();
    this.recovery.dispose();
    this.heartbeat.stop();
    this.isSessionReady = false;

    const conn = this.connection;
    this.connection = null;
    if (conn) {
      try {
        conn.close(1000, reason);
      } catch {}
    }

    this.audio.stopCapture();
    this.audio.clearPlayout();
  }

  public dispatch(command: VoiceEngineCommand): void {
    switch (command.type) {
      case 'COMMIT_TURN': this.commitSpokenTurn(); break;
      case 'BARGE_IN': this.handleBargeInInterruption(command.source ?? 'tactile'); break;
      case 'CENTRAL_ACTION': this.handleCentralButtonClick(); break;
      case 'SEND_TEXT': this.sendTextMessage(command.text, command.displayText); break;
      case 'SEND_FRAME': this.sendCustomFrame(command.frame); break;
      case 'SET_MUTED': this.setMuted(command.muted); break;
    }
  }

  public getSnapshot(): VoiceEngineSnapshot {
    return {
      state: this.fsm.getPublicState(),
      internalState: this.fsm.getInternalState(),
      isCandidateTurnActive: this.fsm.isCandidateTurnActive(),
      isSessionReady: this.isSessionReady,
      isMuted: this.isMuted,
      isTurn0Lockdown: this.isTurn0Lockdown,
      isAudioMutexLocked: this.isAudioMutexLocked,
      dialogueTurns: this.turnManager.getTurns()
    };
  }

  public commitSpokenTurn(): void {
    if (!this.fsm.isCandidateTurnActive()) return;
    this.micDispatcher.resetCounters();
    this.isServerTurnComplete = false;
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.connection?.isOpen()) {
      this.connection.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ формулирует ответ...');
    this.recovery.armSafetyTimer(22000);
  }

  public handleUserBargeIn(): void { this.handleBargeInInterruption('tactile'); }

  public handleBargeInInterruption(source: 'tactile' | 'acoustic' = 'tactile'): void {
    this.audio.interruptPlayout();
    this.isServerTurnComplete = true;
    if (this.connection?.isOpen()) {
      this.connection.send(JSON.stringify({ type: 'barge_in', bargeIn: true, bargeInType: source, source }));
    }
    this.resetTurnCustody({ type: 'BARGE_IN_TRIGGERED', source }, '🎙️ Перебивание активно: говорите в микрофон...');
  }

  public handleCentralButtonClick(): void {
    const pub = this.getState();
    if (pub === 'AI_SPEAKING') this.handleUserBargeIn();
    else if (pub === 'LISTENING') this.commitSpokenTurn();
  }

  public sendTextMessage(text: string, displayText?: string): void {
    if (!text.trim()) return;
    this.isServerTurnComplete = false;
    this.turnManager.appendTurn('user', displayText || text);
    this.fsm.transition({ type: 'COMMIT_TRIGGERED' });
    if (this.connection?.isOpen()) {
      this.connection.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }));
    }
    this.callbacks.onStatusMessage?.('🧠 ИИ отвечает...');
    this.recovery.armSafetyTimer(22000);
  }

  public sendCustomFrame(frame: unknown): void {
    if (this.connection?.isOpen()) this.connection.send(JSON.stringify(frame));
  }

  public setMuted(muted: boolean): void { this.isMuted = muted; this.audio.setMuted(muted); }
  public getState(): VoiceEngineState { return this.fsm.getPublicState(); }
  public getInternalState(): string { return this.fsm.getInternalState(); }
  public getDialogueTurns(): DialogueTurnItem[] { return this.turnManager.getTurns(); }

  private handleMicrophoneChunk(base64Pcm: string, metrics?: MicrophoneMetrics): void {
    this.micDispatcher.dispatchChunk(
      base64Pcm, metrics, this.getState(), this.isMuted, this.isAudioMutexLocked,
      this.isTurn0Lockdown, this.isSessionReady, this.config?.turnMode, this.connection,
      {
        onTransientFiltered: () => this.callbacks.onTransientFiltered?.(),
        onBargeIn: (source) => this.handleBargeInInterruption(source),
        onCommitSpokenTurn: () => this.commitSpokenTurn()
      }
    );
  }

  private handleServerFrame(rawData: unknown): void {
    const parsed = LiveVoiceFrameParser.parse(rawData);
    if (!parsed) return;

    if (parsed.isPing) {
      this.heartbeat.handleIncomingPing(parsed.pingTimestamp);
      return;
    }

    if (parsed.toolLifecycle === 'executing' || Boolean(parsed.toolCallPayload)) {
      this.isAudioMutexLocked = true;
    }
    if (parsed.toolLifecycle === 'complete' || Boolean(parsed.whiteboardPayload)) {
      this.isAudioMutexLocked = false;
    }

    if (this.recovery.handleControlFrame(parsed)) return;

    if (parsed.isSetupComplete) {
      this.isSessionReady = true;
      if (parsed.isReconnected || parsed.isSilentSetup) {
        this.isTurn0Lockdown = false;
      }
      this.fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: this.isTurn0Lockdown });
      if (!this.isTurn0Lockdown) this.unlockCandidateTurn();
      return;
    }

    if (parsed.evaluation) {
      this.recovery.clearSafetyTimer();
      this.pendingEvaluation = parsed.evaluation;
      if (!this.audio.isPlaying() && this.isServerTurnComplete) {
        this.flushPendingEvaluation();
      } else {
        this.hasPendingEvaluationDrain = true;
      }
      return;
    }

    dispatchDomainEvents(this.callbacks, parsed);

    if (parsed.hasText) {
      for (const textChunk of parsed.textDeltas) {
        this.currentAiTurnAccumulator += textChunk;
        this.callbacks.onTranscriptDelta?.('ai', textChunk);
        this.turnManager.updateLastAiTurn(this.currentAiTurnAccumulator);
      }
    }

    if ((parsed.hasAudio && parsed.audioChunks.length > 0) || parsed.hasModelTurn) {
      this.isSessionReady = true;
      this.isServerTurnComplete = false;
      this.recovery.setAwaitingToolSpeech(false);
      this.recovery.clearSafetyTimer();
      this.fsm.transition({ type: 'FIRST_AUDIO_RECEIVED' });
      this.callbacks.onStatusMessage?.('🔊 ИИ говорит...');
      for (const pcm of parsed.audioChunks) {
        this.audio.enqueuePcm(pcm);
      }
    }

    if (parsed.isInterrupted) {
      this.audio.interruptPlayout();
      this.isServerTurnComplete = true;
      this.unlockCandidateTurn();
      return;
    }

    if (parsed.isTurnDone) {
      this.isSessionReady = true;
      if (parsed.interactionStatus === 'IN_PROGRESS') return;
      this.isServerTurnComplete = true;
      this.audio.notifyTurnComplete();
      this.currentAiTurnAccumulator = '';

      if (this.hasPendingEvaluationDrain && !this.audio.isPlaying() && this.flushPendingEvaluation()) {
        return;
      }

      if (!this.audio.isPlaying()) {
        if (this.recovery.isAwaitingToolSpeech()) {
          this.fsm.transition({ type: 'THINKING_START' });
        } else {
          this.unlockCandidateTurn();
        }
      } else {
        this.callbacks.onDrainingStateChange?.(true);
      }
    }
  }

  private flushPendingEvaluation(): boolean {
    if (!this.pendingEvaluation) return false;
    const evaluation = this.pendingEvaluation;
    this.pendingEvaluation = null;
    this.hasPendingEvaluationDrain = false;
    this.fsm.transition({ type: 'EVALUATION_COMPLETED' });
    this.callbacks.onEvaluationReceived?.(evaluation);
    return true;
  }

  private handleAudioPlayoutFinished(): void {
    if (this.hasPendingEvaluationDrain && this.flushPendingEvaluation()) return;
    if (this.isServerTurnComplete) {
      if (this.recovery.isAwaitingToolSpeech()) {
        this.fsm.transition({ type: 'THINKING_START' });
      } else {
        this.unlockCandidateTurn();
      }
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
    this.recovery.setAwaitingToolSpeech(false);
    this.recovery.clearSafetyTimer();
    this.isAudioMutexLocked = false;
    this.callbacks.onDrainingStateChange?.(false);
    this.fsm.transition(event);
    this.callbacks.onStatusMessage?.(msg);
  }

  private handleFatalError(msg: string, retryable: boolean, errorCode?: string): void {
    this.teardownTransport('Upstream error handled');
    this.fsm.transition({ type: 'ERROR_OCCURRED' });
    this.callbacks.onError?.(msg, retryable, errorCode);
    this.callbacks.onStatusMessage?.(`❌ Ошибка: ${msg}`);
  }
}
