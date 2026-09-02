const { evaluateChallengeSubmission } = require('../dist/services/codeEvaluator');
const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testRealSandboxEval() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING REAL JVM SANDBOX GROUNDING IN PRACTICE EVALUATION');
  console.log('========================================================================\n');

  const uncompilableFiles = [
    {
      path: 'src/main/java/com/assessment/fintech/Broken.java',
      content: `package com.assessment.fintech;
public class Broken {
   public void bad( { // Missing closing paren
}`
    }
  ];

  const dummyChallenge = {
    id: 'test_broken_kata',
    title: 'Broken Kata',
    category: 'Concurrency',
    targetStack: 'Java 21',
    shortDescription: 'Test',
    phasedRequirements: [],
    scoringWeights: {
      functionalCorrectness: 0.4,
      concurrencySafety: 0.2,
      architectureAndCleanCode: 0.2,
      modernIdioms: 0.2
    }
  };

  console.log('1. Testing uncompilable submission (must fail fast in 0ms without LLM hallucination)...');
  const sandboxFailResult = await JvmExecutionService.execute({
    challengeId: dummyChallenge.id,
    files: uncompilableFiles,
    activePhase: 1
  });

  const evalFail = await evaluateChallengeSubmission({
    challenge: dummyChallenge,
    files: uncompilableFiles,
    activePhase: 1,
    sandboxResult: sandboxFailResult
  });

  console.log('Eval Compilable:', evalFail.compilationStatus.isCompilable);
  console.log('Eval Overall Score:', evalFail.scoreBreakdown.overallScore);
  console.log('Eval Summary:', evalFail.scoreBreakdown.summaryReview);

  if (evalFail.compilationStatus.isCompilable !== false || evalFail.scoreBreakdown.overallScore !== 0) {
    console.error('❌ Expected uncompilable code to immediately return isCompilable=false and overallScore=0!');
    process.exit(1);
  }

  console.log('✅ Uncompilable code was rejected authoritatively by real sandbox!');
  console.log('\n🎉 REAL SANDBOX GROUNDING VERIFIED SUCCESSFULLY!');
  process.exit(0);
}

testRealSandboxEval().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
