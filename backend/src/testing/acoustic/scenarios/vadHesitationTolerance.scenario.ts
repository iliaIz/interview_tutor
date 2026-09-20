/**
 * vadHesitationTolerance.scenario.ts
 *
 * Scenario 2: Mid-Sentence Hesitation Tolerance.
 * Candidate speaks Part 1 (~1.8s) -> 800ms silence pause -> speaks Part 2 (~2.0s) -> 2.0s silence.
 * Asserts: AI does NOT interrupt or finish turn on the 800ms pause.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { ScenarioResult } from './types';

export async function runHesitationScenario(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    topic: 'Kafka Partitioning',
    questionText: 'Как выбрать ключ партиционирования в Kafka?'
  });

  try {
    console.log(`[Scenario: Hesitation] Connecting to ${engine}...`);
    await client.connect(12000);

    console.log('[Scenario: Hesitation] Waiting for AI greeting...');
    await client.waitForGreeting(15000);

    const part1Pcm = await AcousticFixtureManager.getFixture('candidate_hesitation_part1');
    const part2Pcm = await AcousticFixtureManager.getFixture('candidate_hesitation_part2');

    let prematureTurnOccurred = false;
    const prematureListener = (msg: any) => {
      if (msg.serverContent?.turnComplete || msg.serverContent?.modelTurn?.parts?.length > 0) {
        prematureTurnOccurred = true;
      }
    };
    (client as any).messageListeners.push(prematureListener);

    console.log('[Scenario: Hesitation] Streaming Part 1 (1.8s) -> 800ms pause (should NOT interrupt)...');
    await RealtimeAudioPacer.streamPcm(client.ws!, part1Pcm, { chunkDurationMs: 40 });

    // Stream 800ms hesitation pause
    const { generateSilence } = await import('../silenceGenerator');
    await RealtimeAudioPacer.streamPcm(client.ws!, generateSilence(800), { chunkDurationMs: 40 });

    if (prematureTurnOccurred) {
      return {
        scenarioName: 'Hesitation Tolerance',
        engine,
        passed: false,
        durationMs: Date.now() - start,
        failureReason: 'AI prematurely interrupted candidate during 800ms hesitation pause!'
      };
    }

    // Clean up premature listener so it does not intercept the legitimate final response
    (client as any).messageListeners = (client as any).messageListeners.filter((l: any) => l !== prematureListener);

    console.log('[Scenario: Hesitation] Streaming Part 2 (2.0s) + 2.0s final silence...');
    client.markCandidateSpeechEnd();

    await RealtimeAudioPacer.streamPcm(client.ws!, part2Pcm, { chunkDurationMs: 40 });
    await RealtimeAudioPacer.streamPcm(client.ws!, generateSilence(2000), { chunkDurationMs: 40 });

    console.log('[Scenario: Hesitation] Waiting for final AI response...');
    const telemetry = await client.waitForTurnComplete(25000);

    const passed = (telemetry.replyText.length > 0 || telemetry.audioBytesReceived > 0) &&
                   !prematureTurnOccurred;

    return {
      scenarioName: 'Hesitation Tolerance',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: telemetry.ttfaMs,
      details: {
        replySnippet: telemetry.replyText.slice(0, 80)
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Hesitation Tolerance',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
