/**
 * liveClientGuardService.ts
 * SOTA Late 2026 Guard Service for WebSocket Live Streaming.
 * Encapsulates Zero-Chunk Guard, Flood Guard, Stale Guard, Echo Guard, and Barge-In Handlers.
 */

import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';

export class LiveClientGuardService {
  /**
   * Applies tactile or acoustic barge-in interruption state transition.
   */
  public static handleBargeIn(session: ProxySession, type: 'tactile' | 'acoustic' = 'tactile', epoch: number = Date.now()): void {
    session.isAiGenerating = false;
    session.aiPlayoutEstimatedEndEpoch = 0;
    session.currentTurnAudioBytes = 0;
    session.audioChunksCount = 0;
    session.lastTurnCommitTime = 0;
    session.currentAiTurnText = '';
    session.lastBargeInEpoch = epoch;

    session.watchdogs?.disarmAll();
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
      session.currentTurnMetrics.bargeInType = type;
      session.currentTurnMetrics.droppedEchoChunksCount = 0;
    }

    console.log(`🛑 [BARGE_IN] Handled ${type} barge-in (epoch ${epoch}) for session ${session.sessionId || 'anon'}`);


    if (session.clientSocket && session.clientSocket.readyState === WebSocket.OPEN) {
      session.clientSocket.send(JSON.stringify({
        serverContent: { interrupted: true }
      }));
    }
  }

  /**
   * Evaluates if an incoming turnComplete frame must be suppressed by pipeline guards.
   * Returns { shouldDrop: true, guardName } or { shouldDrop: false }
   */
  public static evaluateTurnCompleteGuard(
    session: ProxySession,
    hasTextTurns: boolean,
    isBargeIn: boolean
  ): { shouldDrop: boolean; guardName?: string } {
    if (isBargeIn) {
      return { shouldDrop: false };
    }

    const chunksCount = session.audioChunksCount || 0;

    // 1. Zero-Chunk Guard: Bare turnComplete without candidate audio or text is an illegal transition
    if (chunksCount === 0 && !hasTextTurns) {
      console.warn(`🛡️ [ZERO_CHUNK_GUARD] Dropped empty turnComplete frame (0 audio chunks, 0 text turns, sessionId: ${session.sessionId || 'anon'}). Preventing hallucinated echo loop.`);
      return { shouldDrop: true, guardName: 'ZERO_CHUNK_GUARD' };
    }

    // 2. Flood Guard: Prevent rapid commit floods
    const timeSinceLastCommit = Date.now() - (session.lastTurnCommitTime || 0);
    if (timeSinceLastCommit < 600 && (session.lastTurnCommitTime || 0) > 0) {
      console.warn(`🛡️ [FLOOD_GUARD] Suppressed rapid turnComplete flood (${timeSinceLastCommit}ms since last commit, session: ${session.sessionId || 'anon'})`);
      return { shouldDrop: true, guardName: 'FLOOD_GUARD' };
    }

    // 3. Stale Guard: Suppress turnComplete if Gemini is generating or physical playout is ongoing
    const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
    const isRecentBargeIn = session.lastBargeInEpoch && (Date.now() - session.lastBargeInEpoch < 3000);

    if (isRecentBargeIn || chunksCount > 0) {
      session.isAiGenerating = false;
      session.aiPlayoutEstimatedEndEpoch = 0;
    } else if ((session.isAiGenerating || isPlayoutActive) && !hasTextTurns) {
      const remainingMs = isPlayoutActive ? session.aiPlayoutEstimatedEndEpoch! - Date.now() : 0;
      console.warn(`🛡️ [STALE_GUARD] Suppressed client turnComplete because AI speech/playout is still active (sessionId: ${session.sessionId || 'anon'}, generating: ${session.isAiGenerating}, remaining playout: ${remainingMs}ms)`);
      return { shouldDrop: true, guardName: 'STALE_GUARD' };
    }

    return { shouldDrop: false };
  }

  /**
   * Evaluates if incoming microphone audio chunk must be suppressed by Echo Guard.
   * Allows audio through if marked with bargeIn or if AI is idle.
   *
   * In native Cloud VAD mode (turnMode === 'auto'), audio MUST flow continuously
   * to Gemini — it detects speech boundaries server-side and needs uninterrupted input.
   * The EchoGuard is only relevant for speaker-bleed prevention (manual/client-VAD mode).
   */
  public static shouldSuppressEchoChunk(
    session: ProxySession,
    isAudioChunk: boolean,
    isBargeIn: boolean,
    turnMode: 'manual' | 'auto' = 'manual'
  ): boolean {
    if (!isAudioChunk || isBargeIn) {
      return false;
    }

    // Audio Mutex Invariant: while a tool call is in-flight, MUST freeze mic chunks
    // regardless of turnMode to avoid Google WebSocket close 1008 Policy Violation!
    if (session.isToolCallPending) {
      return true;
    }

    // Native Cloud VAD: Gemini needs continuous audio to detect speech start/end
    if (turnMode === 'auto') {
      return false;
    }

    const isPlayoutActive = !!session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
    const isAudioEmitting = session.isAiGenerating && !!session.firstAudioChunkLogged;

    if (session.isToolCallPending || isAudioEmitting || isPlayoutActive) {
      if (session.currentTurnMetrics) {
        session.currentTurnMetrics.droppedEchoChunksCount = (session.currentTurnMetrics.droppedEchoChunksCount || 0) + 1;
        if (session.currentTurnMetrics.droppedEchoChunksCount === 1 || session.currentTurnMetrics.droppedEchoChunksCount % 25 === 0) {
          console.log(`🛡️ [ECHO_GUARD] Suppressed mic audio frame while AI is generating/playing (session ${session.sessionId || 'anon'}, dropped chunks: ${session.currentTurnMetrics.droppedEchoChunksCount})`);
        }
      }
      return true;
    }

    return false;
  }
}
