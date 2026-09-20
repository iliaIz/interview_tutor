import { WebSocket, RawData } from 'ws';
import http from 'http';
import url from 'url';
import { envConfig } from '../../config/env';
import { authService } from '../authService';
import { parseCookies } from '../../middleware/auth';
import { findRelevantCandidateGaps, getUserProfile, CandidateGap } from '../vectorMemoryService';
import { TargetGrade } from '../../prompts/personas';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { isLanguageDrifted } from '../../prompts/core/languageDirectives';
import { extractDefaultAnchors, buildSystemPrompt } from './livePromptBuilder';
import { getLiveToolDeclarations } from './liveToolDeclarations';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { createLiveAudioStreamRouter } from './liveAudioStreamRouter';

export async function handleLiveClientConnection(clientSocket: WebSocket, req: http.IncomingMessage) {
  const parsedUrl = url.parse(req.url || '', true);
  const query = parsedUrl.query;

  // Zero-Trust WebSocket Auth Verification (Ticket or HttpOnly Cookie)
  const ticket = (query.ticket as string) || '';
  let authenticatedUser: any = null;

  if (ticket) {
    const ticketResult = authService.verifyAndConsumeWsTicket(ticket);
    if (ticketResult) {
      authenticatedUser = ticketResult.user;
    }
  }

  if (!authenticatedUser) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['session_token'];
    if (sessionToken) {
      const sessionResult = authService.validateSession(sessionToken);
      if (sessionResult) {
        authenticatedUser = sessionResult.user;
      }
    }
  }

  // Internal test runner & diagnostic authentication via LITELLM_API_KEY
  if (!authenticatedUser) {
    const authHeader = (req.headers['authorization'] as string) || '';
    const queryToken = (query.token as string) || (query.auth_token as string) || '';
    const expectedKey = envConfig.proxy.apiKey;
    if (
      expectedKey &&
      (authHeader === `Bearer ${expectedKey}` || queryToken === expectedKey)
    ) {
      authenticatedUser = {
        id: 'user_master',
        name: 'Automated Test Runner',
        role: 'owner',
        created_at: new Date().toISOString()
      };
    }
  }

  if (!authenticatedUser) {
    console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
    clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
    return;
  }

  const rawSessionType = (query.sessionType as string) || '';
  const sessionType = (
    rawSessionType === 'tutor'
      ? 'tutor'
      : rawSessionType === 'system_design'
        ? 'system_design'
        : 'interview'
  ) as 'interview' | 'tutor' | 'system_design';

  const tutorMode = (query.tutorMode as any) || 'deep_dive';
  const bugTitle = (query.bugTitle as string) || '';
  const bugExplanation = (query.bugExplanation as string) || '';
  const codeSnippet = (query.codeSnippet as string) || '';
  const fixedCode = (query.fixedCode as string) || '';
  const unitTest = (query.unitTest as string) || '';
  let incidentContext: any = null;
  if (query.incidentContext) {
    try {
      incidentContext = JSON.parse(query.incidentContext as string);
    } catch {}
  }
  let parsedHints: string[] = [];
  if (query.hints) {
    try {
      const h = JSON.parse(query.hints as string);
      if (Array.isArray(h)) parsedHints = h.map(String);
    } catch {}
  }

  const sessionId = (query.sessionId as string) || '';
  const questionId = (query.questionId as string) || '';
  const topic = (query.topic as string) || 'Java & Spring Framework';
  const questionText = (query.questionText as string) || '';
  const referenceAnswer = (query.referenceAnswer as string) || '';
  const voiceName = (query.voice as string) || 'Kore';
  const userGender = ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female') as 'female' | 'male' | 'neutral';
  const turnMode = ((query.turnMode as string) === 'auto' ? 'auto' : 'manual') as 'manual' | 'auto';
  const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
  const persona = ((query.persona as string) || 'mentor') as any;
  const targetGrade = ((query.targetGrade as string) || 'L5_SENIOR') as TargetGrade;
  const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
  const deepDive = query.deepDive === 'true';
  const liveCoaching = query.liveCoaching === 'true';
  const rawStrictness = ((query.strictness as string) || '').toLowerCase();
  const strictness: StrictnessLevel | undefined = ['learning', 'standard', 'hardcore'].includes(rawStrictness)
    ? (rawStrictness as StrictnessLevel)
    : undefined;
  const customPromptOverride = (query.customPrompt as string) || '';
  const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
  const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);
  const isRetry = query.isRetry === 'true';
  const isResumed = query.isResumed === 'true';
  const initialProbesCount = Math.max(0, parseInt((query.probesCount as string) || '0', 10) || 0);
  const initialUserMessage = ((query.initialUserMessage as string) || '').trim();
  const challengeCategory = (query.category as string) || (query.challengeCategory as string) || '';
  const challengeTrack = (query.track as string) || (query.challengeTrack as string) || '';

  let activeCodeArtifact: any = null;
  if (query.activeCodeArtifact) {
    try {
      activeCodeArtifact = JSON.parse(query.activeCodeArtifact as string);
    } catch {}
  }

  let codeRevisionsSummary: any = null;
  if (query.codeRevisionsSummary) {
    try {
      codeRevisionsSummary = JSON.parse(query.codeRevisionsSummary as string);
    } catch {}
  }

  let customAnchors: string[] = [];
  if (query.customAnchors) {
    try {
      const parsed = JSON.parse(query.customAnchors as string);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customAnchors = parsed.slice(0, 10).map((a) => String(a).trim()).filter((a) => a.length > 0);
      }
    } catch {}
  }

  const anchors = customAnchors.length > 0 ? customAnchors : extractDefaultAnchors(referenceAnswer, questionText);

  let candidateGaps: CandidateGap[] = [];
  try {
    candidateGaps = await findRelevantCandidateGaps(questionText || bugTitle || topic, topic, questionId);
    if (candidateGaps.length > 0) {
      console.log(`🧠 Injected ${candidateGaps.length} relevant vector gaps into Live prompt for "${topic}"`);
    }
  } catch (gapErr) {
    console.warn('Could not pre-warm candidate gaps:', gapErr);
  }

  const userProfile = getUserProfile();
  const relevantGapIds = candidateGaps.map((g) => g.id);

  const proxyApiKey = envConfig.proxy.apiKey;
  const requestedModel = (query.liveModel as string) || '';
  const isSupported = envConfig.models.supportedLiveModels.includes(requestedModel);
  const liveModel = isSupported ? requestedModel : envConfig.models.live;
  if (requestedModel && !isSupported) {
    console.warn(`⚠️ Requested Live model "${requestedModel}" is not in supported list. Falling back to default "${envConfig.models.live}".`);
  }

  const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
  const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;

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
    isOnHold: false,
    lastActivityAt: Date.now(),
    heartbeatInterval: null,
    nudgeWatchdog: null,
    currentAiTurnText: '',
    persona,
    targetGrade,
    isToolCallPending: false,
    sessionType,
    isUpstreamReconnecting: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    toolCallSafetyTimeout: null,
    isTerminated: false,
    challengeCategory,
    challengeTrack,
    currentTurnIndex: 0,
    currentTurnMetrics: null,
    turnTelemetryHistory: [],
    vadPauseMs: Number(query.vadPauseMs) || 1800,
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
        session.geminiSocket.close();
      }
    } catch {}
    try {
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close();
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
  const isThinkingModel = liveModel.includes('thinking') || liveModel === 'gemini-live-thinking-v3';

  // SOTA 2026 Invariant: In Gemini Live Bidi WebSocket sessions, function calling is strictly synchronous.
  // NON_BLOCKING is unsupported in Bidi Live and causes turn pipeline desynchronization.
  const normalizedTools = toolDeclarations;

  const generationConfig: any = {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'].includes(voiceName) ? voiceName : 'Kore'
        }
      }
    },
    temperature: sessionType === 'tutor' ? 0.3 : (strategy === 'socratic_tutoring' ? 0.4 : 0.2)
  };

  if (isThinkingModel) {
    generationConfig.thinkingConfig = {
      thinkingLevel: 'LOW',
      includeThoughts: true
    };
  }

  const setupMessage: any = {
    setup: {
      model: `models/${liveModel}`,
      generationConfig,
      systemInstruction: {
        parts: [{ text: systemPromptText }]
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    }
  };

  if (normalizedTools.length > 0) {
    setupMessage.setup.tools = [
      {
        functionDeclarations: normalizedTools
      }
    ];
  }

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

  // Handle incoming client frames
  clientSocket.on('message', (data: RawData) => {
    session.lastActivityAt = Date.now();
    const buffer = toRawBuffer(data);
    let payloadBuffer = buffer;
    let parsed: any = null;

    try {
      const text = buffer.toString();
      parsed = JSON.parse(text);

      if (parsed.type === 'pong') {
        const sentTs = typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now();
        const rtt = Math.max(0, Date.now() - sentTs);
        session.lastRttMs = rtt;
        if (session.currentTurnMetrics) {
          session.currentTurnMetrics.lastRttMs = rtt;
        }
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'pong_ack', rtt, timestamp: Date.now() }));
        }
        return;
      }

      if (parsed.type === 'ping') {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'pong', timestamp: parsed.timestamp || Date.now() }));
        }
        return;
      }

      if (parsed.type === 'sync_ping') {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'sync_pong',
            isSetupComplete: session.isSetupComplete,
            isUpstreamReconnecting: session.isUpstreamReconnecting,
            isToolCallPending: session.isToolCallPending,
            timestamp: Date.now()
          }));
        }
        return;
      }

      if (parsed.type === 'resume_sync' && Array.isArray(parsed.turns) && session.sessionId) {
        const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
        if (mem.turns.length === 0 && parsed.turns.length > 0) {
          mem.turns = parsed.turns
            .map((t: any) => ({
              role: (t.role === 'model' || t.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
              text: String(t.text || '').trim()
            }))
            .filter((t: any) => t.text.length > 0);
          mem.lastSpeaker = mem.turns[mem.turns.length - 1]?.role || 'none';
          mem.updatedAt = Date.now();

          if (session.isSetupComplete && session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
            const replayTurns = mem.turns.map((t) => ({
              role: t.role,
              parts: [{ text: t.text }]
            }));
            session.geminiSocket.send(JSON.stringify({
              clientContent: {
                turns: replayTurns,
                turnComplete: false
              }
            }));
          }
        }
        return;
      }

      if (parsed.type === 'barge_in') {
        session.isAiGenerating = false;
        session.aiPlayoutEstimatedEndEpoch = 0;
        session.currentTurnAudioBytes = 0;
        session.audioChunksCount = 0;
        session.lastTurnCommitTime = 0;
        session.currentAiTurnText = '';
        if (session.nudgeWatchdog) {
          clearTimeout(session.nudgeWatchdog);
          session.nudgeWatchdog = null;
        }
        if (session.deadAirWatchdog) {
          clearTimeout(session.deadAirWatchdog);
          session.deadAirWatchdog = null;
        }
        if (session.currentTurnMetrics) {
          session.currentTurnMetrics.wasBargeIn = true;
          session.currentTurnMetrics.bargeInType = 'tactile';
          session.currentTurnMetrics.droppedEchoChunksCount = 0;
        }
        console.log(`🛑 [BARGE_IN] Client triggered tactile barge-in (epoch ${parsed.epoch || 0}) for session ${session.sessionId || 'anon'}`);
        if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
          session.geminiSocket.send(JSON.stringify({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text: '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN). ОТВЕТ СТРОГО НА РУССКОМ ЯЗЫКЕ]: Передай слово кандидату.' }] }],
              turnComplete: false
            }
          }));
        }
        return;
      }

      if (parsed.type === 'turn_reset') {
        session.isAiGenerating = false;
        session.aiPlayoutEstimatedEndEpoch = 0;
        session.currentTurnAudioBytes = 0;
        session.audioChunksCount = 0;
        session.currentAiTurnText = '';
        if (session.nudgeWatchdog) {
          clearTimeout(session.nudgeWatchdog);
          session.nudgeWatchdog = null;
        }
        if (session.deadAirWatchdog) {
          clearTimeout(session.deadAirWatchdog);
          session.deadAirWatchdog = null;
        }
        if (session.currentTurnMetrics) {
          session.currentTurnMetrics.droppedEchoChunksCount = 0;
        }
        console.log(`🔄 [TURN_RESET] Synchronized reset received from client for session ${session.sessionId || 'anon'}. Microphone unlocked and echo guard cleared.`);
        return;
      }

      if (parsed.type === 'session_hold') {
        session.isOnHold = Boolean(parsed.paused);
        session.lastActivityAt = Date.now();
        console.log(`⏸️ Client toggled session_hold: ${session.isOnHold ? 'HOLD' : 'ACTIVE'}`);
        return;
      }

      if (parsed.type === 'canvas_delta') {
        if (parsed.payload?.architectureMermaid) {
          session.currentArchitectureMermaid = parsed.payload.architectureMermaid;
        }
        if (parsed.payload?.graphIr) {
          session.currentGraphIr = parsed.payload.graphIr;
        }

        if (session.isSetupComplete && session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
          let deicticContent = '';
          if (parsed.payload?.graphIr) {
            const summary = parsed.payload.mutationSummary ? `${parsed.payload.mutationSummary}\n` : '';
            deicticContent = `${summary}${parsed.payload.graphIr}`;
          } else {
            deicticContent = parsed.payload?.mutationSummary || 
              (parsed.payload?.focusedElement 
                ? `Фокус кандидата на компоненте: ${parsed.payload.focusedElement.label || parsed.payload.focusedElement.id} (${parsed.payload.focusedElement.nodeType || 'node'}, config: ${JSON.stringify(parsed.payload.focusedElement.config || {})})` 
                : 'Кандидат внёс изменения в архитектурный граф на холсте');
          }

          const deicticText = `[CANVAS_DEICTIC_CONTEXT (ЯЗЫК: РУССКИЙ): ${deicticContent}]`;
          session.geminiSocket.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: deicticText }]
              }],
              turnComplete: false
            }
          }));
        }
        return;
      }

      const isDeicticFrame = Boolean(
        parsed.deictic ||
        parsed.type === 'screen_context_sync' ||
        parsed.clientContent?.turns?.some((t: any) =>
          t.parts?.some((p: any) =>
            typeof p.text === 'string' && (
              p.text.startsWith('📌 [КОНТЕКСТ ЭКРАНА') ||
              p.text.startsWith('🎯 [ФОКУС ВНИМАНИЯ') ||
              p.text.startsWith('📝 [АКТУАЛЬНЫЙ КОД') ||
              p.text.startsWith('💡 [ДЕЙСТВИЕ') ||
              p.text.startsWith('🔍 [ДЕЙСТВИЕ') ||
              p.text.startsWith('📂 [СМЕНА')
            )
          )
        )
      );

      if (parsed.clientContent?.turns) {
        // Release any pending tool call gates upon genuine client input / barge-in
        if (!isDeicticFrame) {
          session.isToolCallPending = false;
          if (session.toolCallSafetyTimeout) {
            clearTimeout(session.toolCallSafetyTimeout);
            session.toolCallSafetyTimeout = null;
          }
        }

        if (session.sessionId && !isDeicticFrame) {
          for (const turn of parsed.clientContent.turns) {
            if (turn.parts) {
              const turnText = turn.parts.map((p: any) => p.text || '').join('').trim();
              if (turnText && !turnText.startsWith('[ВОЗОБНОВЛЕНИЕ') && !turnText.startsWith('[ТЕХНИЧЕСКАЯ') && !turnText.startsWith('📌 [КОНТЕКСТ ЭКРАНА') && !turnText.startsWith('🎯 [ФОКУС ВНИМАНИЯ') && !turnText.startsWith('[КАНДИДАТ ПРЕРВАЛ')) {
                const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
                mem.turns.push({ role: 'user', text: turnText });
                mem.lastSpeaker = 'user';
                mem.updatedAt = Date.now();
              }
            }
          }
        }
      }

      if (session.sessionId && (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks)) {
        const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
        mem.lastSpeaker = 'user';
        mem.updatedAt = Date.now();
      }

      if (parsed.setup) {
        return;
      }

      if (
        (!isDeicticFrame && parsed.clientContent?.turns) ||
        parsed.clientContent?.turnComplete ||
        parsed.realtime_input?.audio ||
        parsed.realtimeInput?.audio ||
        parsed.realtimeInput?.mediaChunks
      ) {
        session.hasCandidateResponded = true;
      }

      if (parsed.clientContent?.turnComplete) {
        const chunksCount = session.audioChunksCount || 0;
        const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;

        // SOTA 2026 Zero-Chunk Commit Suppression Guard:
        // Bare turnComplete: true without candidate audio or text is an illegal dialog transition.
        // It triggers an empty re-prompt from Gemini Live, causing a runaway cascading echo loop.
        if (chunksCount === 0 && !hasTextTurns) {
          console.warn(`🛡️ [ZERO_CHUNK_GUARD] Dropped empty turnComplete frame (0 audio chunks, 0 text turns, sessionId: ${session.sessionId || 'anon'}). Preventing hallucinated echo loop.`);
          return;
        }

        // SOTA 2026 Rapid Commit Flood Protection Guard:
        const timeSinceLastCommit = Date.now() - (session.lastTurnCommitTime || 0);
        if (timeSinceLastCommit < 600 && (session.lastTurnCommitTime || 0) > 0) {
          console.warn(`🛡️ [FLOOD_GUARD] Suppressed rapid turnComplete flood (${timeSinceLastCommit}ms since last commit, session: ${session.sessionId || 'anon'})`);
          return;
        }

        // SOTA 2026 Playout-Aware Stale Guard:
        // Suppress turnComplete if Gemini is generating OR if the physical DAC audio playout is still active.
        const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
        if ((session.isAiGenerating || isPlayoutActive) && !hasTextTurns) {
          const remainingMs = isPlayoutActive ? session.aiPlayoutEstimatedEndEpoch! - Date.now() : 0;
          console.warn(`🛡️ [STALE_GUARD] Suppressed client turnComplete because AI speech/playout is still active (sessionId: ${session.sessionId || 'anon'}, generating: ${session.isAiGenerating}, remaining playout: ${remainingMs}ms)`);
          return;
        }
        session.audioChunksCount = 0;
        session.isAiGenerating = true;
        session.lastTurnCommitTime = Date.now();
        const speechDurationMs = session.currentTurnMetrics?.candidateSpeechStartedAt
          ? session.lastTurnCommitTime - session.currentTurnMetrics.candidateSpeechStartedAt
          : (session.audioChunksCount || 0) * 40;

        if (session.currentTurnMetrics) {
          session.currentTurnMetrics.candidateSpeechEndedAt = session.lastTurnCommitTime;
          session.currentTurnMetrics.speechDurationMs = speechDurationMs;
        } else {
          session.currentTurnMetrics = {
            turnIndex: session.currentTurnIndex || 0,
            candidateSpeechStartedAt: session.lastTurnCommitTime - speechDurationMs,
            candidateSpeechEndedAt: session.lastTurnCommitTime,
            vadPauseSettingMs: session.vadPauseMs || 1800,
            speechDurationMs,
            audioBytesReceived: 0,
            textChars: 0,
            droppedEchoChunksCount: 0,
            wasBargeIn: false,
            bargeInType: null,
            lastRttMs: session.lastRttMs ?? null
          };
        }
        console.log(`🎙️ [TURN_COMMIT] Candidate committed turn via turnComplete (sessionId: ${session.sessionId || 'anon'}, turnMode: ${turnMode}, audioChunksSent: ${session.audioChunksCount || 0}, duration: ${speechDurationMs}ms)`);
        session.audioChunksCount = 0;
        if (session.nudgeWatchdog) clearTimeout(session.nudgeWatchdog);
        session.nudgeWatchdog = setTimeout(() => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs: 5500 }));
          }
        }, 5500);

        // Bounded Generation Watchdog: SOTA 2026 Dead-Air Prevention (8.0s timeout or session override)
        const deadAirTimeoutMs = session.deadAirTimeoutMs ?? 8000;
        if (session.deadAirWatchdog) clearTimeout(session.deadAirWatchdog);
        session.deadAirWatchdog = setTimeout(() => {
          if (session.isAiGenerating) {
            console.warn(`⏱️ [DEAD_AIR_WATCHDOG] ${deadAirTimeoutMs}ms silence expired with zero response from Gemini Live (sessionId: ${session.sessionId || 'anon'}). Reclaiming microphone and dispatching conversational nudge.`);
            session.isAiGenerating = false;
            if (session.currentTurnMetrics) {
              session.currentTurnMetrics.droppedEchoChunksCount = 0;
            }
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({
                type: 'dead_air_recovery',
                reason: 'upstream_timeout',
                timestamp: Date.now()
              }));
            }
            if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
              try {
                session.geminiSocket.send(JSON.stringify({
                  clientContent: {
                    turns: [{
                      role: 'user',
                      parts: [{ text: '[СИСТЕМНОЕ СООБЩЕНИЕ: Кандидат закончил говорить. Задай вопрос или отреагируй на реплику.]' }]
                    }],
                    turnComplete: true
                  }
                }));
              } catch (e) {
                console.warn('Failed to send conversational nudge to Gemini:', e);
              }
            }
          }
        }, deadAirTimeoutMs);
      }

      if (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
        session.audioChunksCount = (session.audioChunksCount || 0) + 1;
        if (session.audioChunksCount === 1) {
          console.log(`🎤 [CLIENT_SPEECH_START] Audio streaming active from mic for session ${session.sessionId || 'anon'}`);
          session.currentTurnIndex = (session.currentTurnIndex || 0) + 1;
          session.currentTurnMetrics = {
            turnIndex: session.currentTurnIndex,
            candidateSpeechStartedAt: Date.now(),
            vadPauseSettingMs: session.vadPauseMs || 1800,
            speechDurationMs: 0,
            audioBytesReceived: 0,
            textChars: 0,
            droppedEchoChunksCount: 0,
            wasBargeIn: false,
            bargeInType: null,
            lastRttMs: session.lastRttMs ?? null
          };
        }
        const audioData =
          parsed.realtime_input?.audio?.data ||
          parsed.realtimeInput?.audio?.data ||
          parsed.realtimeInput?.mediaChunks?.[0]?.data;
        const mimeType =
          parsed.realtime_input?.audio?.mimeType ||
          parsed.realtimeInput?.audio?.mimeType ||
          parsed.realtimeInput?.mediaChunks?.[0]?.mimeType ||
          'audio/pcm;rate=16000';

        if (audioData) {
          const normalized = {
            realtimeInput: {
              audio: {
                mimeType,
                data: audioData
              }
            }
          };
          payloadBuffer = Buffer.from(JSON.stringify(normalized));
        }
      } else if (parsed.clientContent) {
        payloadBuffer = Buffer.from(JSON.stringify({ clientContent: parsed.clientContent }));
      }
    } catch {}

    if (!session.isSetupComplete || session.isUpstreamReconnecting) {
      const MAX_FRAME_QUEUE = 200;
      if (session.frameQueue.length >= MAX_FRAME_QUEUE) {
        session.frameQueue.shift();
      }
      session.frameQueue.push(payloadBuffer);
    } else {
      // SOTA 2026 Half-Duplex Acoustic Guard: Drop raw microphone audio while AI is actively speaking,
      // physically playing through DAC, or executing tool calls, unless explicitly flagged with tactile barge-in.
      // This prevents acoustic speaker bleed from triggering false upstream VAD interruptions.
      const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
      if (session.isToolCallPending || session.isAiGenerating || isPlayoutActive) {
        try {
          const parsedObj = parsed;
          if (parsedObj.realtime_input?.audio || parsedObj.realtimeInput?.audio || parsedObj.realtimeInput?.mediaChunks) {
            if (!parsedObj.bargeIn && !parsedObj.barge_in) {
              if (session.currentTurnMetrics) {
                session.currentTurnMetrics.droppedEchoChunksCount = (session.currentTurnMetrics.droppedEchoChunksCount || 0) + 1;
                if (session.currentTurnMetrics.droppedEchoChunksCount === 1 || session.currentTurnMetrics.droppedEchoChunksCount % 25 === 0) {
                  console.log(`🛡️ [ECHO_GUARD] Suppressed mic audio frame while AI is generating/playing (session ${session.sessionId || 'anon'}, dropped chunks: ${session.currentTurnMetrics.droppedEchoChunksCount})`);
                }
              }
              return;
            }
          }
        } catch {}
      }

      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(payloadBuffer);
      }
    }
  });
}
