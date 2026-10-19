import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { handleSetupCompleteGreeting } from './LiveGreetingReplay';
import { LiveTelemetryAccumulator } from './LiveTelemetryAccumulator';
import { LiveToolCallExecutor } from './LiveToolCallExecutor';
import { isNonRetryableUpstreamError, isNonSpeechUtterance } from './liveStreamErrorDetector';
import { LiveCannedErrorRecovery } from './LiveCannedErrorRecovery';

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

        const baseDelay = 1200 * Math.pow(1.5, (session.reconnectAttempts || 1) - 1);
        const jitter = Math.floor(Math.random() * 800);
        const backoffDelay = Math.min(4500, Math.floor(baseDelay + jitter));
        console.log(`⏱️ Hot reconnect backoff scheduled: ${backoffDelay}ms (attempt ${session.reconnectAttempts}/3)`);

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
            questionIndex: session.questionIndex !== undefined ? session.questionIndex : questionIndex,
            totalQuestions: session.totalQuestions !== undefined ? session.totalQuestions : totalQuestions,
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

          if (parsed.serverContent.modelTurn.parts) {
            LiveTelemetryAccumulator.processModelTurnParts(session, parsed.serverContent.modelTurn.parts, commitAnchor);
            LiveCannedErrorRecovery.evaluateAndIntercept(
              session,
              clientSocket,
              session.currentAiTurnText || '',
              session.currentTurnAudioBytes
            );
          }
        }

        // Output audio transcription text
        const outputTranscriptionText = parsed.serverContent?.outputTranscription?.text || parsed.serverContent?.output_transcription?.text;
        if (outputTranscriptionText) {
          session.currentAiTurnText = (session.currentAiTurnText || '') + outputTranscriptionText;
          LiveCannedErrorRecovery.evaluateAndIntercept(
            session,
            clientSocket,
            session.currentAiTurnText || '',
            session.currentTurnAudioBytes
          );
          if (session.deadAirWatchdog) {
            clearTimeout(session.deadAirWatchdog);
            session.deadAirWatchdog = null;
          }
        }

        // 3. Tool Call Cancellation
        if (parsed.toolCallCancellation?.ids) {
          LiveToolCallExecutor.handleCancellation(session, parsed.toolCallCancellation.ids);
        }

        // 4. Tool Calls Execution
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

        // 5. Barge-In Interruption
        if (parsed.serverContent?.interrupted) {
          LiveTelemetryAccumulator.handleBargeIn(session);
        }

        // 6. Turn Complete / Generation Complete (SOTA Equivalence)
        const isUpstreamTurnComplete = Boolean(parsed.serverContent?.turnComplete || parsed.serverContent?.generationComplete);
        if (isUpstreamTurnComplete) {
          const isInteractionIdle = !parsed.serverContent.interactionStatus || parsed.serverContent.interactionStatus === 'IDLE';
          if (isInteractionIdle) {
            // SOTA Late 2026: Deduplicate terminal frame invocations
            // If turn has already concluded and current audio bytes are 0, ignore duplicate turnComplete/generationComplete
            if (!session.isAiGenerating && (session.currentTurnAudioBytes || 0) === 0 && (session.aiPlayoutEstimatedEndEpoch || 0) > Date.now()) {
              return;
            }

            const isToolCallTurn = Boolean(
              isToolCallProcessed ||
              parsed.toolCall ||
              session.isToolCallPending ||
              (session.lastToolCallTime && (Date.now() - session.lastToolCallTime < 4000))
            );

            const audioBytes = session.currentTurnAudioBytes || 0;
            const text = (session.currentAiTurnText || '').trim();
            const isZeroAudioTurn = !isToolCallTurn && audioBytes < 200 && (text.length < 5 || isNonSpeechUtterance(text, audioBytes));
            const allowSilenceClarification = Boolean(session.enableSilenceClarification);

            if (session.isCannedErrorTurn || (isZeroAudioTurn && allowSilenceClarification)) {
              if (isZeroAudioTurn) {
                session.cannedErrorType = session.hasCandidateResponded ? 'non_speech' : 'turn0_empty';
              }
              LiveCannedErrorRecovery.executeRecoveryNudge(session, geminiSocket);
              return;
            }

            LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, liveModel);
          }
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
