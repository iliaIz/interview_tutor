import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { LiveClientGuardService } from './liveClientGuardService';

export function handleTurnCommit(
  session: ProxySession,
  parsed: any,
  isBargeIn: boolean,
  clientSocket: WebSocket,
  turnMode: 'manual' | 'auto'
): boolean {
  const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;
  const guardCheck = LiveClientGuardService.evaluateTurnCompleteGuard(session, hasTextTurns, isBargeIn);
  if (guardCheck.shouldDrop) {
    if (guardCheck.guardName === 'ZERO_CHUNK_GUARD') {
      console.log(`🎙️ [ZERO_CHUNK_RECOVERY] Candidate committed with 0 audio chunks for session ${session.sessionId || 'anon'}. Synthesizing conversational prompt.`);
      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text: '[КАНДИДАТ ПЕРЕДАЛ СЛОВО: Завершил ответ. Задай следующий вопрос или дай обратную связь.]' }]
            }],
            turnComplete: true
          }
        }));
      }
      session.isAiGenerating = true;
      session.lastTurnCommitTime = Date.now();
      armTurnWatchdogs(session, clientSocket);
      return false;
    }
    return false;
  }

  const committedAudioChunks = session.audioChunksCount || 0;
  session.isAiGenerating = true;
  session.lastTurnCommitTime = Date.now();
  const speechDurationMs = session.currentTurnMetrics?.candidateSpeechStartedAt
    ? session.lastTurnCommitTime - session.currentTurnMetrics.candidateSpeechStartedAt
    : committedAudioChunks * 40;

  if (session.currentTurnMetrics) {
    session.currentTurnMetrics.candidateSpeechEndedAt = session.lastTurnCommitTime;
    session.currentTurnMetrics.speechDurationMs = speechDurationMs;
  } else {
    session.currentTurnMetrics = {
      turnIndex: session.currentTurnIndex || 0,
      candidateSpeechStartedAt: session.lastTurnCommitTime - speechDurationMs,
      candidateSpeechEndedAt: session.lastTurnCommitTime,
      vadPauseSettingMs: session.vadPauseMs || 1800,
      speechDurationMs,
      audioBytesReceived: 0,
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false,
      bargeInType: null,
      lastRttMs: session.lastRttMs ?? null
    };
  }
  if (hasTextTurns) {
    session.hasCandidateResponded = true;
  }
  console.log(`🎙️ [TURN_COMMIT] Candidate committed turn via turnComplete (sessionId: ${session.sessionId || 'anon'}, turnMode: ${turnMode}, audioChunksSent: ${committedAudioChunks}, duration: ${speechDurationMs}ms, hasTextTurns: ${hasTextTurns})`);
  session.audioChunksCount = 0;
  armTurnWatchdogs(session, clientSocket);
  return true;
}

function armTurnWatchdogs(session: ProxySession, clientSocket: WebSocket): void {
  if (session.nudgeWatchdog) clearTimeout(session.nudgeWatchdog);
  session.nudgeWatchdog = setTimeout(() => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs: 5500 }));
    }
  }, 5500);

  // Bounded Generation Watchdog: SOTA 2026 Dead-Air Prevention (8.0s timeout or session override)
  const deadAirTimeoutMs = session.deadAirTimeoutMs ?? 8000;
  if (session.deadAirWatchdog) clearTimeout(session.deadAirWatchdog);
  session.deadAirWatchdog = setTimeout(() => {
    if (session.isAiGenerating) {
      console.warn(`⏱️ [DEAD_AIR_WATCHDOG] ${deadAirTimeoutMs}ms silence expired with zero response from Gemini Live (sessionId: ${session.sessionId || 'anon'}). Reclaiming microphone and dispatching conversational nudge.`);
      session.isAiGenerating = false;
      if (session.currentTurnMetrics) {
        session.currentTurnMetrics.droppedEchoChunksCount = 0;
      }
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'dead_air_recovery',
          reason: 'upstream_timeout',
          timestamp: Date.now()
        }));
      }
      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        try {
          session.geminiSocket.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: '[СИСТЕМНОЕ СООБЩЕНИЕ: Кандидат закончил говорить. Задай вопрос или отреагируй на реплику.]' }]
              }],
              turnComplete: true
            }
          }));
        } catch (e) {
          console.warn('Failed to send conversational nudge to Gemini:', e);
        }
      }
    }
  }, deadAirTimeoutMs);
}
