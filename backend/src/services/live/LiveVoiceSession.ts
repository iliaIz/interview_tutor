/**
 * LiveVoiceSession.ts
 * Authoritative Aggregate Root for Gemini Live Audio Sessions (SPEC-003 / Spec 46).
 * Encapsulates SessionTurnState, DownstreamClientPipe, UpstreamTransportPort,
 * SessionFsm, WatchdogManager, and LiveStreamSentinel.
 * SLA: <= 260 lines.
 */

import { WebSocket, RawData } from 'ws';
import http from 'http';
import url from 'url';
import { isLanguageDrifted } from '../../prompts/core/languageDirectives';
import { LiveSessionBlueprintBuilder } from './LiveSessionBlueprintBuilder';
import { LiveSessionBlueprint } from './liveSessionConfigTypes';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ProxySession, UpstreamTransportPort, toRawBuffer } from './liveSessionTypes';
import { createUpstreamLiveChannel, UpstreamChannelOptions } from './UpstreamLiveChannel';
import { DownstreamClientPipe } from './DownstreamClientPipe';
import { WatchdogManager } from './WatchdogManager';
import { SessionFsm, LiveSessionState } from './sessionFsm';
import { SessionTurnState } from './SessionTurnState';
import { LiveStreamSentinel } from './LiveStreamSentinel';

export interface SessionStartupOptions {
  clientSocket: WebSocket;
  req?: http.IncomingMessage;
  request?: http.IncomingMessage;
  earlyQueue?: (Buffer | any)[];
  cleanupEarlyCapture?: () => void;
  createUpstream?: (options: UpstreamChannelOptions) => UpstreamTransportPort;
  blueprint?: LiveSessionBlueprint;
  blueprintBuilder?: (req: http.IncomingMessage, rawInitFrame?: any) => Promise<LiveSessionBlueprint | null>;
  initWaitTimeoutMs?: number;
}

export class LiveVoiceSession {
  private readonly _id: string;
  private readonly _fsm: SessionFsm;
  private readonly _watchdogs: WatchdogManager;
  private readonly _upstreamRouter: UpstreamTransportPort;
  private readonly _turnState: SessionTurnState;
  private readonly _session: ProxySession;
  private readonly _clientSocket: WebSocket;
  private readonly _clientPipe: DownstreamClientPipe;
  private isTerminated: boolean = false;

  private constructor(
    id: string,
    fsm: SessionFsm,
    watchdogs: WatchdogManager,
    turnState: SessionTurnState,
    clientSocket: WebSocket,
    clientPipe: DownstreamClientPipe,
    upstreamRouter: UpstreamTransportPort
  ) {
    this._id = id;
    this._fsm = fsm;
    this._watchdogs = watchdogs;
    this._turnState = turnState;
    this._session = turnState.proxySession;
    this._clientSocket = clientSocket;
    this._clientPipe = clientPipe;
    this._upstreamRouter = upstreamRouter;
  }

  public get id(): string { return this._id; }
  public get sessionId(): string { return this._id; }
  public get state(): LiveSessionState { return this._fsm.state; }
  public get fsm(): SessionFsm { return this._fsm; }
  public get watchdogs(): WatchdogManager { return this._watchdogs; }
  public get turnState(): SessionTurnState { return this._turnState; }

  private static parseSessionInitFrame(item: any): any | undefined {
    if (!item) return undefined;
    try {
      let parsed: any = item;
      if (typeof item === 'string') {
        parsed = JSON.parse(item);
      } else if (Buffer.isBuffer(item) || Array.isArray(item) || item instanceof ArrayBuffer) {
        parsed = JSON.parse(toRawBuffer(item).toString('utf8'));
      } else if (ArrayBuffer.isView(item)) {
        parsed = JSON.parse(Buffer.from(item.buffer, item.byteOffset, item.byteLength).toString('utf8'));
      }
      return parsed && typeof parsed === 'object' && parsed.type === 'session_init' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  public static extractEarlySessionInit(earlyQueue?: (Buffer | any)[]): any {
    if (!Array.isArray(earlyQueue) || earlyQueue.length === 0) return undefined;
    let latestInit: any;
    for (const item of earlyQueue) {
      const parsed = LiveVoiceSession.parseSessionInitFrame(item);
      if (parsed) latestInit = parsed;
    }
    return latestInit;
  }

  private static shouldAwaitInit(req?: http.IncomingMessage): boolean {
    if (!req?.url) return false;
    try {
      return url.parse(req.url, true).query?.awaitInit === '1';
    } catch {
      return req.url.includes('awaitInit=1');
    }
  }

  private static waitForSessionInit(
    clientSocket: WebSocket,
    earlyQueue?: (Buffer | any)[],
    timeoutMs: number = 150
  ): Promise<any | undefined> {
    const existing = LiveVoiceSession.extractEarlySessionInit(earlyQueue);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (frame?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clientSocket.off('message', onMessage);
        clientSocket.off('close', onClose);
        resolve(frame ?? LiveVoiceSession.extractEarlySessionInit(earlyQueue));
      };
      const onMessage = (data: RawData) => {
        if (Array.isArray(earlyQueue) && earlyQueue.length < 50 && earlyQueue[earlyQueue.length - 1] !== data) {
          earlyQueue.push(data);
        }
        const parsed = LiveVoiceSession.parseSessionInitFrame(data);
        if (parsed) finish(parsed);
      };
      const onClose = () => finish(undefined);
      const timer = setTimeout(() => finish(undefined), Math.max(1, timeoutMs));
      (timer as any)?.unref?.();
      clientSocket.on('message', onMessage);
      clientSocket.on('close', onClose);
    });
  }

