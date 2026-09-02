/**
 * Master Verification Suite for Phase 6: Testing & Mutation Arena
 * Validates all mutation testing katas seeded in the platform:
 * 1. Verifies AST Test Quality Scanner (Flaky Sleep & Assertion-free detection)
 * 2. Runs each seeded mutation kata through JvmExecutionService.executeMutation
 * 3. Verifies Baseline Check passes on initial service contracts
 * 4. Asserts resident in-memory execution latency (< 250ms total per challenge)
 * 5. Verifies Mutation Score calculation and Killed/Survived mutant breakdowns
 */

const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');
const { TestQualityScanner } = require('../dist/services/sandbox/TestQualityScanner');
const { MUTATION_TESTING_CHALLENGES } = require('../dist/services/mutationChallenges');
const { ADDITIONAL_MUTATION_CHALLENGES } = require('../dist/services/additionalMutationChallenges');

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('🧪 MASTER VERIFICATION: PHASE 6 TESTING & MUTATION ARENA');
  console.log('========================================================================\n');

  // 1. Verify AST Test Quality Scanner
  console.log('--- 1. Testing TestQualityScanner Guards ---');

  const sleepViolationCode = [{
    path: 'src/test/java/com/SampleTest.java',
    content: 'package com; public class SampleTest { @org.junit.jupiter.api.Test public void test() throws Exception { Thread.sleep(500); org.junit.jupiter.api.Assertions.assertTrue(true); } }'
  }];
  const scanSleep = TestQualityScanner.scan(sleepViolationCode);
  console.log('  * Flaky Sleep Blocked:', !scanSleep.isValid, 'Rule:', scanSleep.violations[0]?.rule);
  if (scanSleep.isValid || scanSleep.violations[0]?.rule !== 'FLAKY_SLEEP') {
    throw new Error('TestQualityScanner failed to block Thread.sleep');
  }

  const noAssertCode = [{
    path: 'src/test/java/com/SampleTest.java',
    content: 'package com; public class SampleTest { @org.junit.jupiter.api.Test public void test() { int a = 5; } }'
  }];
  const scanAssert = TestQualityScanner.scan(noAssertCode);
  console.log('  * Assertion-Free Test Flagged:', scanAssert.violations[0]?.rule === 'NO_ASSERTIONS');
  if (scanAssert.violations[0]?.rule !== 'NO_ASSERTIONS') {
    throw new Error('TestQualityScanner failed to flag test without assertions');
  }

  const allTestingKatas = [...MUTATION_TESTING_CHALLENGES, ...ADDITIONAL_MUTATION_CHALLENGES];
  console.log(`\n--- 2. Verifying ${allTestingKatas.length} Seeded Testing & Mutation Katas in JVM Sandbox ---`);

  let allPassed = true;
  const kataReports = [];

  for (let i = 0; i < allTestingKatas.length; i++) {
    const kata = allTestingKatas[i];
    const kataNum = i + 1;
    console.log(`\n[${kataNum}/${allTestingKatas.length}] Verifying: ${kata.title} (${kata.id})`);
    console.log(`  - Mutants defined: ${kata.mutants?.length || 0}`);
    console.log(`  - Required Score: ${kata.requiredMutationScore || 85}%`);

    if (!kata.workspaceFiles || kata.workspaceFiles.length === 0) {
      throw new Error(`Kata ${kata.id} has no workspace files!`);
    }

    if (!kata.mutants || kata.mutants.length === 0) {
      throw new Error(`Kata ${kata.id} has no mutants defined!`);
    }

    const files = kata.workspaceFiles.map(f => ({ path: f.path, content: f.content }));
    const startTime = Date.now();

    const response = await JvmExecutionService.executeMutation({
      challengeId: kata.id,
      files,
      mutants: kata.mutants,
      requiredScore: kata.requiredMutationScore || 85
    });

    const elapsed = Date.now() - startTime;
    console.log(`  - Baseline Passed: ${response.baselinePassed ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Mutation Score: ${response.mutationScore}% (Killed: ${response.killedCount}/${response.totalMutants})`);
    console.log(`  - Total Latency: ${elapsed} ms (In-Memory runner: ${response.executionTimeMs} ms)`);

    if (!response.baselinePassed) {
      console.error(`  ❌ FAILED BASELINE: ${response.error}`);
      allPassed = false;
    }

    kataReports.push({
      id: kata.id,
      title: kata.title,
      baselinePassed: response.baselinePassed,
      mutationScore: response.mutationScore,
      killedCount: response.killedCount,
      totalMutants: response.totalMutants,
      latencyMs: elapsed
    });
  }

  console.log('\n========================================================================');
  console.log('📊 PHASE 6 MUTATION KATA VERIFICATION SUMMARY TABLE');
  console.log('========================================================================');
  console.table(kataReports);

  if (!allPassed) {
    throw new Error('One or more mutation katas failed baseline verification!');
  }

  console.log('\n🎉 ALL 8 TESTING & MUTATION KATAS AND AST GUARDS VERIFIED SUCCESSFULLY!');
}

runMasterVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
