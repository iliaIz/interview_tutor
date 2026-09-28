import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { handleSetupCompleteGreeting } from './LiveGreetingReplay';
import { LiveTelemetryAccumulator } from './LiveTelemetryAccumulator';
import { LiveToolCallExecutor } from './LiveToolCallExecutor';
import { isNonRetryableUpstreamError, isCannedErrorUtterance } from './liveStreamErrorDetector';
import { LiveDeadAirGuard } from './LiveDeadAirGuard';

export interface StreamRouterOptions {
  session: ProxySession;
  setupMessage: any;
  upstreamWsUrl: string;
  clientSocket: WebSocket;
  terminate: (source: string, code?: number, reason?: Buffer) => void;
  sessionId: string;
  questionId: string;
  sessionType: 'interview' | 'tutor' | 'system_design';
  tutorMode: string;
  bugTitle: string;
  questionText: string;
  topic: string;
  voiceName: string;
  isRetry: boolean;
  isResumed: boolean;
  initialUserMessage: string;
  totalQuestions: number;
  questionIndex: number;
  parsedHints: string[];
  liveCoaching: boolean;
  liveModel: string;
  challengeCategory?: string;
  challengeTrack?: string;
}

/**
 * Headless Live Audio Stream Router (SOTA Late 2026).
 * Decomposed into LiveGreetingReplay, LiveTelemetryAccumulator, and LiveToolCallExecutor.
 * Cognitive bounding limit: <= 350 lines.
 */
