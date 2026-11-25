/**
 * LiveVoiceSession.ts
 * Authoritative Aggregate Root for Gemini Live Audio Sessions (SPEC-003).
 * Encapsulates session state, SessionFsm, WatchdogManager, and LiveAudioStreamRouter.
 * Eliminates anemic data bag mutations and guarantees Invariant 2.1 & 2.8 enforcement.
 * SLA: <= 300 lines.
 */

import { WebSocket, RawData } from 'ws';
import http from 'http';
import { isLanguageDrifted } from '../../prompts/core/languageDirectives';
import { LivePromptDirector } from './LivePromptDirector';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ProxySession } from './liveSessionTypes';
import { createLiveAudioStreamRouter } from './liveAudioStreamRouter';
import { SessionConfigurationResolver } from './SessionConfigurationResolver';
import { attachLiveClientFrameHandler } from './liveWsClientFrameHandler';
import { WatchdogManager } from './WatchdogManager';
import { SessionFsm, LiveSessionState } from './sessionFsm';
import { createInitialProxySession } from './sessionStartupHelper';
import { LiveSessionAggregate } from './LiveSessionAggregate';
import { LiveStreamSentinel } from './LiveStreamSentinel';

export interface SessionStartupOptions {
  clientSocket: WebSocket;
  req?: http.IncomingMessage;
  request?: http.IncomingMessage;
  earlyQueue?: (Buffer | any)[];
  cleanupEarlyCapture?: () => void;
}

export class LiveVoiceSession {
  private readonly _id: string;
  private readonly _fsm: SessionFsm;
  private readonly _watchdogs: WatchdogManager;
  private readonly _upstreamRouter: { connectGemini: (isReconnecting?: boolean) => void; reconnect?: () => void; close?: (code?: number, reason?: string) => void };
  private readonly _session: ProxySession;
  private readonly _clientSocket: WebSocket;
  private isTerminated: boolean = false;

  private constructor(
    id: string,
    fsm: SessionFsm,
    watchdogs: WatchdogManager,
    session: ProxySession,
    clientSocket: WebSocket,
    upstreamRouter: { connectGemini: (isReconnecting?: boolean) => void; reconnect?: () => void; close?: (code?: number, reason?: string) => void }
  ) {
    this._id = id;
    this._fsm = fsm;
    this._watchdogs = watchdogs;
    this._session = session;
    this._clientSocket = clientSocket;
    this._upstreamRouter = upstreamRouter;
  }

  public get id(): string { return this._id; }
  public get sessionId(): string { return this._id; }
  public get state(): LiveSessionState { return this._fsm.state; }
  public get fsm(): SessionFsm { return this._fsm; }
  public get watchdogs(): WatchdogManager { return this._watchdogs; }

  public static async start(options: SessionStartupOptions): Promise<LiveVoiceSession | null> {
    const { clientSocket, earlyQueue, cleanupEarlyCapture } = options;
    const req = options.req || options.request;
    if (!req) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      clientSocket.close(1008, 'Missing HTTP IncomingMessage');
      return null;
    }

