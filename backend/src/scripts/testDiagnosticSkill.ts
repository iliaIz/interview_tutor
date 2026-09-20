/**
 * testDiagnosticSkill.ts
 *
 * Phase 6: Automated Verification of Auto-VAD Diagnostic Decision Tree.
 * Validates the 8-vector diagnostic decision matrix (.agents/skills/auto-vad-diagnostics/SKILL.md)
 * to ensure that real-world voice anomalies, latency bottlenecks, and protocol asymmetries
 * are classified with 100% determinism.
 */

import {
  VadDiagnosticClassifier,
  DiagnosticClassification
} from '../services/live/vadDiagnosticClassifier';
import { TurnTelemetryEvent } from '@interview-prep/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

function testAutoplayBarrierDetection() {
  console.log('Testing: Browser Autoplay Barrier Detection...');

  // Case A: Audio reached server in 320ms, but DAC playback delayed to 4800ms
  const turnsA: TurnTelemetryEvent[] = [{
    turnId: 'turn_1',
    sessionId: 'sess_1',
    turnIndex: 1,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    ttfrMs: 100,
    ttftMs: 250,
    ttfaMs: 320,
    ttfpMs: 4800,
    audioTextSkewMs: 70,
    audioDurationMs: 2000,
    textChars: 120,
    echoLeakageDroppedMs: 0,
    networkRttMs: 15,
    modelName: 'gemini-live',
    wasBargeIn: false,
    bargeInType: null,
    createdAt: Date.now()
  }];

  const resA = VadDiagnosticClassifier.classify({
    turnTelemetry: turnsA,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(resA.classification === 'BROWSER_AUTOPLAY_BARRIER', 'Expected BROWSER_AUTOPLAY_BARRIER when ttfp > 4000ms');
  assert(resA.severity === 'CRITICAL', 'Autoplay barrier must be CRITICAL');
  assert(resA.turnIndexTriggered === 1, 'Should point to turnIndex 1');

  // Case B: ttfpMs is null (physical audio never played out)
  const turnsB: TurnTelemetryEvent[] = [{
    ...turnsA[0],
    ttfpMs: null
  }];
  const resB = VadDiagnosticClassifier.classify({
    turnTelemetry: turnsB,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(resB.classification === 'BROWSER_AUTOPLAY_BARRIER', 'Expected BROWSER_AUTOPLAY_BARRIER when ttfp is null');

  console.log('  ✅ Autoplay Barrier Detection verified');
}

function testSubtitleSpoilerDetection() {
  console.log('Testing: Subtitle Spoilering Detection...');

  const turns: TurnTelemetryEvent[] = [{
    turnId: 'turn_1',
    sessionId: 'sess_1',
    turnIndex: 1,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    ttfrMs: 80,
    ttftMs: 200,
    ttfaMs: 1200,
    ttfpMs: 1250,
    audioTextSkewMs: -1050, // Subtitles appeared 1050ms before audio
    audioDurationMs: 3000,
    textChars: 150,
    echoLeakageDroppedMs: 0,
    networkRttMs: 20,
    modelName: 'gemini-live',
    wasBargeIn: false,
    bargeInType: null,
    createdAt: Date.now()
  }];

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: turns,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(res.classification === 'SUBTITLE_SPOILER', 'Expected SUBTITLE_SPOILER when skew < -800ms');
  assert(res.severity === 'WARNING', 'Subtitle spoiler must be WARNING');

  console.log('  ✅ Subtitle Spoilering Detection verified');
}

function testUpstreamAiLatencyDetection() {
  console.log('Testing: Upstream AI Latency Detection...');

  const turns: TurnTelemetryEvent[] = [{
    turnId: 'turn_1',
    sessionId: 'sess_1',
    turnIndex: 1,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    ttfrMs: 3800,
    ttftMs: 4200,
    ttfaMs: 4600, // Stalled upstream synthesis
    ttfpMs: 4650,
    audioTextSkewMs: 50,
    audioDurationMs: 2000,
    textChars: 80,
    echoLeakageDroppedMs: 0,
    networkRttMs: 25, // Healthy local network RTT
    modelName: 'gemini-live',
    wasBargeIn: false,
    bargeInType: null,
    createdAt: Date.now()
  }];

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: turns,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(res.classification === 'UPSTREAM_AI_LATENCY', 'Expected UPSTREAM_AI_LATENCY when ttfa > 4000ms and RTT is low');
  assert(res.severity === 'CRITICAL', 'Upstream latency spike must be CRITICAL');

  console.log('  ✅ Upstream AI Latency Detection verified');
}

function testAcousticSpeakerBleedDetection() {
  console.log('Testing: Acoustic Speaker Bleed Detection...');

  const turns: TurnTelemetryEvent[] = [{
    turnId: 'turn_1',
    sessionId: 'sess_1',
    turnIndex: 1,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    ttfrMs: 100,
    ttftMs: 300,
    ttfaMs: 400,
    ttfpMs: 450,
    audioTextSkewMs: 50,
    audioDurationMs: 2500,
    textChars: 100,
    echoLeakageDroppedMs: 3600, // 3.6s of mic frames suppressed by half-duplex guard
    networkRttMs: 20,
    modelName: 'gemini-live',
    wasBargeIn: true,
    bargeInType: 'acoustic',
    createdAt: Date.now()
  }];

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: turns,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(res.classification === 'ACOUSTIC_SPEAKER_BLEED', 'Expected ACOUSTIC_SPEAKER_BLEED when echo dropped > 3000ms');

  console.log('  ✅ Acoustic Speaker Bleed Detection verified');
}

function testPrematureVadEndpointingDetection() {
  console.log('Testing: Premature VAD Endpointing Detection...');

  const turns: TurnTelemetryEvent[] = [{
    turnId: 'turn_1',
    sessionId: 'sess_1',
    turnIndex: 1,
    speaker: 'user',
    vadPauseSettingMs: 1200,
    speechDurationMs: 450, // Candidate spoke only 450ms before turn cut off
    ttfrMs: 0,
    ttftMs: 0,
    ttfaMs: null,
    ttfpMs: null,
    audioTextSkewMs: null,
    audioDurationMs: 0,
    textChars: 15,
    echoLeakageDroppedMs: 0,
    networkRttMs: null,
    modelName: 'gemini-live',
    wasBargeIn: false,
    bargeInType: null,
    createdAt: Date.now()
  }];

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: turns,
    transcript: [{ role: 'user' }, { role: 'ai' }]
  });
  assert(res.classification === 'PREMATURE_VAD_ENDPOINTING', 'Expected PREMATURE_VAD_ENDPOINTING when speechDuration < 800ms');

  console.log('  ✅ Premature VAD Endpointing Detection verified');
}

function testProtocolAsymmetryDetection() {
  console.log('Testing: Protocol Asymmetry Detection...');

  // User spoke, but 0 AI turns recorded (outputAudioTranscription missing)
  const res = VadDiagnosticClassifier.classify({
    transcript: [
      { role: 'user', content: 'Расскажите о Spring Security' },
      { role: 'user', content: 'Как работает SecurityFilterChain?' }
    ]
  });
  assert(res.classification === 'PROTOCOL_ASYMMETRY', 'Expected PROTOCOL_ASYMMETRY when AI turns = 0');
  assert(res.severity === 'CRITICAL', 'Protocol asymmetry must be CRITICAL');

  console.log('  ✅ Protocol Asymmetry Detection verified');
}

function testUpstreamGatewaySeverDetection() {
  console.log('Testing: Upstream Gateway Sever Detection...');

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: [],
    transcript: [],
    litellmLogs: [
      '2026-09-20 10:15:02 [litellm-gateway] upstream WebSocket closed with code 1006 abnormal termination'
    ]
  });
  assert(res.classification === 'UPSTREAM_GATEWAY_SEVER', 'Expected UPSTREAM_GATEWAY_SEVER on code 1006');

  console.log('  ✅ Upstream Gateway Sever Detection verified');
}