export function createLiveAudioStreamRouter(options: StreamRouterOptions) {
  const {
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
    challengeCategory = '',
    challengeTrack = ''
  } = options;

  const deadAirGuard = new LiveDeadAirGuard();

  const handleGeminiDisconnect = (source: string, code?: number, reason?: Buffer) => {
    if (session.isTerminated) return;
    session.isAiGenerating = false;
    const reasonStr = reason ? reason.toString() : '';
    console.warn(`⚠️ Upstream Gemini Live WS disconnected [${source}], code=${code}, reason=${reasonStr || 'none'}`);

    const isNonRetryable = session.hasTerminalError || isNonRetryableUpstreamError(reasonStr, code);

    if (isNonRetryable) {
      console.error(`🛑 Upstream Gemini Live encountered non-retryable error [${source}, code=${code}]. Halting session.`);
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({
            error: reasonStr || 'Голосовой шлюз отклонил подключение модели.',
            errorCode: session.terminalErrorCode || 'FORBIDDEN_MODEL_ACCESS',
            retryable: false,
            suggestedFallbackModel: 'gemini-live-v3'
          }));
        } catch {}
      }
      terminate(source, code, reason);
      return;
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      if ((session.reconnectAttempts || 0) < 3) {
        session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
        session.isUpstreamReconnecting = true;
        session.isSetupComplete = false;
        console.log(`🔄 Performing Upstream Hot Reconnect (attempt ${session.reconnectAttempts}/3)...`);

        try {
          clientSocket.send(JSON.stringify({
            type: 'upstream_reconnecting',
            attempt: session.reconnectAttempts,
            maxAttempts: 3
          }));
        } catch {}

        const backoffDelay = (session.reconnectAttempts - 1) * 400;
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        session.reconnectTimer = setTimeout(() => {
          if (!session.isTerminated && clientSocket.readyState === WebSocket.OPEN) {
            connectGemini(true);
          }
        }, backoffDelay);
        return;
      } else {
        console.error(`❌ Upstream Hot Reconnect attempts exhausted (3/3).`);
        try {
          clientSocket.send(JSON.stringify({
            error: 'Голосовой шлюз временно недоступен после повторных попыток переподключения.',
            errorCode: 'RECONNECT_ATTEMPTS_EXHAUSTED',
            retryable: false
          }));
        } catch {}
      }
    }

    terminate(source, code, reason);
  };

  const connectGemini = (isInternalReconnect = false) => {
    if (session.isTerminated || clientSocket.readyState !== WebSocket.OPEN) return;

    console.log(`⚡ ${isInternalReconnect ? 'Reconnecting' : 'Connecting'} to Upstream Gemini Live WS (${upstreamWsUrl})...`);

    if (session.geminiSocket) {
      try {
        session.geminiSocket.removeAllListeners();
        if (session.geminiSocket.readyState === WebSocket.OPEN || session.geminiSocket.readyState === WebSocket.CONNECTING) {
          session.geminiSocket.close();
        }
      } catch {}
    }

    const geminiSocket = new WebSocket(upstreamWsUrl);
    session.geminiSocket = geminiSocket;

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('close', (code, reason) => {
      handleGeminiDisconnect('GeminiUpstreamClose', code, reason);
    });

    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      handleGeminiDisconnect('GeminiUpstreamError');
    });

    geminiSocket.on('message', async (data: RawData) => {
      const buffer = toRawBuffer(data);
      let str = buffer.toString('utf8');
      let isToolCallProcessed = false;
      let parsed: any = null;

      try {
        parsed = JSON.parse(str);

        if (parsed.error) {
          const errString = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
          console.error(`❌ Upstream Gemini Live emitted error frame: ${errString}`);
          if (isNonRetryableUpstreamError(errString)) {
            session.hasTerminalError = true;
            session.terminalErrorCode = errString.toLowerCase().includes('forbidden') ? 'FORBIDDEN_MODEL_ACCESS' : 'UPSTREAM_CONFIGURATION_ERROR';
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({
                error: errString,
                errorCode: session.terminalErrorCode,
                retryable: false,
                suggestedFallbackModel: 'gemini-live-v3'
              }));
            }
            return;
          }
        }

        // 1. Setup Complete Greeting & History Replay
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          const wasReconnecting = session.isUpstreamReconnecting;
          session.isUpstreamReconnecting = false;
          session.reconnectAttempts = 0;
          console.log(`🎉 Upstream setupComplete received (Type: ${sessionType})!`);

          handleSetupCompleteGreeting({
            session,
            geminiSocket,
            clientSocket,
            sessionType,
            tutorMode,
            bugTitle,
            questionText,
            topic,
            isResumed: Boolean(isResumed),
            wasReconnecting: Boolean(wasReconnecting),
            initialUserMessage,
            questionIndex,
            totalQuestions,
            challengeCategory,
            challengeTrack
          });

          // Drain queued frames
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
          }
        }

        // 2. Model Turn & Output Transcription
        if (parsed.serverContent?.modelTurn) {
          session.isAiGenerating = true;
          session.isToolCallPending = false;
          if (session.toolCallSafetyTimeout) {
            clearTimeout(session.toolCallSafetyTimeout);
            session.toolCallSafetyTimeout = null;
          }
          const commitAnchor = session.lastTurnCommitTime || session.currentTurnMetrics?.candidateSpeechEndedAt || session.lastToolCallTime || session.sessionStartedAt || session.lastActivityAt || Date.now();
          session.lastActivityAt = Date.now();
          session.probesCount = (session.probesCount || 0) + 1;
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }
          if (session.deadAirWatchdog) {
            clearTimeout(session.deadAirWatchdog);
            session.deadAirWatchdog = null;
          }

          if (!session.currentTurnMetrics) {
            session.currentTurnMetrics = {
              turnIndex: session.currentTurnIndex || 0,
              candidateSpeechStartedAt: commitAnchor,
              candidateSpeechEndedAt: commitAnchor,
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

          let shouldClampDeadAir = false;

          if (parsed.serverContent.modelTurn.parts) {
            const filteredParts: any[] = [];
            for (const part of parsed.serverContent.modelTurn.parts) {
              const pcm = part.inlineData?.data || part.inline_data?.data;
              if (pcm) {
                const res = deadAirGuard.processChunk(pcm);
                if (res.shouldClampTurn) {
                  shouldClampDeadAir = true;
                  console.warn(`🛑 [DEAD_AIR_GUARD] Detected continuous acoustic silence after speech. Clamping model turn.`);
                }
                if (!res.suppressChunk) {
                  filteredParts.push(part);
                }
              } else {
                filteredParts.push(part);
              }
            }
            parsed.serverContent.modelTurn.parts = filteredParts;

            LiveTelemetryAccumulator.processModelTurnParts(session, filteredParts, commitAnchor);
            if (!session.isCannedErrorTurn && isCannedErrorUtterance(session.currentAiTurnText)) {
              session.isCannedErrorTurn = true;
              console.warn(`🚨 [ACOUSTIC_CIRCUIT_BREAKER] Upstream canned audio error detected in modelTurn text ("${session.currentAiTurnText?.slice(0, 80)}"). Suppressing audio and triggering stream recovery.`);
              if (clientSocket.readyState === WebSocket.OPEN) {
                try { clientSocket.send(JSON.stringify({ type: 'stream_recovery', reason: 'canned_upstream_error' })); } catch {}
              }
            }
          }

          if (shouldClampDeadAir) {
            parsed.serverContent.turnComplete = true;
            parsed.serverContent.generationComplete = true;
          }
        }

        // Output audio transcription text
        const outputTranscriptionText = parsed.serverContent?.outputTranscription?.text || parsed.serverContent?.output_transcription?.text;
        if (outputTranscriptionText) {
          session.currentAiTurnText = (session.currentAiTurnText || '') + outputTranscriptionText;
          if (!session.isCannedErrorTurn && isCannedErrorUtterance(session.currentAiTurnText)) {
            session.isCannedErrorTurn = true;
            console.warn(`🚨 [ACOUSTIC_CIRCUIT_BREAKER] Canned audio error detected in transcription.`);
            if (clientSocket.readyState === WebSocket.OPEN) {
              try { clientSocket.send(JSON.stringify({ type: 'stream_recovery', reason: 'canned_upstream_error' })); } catch {}
            }
          }
          if (session.deadAirWatchdog) {
            clearTimeout(session.deadAirWatchdog);
            session.deadAirWatchdog = null;
          }
        }

        // 3. Turn Complete / Generation Complete (SOTA Equivalence)
        const isUpstreamTurnComplete = Boolean(parsed.serverContent?.turnComplete || parsed.serverContent?.generationComplete);
        if (isUpstreamTurnComplete) {
          deadAirGuard.reset();
          const isInteractionIdle = !parsed.serverContent.interactionStatus || parsed.serverContent.interactionStatus === 'IDLE';
          if (isInteractionIdle) {
            if (session.isCannedErrorTurn) {
              console.log(`🔄 [ACOUSTIC_CIRCUIT_BREAKER] Canned error turn complete. Suppressing turn from history and dispatching recovery nudge to upstream Gemini (session: ${session.sessionId || 'anon'})...`);
              session.isCannedErrorTurn = false;
              session.currentAiTurnText = '';
              session.currentTurnMetrics = null;
              session.lastTurnCommitTime = undefined;
              session.currentTurnAudioBytes = 0;
              session.firstAudioChunkTime = undefined;
              session.audioChunksCount = 0;
              session.isAiGenerating = false;
              session.firstAudioChunkLogged = false;
              if (session.deadAirWatchdog) { clearTimeout(session.deadAirWatchdog); session.deadAirWatchdog = null; }
              if (session.toolCallSafetyTimeout) { clearTimeout(session.toolCallSafetyTimeout); session.toolCallSafetyTimeout = null; }

              const recoveryNudge = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: '[СИСТЕМНОЕ НАПОМИНАНИЕ]: Произошла внутренняя заминка связи. Продолжи диалог с кандидатом строго по теме, опираясь на последнее сообщение кандидата. Ответь кратко и емко голосом.' }]
                  }],
                  turnComplete: true
                }
              };
              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(recoveryNudge));
              }
              return;
            }

            LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, liveModel);
          }
        }

        // 4. Barge-In Interruption
        if (parsed.serverContent?.interrupted) {
          deadAirGuard.reset();
          LiveTelemetryAccumulator.handleBargeIn(session);
        }

        // 5. Tool Call Cancellation
        if (parsed.toolCallCancellation?.ids) {
          LiveToolCallExecutor.handleCancellation(session, parsed.toolCallCancellation.ids);
        }

        // 6. Tool Calls Execution
        if (parsed.toolCall?.functionCalls) {
          isToolCallProcessed = true;
          await LiveToolCallExecutor.executeFunctionCalls({
            functionCalls: parsed.toolCall.functionCalls,
            clientSocket,
            geminiSocket,
            session,
            parsedHints,
            liveCoaching
          });
        }
      } catch {}

      // SOTA Late 2026 Protocol Normalization: guarantee turnComplete is present downstream
      if (parsed?.serverContent?.generationComplete && !parsed.serverContent?.turnComplete) {
        parsed.serverContent.turnComplete = true;
        str = JSON.stringify(parsed);
      }

      const shouldForwardToClient = (!isToolCallProcessed || Boolean(parsed?.serverContent)) && !session.isCannedErrorTurn;
      if (shouldForwardToClient && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    });
  };

  return { connectGemini };
}
