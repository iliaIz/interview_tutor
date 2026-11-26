/**
 * LiveTransportSupervisor.ts — Unified WS transport supervisor & Slim Handshake builder (Spec 53 / #192).
 * Merges liveVoiceUrlBuilder, LiveHeartbeatController, and LiveVoiceRecoveryController behind one cohesive seam.
 */

import { RuntimeVoiceConfig, VOICE_DEFAULTS } from '../config/voiceDefaults';
import { useVoiceConfigStore } from '../store/useVoiceConfigStore';
import { LiveControlSignal } from './LiveVoiceFrameParser';
import { LiveSessionInitFrame, LiveTransportConnection, VoiceEngineConfig } from './types';

export function buildLiveVoiceWebSocketUrl(
  cfg: VoiceEngineConfig,
  runtimeOverride?: RuntimeVoiceConfig | null
): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined'
    ? (window.location.port === '8090' ? `${window.location.hostname}:8091` : window.location.host)
    : 'localhost:5000';
  const runtimeDefaults =
    runtimeOverride !== undefined ? runtimeOverride : useVoiceConfigStore.getState().runtimeConfig;
  const resolvedDefaultModel = runtimeDefaults?.models?.defaultLiveModel || VOICE_DEFAULTS.liveModel;

  const params = new URLSearchParams({
    sessionId: cfg.sessionId,
    questionId: cfg.questionId,
    sessionType: cfg.sessionType,
    voice: cfg.voice || runtimeDefaults?.defaults?.voice || VOICE_DEFAULTS.voice,
    turnMode: cfg.turnMode || runtimeDefaults?.defaults?.turnMode || VOICE_DEFAULTS.turnMode,
    liveModel: cfg.liveModel || resolvedDefaultModel,
    vadPauseMs: String(cfg.vadPauseMs ?? runtimeDefaults?.defaults?.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs),
    temperature: String(cfg.temperature ?? 1.0),
    awaitInit: '1'
  });

  if (cfg.questionId) params.set('challengeId', cfg.questionId);
  const slimKeys = ['tutorMode', 'persona', 'targetGrade', 'strategy', 'strictness', 'userGender', 'targetQuestionId'] as const;
  for (const k of slimKeys) {
    if (cfg[k]) params.set(k, String(cfg[k]));
  }
  if (typeof cfg.enableSilenceClarification === 'boolean') {
    params.set('enableSilenceClarification', String(cfg.enableSilenceClarification));
  }
  if (cfg.isResumed) params.set('isResumed', 'true');

  return `${protocol}//${host}/ws/live?${params.toString()}`;
}

export function sendLiveSessionInit(ws: LiveTransportConnection | WebSocket, cfg: VoiceEngineConfig): void {
  const isOpen = 'isOpen' in ws ? ws.isOpen() : ws.readyState === WebSocket.OPEN;
  if (!isOpen) return;

  const initFrame: LiveSessionInitFrame = {
    type: 'session_init',
    sessionId: cfg.sessionId,
    sessionType: cfg.sessionType,
    tutorMode: cfg.tutorMode,
    voice: cfg.voice,
    userGender: cfg.userGender,
    turnMode: cfg.turnMode,
    liveModel: cfg.liveModel,
    vadPauseMs: cfg.vadPauseMs,
    enableSilenceClarification: cfg.enableSilenceClarification,
    topic: cfg.topic,
    questionText: cfg.questionText,
    referenceAnswer: cfg.referenceAnswer,
    persona: cfg.persona,
    strategy: cfg.strategy,
    targetGrade: cfg.targetGrade,
    strictness: cfg.strictness,
    maxProbes: cfg.maxProbes,
    deepDive: cfg.deepDive,
    liveCoaching: cfg.liveCoaching,
    customPrompt: cfg.customPrompt,
    questionIndex: cfg.questionIndex,
    totalQuestions: cfg.totalQuestions,
    isRetry: cfg.isRetry,
    challenge: {
      id: cfg.questionId,
      title: cfg.bugTitle || cfg.questionText,
      category: cfg.challengeCategory,
      track: cfg.challengeTrack,
      domain: cfg.challengeDomain,
      instructions: cfg.bugExplanation,
      activeFilePath: cfg.workspaceManifest?.activeFile?.path,
      activeFileContent: cfg.codeSnippet || cfg.workspaceManifest?.activeFile?.content,
      workspaceManifest: cfg.workspaceManifest
    },
    activeCodeArtifact: cfg.activeCodeArtifact,
    academyBridgeContext: cfg.academyBridgeContext,
    seniorReview: cfg.seniorReview,
    hrMode: cfg.hrMode,
    dossierId: cfg.dossierId,
    jobId: cfg.jobId,
    hrPersonaId: cfg.hrPersonaId,
    questionMatrixId: cfg.questionMatrixId,
    chunkId: cfg.chunkId,
    startBeatId: cfg.startBeatId,
    beatScope: cfg.beatScope,
    academyCourse: cfg.academyCourse,
    academyStep: cfg.academyStep
  };

  try { ws.send(JSON.stringify(initFrame)); } catch (err) {
    console.warn('[LiveTransportSupervisor] Failed to dispatch session_init frame:', err);
  }
}

