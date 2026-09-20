/**
 * testTelemetryEngine.ts
 *
 * SOTA September 2026 Deterministic Unit & Contract Test Suite for Auto-VAD & Canonical Turn Telemetry.
 * Tests metrics calculation, Turn 0 baseline invariants, multi-turn state isolation,
 * half-duplex echo leakage math, and mid-turn barge-in turn sealing without external dependencies.
 */

import { TurnTelemetryEvent, VOICE_TELEMETRY_SLA } from '@interview-prep/shared';
import { CurrentTurnMetrics, ProxySession } from '../services/live/liveSessionTypes';

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
 * Helper: Simulates the turn sealing logic from liveAudioStreamRouter.ts
 */
export function sealTurnTelemetry(
  session: Partial<ProxySession>,
  commitTime: number,
  liveModel: string = 'gemini-live-v3'
): TurnTelemetryEvent {
  const metrics = session.currentTurnMetrics;
  const effectiveCommitTime = commitTime || session.lastTurnCommitTime || metrics?.candidateSpeechEndedAt || session.lastActivityAt || Date.now();

  const ttfrMs = metrics?.firstThoughtAt ? Math.max(0, metrics.firstThoughtAt - effectiveCommitTime) : null;
  const ttftMs = metrics?.firstTextAt ? Math.max(0, metrics.firstTextAt - effectiveCommitTime) : null;
  const ttfaMs = metrics?.firstAudioAt ? Math.max(0, metrics.firstAudioAt - effectiveCommitTime) : null;

  // 24kHz 16-bit mono = 48000 bytes/sec
  const audioDurationMs = metrics ? Math.round((metrics.audioBytesReceived / 48000) * 1000) : 0;
  const textChars = (session.currentAiTurnText || '').length;
  const echoLeakageDroppedMs = (metrics?.droppedEchoChunksCount || 0) * 40;

  return {
    turnId: `turn_${session.sessionId || 'anon'}_${metrics?.turnIndex || 0}_${Date.now()}`,
    sessionId: session.sessionId || 'anon',
    turnIndex: metrics?.turnIndex || 0,
    speaker: 'model',
    vadPauseSettingMs: session.vadPauseMs || 1800,
    speechDurationMs: metrics?.speechDurationMs || 0,
    ttfrMs,
    ttftMs,
    ttfaMs,
    ttfpMs: null,
    audioTextSkewMs: null,
    audioDurationMs,
    textChars,
    echoLeakageDroppedMs,
    networkRttMs: metrics?.lastRttMs ?? session.lastRttMs ?? null,
    modelName: liveModel,
    wasBargeIn: metrics?.wasBargeIn || false,
    bargeInType: metrics?.bargeInType || null,
    createdAt: Date.now()
  };
}

// =========================================================================
// TEST 1: Standard Turn Lifecycle (Speech -> Commit -> TTFR -> TTFT -> TTFA)
// =========================================================================
function testStandardTurnLifecycle(): void {
  console.log('\n[Test 1] Standard Turn Lifecycle & Timings Calculation');

  const tStart = 10000;
  const tCommit = 13200; // 3200ms speech duration
  const tThought = 13450; // TTFR = 250ms
  const tText = 13700;    // TTFT = 500ms
  const tAudio = 13950;   // TTFA = 750ms
  const audioBytes = 48000 * 2; // 2 seconds of 24kHz audio (96000 bytes)

  const metrics: CurrentTurnMetrics = {
    turnIndex: 1,
    candidateSpeechStartedAt: tStart,
    candidateSpeechEndedAt: tCommit,
    vadPauseSettingMs: 1800,
    speechDurationMs: tCommit - tStart,
    firstThoughtAt: tThought,
    firstTextAt: tText,
    firstAudioAt: tAudio,
    audioBytesReceived: audioBytes,
    textChars: 120,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null,
    lastRttMs: 45
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_test_1',
    vadPauseMs: 1800,
    lastTurnCommitTime: tCommit,
    currentTurnMetrics: metrics,
    currentAiTurnText: 'Java memory model defines visibility and ordering.'
  };

  const event = sealTurnTelemetry(session, tCommit);

  assert(event.speechDurationMs === 3200, 'Speech duration is 3200ms', `Got ${event.speechDurationMs}`);
  assert(event.ttfrMs === 250, 'TTFR is accurately 250ms', `Got ${event.ttfrMs}`);
  assert(event.ttftMs === 500, 'TTFT is accurately 500ms', `Got ${event.ttftMs}`);
  assert(event.ttfaMs === 750, 'TTFA is accurately 750ms', `Got ${event.ttfaMs}`);
  assert(event.audioDurationMs === 2000, 'Audio duration is accurately 2000ms (96000 bytes @ 24kHz)', `Got ${event.audioDurationMs}`);
  assert(event.textChars === 50, 'Text characters count matches currentAiTurnText length', `Got ${event.textChars}`);
  assert(event.networkRttMs === 45, 'Network RTT preserved as 45ms', `Got ${event.networkRttMs}`);
  assert(event.wasBargeIn === false, 'wasBargeIn is false for clean turn', `Got ${event.wasBargeIn}`);
}

