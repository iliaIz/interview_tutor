import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { getOrCreateSessionMemory } from './liveSessionRegistry';
import { isLanguageDrifted } from '../../prompts/core/languageDirectives';
import { TurnTelemetryEvent } from '@interview-prep/shared';
import { DEFAULT_VAD_PAUSE_MS } from '../../config/liveDefaults';

/**
 * LiveTelemetryAccumulator (SOTA Late 2026).
 * Handles milestone tracking (TTFR, TTFT, TTFA), playout estimation (+450ms reverb),
 * and TurnTelemetryEvent emission.
 * Cognitive bounding limit: <= 350 lines.
 */
export class LiveTelemetryAccumulator {
  public static processModelTurnParts(
    session: ProxySession,
    parts: any[],
    commitAnchor: number
  ): void {
    if (!session.currentTurnMetrics) return;

    for (const part of parts) {
      // 1. Extended Thinking CoT milestone (TTFR)
      if ((part.thought || part.isThought) && !session.currentTurnMetrics.firstThoughtAt) {
        session.currentTurnMetrics.firstThoughtAt = Date.now();
        const ttfr = Date.now() - commitAnchor;
        console.log(`🧠 [MODEL_FIRST_THOUGHT] Upstream Gemini emitted reasoning token (TTFR: ~${ttfr}ms, session: ${session.sessionId || 'anon'})`);
      }

      // 2. First response text token milestone (TTFT)
      if (part.text && !part.thought && !part.isThought) {
        session.currentAiTurnText = (session.currentAiTurnText || '') + part.text;
        if (!session.currentTurnMetrics.firstTextAt) {
          session.currentTurnMetrics.firstTextAt = Date.now();
          const ttft = Date.now() - commitAnchor;
          console.log(`📝 [MODEL_FIRST_TEXT] Upstream Gemini emitted first text token (TTFT: ~${ttft}ms, session: ${session.sessionId || 'anon'})`);
        }
      }

      // 3. Track PCM audio chunk bytes
      const pcmData = part.inlineData?.data || part.inline_data?.data;
      if (pcmData) {
        const approxBytes = Math.floor(pcmData.length * 0.75);
        session.currentTurnMetrics.audioBytesReceived += approxBytes;
        session.currentTurnAudioBytes = (session.currentTurnAudioBytes || 0) + approxBytes;
      }
    }

    // 4. First PCM audio milestone (TTFA)
    const hasPcm = parts.some((p: any) => p.inlineData || p.inline_data);
    if (hasPcm && !session.firstAudioChunkLogged) {
      session.firstAudioChunkLogged = true;
      session.firstAudioChunkTime = Date.now();
      if (!session.currentTurnMetrics.firstAudioAt) {
        session.currentTurnMetrics.firstAudioAt = Date.now();
      }
      const ttfa = Date.now() - commitAnchor;
      console.log(`🔊 [MODEL_FIRST_AUDIO] Upstream Gemini emitted first audio chunk (TTFA: ~${ttfa}ms, session: ${session.sessionId || 'anon'})`);
    }
  }

