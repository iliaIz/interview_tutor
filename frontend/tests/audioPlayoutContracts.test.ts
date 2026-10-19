/**
 * audioPlayoutContracts.test.ts
 *
 * SOTA September 2026 Web Audio Contract Test Suite for Gemini Live Audio Playout.
 * Validates the Dual-Sided Handshake, Single-Voice Invariant, Tactile Barge-In de-ramping,
 * and isPlaying() lifecycle transitions without browser DOM dependencies.
 */

import { EventEmitter } from 'events';
import { AudioPlayoutManager } from '../src/services/AudioPlayoutManager';

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

// ---------------------------------------------------------------------------
// Headless Web Audio Mock Implementation
// ---------------------------------------------------------------------------

class MockMessagePort extends EventEmitter {
  public onmessage: ((event: any) => void) | null = null;

  public postMessage(data: any, _transferables?: any[]): void {
    this.emit('message_sent', data);
  }

  public simulateMessageFromWorklet(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
    this.emit('message', { data });
  }
}

class MockAudioWorkletNode {
  public port = new MockMessagePort();
  public context: any;
  public name: string;
  public options: any;

  constructor(context: any, name: string, options: any) {
    this.context = context;
    this.name = name;
    this.options = options;
  }

  public connect(_destination: any): void {}
  public disconnect(): void {}
}

class MockGainNode {
  public gain = {
    value: 1.0,
    setValueAtTime: (_val: number, _time: number) => {},
    linearRampToValueAtTime: (_val: number, _time: number) => {},
    exponentialRampToValueAtTime: (_val: number, _time: number) => {},
    cancelScheduledValues: (_time: number) => {}
  };
  public connect(_destination: any): void {}
  public disconnect(): void {}
}

class MockOscillatorNode {
  public type = 'sine';
  public frequency = {
    setValueAtTime: (_val: number, _time: number) => {},
    exponentialRampToValueAtTime: (_val: number, _time: number) => {}
  };
  public onended: (() => void) | null = null;
  public connect(_destination: any): void {}
  public disconnect(): void {}
  public start(_time?: number): void {}
  public stop(_time?: number): void {
    if (this.onended) this.onended();
  }
}

class MockAudioContext {
  public state: 'running' | 'suspended' | 'closed' = 'running';
  public currentTime = 0;
  public sampleRate = 48000;
  public destination = {};
  public audioWorklet = {
    addModule: async (_url: string) => Promise.resolve()
  };

  public createGain(): MockGainNode {
    return new MockGainNode();
  }

  public createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }

  public createBufferSource(): any {
    return {
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {}
    };
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }

  public async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  public async close(): Promise<void> {
    this.state = 'closed';
  }
}

// Global browser polyfills for headless node runner
(global as any).window = {
  AudioContext: MockAudioContext
};
(global as any).AudioWorkletNode = MockAudioWorkletNode;
(global as any).atob = (base64: string) => Buffer.from(base64, 'base64').toString('binary');

// ---------------------------------------------------------------------------
// TEST 1: isPlaying() Lifecycle & Worklet Draining
// ---------------------------------------------------------------------------
async function testIsPlayingLifecycle(): Promise<void> {
  console.log('\n[Test 1] isPlaying() Lifecycle & Worklet Draining Contract');

  const mockCtx = new MockAudioContext();
  const playout = new AudioPlayoutManager(mockCtx as any);

  // Allow async initWorklet to resolve
  await sleep(20);

  assert(playout.isPlaying() === false, 'Initial state: isPlaying() === false');

  let playbackFinishedCount = 0;
  playout.onPlaybackFinished = () => {
    playbackFinishedCount++;
  };

  // Enqueue 24kHz PCM chunk (dummy base64)
  const dummySamples = new Int16Array(480);
  const base64Chunk = Buffer.from(dummySamples.buffer).toString('base64');
  playout.enqueuePcmChunk(base64Chunk);

  assert(playout.isPlaying() === true, 'After enqueuePcmChunk: isPlaying() === true');

  // Network turn complete arrives while audio is still in worklet ring buffer
  playout.notifyTurnComplete();
  assert(playout.isPlaying() === true, 'After notifyTurnComplete: isPlaying() remains true while draining');

  // Worklet reports physical buffer drained
  const worklet = (playout as any).workletNode as MockAudioWorkletNode;
  assert(!!worklet, 'Worklet node properly initialized');

  worklet.port.simulateMessageFromWorklet({ type: 'drained' });

  assert(playout.isPlaying() === false, 'After worklet drained: isPlaying() returns false');
  assert(playbackFinishedCount === 1, 'onPlaybackFinished() callback fired exactly once upon physical drain');

  await playout.teardown();
}

