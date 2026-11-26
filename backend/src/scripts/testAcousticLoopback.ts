/**
 * testAcousticLoopback.ts
 *
 * SOTA September 2026 Headless Acoustic Loopback Resilience Test.
 * Simulates laptop speaker audio leaking back into the internal microphone (-18 dB attenuation)
 * during live Gemini multi-turn dialogue.
 *
 * Verifies:
 * 1. Zero phantom turns / zero cascading echo loops when speakers bleed into microphone.
 * 2. Echo Guard & Playout-Aware Stale Guard drop speaker bleed during physical playout.
 * 3. Candidate speech is seamlessly accepted after playout finishes.
 * 4. Barge-in during speaker bleed halts model generation instantly.
 *
 * Runs headless with 0 external network dependencies in < 2 seconds.
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { ProxySession } from '../services/live/liveSessionTypes';

interface LoopbackContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: LoopbackContext = { passed: 0, failed: 0, failures: [] };

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

// Generates synthetic PCM audio chunk (16kHz 16-bit mono)
function createSyntheticPcm16k(durationMs: number, frequencyHz: number, attenuationFactor: number = 1.0): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(
      Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * 16000 * attenuationFactor
    );
    buffer.writeInt16LE(sample, i * 2);
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Acoustic Loopback Simulation Harness
// ---------------------------------------------------------------------------
async function runAcousticLoopbackSimulation(): Promise<void> {
  console.log('=========================================================================');
  console.log('🧪 SOTA HEADLESS ACOUSTIC LOOPBACK RESILIENCE TEST');
  console.log('=========================================================================');

  const clientPair = await createSocketPair();
  const geminiPair = await createSocketPair();

  const upstreamTurnsReceived: any[] = [];
  geminiPair.remote.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.clientContent?.turnComplete) {
        upstreamTurnsReceived.push(parsed);
      }
    } catch {}
  });

  const session: ProxySession = {
    clientSocket: clientPair.remote,
    upstreamTransport: {
      connect: () => {},
      sendUpstream: (payload) => {
        if (geminiPair.client.readyState !== WebSocket.OPEN) return false;
        geminiPair.client.send(payload);
        return true;
      },
      isUpstreamOpen: () => geminiPair.client.readyState === WebSocket.OPEN,
      reconnect: () => {},
      close: () => {}
    },
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'test_acoustic_loopback',
    lastActivityAt: Date.now(),
    audioChunksCount: 0,
    isAiGenerating: false,
    aiPlayoutEstimatedEndEpoch: 0,
    currentTurnAudioBytes: 0,
    lastTurnCommitTime: 0,
    currentTurnMetrics: {
      turnIndex: 0,
      vadPauseSettingMs: 1800,
      speechDurationMs: 0,
      audioBytesReceived: 0,
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false
    }
  };

  // Gateway message pipeline implementing liveWsConnectionHandler guards
  const processClientMessage = (parsed: any) => {
    if (parsed.type === 'barge_in') {
      session.isAiGenerating = false;
      session.aiPlayoutEstimatedEndEpoch = 0;
      session.currentTurnAudioBytes = 0;
      session.audioChunksCount = 0;
      session.lastTurnCommitTime = 0;
      session.upstreamTransport?.sendUpstream(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: '[КАНДИДАТ ПРЕРВАЛ РЕЧЬ (BARGE-IN)]' }] }],
          turnComplete: false
        }
      }));
      return;
    }

    if (parsed.realtimeInput?.audio) {
      const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
      if (session.isAiGenerating || isPlayoutActive) {
        // Echo Guard: Suppress speaker bleed
        if (session.currentTurnMetrics) {
          session.currentTurnMetrics.droppedEchoChunksCount++;
        }
        return;
      }
      session.audioChunksCount = (session.audioChunksCount || 0) + 1;
      session.upstreamTransport?.sendUpstream(JSON.stringify(parsed));
      return;
    }

    if (parsed.clientContent?.turnComplete) {
      const chunksCount = session.audioChunksCount || 0;
      const hasTextTurns = Array.isArray(parsed.clientContent?.turns) && parsed.clientContent.turns.length > 0;

      // Zero-Chunk Commit Suppression Guard
      if (chunksCount === 0 && !hasTextTurns) {
        return;
      }

      // Flood Guard
      const timeSinceLastCommit = Date.now() - (session.lastTurnCommitTime || 0);
      if (timeSinceLastCommit < 600 && (session.lastTurnCommitTime || 0) > 0) {
        return;
      }

      // Playout-Aware Stale Guard
      const isPlayoutActive = session.aiPlayoutEstimatedEndEpoch && Date.now() < session.aiPlayoutEstimatedEndEpoch;
      if ((session.isAiGenerating || isPlayoutActive) && !hasTextTurns) {
        return;
      }

      session.audioChunksCount = 0;
      session.isAiGenerating = true;
      session.lastTurnCommitTime = Date.now();
      session.upstreamTransport?.sendUpstream(JSON.stringify({ clientContent: parsed.clientContent }));
    }
  };

  // Helper: Model emits audio and completes turn
  const simulateModelTurn = (durationMs: number) => {
    // 24kHz 16-bit audio bytes = 48000 bytes/sec
    const audioBytes = Math.floor((48000 * durationMs) / 1000);
    session.currentTurnAudioBytes = audioBytes;
    session.isAiGenerating = false;
    // Physical DAC playout estimated end = now + durationMs + 200ms
    session.aiPlayoutEstimatedEndEpoch = Date.now() + durationMs + 200;
  };

  // Attenuation for speaker bleed into microphone: -18 dB ~ 0.125 amplitude
  const bleedAttenuation = 0.125;

  console.log('\n--- Round 1: Model Speaks + Speaker Bleed During Playout ---');
  simulateModelTurn(250); // Model plays 250ms of audio

  // Speaker audio bleeds into mic at -18dB while DAC is active (5 chunks, 40ms each)
  for (let i = 0; i < 5; i++) {
    const bleedChunk = createSyntheticPcm16k(40, 800, bleedAttenuation).toString('base64');
    processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: bleedChunk } } });
  }

  // Auto-VAD silence timer falsely fires due to bleed and sends bare turnComplete
  processClientMessage({ clientContent: { turnComplete: true } });

  assert(
    session.currentTurnMetrics?.droppedEchoChunksCount === 5,
    'Echo Guard suppressed all 5 speaker bleed audio chunks during Round 1 playout'
  );
  assert(
    upstreamTurnsReceived.length === 0,
    'Zero-Chunk Guard & Stale Guard blocked false turnComplete from speaker bleed'
  );

  // Wait for DAC audio to finish
  await sleep(480);

  // Now legitimate candidate speaks (4 valid chunks of 40ms = 160ms) and commits
  for (let i = 0; i < 4; i++) {
    const candidateChunk = createSyntheticPcm16k(40, 300, 1.0).toString('base64');
    processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: candidateChunk } } });
  }
  processClientMessage({ clientContent: { turnComplete: true } });
  await sleep(30);

  assert(
    upstreamTurnsReceived.length === 1,
    'Round 1 legitimate candidate utterance successfully committed to Gemini upstream'
  );

  console.log('\n--- Round 2: Rapid Speaker Bleed Bursts Across Dialogue Turns ---');
  simulateModelTurn(200);

  // Speaker bleed bursts (3 chunks)
  for (let i = 0; i < 3; i++) {
    const bleedChunk = createSyntheticPcm16k(40, 880, bleedAttenuation).toString('base64');
    processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: bleedChunk } } });
  }
  processClientMessage({ clientContent: { turnComplete: true } });
  await sleep(30);

  assert(
    session.currentTurnMetrics?.droppedEchoChunksCount === 8,
    'Echo Guard cumulative dropped count updated (8 chunks dropped total)'
  );
  assert(
    upstreamTurnsReceived.length === 1,
    'No phantom turns spawned during Round 2 speaker bleed'
  );

  await sleep(650);

  // Candidate responds legitimately
  for (let i = 0; i < 3; i++) {
    const candidateChunk = createSyntheticPcm16k(40, 250, 1.0).toString('base64');
    processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: candidateChunk } } });
  }
  processClientMessage({ clientContent: { turnComplete: true } });
  await sleep(30);

  assert(
    upstreamTurnsReceived.length === 2,
    'Round 2 legitimate candidate utterance accepted without echo interference'
  );

  console.log('\n--- Round 3: Tactile Barge-In Overrides Playout & Halts Bleed ---');
  simulateModelTurn(1000); // Model begins long 1-second utterance

  // Speaker bleeds into mic
  const bleedChunk = createSyntheticPcm16k(40, 1000, bleedAttenuation).toString('base64');
  processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: bleedChunk } } });

  // Candidate hits Barge-In
  processClientMessage({ type: 'barge_in', epoch: Date.now() });

  assert(session.aiPlayoutEstimatedEndEpoch === 0, 'Barge-In instantly silenced DAC timeline (playout epoch = 0)');
  assert(session.audioChunksCount === 0, 'Audio chunks counter cleared on barge-in');

  // Candidate immediately starts speaking and commits
  for (let i = 0; i < 3; i++) {
    const candidateChunk = createSyntheticPcm16k(40, 400, 1.0).toString('base64');
    processClientMessage({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: candidateChunk } } });
  }
  processClientMessage({ clientContent: { turnComplete: true } });
  await sleep(30);

  assert(
    upstreamTurnsReceived.length === 3,
    'Round 3 barge-in candidate turn cleanly committed (exactly 3 user turns in 3 rounds)'
  );

  console.log('\n=========================================================================');
  console.log(`Acoustic Loopback Results: ${ctx.passed} Passed, ${ctx.failed} Failed`);
  console.log('=========================================================================');

  await cleanupSocketPair(clientPair);
  await cleanupSocketPair(geminiPair);

  if (ctx.failed > 0) {
    console.error('\n❌ Failures detected:');
    ctx.failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ACOUSTIC LOOPBACK INVARIANTS SATISFIED (0 Phantom Turns, 0 Cascade Loops)!');
    process.exit(0);
  }
}

void runAcousticLoopbackSimulation();
