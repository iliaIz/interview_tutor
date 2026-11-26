/**
 * UpstreamMessagePipeline.ts
 * Inbound Gemini Live message processing, dead-air clamping, canned-error recovery,
 * telemetry accumulation, and tool dispatch behind UpstreamTransportPort.
 */

import { WebSocket } from 'ws';
import { ProxySession, UpstreamTransportPort } from './liveSessionTypes';
import { handleSetupCompleteGreeting } from './LiveGreetingReplay';
import { LiveTelemetryAccumulator } from './LiveTelemetryAccumulator';
import { LiveToolEngine } from './LiveToolEngine';
import { isNonSpeechUtterance } from './liveStreamErrorDetector';
import { LiveCannedErrorRecovery } from './LiveCannedErrorRecovery';
import { envConfig } from '../../config/env';
import { DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';

export interface UpstreamChannelOptions {
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

export interface PipelineHostCallbacks {
  resetReconnectAttempts: () => void;
  flushFrameQueue: () => void;
  onGoAway: (goAway: any) => void;
}

export class UpstreamMessagePipeline {
  private readonly liveModel: string;

  constructor(
    private readonly options: UpstreamChannelOptions,
    private readonly upstream: UpstreamTransportPort,
    private readonly host: PipelineHostCallbacks
  ) {
    this.liveModel = options.liveModel || options.session.liveModel || envConfig.models.live;
  }

  public handleReconnecting(attempt: number, maxAttempts: number): void {
    const { session, clientSocket } = this.options;
    session.isUpstreamReconnecting = true;
    session.isSetupComplete = false;
    session.reconnectAttempts = attempt;
    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        clientSocket.send(JSON.stringify({ type: 'upstream_reconnecting', attempt, maxAttempts, mode: 'reconnect' }));
      } catch {}
    }
  }

  public handleDisconnect(source: string, code?: number, reason?: Buffer, isNonRetryable?: boolean): void {
    const { session, clientSocket, terminate } = this.options;
    if (session.isTerminated) return;
    session.isAiGenerating = false;
    session.awaitingToolSpeech = false;
    const reasonStr = reason ? reason.toString() : '';

    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        clientSocket.send(JSON.stringify(
          isNonRetryable
            ? {
                type: 'upstream_error',
                error: reasonStr || 'Голосовой шлюз отклонил подключение модели.',
                errorCode: session.terminalErrorCode || 'FORBIDDEN_MODEL_ACCESS',
                retryable: false,
                suggestedFallbackModel: envConfig.models.livePreview || envConfig.models.live
              }
            : {
                type: 'upstream_error',
                error: 'Голосовой шлюз временно недоступен после повторных попыток переподключения.',
                errorCode: 'RECONNECT_ATTEMPTS_EXHAUSTED',
                retryable: false
              }
        ));
      } catch {}
    }
    terminate(source, code, reason);
  }

  public async handleMessage(parsed: any, rawStr: string): Promise<void> {
    const { session, clientSocket, parsedHints = [], liveCoaching = false } = this.options;
    if (session.isTerminated || !parsed) return;
    let str = rawStr;
    let isToolCallProcessed = false;

    if (parsed.error) {
      const errString = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
      console.error(`❌ Upstream Gemini Live emitted error frame: ${errString}`);
    }

    if (parsed.setupComplete && this.upstream.isUpstreamOpen()) {
      session.isSetupComplete = true;
      const wasReconnecting = session.isUpstreamReconnecting;
      session.isUpstreamReconnecting = false;
      this.host.resetReconnectAttempts();
      session.reconnectAttempts = 0;

      handleSetupCompleteGreeting({
        session,
        upstream: this.upstream,
        clientSocket,
        sessionType: this.options.sessionType || session.sessionType || 'interview',
        tutorMode: this.options.tutorMode || 'socratic_tutoring',
        bugTitle: this.options.bugTitle || (session as any).bugTitle || '',
        questionText: this.options.questionText || session.questionText || '',
        topic: this.options.topic || session.topic || 'Java',
        isResumed: Boolean(this.options.isResumed),
        wasReconnecting: Boolean(wasReconnecting),
        initialUserMessage: this.options.initialUserMessage || '',
        questionIndex: session.questionIndex !== undefined ? session.questionIndex : (this.options.questionIndex ?? 0),
        totalQuestions: session.totalQuestions !== undefined ? session.totalQuestions : (this.options.totalQuestions ?? 0),
        challengeCategory: this.options.challengeCategory || (session as any).challengeCategory || '',
        challengeTrack: this.options.challengeTrack || (session as any).challengeTrack || ''
      });

      if (!this.options.isResumed && !wasReconnecting) session.frameQueue = [];
      else this.host.flushFrameQueue();
    }

    if (parsed.goAway) {
      this.host.onGoAway(parsed.goAway);
      return;
    }

    if (parsed.sessionResumptionUpdate && session.resumptionManager?.update(parsed.sessionResumptionUpdate)) {
      session.resumptionHandle = session.resumptionManager.getLatestHandle() || undefined;
      console.log(`🔑 [SESSION_RESUMPTION] Rotated active cryptographic handle (session: ${session.sessionId || 'anon'})`);
    }

    const vaSignal = parsed.serverContent?.voiceActivity;
    if (vaSignal === 'ACTIVITY_START') session.streamSentinel?.observeUpstreamSignal('activity_start');
    else if (vaSignal === 'ACTIVITY_END') session.streamSentinel?.observeUpstreamSignal('activity_end');
    if (parsed.serverContent?.inputTranscription || parsed.serverContent?.input_transcription) {
      session.streamSentinel?.observeUpstreamSignal('input_transcription');
    }

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
        LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, this.liveModel);
        return;
      }
      if (inspection.suppressFrame) isDeadAirSuppressed = true;
    }

    this.processModelOutput(parsed);

    if (parsed.toolCallCancellation?.ids) {
      LiveToolEngine.handleCancellation(session, parsed.toolCallCancellation.ids);
    }

    if (parsed.toolCall?.functionCalls && this.upstream.isUpstreamOpen()) {
      isToolCallProcessed = true;
      await LiveToolEngine.executeFunctionCalls({
        functionCalls: parsed.toolCall.functionCalls,
        clientSocket,
        upstream: this.upstream,
        session,
        parsedHints,
        liveCoaching
      });
      if (session.awaitingToolSpeech) session.streamSentinel?.observeUpstreamSignal('tool_call_when_idle');
    }

    if (parsed.serverContent?.interrupted) {
      session.awaitingToolSpeech = false;
      session.streamSentinel?.observeUpstreamSignal('interrupted');
      LiveTelemetryAccumulator.handleBargeIn(session);
    }

    if (this.processTurnCompletion(parsed, isToolCallProcessed)) return;

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

    const shouldForward = (!isToolCallProcessed || Boolean(parsed?.serverContent)) && !session.isCannedErrorTurn && !isDeadAirSuppressed;
    if (shouldForward && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(str);
    }
  }

  private processModelOutput(parsed: any): void {
    const { session, clientSocket } = this.options;
    if (parsed.serverContent?.modelTurn) {
      session.isAiGenerating = true;
      session.awaitingToolSpeech = false;
      session.isToolCallPending = false;
      const hasAudioPart = Boolean(parsed.serverContent.modelTurn.parts?.some((p: any) => p.inlineData || p.inline_data));
      session.streamSentinel?.observeUpstreamSignal(hasAudioPart ? 'model_audio_chunk' : 'model_text_or_thought');
      if (session.toolCallSafetyTimeout) { clearTimeout(session.toolCallSafetyTimeout); session.toolCallSafetyTimeout = null; }
      const commitAnchor = session.currentTurnMetrics?.candidateSpeechEndedAt || session.lastTurnCommitTime || session.lastToolCallTime || session.lastActivityAt || Date.now();
      session.lastActivityAt = Date.now();
      session.probesCount = (session.probesCount || 0) + 1;
      session.watchdogs?.heartbeat();
      session.fsm?.transition('AI_SPEAKING');
      if (!session.currentTurnMetrics) {
        session.currentTurnMetrics = {
          turnIndex: session.currentTurnIndex || 0, candidateSpeechStartedAt: commitAnchor,
          candidateSpeechEndedAt: commitAnchor, vadPauseSettingMs: session.vadPauseMs || DEFAULT_VAD_PAUSE_MS,
          speechDurationMs: 0, audioBytesReceived: 0, textChars: 0, droppedEchoChunksCount: 0,
          wasBargeIn: false, bargeInType: null, lastRttMs: session.lastRttMs ?? null
        };
      }
      if (parsed.serverContent.modelTurn.parts) {
        LiveTelemetryAccumulator.processModelTurnParts(session, parsed.serverContent.modelTurn.parts, commitAnchor);
        LiveCannedErrorRecovery.evaluateAndIntercept(session, clientSocket, session.currentAiTurnText || '', session.currentTurnAudioBytes);
      }
    }

    const outputText = parsed.serverContent?.outputTranscription?.text || parsed.serverContent?.output_transcription?.text;
    if (outputText) {
      session.currentAiTurnText = (session.currentAiTurnText || '') + outputText;
      LiveCannedErrorRecovery.evaluateAndIntercept(session, clientSocket, session.currentAiTurnText || '', session.currentTurnAudioBytes);
      session.watchdogs?.heartbeat();
    }
  }

  private processTurnCompletion(parsed: any, isToolCallProcessed: boolean): boolean {
    const { session, clientSocket } = this.options;
    const isUpstreamTurnComplete = Boolean(parsed.serverContent?.turnComplete || parsed.serverContent?.generationComplete);
    if (!isUpstreamTurnComplete) return false;
    session.deadAirGuard?.reset();
    const isInteractionIdle = !parsed.serverContent.interactionStatus || parsed.serverContent.interactionStatus === 'IDLE';
    if (!isInteractionIdle) return false;

    if (session.awaitingToolSpeech) {
      session.watchdogs?.arm(false, 8000);
      session.fsm?.transition('AI_THINKING');
      session.streamSentinel?.observeUpstreamSignal('tool_call_when_idle');
    } else {
      session.watchdogs?.disarmAll();
      session.fsm?.transition('CANDIDATE_LISTENING');
      session.streamSentinel?.observeUpstreamSignal('turn_complete');
    }

    if (!session.isAiGenerating && (session.currentTurnAudioBytes || 0) === 0 && (session.aiPlayoutEstimatedEndEpoch || 0) > Date.now()) {
      return true;
    }

    const isToolCallTurn = Boolean(
      isToolCallProcessed || parsed.toolCall || session.isToolCallPending ||
      (session.lastToolCallTime && (Date.now() - session.lastToolCallTime < 4000))
    );
    const audioBytes = session.currentTurnAudioBytes || 0;
    const text = (session.currentAiTurnText || '').trim();
    const isZeroAudioTurn = !isToolCallTurn && audioBytes < 200 && (text.length < 5 || isNonSpeechUtterance(text, audioBytes));

    if ((session.isCannedErrorTurn || (isZeroAudioTurn && Boolean(session.enableSilenceClarification))) && this.upstream.isUpstreamOpen()) {
      if (isZeroAudioTurn && !session.cannedErrorType) {
        session.cannedErrorType = session.hasCandidateResponded ? 'non_speech' : 'turn0_empty';
      }
      LiveCannedErrorRecovery.executeRecoveryNudge(session, this.upstream);
      return true;
    }

    LiveTelemetryAccumulator.sealTurnComplete(session, clientSocket, this.liveModel);
    return false;
  }
}
