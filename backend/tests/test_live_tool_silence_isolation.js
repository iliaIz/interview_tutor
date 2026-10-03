/**
 * test_live_tool_silence_isolation.js
 * SOTA Late 2026 Regression Test Suite:
 * 1. Tool-Call Exemption: Verifies that tool calls (e.g. update_whiteboard) never trigger zero-audio recovery nudges.
 * 2. Silence Clarification Toggle: Verifies that enableSilenceClarification: false completely suppresses canned re-asking.
 * 3. Verified isolation against false "Я тебя не расслышала" voice prompts.
 */

const http = require('http');
const assert = require('assert');
const { WebSocketServer, WebSocket } = require('ws');
const { createLiveAudioStreamRouter } = require('../dist/services/live/liveAudioStreamRouter');

console.log('========================================================================');
console.log('🧪 SOTA REGRESSION SUITE: TOOL-CALL & SILENCE CLARIFICATION ISOLATION');
console.log('========================================================================\n');

async function createSocketPair() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const serverSidePromise = new Promise((resolve) => wss.on('connection', resolve));
  const clientSide = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => clientSide.on('open', resolve));
  const serverSide = await serverSidePromise;

  return { server, wss, clientSide, serverSide };
}

async function closeSocketPair(pair) {
  try {
    pair.clientSide.removeAllListeners();
    pair.clientSide.terminate();
    pair.serverSide.removeAllListeners();
    pair.serverSide.terminate();
    pair.wss.close();
    pair.server.close();
  } catch {}
}

async function createMockUpstream() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  let socket = null;
  const connectedPromise = new Promise((resolve) => {
    wss.on('connection', (ws) => {
      socket = ws;
      resolve(ws);
    });
  });
  return {
    port,
    getSocket: () => socket,
    waitForConnection: () => connectedPromise,
    close: async () => {
      socket?.terminate();
      wss.close();
      server.close();
    }
  };
}

