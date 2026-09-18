/**
 * vadAcousticStress.scenario.ts
 *
 * SOTA September 2026 Acoustic Stress & Environmental Noise Resilience Suite.
 * Tests Auto-VAD immunity against real-world voice interview conditions:
 * 1. Vocalized hesitations ("э-э-э", "м-м-м").
 * 2. Background mechanical keyboard typing clacks overlaid on speech.
 * 3. Heavy breath/exhale burst rejection.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { generateBreathNoise, generateTypingNoiseOverlay } from '../silenceGenerator';
import { ScenarioResult } from './types';

/**
 * Test 1: Vocalized Hesitation Resilience.
 * Ensures the VAD does not cut off candidate speech during vocalized fillers ("э-э-э", "м-м-м").
 */
export async function runVocalizedHesitationTest(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    topic: 'Java Concurrency',
    questionText: 'Почему ConcurrentHashMap эффективнее synchronizedMap?'
  });

  try {
    console.log(`[Stress: VocalizedHesitation] Connecting to ${engine}...`);
    await client.connect(12000);
    await client.waitForGreeting(15000);

    const speechPcm = await AcousticFixtureManager.getFixture('candidate_vocalized_hesitation_java');
    console.log(`[Stress: VocalizedHesitation] Streaming speech with vocalized fillers (${(speechPcm.length / 32000).toFixed(2)}s) + 2.0s silence...`);

    client.markCandidateSpeechEnd();
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(client.ws!, speechPcm, 2000, {
      chunkDurationMs: 40
    });

    console.log('[Stress: VocalizedHesitation] Awaiting AI response turn...');
    const telemetry = await client.waitForTurnComplete(25000);

    const passed = (telemetry.replyText.length > 0 || telemetry.audioBytesReceived > 0) &&
                   !client.telemetry.isInterrupted;

    return {
      scenarioName: 'Stress: Vocalized Hesitation',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: telemetry.ttfaMs,
      details: {
        replyLength: telemetry.replyText.length,
        audioBytes: telemetry.audioBytesReceived
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Stress: Vocalized Hesitation',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}

/**
 * Test 2: Typing Noise Immunity.
 * Overlays mechanical keyboard click transients on speech to verify speech extraction under typing noise.
 */
export async function runTypingImmunityTest(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    topic: 'Spring Caching',
    questionText: 'Как работает аннотация @CacheEvict?'
  });

  try {
    console.log(`[Stress: TypingImmunity] Connecting to ${engine}...`);
    await client.connect(12000);
    await client.waitForGreeting(15000);

    const rawPcm = await AcousticFixtureManager.getFixture('candidate_normal_answer_java');
    const speechWithTypingPcm = generateTypingNoiseOverlay(rawPcm, 4); // 4 clicks per second

    console.log(`[Stress: TypingImmunity] Streaming speech mixed with keyboard transients (${(speechWithTypingPcm.length / 32000).toFixed(2)}s)...`);

    client.markCandidateSpeechEnd();
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(client.ws!, speechWithTypingPcm, 2000, {
      chunkDurationMs: 40
    });

    console.log('[Stress: TypingImmunity] Awaiting AI response turn...');
    const telemetry = await client.waitForTurnComplete(25000);

    const passed = telemetry.replyText.length > 0 || telemetry.audioBytesReceived > 0;

    return {
      scenarioName: 'Stress: Typing Immunity',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: telemetry.ttfaMs,
      details: {
        replyLength: telemetry.replyText.length,
        audioBytes: telemetry.audioBytesReceived
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Stress: Typing Immunity',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}

/**
 * Test 3: Breath / Sigh Burst Rejection.
 * Verifies that a 400ms non-speech exhalation does not trigger an accidental AI speech turn.
 */
export async function runBreathRejectionTest(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard'
  });

  try {
    console.log(`[Stress: BreathRejection] Connecting to ${engine}...`);
    await client.connect(12000);
    await client.waitForGreeting(15000);

    const breathPcm = generateBreathNoise(400);
    console.log('[Stress: BreathRejection] Sending 400ms breath/sigh noise burst + 3.0s trailing silence...');

    client.markCandidateSpeechEnd();
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(client.ws!, breathPcm, 3000, {
      chunkDurationMs: 40
    });

    let spuriousTurnDetected = false;
    try {
      // If AI responds to breath noise within 3 seconds, that's a false trigger!
      await client.waitForTurnComplete(3000);
      spuriousTurnDetected = true;
    } catch {
      // Expected: AI should ignore breath noise
      spuriousTurnDetected = false;
    }

    const passed = !spuriousTurnDetected;

    return {
      scenarioName: 'Stress: Breath Rejection',
      engine,
      passed,
      durationMs: Date.now() - start,
      failureReason: passed ? undefined : 'AI triggered an unprompted turn on breath/sigh exhalation'
    };
  } catch (err: any) {
    return {
      scenarioName: 'Stress: Breath Rejection',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
