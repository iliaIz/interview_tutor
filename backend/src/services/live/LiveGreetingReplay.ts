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

export function buildWorkspaceGroundingTurn(session: ProxySession): { role: 'user'; parts: [{ text: string }] } | null {
  const workspaceXml = session.workspaceManifest?.xmlManifest || '';
  const activeSnippet = session.codeSnippet || session.workspaceManifest?.activeFile?.content || '';
  const activePath = session.workspaceManifest?.activeFile?.path || 'src/main/java/Solution.java';
  const effectiveTitle = session.bugTitle || session.questionText || session.topic || 'Практическая задача';

  if (!workspaceXml && !activeSnippet) {
    return null;
  }

  const text = `📌 [КОНТЕКСТ ЗАДАЧИ И РАБОЧЕГО ПРОСТРАНСТВА]:
Задача: "${effectiveTitle}"
Инструкции / Бизнес-требования:
${session.bugExplanation || 'Реализуйте требуемый функционал.'}

${workspaceXml ? `Структура проекта и исходные файлы:\n${workspaceXml}` : `Активный файл (${activePath}):\n\`\`\`java\n${activeSnippet}\n\`\`\``}`;

  return {
    role: 'user',
    parts: [{ text }]
  };
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
    const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
    const hasHistory = Boolean(mem && mem.turns.length > 0);
    const groundingTurn = (session.debugStep === undefined || session.debugStep >= 2) ? buildWorkspaceGroundingTurn(session) : null;

    if (hasHistory && mem) {
      console.log(`🔄 [HOT_RECONNECT] Replaying ${mem.turns.length} dialogue turns to upstream Live model for session ${session.sessionId}...`);
      const replayTurns = mem.turns.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }]
      }));
      if (groundingTurn) {
        replayTurns.push(groundingTurn);
      }

      const multiTurnMessage = {
        clientContent: {
          turns: replayTurns,
          turnComplete: false
        }
      };
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(multiTurnMessage));
      }
    } else {
      console.log(`🔄 [HOT_RECONNECT] Reconnect without turn history. Establishing context anchor without greeting replay for "${questionText || topic}"...`);
      const anchorTurns: Array<{ role: 'user'; parts: [{ text: string }] }> = [];
      if (groundingTurn) {
        anchorTurns.push(groundingTurn);
      }
      anchorTurns.push({
        role: 'user',
        parts: [
          {
            text: `[КОНТЕКСТ ДИАЛОГА]: Мы разбираем задачу «${questionText || topic}». Ты уже поприветствовала кандидата и задала вопрос. Кандидат сейчас отвечает или готовится ответить голосом. Не здоровайся заново и не повторяй приветствие. Слушай кандидата и отвечай по существу.`
          }
        ]
      });
      const contextAnchorTurn = {
        clientContent: {
          turns: anchorTurns,
          turnComplete: false
        }
      };
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(contextAnchorTurn));
      }
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({ type: 'upstream_ready' }));
      clientSocket.send(JSON.stringify({
        type: 'setupComplete',
        hasInitialUserMessage: !!initialUserMessage,
        reconnected: true
      }));
    }
    return;
  }

  if (isResumed) {
    const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
    const hasHistory = mem && mem.turns.length > 0;
    const groundingTurn = (session.debugStep === undefined || session.debugStep >= 2) ? buildWorkspaceGroundingTurn(session) : null;

    if (hasHistory) {
      console.log(`🔄 Replaying ${mem.turns.length} structured multi-turn dialogue steps to upstream Live model for session ${session.sessionId}...`);
      const replayTurns = mem.turns.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }]
      }));
      if (groundingTurn) {
        replayTurns.push(groundingTurn);
      }

      const multiTurnMessage = {
        clientContent: {
          turns: replayTurns,
          turnComplete: false
        }
      };
      if (geminiSocket.readyState === WebSocket.OPEN) {
        geminiSocket.send(JSON.stringify(multiTurnMessage));
      }

      if (mem.lastSpeaker === 'user' || mem.lastSpeaker === 'none') {
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
      const fallbackGreeting = `[ВОЗОБНОВЛЕНИЕ ДИАЛОГА]: Мы продолжаем обсуждение вопроса "${questionText || topic}". Не здоровайся заново. Одной короткой фразой передай слово кандидату.`;
      const fallbackTurns: Array<{ role: 'user'; parts: [{ text: string }] }> = [];
      if (groundingTurn) {
        fallbackTurns.push(groundingTurn);
      }
      fallbackTurns.push({
        role: 'user',
        parts: [{ text: fallbackGreeting }]
      });
      const initialGreetingTurn = {
        clientContent: {
          turns: fallbackTurns,
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
    return;
  }
    let greetingText = '';
    if (session.debugStep === 0) {
      greetingText = 'Привет! Это чистая проверка Gemini Live v3 из коробки без надстроек. Скажи мне что-нибудь, и я отвечу.';
    } else if (session.debugStep === 1) {
      greetingText = 'Привет! Проверяем системную инструкцию роли на русском языке. Скажи одну короткую фразу: Связь установлена.';
    } else if (session.debugStep === 2) {
      greetingText = 'Привет! Проверяем контекст и заземление на код проекта. Скажи: Контекст получен.';
    } else if (session.debugStep === 3) {
      greetingText = 'Привет! Проверяем инструменты и вызовы функций. Скажи: Проверка инструментов.';
    } else if (session.debugStep === 4) {
      greetingText = 'Привет! Проверяем серверный Cloud VAD и транскрипцию речи. Ответь мне короткой фразой.';
    } else if (session.debugStep === 5) {
      greetingText = 'Привет! Проверяем клиентский звуковой тракт и Silero VAD. Скажи что-нибудь в микрофон.';
    } else if (initialUserMessage) {
      greetingText = initialUserMessage;
      session.hasCandidateResponded = true;
      console.log(`💬 User initiated session with direct prompt turn: "${initialUserMessage.slice(0, 80)}..."`);
    } else if (sessionType === 'tutor') {
      if (tutorMode === 'bug_hunt') {
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

        if (isLld) {
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

    const groundingTurn = (session.debugStep === undefined || session.debugStep >= 2)
      ? buildWorkspaceGroundingTurn(session)
      : null;
    const initialTurns: Array<{ role: 'user'; parts: [{ text: string }] }> = [];
    if (groundingTurn) {
      initialTurns.push(groundingTurn);
    }
    initialTurns.push({
      role: 'user',
      parts: [{ text: greetingText }]
    });

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

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'setupComplete',
        hasInitialUserMessage: !!initialUserMessage
      }));
    }
  }
