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

    const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
    const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
    const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-tts-live-v3';

    const cleanProxyWs = rawProxyUrl.replace(/^http/, 'ws').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl})...`);

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

    const systemPromptText = `Ты профессиональный, доброжелательный и строгий технический интервьюер по ${topic}.
Твоя задача:
1. Зачитать кандидату технический вопрос: "${questionText || 'Расскажите о вашем опыте в backend-разработке'}".
2. Внимательно выслушать устный ответ кандидата.
3. При необходимости задать один короткий уточняющий вопрос.
4. Оценивать ответ объективно, сравнивая его с эталоном:
ЭТАЛОННЫЙ ОТВЕТ:
${referenceAnswer || 'Полный и точный ответ с ключевыми терминами и архитектурными деталями.'}

5. КРИТИЧЕСКИ ВАЖНО: Когда кандидат закончит свой ответ (или скажет, что готов к оценке), ОБЯЗАТЕЛЬНО:
   а) Озвучь краткое (2-3 предложения) ободряющее или корректирующее резюме голосом.
   б) ВЫЗОВИ функцию \`submit_interview_evaluation\` со структурированными оценками (score от 0 до 100, isPassed: score >= 70, positivePoints, missingPoints, spokenFeedback).`;

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
          temperature: 0.3
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
      if (!isBinary) {
        try {
          const str = data.toString();
          const parsed = JSON.parse(str);

          // Handle setupComplete
          if (parsed.setupComplete) {
            session.isSetupComplete = true;
            console.log('🎉 Upstream setupComplete received! Draining buffered frames...');

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
                const score = Math.round(Number(args.score || 70));
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
          // Pass-through
        }
      }

      // Forward everything upstream -> client
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(data, { binary: isBinary });
      }
    });

    clientSocket.on('message', (data: RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      if (!session.isSetupComplete) {
        try {
          const text = buffer.toString();
          const parsed = JSON.parse(text);
          if (parsed.setup) {
            // Client sent setup, forward to trigger
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
      console.error('Gemini WS error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ error: 'Gemini Live WS error: ' + err.message }));
      }
      terminate();
    });
  });

  console.log('📡 Gemini Live WebSocket Proxy registered at /ws/live with FIFO queue & Tool Calling');
}
