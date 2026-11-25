/**
 * DownstreamClientPipe.ts
 * Unified downstream client WebSocket transport, heartbeat router, and speech coordinator.
 * Cognitive Bounding Limit: <= 300 lines (Rule 8 compliant).
 */

import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { LiveClientGuardService } from './liveClientGuardService';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { handleTurnCommit, armTurnWatchdogs } from './liveWsTurnCommitHandler';
import { LiveWorkspaceContext } from './LiveWorkspaceContext';
import { DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';
import { handleGuidedStepControlFrame } from './hrGuidedStepper';

export interface DownstreamClientPipeOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  turnMode: 'manual' | 'auto';
  terminate: (source: string, code?: number, reason?: Buffer) => void;
}

export class DownstreamClientPipe {
  private session: ProxySession;
  private clientSocket: WebSocket;
  private turnMode: 'manual' | 'auto';
  private terminate: (source: string, code?: number, reason?: Buffer) => void;

  constructor(options: DownstreamClientPipeOptions) {
    this.session = options.session;
    this.clientSocket = options.clientSocket;
    this.turnMode = options.turnMode;
    this.terminate = options.terminate;
  }

  public handleFrame(data: RawData): void {
    const { session, clientSocket, turnMode } = this;
    if (session.isTerminated) return;
    session.lastActivityAt = Date.now();
    const buffer = toRawBuffer(data);
    let payloadBuffer: Buffer | null = buffer;
    let parsed: any = null;
    let isBargeIn = false;

    try {
      const text = buffer.toString();
      parsed = JSON.parse(text);
      isBargeIn = Boolean(
        parsed.type === 'barge_in' ||
        parsed.bargeIn ||
        parsed.barge_in ||
        parsed.clientContent?.interrupted
      );

      if (this.handleControlFrames(parsed)) {
        return;
      }

      if (LiveWorkspaceContext.applyClientFrame(session, parsed)) {
        return;
      }

      if (this.handleMemoryAndSync(parsed)) {
        return;
      }

      if (parsed.type === 'barge_in' || isBargeIn) {
        LiveClientGuardService.handleBargeIn(session, parsed.bargeInType || (parsed.type === 'barge_in' ? 'tactile' : 'acoustic'), parsed.epoch || Date.now());
        session.watchdogs?.disarmAll();
        session.deadAirGuard?.reset();
        session.fsm?.transition('CANDIDATE_LISTENING');
        if (!parsed.realtimeInput && !parsed.realtime_input) {
          return;
        }
      }

      if (this.handleTurnResetAndHold(parsed)) {
        return;
      }

      if (this.handleCanvasDelta(parsed)) {
        return;
      }

      // Deictic and telemetry frames separation
      const DEICTIC_PREFIXES = ['📌 [КОНТЕКСТ ЭКРАНА', '🎯 [ФОКУС ВНИМАНИЯ', '📝 [АКТУАЛЬНЫЙ КОД', '💡 [ДЕЙСТВИЕ', '🔍 [ДЕЙСТВИЕ', '📂 [СМЕНА', '❌ [ОШИБКА', '❌ [ТЕСТЫ', '✅ [ВСЕ UNIT-ТЕСТЫ', '⚠️ [РЕЗУЛЬТАТЫ PITest', '🏆 [PITest', '🏆 [ТРАНЗАКЦИИ', '⚠️ [ДЕФЕКТЫ ТРАНЗАКЦИЙ', '[СИСТЕМНОЕ СОБЫТИЕ IDE]'];
      const isDeicticFrame = Boolean(
        parsed.deictic ||
        parsed.type === 'screen_context_sync' ||
        parsed.clientContent?.turns?.some((t: any) =>
          t.parts?.some((p: any) =>
            typeof p.text === 'string' && DEICTIC_PREFIXES.some((pre) => p.text.startsWith(pre))
          )
        )
      );

      if (isDeicticFrame) {
        return;
      }

      payloadBuffer = this.processClientContentAndAudio(parsed, isDeicticFrame, isBargeIn, buffer);
      if (!payloadBuffer) return;
    } catch {
      return;
    }

    this.routePayloadToUpstream(payloadBuffer, parsed, isBargeIn);
  }

