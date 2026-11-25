/**
 * SessionTurnState.ts
 * Authoritative internal turn-state, watchdog arming, Turn 0 tool-lockdown guard (Invariant 2.1),
 * and turn-commit transition engine for LiveVoiceSession (Spec 46 <= 200 lines).
 */

import { WebSocket } from 'ws';
import { SessionFsm, LiveSessionState } from './sessionFsm';
import { WatchdogManager } from './WatchdogManager';
import { LiveDeadAirGuard } from './LiveDeadAirGuard';
import { ToolAudioMutex } from './ToolAudioMutex';
import { SessionResumptionManager } from './SessionResumptionManager';
import { LiveClientGuardService } from './liveClientGuardService';
import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import { ProxySession } from './liveSessionTypes';
import { DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';

export class SessionTurnState {
  public readonly proxySession: ProxySession;
  private readonly config: LiveSessionResolvedConfig;
  private readonly fsm: SessionFsm;

  constructor(
    config: LiveSessionResolvedConfig,
    clientSocket: WebSocket,
    fsm: SessionFsm,
    watchdogs: WatchdogManager
  ) {
    this.config = config;
    this.fsm = fsm;
    this.proxySession = {
      clientSocket,
      geminiSocket: null as any,
      aggregate: this,
      isSetupComplete: false,
      frameQueue: [],
      sessionId: config.sessionId,
      questionId: config.questionId,
      userId: config.authenticatedUser.id || 'default_user',
      topic: config.topic,
      questionText: config.questionText,
      referenceAnswer: config.referenceAnswer,
      relevantGapIds: config.relevantGapIds,
      probesCount: config.isResumed ? config.initialProbesCount : 0,
      isRetry: config.isRetry,
      questionIndex: config.questionIndex,
      totalQuestions: config.totalQuestions,
      hasCandidateResponded: Boolean(config.isResumed),
      isGreetingSent: false,
      isOnHold: false,
      lastActivityAt: Date.now(),
      heartbeatInterval: null,
      watchdogs,
      fsm,
      currentAiTurnText: '',
      persona: config.persona,
      targetGrade: config.targetGrade,
      isToolCallPending: false,
      sessionType: config.sessionType,
      hrMode: config.hrMode,
      chunkId: config.chunkId,
      startBeatId: config.startBeatId,
      beatScope: config.beatScope,
      tutorMode: config.tutorMode,
      liveModel: config.liveModel,
      isUpstreamReconnecting: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      toolCallSafetyTimeout: null,
      isTerminated: false,
      challengeCategory: config.challengeCategory,
      challengeTrack: config.challengeTrack,
      bugTitle: config.bugTitle,
      bugExplanation: config.bugExplanation,
      codeSnippet: config.codeSnippet,
      activeFilePath: config.activeFilePath,
      workspaceManifest: config.workspaceManifest,
      strategy: config.strategy,
      activeCodeArtifact: config.activeCodeArtifact,
      academyBridgeContext: config.academyBridgeContext,
      seniorReview: config.seniorReview,
      currentTurnIndex: 0,
      currentTurnMetrics: null,
      turnTelemetryHistory: [],
      vadPauseMs: config.vadPauseMs,
      enableSilenceClarification: Boolean(config.enableSilenceClarification),
      debugStep: config.debugStep,
      lastRttMs: null,
      sessionStartedAt: Date.now(),
      academyCourse: config.academyCourse,
      academyStep: config.academyStep,
      deadAirGuard: new LiveDeadAirGuard(),
      toolAudioMutex: new ToolAudioMutex(),
      resumptionManager: new SessionResumptionManager(config.resumptionHandle),
      resumptionHandle: config.resumptionHandle
    };
  }

  public get state(): LiveSessionState {
    return this.fsm.state;
  }

  public get hasCandidateResponded(): boolean {
    return Boolean(this.proxySession.hasCandidateResponded);
  }

  /**
   * Invariant 2.1: First-Turn Tool Lockdown Guard backed directly by live proxySession state.
   */
  public canExecuteGradingTools(): { allowed: boolean; reason?: string } {
    if (this.proxySession.isTerminated) {
      return { allowed: false, reason: 'Session is terminated' };
    }
    if (!this.proxySession.hasCandidateResponded && !this.config.isResumed) {
      return {
        allowed: false,
        reason: 'Candidate has not responded to the opening greeting yet (Turn 0 lockdown).'
      };
    }
    return { allowed: true };
  }

  public static armTurnWatchdogs(session: ProxySession, clientSocket: WebSocket): void {
    const isThinkingModel = Boolean(session.liveModel && session.liveModel.includes('thinking'));
    const isToolHeavyTutorSession = session.tutorMode === 'practice_pair' || session.sessionType === 'tutor';
    const isExtendedThinking = isThinkingModel || isToolHeavyTutorSession;

    if (session.fsm) {
      session.fsm.transition('COMMITTING');
      session.fsm.transition('AI_THINKING');
    }

    const wm = WatchdogManager.ensureSessionWatchdogs(session, clientSocket);
    wm.arm(isExtendedThinking, session.deadAirTimeoutMs);
  }

  public static handleTurnCommit(
    session: ProxySession,
    parsed: any,
    isBargeIn: boolean,
    clientSocket: WebSocket,
    turnMode: 'manual' | 'auto'
  ): boolean {
    const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;
    const guardCheck = LiveClientGuardService.evaluateTurnCompleteGuard(session, hasTextTurns, isBargeIn);
    if (guardCheck.shouldDrop) {
      if (guardCheck.guardName === 'ZERO_CHUNK_GUARD') {
        console.log(`🎙️ [ZERO_CHUNK_RECOVERY] Candidate committed with 0 audio chunks for session ${session.sessionId || 'anon'}. Synthesizing conversational prompt.`);
        if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
          session.geminiSocket.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: '[КАНДИДАТ ПЕРЕДАЛ СЛОВО: Завершил ответ. Задай следующий вопрос или дай обратную связь.]' }]
              }],
              turnComplete: true
            }
          }));
        }
        session.isAiGenerating = true;
        session.lastTurnCommitTime = Date.now();
        SessionTurnState.armTurnWatchdogs(session, clientSocket);
        return false;
      }
      return false;
    }

    const committedAudioChunks = session.audioChunksCount || 0;
    session.isAiGenerating = true;
    session.lastTurnCommitTime = Date.now();
    const speechDurationMs = session.currentTurnMetrics?.candidateSpeechStartedAt
      ? session.lastTurnCommitTime - session.currentTurnMetrics.candidateSpeechStartedAt
      : committedAudioChunks * 40;

    if (session.currentTurnMetrics) {
      session.currentTurnMetrics.candidateSpeechEndedAt = session.lastTurnCommitTime;
      session.currentTurnMetrics.speechDurationMs = speechDurationMs;
    } else {
      session.currentTurnMetrics = {
        turnIndex: session.currentTurnIndex || 0,
        candidateSpeechStartedAt: session.lastTurnCommitTime - speechDurationMs,
        candidateSpeechEndedAt: session.lastTurnCommitTime,
        vadPauseSettingMs: session.vadPauseMs || DEFAULT_VAD_PAUSE_MS,
        speechDurationMs,
        audioBytesReceived: 0,
        textChars: 0,
        droppedEchoChunksCount: 0,
        wasBargeIn: false,
        bargeInType: null,
        lastRttMs: session.lastRttMs ?? null
      };
    }
    if (hasTextTurns) {
      session.hasCandidateResponded = true;
    }
    console.log(`🎙️ [TURN_COMMIT] Candidate committed turn via turnComplete (sessionId: ${session.sessionId || 'anon'}, turnMode: ${turnMode}, audioChunksSent: ${committedAudioChunks}, duration: ${speechDurationMs}ms, hasTextTurns: ${hasTextTurns})`);
    session.audioChunksCount = 0;
    SessionTurnState.armTurnWatchdogs(session, clientSocket);
    return true;
  }
}
