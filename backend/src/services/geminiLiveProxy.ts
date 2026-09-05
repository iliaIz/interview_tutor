import { WebSocket, WebSocketServer, RawData } from 'ws';
import http from 'http';
import url from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';
import { updateBugChallengeStatus } from './tutorService';
import {
  findRelevantCandidateGaps,
  applyKnowledgeDecay,
  recordNewErrorGap,
  getUserProfile,
  CandidateGap
} from './vectorMemoryService';
import { authService } from './authService';
import { parseCookies } from '../middleware/auth';
import { recordEvaluationAndSyncProgress } from './progressService';

import {
  InterviewPersonaId,
  TargetGrade,
  getPersonaPromptDirectives,
  calculateFaangScorecard
} from '../prompts/personas';

import {
  LiveTurn,
  LiveSessionMemory,
  liveSessionRegistry,
  getOrCreateSessionMemory
} from './live/liveSessionRegistry';
import {
  extractDefaultAnchors,
  buildSystemPrompt
} from './live/livePromptBuilder';
import { getLiveToolDeclarations } from './live/liveToolDeclarations';
import { handleLiveToolCall } from './live/liveToolDispatcher';

export {
  LiveTurn,
  LiveSessionMemory,
  liveSessionRegistry,
  getOrCreateSessionMemory,
  extractDefaultAnchors,
  buildSystemPrompt,
  getLiveToolDeclarations,
  handleLiveToolCall
};

dotenv.config();

function toRawBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

interface ProxySession {
  clientSocket: WebSocket;
  geminiSocket: WebSocket;
  isSetupComplete: boolean;
  frameQueue: Buffer[];
  sessionId?: string;
  questionId?: string;
  userId?: string;
  topic?: string;
  referenceAnswer?: string;
  relevantGapIds?: string[];
  probesCount?: number;
  isRetry?: boolean;
  hasCandidateResponded?: boolean;
  isOnHold?: boolean;
  lastActivityAt: number;
  heartbeatInterval?: NodeJS.Timeout | null;
  nudgeWatchdog?: NodeJS.Timeout | null;
  currentAiTurnText?: string;
  persona?: InterviewPersonaId;
  targetGrade?: TargetGrade;
  isToolCallPending?: boolean;
  sessionType?: 'interview' | 'tutor' | 'system_design';
  currentArchitectureMermaid?: string;
  currentGraphIr?: string;
}

