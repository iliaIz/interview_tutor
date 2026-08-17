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
  maxProbes: number;
  anchors: string[];
  customPromptOverride?: string;
}): string {
  const { topic, questionText, referenceAnswer, strategy, maxProbes, anchors, customPromptOverride } = params;

  if (customPromptOverride && customPromptOverride.trim().length > 20) {
    return `${customPromptOverride.trim()}

ВОПРОС ТЕМЫ: "${questionText}"
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer}

ЧЕК-ЛИСТ КРИТЕРИЕВ (ЯКОРЯ):
${anchors.map((a, i) => `[${i + 1}] ${a}`).join('\n')}

ВАЖНО: По окончании собеседования обязательно вызови submit_interview_evaluation.`;
  }

  const anchorsFormatted = anchors.map((a, i) => `  [Якорь ${i + 1}] ${a}`).join('\n');

  if (strategy === 'socratic_tutoring') {
    return `Ты поддерживающий, доброжелательный и опытный ментор по ${topic}.
ТВОЯ ЦЕЛЬ: Помочь кандидату глубоко и осознанно раскрыть техническую тему через поддерживающий Сократический диалог.

ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в разработке'}"

ЧЕК-ЛИСТ КРИТЕРИЕВ ТЕМЫ (до 10 ключевых якорей):
${anchorsFormatted}

ПРАВИЛА И СЦЕНАРИЙ ДИАЛОГА (Сократический менторинг):
1. ПРИВЕТСТВИЕ: В самом начале сессии тепло поздоровайся и четко зачитай вопрос темы.
2. ВНИМАТЕЛЬНОЕ СЛУШАНИЕ: Дай кандидату высказать свои мысли.
3. РЕАКЦИЯ НА МЕТА-ВОПРОСЫ:
   - Если кандидат говорит «Повтори вопрос», «Не расслышала» — вежливо и четко повтори вопрос.
   - Если кандидат говорит «Подскажи», «Я забыла», «Не знаю» — похвали за честность, приведи простую наглядную аналогию из практики и задай наводящий вопрос.
4. ПОШАГОВОЕ РАСКРЫТИЕ:
   - Отслеживай покрытие критериев [Якорь 1..N].
   - Если кандидат раскрыл часть темы, похвали и задай наводящий вопрос по смежному упущенному якорю (лимит уточнений: до ${maxProbes} раундов).
5. ФИНАЛИЗАЦИЯ:
   - Когда все ключевые аспекты разобраны или кандидат скажет «Я всё / подведем итог» (либо нажмет кнопку в интерфейсе):
     а) Произнеси теплое устное резюме с похвалой и выделением зон роста.
     б) ОБЯЗАТЕЛЬНО вызови функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;
  }

  // Default: adaptive_probing (FAANG Standard Technical Assessment)
  return `Ты профессиональный, объективный и доброжелательный Senior/Lead технический интервьюер по ${topic}.
ТВОЯ ЦЕЛЬ: Точно и непредвзято оценить реальную глубину знаний кандидата через метод адаптивного технического зондирования (Adaptive Competency Probing).

ВОПРОС ТЕМЫ: "${questionText || 'Расскажите о вашем опыте в backend-разработке'}"

ЧЕК-ЛИСТ КРИТЕРИЕВ ТЕМЫ (до 10 ключевых якорей для оценки):
${anchorsFormatted}

ЭТАЛОННАЯ СУТЬ ОТВЕТА:
${referenceAnswer || 'Точный и структурированный ответ с ключевыми концепциями.'}

ПРАВИЛА И СЦЕНАРИЙ ДИАЛОГА (Адаптивное зондирование):
1. ПРИВЕТСТВИЕ: В начале сессии кратко и вежливо поприветствуй кандидата и четко озвучь вопрос темы.
2. ВАЛИДАЦИЯ ЗНАНИЙ БЕЗ ПОДСКАЗОК:
   - Не подсказывай ответ и не веди за руку. Твоя задача — проверить самостоятельные знания кандидата.
   - Если кандидат просит «Повтори вопрос», «Уточни формулировку» — вежливо и четко повтори вопрос и уточни контекст, не раскрывая решения.
3. ОЦЕНКА ПОКРЫТИЯ ЯКОРЕЙ И ЗОНДИРОВАНИЕ:
   - Внимательно слушай кандидата и сопоставляй с чек-листом [Якорь 1..N].
   - Если кандидат ответил глубоко и исчерпывающе — поблагодари за отличный ответ и переходи к финалу.
   - Если кандидат затронул тему поверхностно или упустил важный якорь, а лимит раундов (максимум ${maxProbes}) не исчерпан — задай **ровно один** точечный углубляющий вопрос по нераскрытому аспекту (например, «А как это устроено на уровне памяти?» или «Что произойдет при отказе узла?»).
   - Если кандидат говорит «Не знаю / не помню» — не мучай кандидата, зафиксируй пробел и мягко переходи к следующему аспекту либо к итогу.
4. ФИНАЛИЗАЦИЯ И ВЕРДИКТ:
   - Когда ключевые вопросы обсуждены, либо исчерпан лимит ${maxProbes} уточнений, либо кандидат нажал кнопку «Завершить ответ и получить оценку» в интерфейсе:
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
    const customPromptOverride = (query.customPrompt as string) || '';

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
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl}) [Strategy: ${strategy}, Voice: ${voiceName}, Anchors: ${anchors.length}]...`);

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
      maxProbes,
      anchors,
      customPromptOverride
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

      try {
        const parsed = JSON.parse(str);

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          console.log('🎉 Upstream setupComplete received! Sending greeting trigger and draining buffered frames...');

          // Initial greeting turn
          const initialGreetingTurn = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`
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
                        message: 'Оценка успешно сохранена в базе знаний.'
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
                    feedback
                  }
                }));
              }
            }
          }
        }
      } catch (e) {
        // Non-JSON or binary pass-through
      }

      // Forward everything upstream -> client as Text JSON
      if (clientSocket.readyState === WebSocket.OPEN) {
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
