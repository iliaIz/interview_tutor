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

  // Test 7: Gemini 3.8 Live interactionStatus: IN_PROGRESS (Cognitive filler / intermediate reasoning)
  let receivedEvaluation: any = null;
  let receivedWhiteboard: any = null;

  const engine2 = new LiveVoiceEngine({
    onEvaluationReceived: (res) => { receivedEvaluation = res; },
    onWhiteboardUpdate: (wb) => { receivedWhiteboard = wb; }
  });

  await engine2.connect({
    sessionId: 'test_engine_sess_2',
    questionId: 'Q_2',
    sessionType: 'interview',
    topic: 'Spring'
  });

  const mockWs2 = (engine2 as any).ws as MockWebSocket;

  // AI begins speaking a filler
  mockWs2.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        modelTurn: { parts: [{ text: 'Дай подумать...' }] }
      }
    })
  });
  assert.strictEqual(engine2.getState(), 'AI_SPEAKING', 'AI speaking filler');

  // Server sends turnComplete: true, but interactionStatus: IN_PROGRESS
  mockWs2.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        turnComplete: true,
        interactionStatus: 'IN_PROGRESS'
      }
    })
  });
  assert.strictEqual(engine2.getState(), 'AI_SPEAKING', 'Mic must remain LOCKED when interactionStatus is IN_PROGRESS');
  console.log('  ✅ Test 7 Passed: interactionStatus IN_PROGRESS holds candidate turn custody');

  // Server sends final turnComplete with interactionStatus: IDLE
  mockWs2.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        turnComplete: true,
        interactionStatus: 'IDLE'
      }
    })
  });
  assert.strictEqual(engine2.getState(), 'LISTENING', 'Mic unlocked when interactionStatus is IDLE');
  console.log('  ✅ Test 8 Passed: interactionStatus IDLE unblocks candidate turn');

  // Test 9: evaluation_completed event handling
  mockWs2.onmessage?.({
    data: JSON.stringify({
      type: 'evaluation_completed',
      evaluation: {
        score: 95,
        isPassed: true,
        feedback: 'Отличный ответ по Spring!',
        positivePoints: ['DI/IoC'],
        missingPoints: []
      }
    })
  });
  assert.strictEqual(engine2.getState(), 'COMPLETED', 'Engine transitions to COMPLETED on evaluation_completed');
  assert.strictEqual(receivedEvaluation?.score, 95, 'Evaluation payload received with score 95');
  console.log('  ✅ Test 9 Passed: evaluation_completed correctly delivered to callback and sets COMPLETED');

  // Test 10: whiteboard_update event handling
  mockWs2.onmessage?.({
    data: JSON.stringify({
      type: 'whiteboard_update',
      payload: {
        code: '@Service\npublic class PaymentService {}',
        language: 'java',
        title: 'Архитектура сервиса'
      }
    })
  });
  assert.strictEqual(receivedWhiteboard?.title, 'Архитектура сервиса', 'Whiteboard update dispatched to callback');
  console.log('  ✅ Test 10 Passed: whiteboard_update event delivered');

  // Test 11: Turn 0 Acoustic Lockdown & Mid-Dialogue Acoustic Barge-In
  const engine3 = new LiveVoiceEngine({});
  await engine3.connect({ sessionId: 'test_sess_3', questionId: 'Q_3', sessionType: 'interview' });
  const mockWs3 = (engine3 as any).ws as MockWebSocket;

  mockWs3.onmessage?.({
    data: JSON.stringify({
      serverContent: { modelTurn: { parts: [{ text: 'Привет! Расскажи о Spring Boot...' }] } }
    })
  });
  assert.strictEqual(engine3.getState(), 'AI_SPEAKING', 'Engine in AI_SPEAKING during Turn 0 question recitation');

  // 11a: Candidate mic bleed / noise during Turn 0 question recitation MUST NOT barge in
  (engine3 as any).handleMicrophoneChunk('dummy_pcm_base64', { speechDetected: true, rmsDb: -15 });
  assert.strictEqual(engine3.getState(), 'AI_SPEAKING', 'Turn 0 Acoustic Lockdown prevents mic bleed from interrupting question');
  console.log('  ✅ Test 11a Passed: Turn 0 Acoustic Lockdown protects initial question recitation');

  // Turn 0 recitation concludes (audio playout finished & server sent turnComplete)
  mockWs3.onmessage?.({
    data: JSON.stringify({
      serverContent: { turnComplete: true, interactionStatus: 'IDLE' }
    })
  });
  (engine3 as any).handleAudioPlayoutFinished();
  assert.strictEqual(engine3.getState(), 'LISTENING', 'Candidate mic unlocked after Turn 0 question finished playing');

  // 11b: AI begins mid-dialogue speech
  mockWs3.onmessage?.({
    data: JSON.stringify({
      serverContent: { modelTurn: { parts: [{ text: 'Длинное объяснение...' }] } }
    })
  });
  assert.strictEqual(engine3.getState(), 'AI_SPEAKING', 'Engine in AI_SPEAKING mid-dialogue');

  // Candidate speaks loudly into microphone (metrics.speechDetected = true, rmsDb = -15)
  (engine3 as any).handleMicrophoneChunk('dummy_pcm_base64', { speechDetected: true, rmsDb: -15 });
  assert.strictEqual(engine3.getState(), 'LISTENING', 'Acoustic speech detection interrupts AI speech mid-dialogue and switches to LISTENING');
  const acousticSent = JSON.parse(mockWs3.sentMessages[mockWs3.sentMessages.length - 1]);
  assert.strictEqual(acousticSent.bargeIn, true, 'Acoustic barge-in tagged with bargeIn: true');
  assert.strictEqual(acousticSent.bargeInType, 'acoustic', 'Tagged with bargeInType acoustic');
  console.log('  ✅ Test 11b Passed: Mid-dialogue acoustic barge-in triggers instant interruption and mic unlock');

  engine2.disconnect();
  engine3.disconnect();

  console.log('\n🎉 ALL HEADLESS LIVE VOICE ENGINE CONTRACTS SATISFIED!');
}

runLiveVoiceEngineTests().catch((err) => {
  console.error('❌ Contract Test Failed:', err);
  process.exit(1);
});
