const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');
const { L0_PRIMITIVES_CHALLENGES, L1_REVERSE_TESTING_CHALLENGES } = require('../dist/services/mutationChallenges');

async function verifyCurriculum() {
  console.log('🧪 VERIFYING CURRICULUM LADDER (L0 Primitives & L1 Reverse Testing)...');
  const allKatas = [...L0_PRIMITIVES_CHALLENGES, ...L1_REVERSE_TESTING_CHALLENGES];
  console.log(`Total tasks to verify: ${allKatas.length}`);

  let passedCount = 0;

  for (let i = 0; i < allKatas.length; i++) {
    const kata = allKatas[i];
    console.log(`\n[${i + 1}/${allKatas.length}] Testing: ${kata.title} (${kata.id})`);
    const files = kata.workspaceFiles.map(f => ({ path: f.path, content: f.content }));
    const start = Date.now();

    const response = await JvmExecutionService.executeMutation({
      challengeId: kata.id,
      files,
      mutants: kata.mutants || [],
      requiredScore: kata.requiredMutationScore || 85
    });

    const duration = Date.now() - start;

    console.log(`  - Baseline Passed: ${response.baselinePassed ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Mutation Score: ${response.mutationScore}% (Killed: ${response.killedCount}/${response.totalMutants})`);
    console.log(`  - Latency: ${duration} ms (JVM: ${response.executionTimeMs} ms)`);

    if (!response.baselinePassed) {
      console.error(`❌ Baseline check failed for ${kata.id}!`);
      console.error(response.error || response.compilerError);
      process.exit(1);
    }
    passedCount++;
  }

  console.log(`\n✅ ALL ${passedCount} CURRICULUM KATAS PASSED BASELINE EXECUTION CLEANLY!`);
}

verifyCurriculum().catch(err => {
  console.error('Fatal error in curriculum verification:', err);
  process.exit(1);
});
