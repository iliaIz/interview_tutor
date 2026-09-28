/**
 * testDeadAirGuard.ts
 *
 * Deterministic Unit Test Suite for LiveDeadAirGuard (SOTA Late September 2026).
 * Verifies active speech detection, pre-speech tolerance, syntactic pause pass-through,
 * dead-air suppression, and turn clamping.
 */

import { LiveDeadAirGuard } from '../services/live/LiveDeadAirGuard';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${detail ? `(${detail})` : ''}`);
  }
}

function createSineChunk(durationMs: number, sampleRate = 24000, amplitude = 5000): string {
  const sampleCount = Math.round((sampleRate * durationMs) / 1000);
  const buf = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    const val = Math.round(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * amplitude);
    buf.writeInt16LE(val, i * 2);
  }
  return buf.toString('base64');
}

function createSilenceChunk(durationMs: number, sampleRate = 24000, noiseAmp = 10): string {
  const sampleCount = Math.round((sampleRate * durationMs) / 1000);
  const buf = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    const val = Math.round((Math.random() - 0.5) * noiseAmp);
    buf.writeInt16LE(val, i * 2);
  }
  return buf.toString('base64');
}

console.log('🧪 Running LiveDeadAirGuard Test Suite...\n');

const guard = new LiveDeadAirGuard();

// Test 1: Pre-speech silence is allowed without clamping
const resPre = guard.processChunk(createSilenceChunk(500));
assert(!resPre.suppressChunk && !resPre.shouldClampTurn, 'Pre-speech silence passes through untouched');
assert(!guard.getHasSpeechStarted(), 'Speech started is false during initial pre-speech');

// Test 2: Active speech detected
const resSpeech = guard.processChunk(createSineChunk(500, 24000, 4000));
assert(!resSpeech.suppressChunk && !resSpeech.shouldClampTurn, 'Active speech passes through');
assert(resSpeech.rms > 200, 'Active speech has RMS > 200');
assert(guard.getHasSpeechStarted(), 'Speech started is true after voice phonemes');

// Test 3: Natural pause (<= 1200ms) allowed
const resPause1 = guard.processChunk(createSilenceChunk(500));
const resPause2 = guard.processChunk(createSilenceChunk(500));
assert(!resPause1.suppressChunk && !resPause1.shouldClampTurn, 'First 500ms pause allowed');
assert(!resPause2.suppressChunk && !resPause2.shouldClampTurn, 'Second 500ms pause (total 1000ms) allowed');

// Test 4: Dead-air between 1200ms and 2000ms is suppressed
const resDeadAir1 = guard.processChunk(createSilenceChunk(500)); // total 1500ms
assert(resDeadAir1.suppressChunk, 'Dead air at 1500ms is suppressed from downlink');
assert(!resDeadAir1.shouldClampTurn, 'Dead air at 1500ms has not clamped yet');

// Test 5: Dead-air reaching >= 2000ms triggers turn clamp
const resClamp = guard.processChunk(createSilenceChunk(600)); // total 2100ms
assert(resClamp.suppressChunk, 'Dead air at 2100ms is suppressed');
assert(resClamp.shouldClampTurn, 'Dead air >= 2000ms triggers shouldClampTurn');
assert(guard.getIsClamped(), 'Guard reports isClamped = true');

// Subsequent chunks remain suppressed
const resAfter = guard.processChunk(createSilenceChunk(500));
assert(resAfter.suppressChunk && !resAfter.shouldClampTurn, 'Subsequent chunks remain suppressed while clamped');

// Test 6: Clean turn reset
guard.reset();
assert(!guard.getIsClamped(), 'Reset clears clamped state');
assert(!guard.getHasSpeechStarted(), 'Reset clears speech started state');

const resNew = guard.processChunk(createSilenceChunk(500));
assert(!resNew.suppressChunk && !resNew.shouldClampTurn, 'New turn starts with clean pre-speech allowance');

console.log(`\n📊 LiveDeadAirGuard Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