function testStoragePipelineVoidDetection() {
  console.log('Testing: Storage Pipeline Void Detection...');

  const res = VadDiagnosticClassifier.classify({
    transcript: [{ role: 'user' }, { role: 'ai' }],
    audioPath: null,
    storageFiles: []
  });
  assert(res.classification === 'STORAGE_PIPELINE_VOID', 'Expected STORAGE_PIPELINE_VOID when storage is empty');

  console.log('  ✅ Storage Pipeline Void Detection verified');
}

function testHealthySessionDetection() {
  console.log('Testing: Healthy Session Detection...');

  const healthyTurns: TurnTelemetryEvent[] = [
    {
      turnId: 'turn_0',
      sessionId: 'sess_1',
      turnIndex: 0,
      speaker: 'model',
      vadPauseSettingMs: 1800,
      speechDurationMs: 0,
      ttfrMs: 50,
      ttftMs: 150,
      ttfaMs: 250,
      ttfpMs: 300,
      audioTextSkewMs: 50,
      audioDurationMs: 1200,
      textChars: 65,
      echoLeakageDroppedMs: 0,
      networkRttMs: 15,
      modelName: 'gemini-live',
      wasBargeIn: false,
      bargeInType: null,
      createdAt: Date.now() - 5000
    },
    {
      turnId: 'turn_1',
      sessionId: 'sess_1',
      turnIndex: 1,
      speaker: 'user',
      vadPauseSettingMs: 1800,
      speechDurationMs: 3200,
      ttfrMs: 0,
      ttftMs: 0,
      ttfaMs: null,
      ttfpMs: null,
      audioTextSkewMs: null,
      audioDurationMs: 0,
      textChars: 180,
      echoLeakageDroppedMs: 0,
      networkRttMs: null,
      modelName: 'gemini-live',
      wasBargeIn: false,
      bargeInType: null,
      createdAt: Date.now() - 2000
    },
    {
      turnId: 'turn_2',
      sessionId: 'sess_1',
      turnIndex: 2,
      speaker: 'model',
      vadPauseSettingMs: 1800,
      speechDurationMs: 3200,
      ttfrMs: 120,
      ttftMs: 280,
      ttfaMs: 350,
      ttfpMs: 420,
      audioTextSkewMs: 70,
      audioDurationMs: 2500,
      textChars: 140,
      echoLeakageDroppedMs: 0,
      networkRttMs: 18,
      modelName: 'gemini-live',
      wasBargeIn: false,
      bargeInType: null,
      createdAt: Date.now()
    }
  ];

  const res = VadDiagnosticClassifier.classify({
    turnTelemetry: healthyTurns,
    transcript: [{ role: 'user' }, { role: 'ai' }],
    audioPath: '/storage/eval_123.wav',
    storageFiles: ['eval_123.wav']
  });

  assert(res.classification === 'HEALTHY', 'Expected HEALTHY for nominal session');
  assert(res.severity === 'HEALTHY', 'Expected HEALTHY severity');

  console.log('  ✅ Healthy Session Detection verified');
}

