const assert = require('assert');
const { generateBugChallenge } = require('../dist/services/tutorService');
const { LlmGatewayUnavailableError } = require('../dist/services/dynamicTaskGenerator');

async function runTest() {
  console.log('🧪 Starting Zero-Phantom-Fallback Invariant #5 Verification...');

  // Mock a failing fetch to simulate LiteLLM gateway offline / timeout / 503
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('ECONNREFUSED: LiteLLM Gateway container is restarting');
  };

  try {
    let result = null;
    let thrownError = null;

    try {
      result = await generateBugChallenge({
        topicId: 'core',
        topic: 'Java Core',
        workoutPreset: 'exhaustive',
        techStackProfile: 'fintech_transactional'
      });
    } catch (err) {
      thrownError = err;
    }

    // Invariant #5 assertion: Under no circumstances does the backend return hardcoded static challenges
    assert.strictEqual(result, null, 'Result must be null because static fallback is strictly forbidden by Invariant #5');
    assert.ok(thrownError, 'An error MUST be thrown when LiteLLM is unavailable');
    assert.strictEqual(
      thrownError.name,
      'LlmGatewayUnavailableError',
      `Error must be LlmGatewayUnavailableError, got ${thrownError.name}`
    );
    assert.ok(
      thrownError.retryAfterSeconds > 0,
      'Error must specify retryAfterSeconds for TaskRecoveryCard'
    );

    console.log(`✅ Verified thrown error: ${thrownError.name} [Reason: ${thrownError.reason}, RetryAfter: ${thrownError.retryAfterSeconds}s]`);
    console.log('✅ PASS: Invariant #5 (Zero Phantom Fallback) strictly verified!');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('🎉 ZERO-PHANTOM-FALLBACK TEST PASSED WITH FLYING COLORS!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