  private handleControlFrames(parsed: any): boolean {
    const { session, clientSocket } = this;
    if (parsed.type === 'pong') {
      const sentTs = typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now();
      const rtt = Math.max(0, Date.now() - sentTs);
      session.lastRttMs = rtt;
      if (session.currentTurnMetrics) session.currentTurnMetrics.lastRttMs = rtt;
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'pong_ack', rtt, timestamp: Date.now() }));
      }
      return true;
    }

    if (parsed.type === 'ping') {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'pong', timestamp: parsed.timestamp || Date.now() }));
      }
      return true;
    }

    if (parsed.type === 'sync_ping') {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'sync_pong',
          isSetupComplete: session.isSetupComplete,
          isUpstreamReconnecting: session.isUpstreamReconnecting,
          isUpstreamConnected: Boolean(session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN),
          isHandoffActive: Boolean(session.hotHandoffCoordinator?.isHandoffActive()),
          isToolCallPending: session.isToolCallPending,
          timestamp: Date.now()
        }));
      }
      return true;
    }

    if (handleGuidedStepControlFrame(session, clientSocket, parsed)) {
      return true;
    }

    return false;
  }

  private handleMemoryAndSync(parsed: any): boolean {
    const { session } = this;
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
      }
      return true;
    }
    return false;
  }

  private handleTurnResetAndHold(parsed: any): boolean {
    const { session } = this;
    if (parsed.type === 'turn_reset') {
      session.isAiGenerating = false;
      session.awaitingToolSpeech = false;
      session.watchdogs?.disarmAll();
      session.deadAirGuard?.reset();
      session.streamSentinel?.resetTurnState();
      session.fsm?.transition('CANDIDATE_LISTENING');
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
      return true;
    }

    if (parsed.type === 'session_hold') {
      session.isOnHold = Boolean(parsed.paused);
      session.lastActivityAt = Date.now();
      return true;
    }

    return false;
  }

  private handleCanvasDelta(parsed: any): boolean {
    const { session } = this;
    if (parsed.type !== 'canvas_delta') return false;

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
            ? `Фокус кандидата на компоненте: ${parsed.payload.focusedElement.label || parsed.payload.focusedElement.id}`
            : 'Кандидат внёс изменения в архитектурный граф на холсте');
      }

      session.geminiSocket.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: `[CANVAS_DEICTIC_CONTEXT (ЯЗЫК: РУССКИЙ): ${deicticContent}]` }] }],
          turnComplete: false
        }
      }));
    }
    return true;
  }

  private processClientContentAndAudio(parsed: any, isDeicticFrame: boolean, isBargeIn: boolean, originalBuffer: Buffer): Buffer | null {
    const { session, clientSocket, turnMode } = this;

    if (parsed.clientContent?.turns) {
      session.isToolCallPending = false;
      if (session.toolCallSafetyTimeout) {
        clearTimeout(session.toolCallSafetyTimeout);
        session.toolCallSafetyTimeout = null;
      }
      if (session.sessionId) {
        for (const turn of parsed.clientContent.turns) {
          if (turn.parts) {
            const turnText = turn.parts.map((p: any) => p.text || '').join('').trim();
            if (turnText && !turnText.startsWith('[ВОЗОБНОВЛЕНИЕ') && !turnText.startsWith('📌')) {
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

    if (parsed.setup) return null;

    if ((!isDeicticFrame && (parsed.clientContent?.turns || parsed.clientContent?.turnComplete)) ||
        parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
      session.hasCandidateResponded = true;
    }

    if (!isDeicticFrame && parsed.clientContent?.turnComplete) {
      const accepted = handleTurnCommit(session, parsed, isBargeIn, clientSocket, turnMode);
      if (!accepted) return null;
    }

    if (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
      if (session.toolAudioMutex?.shouldGateMicAudio()) {
        return null;
      }
      session.deadAirGuard?.reset();
      session.audioChunksCount = (session.audioChunksCount || 0) + 1;
      if (session.audioChunksCount === 1) {
        session.fsm?.transition('CANDIDATE_SPEAKING');
        session.currentTurnIndex = (session.currentTurnIndex || 0) + 1;
        session.currentTurnMetrics = {
          turnIndex: session.currentTurnIndex,
          candidateSpeechStartedAt: Date.now(),
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
      const audioData = parsed.realtime_input?.audio?.data || parsed.realtimeInput?.audio?.data || parsed.realtimeInput?.mediaChunks?.[0]?.data;
      const mimeType = parsed.realtime_input?.audio?.mimeType || parsed.realtimeInput?.audio?.mimeType || 'audio/pcm;rate=16000';
      if (audioData) {
        session.streamSentinel?.observeClientAudio(audioData, session.vadPauseMs || DEFAULT_VAD_PAUSE_MS, turnMode);
        return Buffer.from(JSON.stringify({ realtimeInput: { audio: { mimeType, data: audioData } } }));
      }
    } else if (parsed.realtimeInput?.audioStreamEnd || parsed.realtime_input?.audio_stream_end) {
      session.deadAirGuard?.reset();
      session.hasCandidateResponded = true;
      return Buffer.from(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    } else if (parsed.clientContent) {
      return Buffer.from(JSON.stringify({ clientContent: parsed.clientContent }));
    }

    return originalBuffer;
  }

  private routePayloadToUpstream(payloadBuffer: Buffer, parsed: any, isBargeIn: boolean): void {
    const { session, turnMode } = this;
    if (!session.isSetupComplete || session.isUpstreamReconnecting) {
      const MAX_FRAME_QUEUE = 200;
      if (session.frameQueue.length >= MAX_FRAME_QUEUE) {
        session.frameQueue.shift();
      }
      session.frameQueue.push(payloadBuffer);
    } else {
      const isAudioChunk = Boolean(parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks);
      if (LiveClientGuardService.shouldSuppressEchoChunk(session, isAudioChunk, isBargeIn, turnMode)) {
        return;
      }

      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(payloadBuffer);
      }
    }
  }
}
