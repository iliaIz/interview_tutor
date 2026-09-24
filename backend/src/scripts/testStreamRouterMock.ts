/**
 * testStreamRouterMock.ts
 *
 * SOTA September 2026 Headless Stream Router & Protocol Timing Test Suite.
 * Uses an in-memory WebSocket pair to test createLiveAudioStreamRouter
 * without external network, Docker, or Google API dependencies.
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { TurnTelemetryEvent } from '@interview-prep/shared';
import { createLiveAudioStreamRouter } from '../services/live/liveAudioStreamRouter';
import { ProxySession } from '../services/live/liveSessionTypes';

interface AssertionContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: AssertionContext = { passed: 0, failed: 0, failures: [] };

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    ctx.passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    ctx.failed++;
    const msg = detail ? `${testName}: ${detail}` : testName;
    ctx.failures.push(msg);
    console.error(`  ❌ ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helpers to spin up in-memory WebSocket server and client
async function createMockSocketPair(): Promise<{
  server: http.Server;
  wss: WebSocketServer;
  clientSide: WebSocket;
  serverSide: WebSocket;
}> {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  const serverSidePromise = new Promise<WebSocket>((resolve) => {
    wss.on('connection', (ws) => resolve(ws));
  });

  const clientSide = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => clientSide.on('open', () => resolve()));

  const serverSide = await serverSidePromise;
  return { server, wss, clientSide, serverSide };
}

async function closeMockSocketPair(pair: {
  server: http.Server;
  wss: WebSocketServer;
  clientSide: WebSocket;
  serverSide: WebSocket;
}): Promise<void> {
  pair.clientSide.removeAllListeners();
  pair.clientSide.terminate();
  pair.serverSide.removeAllListeners();
  pair.serverSide.terminate();
  pair.wss.close();
  (pair.server as any).closeAllConnections?.();
  await new Promise<void>((resolve) => pair.server.close(() => resolve()));
}

async function teardownUpstreamServer(
  upstreamServer: http.Server,
  upstreamWss: WebSocketServer,
  session: ProxySession
): Promise<void> {
  if (session.geminiSocket) {
    try {
      session.geminiSocket.removeAllListeners();
      session.geminiSocket.terminate();
    } catch {}
  }
  upstreamWss.clients.forEach((c) => {
    try {
      c.removeAllListeners();
      c.terminate();
    } catch {}
  });
  upstreamWss.close();
  (upstreamServer as any).closeAllConnections?.();
  await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
}

// =========================================================================
// TEST 1: Turn 0 AI Greeting Milestone Timings via Stream Router
// =========================================================================
async function testTurn0StreamRouter(): Promise<void> {
  console.log('\n[Test 1] Turn 0 AI Greeting Stream Router Milestones');

  // Pair 1: Client Socket (frontend client <-> backend server)
  const clientPair = await createMockSocketPair();

  // Upstream Mock Server (acts as LiteLLM/Gemini Live)
  const upstreamServer = http.createServer();
  const upstreamWss = new WebSocketServer({ server: upstreamServer });
  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', () => resolve()));
  const upstreamPort = (upstreamServer.address() as any).port;

  let upstreamSocketToRouter: WebSocket | null = null;
  const upstreamConnectedPromise = new Promise<WebSocket>((resolve) => {
    upstreamWss.on('connection', (ws) => {
      upstreamSocketToRouter = ws;
      resolve(ws);
    });
  });

  const session: ProxySession = {
    clientSocket: clientPair.serverSide,
    geminiSocket: null as any,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_router_sess_0',
    questionId: 'Q_STREAM_1',
    sessionStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    currentTurnIndex: 0
  };

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage: { setup: { model: 'models/gemini-live-v3' } },
    upstreamWsUrl: `ws://127.0.0.1:${upstreamPort}`,
    clientSocket: clientPair.serverSide,
    terminate: () => {},
    sessionId: 'test_router_sess_0',
    questionId: 'Q_STREAM_1',
    sessionType: 'interview',
    tutorMode: '',
    bugTitle: '',
    questionText: 'Explain volatile.',
    topic: 'Java',
    voiceName: 'Kore',
    isRetry: false,
    isResumed: false,
    initialUserMessage: '',
    totalQuestions: 5,
    questionIndex: 0,
    parsedHints: [],
    liveCoaching: false,
    liveModel: 'gemini-live-v3'
  });

  const clientReceivedMessages: any[] = [];
  clientPair.clientSide.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      clientReceivedMessages.push(parsed);
    } catch {}
  });

  // Connect router to mock upstream
  router.connectGemini();
  const mockGemini = await upstreamConnectedPromise;

  // 1. Upstream emits thought part after 80ms
  await sleep(80);
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ thought: true, text: 'Preparing greeting response...' }]
      }
    }
  }));

  // 2. Upstream emits text part after +100ms (180ms total)
  await sleep(100);
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ text: 'Привет! Я твой технический интервьюер.' }]
      }
    }
  }));

  // 3. Upstream emits PCM audio part after +80ms (260ms total)
  await sleep(80);
  const dummyPcm = Buffer.alloc(1000, 1).toString('base64');
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: dummyPcm } }]
      }
    }
  }));

  // 4. Upstream completes turn after +100ms (360ms total)
  await sleep(100);
  mockGemini.send(JSON.stringify({
    serverContent: {
      turnComplete: true,
      interactionStatus: 'IDLE'
    }
  }));

  // Wait for client to receive turn_telemetry
  await sleep(60);

  const telemetryMsg = clientReceivedMessages.find((m) => m.type === 'turn_telemetry');
  assert(telemetryMsg !== undefined, 'Client received turn_telemetry event over WebSocket');

  if (telemetryMsg) {
    const data = telemetryMsg.data as TurnTelemetryEvent;
    assert(data.turnIndex === 0, 'Turn 0 index is accurately set');
    assert(data.speaker === 'model', 'Speaker is model');
    assert(data.speechDurationMs === 0, 'Turn 0 candidate speech duration is 0ms');
    assert(data.ttfrMs !== null && data.ttfrMs >= 40 && data.ttfrMs <= 250, `Turn 0 TTFR (${data.ttfrMs}ms) matches injected delay`);
    assert(data.ttftMs !== null && data.ttftMs >= 120 && data.ttftMs <= 350, `Turn 0 TTFT (${data.ttftMs}ms) matches injected delay`);
    assert(data.ttfaMs !== null && data.ttfaMs >= 180 && data.ttfaMs <= 450, `Turn 0 TTFA (${data.ttfaMs}ms) matches injected delay`);
    assert(data.audioDurationMs > 0, `Turn 0 audio duration calculated from PCM bytes (${data.audioDurationMs}ms)`);
  }

  // Verify multi-turn isolation: session.currentTurnMetrics is cleaned up
  assert(session.currentTurnMetrics === null, 'session.currentTurnMetrics is cleanly reset to null after turnComplete');

  await closeMockSocketPair(clientPair);
  await teardownUpstreamServer(upstreamServer, upstreamWss, session);
}

// =========================================================================
// TEST 2: Multi-Turn State Reset & Clean Handoff
// =========================================================================
async function testMultiTurnStreamRouter(): Promise<void> {
  console.log('\n[Test 2] Multi-Turn State Reset & Sequential Handoff');

  const clientPair = await createMockSocketPair();

  const upstreamServer = http.createServer();
  const upstreamWss = new WebSocketServer({ server: upstreamServer });
  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', () => resolve()));
  const upstreamPort = (upstreamServer.address() as any).port;

  const upstreamConnectedPromise = new Promise<WebSocket>((resolve) => {
    upstreamWss.on('connection', (ws) => resolve(ws));
  });

  const session: ProxySession = {
    clientSocket: clientPair.serverSide,
    geminiSocket: null as any,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_router_sess_multiturn',
    questionId: 'Q_STREAM_2',
    sessionStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    currentTurnIndex: 1
  };

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage: { setup: { model: 'models/gemini-live-v3' } },
    upstreamWsUrl: `ws://127.0.0.1:${upstreamPort}`,
    clientSocket: clientPair.serverSide,
    terminate: () => {},
    sessionId: 'test_router_sess_multiturn',
    questionId: 'Q_STREAM_2',
    sessionType: 'interview',
    tutorMode: '',
    bugTitle: '',
    questionText: 'What is synchronization?',
    topic: 'Java',
    voiceName: 'Kore',
    isRetry: false,
    isResumed: false,
    initialUserMessage: '',
    totalQuestions: 5,
    questionIndex: 1,
    parsedHints: [],
    liveCoaching: false,
    liveModel: 'gemini-live-v3'
  });

  const clientReceivedMessages: any[] = [];
  clientPair.clientSide.on('message', (raw) => {
    try {
      clientReceivedMessages.push(JSON.parse(raw.toString()));
    } catch {}
  });

  router.connectGemini();
  const mockGemini = await upstreamConnectedPromise;

  // Turn 1: Candidate commits at T=0
  session.lastTurnCommitTime = Date.now();
  session.currentTurnMetrics = {
    turnIndex: 1,
    candidateSpeechStartedAt: session.lastTurnCommitTime - 2500,
    candidateSpeechEndedAt: session.lastTurnCommitTime,
    vadPauseSettingMs: 1800,
    speechDurationMs: 2500,
    audioBytesReceived: 0,
    textChars: 0,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };

  // Turn 1 Upstream responds
  await sleep(60);
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ text: 'Ответ на первый вопрос.' }]
      }
    }
  }));

  await sleep(60);
  mockGemini.send(JSON.stringify({
    serverContent: {
      turnComplete: true,
      interactionStatus: 'IDLE'
    }
  }));

  await sleep(50);
  assert(session.currentTurnMetrics === null, 'Turn 1 metrics cleanly cleared on completion');

  // Turn 2 begins: Candidate commits 100ms later
  await sleep(100);
  session.currentTurnIndex = 2;
  session.lastTurnCommitTime = Date.now();
  session.currentTurnMetrics = {
    turnIndex: 2,
    candidateSpeechStartedAt: session.lastTurnCommitTime - 3000,
    candidateSpeechEndedAt: session.lastTurnCommitTime,
    vadPauseSettingMs: 1800,
    speechDurationMs: 3000,
    audioBytesReceived: 0,
    textChars: 0,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };

  // Turn 2: Upstream responds
  await sleep(50);
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ text: 'Ответ на второй вопрос.' }]
      }
    }
  }));

  await sleep(50);
  mockGemini.send(JSON.stringify({
    serverContent: {
      turnComplete: true,
      interactionStatus: 'IDLE'
    }
  }));

  await sleep(50);

  const turnTelemetryEvents = clientReceivedMessages.filter((m) => m.type === 'turn_telemetry');
  assert(turnTelemetryEvents.length === 2, 'Client received exactly 2 turn_telemetry events', `Got ${turnTelemetryEvents.length}`);

  const event1 = turnTelemetryEvents[0].data as TurnTelemetryEvent;
  const event2 = turnTelemetryEvents[1].data as TurnTelemetryEvent;

  assert(event1.turnIndex === 1, 'Event 1 has turnIndex 1');
  assert(event2.turnIndex === 2, 'Event 2 has turnIndex 2');
  assert(event2.speechDurationMs === 3000, 'Event 2 speechDuration is 3000ms (isolated from Event 1)');
  assert(event2.ttftMs !== null && event2.ttftMs < 200, `Event 2 TTFT (${event2.ttftMs}ms) was not poisoned by Turn 1 timestamps`);

  await closeMockSocketPair(clientPair);
  await teardownUpstreamServer(upstreamServer, upstreamWss, session);
}

// =========================================================================
// TEST 3: Acoustic Interruption (Barge-In) Flagging
// =========================================================================
async function testBargeInFlagging(): Promise<void> {
  console.log('\n[Test 3] Acoustic Interruption (Barge-In) Protocol Handling');

  const clientPair = await createMockSocketPair();

  const upstreamServer = http.createServer();
  const upstreamWss = new WebSocketServer({ server: upstreamServer });
  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', () => resolve()));
  const upstreamPort = (upstreamServer.address() as any).port;

  const upstreamConnectedPromise = new Promise<WebSocket>((resolve) => {
    upstreamWss.on('connection', (ws) => resolve(ws));
  });

  const session: ProxySession = {
    clientSocket: clientPair.serverSide,
    geminiSocket: null as any,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_router_bargein',
    questionId: 'Q_STREAM_3',
    sessionStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    currentTurnIndex: 3
  };

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage: { setup: { model: 'models/gemini-live-v3' } },
    upstreamWsUrl: `ws://127.0.0.1:${upstreamPort}`,
    clientSocket: clientPair.serverSide,
    terminate: () => {},
    sessionId: 'test_router_bargein',
    questionId: 'Q_STREAM_3',
    sessionType: 'interview',
    tutorMode: '',
    bugTitle: '',
    questionText: 'Explain deadlocks.',
    topic: 'Java',
    voiceName: 'Kore',
    isRetry: false,
    isResumed: false,
    initialUserMessage: '',
    totalQuestions: 5,
    questionIndex: 3,
    parsedHints: [],
    liveCoaching: false,
    liveModel: 'gemini-live-v3'
  });

  router.connectGemini();
  const mockGemini = await upstreamConnectedPromise;

  session.currentTurnMetrics = {
    turnIndex: 3,
    speechDurationMs: 1500,
    vadPauseSettingMs: 1800,
    audioBytesReceived: 24000,
    textChars: 50,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };
  session.isAiGenerating = true;

  // Upstream Gemini sends interrupted: true
  mockGemini.send(JSON.stringify({
    serverContent: {
      interrupted: true
    }
  }));

  await sleep(60);

  assert(!session.isAiGenerating, 'isAiGenerating set to false upon interrupted signal');
  assert(session.currentTurnMetrics?.wasBargeIn === true, 'wasBargeIn flagged as true in currentTurnMetrics');
  assert(session.currentTurnMetrics?.bargeInType === 'acoustic', 'bargeInType flagged as acoustic');

  await closeMockSocketPair(clientPair);
  await teardownUpstreamServer(upstreamServer, upstreamWss, session);
}

async function testGenerationCompleteNormalization(): Promise<void> {
  console.log('\n[Test 4] SOTA Late 2026 generationComplete Terminal Equivalence');
  const clientPair = await createMockSocketPair();
  const upstreamServer = http.createServer();
  const upstreamWss = new WebSocketServer({ server: upstreamServer });
  await new Promise<void>((resolve) => upstreamServer.listen(0, '127.0.0.1', () => resolve()));
  const upstreamPort = (upstreamServer.address() as any).port;

  let mockGemini!: WebSocket;
  const geminiConnected = new Promise<void>((resolve) => {
    upstreamWss.on('connection', (ws) => {
      mockGemini = ws;
      resolve();
    });
  });

  const session: ProxySession = {
    clientSocket: clientPair.serverSide,
    geminiSocket: null as any,
    isSetupComplete: true,
    sessionId: 'test_router_gen_complete',
    questionId: 'Q_GEN_COMPLETE',
    isAiGenerating: false,
    isToolCallPending: false,
    frameQueue: [],
    turnTelemetryHistory: [],
    sessionStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    currentTurnIndex: 0
  };

  const clientFramesReceived: any[] = [];
  clientPair.clientSide.on('message', (data) => {
    try {
      clientFramesReceived.push(JSON.parse(data.toString()));
    } catch {}
  });

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage: { setup: { model: 'models/gemini-live-v3' } },
    upstreamWsUrl: `ws://127.0.0.1:${upstreamPort}`,
    clientSocket: clientPair.serverSide,
    terminate: () => {},
    sessionId: 'test_router_gen_complete',
    questionId: 'Q_GEN_COMPLETE',
    sessionType: 'interview',
    tutorMode: '',
    bugTitle: '',
    questionText: 'Explain JMM.',
    topic: 'Java',
    voiceName: 'Kore',
    isRetry: false,
    isResumed: false,
    initialUserMessage: '',
    totalQuestions: 1,
    questionIndex: 0,
    parsedHints: [],
    liveCoaching: false,
    liveModel: 'gemini-live-v3'
  });

  router.connectGemini(false);
  await geminiConnected;

  // Upstream Gemini sends modelTurn text
  mockGemini.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{ text: 'Привет! Расскажите про Java Memory Model.' }]
      }
    }
  }));

  await sleep(40);
  assert(session.isAiGenerating === true, 'isAiGenerating is true during speech output');

  // Upstream Gemini sends ONLY generationComplete: true (NO turnComplete: true)
  mockGemini.send(JSON.stringify({
    serverContent: {
      generationComplete: true
    }
  }));

  await sleep(60);

  assert(session.isAiGenerating === false, 'isAiGenerating is normalized to false upon generationComplete');
  const terminalFrame = clientFramesReceived.find((f) => f.serverContent?.generationComplete === true);
  assert(Boolean(terminalFrame), 'Client received serverContent with generationComplete');
  assert(terminalFrame?.serverContent?.turnComplete === true, 'Downstream frame normalized with turnComplete === true');
  const telemetryEvent = clientFramesReceived.find((f) => f.type === 'turn_telemetry');
  assert(Boolean(telemetryEvent), 'Client received turn_telemetry on generationComplete terminal turn');

  await closeMockSocketPair(clientPair);
  await teardownUpstreamServer(upstreamServer, upstreamWss, session);
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
export async function runStreamRouterMockTests(): Promise<boolean> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📡 SOTA 2026 HEADLESS STREAM ROUTER & PROTOCOL SUITE');
  console.log('═══════════════════════════════════════════════════════════════');

  await testTurn0StreamRouter();
  await testMultiTurnStreamRouter();
  await testBargeInFlagging();
  await testGenerationCompleteNormalization();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${ctx.passed} Passed | ${ctx.failed} Failed`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (ctx.failed > 0) {
    console.error('❌ Test Failures:');
    ctx.failures.forEach((f) => console.error(`  - ${f}`));
    return false;
  }
  return true;
}

if (require.main === module) {
  runStreamRouterMockTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
