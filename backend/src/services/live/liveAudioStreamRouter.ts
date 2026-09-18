import { WebSocket, RawData } from 'ws';
import { ProxySession, toRawBuffer } from './liveSessionTypes';
import { liveSessionRegistry, getOrCreateSessionMemory } from './liveSessionRegistry';
import { handleLiveToolCall } from './liveToolDispatcher';
import { getChallengeDomain } from '../../utils/challengeDomain';

export interface StreamRouterOptions {
  session: ProxySession;
  setupMessage: any;
  upstreamWsUrl: string;
  clientSocket: WebSocket;
  terminate: (source: string, code?: number, reason?: Buffer) => void;
  sessionId: string;
  questionId: string;
  sessionType: 'interview' | 'tutor' | 'system_design';
  tutorMode: string;
  bugTitle: string;
  questionText: string;
  topic: string;
  voiceName: string;
  isRetry: boolean;
  isResumed: boolean;
  initialUserMessage: string;
  totalQuestions: number;
  questionIndex: number;
  parsedHints: string[];
  liveCoaching: boolean;
  liveModel: string;
  challengeCategory?: string;
  challengeTrack?: string;
}

export function createLiveAudioStreamRouter(options: StreamRouterOptions) {
  const {
    session,
    setupMessage,
    upstreamWsUrl,
    clientSocket,
    terminate,
    sessionId,
    questionId,
    sessionType,
    tutorMode,
    bugTitle,
    questionText,
    topic,
    voiceName,
    isRetry,
    isResumed,
    initialUserMessage,
    totalQuestions,
    questionIndex,
    parsedHints,
    liveCoaching,
    liveModel,
    challengeCategory = '',
    challengeTrack = ''
  } = options;

  const isNonRetryableUpstreamError = (text?: string, code?: number): boolean => {
    if (code === 1008 || code === 4001 || code === 4003 || code === 4403) return true;
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('forbidden') ||
      lower.includes('invalid or blocked virtual key') ||
      lower.includes('unauthorized') ||
      lower.includes('not allowed') ||
      lower.includes('no active models or api keys') ||
      lower.includes('thinking level must be specified')
    );
  };

  const handleGeminiDisconnect = (source: string, code?: number, reason?: Buffer) => {
    if (session.isTerminated) return;
    session.isAiGenerating = false;
    const reasonStr = reason ? reason.toString() : '';
    console.warn(`⚠️ Upstream Gemini Live WS disconnected [${source}], code=${code}, reason=${reasonStr || 'none'}`);

    const isNonRetryable = session.hasTerminalError || isNonRetryableUpstreamError(reasonStr, code);

    if (isNonRetryable) {
      console.error(`🛑 Upstream Gemini Live encountered non-retryable error [${source}, code=${code}]. Halting session without reconnect.`);
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({
            error: reasonStr || 'Голосовой шлюз отклонил подключение модели (Forbidden / Config Error).',
            errorCode: session.terminalErrorCode || 'FORBIDDEN_MODEL_ACCESS',
            retryable: false,
            suggestedFallbackModel: 'gemini-live-v3'
          }));
        } catch {}
      }
      terminate(source, code, reason);
      return;
    }

    if (clientSocket.readyState === WebSocket.OPEN) {
      if ((session.reconnectAttempts || 0) < 3) {
        session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
        session.isUpstreamReconnecting = true;
        session.isSetupComplete = false;
        console.log(`🔄 Performing Upstream Hot Reconnect (attempt ${session.reconnectAttempts}/3) for session ${session.sessionId}...`);

        try {
          clientSocket.send(JSON.stringify({
            type: 'upstream_reconnecting',
            attempt: session.reconnectAttempts,
            maxAttempts: 3
          }));
        } catch {}

        const backoffDelay = (session.reconnectAttempts - 1) * 400; // 0ms, 400ms, 800ms
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        session.reconnectTimer = setTimeout(() => {
          if (!session.isTerminated && clientSocket.readyState === WebSocket.OPEN) {
            connectGemini(true);
          }
        }, backoffDelay);
        return;
      } else {
        console.error(`❌ Upstream Hot Reconnect attempts exhausted (3/3) for session ${session.sessionId}. Terminating session.`);
        try {
          clientSocket.send(JSON.stringify({
            error: 'Голосовой шлюз временно недоступен после повторных попыток переподключения.',
            errorCode: 'RECONNECT_ATTEMPTS_EXHAUSTED',
            retryable: false
          }));
        } catch {}
      }
    }

    terminate(source, code, reason);
  };

  const connectGemini = (isInternalReconnect = false) => {
    if (session.isTerminated || clientSocket.readyState !== WebSocket.OPEN) return;

    console.log(`⚡ ${isInternalReconnect ? 'Reconnecting' : 'Connecting'} to Upstream Gemini Live WS (${upstreamWsUrl}) [Session: ${sessionId || 'anon'}, Type: ${sessionType}, Mode: ${tutorMode}, Voice: ${voiceName}, isRetry: ${isRetry}, isResumed: ${isResumed}]...`);

    if (session.geminiSocket) {
      try {
        session.geminiSocket.removeAllListeners();
        if (session.geminiSocket.readyState === WebSocket.OPEN || session.geminiSocket.readyState === WebSocket.CONNECTING) {
          session.geminiSocket.close();
        }
      } catch {}
    }

    const geminiSocket = new WebSocket(upstreamWsUrl);
    session.geminiSocket = geminiSocket;

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('close', (code, reason) => {
      handleGeminiDisconnect('GeminiUpstreamClose', code, reason);
    });

    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      handleGeminiDisconnect('GeminiUpstreamError');
    });

    geminiSocket.on('message', async (data: RawData) => {
      const buffer = toRawBuffer(data);
      const str = buffer.toString('utf8');
      let isToolCallProcessed = false;
      let parsed: any = null;

      try {
        parsed = JSON.parse(str);

        // Intercept upstream error payload from LiteLLM / Gemini Gateway
        if (parsed.error) {
          const errString = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
          console.error(`❌ Upstream Gemini Live emitted error frame: ${errString}`);

          if (isNonRetryableUpstreamError(errString)) {
            session.hasTerminalError = true;
            const isForbidden = errString.toLowerCase().includes('forbidden') || errString.toLowerCase().includes('virtual key');
            session.terminalErrorCode = isForbidden ? 'FORBIDDEN_MODEL_ACCESS' : 'UPSTREAM_CONFIGURATION_ERROR';

            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({
                error: errString,
                errorCode: session.terminalErrorCode,
                retryable: false,
                suggestedFallbackModel: 'gemini-live-v3'
              }));
            }
            return;
          }
        }

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          const wasReconnecting = session.isUpstreamReconnecting;
          session.isUpstreamReconnecting = false;
          session.reconnectAttempts = 0;
          console.log(`🎉 Upstream setupComplete received (Type: ${sessionType}, isResumed: ${isResumed}, wasReconnecting: ${wasReconnecting}, sessionId: ${session.sessionId || 'none'})!`);

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
                            text: '[ТЕХНИЧЕСКАЯ СИНХРОНИЗАЦИЯ СВЯЗИ]: Закончи свою предыдущую мысль одной короткой фразой (1 предложение) и передай слово кандидату.'
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
                greetingText = `Мы пробуем ответить на технический вопрос темы заново с чистого листа: "${questionText || 'Вопрос темы'}". Коротко подбодри одной фразой и четко задай этот вопрос.`;
              } else {
                greetingText = isSubsequent
                  ? `Мы продолжаем собеседование (вопрос ${questionIndex + 1} из ${totalQuestions}). Короткой живой фразой-переходом подтверди прогресс и четко зачитай следующий технический вопрос: "${questionText || 'Следующий вопрос темы'}"`
                  : `Привет! Я готова к собеседованию. Поприветствуй меня одной фразой и четко зачитай технический вопрос: "${questionText || 'Расскажи о себе и опыте в Java'}"`;
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

            if (geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(JSON.stringify(initialGreetingTurn));
            }

            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(JSON.stringify({
                type: 'setupComplete',
                hasInitialUserMessage: !!initialUserMessage
              }));
            }
          }

          // Drain queued frames
          while (session.frameQueue.length > 0) {
            const frame = session.frameQueue.shift();
            if (frame && geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(frame);
            }
          }
        }

        // Model Turn Text accumulation and watchdog clearing
        if (parsed.serverContent?.modelTurn) {
          session.isAiGenerating = true;
          session.isToolCallPending = false;
          if (session.toolCallSafetyTimeout) {
            clearTimeout(session.toolCallSafetyTimeout);
            session.toolCallSafetyTimeout = null;
          }
          session.lastActivityAt = Date.now();
          session.probesCount = (session.probesCount || 0) + 1;
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }

          if (parsed.serverContent.modelTurn.parts) {
            const hasPcm = parsed.serverContent.modelTurn.parts.some((p: any) => p.inlineData || p.inline_data);
            if (hasPcm && !session.firstAudioChunkLogged) {
              session.firstAudioChunkLogged = true;
              const ttft = session.lastTurnCommitTime ? Date.now() - session.lastTurnCommitTime : 0;
              console.log(`🔊 [MODEL_FIRST_AUDIO] Upstream Gemini emitted first audio chunk (TTFT: ~${ttft}ms, session: ${session.sessionId || 'anon'})`);
            }

            for (const part of parsed.serverContent.modelTurn.parts) {
              if (part.text) {
                session.currentAiTurnText = (session.currentAiTurnText || '') + part.text;
              }
            }
          }
        }

        // AI finished generating turn: commit to session turn history
        if (parsed.serverContent?.turnComplete) {
          const isInteractionIdle = !parsed.serverContent.interactionStatus || parsed.serverContent.interactionStatus === 'IDLE';
          if (isInteractionIdle) {
            console.log(`🏁 [MODEL_TURN_COMPLETE] Upstream Gemini terminal turn generation complete (session: ${session.sessionId || 'anon'})`);
            session.isAiGenerating = false;
            session.firstAudioChunkLogged = false;
            session.isToolCallPending = false;
            if (session.toolCallSafetyTimeout) {
              clearTimeout(session.toolCallSafetyTimeout);
              session.toolCallSafetyTimeout = null;
            }
            if (session.currentAiTurnText && session.sessionId) {
              const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
              mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
              mem.lastSpeaker = 'model';
              mem.updatedAt = Date.now();
              session.currentAiTurnText = '';
            }
          } else {
            console.log(`⏳ [MODEL_FILLER_COMPLETE] Utterance chunk complete, but interactionStatus=${parsed.serverContent.interactionStatus} (session: ${session.sessionId || 'anon'}). Waiting for terminal answer...`);
          }
        }

        // Barge-in interruption during AI speech
        if (parsed.serverContent?.interrupted) {
          session.isAiGenerating = false;
          session.isToolCallPending = false;
          if (session.toolCallSafetyTimeout) {
            clearTimeout(session.toolCallSafetyTimeout);
            session.toolCallSafetyTimeout = null;
          }
          if (session.sessionId) {
            const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
            if (session.currentAiTurnText) {
              mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
              session.currentAiTurnText = '';
            }
            mem.lastSpeaker = 'user';
            mem.updatedAt = Date.now();
          }
        }

        // Handle toolCallCancellation
        if (parsed.toolCallCancellation?.ids) {
          console.log('🚫 [TOOL_CALL_CANCELLED] Upstream Gemini cancelled tool calls:', parsed.toolCallCancellation.ids);
          session.isToolCallPending = false;
          if (session.toolCallSafetyTimeout) {
            clearTimeout(session.toolCallSafetyTimeout);
            session.toolCallSafetyTimeout = null;
          }
        }

        // Handle Function Calling / toolCall
        if (parsed.toolCall?.functionCalls) {
          isToolCallProcessed = true;
          session.isToolCallPending = true;
          session.lastActivityAt = Date.now();
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }
          console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(parsed.toolCall.functionCalls));

          if (session.toolCallSafetyTimeout) clearTimeout(session.toolCallSafetyTimeout);
          session.toolCallSafetyTimeout = setTimeout(() => {
            if (session.isToolCallPending) {
              console.warn('⚠️ Tool call safety timeout (10s) reached: releasing audio gate');
              session.isToolCallPending = false;
            }
          }, 10000);

          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({
              type: 'tool_executing',
              tools: parsed.toolCall.functionCalls.map((fc: any) => fc.name)
            }));
          }

          try {
            for (const call of parsed.toolCall.functionCalls) {
              if (call.name === 'update_whiteboard') {
                const callKey = JSON.stringify(call.args || {});
                const now = Date.now();
                if (session.lastToolCallHash === callKey && now - (session.lastToolCallTime || 0) < 3000) {
                  console.log('🔄 Suppressing duplicate update_whiteboard call within 3s');
                  if (geminiSocket.readyState === WebSocket.OPEN) {
                    geminiSocket.send(JSON.stringify({
                      toolResponse: {
                        functionResponses: [
                          {
                            id: call.id,
                            name: call.name,
                            response: {
                              result: {
                                status: 'SUCCESS',
                                message: 'Интерактивная доска уже обновлена.',
                                directive: 'Кратко (в 1-2 предложениях) поясни кандидату голосом показанный фрагмент. Не вызывай повторных инструментов.'
                              }
                            }
                          }
                        ]
                      }
                    }));
                  }
                  continue;
                }
                session.lastToolCallHash = callKey;
                session.lastToolCallTime = now;
              }

              try {
                const isHandled = await handleLiveToolCall({
                  call,
                  clientSocket,
                  geminiSocket,
                  session,
                  parsedHints,
                  liveCoaching
                });

                if (!isHandled) {
                  console.warn(`⚠️ Unhandled or unsupported tool call [${call.name}]. Emitting graceful negative toolResponse to prevent Gemini Bidi hang.`);
                  if (geminiSocket.readyState === WebSocket.OPEN) {
                    geminiSocket.send(JSON.stringify({
                      toolResponse: {
                        functionResponses: [
                          {
                            id: call.id,
                            name: call.name,
                            response: {
                              result: {
                                error: `Tool '${call.name}' is not supported in this session. You do not have access to server execution, bash, or external networks. Please explain verbally or use update_whiteboard.`
                              }
                            }
                          }
                        ]
                      }
                    }));
                  }
                }
              } catch (toolErr) {
                const errorMessage = toolErr instanceof Error ? toolErr.message : 'Internal error';
                console.error(`❌ Error executing tool ${call.name}:`, toolErr);
                if (geminiSocket.readyState === WebSocket.OPEN) {
                  geminiSocket.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            result: {
                              error: `Tool execution failed: ${errorMessage}`
                            }
                          }
                        }
                      ]
                    }
                  }));
                }
              }
            }
          } finally {
            // SOTA 2026 Invariant: Do NOT release session.isToolCallPending here!
            // Dispatching toolResponse JSON to Gemini initiates the post-tool verbal response phase.
            // Releasing the audio gate prematurely allows client mic PCM chunks to flood geminiSocket
            // while Gemini processes the tool response, triggering upstream timeout crashes.
            // session.isToolCallPending is symmetrically released when serverContent.turnComplete: true arrives,
            // or upon client barge-in / cancellation / 10s safety timeout.
          }
        }
      } catch {}

      const shouldForwardToClient = !isToolCallProcessed || Boolean(parsed?.serverContent);
      if (shouldForwardToClient && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(str);
      }
    });
  };

  return {
    connectGemini
  };
}
