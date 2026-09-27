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

    if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
      session.geminiSocket.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN). ОТВЕТ СТРОГО НА РУССКОМ ЯЗЫКЕ]: Передай слово кандидату.' }]
          }],
          turnComplete: false
        }
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
   */
  public static shouldSuppressEchoChunk(
    session: ProxySession,
    isAudioChunk: boolean,
    isBargeIn: boolean
  ): boolean {
    if (!isAudioChunk || isBargeIn) {
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
