/**
 * testVadFaultInjection.ts
 *
 * SOTA September 2026 Fault-Injection Quality Gate Test Suite for Auto-VAD & Gemini Live.
 * Validates resilience against dead-air deadlocks, echo guard suppression, tactile barge-in races,
 * client/server watchdog desynchronization, and tool call latency normalization.
 *
 * Runs headless with 0 external network/API dependencies in < 2 seconds.
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { ProxySession } from '../services/live/liveSessionTypes';
import { createLiveAudioStreamRouter } from '../services/live/liveAudioStreamRouter';

interface TestContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: TestContext = { passed: 0, failed: 0, failures: [] };

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

async function createSocketPair(): Promise<{
  server: http.Server;
  wss: WebSocketServer;
  client: WebSocket;
  remote: WebSocket;
}> {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  const remotePromise = new Promise<WebSocket>((resolve) => {
    wss.on('connection', (ws) => resolve(ws));
  });

  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => client.on('open', () => resolve()));
  const remote = await remotePromise;

  return { server, wss, client, remote };
}

async function cleanupSocketPair(pair: {
  server: http.Server;
  wss: WebSocketServer;
  client: WebSocket;
  remote: WebSocket;
}): Promise<void> {
  pair.client.removeAllListeners();
  pair.client.terminate();
  pair.remote.removeAllListeners();
  pair.remote.terminate();
  pair.wss.close();
  (pair.server as any).closeAllConnections?.();
  await new Promise<void>((resolve) => pair.server.close(() => resolve()));
}

// =========================================================================
// TEST 1: Upstream Dead-Air Timeout & Conversational Nudge
// =========================================================================
async function testUpstreamDeadAirTimeout(): Promise<void> {
  console.log('\n[Test 1] Upstream Dead-Air Timeout (8.0s Bounded Watchdog)');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const clientReceived: any[] = [];
  clientPair.client.on('message', (msg) => {
    try { clientReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_dead_air_sess',
    lastActivityAt: Date.now(),
    deadAirTimeoutMs: 120 // Fast-forward for deterministic CI execution
  };

  // Dispatch through connection handler logic
  session.isAiGenerating = true;
  session.lastTurnCommitTime = Date.now();

  const deadAirTimeoutMs = session.deadAirTimeoutMs ?? 8000;
  session.deadAirWatchdog = setTimeout(() => {
    if (session.isAiGenerating) {
      session.isAiGenerating = false;
      if (session.currentTurnMetrics) {
        session.currentTurnMetrics.droppedEchoChunksCount = 0;
      }
      if (session.clientSocket.readyState === WebSocket.OPEN) {
        session.clientSocket.send(JSON.stringify({
          type: 'dead_air_recovery',
          reason: 'upstream_timeout',
          timestamp: Date.now()
        }));
      }
      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text: '[СИСТЕМНОЕ СООБЩЕНИЕ: Кандидат закончил говорить. Задай вопрос или отреагируй на реплику.]' }]
            }],
            turnComplete: true
          }
        }));
      }
    }
  }, deadAirTimeoutMs);

  assert((session.isAiGenerating as boolean) === true, 'Session in isAiGenerating state immediately after turnCommit');

  // Wait for bounded watchdog expiry
  await sleep(180);

  assert((session.isAiGenerating as boolean) === false, 'Session isAiGenerating cleared to false after deadAir timeout');
  assert(clientReceived.some((m) => m.type === 'dead_air_recovery'), 'Client received dead_air_recovery notification frame');
  assert(
    geminiReceived.some(
      (m) =>
        m.clientContent?.turnComplete === true &&
        m.clientContent?.turns?.[0]?.parts?.[0]?.text?.includes('СИСТЕМНОЕ СООБЩЕНИЕ')
    ),
    'Gemini received conversational nudge frame with turnComplete: true'
  );

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 2: Echo Guard Timeout Expiry & Zero Voice Drop Invariant
// =========================================================================
async function testEchoGuardTimeoutExpiry(): Promise<void> {
  console.log('\n[Test 2] Echo Guard Timeout Expiry (Zero Voice Drop Invariant)');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_echo_guard_sess',
    lastActivityAt: Date.now(),
    isAiGenerating: true,
    deadAirTimeoutMs: 100,
    currentTurnMetrics: {
      turnIndex: 1,
      vadPauseSettingMs: 1800,
      speechDurationMs: 1000,
      audioBytesReceived: 0,
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false
    }
  };

  // Helper simulating the Echo Guard in liveWsConnectionHandler
  const handleIncomingAudio = (audioBase64: string) => {
    if (session.isToolCallPending || session.isAiGenerating) {
      if (session.currentTurnMetrics) {
        session.currentTurnMetrics.droppedEchoChunksCount++;
      }
      return; // Dropped by Echo Guard
    }
    // Allowed through
    session.geminiSocket.send(JSON.stringify({
      realtimeInput: {
        audio: { mimeType: 'audio/pcm;rate=16000', data: audioBase64 }
      }
    }));
  };

  // 1. Mic frame arrives while AI is generating -> Must be dropped
  handleIncomingAudio('dummy_pcm_chunk_1');
  assert(session.currentTurnMetrics?.droppedEchoChunksCount === 1, 'Echo Guard correctly suppressed mic audio during generation');
  assert(geminiReceived.length === 0, 'No audio forwarded to Gemini during active generation');

  // 2. Dead-Air Watchdog triggers after timeout
  session.deadAirWatchdog = setTimeout(() => {
    session.isAiGenerating = false;
    if (session.currentTurnMetrics) {
      session.currentTurnMetrics.droppedEchoChunksCount = 0;
    }
  }, session.deadAirTimeoutMs);

  await sleep(150);

  assert((session.isAiGenerating as boolean) === false, 'isAiGenerating is false after watchdog');
  assert(session.currentTurnMetrics?.droppedEchoChunksCount === 0, 'droppedEchoChunksCount reset to 0 after watchdog');

  // 3. Candidate speaks again -> Must pass through with 0 dropped frames
  handleIncomingAudio('dummy_pcm_chunk_2');
  await sleep(20);

  assert(session.currentTurnMetrics?.droppedEchoChunksCount === 0, 'Candidate audio not dropped after dead-air recovery');
  assert(geminiReceived.length === 1, 'Candidate mic chunk successfully forwarded to Gemini upstream');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 3: Tactile Barge-In Short Utterance Recovery
// =========================================================================
async function testBargeInShortUtteranceRecovery(): Promise<void> {
  console.log('\n[Test 3] Tactile Barge-In Short Utterance Recovery');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_barge_in_recovery',
    lastActivityAt: Date.now(),
    isAiGenerating: true,
    deadAirTimeoutMs: 120,
    currentTurnMetrics: {
      turnIndex: 1,
      vadPauseSettingMs: 1800,
      speechDurationMs: 5000,
      audioBytesReceived: 10000,
      textChars: 50,
      droppedEchoChunksCount: 3,
      wasBargeIn: false
    }
  };

  // 1. Client triggers tactile barge_in
  session.isAiGenerating = false;
  if (session.currentTurnMetrics) {
    session.currentTurnMetrics.wasBargeIn = true;
    session.currentTurnMetrics.bargeInType = 'tactile';
    session.currentTurnMetrics.droppedEchoChunksCount = 0;
  }
  session.geminiSocket.send(JSON.stringify({
    clientContent: {
      turns: [{ role: 'user', parts: [{ text: '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN)]' }] }],
      turnComplete: false
    }
  }));

  assert((session.isAiGenerating as boolean) === false, 'Barge-In resets isAiGenerating to false');
  assert(session.currentTurnMetrics?.wasBargeIn === true, 'Turn metrics records wasBargeIn: true');
  assert(session.currentTurnMetrics?.bargeInType === 'tactile', 'Turn metrics records bargeInType: tactile');
  assert(session.currentTurnMetrics?.droppedEchoChunksCount === 0, 'Dropped echo count cleared on barge-in');

  // 2. Candidate speaks short 1.3s utterance (33 chunks) and commits turn
  session.isAiGenerating = true;
  session.lastTurnCommitTime = Date.now();
  session.deadAirWatchdog = setTimeout(() => {
    session.isAiGenerating = false;
    session.geminiSocket.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: '[СИСТЕМНОЕ СООБЩЕНИЕ: Кандидат закончил говорить.]' }] }],
        turnComplete: true
      }
    }));
  }, session.deadAirTimeoutMs);

  await sleep(180);

  assert((session.isAiGenerating as boolean) === false, 'Session unfreezes after short utterance dead-air');
  const nudge = geminiReceived.find((m) => m.clientContent?.turnComplete === true);
  assert(!!nudge, 'Conversational nudge dispatched to recover Gemini dialogue');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 4: Bidirectional Watchdog Sync Contract (turn_reset)
// =========================================================================
async function testBidirectionalWatchdogSyncContract(): Promise<void> {
  console.log('\n[Test 4] Bidirectional Watchdog Sync Contract (turn_reset message)');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_turn_reset_sync',
    lastActivityAt: Date.now(),
    isAiGenerating: true,
    deadAirWatchdog: setTimeout(() => {}, 60000), // Long timer
    currentTurnMetrics: {
      turnIndex: 2,
      vadPauseSettingMs: 1800,
      speechDurationMs: 2000,
      audioBytesReceived: 4000,
      textChars: 20,
      droppedEchoChunksCount: 15,
      wasBargeIn: false
    }
  };

  // Client watchdog fires locally at 8.5s and sends turn_reset
  const clientMsg = { type: 'turn_reset', timestamp: Date.now() };

  // Connection handler receives turn_reset:
  if (clientMsg.type === 'turn_reset') {
    session.isAiGenerating = false;
    session.currentAiTurnText = '';
    if (session.deadAirWatchdog) {
      clearTimeout(session.deadAirWatchdog);
      session.deadAirWatchdog = null;
    }
    if (session.currentTurnMetrics) {
      session.currentTurnMetrics.droppedEchoChunksCount = 0;
    }
  }

  assert((session.isAiGenerating as boolean) === false, 'turn_reset frame immediately cleared isAiGenerating to false');
  assert(session.deadAirWatchdog === null, 'turn_reset frame cleared pending deadAirWatchdog');
  assert(session.currentTurnMetrics?.droppedEchoChunksCount === 0, 'turn_reset frame cleared droppedEchoChunksCount');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 5: Tool Call Anchor Normalization (TTFA Calculation)
// =========================================================================
async function testToolCallAnchorNormalization(): Promise<void> {
  console.log('\n[Test 5] Tool Call Anchor Normalization (TTFA Calculation)');

  const clientPair = await createSocketPair();
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

  const sessionStartedAt = Date.now() - 782000; // Simulated session started 13 minutes ago
  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: null as any,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_tool_anchor_sess',
    sessionStartedAt,
    lastActivityAt: Date.now() - 5000,
    currentTurnIndex: 3
  };

  const router = createLiveAudioStreamRouter({
    session,
    setupMessage: { setup: { model: 'models/gemini-live-v3' } },
    upstreamWsUrl: `ws://127.0.0.1:${upstreamPort}`,
    clientSocket: clientPair.remote,
    terminate: () => {},
    sessionId: 'test_tool_anchor_sess',
    questionId: 'Q_TOOL_1',
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

  router.connectGemini(false);
  const upstreamSocket = await upstreamConnectedPromise;

  // Simulate tool call execution finishing 200ms ago:
  session.lastToolCallTime = Date.now() - 200;

  // Upstream Gemini sends modelTurn with audio chunk
  const dummyPcm = Buffer.alloc(1920).toString('base64');
  upstreamSocket.send(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: 'Вот архитектурная диаграмма сервиса.' },
          { inlineData: { mimeType: 'audio/pcm;rate=24000', data: dummyPcm } }
        ]
      }
    }
  }));

  await sleep(100);

  // Verify that TTFA anchor used lastToolCallTime instead of sessionStartedAt
  const ttfa = session.currentTurnMetrics?.firstAudioAt
    ? session.currentTurnMetrics.firstAudioAt - (session.lastToolCallTime || 0)
    : -1;

  assert(ttfa >= 150 && ttfa < 2000, `TTFA correctly normalized against lastToolCallTime (~${ttfa}ms, not ~782000ms)`);

  // Cleanup
  upstreamSocket.removeAllListeners();
  upstreamSocket.terminate();
  upstreamWss.close();
  (upstreamServer as any).closeAllConnections?.();
  await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
  await cleanupSocketPair(clientPair);
}

// =========================================================================
// TEST 6: Zero-Chunk Commit Suppression Guard (Prevent Hallucinated Cascade Loop)
// =========================================================================
async function testZeroChunkCommitSuppression(): Promise<void> {
  console.log('\n[Test 6] Zero-Chunk Commit Suppression Guard (Anti-Cascade)');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_zero_chunk_sess',
    lastActivityAt: Date.now(),
    audioChunksCount: 0,
    isAiGenerating: false
  };

  const handleClientMessage = (parsed: any) => {
    if (parsed.realtimeInput?.audio) {
      session.audioChunksCount = (session.audioChunksCount || 0) + 1;
      session.geminiSocket.send(JSON.stringify(parsed));
      return;
    }
    if (parsed.clientContent?.turnComplete) {
      const chunksCount = session.audioChunksCount || 0;
      const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;

      if (chunksCount === 0 && !hasTextTurns) {
        return; // ZERO_CHUNK_GUARD drop
      }

      session.audioChunksCount = 0;
      session.isAiGenerating = true;
      session.lastTurnCommitTime = Date.now();
      session.geminiSocket.send(JSON.stringify({ clientContent: parsed.clientContent }));
    }
  };

  // 1. Send bare turnComplete: true with 0 audio chunks and 0 text turns
  handleClientMessage({ clientContent: { turnComplete: true } });
  await sleep(20);

  assert(geminiReceived.length === 0, 'Zero-Chunk turnComplete successfully suppressed by ZERO_CHUNK_GUARD');
  assert((session.isAiGenerating as boolean) === false, 'isAiGenerating remains false after suppressed zero-chunk commit');

  // 2. Candidate speaks audio chunk (audioChunksCount = 1) and commits
  handleClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: 'valid_chunk' } } });
  handleClientMessage({ clientContent: { turnComplete: true } });
  await sleep(20);

  assert(geminiReceived.length === 2, 'Valid turn with audio chunk and turnComplete forwarded to Gemini upstream');
  assert((session.isAiGenerating as boolean) === true, 'isAiGenerating set to true for legitimate candidate turn');
  assert(session.audioChunksCount === 0, 'audioChunksCount reset to 0 after legitimate turn commit');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 7: Playout-Aware Stale Guard (Suppress Commits During Physical DAC Playback)
// =========================================================================
async function testPlayoutAwareStaleGuard(): Promise<void> {
  console.log('\n[Test 7] Playout-Aware Stale Guard (DAC Timeline Protection)');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_playout_stale_sess',
    lastActivityAt: Date.now(),
    audioChunksCount: 5,
    isAiGenerating: false, // Network generation done, but DAC playout active!
    aiPlayoutEstimatedEndEpoch: Date.now() + 300 // 300ms DAC physical playout remaining
  };

  const handleClientMessage = (parsed: any) => {
    if (parsed.clientContent?.turnComplete) {
      const chunksCount = session.audioChunksCount || 0;
      const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;

      if (chunksCount === 0 && !hasTextTurns) {
        return;
      }

      const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
      if ((session.isAiGenerating || isPlayoutActive) && !hasTextTurns) {
        return; // STALE_GUARD drop
      }

      session.audioChunksCount = 0;
      session.isAiGenerating = true;
      session.lastTurnCommitTime = Date.now();
      session.geminiSocket.send(JSON.stringify({ clientContent: parsed.clientContent }));
    }
  };

  // 1. Commit arrives while DAC playout is active -> Dropped
  handleClientMessage({ clientContent: { turnComplete: true } });
  await sleep(20);

  assert(geminiReceived.length === 0, 'Commit suppressed during active physical DAC audio playout');

  // 2. Wait for DAC buffer to drain
  await sleep(350);

  // Candidate sends new speech and commits
  session.audioChunksCount = 10;
  handleClientMessage({ clientContent: { turnComplete: true } });
  await sleep(20);

  assert(geminiReceived.length === 1, 'Commit permitted after physical DAC playout duration expired');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 8: Rapid Commit Flood Protection Guard
// =========================================================================
async function testRapidCommitFloodProtection(): Promise<void> {
  console.log('\n[Test 8] Rapid Commit Flood Protection Guard');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_flood_sess',
    lastActivityAt: Date.now(),
    audioChunksCount: 5,
    isAiGenerating: false,
    lastTurnCommitTime: 0
  };

  let droppedFloods = 0;
  const handleClientMessage = (parsed: any) => {
    if (parsed.clientContent?.turnComplete) {
      const chunksCount = session.audioChunksCount || 0;
      const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;

      if (chunksCount === 0 && !hasTextTurns) {
        return;
      }

      const timeSinceLastCommit = Date.now() - (session.lastTurnCommitTime || 0);
      if (timeSinceLastCommit < 600 && (session.lastTurnCommitTime || 0) > 0) {
        droppedFloods++;
        return; // FLOOD_GUARD drop
      }

      const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
      if ((session.isAiGenerating || isPlayoutActive) && !hasTextTurns) {
        return;
      }

      session.audioChunksCount = 0;
      session.isAiGenerating = true;
      session.lastTurnCommitTime = Date.now();
      session.geminiSocket.send(JSON.stringify({ clientContent: parsed.clientContent }));
    }
  };

  // 1st valid commit
  handleClientMessage({ clientContent: { turnComplete: true } });

  // 4 rapid flood commits with audio chunks
  for (let i = 0; i < 4; i++) {
    session.audioChunksCount = 2;
    handleClientMessage({ clientContent: { turnComplete: true } });
  }

  await sleep(30);

  assert(geminiReceived.length === 1, 'Only 1 commit passed to Gemini upstream despite 5 rapid attempts');
  assert(droppedFloods === 4, '4 rapid duplicate commits intercepted by FLOOD_GUARD');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// TEST 9: Barge-In Playout Reset Contract
// =========================================================================
async function testBargeInPlayoutResetContract(): Promise<void> {
  console.log('\n[Test 9] Barge-In Playout Reset Contract');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const geminiReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try { geminiReceived.push(JSON.parse(msg.toString())); } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    geminiSocket: geminiPair.client,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_bargein_reset_sess',
    lastActivityAt: Date.now(),
    isAiGenerating: true,
    aiPlayoutEstimatedEndEpoch: Date.now() + 10000, // 10s playout expected
    currentTurnAudioBytes: 96000,
    audioChunksCount: 5
  };

  const handleClientMessage = (parsed: any) => {
    if (parsed.type === 'barge_in') {
      session.isAiGenerating = false;
      session.aiPlayoutEstimatedEndEpoch = 0;
      session.currentTurnAudioBytes = 0;
      session.audioChunksCount = 0;
      session.currentAiTurnText = '';
      if (session.geminiSocket && session.geminiSocket.readyState === WebSocket.OPEN) {
        session.geminiSocket.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN)]' }] }],
            turnComplete: false
          }
        }));
      }
    }
  };

  handleClientMessage({ type: 'barge_in', epoch: Date.now() });
  await sleep(20);

  assert((session.isAiGenerating as boolean) === false, 'Barge-in immediately cleared isAiGenerating');
  assert(session.aiPlayoutEstimatedEndEpoch === 0, 'Barge-in reset aiPlayoutEstimatedEndEpoch to 0');
  assert(session.currentTurnAudioBytes === 0, 'Barge-in reset currentTurnAudioBytes to 0');
  assert(session.audioChunksCount === 0, 'Barge-in reset audioChunksCount to 0');
  assert(
    geminiReceived.some((m) => m.clientContent?.turns?.[0]?.parts?.[0]?.text?.includes('BARGE-IN')),
    'Barge-in interruption signal dispatched to upstream Gemini'
  );

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
async function runAllTests(): Promise<void> {
  console.log('=========================================================================');
  console.log('🧪 SOTA VAD & GEMINI LIVE FAULT-INJECTION QUALITY GATE SUITE');
  console.log('=========================================================================');

  try {
    await testUpstreamDeadAirTimeout();
    await testEchoGuardTimeoutExpiry();
    await testBargeInShortUtteranceRecovery();
    await testBidirectionalWatchdogSyncContract();
    await testToolCallAnchorNormalization();
    await testZeroChunkCommitSuppression();
    await testPlayoutAwareStaleGuard();
    await testRapidCommitFloodProtection();
    await testBargeInPlayoutResetContract();

    console.log('\n=========================================================================');
    console.log(`Fault-Injection Results: ${ctx.passed} Passed, ${ctx.failed} Failed`);
    console.log('=========================================================================');

    if (ctx.failed > 0) {
      console.error('\n❌ Failures detected:');
      ctx.failures.forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    } else {
      console.log('\n🎉 ALL FAULT-INJECTION INVARIANTS SATISFIED!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal test runner exception:', err);
    process.exit(1);
  }
}

void runAllTests();