async function runTests() {
  let passed = 0;

  // TEST 1: Tool call (update_whiteboard) MUST NOT trigger recovery nudge
  {
    console.log('[Test 1] Tool-Call Exemption: update_whiteboard does not trigger recovery nudge');
    const clientPair = await createSocketPair();
    const upstream = await createMockUpstream();

    const session = {
      clientSocket: clientPair.serverSide,
      geminiSocket: null,
      isSetupComplete: true,
      frameQueue: [],
      sessionId: 'test_tool_isolation_sess',
      questionId: 'Q_TOOL_1',
      sessionStartedAt: Date.now(),
      lastActivityAt: Date.now(),
      hasCandidateResponded: true,
      currentTurnIndex: 1,
      enableSilenceClarification: true // Even if enabled, tool call must exempt!
    };

    const router = createLiveAudioStreamRouter({
      session,
      setupMessage: { setup: { model: 'models/gemini-live-v3' } },
      upstreamWsUrl: `ws://127.0.0.1:${upstream.port}`,
      clientSocket: clientPair.serverSide,
      terminate: () => {},
      sessionId: 'test_tool_isolation_sess',
      questionId: 'Q_TOOL_1',
      sessionType: 'interview',
      tutorMode: '',
      bugTitle: '',
      questionText: 'Demonstrate code.',
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

    router.connectGemini();
    const upstreamSocket = await upstream.waitForConnection();

    const upstreamReceivedMessages = [];
    upstreamSocket.on('message', (raw) => {
      try {
        upstreamReceivedMessages.push(JSON.parse(raw.toString('utf8')));
      } catch {}
    });

    // Simulate upstream Gemini sending setupComplete
    upstreamSocket.send(JSON.stringify({ setupComplete: true }));
    await new Promise((r) => setTimeout(r, 60));

    // Simulate upstream Gemini sending update_whiteboard tool call
    upstreamSocket.send(JSON.stringify({
      toolCall: {
        functionCalls: [
          {
            id: 'call_wb_123',
            name: 'update_whiteboard',
            args: { action: 'write', title: 'Example', code: 'public class Main {}' }
          }
        ]
      }
    }));
    await new Promise((r) => setTimeout(r, 60));

    // Simulate upstream Gemini sending turnComplete waiting for tool response
    upstreamSocket.send(JSON.stringify({
      serverContent: {
        turnComplete: true,
        interactionStatus: 'IDLE'
      }
    }));
    await new Promise((r) => setTimeout(r, 100));

    // Verify upstream received toolResponse
    const hasToolResponse = upstreamReceivedMessages.some(m => m.toolResponse);
    assert(hasToolResponse, 'Upstream should receive toolResponse for update_whiteboard');

    // Verify upstream did NOT receive the annoying recovery nudge
    const hasRecoveryNudge = upstreamReceivedMessages.some(m => {
      const turns = m.clientContent?.turns || [];
      return turns.some(t => t.parts?.some(p => p.text?.includes('Я тебя не расслышала')));
    });

    assert.strictEqual(hasRecoveryNudge, false, 'Tool-call MUST NOT trigger "Я тебя не расслышала" prompt injection!');
    console.log('  ✅ Test 1 Passed: Tool call correctly exempted from zero-audio recovery nudge.\n');
    passed++;

    await closeSocketPair(clientPair);
    await upstream.close();
  }

  // TEST 2: Silence clarification FALSE (default) suppresses recovery nudge
  {
    console.log('[Test 2] Setting enableSilenceClarification: false suppresses recovery nudge on silence');
    const clientPair = await createSocketPair();
    const upstream = await createMockUpstream();

    const session = {
      clientSocket: clientPair.serverSide,
      geminiSocket: null,
      isSetupComplete: true,
      frameQueue: [],
      sessionId: 'test_silence_suppressed',
      questionId: 'Q_SILENCE_1',
      sessionStartedAt: Date.now(),
      lastActivityAt: Date.now(),
      hasCandidateResponded: true,
      currentTurnIndex: 1,
      enableSilenceClarification: false // Default production invariant!
    };

    const router = createLiveAudioStreamRouter({
      session,
      setupMessage: { setup: { model: 'models/gemini-live-v3' } },
      upstreamWsUrl: `ws://127.0.0.1:${upstream.port}`,
      clientSocket: clientPair.serverSide,
      terminate: () => {},
      sessionId: 'test_silence_suppressed',
      questionId: 'Q_SILENCE_1',
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

    router.connectGemini();
    const upstreamSocket = await upstream.waitForConnection();

    const upstreamReceivedMessages = [];
    upstreamSocket.on('message', (raw) => {
      try {
        upstreamReceivedMessages.push(JSON.parse(raw.toString('utf8')));
      } catch {}
    });

    upstreamSocket.send(JSON.stringify({ setupComplete: true }));
    await new Promise((r) => setTimeout(r, 60));

    // Simulate upstream Gemini sending 0-audio turnComplete without any text or tool
    upstreamSocket.send(JSON.stringify({
      serverContent: {
        turnComplete: true,
        interactionStatus: 'IDLE'
      }
    }));
    await new Promise((r) => setTimeout(r, 100));

    const hasRecoveryNudge = upstreamReceivedMessages.some(m => {
      const turns = m.clientContent?.turns || [];
      return turns.some(t => t.parts?.some(p => p.text?.includes('Я тебя не расслышала')));
    });

    assert.strictEqual(hasRecoveryNudge, false, 'With enableSilenceClarification: false, recovery nudge MUST NOT be dispatched!');
    console.log('  ✅ Test 2 Passed: Silent turn smoothly sealed without intrusive clarification phrase.\n');
    passed++;

    await closeSocketPair(clientPair);
    await upstream.close();
  }

  // TEST 3: Silence clarification TRUE triggers recovery nudge on real acoustic silence
  {
    console.log('[Test 3] Setting enableSilenceClarification: true dispatches recovery nudge on real silence');
    const clientPair = await createSocketPair();
    const upstream = await createMockUpstream();

    const session = {
      clientSocket: clientPair.serverSide,
      geminiSocket: null,
      isSetupComplete: true,
      frameQueue: [],
      sessionId: 'test_silence_enabled',
      questionId: 'Q_SILENCE_2',
      sessionStartedAt: Date.now(),
      lastActivityAt: Date.now(),
      hasCandidateResponded: true,
      currentTurnIndex: 1,
      enableSilenceClarification: true // Explicitly enabled by user!
    };

    const router = createLiveAudioStreamRouter({
      session,
      setupMessage: { setup: { model: 'models/gemini-live-v3' } },
      upstreamWsUrl: `ws://127.0.0.1:${upstream.port}`,
      clientSocket: clientPair.serverSide,
      terminate: () => {},
      sessionId: 'test_silence_enabled',
      questionId: 'Q_SILENCE_2',
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

    router.connectGemini();
    const upstreamSocket = await upstream.waitForConnection();

    const upstreamReceivedMessages = [];
    upstreamSocket.on('message', (raw) => {
      try {
        upstreamReceivedMessages.push(JSON.parse(raw.toString('utf8')));
      } catch {}
    });

    upstreamSocket.send(JSON.stringify({ setupComplete: true }));
    await new Promise((r) => setTimeout(r, 60));

    // Simulate upstream Gemini sending 0-audio turnComplete on acoustic silence
    upstreamSocket.send(JSON.stringify({
      serverContent: {
        turnComplete: true,
        interactionStatus: 'IDLE'
      }
    }));
    await new Promise((r) => setTimeout(r, 100));

    const hasRecoveryNudge = upstreamReceivedMessages.some(m => {
      const turns = m.clientContent?.turns || [];
      return turns.some(t => t.parts?.some(p => p.text?.includes('Я тебя не расслышала')));
    });

    assert(hasRecoveryNudge, 'With enableSilenceClarification: true, recovery nudge SHOULD be dispatched on real non-tool silence');
    console.log('  ✅ Test 3 Passed: Recovery nudge dispatched only when explicitly requested.\n');
    passed++;

    await closeSocketPair(clientPair);
    await upstream.close();
  }

  console.log(`========================================================================`);
  console.log(`🎉 ALL ${passed}/3 TOOL-CALL & SILENCE CLARIFICATION TESTS PASSED!`);
  console.log(`========================================================================\n`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
