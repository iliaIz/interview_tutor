import { WebSocket } from 'ws';
import { ProxySession } from './liveSessionTypes';
import { liveSessionRegistry } from './liveSessionRegistry';
import { getChallengeDomain } from '../../utils/challengeDomain';

export interface GreetingReplayOptions {
  session: ProxySession;
  geminiSocket: WebSocket;
  clientSocket: WebSocket;
  sessionType: 'interview' | 'tutor' | 'system_design';
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

  if (isResumed || wasReconnecting) {
    const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
    const hasHistory = mem && mem.turns.length > 0;

    if (hasHistory) {
      console.log(`🔄 Replaying ${mem.turns.length} structured multi-turn dialogue steps to upstream Live model for session ${session.sessionId}...`);
      const replayTurns = mem.turns.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }]
      }));

      const multiTurnMessage = {
        clientContent: {
          turns: replayTurns,
          turnComplete: false
        }
      };
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(multiTurnMessage));
      }

      if (wasReconnecting) {
        console.log(`✅ Upstream Hot Reconnect complete: notifying client of ready state`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'upstream_ready' }));
        }
      } else if (mem.lastSpeaker === 'user' || mem.lastSpeaker === 'none') {
        console.log(`🤫 Silent Resumption active for session ${session.sessionId}: AI remains quiet, microphone immediately unlocked for candidate.`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: true }));
        }
      } else {
        console.log(`🎙️ Mid-turn Resumption for session ${session.sessionId}: triggering brief completion without greetings.`);
        const continueTurn = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: '[ТЕХНИЧЕСКАЯ СИНХРОНИЗАЦИЯ СВЯЗИ (ЯЗЫК: РУССКИЙ)]: Напоминание: ответ строго на русском языке. Закончи свою предыдущую мысль одной короткой фразой (1 предложение) и передай слово кандидату.'
                  }
                ]
              }
            ],
            turnComplete: true
          }
        };
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(JSON.stringify(continueTurn));
        }
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: false }));
        }
      }
    } else {
      if (wasReconnecting) {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'upstream_ready' }));
        }
      } else {
        const fallbackGreeting = `[ВОЗОБНОВЛЕНИЕ ДИАЛОГА]: Мы продолжаем обсуждение вопроса "${questionText || topic}". Не здоровайся заново. Одной короткой фразой передай слово кандидату.`;
        const initialGreetingTurn = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text: fallbackGreeting }]
              }
            ],
            turnComplete: true
          }
        };
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(JSON.stringify(initialGreetingTurn));
        }
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: false }));
        }
      }
    }
  } else {
    let greetingText = '';
    if (initialUserMessage) {
      greetingText = initialUserMessage;
      session.hasCandidateResponded = true;
      console.log(`💬 User initiated session with direct prompt turn: "${initialUserMessage.slice(0, 80)}..."`);
    } else if (sessionType === 'tutor') {
      if (tutorMode === 'bug_hunt') {
        greetingText = `Привет! Я смотрю на задачу на экране «${bugTitle || 'Code Review'}». Поприветствуй меня в 1 коротком предложении и спроси, в чем здесь ошибка.`;
      } else if (tutorMode === 'deep_dive') {
        greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 предложении и предложи разобрать любые тонкости или устройство под капотом.`;
      } else if (tutorMode === 'free_chat') {
        greetingText = `Привет! Я разбираю тему «${questionText || topic}». Поприветствуй меня в 1 коротком предложении и скажи, что готова ответить на любые вопросы и помочь разобраться.`;
      } else if (tutorMode === 'socratic') {
        greetingText = `Привет! Я готов разобрать вопрос «${questionText || topic}». Задай мне первый наводящий вопрос.`;
      } else if (tutorMode === 'eli5') {
        greetingText = `Привет! Объясни мне суть вопроса «${questionText || topic}» на простой жизненной аналогии.`;
      } else if (tutorMode === 'practice_pair') {
        const domain = getChallengeDomain({
          category: challengeCategory || session.challengeCategory,
          track: challengeTrack || session.challengeTrack,
          slug: bugTitle
        });
        const isLld = domain === 'lld';
        const isTx = domain === 'transactions';
        if (isLld) {
          greetingText = `Привет! Я твоя напарница по проектированию архитектуры задачи «${bugTitle || questionText || topic}». Поприветствуй меня в 1 коротком предложении и спроси, с каких интерфейсов или доменной модели начнем проектирование.`;
        } else if (isTx) {
          greetingText = `Привет! Я разбираю сценарий транзакций «${bugTitle || questionText || topic}». Поприветствуй меня в 1 коротком предложении и предложи разобрать уровни изоляции и поведение БД.`;
        } else {
          greetingText = `Привет! Я твоя напарница по задаче «${bugTitle || questionText || topic}». Поприветствуй меня в 1 коротком предложении и предложи обсудить граничные случаи или план решения.`;
        }
      } else {
        greetingText = `Привет! Я изучаю вопрос «${questionText || topic}». Поприветствуй меня в 1 короткой фразе.`;
      }
    } else {
      const isSubsequent = questionIndex > 0;
      if (session.isRetry) {
        greetingText = `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${questionText || 'Вопрос темы'}". Коротко подбодри в 1 фразе и сразу задай этот вопрос слитным, связным речевым потоком без пауз. (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала).`;
      } else {
        greetingText = isSubsequent
          ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой подтверди прогресс и сразу четко зачитай следующий технический вопрос слитным речевым потоком: "${questionText || 'Следующий вопрос темы'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала).`
          : `Привет! Я готова к собеседованию. Произнеси краткое приветствие и сразу четко зачитай технический вопрос единым слитным речевым потоком без долгих пауз: "${questionText || 'Расскажи о себе и опыте в Java'}". (Внимание: сейчас только задай вопрос голосом, оценку выставлять не нужно, я еще не отвечала).`;
      }
    }

    const initialGreetingTurn = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: greetingText }]
          }
        ],
        turnComplete: true
      }
    };

    if (wasReconnecting) {
      if (!session.hasCandidateResponded) {
        console.log(`🔄 Upstream reconnect during Turn 0: resending greeting prompt for question "${questionText || topic}"`);
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(JSON.stringify(initialGreetingTurn));
        }
      } else {
        console.log(`✅ Upstream reconnect mid-dialogue: notifying client without greeting replay`);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ type: 'upstream_ready' }));
        }
      }
    } else {
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(initialGreetingTurn));
      }
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'setupComplete',
        hasInitialUserMessage: !!initialUserMessage
      }));
    }
  }
}
