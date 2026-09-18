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
import {
  runThinkingCotShieldTest,
  runThinkingPreVocalBargeInTest,
  runThinkingCoveAuditTest
} from '../testing/acoustic/thinking/thinkingSpecializedSuite';
import { ScenarioResult } from '../testing/acoustic/scenarios/types';

function parseArgs(): {
  fixturesOnly: boolean;
  engine: string;
  scenario: string;
} {
  const args = process.argv.slice(2);
  let fixturesOnly = false;
  let engine = 'gemini-live-v3';
  let scenario = 'all';

  for (const arg of args) {
    if (arg === '--fixtures' || arg === '--pre-generate-fixtures') {
      fixturesOnly = true;
    } else if (arg.startsWith('--engine=')) {
      engine = arg.split('=')[1];
    } else if (arg.startsWith('--scenario=')) {
      scenario = arg.split('=')[1];
    }
  }

  return { fixturesOnly, engine, scenario };
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
    let metricStr = '-';
    if (r.ttfaMs) metricStr = `TTFA: ${r.ttfaMs}ms`;
    if (r.ttftMs) metricStr = `TTFT: ${r.ttftMs}ms`;
    if (r.interruptionLatencyMs) metricStr = `Barge: ${r.interruptionLatencyMs}ms`;

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
  const { fixturesOnly, engine, scenario } = parseArgs();

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

  const enginesToTest = engine === 'all'
    ? ['gemini-live-v3', 'gemini-live-thinking-v3', 'gemini-live-v2']
    : [engine];

  const results: ScenarioResult[] = [];

  for (const currentEngine of enginesToTest) {
    console.log(`\n======================================================`);
    console.log(`🚀 RUNNING SCENARIOS FOR ENGINE: [${currentEngine}]`);
    console.log(`======================================================`);

    const isThinking = currentEngine.includes('thinking');

    // 1. Standard Turn
    if (scenario === 'all' || scenario === 'standard') {
      results.push(await runStandardTurnScenario(currentEngine));
    }

    // 2. Mid-Sentence Hesitation
    if (scenario === 'all' || scenario === 'hesitation') {
      results.push(await runHesitationScenario(currentEngine));
    }

    // 3. Acoustic Barge-In
    if (scenario === 'all' || scenario === 'bargein') {
      results.push(await runBargeInScenario(currentEngine));
    }

    // 4. Micro-Noise Rejection
    if (scenario === 'all' || scenario === 'noise') {
      results.push(await runNoiseRejectionScenario(currentEngine));
    }

    // 5. Thinking Specialized Suite (runs for thinking model or if explicitly requested)
    if (isThinking || scenario === 'thinking') {
      console.log(`\n🧠 Running Extended Thinking Reasoning Suite for [${currentEngine}]...`);
      results.push(await runThinkingCotShieldTest(currentEngine));
      results.push(await runThinkingPreVocalBargeInTest(currentEngine));
      results.push(await runThinkingCoveAuditTest(currentEngine));
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
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
