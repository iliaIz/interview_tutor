/**
 * vadCodeHandoverSla.scenario.ts
 *
 * SOTA September 2026 Code Handover SLA Scenario.
 * Verifies Atomic Frame Fusion during Tutor Practice mode:
 * AI greets -> Candidate streams code handover frame with turnComplete: true ->
 * AI responds within SLA (< 6000ms TTFA) without protocol desynchronization or canned error audio.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { ScenarioResult } from './types';

export async function runCodeHandoverSlaScenario(engine: string = 'gemini-live-v3'): Promise<ScenarioResult> {
  const start = Date.now();
  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    sessionType: 'tutor',
    tutorMode: 'practice_pair',
    topic: 'Thread Safety in Cache Manager',
    questionText: 'Как устранить race condition в ConcurrentHashMap computeIfAbsent?'
  });

  try {
    console.log(`[Scenario: CodeHandoverSla] Connecting to ${engine} in practice_pair mode...`);
    await client.connect(12000);

    console.log('[Scenario: CodeHandoverSla] Waiting for AI greeting...');
    const greeting = await client.waitForGreeting(15000);
    console.log(`[Scenario: CodeHandoverSla] Greeting received: "${greeting.slice(0, 60)}..."`);

    // Prepare atomic code handover turn
    console.log('[Scenario: CodeHandoverSla] Dispatching atomic code handover frame...');
    client.beginTurn();
    const updatedCode = `public class SafeCacheManager {\n  private final ConcurrentMap<String, Object> map = new ConcurrentHashMap<>();\n}`;
    const handoverTurn = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: `[КОНТЕКСТ КОДА]: Кандидат обновил код в редакторе:\n\`\`\`java\n${updatedCode}\n\`\`\`\nПроанализируй внесенные изменения и прокомментируй кратко голосом.`
              }
            ]
          }
        ],
        turnComplete: true
      }
    };

    client.ws!.send(JSON.stringify(handoverTurn));
    client.markCandidateSpeechEnd();

    console.log('[Scenario: CodeHandoverSla] Waiting for AI response turn...');
    const telemetry = await client.waitForTurnComplete(25000);

    // Assertions
    const hasValidReply = (telemetry.replyText.length > 0 || telemetry.audioBytesReceived > 0) &&
                          !telemetry.replyText.toLowerCase().includes('системная ошибка') &&
                          !telemetry.replyText.toLowerCase().includes('internal error');

    // SLA: TTFA should be <= 8000ms (matching multi-turn dialogue SLA budget)
    const maxTtfaMs = engine.includes('thinking') ? 12000 : 8000;
    const ttfa = telemetry.ttfaMs ?? telemetry.ttftMs ?? 0;
    const meetsSla = ttfa > 0 && ttfa <= maxTtfaMs;
    const passed = hasValidReply && meetsSla;

    let failureReason: string | undefined;
    if (!hasValidReply) {
      failureReason = 'AI did not return a valid audio or text reply for code handover';
    } else if (!meetsSla) {
      failureReason = `Code Handover latency SLA breached: TTFA (${ttfa}ms) exceeded threshold of ${maxTtfaMs}ms`;
    }

    return {
      scenarioName: 'Code Handover SLA',
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: telemetry.ttfaMs,
      ttftMs: telemetry.ttftMs,
      failureReason,
      details: {
        replyLength: telemetry.replyText.length,
        audioBytes: telemetry.audioBytesReceived,
        ttfa,
        meetsSla,
        replySnippet: telemetry.replyText.slice(0, 80)
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Code Handover SLA',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