export function setupLiveWebSocketProxy(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', async (clientSocket: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '', true);
    const query = parsedUrl.query;

    // Zero-Trust WebSocket Auth Verification (Ticket or HttpOnly Cookie)
    const ticket = (query.ticket as string) || '';
    let authenticatedUser: any = null;

    if (ticket) {
      const ticketResult = authService.verifyAndConsumeWsTicket(ticket);
      if (ticketResult) {
        authenticatedUser = ticketResult.user;
      }
    }

    if (!authenticatedUser) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies['session_token'];
      if (sessionToken) {
        const sessionResult = authService.validateSession(sessionToken);
        if (sessionResult) {
          authenticatedUser = sessionResult.user;
        }
      }
    }

    if (!authenticatedUser) {
      console.warn('⛔ Unauthorized WebSocket connection attempt rejected.');
      clientSocket.close(4401, 'Unauthorized: Valid ticket or invite session required');
      return;
    }

    const rawSessionType = (query.sessionType as string) || '';
    const sessionType = (
      rawSessionType === 'tutor'
        ? 'tutor'
        : rawSessionType === 'system_design'
          ? 'system_design'
          : 'interview'
    ) as 'interview' | 'tutor' | 'system_design';

    const tutorMode = (query.tutorMode as any) || 'deep_dive';
    const bugTitle = (query.bugTitle as string) || '';
    const bugExplanation = (query.bugExplanation as string) || '';
    const codeSnippet = (query.codeSnippet as string) || '';
    let parsedHints: string[] = [];
    if (query.hints) {
      try {
        const h = JSON.parse(query.hints as string);
        if (Array.isArray(h)) parsedHints = h.map(String);
      } catch {}
    }

    const sessionId = (query.sessionId as string) || '';
    const questionId = (query.questionId as string) || '';
    const topic = (query.topic as string) || 'Java & Spring Framework';
    const questionText = (query.questionText as string) || '';
    const referenceAnswer = (query.referenceAnswer as string) || '';
    const voiceName = (query.voice as string) || 'Kore';
    const userGender = ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female') as 'female' | 'male' | 'neutral';
    const turnMode = ((query.turnMode as string) === 'auto' ? 'auto' : 'manual') as 'manual' | 'auto';
    const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
    const persona = ((query.persona as string) || 'mentor') as InterviewPersonaId;
    const targetGrade = ((query.targetGrade as string) || 'L5_SENIOR') as TargetGrade;
    const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
    const deepDive = query.deepDive === 'true';
    const liveCoaching = query.liveCoaching === 'true';
    const customPromptOverride = (query.customPrompt as string) || '';
    const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
    const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);
    const isRetry = query.isRetry === 'true';
    const isResumed = query.isResumed === 'true';
    const initialProbesCount = Math.max(0, parseInt((query.probesCount as string) || '0', 10) || 0);
    const initialUserMessage = ((query.initialUserMessage as string) || '').trim();

    let activeCodeArtifact: any = null;
    if (query.activeCodeArtifact) {
      try {
        activeCodeArtifact = JSON.parse(query.activeCodeArtifact as string);
      } catch {}
    }

    let codeRevisionsSummary: any = null;
    if (query.codeRevisionsSummary) {
      try {
        codeRevisionsSummary = JSON.parse(query.codeRevisionsSummary as string);
      } catch {}
    }

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

    // Pre-warmed retrieval of candidate gaps & profile (< 5ms)
    let candidateGaps: CandidateGap[] = [];
    try {
      candidateGaps = await findRelevantCandidateGaps(questionText || bugTitle || topic, topic, questionId);
      if (candidateGaps.length > 0) {
        console.log(`🧠 Injected ${candidateGaps.length} relevant vector gaps into Live prompt for "${topic}"`);
      }
    } catch (gapErr) {
      console.warn('Could not pre-warm candidate gaps:', gapErr);
    }

    const userProfile = getUserProfile();
    const relevantGapIds = candidateGaps.map((g) => g.id);

    const proxyApiKey = envConfig.proxy.apiKey;
    const requestedModel = (query.liveModel as string) || '';
    const isSupported = envConfig.models.supportedLiveModels.includes(requestedModel);
    const liveModel = isSupported ? requestedModel : envConfig.models.live;
    if (requestedModel && !isSupported) {
      console.warn(`⚠️ Requested Live model "${requestedModel}" is not in supported list [${envConfig.models.supportedLiveModels.join(', ')}]. Falling back to default "${envConfig.models.live}".`);
    }

    const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
    const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}`;
    console.log(`⚡ Connecting to Upstream Gemini Live WS (${upstreamWsUrl}) [Session: ${sessionId || 'anon'}, Type: ${sessionType}, Mode: ${tutorMode}, Voice: ${voiceName}, Gender: ${userGender}, TurnMode: ${turnMode}, isRetry: ${isRetry}, isResumed: ${isResumed}]...`);

    const geminiSocket = new WebSocket(upstreamWsUrl);

    const session: ProxySession = {
      clientSocket,
      geminiSocket,
      isSetupComplete: false,
      frameQueue: [],
      sessionId,
      questionId,
      userId: authenticatedUser.id || 'default_user',
      topic,
      referenceAnswer,
      relevantGapIds,
      probesCount: isResumed ? initialProbesCount : 0,
      isRetry,
      hasCandidateResponded: isResumed, // Resumed session already has previous candidate speech
      isOnHold: false,
      lastActivityAt: Date.now(),
      heartbeatInterval: null,
      nudgeWatchdog: null,
      currentAiTurnText: '',
      persona,
      targetGrade,
      isToolCallPending: false,
      sessionType
    };

    // WebSocket Keepalive Heartbeat (every 15s)
    session.heartbeatInterval = setInterval(() => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
      // Adaptive Keepalive: In Hold mode or manual mode allow reflection up to 30 min (1800s); in auto-vad 180s (3 min)
      const inactivityLimitMs = (session.isOnHold || turnMode === 'manual') ? 1800000 : 180000;
      if (Date.now() - session.lastActivityAt > inactivityLimitMs) {
        console.warn(`⚠️ Session inactive for >${inactivityLimitMs / 1000}s. Terminating keepalive expired socket.`);
        terminate('KeepaliveTimeout');
      }
    }, 15000);

    const systemPromptText = buildSystemPrompt({
      topic,
      questionText,
      referenceAnswer,
      strategy,
      voiceName,
      userGender,
      turnMode,
      maxProbes,
      anchors,
      deepDive,
      liveCoaching,
      customPromptOverride,
      questionIndex,
      totalQuestions,
      sessionType,
      tutorMode,
      bugTitle,
      bugExplanation,
      codeSnippet,
      hints: parsedHints,
      targetSeniority: userProfile.targetSeniority,
      primaryStack: userProfile.primaryStack,
      candidateGaps,
      activeCodeArtifact,
      codeRevisionsSummary,
      persona,
      targetGrade
    });


    const toolDeclarations = getLiveToolDeclarations(sessionType, tutorMode);

    const setupMessage: any = {
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
          temperature: sessionType === 'tutor' ? 0.3 : (strategy === 'socratic_tutoring' ? 0.4 : 0.2)
        },
        systemInstruction: {
          parts: [{ text: systemPromptText }]
        }
      }
    };

    if (toolDeclarations.length > 0) {
      setupMessage.setup.tools = [
        {
          functionDeclarations: toolDeclarations
        }
      ];
    }

    geminiSocket.on('open', () => {
      console.log(`✅ Connected to Upstream Gemini Live WS (${liveModel}), sending setup frame...`);
      geminiSocket.send(JSON.stringify(setupMessage));
    });

    geminiSocket.on('message', async (data: RawData) => {
      const buffer = toRawBuffer(data);
      const str = buffer.toString('utf8');
      let isToolCallProcessed = false;

      try {
        const parsed = JSON.parse(str);

        // Handle setupComplete from Google Gemini
        if (parsed.setupComplete) {
          session.isSetupComplete = true;
          console.log(`🎉 Upstream setupComplete received (Type: ${sessionType}, isResumed: ${isResumed}, sessionId: ${session.sessionId || 'none'})!`);

          if (isResumed) {
            const mem = session.sessionId ? liveSessionRegistry.get(session.sessionId) : null;
            const hasHistory = mem && mem.turns.length > 0;

            if (hasHistory) {
              console.log(`🔄 Replaying ${mem.turns.length} structured multi-turn dialogue steps to upstream Live model for session ${session.sessionId}...`);
              const replayTurns = mem.turns.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }]
              }));

              // Send structured multi-turn conversation history to Google Gemini Live
              const multiTurnMessage = {
                clientContent: {
                  turns: replayTurns,
                  turnComplete: false
                }
              };
              if (geminiSocket.readyState === WebSocket.OPEN) {
                geminiSocket.send(JSON.stringify(multiTurnMessage));
              }

              // Silent Resumption: if candidate was speaking or reflecting when connection dropped, keep AI silent!
              if (mem.lastSpeaker === 'user' || mem.lastSpeaker === 'none') {
                console.log(`🤫 Silent Resumption active for session ${session.sessionId}: AI remains quiet, microphone immediately unlocked for candidate.`);
                if (clientSocket.readyState === WebSocket.OPEN) {
                  clientSocket.send(JSON.stringify({ type: 'setupComplete', silent: true }));
                }
              } else {
                // If disconnect happened mid-AI monologue, trigger a concise 1-sentence thought completion
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
              // Fallback if memory was cold: send concise non-regreeting continuation
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
          } else {
            let greetingText = '';
            if (initialUserMessage) {
              // User connected by sending a concrete textual question/code critique
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

            // SOTA 2026: Destructive 3.5s greetingWatchdog removed to eliminate turn collisions and false Barge-in.

            // Notify client
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
          session.isToolCallPending = false;
          session.lastActivityAt = Date.now();
          session.probesCount = (session.probesCount || 0) + 1;
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }

          if (parsed.serverContent.modelTurn.parts) {
            for (const part of parsed.serverContent.modelTurn.parts) {
              if (part.text) {
                session.currentAiTurnText = (session.currentAiTurnText || '') + part.text;
              }
            }
          }
        }

        // AI finished generating turn: commit to session turn history
        if (parsed.serverContent?.turnComplete) {
          if (session.currentAiTurnText && session.sessionId) {
            const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
            mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
            mem.lastSpeaker = 'model';
            mem.updatedAt = Date.now();
            session.currentAiTurnText = '';
          }
        }

        // Barge-in interruption during AI speech
        if (parsed.serverContent?.interrupted) {
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

        // Handle Function Calling / toolCall
        if (parsed.toolCall?.functionCalls) {
          isToolCallProcessed = true; // Never leak internal toolCall frames to frontend client
          session.isToolCallPending = true;
          session.lastActivityAt = Date.now();
          if (session.nudgeWatchdog) {
            clearTimeout(session.nudgeWatchdog);
            session.nudgeWatchdog = null;
          }
          console.log('🛠️ Gemini Live emitted Tool Call:', JSON.stringify(parsed.toolCall.functionCalls));

          // SOTA 2026: Notify client that tools are actively executing (prevents false gateway delay alerts)
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({
              type: 'tool_executing',
              tools: parsed.toolCall.functionCalls.map((fc: any) => fc.name)
            }));
          }

          try {
            for (const call of parsed.toolCall.functionCalls) {
              try {
                await handleLiveToolCall({
                  call,
                  clientSocket,
                  geminiSocket,
                  session,
                  parsedHints,
                  liveCoaching
                });
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
            session.isToolCallPending = false;
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

    clientSocket.on('message', (data: RawData) => {
      session.lastActivityAt = Date.now();
      const buffer = toRawBuffer(data);
      let payloadBuffer = buffer;

      try {
        const text = buffer.toString();
        const parsed = JSON.parse(text);

        // Heartbeat Pong response from client: calculate RTT and send ack to client
        if (parsed.type === 'pong') {
          const sentTs = typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now();
          const rtt = Math.max(0, Date.now() - sentTs);
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'pong_ack', rtt, timestamp: Date.now() }));
          }
          return;
        }

        // Heartbeat Ping from client: immediate Pong reply
        if (parsed.type === 'ping') {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'pong', timestamp: parsed.timestamp || Date.now() }));
          }
          return;
        }

        // First-frame resumption sync from client (robust fallback if memory was cold)
        if (parsed.type === 'resume_sync' && Array.isArray(parsed.turns) && session.sessionId) {
          const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
          if (mem.turns.length === 0 && parsed.turns.length > 0) {
            mem.turns = parsed.turns
              .map((t: any) => ({
                role: (t.role === 'model' || t.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
                text: String(t.text || '').trim()
              }))
              .filter((t: any) => t.text.length > 0);
            mem.lastSpeaker = mem.turns[mem.turns.length - 1]?.role || 'none';
            mem.updatedAt = Date.now();
            console.log(`📥 Seeded session memory from client resume_sync frame: ${mem.turns.length} turns for session ${session.sessionId}`);

            // If setupComplete already arrived before resume_sync, replay history upstream now!
            if (session.isSetupComplete && geminiSocket.readyState === WebSocket.OPEN) {
              const replayTurns = mem.turns.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }]
              }));
              console.log(`🔄 Replaying ${replayTurns.length} turns to upstream Live model after resume_sync...`);
              geminiSocket.send(JSON.stringify({
                clientContent: {
                  turns: replayTurns,
                  turnComplete: false
                }
              }));
            }
          }
          return;
        }

        // Protocol-Level Session Hold state from client (Coffee Break / Pause)
        if (parsed.type === 'session_hold') {
          session.isOnHold = Boolean(parsed.paused);
          session.lastActivityAt = Date.now();
          console.log(`⏸️ Client toggled session_hold: ${session.isOnHold ? 'HOLD (Timer Frozen)' : 'ACTIVE'}`);
          return;
        }

        // Multimodal Deictic Canvas Grounding event from client (System Design Studio)
        if (parsed.type === 'canvas_delta') {
          if (parsed.payload?.architectureMermaid) {
            session.currentArchitectureMermaid = parsed.payload.architectureMermaid;
          }
          if (parsed.payload?.graphIr) {
            session.currentGraphIr = parsed.payload.graphIr;
          }

          if (session.isSetupComplete && geminiSocket.readyState === WebSocket.OPEN) {
            let deicticContent = '';
            if (parsed.payload?.graphIr) {
              const summary = parsed.payload.mutationSummary ? `${parsed.payload.mutationSummary}\n` : '';
              deicticContent = `${summary}${parsed.payload.graphIr}`;
            } else {
              deicticContent = parsed.payload?.mutationSummary || 
                (parsed.payload?.focusedElement 
                  ? `Фокус кандидата на компоненте: ${parsed.payload.focusedElement.label || parsed.payload.focusedElement.id} (${parsed.payload.focusedElement.nodeType || 'node'}, config: ${JSON.stringify(parsed.payload.focusedElement.config || {})})` 
                  : 'Кандидат внёс изменения в архитектурный граф на холсте');
            }

            const deicticText = `[CANVAS_DEICTIC_CONTEXT: ${deicticContent}]`;
            console.log(`🧭 Canvas deictic context forwarded to Gemini Live: ${deicticText}`);
            geminiSocket.send(JSON.stringify({
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{ text: deicticText }]
                }],
                turnComplete: false
              }
            }));
          }
          return;
        }

        // Client text message turn tracking
        if (parsed.clientContent?.turns && session.sessionId) {
          for (const turn of parsed.clientContent.turns) {
            if (turn.parts) {
              const turnText = turn.parts.map((p: any) => p.text || '').join('').trim();
              if (turnText && !turnText.startsWith('[ВОЗОБНОВЛЕНИЕ') && !turnText.startsWith('[ТЕХНИЧЕСКАЯ')) {
                const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
                mem.turns.push({ role: 'user', text: turnText });
                mem.lastSpeaker = 'user';
                mem.updatedAt = Date.now();
              }
            }
          }
        }

        // Client audio turn tracking
        if (session.sessionId && (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks)) {
          const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
          mem.lastSpeaker = 'user';
          mem.updatedAt = Date.now();
        }

        // Ignore duplicate setup frames from client since setup is already initiated via URL query params
        if (parsed.setup) {
          console.log('ℹ️ Client sent setup frame (session already configured via URL params, skipping duplicate setup)');
          return;
        }

        // Client committed candidate turn (text, audio or turnComplete)
        if (parsed.clientContent?.turns || parsed.clientContent?.turnComplete || parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
          session.hasCandidateResponded = true;
        }

        // Client committed turnComplete -> start upstream nudge watchdog (5.5s)
        if (parsed.clientContent?.turnComplete) {
          if (session.nudgeWatchdog) clearTimeout(session.nudgeWatchdog);
          session.nudgeWatchdog = setTimeout(() => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              console.log('⏱️ Upstream response delayed (>5.5s), notifying client...');
              clientSocket.send(JSON.stringify({ type: 'thinking_delay', elapsedMs: 5500 }));
            }
          }, 5500);
        }

        // Normalize realtime audio chunks to canonical Gemini Live realtimeInput.audio
        if (parsed.realtime_input?.audio || parsed.realtimeInput?.audio || parsed.realtimeInput?.mediaChunks) {
          const audioData =
            parsed.realtime_input?.audio?.data ||
            parsed.realtimeInput?.audio?.data ||
            parsed.realtimeInput?.mediaChunks?.[0]?.data;
          const mimeType =
            parsed.realtime_input?.audio?.mimeType ||
            parsed.realtimeInput?.audio?.mimeType ||
            parsed.realtimeInput?.mediaChunks?.[0]?.mimeType ||
            'audio/pcm;rate=16000';

          if (audioData) {
            const normalized = {
              realtimeInput: {
                audio: {
                  mimeType,
                  data: audioData
                }
              }
            };
            payloadBuffer = Buffer.from(JSON.stringify(normalized));
          }
        }
      } catch {}

      if (!session.isSetupComplete) {
        // Buffer audio or turns while waiting for setupComplete (bounded queue against memory leak)
        const MAX_FRAME_QUEUE = 200;
        if (session.frameQueue.length >= MAX_FRAME_QUEUE) {
          session.frameQueue.shift();
        }
        session.frameQueue.push(payloadBuffer);
      } else {
        // Critical Protocol Guard: Drop client realtimeInput audio while toolCall is pending to prevent 1008 Policy Violation!
        if (session.isToolCallPending) {
          try {
            const parsedObj = JSON.parse(buffer.toString());
            if (parsedObj.realtime_input?.audio || parsedObj.realtimeInput?.audio || parsedObj.realtimeInput?.mediaChunks) {
              return;
            }
          } catch {}
        }

        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.send(payloadBuffer);
        }
      }
    });

    let isTerminated = false;
    const terminate = (source: string, code?: number, reason?: Buffer) => {
      if (isTerminated) return;
      isTerminated = true;

      console.log(`🔌 Termination triggered by [${source}], code=${code}, reason=${reason ? reason.toString() : 'none'}`);
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
        session.heartbeatInterval = null;
      }
      if (session.nudgeWatchdog) {
        clearTimeout(session.nudgeWatchdog);
        session.nudgeWatchdog = null;
      }
      if (session.currentAiTurnText && session.sessionId) {
        const mem = getOrCreateSessionMemory(session.sessionId, session.questionId || '');
        mem.turns.push({ role: 'model', text: session.currentAiTurnText.trim() });
        mem.lastSpeaker = 'model';
        mem.updatedAt = Date.now();
        session.currentAiTurnText = '';
      }
      session.frameQueue = [];
      try {
        if (geminiSocket.readyState === WebSocket.OPEN || geminiSocket.readyState === WebSocket.CONNECTING) {
          geminiSocket.close();
        }
      } catch (err) {
        console.warn('Error closing geminiSocket:', err);
      }
      try {
        if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
          clientSocket.close();
        }
      } catch (err) {
        console.warn('Error closing clientSocket:', err);
      }
    };

    clientSocket.on('close', (code, reason) => terminate('ClientSocket', code, reason));
    clientSocket.on('error', (err) => {
      console.error('Client WS error:', err.message);
      terminate('ClientSocketError');
    });

    geminiSocket.on('close', (code, reason) => terminate('GeminiUpstream', code, reason));
    geminiSocket.on('error', (err) => {
      console.error('Gemini Live upstream WS error:', err.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        try {
          clientSocket.send(JSON.stringify({ error: `Ошибка голосового шлюза: ${err.message}` }));
        } catch (sendErr) {
          console.warn('Failed to forward error message to clientSocket:', sendErr);
        }
      }
      terminate('GeminiUpstreamError');
    });
  });
}