export interface TransportSupervisorCallbacks {
  onStatusMessage: (msg: string) => void;
  onDeadAirTimeout: () => void;
  onDeadAirRecovery: () => void;
  onFatalError: (msg: string, retryable: boolean, errorCode?: string) => void;
  getConnection: () => LiveTransportConnection | null;
  isSessionReady: () => boolean;
}

export class LiveTransportSupervisor {
  public static buildWsUrl = buildLiveVoiceWebSocketUrl;

  public static formatCloseStatus(code?: number): string {
    if (code === 1006) return '🔌 Сбой соединения со шлюзом (1006).';
    if (code === 4401) return '⛔ Требуется авторизация для голосовой сессии.';
    return '🔌 Сессия завершена.';
  }

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private syncProbeInterval: ReturnType<typeof setInterval> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingToolSpeech = false;
  private consecutiveUpstreamDown = 0;

  constructor(private readonly callbacks: TransportSupervisorCallbacks) {}

  public isAwaitingToolSpeech(): boolean { return this.awaitingToolSpeech; }
  public setAwaitingToolSpeech(awaiting: boolean): void { this.awaitingToolSpeech = awaiting; }

  public onTransportOpen(config: VoiceEngineConfig): void {
    const conn = this.callbacks.getConnection();
    if (conn) sendLiveSessionInit(conn, config);
    this.startHeartbeat();
    this.startSyncProbes();
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
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = null; }
  }

  public handleControlSignal(ctrl: LiveControlSignal): boolean {
    switch (ctrl.kind) {
      case 'ping': {
        const conn = this.callbacks.getConnection();
        if (conn?.isOpen()) {
          try { conn.send(JSON.stringify({ type: 'pong', timestamp: ctrl.timestamp || Date.now() })); } catch {}
        }
        return true;
      }
      case 'upstream_reconnecting':
        this.callbacks.onStatusMessage(`🔄 Восстанавливаем голосовую связь (${ctrl.attempt ?? 1}/${ctrl.maxAttempts ?? 3})...`);
        this.clearSafetyTimer();
        return true;
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
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.syncProbeInterval) { clearInterval(this.syncProbeInterval); this.syncProbeInterval = null; }
    this.consecutiveUpstreamDown = 0;
    this.awaitingToolSpeech = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      const conn = this.callbacks.getConnection();
      if (conn?.isOpen()) {
        try { conn.send(JSON.stringify({ type: 'ping', timestamp: Date.now() })); } catch {}
      }
    }, 20000);
    (this.heartbeatInterval as { unref?: () => void }).unref?.();
  }

  private startSyncProbes(): void {
    if (this.syncProbeInterval) clearInterval(this.syncProbeInterval);
    this.consecutiveUpstreamDown = 0;
    this.syncProbeInterval = setInterval(() => {
      const conn = this.callbacks.getConnection();
      if (!conn || !conn.isOpen() || !this.callbacks.isSessionReady()) return;
      try { conn.send(JSON.stringify({ type: 'sync_ping', timestamp: Date.now() })); } catch {}
    }, 10000);
    (this.syncProbeInterval as { unref?: () => void }).unref?.();
  }
}
