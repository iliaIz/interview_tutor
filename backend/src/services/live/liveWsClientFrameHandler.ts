import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { LiveClientGuardService } from './liveClientGuardService';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { handleTurnCommit } from './liveWsTurnCommitHandler';

export interface ClientFrameHandlerOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  turnMode: 'manual' | 'auto';
  terminate: (source: string, code?: number, reason?: Buffer) => void;
}

export function attachLiveClientFrameHandler(options: ClientFrameHandlerOptions): void {
  const { session, clientSocket, turnMode } = options;

  clientSocket.on('message', (data: RawData) => {
    session.lastActivityAt = Date.now();
    const buffer = toRawBuffer(data);
    let payloadBuffer = buffer;
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

      if (parsed.type === 'barge_in' || isBargeIn) {
        LiveClientGuardService.handleBargeIn(session, parsed.bargeInType || (parsed.type === 'barge_in' ? 'tactile' : 'acoustic'), parsed.epoch || Date.now());
        if (!parsed.realtimeInput && !parsed.realtime_input) {
          return;
        }
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
        const accepted = handleTurnCommit(session, parsed, isBargeIn, clientSocket, turnMode);
        if (!accepted) {
          return;
        }
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
      const isAudioChunk = Boolean(parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks);
      if (LiveClientGuardService.shouldSuppressEchoChunk(session, isAudioChunk, isBargeIn)) {
        return;
      }

      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(payloadBuffer);
      }
    }
  });
}
