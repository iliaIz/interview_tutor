import { WebSocket } from 'ws';
import { HR_VOICE_EVENTS } from '@interview-prep/shared';
import { ProxySession } from './liveSessionTypes';
import { liveSessionRegistry } from './liveSessionRegistry';
import { getChallengeDomain } from '../../utils/challengeDomain';
import { getHrQuestion } from './hrContextResolver';
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

    const effectiveTitle = bugTitle || session.bugTitle || questionText || topic;
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
          text: `[СИСТЕМНОЕ УВЕДОМЛЕНИЕ]: Связь с кандидатом восстановлена после сетевого сбоя. Приветствие Turn 0 УЖЕ БЫЛО ПРОИЗНЕДЕНО РАНЕЕ. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО здороваться заново! Продолжай обсуждение задачи «${effectiveTitle}». Жди следующей реплики кандидата.`
        }]
      });

      geminiSocket.send(JSON.stringify({
        clientContent: {
          turns: turnsToSeed,
          turnComplete: false
        }
      }));
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

  let greetingText = '';
  if (initialUserMessage) {
    greetingText = initialUserMessage;
    session.hasCandidateResponded = true;
    console.log(`💬 User initiated session with direct prompt turn: "${initialUserMessage.slice(0, 80)}..."`);
  } else if (sessionType === 'tutor') {
    const isSubsequent = questionIndex > 0;
    if (isSubsequent) {
      greetingText = `Мы переходим к следующему вопросу темы (вопрос ${questionIndex + 1} из ${totalQuestions}): «${questionText || topic}». В 1 короткой фразе предложи с чего начнем разбор: с базовых концепций или устройства под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 короткая фраза).`;
    } else if (tutorMode === 'bug_hunt') {
      greetingText = `Привет! Я смотрю на задачу на экране «${bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else if (tutorMode === 'deep_dive') {
      greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else if (tutorMode === 'free_chat') {
      greetingText = `Привет! Я разбираю тему «${questionText || topic}». Поприветствуй меня в 1 коротком предложении и скажи, что готова ответить на любые вопросы и помочь разобраться. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else if (tutorMode === 'socratic') {
      greetingText = `Привет! Я готов разобрать вопрос «${questionText || topic}». Задай мне первый наводящий вопрос. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else if (tutorMode === 'eli5') {
      greetingText = `Привет! Объясни мне суть вопроса «${questionText || topic}» на простой жизненной аналогии. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else if (tutorMode === 'practice_pair') {
      const effectiveTitle = bugTitle || session.bugTitle || questionText || topic;
      const domain = getChallengeDomain({
        category: challengeCategory || session.challengeCategory,
        track: challengeTrack || session.challengeTrack,
        slug: effectiveTitle
      });
      const isLld = domain === 'lld';
      const isTx = domain === 'transactions';
      const isConcurrency = domain === 'concurrency';
      const isRefactoring = domain === 'refactoring';
      const isJava21 = domain === 'java21';

      if (session.seniorReview) {
        const sr = session.seniorReview;
        const score = Math.round(sr.overallScore);
        const focused = sr.focusedFinding;
        if (focused) {
          greetingText = `Привет! Я только что завершил Senior AI Review задачи «${effectiveTitle}» (оценка ${score}/100). Поприветствуй меня в 1-2 предложениях и сразу голосом озвучь замечание [${focused.category}] в ${focused.location}: «${focused.description}». Спроси, с чего начнем устранение дефекта в коде. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1-2 емких предложения).`;
        } else {
          greetingText = `Привет! Я только что завершил Senior AI Review задачи «${effectiveTitle}» (оценка ${score}/100). Заключение: "${sr.summaryReview}". Поприветствуй меня в 1-2 предложениях и предложи голосом разобрать замечания по коду. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1-2 емких предложения).`;
        }
      } else if (isLld) {
        greetingText = `Привет! Я готов к проектированию архитектуры задачи «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и спроси, с каких интерфейсов или доменной модели начнем проектирование. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      } else if (isTx) {
        greetingText = `Привет! Я разбираю сценарий транзакций «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и предложи разобрать уровни изоляции и поведение БД. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      } else if (isConcurrency) {
        greetingText = `Привет! Я разбираю многопоточную задачу «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и предложи обсудить виртуальные потоки Loom, гонки данных или блокировки. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      } else if (isRefactoring) {
        greetingText = `Привет! Я рефакторю легаси-код задачи «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и спроси, с каких швов (Seams) или тестов начнем рефакторинг. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      } else if (isJava21) {
        greetingText = `Привет! Я изучаю современные идиомы Java 21 LTS в задаче «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и предложи обсудить Pattern Matching, Records или sealed-типы. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      } else {
        greetingText = `Привет! Я готов к разбору задачи «${effectiveTitle}». Поприветствуй меня в 1 коротком предложении и предложи обсудить граничные случаи или план решения. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
      }
    } else {
      greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 короткой фразе. (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    }
  } else if (sessionType === 'hr_tutor') {
    const activeQuestion = getHrQuestion(session.questionId);
    if (session.hrMode === 'guided_zero_start') {
      const beats = resolveGuidedSessionBeats(activeQuestion, {
        startBeatId: session.startBeatId,
        beatScope: session.beatScope
      });
      const initialState = createInitialGuidedState(activeQuestion, {
        startBeatId: session.startBeatId,
        beatScope: session.beatScope
      });
      session.hrGuidedState = initialState;

      if (initialState && beats.length > 0) {
        const initPayload = buildStepStatePayload(initialState, beats, 'session_init');
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: HR_VOICE_EVENTS.HR_STEP_STATE, payload: initPayload }));
        }
        const entryBeat = beats[initialState.beatIndex] || beats[0];
        const beatNumLabel = `${initialState.beatIndex + 1} из ${beats.length}`;
        const scopeHint =
          initPayload.beatScope === 'single_beat'
            ? 'Изолированная тренировка одного блока (разными формулировками).'
            : `Стартовый блок ${beatNumLabel}.`;
        greetingText = `Привет! Мы учим ответ «с полного нуля». ${scopeHint} Коротко поприветствуй кандидата уверенным теплым голосом тренера Ольги, назови блок «${entryBeat.title}», естественно произнеси первую формулировку своими связками на основе ориентира: «${entryBeat.spokenVariants[0]}» (сохранив точные факты: ${entryBeat.immutableFacts.join(', ')}) и попроси повторить вслух. (ВАЖНО: сейчас Turn 0 — НЕ вызывай никаких инструментов!).`;
      } else {
        greetingText = `Привет! Мы начинаем пошаговую тренировку с нуля по вопросу «${activeQuestion?.canonicalQuestion || questionText || 'Расскажите о себе'}». Поприветствуй кандидата и произнеси первую короткую фразу для повтора.`;
      }
    } else {
      greetingText = `Привет! Мы начинаем живую репетицию вопроса «${activeQuestion?.canonicalQuestion || questionText || 'Расскажите о себе'}». Коротко поприветствуй кандидата как тренер Ольга и дай команду начинать ответ. (ВАЖНО: сейчас Turn 0 — НЕ вызывай никаких инструментов!).`;
    }
  } else {
    const isSubsequent = questionIndex > 0;
    if (session.isRetry) {
      greetingText = `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${questionText || 'Вопрос темы'}". Коротко подбодри в 1 фразе и сразу задай этот вопрос слитным, связным речевым потоком без пауз. (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    } else {
      greetingText = isSubsequent
        ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой подтверди прогресс и сразу четко зачитай следующий технический вопрос слитным речевым потоком: "${questionText || 'Следующий вопрос темы'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`
        : `Привет! Я готова к собеседованию. Поздоровайся в 1 коротком предложении и сразу полностью зачитай технический вопрос единым речевым потоком без пауз: "${questionText || 'Расскажи о себе и опыте в Java'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала). (ОТВЕТ СТРОГО ГОЛОСОМ НА РУССКОМ ЯЗЫКЕ: 1 фраза).`;
    }
  }

  const initialTurns: Array<{ role: 'user'; parts: [{ text: string }] }> = [
    {
      role: 'user',
      parts: [{ text: greetingText }]
    }
  ];

    const initialGreetingTurn = {
      clientContent: {
        turns: initialTurns,
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
