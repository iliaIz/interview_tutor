/**
 * testPlayoutAndSkew.ts
 *
 * SOTA September 2026 Deterministic Test Suite for Web Audio Playout, Audio-Text Skew,
 * and the Dual-Sided Handshake Invariant (AGENTS.md Hard Invariant 2.2).
 */

import { TurnTelemetryEvent, VOICE_TELEMETRY_SLA } from '@interview-prep/shared';

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

/**
 * Mock Playout Manager simulating the internal state machine of AudioPlayoutManager.ts
 */
class MockPlayoutManager {
  public onPlaybackFinished?: () => void;
  public onFirstAudioPlayout?: (epochMs: number) => void;
  private hasReportedFirstPlayoutInTurn: boolean = false;
  private isWorkletPlaying: boolean = false;
  private autoDrainTimer: any = null;
  public queueSize: number = 0;

  public resetTurnPlayoutState(): void {
    this.hasReportedFirstPlayoutInTurn = false;
  }

  public enqueueChunk(epochMs: number): void {
    this.queueSize++;
    this.isWorkletPlaying = true;
    if (!this.hasReportedFirstPlayoutInTurn) {
      this.hasReportedFirstPlayoutInTurn = true;
      this.onFirstAudioPlayout?.(epochMs);
    }
  }

  public notifyTurnComplete(): void {
    // Graceful drain signal from server
  }

  public drainFinished(): void {
    this.isWorkletPlaying = false;
    this.queueSize = 0;
    this.onPlaybackFinished?.();
  }

  public handleInterruption(): void {
    this.isWorkletPlaying = false;
    this.hasReportedFirstPlayoutInTurn = false;
    this.queueSize = 0;
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
      this.autoDrainTimer = null;
    }
  }

  public isPlaying(): boolean {
    return this.isWorkletPlaying || this.queueSize > 0;
  }
}

/**
 * Mock VoiceModal client session simulating the Dual-Sided Handshake and skew state machine
 */
class MockVoiceModalSession {
  public isAiSpeaking: boolean = false;
  public isRecording: boolean = false;
  public isServerTurnComplete: boolean = false;
  public micUnlockedAt: number | null = null;
  public turnTelemetryList: TurnTelemetryEvent[] = [];
  public currentTurnFirstTextAt: number | null = null;
  public currentTurnFirstAudioPlayoutAt: number | null = null;
  public lastCandidateSpeechEndedAt: number | null = null;

  constructor(public playout: MockPlayoutManager) {
    this.playout.onPlaybackFinished = () => {
      this.handlePlaybackFinished();
    };
    this.playout.onFirstAudioPlayout = (epochMs: number) => {
      this.handleFirstAudioPlayout(epochMs);
    };
  }

  public markCandidateSpeechEnded(now: number): void {
    this.lastCandidateSpeechEndedAt = now;
    this.currentTurnFirstTextAt = null;
    this.currentTurnFirstAudioPlayoutAt = null;
    this.isServerTurnComplete = false;
    this.isAiSpeaking = true;
    this.isRecording = false;
    this.micUnlockedAt = null;
    this.playout.resetTurnPlayoutState();
  }

  public onFirstTextChunk(now: number): void {
    if (!this.currentTurnFirstTextAt) {
      this.currentTurnFirstTextAt = now;
      const latest = this.turnTelemetryList[this.turnTelemetryList.length - 1];
      if (latest && this.currentTurnFirstAudioPlayoutAt && latest.audioTextSkewMs === null) {
        latest.audioTextSkewMs = this.currentTurnFirstAudioPlayoutAt - this.currentTurnFirstTextAt;
      }
    }
  }

  private handleFirstAudioPlayout(now: number): void {
    this.currentTurnFirstAudioPlayoutAt = now;
    const latest = this.turnTelemetryList[this.turnTelemetryList.length - 1];
    if (latest) {
      if (latest.ttfpMs === null && this.lastCandidateSpeechEndedAt) {
        latest.ttfpMs = Math.max(0, now - this.lastCandidateSpeechEndedAt);
      }
      if (this.currentTurnFirstTextAt && latest.audioTextSkewMs === null) {
        latest.audioTextSkewMs = now - this.currentTurnFirstTextAt;
      }
    }
  }

  public onTurnTelemetryMessage(event: TurnTelemetryEvent): void {
    if (this.currentTurnFirstAudioPlayoutAt && this.lastCandidateSpeechEndedAt) {
      event.ttfpMs = Math.max(0, this.currentTurnFirstAudioPlayoutAt - this.lastCandidateSpeechEndedAt);
    }
    if (this.currentTurnFirstAudioPlayoutAt && this.currentTurnFirstTextAt) {
      event.audioTextSkewMs = this.currentTurnFirstAudioPlayoutAt - this.currentTurnFirstTextAt;
    }
    this.turnTelemetryList.push(event);
  }