  public static async start(options: SessionStartupOptions): Promise<LiveVoiceSession | null> {
    const { clientSocket, earlyQueue, cleanupEarlyCapture } = options;
    const req = options.req || options.request;

    if ((clientSocket.readyState as number) === WebSocket.CLOSED || (clientSocket.readyState as number) === WebSocket.CLOSING) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      return null;
    }

    let initialInitFrame = LiveVoiceSession.extractEarlySessionInit(earlyQueue);
    if (!initialInitFrame && !options.blueprint && LiveVoiceSession.shouldAwaitInit(req)) {
      initialInitFrame = await LiveVoiceSession.waitForSessionInit(
        clientSocket,
        earlyQueue,
        options.initWaitTimeoutMs ?? 150
      );
      if ((clientSocket.readyState as number) === WebSocket.CLOSED || (clientSocket.readyState as number) === WebSocket.CLOSING) {
        if (cleanupEarlyCapture) cleanupEarlyCapture();
        return null;
      }
    }
    let blueprint: LiveSessionBlueprint | null = options.blueprint ?? null;
    if (!blueprint) {
      if (!req) {
        if (cleanupEarlyCapture) cleanupEarlyCapture();
        clientSocket.close(1008, 'Missing HTTP IncomingMessage');
        return null;
      }
      blueprint = options.blueprintBuilder
        ? await options.blueprintBuilder(req, initialInitFrame)
        : await LiveSessionBlueprintBuilder.resolveFromRequest(req, initialInitFrame);
    }
    if (!blueprint) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
      clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
      return null;
    }

    if ((clientSocket.readyState as number) === WebSocket.CLOSED || (clientSocket.readyState as number) === WebSocket.CLOSING) {
      if (cleanupEarlyCapture) cleanupEarlyCapture();
      return null;
    }

    const { config } = blueprint;
    console.log(`📡 [LiveVoiceSession] Starting: type=${config.sessionType}, mode=${config.tutorMode}, model=${config.liveModel}`);

    const fsm = new SessionFsm('INIT');
    const turnState = new SessionTurnState(config, clientSocket, fsm);
    const session = turnState.proxySession;
    const watchdogs = turnState.watchdogs;

    let instance: LiveVoiceSession;
    const terminate = (reason: string = 'Normal Closure', code: number = 1000, source: string = 'Session') => {
      if (instance) instance.terminate(reason, code, source);
    };
    const terminateRouter = (source: string, code?: number, reason?: Buffer) => {
      if (instance) instance.terminate(reason ? reason.toString() : 'StreamRouter terminated', code, source);
    };

    const upstreamFactory = options.createUpstream ?? createUpstreamLiveChannel;
    const router = upstreamFactory({
      session,
      setupMessage: blueprint.buildUpstreamSetup(session.resumptionHandle),
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
    session.upstreamTransport = router;

    session.streamSentinel = new LiveStreamSentinel({
      onPhase1ThinkingDelay: (elapsedMs) => {
        if (!session.isTerminated && clientSocket.readyState === WebSocket.OPEN) {
          try { clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs })); } catch {}
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
        const upstreamDead = !router.isUpstreamOpen();
        if ((upstreamDead || consecutiveStalls >= 2) && !router.isHandoffActive?.()) {
          router.reconnect('stream_sentinel');
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

    const clientPipe = new DownstreamClientPipe({
      session,
      clientSocket,
      turnMode: config.turnMode,
      terminate: (src, cd, rsn) => instance.terminate(rsn ? rsn.toString() : 'Handler terminated', cd, src)
    });

    instance = new LiveVoiceSession(config.sessionId, fsm, watchdogs, turnState, clientSocket, clientPipe, router);

    clientSocket.on('close', (code, reason) => instance.terminate(reason ? reason.toString() : 'Client closed', code, 'ClientSocket'));
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      instance.terminate(err.message, 1011, 'ClientSocketError');
    });

    router.connect();

    if (cleanupEarlyCapture) cleanupEarlyCapture();
    clientSocket.on('message', (data: RawData) => clientPipe.handleFrame(data));
    if (Array.isArray(earlyQueue) && earlyQueue.length > 0) {
      for (const earlyData of earlyQueue) {
        clientPipe.handleFrame(earlyData);
      }
    }

    return instance;
  }

  public handleClientFrame(raw: RawData): void {
    if (this.isTerminated || this._session.isTerminated) return;
    this._clientPipe.handleFrame(raw);
  }

  public terminate(reason: string = 'Normal Closure', code: number = 1000, source: string = 'Application'): void {
    if (this.isTerminated || this._session.isTerminated) return;
    this.isTerminated = true;
    this._session.isTerminated = true;
    this._fsm.transition('TERMINATED');
    this._watchdogs.dispose();
    this._session.streamSentinel?.dispose();

    console.log(`🔌 [LiveVoiceSession] Termination triggered by [${source}], code=${code}, reason=${reason}`);
    if (this._session.heartbeatInterval) {
      clearInterval(this._session.heartbeatInterval);
      this._session.heartbeatInterval = null;
    }
    if (this._session.reconnectTimer) {
      clearTimeout(this._session.reconnectTimer);
      this._session.reconnectTimer = null;
    }
    if (this._session.toolCallSafetyTimeout) {
      clearTimeout(this._session.toolCallSafetyTimeout);
      this._session.toolCallSafetyTimeout = null;
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
    try { this._upstreamRouter.close?.(code || 1000, reason ? reason.toString() : 'Normal Closure'); } catch {}
    try {
      if (this._clientSocket.readyState === WebSocket.OPEN || this._clientSocket.readyState === WebSocket.CONNECTING) {
        this._clientSocket.close(code || 1000, reason ? reason.toString() : 'Normal Closure');
      }
    } catch {}
  }
}
