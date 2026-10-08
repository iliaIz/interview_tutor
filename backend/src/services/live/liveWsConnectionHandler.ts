import { WebSocket } from 'ws';
import http from 'http';
import { isLanguageDrifted } from '../../prompts/core/languageDirectives';
import { buildSystemPrompt } from './livePromptBuilder';
import { getLiveToolDeclarations } from './liveToolDeclarations';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ProxySession } from './liveSessionTypes';
import { createLiveAudioStreamRouter } from './liveAudioStreamRouter';
import { buildGeminiLiveSetupMessage } from './liveGeminiConfigBuilder';
import { resolveLiveWsSessionParams } from './liveWsSessionParams';
import { attachLiveClientFrameHandler } from './liveWsClientFrameHandler';

export async function handleLiveClientConnection(clientSocket: WebSocket, req: http.IncomingMessage) {
  const params = await resolveLiveWsSessionParams(req);
  if (!params) {
    console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
    clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
    return;
  }

  const {
    authenticatedUser,
    sessionType,
    tutorMode,
    bugTitle,
    bugExplanation,
    codeSnippet,
    fixedCode,
    unitTest,
    incidentContext,
    parsedHints,
    sessionId,
    questionId,
    topic,
    questionText,
    referenceAnswer,
    voiceName,
    userGender,
    turnMode,
    strategy,
    persona,
    targetGrade,
    maxProbes,
    deepDive,
    liveCoaching,
    strictness,
    customPromptOverride,
    questionIndex,
    totalQuestions,
    isRetry,
    isResumed,
    initialProbesCount,
    initialUserMessage,
    challengeCategory,
    challengeTrack,
    activeCodeArtifact,
    codeRevisionsSummary,
    anchors,
    candidateGaps,
    relevantGapIds,
    userProfile,
    liveModel,
    upstreamWsUrl,
    vadPauseMs,
    enableSilenceClarification,
    debugStep,
    temperature
  } = params;

  console.log(`📡 [WS_CONNECT] New Live Session connected: type=${sessionType}, mode=${tutorMode}, cat=${challengeCategory || 'none'}, track=${challengeTrack || 'none'}, model=${liveModel}`);

  const session: ProxySession = {
    clientSocket,
    geminiSocket: null as any,
    isSetupComplete: false,
    frameQueue: [],
    sessionId,
    questionId,
    userId: authenticatedUser.id || 'default_user',
    topic,
    questionText,
    referenceAnswer,
    relevantGapIds,
    probesCount: isResumed ? initialProbesCount : 0,
    isRetry,
    hasCandidateResponded: isResumed,
    isGreetingSent: false,
    isOnHold: false,
    lastActivityAt: Date.now(),
    heartbeatInterval: null,
    nudgeWatchdog: null,
    currentAiTurnText: '',
    persona,
    targetGrade,
    isToolCallPending: false,
    sessionType,
    liveModel,
    isUpstreamReconnecting: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    toolCallSafetyTimeout: null,
    isTerminated: false,
    challengeCategory,
    challengeTrack,
    bugTitle,
    bugExplanation,
    codeSnippet,
    strategy,
    activeCodeArtifact,
    currentTurnIndex: 0,
    currentTurnMetrics: null,
    turnTelemetryHistory: [],
    vadPauseMs,
    enableSilenceClarification: Boolean(enableSilenceClarification),
    debugStep,
    lastRttMs: null,
    sessionStartedAt: Date.now()
  };

  let isTerminated = false;
  const terminate = (source: string, code?: number, reason?: Buffer) => {
    if (isTerminated || session.isTerminated) return;
    isTerminated = true;
    session.isTerminated = true;

    console.log(`🔌 Termination triggered by [${source}], code=${code}, reason=${reason ? reason.toString() : 'none'}`);
    if (session.heartbeatInterval) {
      clearInterval(session.heartbeatInterval);
      session.heartbeatInterval = null;
    }
    if (session.nudgeWatchdog) {
      clearTimeout(session.nudgeWatchdog);
      session.nudgeWatchdog = null;
    }
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    if (session.deadAirWatchdog) {
      clearTimeout(session.deadAirWatchdog);
      session.deadAirWatchdog = null;
    }
    if (session.currentAiTurnText && session.sessionId) {
      const textToSave = session.currentAiTurnText.trim();
      if (!isLanguageDrifted(textToSave)) {
        const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
        mem.turns.push({ role: 'model', text: textToSave });
        mem.lastSpeaker = 'model';
        mem.updatedAt = Date.now();
      } else {
        console.warn(`🚨 [LANGUAGE_CONTAMINATION_GUARD] Terminating session: discarded English-drifted turn from replay memory (${session.sessionId}).`);
      }
      session.currentAiTurnText = '';
    }
    session.frameQueue = [];
    try {
      if (session.geminiSocket && (session.geminiSocket.readyState === WebSocket.OPEN || session.geminiSocket.readyState === WebSocket.CONNECTING)) {
        session.geminiSocket.close(1000, 'Normal Closure');
      }
    } catch {}
    try {
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close(1000, 'Normal Closure');
      }
    } catch {}
  };

  clientSocket.on('close', (code, reason) => terminate('ClientSocket', code, reason));
  clientSocket.on('error', (err) => {
    console.error('Client WS error:', err.message);
    terminate('ClientSocketError');
  });

  // WebSocket Keepalive Heartbeat (every 15s)
  session.heartbeatInterval = setInterval(() => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
    const inactivityLimitMs = (session.isOnHold || turnMode === 'manual') ? 1800000 : 180000;
    if (Date.now() - session.lastActivityAt > inactivityLimitMs) {
      console.warn(`⚠️ Session inactive for >${inactivityLimitMs / 1000}s. Terminating keepalive expired socket.`);
      terminate('KeepaliveTimeout');
    }
  }, 15000);

  const systemPromptText = buildSystemPrompt({
    topic,
    questionText,
    referenceAnswer,
    strategy,
    voiceName,
    userGender,
    turnMode,
    maxProbes,
    anchors,
    deepDive,
    liveCoaching,
    customPromptOverride,
    questionIndex,
    totalQuestions,
    sessionType,
    tutorMode,
    bugTitle,
    bugExplanation,
    codeSnippet,
    fixedCode,
    unitTest,
    incidentContext,
    hints: parsedHints,
    targetSeniority: userProfile.targetSeniority,
    primaryStack: userProfile.primaryStack,
    candidateGaps,
    activeCodeArtifact,
    codeRevisionsSummary,
    persona,
    targetGrade,
    strictness,
    challengeCategory,
    challengeTrack
  });

  const toolDeclarations = getLiveToolDeclarations(sessionType, tutorMode);
  const normalizedTools = toolDeclarations;

  const setupMessage = buildGeminiLiveSetupMessage({
    liveModel,
    voiceName,
    systemPromptText,
    sessionType,
    strategy,
    normalizedTools,
    vadPauseMs: session.vadPauseMs,
    turnMode,
    temperature
  });

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage,
    upstreamWsUrl,
    clientSocket,
    terminate,
    sessionId,
    questionId,
    sessionType,
    tutorMode,
    bugTitle,
    questionText,
    topic,
    voiceName,
    isRetry,
    isResumed,
    initialUserMessage,
    totalQuestions,
    questionIndex,
    parsedHints,
    liveCoaching,
    liveModel,
    challengeCategory,
    challengeTrack
  });

  // Start upstream connection
  router.connectGemini(false);

  // Attach incoming client frames handler
  attachLiveClientFrameHandler({
    session,
    clientSocket,
    turnMode,
    terminate
  });
}
