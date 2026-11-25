/**
 * liveAudioStreamRouter.ts
 * Headless Live Audio Stream Router (SOTA Late 2026).
 * Coordinates UpstreamGeminiPipe, LiveGreetingReplay, LiveTelemetryAccumulator, and LiveToolEngine.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { handleSetupCompleteGreeting, dispatchReconnectContextReplay } from './LiveGreetingReplay';
import { LiveTelemetryAccumulator } from './LiveTelemetryAccumulator';
import { LiveToolEngine } from './LiveToolEngine';
import { isNonSpeechUtterance } from './liveStreamErrorDetector';
import { LiveCannedErrorRecovery } from './LiveCannedErrorRecovery';
import { UpstreamGeminiPipe } from './UpstreamGeminiPipe';
import { LiveDeadAirGuard } from './LiveDeadAirGuard';
import { LiveSessionBlueprintBuilder } from './LiveSessionBlueprintBuilder';
import { LiveHotHandoffCoordinator } from './LiveHotHandoffCoordinator';
import { envConfig } from '../../config/env';
import { DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';

export interface StreamRouterOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  terminate: (source: string, code?: number, reason?: Buffer) => void;
  setupMessage?: any;
  upstreamWsUrl?: string;
  sessionId?: string;
  questionId?: string;
  sessionType?: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor';
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
    liveModel = session.liveModel || envConfig.models.live,
    challengeCategory = (session as any).challengeCategory || '',
    challengeTrack = (session as any).challengeTrack || ''
  } = options;

  let pipe: UpstreamGeminiPipe;
  let handoff: LiveHotHandoffCoordinator;

  const flushPendingFrames = (targetSocket: WebSocket) => {
    while (session.frameQueue.length > 0) {
      const frame = session.frameQueue.shift();
      if (frame && targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(frame);
      }
    }
  };

  pipe = new UpstreamGeminiPipe({
    upstreamWsUrl,
    setupMessage,
    getSetupMessage: () => LiveSessionBlueprintBuilder.buildDynamicSetupMessage(setupMessage, session.resumptionHandle),
    liveModel,
    maxReconnectAttempts: 3,
    onResumptionRejectedBeforeSetup: () => {
      session.resumptionHandle = undefined;
      session.resumptionManager?.clear();
    },
    onOpen: (ws) => {
      session.geminiSocket = ws;
    },
    onReconnecting: (attempt, maxAttempts) => {
      session.isUpstreamReconnecting = true;
      session.isSetupComplete = false;
      session.reconnectAttempts = attempt;
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({ type: 'upstream_reconnecting', attempt, maxAttempts, mode: 'reconnect' }));
        } catch {}
      }
    },
    onDisconnect: (source, code, reason, isNonRetryable) => {
      if (session.isTerminated) return;
      session.isAiGenerating = false;
      session.awaitingToolSpeech = false;
      const reasonStr = reason ? reason.toString() : '';

      if (isNonRetryable) {
        console.error(`🛑 Upstream Gemini Live non-retryable error [${source}, code=${code}]. Halting.`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          try {
            clientSocket.send(JSON.stringify({
              type: 'upstream_error',
              error: reasonStr || 'Голосовой шлюз отклонил подключение модели.',
              errorCode: session.terminalErrorCode || 'FORBIDDEN_MODEL_ACCESS',
              retryable: false,
              suggestedFallbackModel: envConfig.models.livePreview || envConfig.models.live
            }));
          } catch {}
        }
      } else if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({
            type: 'upstream_error',
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
          flushPendingFrames(geminiSocket);
        }
      }

      // 1.4 Proactive GoAway Hot Handoff (Spec 42 / #156)
      if (parsed.goAway) {
        handoff.handleGoAway(parsed.goAway);
        return;
      }

      // 1.5 Session Resumption Handle Tracking (SOTA Late 2026)
      if (parsed.sessionResumptionUpdate) {
        if (session.resumptionManager?.update(parsed.sessionResumptionUpdate)) {
          session.resumptionHandle = session.resumptionManager.getLatestHandle() || undefined;
          console.log(`🔑 [SESSION_RESUMPTION] Rotated active cryptographic handle (session: ${session.sessionId || 'anon'})`);
        }
      }

      // 1.55 Passive Auto-VAD Upstream Activity & Input Transcript Signals
      const vaSignal = parsed.serverContent?.voiceActivity;
      if (vaSignal === 'ACTIVITY_START') session.streamSentinel?.observeUpstreamSignal('activity_start');
      else if (vaSignal === 'ACTIVITY_END') session.streamSentinel?.observeUpstreamSignal('activity_end');
      if (parsed.serverContent?.inputTranscription || parsed.serverContent?.input_transcription) {
        session.streamSentinel?.observeUpstreamSignal('input_transcription');
      }

      // 1.6 LiveDeadAirGuard Vocoder Stall & Digital Silence Clamping (SOTA Late 2026)
      let isDeadAirSuppressed = false;
      if (session.deadAirGuard && parsed.serverContent) {
        const inspection = session.deadAirGuard.inspectServerContent(parsed.serverContent);
        if (inspection.synthesizeTurnComplete) {
          console.warn('🛑 [DEAD_AIR_GUARD] Clamped vocoder trailing silence (>=2000ms). Synthesizing turnComplete.');
          session.watchdogs?.disarmAll();
          session.fsm?.transition('CANDIDATE_LISTENING');
          session.isAiGenerating = false;
          session.deadAirGuard.reset();
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ serverContent: { turnComplete: true, deadAirClamped: true } }));
          }
          LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, liveModel);
          return;
        }
        if (inspection.suppressFrame) {
          isDeadAirSuppressed = true;
        }
      }

      // 2. Model Turn & Output Transcription
      if (parsed.serverContent?.modelTurn) {
        session.isAiGenerating = true;
        session.awaitingToolSpeech = false;
        session.isToolCallPending = false;
        const hasAudioPart = Boolean(parsed.serverContent.modelTurn.parts?.some((p: any) => p.inlineData || p.inline_data));
        session.streamSentinel?.observeUpstreamSignal(hasAudioPart ? 'model_audio_chunk' : 'model_text_or_thought');
        if (session.toolCallSafetyTimeout) {
          clearTimeout(session.toolCallSafetyTimeout);
          session.toolCallSafetyTimeout = null;
        }
        const commitAnchor = session.currentTurnMetrics?.candidateSpeechEndedAt || session.lastTurnCommitTime || session.lastToolCallTime || session.lastActivityAt || Date.now();
        session.lastActivityAt = Date.now();
        session.probesCount = (session.probesCount || 0) + 1;
        if (session.watchdogs) session.watchdogs.heartbeat();
        session.fsm?.transition('AI_SPEAKING');
        if (!session.currentTurnMetrics) {
          session.currentTurnMetrics = {
            turnIndex: session.currentTurnIndex || 0,
            candidateSpeechStartedAt: commitAnchor,
            candidateSpeechEndedAt: commitAnchor,
            vadPauseSettingMs: session.vadPauseMs || DEFAULT_VAD_PAUSE_MS,
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
        session.watchdogs?.heartbeat();
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
        if (session.awaitingToolSpeech) {
          session.streamSentinel?.observeUpstreamSignal('tool_call_when_idle');
        }
      }

      // 5. Barge-In Interruption
      if (parsed.serverContent?.interrupted) {
        session.awaitingToolSpeech = false;
        session.streamSentinel?.observeUpstreamSignal('interrupted');
        LiveTelemetryAccumulator.handleBargeIn(session);
      }

      // 6. Turn Complete / Generation Complete (SOTA Equivalence)
      const isUpstreamTurnComplete = Boolean(parsed.serverContent?.turnComplete || parsed.serverContent?.generationComplete);
      if (isUpstreamTurnComplete) {
        session.deadAirGuard?.reset();
        const isInteractionIdle = !parsed.serverContent.interactionStatus || parsed.serverContent.interactionStatus === 'IDLE';
        if (isInteractionIdle) {
          if (session.awaitingToolSpeech) {
            if (session.watchdogs) session.watchdogs.arm(false, 8000);
            session.fsm?.transition('AI_THINKING');
            session.streamSentinel?.observeUpstreamSignal('tool_call_when_idle');
          } else {
            if (session.watchdogs) session.watchdogs.disarmAll();
            session.fsm?.transition('CANDIDATE_LISTENING');
            session.streamSentinel?.observeUpstreamSignal('turn_complete');
          }

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

      // SOTA Late 2026 Protocol Normalization: guarantee turnComplete without leaking raw toolCall after completion
      if (parsed?.serverContent?.generationComplete && !parsed.serverContent?.turnComplete) {
        parsed.serverContent.turnComplete = true;
      }
      if (isToolCallProcessed && parsed.toolCall) {
        const sanitized = { ...parsed };
        delete sanitized.toolCall;
        str = JSON.stringify(sanitized);
      } else if (parsed?.serverContent?.generationComplete) {
        str = JSON.stringify(parsed);
      }

      const shouldForwardToClient = (!isToolCallProcessed || Boolean(parsed?.serverContent)) && !session.isCannedErrorTurn && !isDeadAirSuppressed;
      if (shouldForwardToClient && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    }
  });

  handoff = new LiveHotHandoffCoordinator({
    session,
    clientSocket,
    pipe,
    buildSetupMessage: (handle) => LiveSessionBlueprintBuilder.buildDynamicSetupMessage(setupMessage, handle),
    sendContextReplay: (ws) => dispatchReconnectContextReplay(session, ws, { bugTitle, questionText, topic }),
    flushFrameQueue: flushPendingFrames
  });
  session.hotHandoffCoordinator = handoff;

  return {
    connectGemini: (isInternalReconnect = false) => {
      pipe.connect(isInternalReconnect);
    },
    reconnect: () => {
      session.isUpstreamReconnecting = true;
      session.isSetupComplete = false;
      pipe.connect(true);
    },
    close: (code?: number, reason?: string) => {
      handoff.dispose();
      pipe.close(code, reason);
    }
  };
}
