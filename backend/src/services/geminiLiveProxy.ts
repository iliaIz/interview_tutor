import { WebSocket, WebSocketServer, RawData } from 'ws';
import http from 'http';
import url from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
dotenv.config();

interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  questionId?: string;
  topic?: string;
  referenceAnswer?: string;
}

/**
 * Extracts up to 10 semantic evaluation anchors from reference answer
 */
function extractDefaultAnchors(referenceAnswer: string, questionText: string): string[] {
  if (!referenceAnswer || referenceAnswer.trim().length === 0) {
    return [
      'Понимание базового определения и терминологии',
      'Архитектурные компоненты и их назначение',
      'Практическое применение и примеры использования'
    ];
  }

  // Split by markdown lists, bullet points, newlines or semicolon
  const rawLines = referenceAnswer
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('```'));

  if (rawLines.length >= 2) {
    return rawLines.slice(0, 10);
  }

  // Fallback: split by sentences
  const sentences = referenceAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length >= 2) {
    return sentences.slice(0, 10);
  }

  return [referenceAnswer.slice(0, 120)];
}

export function buildSystemPrompt(params: {
  topic: string;
  questionText: string;
  referenceAnswer: string;
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  voiceName: string;
  maxProbes: number;
  anchors: string[];
  deepDive?: boolean;
  liveCoaching?: boolean;
  customPromptOverride?: string;
  questionIndex?: number;
  totalQuestions?: number;
}): string {
  const { topic, questionText, referenceAnswer, strategy, voiceName, maxProbes, anchors, deepDive, liveCoaching, customPromptOverride, questionIndex, totalQuestions } = params;

  const isFemale = ['Kore', 'Aoede'].includes(voiceName);
  const genderRule = isFemale
    ? 'ГРАММАТИЧЕСКИЙ РОД (СТРОГО ЖЕНСКИЙ): У тебя женский голос. Обязательно используй ЖЕНСКИЕ окончания в глаголах и формах от первого лица: «Я готова», «Я внимательно выслушала», «Я рада», «Я хотела бы уточнить». Категорически запрещено использовать мужские окончания («готов», «слушал», «рад»).'
    : 'ГРАММАТИЧЕСКИЙ РОД (СТРОГО МУЖСКОЙ): У тебя мужской голос. Обязательно используй МУЖСКИЕ окончания в глаголах и формах от первого лица: «Я готов», «Я внимательно выслушал», «Я рад», «Я хотел бы уточнить». Категорически запрещено использовать женские окончания («готова», «слушала», «рада»).';

  const batchContext = (totalQuestions && totalQuestions > 1)
    ? `=== КОНТЕКСТ СЕРИИ ВОПРОСОВ (HANDS-FREE MOCK INTERVIEW) ===
Ты проводишь серию вопросов (вопрос ${(questionIndex ?? 0) + 1} из ${totalQuestions}).
${((questionIndex ?? 0) + 1 < totalQuestions)
  ? 'В финале текущего ответа кратко подведи итог и вызови submit_interview_evaluation. НЕ прощайся окончательно, так как сразу последует следующий вопрос темы.'
  : 'Это заключительный вопрос серии. После вызова submit_interview_evaluation поблагодари за всё пройденное собеседование.'}
`
    : '';

  // Deep-dive & Scope modifier instructions
  const deepDiveInstruction = deepDive
    ? `=== РЕЖИМ ЗОНДИРОВАНИЯ: ГЛУБОКОЕ ЗОНДИРОВАНИЕ (DEEP-DIVE & UNDER-THE-HOOD) [ВКЛЮЧЕН] ===
Ты НЕ ограничен только формулировкой эталонного ответа. Твоя цель — исследовать реальную глубину знаний кандидата:
1. Если кандидат уверенно отвечает, копай глубже под капот (low-level механизмы, прокси, рефлексия, многопоточность, транзакции, память).
2. Задавай вопросы на краевые случаи (Edge Cases) и смежные концепции 1-го круга смежности (Radius-1: AOP, JDBC, Concurrency, Virtual Threads).
3. Проверяй понимание («А что произойдет, если...?», «Почему именно такой подход, а не альтернативный?»).
4. Правило возврата (Breadcrumb): не уходи глубже 2 шагов в одну подтему — кратко резюмируй и возвращайся к основному контексту вопроса темы.`
    : `=== РЕЖИМ ЗОНДИРОВАНИЯ: СТАНДАРТНЫЙ СКОУП (ПО ЭТАЛОНУ) ===
Твои ожидания и вопросы СТРОГО ограничены фактурой из ЭТАЛОННОГО ОТВЕТА. Не уходи в оффтоп и далекие смежные технологии, которых нет в эталоне.`;

  // Live Coaching modifier instructions
  const liveCoachingInstruction = liveCoaching
    ? `=== РЕЖИМ ОБУЧЕНИЯ: РАЗБОР ОШИБОК И ОБУЧЕНИЕ НА ЛЕТУ (LIVE COACHING) [ВКЛЮЧЕН] ===
Если кандидат допускает неточность, ошибку, говорит «Не знаю / не помню / подскажи / как правильно» или застрял:
1. Мягко поддержи и переключись в режим наставника.
2. Дай емкое, живое 30-секундное объяснение по правилу Micro-Lecture:
   - [Суть в 1 предложение]: ключевое определение простыми словами.
   - [Механизм под капотом]: как это физически устроено в рантайме.
   - [«Золотая фраза для собеседования»]: точная формулировка, которую ценят Senior-интервьюеры.
3. Запусти Active Recall (закрепление): сразу задай один мини-вопрос на понимание («Уловила суть? Попробуй теперь сформулировать, почему...?»).
4. В итоговой оценке (submit_interview_evaluation) обязательно отметь, что материал был успешно усвоен в процессе диалога.`
    : `=== РЕЖИМ ОЦЕНКИ: ВАЛИДАЦИЯ БЕЗ ПОДСКАЗОК ===
Не раскрывай готовых решений и эталонных ответов до момента завершения диалога.`;

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    return `${customPromptOverride.trim()}

${genderRule}

${deepDiveInstruction}

${liveCoachingInstruction}

[КОНТЕКСТ ВОПРОСА]
ВОПРОС: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer}

ЧЕК-ЛИСТ КРИТЕРИЕВ:
${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}

[ФИНАЛИЗАЦИЯ]
По окончании собеседования обязательно скажи краткое устное резюме и вызови функцию submit_interview_evaluation.`;
  }

  const anchorsFormatted = anchors.map((a, i) => `  [Критерий ${i + 1}] ${a}`).join('\n');

  if (strategy === 'socratic_tutoring') {
    return `=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты поддерживающий, доброжелательный и опытный ${isFemale ? 'ментор (женщина)' : 'ментор (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${liveCoachingInstruction}

=== 2. КОНТЕКСТНАЯ ФАКТУРА ТЕМЫ (CONTEXT PAYLOAD) ===
ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в разработке'}"

ЭТАЛОННЫЙ ОТВЕТ:
"""
${referenceAnswer || 'Точный и структурированный ответ с ключевыми концепциями.'}
"""

ЧЕК-ЛИСТ КЛЮЧЕВЫХ КРИТЕРИЕВ:
${anchorsFormatted}

=== 3. ОПЕРАЦИОННЫЙ СЦЕНАРИЙ ДИАЛОГА (EXECUTION RULES) ===
1. ПРИВЕТСТВИЕ: В самом начале сессии тепло поздоровайся одной фразой и четко зачитай вопрос темы.
2. ВНИМАТЕЛЬНОЕ СЛУШАНИЕ: Дай кандидату спокойно высказаться.
3. РЕАКЦИЯ НА МЕТА-РЕПЛИКИ:
   - Если кандидат говорит «Повтори вопрос», «Не расслышала» — вежливо и четко повтори вопрос.
   - Если кандидат просит помощи — следуй правилам режима Live Coaching выше.
4. СОКРАТИЧЕСКОЕ ЗОНДИРОВАНИЕ:
   - Если кандидат раскрыл только часть критериев — задай наводящий вопрос (лимит: не более ${maxProbes} раундов).
   - Если кандидат своими словами раскрыл суть — поблагодари за отличный ответ и переходи к финалу.
5. ФИНАЛИЗАЦИЯ И ОЦЕНКА:
   - Когда аспекты разобраны или кандидат завершил ответ:
     а) Произнеси теплое устное резюме (2-3 предложения) с похвалой и выделением зон роста.
     б) ОБЯЗАТЕЛЬНО вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
  }

  // Default: adaptive_probing (FAANG Standard Technical Assessment)
  return `=== 1. РОЛЬ, ИДЕНТИЧНОСТЬ И СТИЛЬ (TOP INVARIANTS) ===
Ты профессиональный, объективный и доброжелательный Senior/Lead технический ${isFemale ? 'интервьюер (женщина)' : 'интервьюер (мужчина)'} по теме «${topic}».
${genderRule}

${batchContext}

${deepDiveInstruction}

${liveCoachingInstruction}

=== 2. КОНТЕКСТНАЯ ФАКТУРА ТЕМЫ (CONTEXT PAYLOAD) ===
ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в backend-разработке'}"

ЭТАЛОННЫЙ ОТВЕТ:
"""
${referenceAnswer || 'Точный и структурированный ответ с ключевыми концепциями.'}
"""

ЧЕК-ЛИСТ КЛЮЧЕВЫХ КРИТЕРИЕВ:
${anchorsFormatted}

=== 3. ОПЕРАЦИОННЫЙ СЦЕНАРИЙ ДИАЛОГА (EXECUTION RULES) ===
1. ПРИВЕТСТВИЕ: В начале сессии кратко и вежливо поприветствуй кандидата и четко озвучь вопрос темы.
2. ЗОНДИРОВАНИЕ И FOLLOW-UP:
   - Внимательно сопоставляй ответ кандидата с критериями темы.
   - Задавай точечные вопросы по недостающим пунктам или углубляйся под капот (лимит раундов: до ${maxProbes}).
   - Если кандидат говорит «Не знаю / не помню» — при включенном Live Coaching помоги и объясни, иначе зафиксируй пробел и переходи дальше.
3. ФИНАЛИЗАЦИЯ И ВЕРДИКТ:
   - Когда ключевые вопросы обсуждены, исчерпан лимит ${maxProbes} раундов или кандидат завершил ответ:
     а) Произнеси четкое, тактичное устное резюме (2-3 предложения) с объективной оценкой.
     б) ОБЯЗАТЕЛЬНО вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
}

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientSocket: WebSocket, req: http.IncomingMessage) => {
    console.log('🎙️ Client connected to Live Audio WS Proxy');

    const parsedUrl = url.parse(req.url || '', true);
    const query = parsedUrl.query;

    const questionId = (query.questionId as string) || '';
    const topic = (query.topic as string) || 'Java & Spring Framework';
    const questionText = (query.questionText as string) || '';
    const referenceAnswer = (query.referenceAnswer as string) || '';
    const voiceName = (query.voice as string) || 'Kore';
    const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
    const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
    const deepDive = query.deepDive === 'true';
    const liveCoaching = query.liveCoaching === 'true';
    const customPromptOverride = (query.customPrompt as string) || '';
    const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
    const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);

    let customAnchors: string[] = [];
    if (query.customAnchors) {
      try {
        const parsed = JSON.parse(query.customAnchors as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customAnchors = parsed.slice(0, 10).map((a) => String(a).trim()).filter((a) => a.length > 0);
        }
      } catch {}
    }

    const anchors = customAnchors.length > 0 ? customAnchors : extractDefaultAnchors(referenceAnswer, questionText);

    const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
    const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
    
    const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-live';

    const cleanProxyWs = rawProxyUrl.replace(/^http/, 'ws').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl}) [Strategy: ${strategy}, Voice: ${voiceName}, Q: ${questionIndex + 1}/${totalQuestions}, Anchors: ${anchors.length}]...`);

    const geminiSocket = new WebSocket(upstreamWsUrl);

    const session: ProxySession = {
      clientSocket,
      geminiSocket,
      isSetupComplete: false,
      frameQueue: [],
      questionId,
      topic,
      referenceAnswer
    };

    const systemPromptText = buildSystemPrompt({
      topic,
      questionText,
      referenceAnswer,
      strategy,
      voiceName,
      maxProbes,
      anchors,
      deepDive,
      liveCoaching,
      customPromptOverride,
      questionIndex,
      totalQuestions
    });

    const setupMessage = {
      setup: {
        model: `models/${liveModel}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'].includes(voiceName) ? voiceName : 'Kore'
              }
            }
          },
          temperature: strategy === 'socratic_tutoring' ? 0.4 : 0.2
        },
        systemInstruction: {
          parts: [{ text: systemPromptText }]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'submit_interview_evaluation',
                description: 'Сохранить итоговую оценку, баллы и рекомендации по устному ответу кандидата',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    score: { type: 'NUMBER', description: 'Балл от 0 до 100' },
                    isPassed: { type: 'BOOLEAN', description: 'true если score >= 70, иначе false' },
                    positivePoints: {
                      type: 'ARRAY',
                      items: { type: 'STRING' },
                      description: 'Список того, что кандидат ответил точно и правильно'
                    },
                    missingPoints: {
                      type: 'ARRAY',
                      items: { type: 'STRING' },
                      description: 'Список важных терминов или концепций, которые кандидат упустил'
                    },
                    spokenFeedback: {
                      type: 'STRING',
                      description: 'Краткое текстовое резюме для озвучивания и карточки отчета'
                    }
                  },
                  required: ['score', 'isPassed', 'positivePoints', 'missingPoints', 'spokenFeedback']
                }
              }
            ]
          }
        ]
      }
    };

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const str = buffer.toString();
      let isToolCallProcessed = false;

      try {
        const parsed = JSON.parse(str);

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          console.log(`🎉 Upstream setupComplete received (Q ${questionIndex + 1}/${totalQuestions})! Sending greeting trigger and draining buffered frames...`);

          // Initial greeting turn with context bridge for subsequent questions
          const isSubsequent = questionIndex > 0;
          const greetingText = isSubsequent
            ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой-переходом подтверди прогресс и четко зачитай следующий технический вопрос: "${questionText || 'Следующий вопрос темы'}"`
            : `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`;

          const initialGreetingTurn = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: greetingText
                    }
                  ]
                }
              ],
              turnComplete: true
            }
          };

          if (geminiSocket.readyState === WebSocket.OPEN) {
            geminiSocket.send(JSON.stringify(initialGreetingTurn));
          }

          // Drain queued frames
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
          }

          // Notify client
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'setupComplete' }));
          }
        }

        // Handle Function Calling / toolCall
        if (parsed.toolCall?.functionCalls) {
          console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(parsed.toolCall.functionCalls));

          for (const call of parsed.toolCall.functionCalls) {
            if (call.name === 'submit_interview_evaluation') {
              isToolCallProcessed = true;
              const args = call.args || {};
              const score = typeof args.score === 'number' ? args.score : 75;
              const isPassed = args.isPassed ?? (score >= 70);
              const positivePoints = Array.isArray(args.positivePoints) ? args.positivePoints : [];
              const missingPoints = Array.isArray(args.missingPoints) ? args.missingPoints : [];
              const feedback = args.spokenFeedback || args.feedback || 'Ответ принят.';

              let savedEvalId = '';
              if (session.questionId) {
                try {
                  savedEvalId = crypto.randomBytes(16).toString('hex');
                  const stmt = db.prepare(`
                    INSERT INTO question_evaluations (
                      id, question_id, topic, mode, score, is_passed,
                      positive_points, missing_points, feedback, user_answer,
                      transcript, audio_metrics, created_at, updated_at
                    ) VALUES (
                      @id, @question_id, @topic, @mode, @score, @is_passed,
                      @positive_points, @missing_points, @feedback, @user_answer,
                      @transcript, @audio_metrics, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                  `);

                  stmt.run({
                    id: savedEvalId,
                    question_id: session.questionId,
                    topic: session.topic || 'General',
                    mode: 'voice',
                    score,
                    is_passed: isPassed ? 1 : 0,
                    positive_points: JSON.stringify(positivePoints),
                    missing_points: JSON.stringify(missingPoints),
                    feedback,
                    user_answer: 'Устный ответ в Gemini Live',
                    transcript: '',
                    audio_metrics: null
                  });
                  console.log(`💾 Live evaluation saved to DB: ${savedEvalId} (Score: ${score})`);
                } catch (dbErr) {
                  console.error('Error saving Live evaluation to DB:', dbErr);
                }
              }

              // Send toolResponse back to Gemini Live
              const toolResponse = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: call.name,
                      response: {
                        status: 'COMMITTED',
                        evaluationId: savedEvalId,
                        message: 'Оценка сохранена.'
                      }
                    }
                  ]
                }
              };

              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(toolResponse));
              }

              // Notify frontend client with evaluation data
              if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({
                  type: 'evaluation_completed',
                  evaluation: {
                    id: savedEvalId,
                    score,
                    isPassed,
                    positivePoints,
                    missingPoints,
                    feedback,
                    spokenFeedback: feedback
                  }
                }));
              }

              // Close upstream Gemini WS to prevent any further AI speech/repetition after verdict
              console.log('🔒 Evaluation delivered. Closing upstream Gemini WS to stop further AI speech.');
              try {
                if (geminiSocket.readyState === WebSocket.OPEN) {
                  geminiSocket.close(1000, 'Evaluation finalized');
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        // Non-JSON or binary pass-through
      }

      // Forward everything upstream -> client as Text JSON (avoid double forwarding raw toolCall)
      if (!isToolCallProcessed && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    });

    clientSocket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      if (!session.isSetupComplete) {
        try {
          const text = buffer.toString();
          const parsed = JSON.parse(text);
          if (parsed.setup) {
            // Client sent setup, forward
            if (geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(buffer);
            }
            return;
          }
        } catch {}

        // Buffer audio or turns while waiting for setupComplete
        session.frameQueue.push(buffer);
      } else {
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(buffer);
        }
      }
    });

    const terminate = () => {
      session.frameQueue = [];
      if (geminiSocket.readyState === WebSocket.OPEN || geminiSocket.readyState === WebSocket.CONNECTING) {
        geminiSocket.close();
      }
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close();
      }
    };

    clientSocket.on('close', terminate);
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      terminate();
    });

    geminiSocket.on('close', () => {
      console.log('Gemini Live upstream connection closed');
      terminate();
    });

    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: `Ошибка голосового шлюза: ${err.message}` }));
      }
      terminate();
    });
  });
}
