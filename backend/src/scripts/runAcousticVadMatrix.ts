/**
 * runAcousticVadMatrix.ts
 *
 * SOTA September 2026 Master Acoustic Auto-VAD & Multi-Engine CLI Matrix Runner.
 * Executes automated speech simulation scenarios and produces structured latency reports.
 */

import { AcousticFixtureManager, GOLDEN_FIXTURES } from '../testing/acoustic/acousticFixtureManager';
import { runStandardTurnScenario } from '../testing/acoustic/scenarios/vadStandardTurn.scenario';
import { runHesitationScenario } from '../testing/acoustic/scenarios/vadHesitationTolerance.scenario';
import { runBargeInScenario } from '../testing/acoustic/scenarios/vadBargeIn.scenario';
import { runNoiseRejectionScenario } from '../testing/acoustic/scenarios/vadNoiseRejection.scenario';
import { runMultiTurnDialogueScenario } from '../testing/acoustic/scenarios/vadMultiTurnDialogue.scenario';
import { runCodeHandoverSlaScenario } from '../testing/acoustic/scenarios/vadCodeHandoverSla.scenario';
import { runFullInterviewLifecycleScenario } from '../testing/acoustic/scenarios/vadFullInterviewLifecycle.scenario';
import {
  runVocalizedHesitationTest,
  runTypingImmunityTest,
  runBreathRejectionTest
} from '../testing/acoustic/scenarios/vadAcousticStress.scenario';
import {
  runThinkingCotShieldTest,
  runThinkingPreVocalBargeInTest,
  runThinkingCoveAuditTest
} from '../testing/acoustic/thinking/thinkingSpecializedSuite';
import { startMockAcousticEngine, MockAcousticEngineInstance } from '../testing/acoustic/mockAcousticEngine';
import { ScenarioResult } from '../testing/acoustic/scenarios/types';

function parseArgs(): {
  fixturesOnly: boolean;
  suite: string;
  engine: string;
  scenario: string;
  isMock: boolean;
} {
  const args = process.argv.slice(2);
  let fixturesOnly = false;
  let suite = '';
  let engine = 'gemini-live-v3';
  let scenario = 'all';
  let isMock = false;

  for (const arg of args) {
    if (arg === '--fixtures' || arg === '--pre-generate-fixtures') {
      fixturesOnly = true;
    } else if (arg.startsWith('--suite=')) {
      suite = arg.split('=')[1];
    } else if (arg.startsWith('--engine=')) {
      engine = arg.split('=')[1];
      if (engine === 'mock') isMock = true;
    } else if (arg.startsWith('--scenario=')) {
      scenario = arg.split('=')[1];
    } else if (arg === '--mock') {
      isMock = true;
    }
  }

  return { fixturesOnly, suite, engine, scenario, isMock };
}

function printAsciiTable(results: ScenarioResult[]): void {
  console.log('\n' + '═'.repeat(90));
  console.log('                 ACOUSTIC AUTO-VAD & REASONING MATRIX REPORT');
  console.log('═'.repeat(90));
  console.log(
    'Scenario'.padEnd(30) +
    'Engine'.padEnd(24) +
    'Status'.padEnd(10) +
    'Duration'.padEnd(12) +
    'TTFA / TTFT'
  );
  console.log('─'.repeat(90));

  for (const r of results) {
    const statusStr = r.passed ? '✅ PASS' : '❌ FAIL';
    const durStr = `${(r.durationMs / 1000).toFixed(1)}s`;
    const metricParts: string[] = [];
    if (r.ttfaMs) metricParts.push(`TTFA: ${r.ttfaMs}ms`);
    if (r.ttftMs) metricParts.push(`TTFT: ${r.ttftMs}ms`);
    if (r.interruptionLatencyMs) metricParts.push(`Barge: ${r.interruptionLatencyMs}ms`);
    const metricStr = metricParts.length > 0 ? metricParts.join(' | ') : '-';

    console.log(
      r.scenarioName.padEnd(30) +
      r.engine.padEnd(24) +
      statusStr.padEnd(10) +
      durStr.padEnd(12) +
      metricStr
    );

    if (!r.passed && r.failureReason) {
      console.log(`   └─ ⚠️ ${r.failureReason}`);
    }
  }

  console.log('═'.repeat(90));
}

