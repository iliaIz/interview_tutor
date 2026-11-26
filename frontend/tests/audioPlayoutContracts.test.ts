/**
 * audioPlayoutContracts.test.ts
 * SOTA Web Audio Contract Test Suite driven cleanly across AudioBackendPort (Spec 50 / #186).
 * Zero `(playout as any)` property bypasses.
 */

import assert from 'assert';
import { AudioPlayoutManager, AudioBackendPort } from '../src/services/AudioPlayoutManager';

class FakeAudioBackendPort implements AudioBackendPort {
  public readonly isMobile = false;
  public state: AudioContextState = 'running';
  public gain = 1.5;
  public postedChunks: Float32Array[] = [];
  public flushCount = 0;
  public drainCalls = 0;
  public closed = false;
  private readyListener?: () => void;
  private drainedListener?: () => void;

  public ensureGraph(): { sampleRate: number; state: AudioContextState } {
    return { sampleRate: 24000, state: this.state };
  }

  public async resumeContext(): Promise<void> {
    this.state = 'running';
    this.readyListener?.();
  }

  public getRawContext(): AudioContext {
    return { state: this.state, sampleRate: 24000 } as unknown as AudioContext;
  }

  public setNominalGain(value: number): void {
    this.gain = value;
  }

  public getGainValue(): number {
    return this.gain;
  }

  public postWorkletSamples(samples: Float32Array): boolean {
    if (this.state !== 'running') return false;
    this.postedChunks.push(samples);
    return true;
  }

  public flushWorklet(): void {
    this.flushCount++;
  }

  public drainWorklet(): void {
    this.drainCalls++;
  }

  public onWorkletReady(listener: () => void): void {
    this.readyListener = listener;
  }

  public onWorkletDrained(listener: () => void): void {
    this.drainedListener = listener;
  }

  public simulateDrained(): void {
    this.drainedListener?.();
  }

  public async close(): Promise<void> {
    this.state = 'closed';
    this.closed = true;
  }
}

(global as any).atob = (base64: string) => Buffer.from(base64, 'base64').toString('binary');

async function runAllContracts(): Promise<void> {
  console.log('🧪 Running AudioPlayoutManager AudioBackendPort Contract Tests...');

  // Contract 1: isPlaying() lifecycle & single-fire onPlaybackFinished
  {
    const backend = new FakeAudioBackendPort();
    const playout = new AudioPlayoutManager(backend);
    assert.strictEqual(playout.isPlaying(), false);

    let finished = 0;
    playout.onPlaybackFinished = () => { finished++; };
    const pcm = Buffer.from(new Int16Array(480).buffer).toString('base64');
    playout.enqueuePcmChunk(pcm);
    assert.strictEqual(playout.isPlaying(), true);
    assert.strictEqual(backend.postedChunks.length, 1);

    playout.notifyTurnComplete();
    assert.strictEqual(playout.isPlaying(), true, 'Must stay playing until physical drain');
    backend.simulateDrained();
    assert.strictEqual(playout.isPlaying(), false);
    assert.strictEqual(finished, 1);
    await playout.teardown();
    console.log('  ✅ Contract 1: isPlaying() & worklet drain verified via AudioBackendPort');
  }

  // Contract 2: Dual-Sided Handshake (turnComplete before physical DAC drain + silent zero-chunk turn)
  {
    const backend = new FakeAudioBackendPort();
    const playout = new AudioPlayoutManager(backend);
    let micUnlocked = false;
    playout.onPlaybackFinished = () => { micUnlocked = true; };

    playout.enqueuePcmChunk(Buffer.from(new Int16Array(480).buffer).toString('base64'));
    playout.notifyTurnComplete();
    assert.strictEqual(micUnlocked, false, 'Mic stays gated while DAC drains');
    backend.simulateDrained();
    assert.strictEqual(micUnlocked, true, 'Mic unlocks on physical drain');

    // Zero-chunk silent turn
    const backendSilent = new FakeAudioBackendPort();
    const playoutSilent = new AudioPlayoutManager(backendSilent);
    assert.strictEqual(playoutSilent.isPlaying(), false);
    await playout.teardown();
    await playoutSilent.teardown();
    console.log('  ✅ Contract 2: Dual-Sided Handshake verified');
  }

  // Contract 3: Single-Voice clearQueue() flushes worklet between turns
  {
    const backend = new FakeAudioBackendPort();
    const playout = new AudioPlayoutManager(backend);
    playout.enqueuePcmChunk(Buffer.from(new Int16Array(480).buffer).toString('base64'));
    assert.strictEqual(playout.isPlaying(), true);

    playout.clearQueue();
    assert.strictEqual(playout.isPlaying(), false);
    assert.strictEqual(backend.flushCount, 1);
    await playout.teardown();
    console.log('  ✅ Contract 3: Single-Voice flush verified');
  }

  // Contract 4: Tactile barge-in flushes worklet and enforces nominal gain 1.5
  {
    const backend = new FakeAudioBackendPort();
    backend.gain = 0.0; // simulate stale gain drop before chunk/barge-in
    const playout = new AudioPlayoutManager(backend);
    playout.enqueuePcmChunk(Buffer.from(new Int16Array(480).buffer).toString('base64'));
    assert.strictEqual(backend.getGainValue(), 1.5, 'enqueuePcmChunk restores nominal 1.5 gain');

    backend.gain = 0.2;
    playout.handleInterruption();
    assert.strictEqual(playout.isPlaying(), false);
    assert.strictEqual(backend.flushCount, 1);
    assert.strictEqual(backend.getGainValue(), 1.5, 'handleInterruption preserves nominal 1.5 gain');
    await playout.teardown();
    assert.strictEqual(backend.closed, true);
    console.log('  ✅ Contract 4: Barge-in & nominal gain 1.5 verified');
  }

  console.log('\n🎉 ALL AUDIO PLAYOUT PORT CONTRACTS SATISFIED!');
}

void runAllContracts();
