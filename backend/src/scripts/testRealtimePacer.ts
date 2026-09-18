/**
 * testRealtimePacer.ts
 *
 * Automated verification of Stage 02:
 * RealtimeAudioPacer drift compensation and chunk serialization accuracy.
 */

import EventEmitter from 'events';
import WebSocket from 'ws';
import { RealtimeAudioPacer } from '../testing/acoustic/realtimeAudioPacer';
import { generateSilence, BYTES_PER_SECOND } from '../testing/acoustic/silenceGenerator';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('🚀 Running Stage 02 Real-Time Audio Pacer Verification...\n');

// Mock WebSocket that records incoming chunk frames and timestamps
class MockPacedWebSocket extends EventEmitter {
  public readyState: number = WebSocket.OPEN;
  public sentFrames: Array<{ data: string; timestamp: number }> = [];

  public send(data: string): void {
    this.sentFrames.push({ data, timestamp: Date.now() });
  }

  public close(): void {
    this.readyState = WebSocket.CLOSED;
  }
}

async function runPacerTest() {
  const mockWs = new MockPacedWebSocket() as any;
  const pcm1s = generateSilence(1000); // 32,000 bytes

  console.log('⏱️ Streaming 1.00s of audio via RealtimeAudioPacer (40ms chunks)...');
  const start = Date.now();
  const result = await RealtimeAudioPacer.streamPcm(mockWs, pcm1s, { chunkDurationMs: 40 });
  const elapsed = Date.now() - start;

  assert(result.chunksSent === 25, `25 chunks were sent for 1000ms audio (got ${result.chunksSent})`);
  assert(mockWs.sentFrames.length === 25, `Mock socket received 25 frames (got ${mockWs.sentFrames.length})`);

  // Verify temporal accuracy: 1000ms audio should take between 970ms and 1080ms in Node.js
  const drift = Math.abs(elapsed - 1000);
  console.log(`📊 Wall-clock elapsed time: ${elapsed}ms (Drift: ${drift}ms)`);
  assert(drift <= 80, `Pacer drift is <= 80ms for 1s stream (got ${drift}ms)`);

  // Verify frame structure: realtimeInput.mediaChunks[0].mimeType === 'audio/pcm;rate=16000'
  const firstFrame = JSON.parse(mockWs.sentFrames[0].data);
  assert(
    firstFrame.realtimeInput?.mediaChunks?.[0]?.mimeType === 'audio/pcm;rate=16000',
    'Frame correctly specifies MIME audio/pcm;rate=16000'
  );

  const base64Data = firstFrame.realtimeInput?.mediaChunks?.[0]?.data;
  const chunkBuf = Buffer.from(base64Data, 'base64');
  assert(chunkBuf.length === 1280, `40ms chunk contains exactly 1280 bytes (got ${chunkBuf.length})`);

  console.log('\n🎉 All Stage 02 Real-Time Audio Pacer assertions passed successfully!');
}

runPacerTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