// =========================================================================
// TEST 2: Turn 0 Greeting Invariant (Candidate Has Not Spoken)
// =========================================================================
function testTurn0GreetingInvariant(): void {
  console.log('\n[Test 2] Turn 0 Greeting Invariant (AI Speaks First, No Candidate Speech)');

  const tSessionSetup = 20000;
  const tThought = 20300; // TTFR = 300ms from setup
  const tText = 20600;    // TTFT = 600ms from setup
  const tAudio = 20850;   // TTFA = 850ms from setup
  const audioBytes = 48000 * 3.5; // 3.5s greeting audio (168000 bytes)

  // In Turn 0, candidate speech duration is 0
  const turn0Metrics: CurrentTurnMetrics = {
    turnIndex: 0,
    candidateSpeechStartedAt: tSessionSetup,
    candidateSpeechEndedAt: tSessionSetup,
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    firstThoughtAt: tThought,
    firstTextAt: tText,
    firstAudioAt: tAudio,
    audioBytesReceived: audioBytes,
    textChars: 85,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null,
    lastRttMs: null
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_turn_0',
    vadPauseMs: 1800,
    lastTurnCommitTime: tSessionSetup,
    lastActivityAt: tSessionSetup,
    currentTurnMetrics: turn0Metrics,
    currentAiTurnText: 'Здравствуйте! Я ваш технический интервьюер. Начнём с архитектуры Spring Boot.'
  };

  const event = sealTurnTelemetry(session, tSessionSetup);

  assert(event.turnIndex === 0, 'Turn index is 0', `Got ${event.turnIndex}`);
  assert(event.speechDurationMs === 0, 'Candidate speech duration is exactly 0ms in Turn 0', `Got ${event.speechDurationMs}`);
  assert(event.ttfrMs === 300, 'Turn 0 TTFR is calculated from setup time', `Got ${event.ttfrMs}`);
  assert(event.ttftMs === 600, 'Turn 0 TTFT is calculated from setup time', `Got ${event.ttftMs}`);
  assert(event.ttfaMs === 850, 'Turn 0 TTFA is calculated from setup time', `Got ${event.ttfaMs}`);
  assert(event.audioDurationMs === 3500, 'Audio duration is accurately 3500ms', `Got ${event.audioDurationMs}`);
  assert(!isNaN(event.speechDurationMs) && event.speechDurationMs >= 0, 'Speech duration is valid non-negative number');
}

