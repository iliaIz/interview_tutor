/**
 * LiveSessionAggregate.ts
 * Authoritative Aggregate Root for Gemini Live Multimodal Sessions (SPEC-27).
 * Encapsulates session state machine transitions, watchdog coordination,
 * turn telemetry, and Turn 0 tool lockdown invariant enforcement (Invariant 2.1).
 * Eliminates direct mutation of the 84-field ProxySession anemic data bag.
 * Cognitive Bounding SLA: <= 300 lines (Rule 8 compliant).
 */

import { WebSocket } from 'ws';
import { SessionFsm, LiveSessionState } from './sessionFsm';
import { WatchdogManager } from './WatchdogManager';
import { ProxySession, CurrentTurnMetrics } from './liveSessionTypes';
import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import { createInitialProxySession } from './sessionStartupHelper';

export class LiveSessionAggregate {
  private readonly _id: string;
  private readonly _config: LiveSessionResolvedConfig;
  private readonly _fsm: SessionFsm;
  private readonly _watchdogs: WatchdogManager;
  private readonly _clientSocket: WebSocket;
  private readonly _proxySession: ProxySession;

  private _hasCandidateResponded: boolean;
  private _isAiGenerating: boolean = false;
  private _isTerminated: boolean = false;
  private _currentTurnIndex: number = 0;
  private _lastActivityAt: number = Date.now();
  private _currentTurnMetrics: CurrentTurnMetrics | null = null;

  constructor(
    config: LiveSessionResolvedConfig,
    clientSocket: WebSocket,
    fsm?: SessionFsm,
    watchdogs?: WatchdogManager
  ) {
    this._id = config.sessionId;
    this._config = config;
    this._clientSocket = clientSocket;
    this._fsm = fsm || new SessionFsm('INIT');
    this._watchdogs = watchdogs || new WatchdogManager();
    this._hasCandidateResponded = Boolean(config.isResumed);

    // Assemble the legacy proxy session bridge to maintain backwards compatibility
    this._proxySession = createInitialProxySession(
      config,
      clientSocket,
      this._fsm,
      this._watchdogs
    );
  }

  public get id(): string {
    return this._id;
  }

  public get sessionId(): string {
    return this._id;
  }

  public get state(): LiveSessionState {
    return this._fsm.state;
  }

  public get fsm(): SessionFsm {
    return this._fsm;
  }

  public get watchdogs(): WatchdogManager {
    return this._watchdogs;
  }

  public get clientSocket(): WebSocket {
    return this._clientSocket;
  }

  public get proxySession(): ProxySession {
    return this._proxySession;
  }

  public get hasCandidateResponded(): boolean {
    return this._hasCandidateResponded;
  }

  public get isAiGenerating(): boolean {
    return this._isAiGenerating;
  }

  public get isTerminated(): boolean {
    return this._isTerminated;
  }

  public get currentTurnIndex(): number {
    return this._currentTurnIndex;
  }

  public get lastActivityAt(): number {
    return this._lastActivityAt;
  }

  public get currentTurnMetrics(): CurrentTurnMetrics | null {
    return this._currentTurnMetrics;
  }

  /**
   * INVARIANT 2.1: First-Turn Tool Lockdown Invariant.
   * Grading tools (submit_interview_evaluation) are strictly forbidden
   * from executing if the candidate has not spoken yet.
   */
  public canExecuteGradingTools(): { allowed: boolean; reason?: string } {
    if (this._isTerminated) {
      return { allowed: false, reason: 'Session is terminated' };
    }
    if (!this._hasCandidateResponded && !this._config.isResumed) {
      return {
        allowed: false,
        reason: 'Candidate has not responded to the opening greeting yet (Turn 0 lockdown).'
      };
    }
    return { allowed: true };
  }

  public markCandidateResponded(): void {
    this._hasCandidateResponded = true;
    this._proxySession.hasCandidateResponded = true;
    this.recordActivity();
  }

  public beginAiTurn(): void {
    this._isAiGenerating = true;
    this._proxySession.isAiGenerating = true;
    this._fsm.transition('AI_SPEAKING');
    this.recordActivity();
  }

  public endAiTurn(): void {
    this._isAiGenerating = false;
    this._proxySession.isAiGenerating = false;
    this._fsm.transition('CANDIDATE_LISTENING');
    this.recordActivity();
  }

  public recordActivity(): void {
    this._lastActivityAt = Date.now();
    this._proxySession.lastActivityAt = this._lastActivityAt;
  }

  public startTurn(vadPauseSettingMs: number = 800): void {
    this._currentTurnIndex++;
    this._proxySession.currentTurnIndex = this._currentTurnIndex;
    this._currentTurnMetrics = {
      turnIndex: this._currentTurnIndex,
      vadPauseSettingMs,
      speechDurationMs: 0,
      audioBytesReceived: 0,
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false
    };
    this._proxySession.currentTurnMetrics = this._currentTurnMetrics;
    this.recordActivity();
  }

  public recordAudioBytes(bytes: number): void {
    if (this._currentTurnMetrics) {
      this._currentTurnMetrics.audioBytesReceived += bytes;
    }
    this.recordActivity();
  }

  public recordTextChars(chars: number): void {
    if (this._currentTurnMetrics) {
      this._currentTurnMetrics.textChars += chars;
    }
    this.recordActivity();
  }

  public finalizeTurnMetrics(): CurrentTurnMetrics | null {
    if (!this._currentTurnMetrics) return null;
    const metrics = { ...this._currentTurnMetrics };
    this._proxySession.turnTelemetryHistory = this._proxySession.turnTelemetryHistory || [];
    this._currentTurnMetrics = null;
    this._proxySession.currentTurnMetrics = null;
    return metrics;
  }

  public terminate(reason: string = 'Normal Closure', code: number = 1000): void {
    if (this._isTerminated) return;
    this._isTerminated = true;
    this._proxySession.isTerminated = true;

    if (this._proxySession.heartbeatInterval) {
      clearInterval(this._proxySession.heartbeatInterval);
      this._proxySession.heartbeatInterval = null;
    }

    this._watchdogs.dispose();

    try {
      this._fsm.transition('TERMINATED');
    } catch {}

    if (
      this._clientSocket.readyState === WebSocket.OPEN ||
      this._clientSocket.readyState === WebSocket.CONNECTING
    ) {
      try {
        this._clientSocket.close(code, reason);
      } catch {}
    }
  }
}