async function main() {
  const { fixturesOnly, suite, engine, scenario, isMock } = parseArgs();

  let mockEngineInstance: MockAcousticEngineInstance | null = null;
  if (isMock) {
    console.log('🤖 Initializing in-process Mock Gemini Live & Auto-VAD Acoustic Engine...');
    mockEngineInstance = await startMockAcousticEngine();
    process.env.TEST_BACKEND_HOST = `127.0.0.1:${mockEngineInstance.port}`;
    console.log(`🔌 Mock Acoustic Engine active on ws://127.0.0.1:${mockEngineInstance.port}/ws/live\n`);
  }

  try {
    console.log('🎙️ [Acoustic Test Harness] Initializing fixture verification...');
    if (fixturesOnly) {
      console.log('📦 Prewarming all registered golden speech fixtures via LiteLLM Proxy...');
      const res = await AcousticFixtureManager.prewarmAllFixtures();
      console.log('✅ Golden fixtures ready on disk:');
      for (const [id, bytes] of Object.entries(res)) {
        console.log(`  - ${id}: ${bytes} bytes (${(bytes / 32000).toFixed(2)}s)`);
      }
      return process.exit(0);
    }

    const results: ScenarioResult[] = [];

    // Dedicated Pre-Flight Canary Suite: tests both live-v3 and thinking-v3
    if (suite === 'canary') {
      console.log('\n======================================================');
      console.log('🦅 RUNNING SOTA DUAL-ENGINE CANARY SUITE');
      console.log('======================================================');

      // 1. Multi-Turn Turn-Taking with Strict Latency SLA on gemini-live-v3
      console.log('\n[Canary 1/5] Multi-Turn Dialogue (2 Turns with SLA) on gemini-live-v3...');
      results.push(await runMultiTurnDialogueScenario('gemini-live-v3', 2));

      // 2. Acoustic Barge-In Voice Interruption
      console.log('\n[Canary 2/5] Acoustic Barge-In Interruption on gemini-live-v3...');
      results.push(await runBargeInScenario('gemini-live-v3'));

      // 3. Extended Thinking CoT Shield Smoke Test on gemini-live-thinking-v3
      console.log('\n[Canary 3/5] Thinking CoT Shield & Zero-Leakage on gemini-live-thinking-v3...');
      results.push(await runThinkingCotShieldTest('gemini-live-thinking-v3'));

      // 4. Code Handover & Atomic Fusion SLA in Tutor Practice Mode
      console.log('\n[Canary 4/5] Code Handover & Atomic Fusion SLA on gemini-live-v3...');
      results.push(await runCodeHandoverSlaScenario('gemini-live-v3'));

      // 5. Full Interview Lifecycle & Evaluation Persistence Verification
      console.log('\n[Canary 5/5] Full Interview Lifecycle & Evaluation DB Verification on gemini-live-v3...');
      results.push(await runFullInterviewLifecycleScenario('gemini-live-v3'));

      printAsciiTable(results);
      const allPassed = results.every((r) => r.passed);
      if (!allPassed) {
        console.error('\n❌ Pre-Flight Canary verification failed.');
        process.exit(1);
      } else {
        console.log('\n🎉 SOTA Dual-Engine Canary passed successfully!');
        process.exit(0);
      }
    }

    const enginesToTest = (engine === 'all' || engine === 'mock')
      ? ['gemini-live-v3', 'gemini-live-thinking-v3']
      : [engine];

    for (const currentEngine of enginesToTest) {
      console.log(`\n======================================================`);
      console.log(`🚀 RUNNING SCENARIOS FOR ENGINE: [${currentEngine}]`);
      console.log(`======================================================`);

      const isThinking = currentEngine.includes('thinking');

      // 1. Standard Turn
      if (scenario === 'all' || scenario === 'standard') {
        results.push(await runStandardTurnScenario(currentEngine));
      }

      // 2. Multi-Turn Dialogue
      if (scenario === 'all' || scenario === 'multiturn') {
        results.push(await runMultiTurnDialogueScenario(currentEngine, 3));
      }

      // 3. Mid-Sentence Hesitation
      if (scenario === 'all' || scenario === 'hesitation') {
        results.push(await runHesitationScenario(currentEngine));
      }

      // 4. Acoustic Barge-In
      if (scenario === 'all' || scenario === 'bargein') {
        results.push(await runBargeInScenario(currentEngine));
      }

      // 5. Micro-Noise Rejection
      if (scenario === 'all' || scenario === 'noise') {
        results.push(await runNoiseRejectionScenario(currentEngine));
      }

      // 6. Acoustic Stress Suite (Vocalized hesitation, typing noise, breath rejection)
      if (scenario === 'all' || scenario === 'stress') {
        console.log(`\n⚡ Running Real-World Acoustic Stress Suite for [${currentEngine}]...`);
        results.push(await runVocalizedHesitationTest(currentEngine));
        results.push(await runTypingImmunityTest(currentEngine));
        results.push(await runBreathRejectionTest(currentEngine));
      }

      // 7. Thinking Specialized Suite (runs for thinking model or if explicitly requested)
      if (isThinking || scenario === 'thinking') {
        console.log(`\n🧠 Running Extended Thinking Reasoning Suite for [${currentEngine}]...`);
        results.push(await runThinkingCotShieldTest(currentEngine));
        results.push(await runThinkingPreVocalBargeInTest(currentEngine));
        results.push(await runThinkingCoveAuditTest(currentEngine));
      }

      // 8. Code Handover SLA (Tutor Practice Mode)
      if (scenario === 'all' || scenario === 'handover' || scenario === 'code') {
        results.push(await runCodeHandoverSlaScenario(currentEngine));
      }
    }

    printAsciiTable(results);

    const allPassed = results.every((r) => r.passed);
    if (!allPassed) {
      console.error('\n❌ One or more acoustic Auto-VAD scenarios failed.');
      process.exit(1);
    } else {
      console.log('\n🎉 All acoustic Auto-VAD scenarios passed successfully!');
      process.exit(0);
    }
  } finally {
    if (mockEngineInstance) {
      await mockEngineInstance.close();
    }
  }
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