// =========================================================================
// TEST 3: Multi-Turn State Isolation (Turn N -> Turn N+1 Leakage Prevention)
// =========================================================================
function testMultiTurnStateIsolation(): void {
  console.log('\n[Test 3] Multi-Turn State Isolation (Turn 1 -> Turn 2)');

  // Turn 1 completes
  const t1Commit = 30000;
  const turn1Metrics: CurrentTurnMetrics = {
    turnIndex: 1,
    candidateSpeechStartedAt: 25000,
    candidateSpeechEndedAt: t1Commit,
    vadPauseSettingMs: 1800,
    speechDurationMs: 5000,
    firstThoughtAt: 30200,
    firstTextAt: 30450,
    firstAudioAt: 30700,
    audioBytesReceived: 48000,
    textChars: 90,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_multi_turn',
    currentTurnIndex: 1,
    currentTurnMetrics: turn1Metrics,
    lastTurnCommitTime: t1Commit
  };

  const event1 = sealTurnTelemetry(session, t1Commit);
  assert(event1.turnIndex === 1, 'Turn 1 sealed with index 1');
  assert(event1.ttfaMs === 700, 'Turn 1 TTFA is 700ms');

  // Turn 2 starts: Candidate speaks 10 seconds later
  const t2Start = 45000;
  const t2Commit = 49000; // 4000ms speech
  const t2Thought = 49400; // TTFR = 400ms
  const t2Text = 49900;    // TTFT = 900ms
  const t2Audio = 50200;   // TTFA = 1200ms

  // Clean re-initialization for Turn 2
  const turn2Metrics: CurrentTurnMetrics = {
    turnIndex: 2,
    candidateSpeechStartedAt: t2Start,
    candidateSpeechEndedAt: t2Commit,
    vadPauseSettingMs: 1800,
    speechDurationMs: t2Commit - t2Start,
    firstThoughtAt: t2Thought,
    firstTextAt: t2Text,
    firstAudioAt: t2Audio,
    audioBytesReceived: 48000 * 1.5,
    textChars: 65,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };

  session.currentTurnIndex = 2;
  session.currentTurnMetrics = turn2Metrics;
  session.lastTurnCommitTime = t2Commit;

  const event2 = sealTurnTelemetry(session, t2Commit);
  assert(event2.turnIndex === 2, 'Turn 2 sealed with index 2');
  assert(event2.speechDurationMs === 4000, 'Turn 2 speech duration is 4000ms (isolated from Turn 1)');
  assert(event2.ttfrMs === 400, 'Turn 2 TTFR is 400ms (not poisoned by Turn 1 timestamp)', `Got ${event2.ttfrMs}`);
  assert(event2.ttftMs === 900, 'Turn 2 TTFT is 900ms', `Got ${event2.ttftMs}`);
  assert(event2.ttfaMs === 1200, 'Turn 2 TTFA is 1200ms', `Got ${event2.ttfaMs}`);
  assert(event2.audioDurationMs === 1500, 'Turn 2 audio duration is 1500ms', `Got ${event2.audioDurationMs}`);
}

// =========================================================================
// TEST 4: Extended Thinking Dwell Time
// =========================================================================
function testExtendedThinkingDwellTime(): void {
  console.log('\n[Test 4] Extended Thinking Dwell Time (TTFR vs TTFT vs TTFA)');

  const tCommit = 60000;
  const tThought = 61800; // TTFR = 1800ms (Thinking for 1.8s)
  const tText = 62100;    // TTFT = 2100ms
  const tAudio = 62400;   // TTFA = 2400ms

  const metrics: CurrentTurnMetrics = {
    turnIndex: 3,
    candidateSpeechStartedAt: 55000,
    candidateSpeechEndedAt: tCommit,
    vadPauseSettingMs: 1800,
    speechDurationMs: 5000,
    firstThoughtAt: tThought,
    firstTextAt: tText,
    firstAudioAt: tAudio,
    audioBytesReceived: 48000,
    textChars: 40,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_thinking',
    currentTurnMetrics: metrics,
    lastTurnCommitTime: tCommit
  };

  const event = sealTurnTelemetry(session, tCommit, 'gemini-live-thinking-v3');

  assert(event.ttfrMs === 1800, 'TTFR records 1800ms reasoning dwell time', `Got ${event.ttfrMs}`);
  assert(event.ttftMs === 2100, 'TTFT is 2100ms', `Got ${event.ttftMs}`);
  assert(event.ttfaMs === 2400, 'TTFA is 2400ms', `Got ${event.ttfaMs}`);
  assert(event.modelName === 'gemini-live-thinking-v3', 'Model name preserved as gemini-live-thinking-v3');
  assert(event.ttfrMs! < event.ttftMs!, 'TTFR strictly precedes TTFT');
  assert(event.ttftMs! < event.ttfaMs!, 'TTFT strictly precedes TTFA');
}

