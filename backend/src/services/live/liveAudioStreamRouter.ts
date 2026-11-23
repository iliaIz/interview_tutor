/**
 * liveAudioStreamRouter.ts
 * Headless Live Audio Stream Router (SOTA Late 2026).
 * Coordinates UpstreamGeminiPipe, LiveGreetingReplay, LiveTelemetryAccumulator, and LiveToolEngine.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { handleSetupCompleteGreeting } from './LiveGreetingReplay';
import { LiveTelemetryAccumulator } from './LiveTelemetryAccumulator';
import { LiveToolEngine } from './LiveToolEngine';
import { isNonSpeechUtterance } from './liveStreamErrorDetector';
import { LiveCannedErrorRecovery } from './LiveCannedErrorRecovery';
import { UpstreamGeminiPipe } from './UpstreamGeminiPipe';

export interface StreamRouterOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  terminate: (source: string, code?: number, reason?: Buffer) => void;
  setupMessage?: any;
  upstreamWsUrl?: string;
  sessionId?: string;
  questionId?: string;
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill';
  tutorMode?: string;
  bugTitle?: string;
  questionText?: string;
  topic?: string;
  voiceName?: string;
  isRetry?: boolean;
  isResumed?: boolean;
  initialUserMessage?: string;
  totalQuestions?: number;
  questionIndex?: number;
  parsedHints?: string[];
  liveCoaching?: boolean;
  liveModel?: string;
  challengeCategory?: string;
  challengeTrack?: string;
}

export function createLiveAudioStreamRouter(options: StreamRouterOptions) {
  const {
    session,
    clientSocket,
    terminate,
    upstreamWsUrl = '',
    setupMessage = {},
    sessionType = session.sessionType || 'interview',
    tutorMode = 'socratic_tutoring',
    bugTitle = (session as any).bugTitle || '',
    questionText = session.questionText || '',
    topic = session.topic || 'Java',
    isResumed = false,
    initialUserMessage = '',
    totalQuestions = session.totalQuestions ?? 0,
    questionIndex = session.questionIndex ?? 0,
    parsedHints = [],
    liveCoaching = false,
    liveModel = session.liveModel || 'gemini-live-v3',
    challengeCategory = (session as any).challengeCategory || '',
    challengeTrack = (session as any).challengeTrack || ''
  } = options;

  let pipe: UpstreamGeminiPipe;

  pipe = new UpstreamGeminiPipe({
    upstreamWsUrl,
    setupMessage,
    liveModel,
    maxReconnectAttempts: 3,
    onOpen: (ws) => {
      session.geminiSocket = ws;
    },
    onReconnecting: (attempt, maxAttempts) => {
      session.isUpstreamReconnecting = true;
      session.isSetupComplete = false;
      session.reconnectAttempts = attempt;
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({ type: 'upstream_reconnecting', attempt, maxAttempts }));
        } catch {}
      }
    },
    onDisconnect: (source, code, reason, isNonRetryable) => {
      if (session.isTerminated) return;
      session.isAiGenerating = false;
      const reasonStr = reason ? reason.toString() : '';

      if (isNonRetryable) {
        console.error(`🛑 Upstream Gemini Live non-retryable error [${source}, code=${code}]. Halting.`);
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
      } else if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({
            error: 'Голосовой шлюз временно недоступен после повторных попыток переподключения.',
            errorCode: 'RECONNECT_ATTEMPTS_EXHAUSTED',
            retryable: false
          }));
        } catch {}
      }
      terminate(source, code, reason);
    },
    onMessage: async (parsed, rawStr) => {
      if (session.isTerminated || !parsed) return;
      let str = rawStr;
      let isToolCallProcessed = false;
      const geminiSocket = pipe.getSocket();

      if (parsed.error) {
        const errString = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        console.error(`❌ Upstream Gemini Live emitted error frame: ${errString}`);
      }

      // 1. Setup Complete Greeting & History Replay
      if (parsed.setupComplete && geminiSocket) {
        session.isSetupComplete = true;
        const wasReconnecting = session.isUpstreamReconnecting;
        session.isUpstreamReconnecting = false;
        pipe.resetReconnectAttempts();
        session.reconnectAttempts = 0;

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

        if (!isResumed && !wasReconnecting) {
          session.frameQueue = [];
        } else {
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
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
        const commitAnchor = session.currentTurnMetrics?.candidateSpeechEndedAt || session.lastTurnCommitTime || session.lastToolCallTime || session.lastActivityAt || Date.now();
        session.lastActivityAt = Date.now();
        session.probesCount = (session.probesCount || 0) + 1;
        if (session.watchdogs) session.watchdogs.heartbeat();
        session.fsm?.transition('AI_SPEAKING');
        if (session.nudgeWatchdog) { clearTimeout(session.nudgeWatchdog); session.nudgeWatchdog = null; }
        if (session.deadAirWatchdog) { clearTimeout(session.deadAirWatchdog); session.deadAirWatchdog = null; }

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
          LiveCannedErrorRecovery.evaluateAndIntercept(session, clientSocket, session.currentAiTurnText || '', session.currentTurnAudioBytes);
        }
      }

      const outputTranscriptionText = parsed.serverContent?.outputTranscription?.text || parsed.serverContent?.output_transcription?.text;
      if (outputTranscriptionText) {
        session.currentAiTurnText = (session.currentAiTurnText || '') + outputTranscriptionText;
        LiveCannedErrorRecovery.evaluateAndIntercept(session, clientSocket, session.currentAiTurnText || '', session.currentTurnAudioBytes);
        if (session.deadAirWatchdog) { clearTimeout(session.deadAirWatchdog); session.deadAirWatchdog = null; }
      }

      // 3. Tool Call Cancellation
      if (parsed.toolCallCancellation?.ids) {
        LiveToolEngine.handleCancellation(session, parsed.toolCallCancellation.ids);
      }

      // 4. Tool Calls Execution
      if (parsed.toolCall?.functionCalls && geminiSocket) {
        isToolCallProcessed = true;
        await LiveToolEngine.executeFunctionCalls({
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
          if (session.watchdogs) session.watchdogs.disarmAll();
          session.fsm?.transition('CANDIDATE_LISTENING');

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

          if ((session.isCannedErrorTurn || (isZeroAudioTurn && allowSilenceClarification)) && geminiSocket) {
            if (isZeroAudioTurn && !session.cannedErrorType) {
              session.cannedErrorType = session.hasCandidateResponded ? 'non_speech' : 'turn0_empty';
            }
            LiveCannedErrorRecovery.executeRecoveryNudge(session, geminiSocket);
            return;
          }

          LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, liveModel);
        }
      }

      // SOTA Late 2026 Protocol Normalization: guarantee turnComplete is present downstream
      if (parsed?.serverContent?.generationComplete && !parsed.serverContent?.turnComplete) {
        parsed.serverContent.turnComplete = true;
        str = JSON.stringify(parsed);
      }

      const shouldForwardToClient = (!isToolCallProcessed || Boolean(parsed?.serverContent)) && !session.isCannedErrorTurn;
      if (shouldForwardToClient && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    }
  });

  return {
    connectGemini: (isInternalReconnect = false) => {
      pipe.connect(isInternalReconnect);
    },
    close: (code?: number, reason?: string) => {
      pipe.close(code, reason);
    }
  };
}