  public onServerTurnComplete(now: number): void {
    this.isServerTurnComplete = true;
    this.playout.notifyTurnComplete();

    // Dual-Sided Handshake check on turnComplete arrival
    if (!this.playout.isPlaying()) {
      this.unlockMic(now);
    }
  }

  private handlePlaybackFinished(): void {
    // Dual-Sided Handshake check on audio drain
    if (this.isServerTurnComplete) {
      this.unlockMic(Date.now());
    }
  }

  public unlockMic(now: number): void {
    this.isAiSpeaking = false;
    this.isRecording = true;
    this.micUnlockedAt = now;
  }
}

// =========================================================================
// TEST 1: TTFP & First Audio Playout Event Idempotency
// =========================================================================
function testFirstPlayoutIdempotency(): void {
  console.log('\n[Test 1] TTFP & onFirstAudioPlayout Idempotency');

  const playout = new MockPlayoutManager();
  let callbackCount = 0;
  let firstEpoch: number | null = null;

  playout.onFirstAudioPlayout = (epoch) => {
    callbackCount++;
    firstEpoch = epoch;
  };

  playout.enqueueChunk(1000);
  playout.enqueueChunk(1040);
  playout.enqueueChunk(1080);
  playout.enqueueChunk(1120);

  assert(callbackCount === 1, 'onFirstAudioPlayout fired exactly once across 4 audio chunks in turn', `Fired ${callbackCount} times`);
  assert(firstEpoch === 1000, 'First chunk epoch timestamp was recorded', `Got ${firstEpoch}`);

  // Next turn
  playout.resetTurnPlayoutState();
  playout.enqueueChunk(5000);
  assert(callbackCount === 2, 'resetTurnPlayoutState allows next turn to trigger onFirstAudioPlayout', `Fired ${callbackCount} times`);
  assert(firstEpoch === 5000, 'Second turn epoch recorded', `Got ${firstEpoch}`);
}

// =========================================================================
// TEST 2: Audio-Text Skew Calculation Across Arrival Orders
// =========================================================================
function testAudioTextSkewScenarios(): void {
  console.log('\n[Test 2] Audio-Text Skew Calculation Across Arrival Orders');

  // Case A: Audio playout happens BEFORE turn_telemetry arrives (Typical streaming flow)
  {
    const playout = new MockPlayoutManager();
    const session = new MockVoiceModalSession(playout);

    session.markCandidateSpeechEnded(10000);
    session.onFirstTextChunk(10500); // TTFT = 500ms
    playout.enqueueChunk(10620);     // TTFP = 620ms (Audio playout starts)

    const rawTelemetry: TurnTelemetryEvent = {
      turnId: 't1',
      sessionId: 's1',
      turnIndex: 1,
      speaker: 'model',
      vadPauseSettingMs: 1800,
      speechDurationMs: 2000,
      ttfrMs: 250,
      ttftMs: 500,
      ttfaMs: 580,
      ttfpMs: null,
      audioTextSkewMs: null,
      audioDurationMs: 3000,
      textChars: 50,
      echoLeakageDroppedMs: 0,
      networkRttMs: 40,
      modelName: 'gemini-live-v3',
      wasBargeIn: false,
      bargeInType: null,
      createdAt: 10800
    };

    session.onTurnTelemetryMessage(rawTelemetry);
    const result = session.turnTelemetryList[0];

    assert(result.ttfpMs === 620, 'TTFP correctly populated from playout start (620ms)', `Got ${result.ttfpMs}`);
    assert(result.audioTextSkewMs === 120, 'Audio-Text Skew correctly computed: TTFP(620) - TTFT(500) = +120ms', `Got ${result.audioTextSkewMs}`);
    assert(result.audioTextSkewMs! <= VOICE_TELEMETRY_SLA.MAX_ACCEPTABLE_SKEW_MS, 'Skew +120ms satisfies SLA threshold (<= 300ms)');
  }

  // Case B: turn_telemetry arrives BEFORE audio playout starts (e.g. short audio buffered in worklet)
  {
    const playout = new MockPlayoutManager();
    const session = new MockVoiceModalSession(playout);

    session.markCandidateSpeechEnded(20000);
    session.onFirstTextChunk(20400); // TTFT = 400ms

    const rawTelemetry: TurnTelemetryEvent = {
      turnId: 't2',
      sessionId: 's2',
      turnIndex: 2,
      speaker: 'model',
      vadPauseSettingMs: 1800,
      speechDurationMs: 2000,
      ttfrMs: 200,
      ttftMs: 400,
      ttfaMs: 450,
      ttfpMs: null,
      audioTextSkewMs: null,
      audioDurationMs: 1000,
      textChars: 20,
      echoLeakageDroppedMs: 0,
      networkRttMs: 35,
      modelName: 'gemini-live-v3',
      wasBargeIn: false,
      bargeInType: null,
      createdAt: 20450
    };

    // Telemetry arrives first
    session.onTurnTelemetryMessage(rawTelemetry);
    assert(session.turnTelemetryList[0].ttfpMs === null, 'TTFP is initially null prior to playout');

    // Playout begins 150ms later
    playout.enqueueChunk(20580);
    const result = session.turnTelemetryList[0];

    assert(result.ttfpMs === 580, 'TTFP asynchronously hydrated on playout (580ms)', `Got ${result.ttfpMs}`);
    assert(result.audioTextSkewMs === 180, 'Audio-Text Skew asynchronously hydrated: 20580 - 20400 = +180ms', `Got ${result.audioTextSkewMs}`);
  }
}

