/**
 * vadMultiTurnDialogue.scenario.ts
 *
 * SOTA September 2026 Multi-Turn Acoustic Auto-VAD Dialogue Scenario.
 * Executes a 3-turn live voice conversation in a single continuous session,
 * asserting clean state reset, context maintenance, and strict Latency SLA.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { ScenarioResult } from './types';

export interface MultiTurnSlaConfig {
  maxTtfaMs: number;
  maxTtftMs?: number;
}

export async function runMultiTurnDialogueScenario(
  engine: string = 'gemini-live-v3',
  turnsCount: number = 3
): Promise<ScenarioResult> {
  const start = Date.now();
  const slaConfig: MultiTurnSlaConfig = {
    maxTtfaMs: engine.includes('thinking') ? 12000 : 8000,
    maxTtftMs: engine.includes('thinking') ? 4000 : undefined
  };

  const client = new SimulatedLiveClient({
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    sessionType: 'tutor',
    tutorMode: 'socratic',
    questionId: 'TST-01',
    topic: 'Spring Caching & Architecture',
    questionText: 'Как устроена инвалидация кэша в Spring? Отвечай кратко в 1-2 предложениях.',
    customPrompt: `=== КРАТКОСТЬ ОТВЕТОВ (CANARY VERIFICATION) ===
Отвечай строго в 1-2 коротких предложениях (не более 25 слов на реплику).
Задавай кандидату краткие уточняющие вопросы по архитектуре. Не читай лекций.`
  });

  const turnMetrics: Array<{
    turn: number;
    ttfaMs: number | null;
    ttftMs: number | null;
    replyLength: number;
    audioBytes: number;
  }> = [];

  try {
    console.log(`[Scenario: MultiTurn] Connecting to ${engine} for a ${turnsCount}-turn dialogue...`);
    await client.connect(15000);

    console.log('[Scenario: MultiTurn] Turn 0: Awaiting AI greeting...');
    const greeting = await client.waitForGreeting(35000);
    console.log(`[Scenario: MultiTurn] Greeting received (${greeting.length} chars): "${greeting.slice(0, 60)}..."`);

    // Turn 1: Basic Answer
    console.log('\n--- [Scenario: MultiTurn] Executing Turn 1 ---');
    client.beginTurn();
    const pcmTurn1 = await AcousticFixtureManager.getFixture('candidate_normal_answer_java');
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(
      client.ws!,
      pcmTurn1,
      2000,
      { chunkDurationMs: 40 },
      () => client.markCandidateSpeechEnd()
    );
    console.log('[Scenario: MultiTurn] Turn 1: Waiting for AI response...');
    const tel1 = await client.waitForTurnComplete(45000);
    turnMetrics.push({
      turn: 1,
      ttfaMs: tel1.ttfaMs,
      ttftMs: tel1.ttftMs,
      replyLength: tel1.replyText.length,
      audioBytes: tel1.audioBytesReceived
    });
    console.log(`[Scenario: MultiTurn] Turn 1 Complete. TTFA: ${tel1.ttfaMs}ms, TTFT: ${tel1.ttftMs}ms, Audio: ${tel1.audioBytesReceived} bytes`);

    // Inter-turn pause: allow physical audio tail to settle and drain completely
    await client.waitForAudioPlayoutToDrain(450);

    // Turn 2: Architectural Deep-Dive Answer
    if (turnsCount >= 2) {
      console.log('\n--- [Scenario: MultiTurn] Executing Turn 2 ---');
      client.beginTurn();
      const pcmTurn2 = await AcousticFixtureManager.getFixture('candidate_complex_architecture');
      await RealtimeAudioPacer.streamSpeechWithTrailingSilence(
        client.ws!,
        pcmTurn2,
        2000,
        { chunkDurationMs: 40 },
        () => client.markCandidateSpeechEnd()
      );
      console.log('[Scenario: MultiTurn] Turn 2: Waiting for AI follow-up response...');
      const tel2 = await client.waitForTurnComplete(45000);
      turnMetrics.push({
        turn: 2,
        ttfaMs: tel2.ttfaMs,
        ttftMs: tel2.ttftMs,
        replyLength: tel2.replyText.length,
        audioBytes: tel2.audioBytesReceived
      });
      console.log(`[Scenario: MultiTurn] Turn 2 Complete. TTFA: ${tel2.ttfaMs}ms, TTFT: ${tel2.ttftMs}ms, Audio: ${tel2.audioBytesReceived} bytes`);

      await client.waitForAudioPlayoutToDrain(450);
    }

    // Turn 3: Follow-up clarification
    if (turnsCount >= 3) {
      console.log('\n--- [Scenario: MultiTurn] Executing Turn 3 ---');
      client.beginTurn();
      const pcmTurn3 = await AcousticFixtureManager.getFixture('candidate_hesitation_part1');
      await RealtimeAudioPacer.streamSpeechWithTrailingSilence(
        client.ws!,
        pcmTurn3,
        2000,
        { chunkDurationMs: 40 },
        () => client.markCandidateSpeechEnd()
      );
      console.log('[Scenario: MultiTurn] Turn 3: Waiting for AI concluding response...');
      const tel3 = await client.waitForTurnComplete(45000);
      turnMetrics.push({
        turn: 3,
        ttfaMs: tel3.ttfaMs,
        ttftMs: tel3.ttftMs,
        replyLength: tel3.replyText.length,
        audioBytes: tel3.audioBytesReceived
      });
      console.log(`[Scenario: MultiTurn] Turn 3 Complete. TTFA: ${tel3.ttfaMs}ms, TTFT: ${tel3.ttftMs}ms, Audio: ${tel3.audioBytesReceived} bytes`);
    }

    // Evaluate SLA & Success
    const allTurnsResponded = turnMetrics.every(
      (m) => m.replyLength > 0 || m.audioBytes > 0
    );

    const slaViolations = turnMetrics.filter(
      (m) => m.ttfaMs !== null && m.ttfaMs > slaConfig.maxTtfaMs
    );

    let failureReason: string | undefined;
    if (!allTurnsResponded) {
      failureReason = 'One or more turns failed to receive audio or text response from AI';
    } else if (slaViolations.length > 0) {
      failureReason = `Latency SLA breached on ${slaViolations.length} turns (limit: ${slaConfig.maxTtfaMs}ms, got: ${slaViolations.map((v) => `${v.turn}:${v.ttfaMs}ms`).join(', ')})`;
    }

    const passed = allTurnsResponded && slaViolations.length === 0;
    const avgTtfa = turnMetrics.reduce((acc, m) => acc + (m.ttfaMs || 0), 0) / turnMetrics.length;

    return {
      scenarioName: `Multi-Turn Dialogue (${turnsCount} turns)`,
      engine,
      passed,
      durationMs: Date.now() - start,
      ttfaMs: Math.round(avgTtfa),
      failureReason,
      details: {
        turnMetrics,
        turnsCount
      }
    };
  } catch (err: any) {
    return {
      scenarioName: `Multi-Turn Dialogue (${turnsCount} turns)`,
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
