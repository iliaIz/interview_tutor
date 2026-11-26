/**
 * LiveVoiceRecoveryController.ts
 * Manages bounded safety timers, upstream sync_ping health probes, and
 * transport recovery/handoff frames for NativeLiveVoiceEngine (Spec 42 / #159).
 * Cognitive Bounding Limit: <= 170 lines (Rule 8 compliant).
 */

import { ParsedLiveFrameResult } from './LiveVoiceFrameParser';
import { LiveTransportConnection } from './types';

export interface RecoveryControllerCallbacks {
  onStatusMessage: (msg: string) => void;
  onDeadAirTimeout: () => void;
  onDeadAirRecovery: () => void;
  onFatalError: (msg: string, retryable: boolean, errorCode?: string) => void;
  getConnection: () => LiveTransportConnection | null;
  isSessionReady: () => boolean;
}

export class LiveVoiceRecoveryController {
  public static formatCloseStatus(code?: number): string {
    if (code === 1006) return '🔌 Сбой соединения со шлюзом (1006).';
    if (code === 4401) return '⛔ Требуется авторизация для голосовой сессии.';
    return '🔌 Сессия завершена.';
  }

  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private syncProbeInterval: ReturnType<typeof setInterval> | null = null;
  private awaitingToolSpeech = false;
  private consecutiveUpstreamDown = 0;

  constructor(private readonly callbacks: RecoveryControllerCallbacks) {}

  public isAwaitingToolSpeech(): boolean {
    return this.awaitingToolSpeech;
  }

  public setAwaitingToolSpeech(awaiting: boolean): void {
    this.awaitingToolSpeech = awaiting;
  }

  public armSafetyTimer(timeoutMs: number = 22000): void {
    this.clearSafetyTimer();
    this.safetyTimer = setTimeout(() => {
      this.safetyTimer = null;
      this.awaitingToolSpeech = false;
      this.callbacks.onDeadAirTimeout();
    }, timeoutMs);
  }

  public clearSafetyTimer(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  public startSyncProbes(): void {
    this.stopSyncProbes();
    this.consecutiveUpstreamDown = 0;
    this.syncProbeInterval = setInterval(() => {
      const conn = this.callbacks.getConnection();
      if (!conn || !conn.isOpen() || !this.callbacks.isSessionReady()) return;
      try {
        conn.send(JSON.stringify({ type: 'sync_ping', timestamp: Date.now() }));
      } catch {}
    }, 10000);
    const timerHandle: unknown = this.syncProbeInterval;
    if (timerHandle && typeof (timerHandle as { unref?: () => void }).unref === 'function') {
      (timerHandle as { unref: () => void }).unref();
    }
  }

  public stopSyncProbes(): void {
    if (this.syncProbeInterval) {
      clearInterval(this.syncProbeInterval);
      this.syncProbeInterval = null;
    }
    this.consecutiveUpstreamDown = 0;
  }

  /**
   * Handles transport recovery, handoff, tool speech gating, and upstream error frames.
   * Returns true if frame was fully consumed by the recovery controller.
   */
  public handleControlFrame(parsed: ParsedLiveFrameResult): boolean {
    const ctrl = parsed.control;
    if (!ctrl) return false;

    switch (ctrl.kind) {
      case 'upstream_reconnecting': {
        const attempt = ctrl.attempt ?? 1;
        const maxAttempts = ctrl.maxAttempts ?? 3;
        this.callbacks.onStatusMessage(`🔄 Восстанавливаем голосовую связь (${attempt}/${maxAttempts})...`);
        this.clearSafetyTimer();
        return true;
      }
      case 'hot_handoff':
        if (ctrl.state === 'started') {
          this.callbacks.onStatusMessage('🔄 Бесшовное переключение голосового канала...');
        } else {
          this.consecutiveUpstreamDown = 0;
          this.callbacks.onStatusMessage('🎙️ Связь стабильна. Можете говорить...');
        }
        return true;
      case 'tool_awaiting_speech':
        this.awaitingToolSpeech = true;
        this.callbacks.onStatusMessage('🎨 ИИ готовит пояснение по доске...');
        this.armSafetyTimer(8000);
        return true;
      case 'stream_recovery':
        this.callbacks.onStatusMessage('🔄 Синхронизация голосового потока...');
        return true;
      case 'sync_pong': {
        const { isUpstreamConnected, isUpstreamReconnecting, isHandoffActive } = ctrl.payload;
        if (isUpstreamConnected === false && !isUpstreamReconnecting && !isHandoffActive) {
          this.consecutiveUpstreamDown += 1;
          if (this.consecutiveUpstreamDown >= 2) {
            this.callbacks.onFatalError('Голосовой поток к модели прерван. Нажмите «Переподключить».', true, 'UPSTREAM_LINK_LOST');
          }
        } else {
          this.consecutiveUpstreamDown = 0;
        }
        return true;
      }
      case 'thinking_delay':
        this.callbacks.onStatusMessage('🧠 ИИ обдумывает ответ...');
        return true;
      case 'dead_air_recovery':
        this.callbacks.onDeadAirRecovery();
        return true;
      case 'upstream_error':
        this.callbacks.onFatalError(ctrl.payload.error, ctrl.payload.retryable, ctrl.payload.errorCode);
        return true;
      default:
        return false;
    }
  }

  public dispose(): void {
    this.clearSafetyTimer();
    this.stopSyncProbes();
    this.awaitingToolSpeech = false;
  }
}
