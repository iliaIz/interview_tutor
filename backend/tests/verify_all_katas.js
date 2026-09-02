const { SEEDED_CHALLENGES } = require('../dist/services/challengeSeedData');
const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testAllKatas() {
  console.log('Testing all challenges in In-Memory Java 21 Sandbox...');
  let successCount = 0;
  let failedCount = 0;

  for (const challenge of SEEDED_CHALLENGES) {
    if (!challenge.workspaceFiles || challenge.workspaceFiles.length === 0) {
      console.log(`- Skipping ${challenge.id} (no workspace files)`);
      continue;
    }

    const testFiles = challenge.workspaceFiles.filter(f => f.path.endsWith('Test.java'));
    if (testFiles.length === 0) {
      console.log(`- Skipping ${challenge.id} (no Test.java in workspace)`);
      continue;
    }

    const startTime = Date.now();
    const result = await JvmExecutionService.execute({
      challengeId: challenge.id,
      files: challenge.workspaceFiles
    });
    const duration = Date.now() - startTime;

    if (result.success && result.isCompilable && result.failedCount === 0) {
      console.log(`✓ [${duration}ms] ${challenge.title}: passed ${result.passedCount} tests!`);
      successCount++;
    } else {
      console.error(`✗ [${duration}ms] ${challenge.title} FAILED:`, {
        isCompilable: result.isCompilable,
        error: result.error,
        syntaxErrors: result.syntaxErrors,
        failedCount: result.failedCount,
        testResults: result.testResults
      });
      failedCount++;
    }
  }

  console.log(`\nResults: ${successCount} PASSED, ${failedCount} FAILED.`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

testAllKatas().catch(err => {
  console.error('Runner failed:', err);
  process.exit(1);
});