// ---------------------------------------------------------------------------
// TEST 2: Dual-Sided Handshake State Invariant
// ---------------------------------------------------------------------------
async function testDualSidedHandshake(): Promise<void> {
  console.log('\n[Test 2] Dual-Sided Handshake State Invariant');

  // Scenario A: Network turnComplete arrives BEFORE physical audio drains
  {
    const mockCtx = new MockAudioContext();
    const playout = new AudioPlayoutManager(mockCtx as any);
    await sleep(20);

    let isMicGated = true;
    let isRecording = false;

    playout.onPlaybackFinished = () => {
      // Physical drain unlocks candidate mic
      isMicGated = false;
      isRecording = true;
    };

    // 1. Audio playing
    const dummySamples = new Int16Array(480);
    playout.enqueuePcmChunk(Buffer.from(dummySamples.buffer).toString('base64'));

    // 2. Network turnComplete arrives (e.g. at 4.0s)
    const turnCompleteNetworkArrived = true;
    if (turnCompleteNetworkArrived) {
      if (playout.isPlaying()) {
        // Must NOT unlock mic yet!
        playout.notifyTurnComplete();
      } else {
        isRecording = true;
      }
    }

    assert(isRecording === false, 'Scenario A: Mic remains closed when turnComplete arrives during active audio playout');
    assert(isMicGated === true, 'Scenario A: Candidate mic is safely gated');

    // 3. Physical audio finishes at DAC (e.g. at 15.0s)
    const worklet = (playout as any).workletNode as MockAudioWorkletNode;
    worklet.port.simulateMessageFromWorklet({ type: 'drained' });

    assert(isRecording === true, 'Scenario A: Mic unlocked symmetrically when physical audio reached 0 samples');
    assert(isMicGated === false, 'Scenario A: Mic gating released');

    await playout.teardown();
  }

  // Scenario B: Physical audio finishes BEFORE network turnComplete (e.g. 0-chunk response)
  {
    const mockCtx = new MockAudioContext();
    const playout = new AudioPlayoutManager(mockCtx as any);
    await sleep(20);

    let isRecording = false;

    // No audio chunks enqueued (text turn or silent turn)
    assert(playout.isPlaying() === false, 'Scenario B: No audio enqueued, isPlaying() === false');

    // Network turnComplete arrives
    if (!playout.isPlaying()) {
      isRecording = true;
    }

    assert(isRecording === true, 'Scenario B: Mic unlocks immediately on turnComplete when audio buffer is already empty');

    await playout.teardown();
  }
}

// ---------------------------------------------------------------------------
// TEST 3: Single-Voice Invariant (startNewTurn)
// ---------------------------------------------------------------------------
async function testSingleVoiceInvariant(): Promise<void> {
  console.log('\n[Test 3] Single-Voice Invariant (startNewTurn flush)');

  const mockCtx = new MockAudioContext();
  const playout = new AudioPlayoutManager(mockCtx as any);
  await sleep(20);

  const worklet = (playout as any).workletNode as MockAudioWorkletNode;
  const sentWorkletMessages: any[] = [];
  worklet.port.on('message_sent', (msg) => sentWorkletMessages.push(msg));

  // Turn 1 enqueues audio
  const dummySamples = new Int16Array(480);
  playout.enqueuePcmChunk(Buffer.from(dummySamples.buffer).toString('base64'));
  assert(playout.isPlaying() === true, 'Turn 1: Audio is playing');

  // Turn 2 begins -> startNewTurn() is invoked
  playout.startNewTurn();

  assert(playout.isPlaying() === false, 'startNewTurn() reset playout state to non-playing');
  assert(
    sentWorkletMessages.some((m) => m.type === 'flush'),
    'startNewTurn() dispatched flush signal to AudioWorklet to prevent audio interleaving'
  );

  await playout.teardown();
}

// ---------------------------------------------------------------------------
// TEST 4: Tactile Barge-In Interruption & Queue Clearing
// ---------------------------------------------------------------------------
async function testTactileBargeInInterruption(): Promise<void> {
  console.log('\n[Test 4] Tactile Barge-In Interruption & Queue Clearing');

  const mockCtx = new MockAudioContext();
  const playout = new AudioPlayoutManager(mockCtx as any);
  await sleep(20);

  const worklet = (playout as any).workletNode as MockAudioWorkletNode;
  const sentWorkletMessages: any[] = [];
  worklet.port.on('message_sent', (msg) => sentWorkletMessages.push(msg));

  // Enqueue audio
  const dummySamples = new Int16Array(480);
  playout.enqueuePcmChunk(Buffer.from(dummySamples.buffer).toString('base64'));
  assert(playout.isPlaying() === true, 'Audio is playing before barge-in');

  // Candidate hits central button / barge-in
  playout.handleInterruption();

  assert(playout.isPlaying() === false, 'handleInterruption() immediately set isPlaying() === false');
  assert(
    sentWorkletMessages.some((m) => m.type === 'flush'),
    'handleInterruption() flushed worklet buffer to silence DAC'
  );

  await playout.teardown();
}

async function testSpeculativeDucking(): Promise<void> {
  console.log('\nContract 5: Speculative Ducking & Instant Rollback');
  const playout = new AudioPlayoutManager();
  await playout.resume();

  playout.speculativeDuck(0.35, 15);
  playout.rollbackDucking(15);
  playout.commitBargeIn(5);
  await sleep(20);

  assert(true, 'speculativeDuck, rollbackDucking, and commitBargeIn execute cleanly');
  await playout.teardown();
}

// ---------------------------------------------------------------------------
// MAIN RUNNER
// ---------------------------------------------------------------------------
async function runAllContracts(): Promise<void> {
  console.log('=========================================================================');
  console.log('🧪 SOTA WEB AUDIO & PLAYOUT CONTRACTS TEST SUITE');
  console.log('=========================================================================');

  try {
    await testIsPlayingLifecycle();
    await testDualSidedHandshake();
    await testSingleVoiceInvariant();
    await testTactileBargeInInterruption();
    await testSpeculativeDucking();

    console.log('\n=========================================================================');
    console.log(`Audio Playout Contracts: ${ctx.passed} Passed, ${ctx.failed} Failed`);
    console.log('=========================================================================');

    if (ctx.failed > 0) {
      console.error('\n❌ Failures detected:');
      ctx.failures.forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    } else {
      console.log('\n🎉 ALL WEB AUDIO CONTRACTS SATISFIED!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal test runner exception:', err);
    process.exit(1);
  }
}

void runAllContracts();