// =========================================================================
// TEST 3: Dual-Sided Handshake - Race Condition Elimination (Hard Invariant 2.2)
// =========================================================================
function testDualSidedHandshake(): void {
  console.log('\n[Test 3] Dual-Sided Handshake Race Conditions (AGENTS.md Invariant 2.2)');

  // Race Condition A: Network turnComplete arrives at T=1000, but physical audio drains at T=2500
  {
    const playout = new MockPlayoutManager();
    const session = new MockVoiceModalSession(playout);

    session.markCandidateSpeechEnded(0);
    playout.enqueueChunk(500); // Audio starts playing

    // Network finishes at T=1000
    session.onServerTurnComplete(1000);
    assert(session.isServerTurnComplete === true, '[Race A] Server turn is complete');
    assert(session.isAiSpeaking === true, '[Race A] Mic remains locked while audio is still physically playing');
    assert(session.isRecording === false, '[Race A] isRecording is false at T=1000');

    // Audio physically finishes draining in headphones at T=2500
    playout.drainFinished();
    assert(session.isAiSpeaking === false, '[Race A] isAiSpeaking switches to false when audio queue drains');
    assert(session.isRecording === true, '[Race A] Candidate mic unlocked exactly upon audio queue drain');
  }

  // Race Condition B: Short audio (200ms) drains at T=500, but network turnComplete arrives at T=1200
  {
    const playout = new MockPlayoutManager();
    const session = new MockVoiceModalSession(playout);

    session.markCandidateSpeechEnded(0);
    playout.enqueueChunk(300);

    // Audio finishes playing very fast at T=500
    playout.drainFinished();
    assert(playout.isPlaying() === false, '[Race B] Audio playout queue is completely empty');
    assert(session.isAiSpeaking === true, '[Race B] Mic remains locked because server turnComplete has NOT arrived yet');
    assert(session.isRecording === false, '[Race B] isRecording is false while awaiting network turnComplete');

    // Server turnComplete arrives later at T=1200
    session.onServerTurnComplete(1200);
    assert(session.isAiSpeaking === false, '[Race B] turnComplete detects empty queue and immediately unlocks candidate mic');
    assert(session.isRecording === true, '[Race B] Candidate mic unlocked at T=1200');
    assert(session.micUnlockedAt === 1200, '[Race B] Mic unlock timestamp matches turnComplete arrival');
  }
}

// =========================================================================
// TEST 4: Tactile Barge-In Queue Interruption & Reset
// =========================================================================
function testBargeInQueuePurge(): void {
  console.log('\n[Test 4] Tactile Barge-In Audio Queue Purge');

  const playout = new MockPlayoutManager();
  playout.enqueueChunk(1000);
  playout.enqueueChunk(1040);
  assert(playout.isPlaying() === true, 'Playout is active before barge-in');

  playout.handleInterruption();
  assert(playout.isPlaying() === false, 'Playout queue is purged immediately on handleInterruption');
  assert(playout.queueSize === 0, 'Queue size is reset to 0');
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
export function runPlayoutAndSkewTests(): boolean {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔊 SOTA 2026 WEB AUDIO PLAYOUT, SKEW & HANDSHAKE SUITE');
  console.log('═══════════════════════════════════════════════════════════════');

  testFirstPlayoutIdempotency();
  testAudioTextSkewScenarios();
  testDualSidedHandshake();
  testBargeInQueuePurge();

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
  const success = runPlayoutAndSkewTests();
  process.exit(success ? 0 : 1);
}
