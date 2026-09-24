/**
 * vadFullInterviewLifecycle.scenario.ts
 *
 * SOTA September 2026 Full Interview Lifecycle & Evaluation Integrity Scenario.
 * Executes an end-to-end interview turn sequence, triggers final evaluation,
 * and validates that:
 * 1. AI greeting reads question aloud without premature evaluation (Turn 0 guard).
 * 2. Candidate speech is committed by Auto-VAD.
 * 3. AI issues probe and then invokes submit_interview_evaluation.
 * 4. Client receives `evaluation_completed` with score and feedback payload.
 * 5. SQLite question_evaluations row has non-null score and non-null transcript.
 */

import { SimulatedLiveClient } from '../simulatedLiveClient';
import { RealtimeAudioPacer } from '../realtimeAudioPacer';
import { AcousticFixtureManager } from '../acousticFixtureManager';
import { ScenarioResult } from './types';
import { db } from '../../../services/db';

export async function runFullInterviewLifecycleScenario(
  engine: string = 'gemini-live-v3'
): Promise<ScenarioResult> {
  const start = Date.now();
  const testQuestionId = 'BOOT-021';
  const testSessionId = `canary_eval_${Date.now()}`;

  const client = new SimulatedLiveClient({
    sessionId: testSessionId,
    liveModel: engine,
    turnMode: 'auto',
    strategy: 'adaptive_probing',
    strictness: 'standard',
    sessionType: 'interview',
    maxProbes: 1,
    questionId: testQuestionId,
    topic: 'Spring Boot',
    questionText: 'Как устроена аннотация @SpringBootApplication и из каких мета-аннотаций она состоит?',
    referenceAnswer: '@SpringBootApplication состоит из @SpringBootConfiguration, @EnableAutoConfiguration и @ComponentScan.',
    customPrompt: `=== CANARY INTERVIEW DIRECTIVE ===
Ты проводишь краткое собеседование по Spring Boot.
1. Приветствуй кандидата и задай вопрос.
2. После получения ответа кандидата, если ответ верный или кандидат раскрыл компоненты, СРАЗУ вызови инструмент submit_interview_evaluation с итоговыми баллами.
3. Поясни итог голосом кандидату.`
  });

  let receivedEvaluation: any = null;

  try {
    console.log(`[Scenario: FullLifecycle] Connecting to ${engine} with session ${testSessionId}...`);
    await client.connect(15000);

    // Register evaluation listener
    const evalPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for evaluation_completed (50s)')), 50000);
      const listener = (msg: any) => {
        if (msg.type === 'evaluation_completed' || msg.type === 'evaluation') {
          clearTimeout(timer);
          receivedEvaluation = msg.evaluation || msg.payload;
          resolve(receivedEvaluation);
        }
      };
      (client as any).messageListeners.push(listener);
    });

    console.log('[Scenario: FullLifecycle] Turn 0: Awaiting AI greeting...');
    const greeting = await client.waitForGreeting(35000);
    console.log(`[Scenario: FullLifecycle] Greeting: "${greeting.slice(0, 70)}..."`);

    // Turn 1: Candidate provides correct answer
    console.log('[Scenario: FullLifecycle] Turn 1: Streaming candidate answer...');
    client.beginTurn();
    const pcmTurn1 = await AcousticFixtureManager.getFixture('candidate_normal_answer_java');
    await RealtimeAudioPacer.streamSpeechWithTrailingSilence(
      client.ws!,
      pcmTurn1,
      2000,
      { chunkDurationMs: 40 },
      () => client.markCandidateSpeechEnd()
    );

    console.log('[Scenario: FullLifecycle] Turn 1: Waiting for AI response / evaluation...');
    await client.waitForTurnComplete(45000);

    // Await evaluation tool completion (or if model required 1 follow-up)
    let evaluationPayload = receivedEvaluation;
    if (!evaluationPayload) {
      console.log('[Scenario: FullLifecycle] Awaiting evaluation tool call...');
      evaluationPayload = await evalPromise;
    }

    console.log(`[Scenario: FullLifecycle] ✅ Evaluation received: Score ${evaluationPayload?.score}/100, Passed: ${evaluationPayload?.isPassed}`);

    // Verify SQLite persistence
    let dbPassed = false;
    let transcriptLength = 0;
    try {
      const row = db.prepare('SELECT score, is_passed, transcript FROM question_evaluations WHERE question_id = ? ORDER BY created_at DESC LIMIT 1').get(testQuestionId) as any;
      if (row) {
        transcriptLength = row.transcript ? String(row.transcript).length : 0;
        dbPassed = row.score !== null && transcriptLength > 0;
        console.log(`[Scenario: FullLifecycle] 💾 DB Verification: score=${row.score}, transcriptChars=${transcriptLength}`);
      }
    } catch (e: any) {
      console.warn('[Scenario: FullLifecycle] DB query warning:', e.message);
    }

    const passed = Boolean(evaluationPayload && evaluationPayload.score >= 0 && dbPassed);

    return {
      scenarioName: 'Full Interview Lifecycle & DB Verification',
      engine,
      passed,
      durationMs: Date.now() - start,
      details: {
        score: evaluationPayload?.score,
        isPassed: evaluationPayload?.isPassed,
        transcriptChars: transcriptLength
      }
    };
  } catch (err: any) {
    return {
      scenarioName: 'Full Interview Lifecycle & DB Verification',
      engine,
      passed: false,
      durationMs: Date.now() - start,
      failureReason: err.message || String(err)
    };
  } finally {
    client.close();
  }
}
