/**
 * vadNoiseRejection.scenario.ts
 *
 * Scenario 4: Micro-Noise & Acoustic Click Rejection.
 * Sends a 150ms noise impulse -> 2.5s silence.
 * Asserts: VAD does not count this as an answer turn.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { generateSilence } from '../silenceGenerator';
import { ScenarioResult } from './types';

export async function runNoiseRejectionScenario(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    topic: 'JVM Garbage Collection',
    questionText: 'Как работает алгоритм ZGC в Java?'
  });

  try {
    console.log(`[Scenario: NoiseRejection] Connecting to ${engine}...`);
    await client.connect(12000);

    console.log('[Scenario: NoiseRejection] Waiting for AI greeting...');
    await client.waitForGreeting(15000);

    // Get 150ms click
    const clickPcm = await AcousticFixtureManager.getFixture('candidate_short_click');

    let spuriousTurnOccurred = false;
    const listener = (msg: any) => {
      const parts = msg.serverContent?.modelTurn?.parts || [];
      if (parts.some((p: any) => p.inlineData?.data || p.inline_data?.data || (p.text && !p.thought))) {
        spuriousTurnOccurred = true;
      }
    };
    (client as any).messageListeners.push(listener);

    console.log('[Scenario: NoiseRejection] Streaming 150ms noise burst + 2.5s silence...');
    await RealtimeAudioPacer.streamPcm(client.ws!, clickPcm, { chunkDurationMs: 40 });
    await RealtimeAudioPacer.streamPcm(client.ws!, generateSilence(2500), { chunkDurationMs: 40 });

    // Wait 1 extra second to observe if AI starts speaking
    await new Promise((r) => setTimeout(r, 1000));

    const passed = !spuriousTurnOccurred;
    return {
      scenarioName: 'Noise Rejection',
      engine,
      passed,
      durationMs: Date.now() - start,
      details: {
        spuriousTurnOccurred
      },
      failureReason: spuriousTurnOccurred ? 'VAD mistakenly considered 150ms noise burst as valid candidate speech' : undefined
    };
  } catch (err: any) {
    return {
      scenarioName: 'Noise Rejection',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
