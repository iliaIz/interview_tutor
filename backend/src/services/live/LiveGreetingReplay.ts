import { WebSocket } from 'ws';
import { HR_VOICE_EVENTS } from '@interview-prep/shared';
import { ProxySession } from './liveSessionTypes';
import { liveSessionRegistry } from './liveSessionRegistry';
import { getHrQuestion } from './hrContextResolver';
import { LiveSessionBlueprintBuilder } from './LiveSessionBlueprintBuilder';
import {
  resolveGuidedSessionBeats,
  createInitialGuidedState,
  buildStepStatePayload
} from './hrGuidedStepper';

export interface GreetingReplayOptions {
  session: ProxySession;
  geminiSocket: WebSocket;
  clientSocket: WebSocket;
  sessionType: 'interview' | 'tutor' | 'system_design' | 'hr_simulation' | 'hr_micro_drill' | 'hr_tutor';
  tutorMode: string;
  bugTitle: string;
  questionText: string;
  topic: string;
  isResumed: boolean;
  wasReconnecting: boolean;
  initialUserMessage?: string;
  questionIndex: number;
  totalQuestions: number;
  challengeCategory?: string;
  challengeTrack?: string;
}

export function dispatchReconnectContextReplay(
  session: ProxySession,
  geminiSocket: WebSocket,
  opts: { bugTitle?: string; questionText?: string; topic?: string } = {}
): void {
  const effectiveTitle = opts.bugTitle || session.bugTitle || opts.questionText || session.questionText || opts.topic || session.topic || 'Текущая тема';
  const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
  const recentTurns = (mem?.turns || []).slice(-4);

  if (geminiSocket.readyState === WebSocket.OPEN) {
    const turnsToSeed: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    for (const t of recentTurns) {
      turnsToSeed.push({
        role: t.role,
        parts: [{ text: t.text }]
      });
    }

    turnsToSeed.push({
      role: 'user',
      parts: [{
        text: `[СИСТЕМНОЕ УВЕДОМЛЕНИЕ]: Связь с кандидатом восстановлена после переключения канала. Приветствие Turn 0 УЖЕ БЫЛО ПРОИЗНЕДЕНО РАНЕЕ. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО здороваться заново! Продолжай обсуждение задачи «${effectiveTitle}». Жди следующей реплики кандидата.`
      }]
    });

    geminiSocket.send(JSON.stringify({
      clientContent: {
        turns: turnsToSeed,
        turnComplete: false
      }
    }));
  }
}

/**
 * LiveGreetingReplay (SOTA Late 2026).
 * Handles Turn 0 greeting generation and multi-turn replay upon reconnect.
 * Cognitive bounding limit: <= 350 lines.
 */
export function handleSetupCompleteGreeting(options: GreetingReplayOptions): void {
  const {
    session,
    geminiSocket,
    clientSocket,
    sessionType,
    tutorMode,
    bugTitle,
    questionText,
    topic,
    isResumed,
    wasReconnecting,
    initialUserMessage,
    questionIndex,
    totalQuestions,
    challengeCategory = '',
    challengeTrack = ''
  } = options;

  if (wasReconnecting) {
    console.log(`🔄 [HOT_RECONNECT] Upstream connected for session ${session.sessionId || 'anon'}. Resuming conversation.`);

    // Avoid polluting native KV-cache with text replay when cryptographic resumption handle is active
    if (!session.resumptionHandle) {
      dispatchReconnectContextReplay(session, geminiSocket, { bugTitle, questionText, topic });
    }

    session.isGreetingSent = true;
    session.hasCandidateResponded = true;

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ type: 'upstream_ready' }));
      if (sessionType === 'hr_tutor' && session.hrMode === 'guided_zero_start' && session.hrGuidedState) {
        const activeQuestion = getHrQuestion(session.questionId);
        const beats = resolveGuidedSessionBeats(activeQuestion, {
          startBeatId: session.startBeatId,
          beatScope: session.beatScope
        });
        if (beats.length > 0) {
          clientSocket.send(
            JSON.stringify({
              type: HR_VOICE_EVENTS.HR_STEP_STATE,
              payload: buildStepStatePayload(session.hrGuidedState, beats, 'session_init', 'hot_reconnect')
            })
          );
        }
      }
      clientSocket.send(JSON.stringify({
        type: 'setupComplete',
        hasInitialUserMessage: !!initialUserMessage,
        reconnected: true,
        silent: true
      }));
    }
    return;
  }

  if (isResumed) {
    console.log(`🤫 Resumption active for session ${session.sessionId || 'anon'}: AI remains quiet, microphone immediately unlocked for candidate.`);
    session.fsm?.transition('CANDIDATE_LISTENING');
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: true, isResumed: true }));
    }
    return;
  }

  if (initialUserMessage) {
    session.hasCandidateResponded = true;
    console.log(`💬 User initiated session with direct prompt turn: "${initialUserMessage.slice(0, 80)}..."`);
  }

  let activeHrQuestion: ReturnType<typeof getHrQuestion> | undefined;
  if (!initialUserMessage && sessionType === 'hr_tutor') {
    activeHrQuestion = getHrQuestion(session.questionId);
    if (session.hrMode === 'guided_zero_start') {
      const beatOpts = { startBeatId: session.startBeatId, beatScope: session.beatScope };
      const beats = resolveGuidedSessionBeats(activeHrQuestion, beatOpts);
      const initialState = createInitialGuidedState(activeHrQuestion, beatOpts);
      session.hrGuidedState = initialState;
      if (initialState && beats.length > 0 && clientSocket.readyState === WebSocket.OPEN) {
        const initPayload = buildStepStatePayload(initialState, beats, 'session_init');
        clientSocket.send(JSON.stringify({ type: HR_VOICE_EVENTS.HR_STEP_STATE, payload: initPayload }));
      }
    }
  }

  const greetingText = LiveSessionBlueprintBuilder.resolveTurn0GreetingText({
    sessionType,
    tutorMode,
    bugTitle: bugTitle || session.bugTitle,
    questionText,
    topic,
    questionId: session.questionId,
    questionIndex,
    totalQuestions,
    isRetry: session.isRetry,
    initialUserMessage,
    challengeCategory: challengeCategory || session.challengeCategory,
    challengeTrack: challengeTrack || session.challengeTrack,
    seniorReview: session.seniorReview,
    hrMode: session.hrMode,
    startBeatId: session.startBeatId,
    beatScope: session.beatScope,
    hrGuidedState: session.hrGuidedState,
    hrQuestion: activeHrQuestion
  });

  const initialGreetingTurn = {
    clientContent: {
      turns: [{ role: 'user' as const, parts: [{ text: greetingText }] }],
      turnComplete: true
    }
  };

  if (geminiSocket.readyState === WebSocket.OPEN) {
    geminiSocket.send(JSON.stringify(initialGreetingTurn));
  }
  session.isGreetingSent = true;
  session.fsm?.transition('AI_SPEAKING');

  if (clientSocket.readyState === WebSocket.OPEN) {
    clientSocket.send(JSON.stringify({
      type: 'setupComplete',
      hasInitialUserMessage: !!initialUserMessage
    }));
  }
}
