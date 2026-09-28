/**
 * LiveCannedErrorRecovery.ts
 * SOTA Late September 2026 Circuit Breaker & Conversational Error Recovery.
 * Intercepts upstream canned errors, non-speech tokens (<no speech>), and silent stalls.
 * Prevents downstream leakage to candidates and dispatches active conversational nudges.
 * Cognitive bounding limit: <= 120 lines.
 */

import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { isCannedErrorUtterance, isNonSpeechUtterance } from './liveStreamErrorDetector';

export class LiveCannedErrorRecovery {
  /**
   * Evaluates if text delta or accumulated text constitutes a canned error or non-speech token.
   * Returns true if intercepted and suppressed.
   */
  public static evaluateAndIntercept(
    session: ProxySession,
    clientSocket: WebSocket,
    text: string,
    audioBytes?: number
  ): boolean {
    if (session.isCannedErrorTurn) {
      return true;
    }

    const isNonSpeech = isNonSpeechUtterance(text, audioBytes);
    const isCannedError = isCannedErrorUtterance(text, audioBytes);

    if (isNonSpeech || isCannedError) {
      session.isCannedErrorTurn = true;
      session.cannedErrorType = isNonSpeech ? 'non_speech' : 'system_canned';

      const reasonLabel = isNonSpeech ? 'Non-speech acoustic token (<no speech>)' : 'Canned audio error';
      console.warn(`🚨 [ACOUSTIC_CIRCUIT_BREAKER] Upstream ${reasonLabel} detected ("${text?.slice(0, 80)}"). Suppressing downstream forwarding.`);

      // For system errors, notify client of transient stream recovery; for non-speech, keep candidate waiting seamlessly
      if (isCannedError && !isNonSpeech && clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({ type: 'stream_recovery', reason: 'canned_upstream_error' }));
        } catch {}
      }

      return true;
    }

    return false;
  }

  /**
   * Resets interrupted session state and injects an active conversational nudge to Gemini.
   */
  public static executeRecoveryNudge(
    session: ProxySession,
    geminiSocket: WebSocket
  ): void {
    const errorType = session.cannedErrorType || 'system_canned';
    console.log(`🔄 [ACOUSTIC_CIRCUIT_BREAKER] ${errorType === 'non_speech' ? 'Non-speech' : 'Canned error'} turn complete. Suppressing from history and dispatching active conversational recovery nudge (session: ${session.sessionId || 'anon'})...`);

    session.isCannedErrorTurn = false;
    session.cannedErrorType = undefined;
    session.currentAiTurnText = '';
    session.currentTurnMetrics = null;
    session.lastTurnCommitTime = undefined;
    session.currentTurnAudioBytes = 0;
    session.firstAudioChunkTime = undefined;
    session.audioChunksCount = 0;
    session.isAiGenerating = false;
    session.firstAudioChunkLogged = false;

    if (session.deadAirWatchdog) {
      clearTimeout(session.deadAirWatchdog);
      session.deadAirWatchdog = null;
    }
    if (session.toolCallSafetyTimeout) {
      clearTimeout(session.toolCallSafetyTimeout);
      session.toolCallSafetyTimeout = null;
    }

    const promptText = errorType === 'non_speech'
      ? '[КАНДИДАТ ЗАВЕРШИЛ ОТВЕТ, НО ЗВУК БЫЛ ТИХИМ / НЕРАЗБОРЧИВЫМ]: Среагируй естественно голосом на русском языке (1 короткая фраза): \'Я тебя не расслышала, повтори, пожалуйста, ответ.\' или продолжи тему вопроса. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ)'
      : '[СИСТЕМНОЕ НАПОМИНАНИЕ]: Произошла внутренняя заминка связи. Продолжи диалог с кандидатом строго по теме, опираясь на последнее сообщение кандидата. Ответь кратко и емко голосом.';

    const recoveryNudge = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        turnComplete: true
      }
    };

    if (geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify(recoveryNudge));
    }
  }
}