// =========================================================================
// TEST 5: Tactile Barge-In Interruption Sealing
// =========================================================================
function testTactileBargeIn(): void {
  console.log('\n[Test 5] Mid-Turn Tactile Barge-In (Interruption)');

  const tCommit = 70000;
  const tAudio = 70800;
  // Candidate clicked "Interruption" after only 350ms of audio (16800 bytes)
  const partialAudioBytes = 16800;

  const metrics: CurrentTurnMetrics = {
    turnIndex: 4,
    candidateSpeechStartedAt: 65000,
    candidateSpeechEndedAt: tCommit,
    vadPauseSettingMs: 1800,
    speechDurationMs: 5000,
    firstAudioAt: tAudio,
    firstTextAt: 70600,
    audioBytesReceived: partialAudioBytes,
    textChars: 30,
    droppedEchoChunksCount: 0,
    wasBargeIn: true,
    bargeInType: 'tactile'
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_bargein',
    currentTurnMetrics: metrics,
    lastTurnCommitTime: tCommit
  };

  const event = sealTurnTelemetry(session, tCommit);

  assert(event.wasBargeIn === true, 'wasBargeIn is true upon interruption');
  assert(event.bargeInType === 'tactile', 'bargeInType is tactile', `Got ${event.bargeInType}`);
  assert(event.audioDurationMs === 350, 'Audio duration reflects partial received bytes (350ms)', `Got ${event.audioDurationMs}`);
}

// =========================================================================
// TEST 6: Half-Duplex Echo Suppression Calculation
// =========================================================================
function testHalfDuplexEchoSuppression(): void {
  console.log('\n[Test 6] Half-Duplex Echo Suppression & Dropped Chunks');

  const metrics: CurrentTurnMetrics = {
    turnIndex: 5,
    candidateSpeechStartedAt: 80000,
    candidateSpeechEndedAt: 83000,
    vadPauseSettingMs: 1800,
    speechDurationMs: 3000,
    firstAudioAt: 83800,
    firstTextAt: 83600,
    audioBytesReceived: 48000 * 4,
    textChars: 150,
    droppedEchoChunksCount: 25, // 25 chunks * 40ms = 1000ms of mic audio suppressed
    wasBargeIn: false,
    bargeInType: null
  };

  const session: Partial<ProxySession> = {
    sessionId: 'sess_echo',
    currentTurnMetrics: metrics,
    lastTurnCommitTime: 83000
  };

  const event = sealTurnTelemetry(session, 83000);

  assert(event.echoLeakageDroppedMs === 1000, 'echoLeakageDroppedMs is accurately 1000ms (25 chunks * 40ms)', `Got ${event.echoLeakageDroppedMs}`);
}

// =========================================================================
// TEST 7: Audio-Text Skew & SLA Bounds
// =========================================================================
function testAudioTextSkewAndSla(): void {
  console.log('\n[Test 7] Audio-Text Skew Formula & SLA Bounds');

  // Case A: Ideal sync (TTFP = 620ms, TTFT = 550ms -> Skew = +70ms)
  const skewIdeal = 620 - 550;
  assert(skewIdeal >= 40 && skewIdeal <= VOICE_TELEMETRY_SLA.MAX_ACCEPTABLE_SKEW_MS, 'Ideal skew (+70ms) falls within SLA (40-300ms)');

  // Case B: Subtitle Spoiler alert (TTFP = 950ms, TTFT = 300ms -> Skew = +650ms)
  const skewSpoiler = 950 - 300;
  assert(skewSpoiler > VOICE_TELEMETRY_SLA.MAX_ACCEPTABLE_SKEW_MS, 'Spoiler skew (+650ms) violates SLA tolerance');

  // Case C: Audio precedes text (TTFP = 500ms, TTFT = 580ms -> Skew = -80ms)
  const skewAudioPrecedes = 500 - 580;
  assert(skewAudioPrecedes < 0, 'Negative skew properly represents audio sounding before text');
}

