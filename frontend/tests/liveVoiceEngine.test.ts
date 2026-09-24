/**
 * liveVoiceEngine.test.ts
 * Contract test for Headless LiveVoiceEngine (SOTA Late 2026).
 */

import assert from 'assert';
import { EventEmitter } from 'events';
import { LiveVoiceEngine } from '../src/audio/LiveVoiceEngine';
import { VoiceEngineState } from '../src/audio/types';

class MockMessagePort extends EventEmitter {
  public onmessage: ((event: any) => void) | null = null;
  public postMessage(data: any): void {
    this.emit('message_sent', data);
  }
}

class MockAudioWorkletNode {
  public port = new MockMessagePort();
  constructor(public context: any, public name: string, public options?: any) {}
  public connect(_dest: any): void {}
  public disconnect(): void {}
}

class MockGainNode {
  public gain = {
    value: 1.0,
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {}
  };
  public connect(): void {}
  public disconnect(): void {}
}

class MockAudioContext {
  public state: string = 'running';
  public currentTime = 0;
  public sampleRate = 48000;
  public destination = {};
  public audioWorklet = {
    addModule: async () => Promise.resolve()
  };
  public createGain() { return new MockGainNode(); }
  public createMediaStreamDestination() { return { stream: {} }; }
  public createMediaStreamSource() { return { connect: () => {} }; }
  public resume = async () => {};
}

// Mock Web Audio and WebSocket environment for Node.js
if (typeof window === 'undefined') {
  (global as any).window = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    AudioWorkletNode: MockAudioWorkletNode,
    location: { protocol: 'http:', host: 'localhost:5173', hostname: 'localhost', port: '5173' },
    btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64: string) => Buffer.from(b64, 'base64').toString('binary')
  };
  (global as any).AudioContext = MockAudioContext;
  (global as any).webkitAudioContext = MockAudioContext;
  (global as any).AudioWorkletNode = MockAudioWorkletNode;
  try {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => {} }],
          getAudioTracks: () => [{ enabled: true }]
        })
      },
      configurable: true
    });
  } catch {}
}

class MockWebSocket {
  public static OPEN = 1;
  public readyState = MockWebSocket.OPEN;
  public sentMessages: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((ev: { data: string }) => void) | null = null;
  public onclose: ((ev: any) => void) | null = null;
  public onerror: ((err: any) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 10);
  }

  public send(msg: string) {
    this.sentMessages.push(msg);
  }

  public close() {
    this.onclose?.({ code: 1000 });
  }
}

(global as any).WebSocket = MockWebSocket;

async function runLiveVoiceEngineTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧪 SOTA 2026 HEADLESS LIVE VOICE ENGINE CONTRACT TESTS');
  console.log('═══════════════════════════════════════════════════════════════');

  const statesObserved: VoiceEngineState[] = [];
  const statusMessages: string[] = [];

  const engine = new LiveVoiceEngine({
    onStateChange: (state) => statesObserved.push(state),
    onStatusMessage: (msg) => statusMessages.push(msg)
  });

  // Test 1: Initial State
  assert.strictEqual(engine.getState(), 'IDLE', 'Initial state must be IDLE');
  console.log('  ✅ Test 1 Passed: Initial state is IDLE');

  // Test 2: Connection Lifecycle & Terminal Equivalence
  await engine.connect({
    sessionId: 'test_engine_sess_1',
    questionId: 'Q_1',
    sessionType: 'interview',
    topic: 'Java',
    turnMode: 'auto'
  });

  assert.strictEqual(engine.getState(), 'CONNECTING', 'State transitions to CONNECTING on connect');
  console.log('  ✅ Test 2 Passed: Connect transitions state to CONNECTING');

  // Simulate server sending modelTurn (AI begins speaking)
  const mockWs = (engine as any).ws as MockWebSocket;
  mockWs.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [{ text: 'Привет! Расскажи о Spring Boot.' }]
        }
      }
    })
  });

  assert.strictEqual(engine.getState(), 'AI_SPEAKING', 'State transitions to AI_SPEAKING when modelTurn arrives');
  console.log('  ✅ Test 3 Passed: modelTurn transitions state to AI_SPEAKING');

  // Simulate server sending ONLY generationComplete: true
  mockWs.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        generationComplete: true
      }
    })
  });

  // Audio queue drained -> must transition to LISTENING
  assert.strictEqual(engine.getState(), 'LISTENING', 'State transitions to LISTENING on generationComplete');
  console.log('  ✅ Test 4 Passed: generationComplete unlocks candidate turn to LISTENING');

  // Test 5: Tactile Barge-In
  // Simulate AI starts speaking again
  mockWs.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        modelTurn: {
          parts: [{ text: 'Продолжаю рассказ...' }]
        }
      }
    })
  });
  assert.strictEqual(engine.getState(), 'AI_SPEAKING', 'AI is speaking again');

  // User clicks central button during AI speech -> Tactile Barge-In
  engine.handleCentralButtonClick();
  assert.strictEqual(engine.getState(), 'LISTENING', 'Tactile click instantly unlocks LISTENING');
  const lastSent = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
  assert.strictEqual(lastSent.bargeIn, true, 'Barge-in frame sent with bargeIn: true');
  console.log('  ✅ Test 5 Passed: Tactile barge-in cuts AI speech and transitions to LISTENING');

  engine.disconnect();
  assert.strictEqual(engine.getState(), 'IDLE', 'Disconnect resets state to IDLE');
  console.log('  ✅ Test 6 Passed: Disconnect cleanly returns to IDLE');

  console.log('\n🎉 ALL HEADLESS LIVE VOICE ENGINE CONTRACTS SATISFIED!');
}

runLiveVoiceEngineTests().catch((err) => {
  console.error('❌ Contract Test Failed:', err);
  process.exit(1);
});
