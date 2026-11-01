/**
 * liveVoiceEngine.test.ts
 * Contract test for Headless LiveVoiceEngine (SOTA Late 2026).
 */

import assert from 'assert';
import { EventEmitter } from 'events';
import { NativeLiveVoiceEngine as LiveVoiceEngine } from '../src/audio/NativeLiveVoiceEngine';
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
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {}
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
  assert.strictEqual(lastSent.clientContent?.interruption, true, 'clientContent.interruption is true');
  console.log('  ✅ Test 5 Passed: Tactile barge-in cuts AI speech and transitions to LISTENING');

  // Test 5b: Direct handleUserBargeIn invocation
  mockWs.onmessage?.({
    data: JSON.stringify({
      serverContent: {
        modelTurn: { parts: [{ text: 'Еще одна реплика...' }] }
      }
    })
  });
  assert.strictEqual(engine.getState(), 'AI_SPEAKING', 'AI speaking for test 5b');
  engine.handleUserBargeIn();
  assert.strictEqual(engine.getState(), 'LISTENING', 'handleUserBargeIn transitions FSM to LISTENING');
  const userBargeInSent = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
  assert.strictEqual(userBargeInSent.bargeIn, true, 'bargeIn is true');
  assert.strictEqual(userBargeInSent.clientContent?.interruption, true, 'clientContent.interruption is true');
  console.log('  ✅ Test 5b Passed: Direct handleUserBargeIn encapsulates playoutManager and transitions to LISTENING');

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

  // Test 12: Dead-Air Recovery handling
  const engine4 = new LiveVoiceEngine({});
  await engine4.connect({ sessionId: 'test_sess_4', questionId: 'Q_4', sessionType: 'interview', isResumed: true });
  const mockWs4 = (engine4 as any).ws as MockWebSocket;

  // Server signals setup complete
  mockWs4.onmessage?.({
    data: JSON.stringify({ type: 'setupComplete' })
  });
  assert.strictEqual(engine4.getState(), 'LISTENING', 'Engine ready for candidate speech in LISTENING');

  // Candidate commits turn
  engine4.commitSpokenTurn();
  assert.strictEqual(engine4.getInternalState(), 'COMMITTING', 'Engine internal state is COMMITTING upon turn commit');
  assert.strictEqual((engine4 as any).fsm.isCandidateTurnActive(), false, 'Candidate turn custody released (mic locked)');

  // Server watchdog fires and dispatches dead_air_recovery
  mockWs4.onmessage?.({
    data: JSON.stringify({
      type: 'dead_air_recovery',
      reason: 'upstream_timeout',
      timestamp: Date.now()
    })
  });
  assert.strictEqual(engine4.getInternalState(), 'CANDIDATE_LISTENING', 'dead_air_recovery unfreezes FSM back to CANDIDATE_LISTENING');
  assert.strictEqual((engine4 as any).fsm.isCandidateTurnActive(), true, 'Candidate turn custody restored');
  console.log('  ✅ Test 12 Passed: dead_air_recovery unfreezes engine to CANDIDATE_LISTENING');

  // Test 13: Wave 19 Transient Suppression & Speculative Ducking
  let transientFilteredCount = 0;
  const engine5 = new LiveVoiceEngine({
    onTransientFiltered: () => { transientFilteredCount++; }
  });
  await engine5.connect({ sessionId: 'test_sess_5', questionId: 'Q_5', sessionType: 'interview', isResumed: true });
  const mockWs5 = (engine5 as any).ws as MockWebSocket;

  // 13a: Transient cough during AI_SPEAKING must NOT barge in
  mockWs5.onmessage?.({
    data: JSON.stringify({ serverContent: { modelTurn: { parts: [{ text: 'Объяснение...' }] } } })
  });
  assert.strictEqual(engine5.getState(), 'AI_SPEAKING', 'Engine in AI_SPEAKING');

  (engine5 as any).handleMicrophoneChunk('cough_pcm_data', { isTransientSpike: true, rmsDb: -15 });
  assert.strictEqual(engine5.getState(), 'AI_SPEAKING', 'Transient spike during AI_SPEAKING is safely ignored');
  assert.strictEqual(transientFilteredCount, 1, 'onTransientFiltered invoked');
  console.log('  ✅ Test 13a Passed: Transient cough ignored during AI_SPEAKING');

  // 13b: Sustained speech requires 7 frames (224ms) to commit hard barge-in
  for (let f = 1; f <= 6; f++) {
    (engine5 as any).handleMicrophoneChunk('speech_pcm_data', { isTransientSpike: false, rmsDb: -25 });
    assert.strictEqual(engine5.getState(), 'AI_SPEAKING', `Frame ${f}/7 keeps AI speaking with speculative ducking`);
  }
  // 7th frame commits hard barge-in
  (engine5 as any).handleMicrophoneChunk('speech_pcm_data', { isTransientSpike: false, rmsDb: -25 });
  assert.strictEqual(engine5.getState(), 'LISTENING', '7th frame commits hard barge-in and unlocks LISTENING');
  console.log('  ✅ Test 13b Passed: Minimum Voicing Duration (7 frames / 224ms) verified');

  // 13c: Transient cough in LISTENING streams in-place clamped silence
  (engine5 as any).handleMicrophoneChunk('cough_pcm_data', { isTransientSpike: true, rmsDb: -12 });
  const lastChunkMsg = JSON.parse(mockWs5.sentMessages[mockWs5.sentMessages.length - 1]);
  assert.strictEqual(lastChunkMsg.realtimeInput.audio.data.length, 1368, 'Continuous 512-sample clamped silence sent');
  console.log('  ✅ Test 13c Passed: Continuous clamped silence streamed during LISTENING');

  engine2.disconnect();
  engine3.disconnect();
  engine4.disconnect();
  engine5.disconnect();

  console.log('\n🎉 ALL HEADLESS LIVE VOICE ENGINE CONTRACTS SATISFIED!');
}

runLiveVoiceEngineTests().catch((err) => {
  console.error('❌ Contract Test Failed:', err);
  process.exit(1);
});