function testCorruptedInputResilience() {
  console.log('Testing: Corrupted / Invalid Input Resilience...');

  // Invalid JSON strings for telemetry and transcript
  const resA = VadDiagnosticClassifier.classify({
    turnTelemetry: '{bad json',
    transcript: 'not a json array'
  });
  assert(resA.classification === 'HEALTHY', 'Should not throw on invalid JSON');

  // Empty / undefined inputs
  const resB = VadDiagnosticClassifier.classify({});
  assert(resB.classification === 'HEALTHY', 'Should safely handle empty input object');

  console.log('  ✅ Corrupted Input Resilience verified');
}

function runAll() {
  console.log('======================================================');
  console.log('🧪 RUNNING AUTO-VAD DIAGNOSTIC CLASSIFIER SUITE');
  console.log('======================================================\n');

  testAutoplayBarrierDetection();
  testSubtitleSpoilerDetection();
  testUpstreamAiLatencyDetection();
  testAcousticSpeakerBleedDetection();
  testPrematureVadEndpointingDetection();
  testProtocolAsymmetryDetection();
  testUpstreamGatewaySeverDetection();
  testStoragePipelineVoidDetection();
  testHealthySessionDetection();
  testCorruptedInputResilience();

  console.log('\n======================================================');
  console.log('🎉 ALL 10 DIAGNOSTIC MATRIX TESTS PASSED (0 FAILURES)');
  console.log('======================================================');
}

runAll();