  public static sealTurnComplete(
    session: ProxySession,
    clientSocket: WebSocket,
    liveModel: string
  ): void {
    // SOTA Late 2026: Deduplicate terminal frame invocations
    // If turn has already concluded and current audio bytes are 0, ignore duplicate turnComplete/generationComplete
    if (!session.isAiGenerating && (session.currentTurnAudioBytes || 0) === 0 && (session.aiPlayoutEstimatedEndEpoch || 0) > Date.now()) {
      return;
    }

    console.log(`🏁 [MODEL_TURN_COMPLETE] Upstream Gemini terminal turn generation complete (session: ${session.sessionId || 'anon'})`);
    session.isAiGenerating = false;
    session.firstAudioChunkLogged = false;
    session.isToolCallPending = false;

    // Calculate physical playout drain epoch (+450ms reverb cooldown)
    const audioBytes = session.currentTurnAudioBytes || 0;
    const totalDurationMs = Math.round((audioBytes / 48000) * 1000);
    const streamingElapsedMs = session.firstAudioChunkTime ? (Date.now() - session.firstAudioChunkTime) : 0;
    const remainingDurationMs = Math.max(0, totalDurationMs - streamingElapsedMs);
    session.aiPlayoutEstimatedEndEpoch = Date.now() + remainingDurationMs + 450;
    session.currentTurnAudioBytes = 0;
    session.firstAudioChunkTime = undefined;
    session.audioChunksCount = 0;
    console.log(`🔊 [PHYSICAL_PLAYOUT_ESTIMATE] Audio total: ${totalDurationMs}ms, remaining playout: ${remainingDurationMs}ms (bytes: ${audioBytes}). Gated until +450ms reverb.`);

    if (session.watchdogs) {
      session.watchdogs.disarmAll();
    }
    session.fsm?.transition('CANDIDATE_LISTENING');
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    if (session.deadAirWatchdog) {
      clearTimeout(session.deadAirWatchdog);
      session.deadAirWatchdog = null;
    }

    // Seal Canonical Turn Telemetry Event
    const commitTime =
      session.lastTurnCommitTime ||
      session.currentTurnMetrics?.candidateSpeechEndedAt ||
      session.currentTurnMetrics?.candidateSpeechStartedAt ||
      session.lastToolCallTime ||
      session.sessionStartedAt ||
      session.lastActivityAt ||
      Date.now();
    const metrics = session.currentTurnMetrics;
    const ttfrMs = metrics?.firstThoughtAt ? Math.max(0, metrics.firstThoughtAt - commitTime) : null;
    const ttftMs = metrics?.firstTextAt ? Math.max(0, metrics.firstTextAt - commitTime) : null;
    const ttfaMs = metrics?.firstAudioAt ? Math.max(0, metrics.firstAudioAt - commitTime) : null;
    const audioDurationMs = metrics ? Math.round((metrics.audioBytesReceived / 48000) * 1000) : 0;
    const textChars = (session.currentAiTurnText || '').length;
    const echoLeakageDroppedMs = (metrics?.droppedEchoChunksCount || 0) * 40;

    const turnEvent: TurnTelemetryEvent = {
      turnId: `turn_${session.sessionId || 'anon'}_${metrics?.turnIndex || 0}_${Date.now()}`,
      sessionId: session.sessionId || 'anon',
      turnIndex: metrics?.turnIndex || 0,
      speaker: 'model',
      vadPauseSettingMs: session.vadPauseMs || DEFAULT_VAD_PAUSE_MS,
      speechDurationMs: metrics?.speechDurationMs || 0,
      ttfrMs,
      ttftMs,
      ttfaMs,
      ttfpMs: null,
      audioTextSkewMs: null,
      audioDurationMs,
      textChars,
      echoLeakageDroppedMs,
      networkRttMs: metrics?.lastRttMs ?? session.lastRttMs ?? null,
      modelName: liveModel,
      wasBargeIn: metrics?.wasBargeIn || false,
      bargeInType: metrics?.bargeInType || null,
      createdAt: Date.now()
    };

    if (!session.turnTelemetryHistory) session.turnTelemetryHistory = [];
    session.turnTelemetryHistory.push(turnEvent);

    if (clientSocket.readyState === WebSocket.OPEN) {
      try {
        clientSocket.send(JSON.stringify({
          type: 'turn_telemetry',
          data: turnEvent
        }));
      } catch {}
    }

    // SOTA Multi-Turn Isolation: Cleanly reset current turn state
    session.currentTurnMetrics = null;
    session.lastTurnCommitTime = undefined;

    if (session.currentAiTurnText && session.sessionId) {
      const textToSave = session.currentAiTurnText.trim();
      if (!isLanguageDrifted(textToSave)) {
        const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
        mem.turns.push({ role: 'model', text: textToSave });
        mem.lastSpeaker = 'model';
        mem.updatedAt = Date.now();
      } else {
        console.warn(`🚨 [LANGUAGE_CONTAMINATION_GUARD] Model turn drifted to English. Stripped from session replay memory (${session.sessionId}).`);
      }
      session.currentAiTurnText = '';
    }
  }

  public static handleBargeIn(session: ProxySession): void {
    session.isAiGenerating = false;
    session.aiPlayoutEstimatedEndEpoch = 0;
    session.currentTurnAudioBytes = 0;
    session.firstAudioChunkTime = undefined;
    session.audioChunksCount = 0;
    session.isToolCallPending = false;
    session.watchdogs?.disarmAll();
    if (session.deadAirWatchdog) {
      clearTimeout(session.deadAirWatchdog);
      session.deadAirWatchdog = null;
    }
    if (session.currentTurnMetrics) {
      session.currentTurnMetrics.wasBargeIn = true;
      if (!session.currentTurnMetrics.bargeInType) {
        session.currentTurnMetrics.bargeInType = 'acoustic';
      }
    }
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }
    if (session.sessionId) {
      const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
      if (session.currentAiTurnText) {
        const textToSave = session.currentAiTurnText.trim();
        if (!isLanguageDrifted(textToSave)) {
          mem.turns.push({ role: 'model', text: textToSave });
        } else {
          console.warn(`🚨 [LANGUAGE_CONTAMINATION_GUARD] Interrupted English model turn stripped from replay memory (${session.sessionId}).`);
        }
        session.currentAiTurnText = '';
      }
      mem.lastSpeaker = 'user';
      mem.updatedAt = Date.now();
    }
  }
}