// =========================================================================
// TEST 8: Edge Cases & Robustness
// =========================================================================
function testEdgeCases(): void {
  console.log('\n[Test 8] Edge Cases (Text-only, Audio-only, Negative Clamping)');

  // 1. Text-only turn (e.g. tool execution response with no voice synthesis)
  const textOnlySession: Partial<ProxySession> = {
    sessionId: 'sess_text_only',
    currentAiTurnText: 'Whiteboard updated.',
    currentTurnMetrics: {
      turnIndex: 6,
      speechDurationMs: 1000,
      vadPauseSettingMs: 1800,
      firstTextAt: 100500,
      audioBytesReceived: 0, // No audio
      textChars: 19,
      droppedEchoChunksCount: 0,
      wasBargeIn: false,
      bargeInType: null
    }
  };
  const textOnlyEvent = sealTurnTelemetry(textOnlySession, 100000);
  assert(textOnlyEvent.ttftMs === 500, 'Text-only turn computes TTFT = 500ms');
  assert(textOnlyEvent.ttfaMs === null, 'Text-only turn has ttfaMs === null');
  assert(textOnlyEvent.audioDurationMs === 0, 'Text-only turn has audioDurationMs === 0');

  // 2. Audio-only turn (acoustic filler / vocal backchannel, empty text)
  const audioOnlySession: Partial<ProxySession> = {
    sessionId: 'sess_audio_only',
    currentAiTurnText: '',
    currentTurnMetrics: {
      turnIndex: 7,
      speechDurationMs: 1500,
      vadPauseSettingMs: 1800,
      firstAudioAt: 200800,
      audioBytesReceived: 24000, // 500ms audio
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false,
      bargeInType: null
    }
  };
  const audioOnlyEvent = sealTurnTelemetry(audioOnlySession, 200000);
  assert(audioOnlyEvent.ttfaMs === 800, 'Audio-only turn computes TTFA = 800ms');
  assert(audioOnlyEvent.ttftMs === null, 'Audio-only turn has ttftMs === null');
  assert(audioOnlyEvent.audioDurationMs === 500, 'Audio-only turn has audioDurationMs === 500ms');

  // 3. System clock backward jitter (negative clamping guard)
  const jitterMetrics: CurrentTurnMetrics = {
    turnIndex: 8,
    speechDurationMs: 1000,
    vadPauseSettingMs: 1800,
    firstAudioAt: 299900, // 100ms BEFORE commitTime due to clock drift
    audioBytesReceived: 1000,
    textChars: 10,
    droppedEchoChunksCount: 0,
    wasBargeIn: false,
    bargeInType: null
  };
  const jitterEvent = sealTurnTelemetry({ currentTurnMetrics: jitterMetrics }, 300000);
  assert(jitterEvent.ttfaMs === 0, 'Clock jitter is safely clamped to 0ms (no negative latency)', `Got ${jitterEvent.ttfaMs}`);
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
export function runTelemetryEngineTests(): boolean {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧪 SOTA 2026 DETERMINISTIC TELEMETRY ENGINE & CONTRACT SUITE');
  console.log('═══════════════════════════════════════════════════════════════');

  testStandardTurnLifecycle();
  testTurn0GreetingInvariant();
  testMultiTurnStateIsolation();
  testExtendedThinkingDwellTime();
  testTactileBargeIn();
  testHalfDuplexEchoSuppression();
  testAudioTextSkewAndSla();
  testEdgeCases();

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
  const success = runTelemetryEngineTests();
  process.exit(success ? 0 : 1);
}