    if ((clientSocket.readyState as number) === WebSocket.CLOSED || (clientSocket.readyState as number) === WebSocket.CLOSING) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      return null;
    }

    const config = await SessionConfigurationResolver.resolve(req);
    if (!config) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
      clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
      return null;
    }

    if ((clientSocket.readyState as number) === WebSocket.CLOSED || (clientSocket.readyState as number) === WebSocket.CLOSING) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      return null;
    }

    console.log(`📡 [LiveVoiceSession] Starting: type=${config.sessionType}, mode=${config.tutorMode}, model=${config.liveModel}`);

    const fsm = new SessionFsm('INIT');
    const watchdogs = new WatchdogManager();
    const aggregate = new LiveSessionAggregate(config, clientSocket, fsm, watchdogs);
    const session = aggregate.proxySession;
    session.aggregate = aggregate;

    let instance: LiveVoiceSession;
    const terminate = (reason: string = 'Normal Closure', code: number = 1000, source: string = 'Session') => {
      if (instance) instance.terminate(reason, code, source);
    };
    const terminateRouter = (source: string, code?: number, reason?: Buffer) => {
      if (instance) instance.terminate(reason ? reason.toString() : 'StreamRouter terminated', code, source);
    };

    watchdogs.onNudge = (elapsedMs) => {
      if ((session.isAiGenerating || session.awaitingToolSpeech) && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs }));
      }
    };

    watchdogs.onTimeout = (reason) => {
      if (session.isAiGenerating || session.awaitingToolSpeech) {
        console.warn(`⏱️ [DEAD_AIR_WATCHDOG] silence expired with zero response. Reclaiming mic.`);
        session.isAiGenerating = false;
        session.awaitingToolSpeech = false;
        session.streamSentinel?.resetTurnState();
        fsm.transition('CANDIDATE_LISTENING');
        if (session.currentTurnMetrics) session.currentTurnMetrics.droppedEchoChunksCount = 0;
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'dead_air_recovery',
            reason: reason || 'upstream_timeout',
            timestamp: Date.now()
          }));
        }
      }
    };

    session.streamSentinel = new LiveStreamSentinel({
      onPhase1ThinkingDelay: (elapsedMs) => {
        if (!session.isTerminated && clientSocket.readyState === WebSocket.OPEN) {
          try {
            clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs }));
          } catch {}
        }
      },
      onPhase2StallRecovery: (reason, consecutiveStalls) => {
        if (session.isTerminated) return;
        console.warn(`🛟 [STREAM_SENTINEL] ${reason} detected (stalls=${consecutiveStalls}, session=${config.sessionId}). Recovering turn.`);
        session.isAiGenerating = false;
        session.awaitingToolSpeech = false;
        fsm.transition('CANDIDATE_LISTENING');
        if (clientSocket.readyState === WebSocket.OPEN) {
          try {
            clientSocket.send(JSON.stringify({ type: 'stream_stall_detected', reason, consecutiveStalls }));
            clientSocket.send(JSON.stringify({ type: 'dead_air_recovery', reason, timestamp: Date.now() }));
          } catch {}
        }
        const upstreamDead = !session.geminiSocket || session.geminiSocket.readyState !== WebSocket.OPEN;
        if ((upstreamDead || consecutiveStalls >= 2) && !session.hotHandoffCoordinator?.isHandoffActive()) {
          router.reconnect?.();
        }
      }
    });

    session.heartbeatInterval = setInterval(() => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
      const inactivityLimitMs = (session.isOnHold || config.turnMode === 'manual') ? 1800000 : 900000;
      if (Date.now() - session.lastActivityAt > inactivityLimitMs) {
        console.warn(`⚠️ Session inactive for >${inactivityLimitMs / 1000}s. Terminating keepalive expired socket.`);
        terminate('KeepaliveTimeout');
      }
    }, 15000);
    (session.heartbeatInterval as any)?.unref?.();

    const { setupMessage } = LivePromptDirector.buildSetupDirectives(config, session);

    const router = createLiveAudioStreamRouter({
      session,
      setupMessage,
      upstreamWsUrl: config.upstreamWsUrl,
      clientSocket,
      terminate: terminateRouter,
      sessionId: config.sessionId,
      questionId: config.questionId,
      sessionType: config.sessionType,
      tutorMode: config.tutorMode,
      bugTitle: config.bugTitle,
      questionText: config.questionText,
      topic: config.topic,
      voiceName: config.voiceName,
      isRetry: config.isRetry,
      isResumed: config.isResumed,
      initialUserMessage: config.initialUserMessage,
      totalQuestions: config.totalQuestions,
      questionIndex: config.questionIndex,
      parsedHints: config.parsedHints,
      liveCoaching: config.liveCoaching,
      liveModel: config.liveModel,
      challengeCategory: config.challengeCategory,
      challengeTrack: config.challengeTrack
    });

    instance = new LiveVoiceSession(config.sessionId, fsm, watchdogs, session, clientSocket, router);

    clientSocket.on('close', (code, reason) => instance.terminate(reason ? reason.toString() : 'Client closed', code, 'ClientSocket'));
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      instance.terminate(err.message, 1011, 'ClientSocketError');
    });

    router.connectGemini(false);

    attachLiveClientFrameHandler({
      session,
      clientSocket,
      turnMode: config.turnMode,
      terminate: (src, cd, rsn) => instance.terminate(rsn ? rsn.toString() : 'Handler terminated', cd, src),
      earlyQueue,
      cleanupEarlyCapture
    });

    return instance;
  }

  public handleClientFrame(raw: RawData): void {
    if (this.isTerminated || this._session.isTerminated) return;
    this._clientSocket.emit('message', raw, false);
  }

  public terminate(reason: string = 'Normal Closure', code: number = 1000, source: string = 'Application'): void {
    if (this.isTerminated || this._session.isTerminated) return;
    this.isTerminated = true;
    this._session.isTerminated = true;
    this._fsm.transition('TERMINATED');
    this._watchdogs.dispose();
    this._session.streamSentinel?.dispose();
    this._session.hotHandoffCoordinator?.dispose();

    console.log(`🔌 [LiveVoiceSession] Termination triggered by [${source}], code=${code}, reason=${reason}`);
    if (this._session.heartbeatInterval) {
      clearInterval(this._session.heartbeatInterval);
      this._session.heartbeatInterval = null;
    }
    if (this._session.nudgeWatchdog) {
      clearTimeout(this._session.nudgeWatchdog);
      this._session.nudgeWatchdog = null;
    }
    if (this._session.reconnectTimer) {
      clearTimeout(this._session.reconnectTimer);
      this._session.reconnectTimer = null;
    }
    if (this._session.toolCallSafetyTimeout) {
      clearTimeout(this._session.toolCallSafetyTimeout);
      this._session.toolCallSafetyTimeout = null;
    }
    if (this._session.deadAirWatchdog) {
      clearTimeout(this._session.deadAirWatchdog);
      this._session.deadAirWatchdog = null;
    }
    if (this._session.currentAiTurnText && this._session.sessionId) {
      const textToSave = this._session.currentAiTurnText.trim();
      if (!isLanguageDrifted(textToSave)) {
        const mem = getOrCreateSessionMemory(this._session.sessionId, this._session.questionId || '');
        mem.turns.push({ role: 'model', text: textToSave });
        mem.lastSpeaker = 'model';
        mem.updatedAt = Date.now();
      } else {
        console.warn(`🚨 [LANGUAGE_CONTAMINATION_GUARD] Terminating session: discarded English-drifted turn from replay memory (${this._session.sessionId}).`);
      }
      this._session.currentAiTurnText = '';
    }
    this._session.frameQueue = [];
    try {
      this._upstreamRouter.close?.(code || 1000, reason ? reason.toString() : 'Normal Closure');
    } catch {}
    try {
      if (this._session.geminiSocket && (this._session.geminiSocket.readyState === WebSocket.OPEN || this._session.geminiSocket.readyState === WebSocket.CONNECTING)) {
        this._session.geminiSocket.close(1000, 'Normal Closure');
      }
    } catch {}
    try {
      if (this._clientSocket.readyState === WebSocket.OPEN || this._clientSocket.readyState === WebSocket.CONNECTING) {
        this._clientSocket.close(code || 1000, reason ? reason.toString() : 'Normal Closure');
      }
    } catch {}
  }
}
