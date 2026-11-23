/**
 * sessionStartupHelper.ts
 * Helper factory to assemble initial ProxySession data bag for LiveVoiceSession (SPEC-003).
 * SLA: <= 100 lines.
 */

import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';
import { WatchdogManager } from './WatchdogManager';
import { SessionFsm } from './sessionFsm';
import { LiveDeadAirGuard } from './LiveDeadAirGuard';
import { ToolAudioMutex } from './ToolAudioMutex';
import { SessionResumptionManager } from './SessionResumptionManager';

export function createInitialProxySession(
  config: LiveSessionResolvedConfig,
  clientSocket: WebSocket,
  fsm: SessionFsm,
  watchdogs: WatchdogManager
): ProxySession {
  return {
    clientSocket,
    geminiSocket: null as any,
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
    hasCandidateResponded: config.isResumed,
    isGreetingSent: false,
    isOnHold: false,
    lastActivityAt: Date.now(),
    heartbeatInterval: null,
    nudgeWatchdog: null,
    deadAirWatchdog: null,
    watchdogs,
    fsm,
    currentAiTurnText: '',
    persona: config.persona,
    targetGrade: config.targetGrade,
    isToolCallPending: false,
    sessionType: config.sessionType,
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
