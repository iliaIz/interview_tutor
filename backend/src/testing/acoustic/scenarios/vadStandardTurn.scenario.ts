/**
 * vadStandardTurn.scenario.ts
 *
 * Scenario 1: Standard Auto-VAD Turn-Taking.
 * AI greets -> Candidate speaks normal answer (3.5s) -> 2.0s silence -> AI detects turn end and responds.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { ScenarioResult } from './types';

export async function runStandardTurnScenario(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
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
    console.log(`[Scenario: StandardTurn] Connecting to ${engine}...`);
    await client.connect(12000);

    console.log('[Scenario: StandardTurn] Waiting for AI greeting...');
    const greeting = await client.waitForGreeting(15000);
    console.log(`[Scenario: StandardTurn] Greeting received: "${greeting.slice(0, 60)}..."`);

    // Fetch candidate normal answer PCM
    const candidatePcm = await AcousticFixtureManager.getFixture('candidate_normal_answer_java');

    console.log(`[Scenario: StandardTurn] Streaming candidate speech (${(candidatePcm.length / 32000).toFixed(2)}s) + 2.0s silence...`);
    // Stream speech + trailing silence (Auto-VAD will detect the silence)
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(
      client.ws!,
      candidatePcm,
      2000,
      { chunkDurationMs: 40 },
      () => client.markCandidateSpeechEnd()
    );

    console.log('[Scenario: StandardTurn] Waiting for AI response turn...');
    const telemetry = await client.waitForTurnComplete(25000);

    const passed = (telemetry.replyText.length > 0 || telemetry.audioBytesReceived > 0) &&
                   !telemetry.replyText.includes('error');

    return {
      scenarioName: 'Standard Turn',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: telemetry.ttfaMs,
      details: {
        replyLength: telemetry.replyText.length,
        audioBytes: telemetry.audioBytesReceived,
        replySnippet: telemetry.replyText.slice(0, 80)
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Standard Turn',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
