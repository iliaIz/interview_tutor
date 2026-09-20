const http = require('http');
const assert = require('assert');

// Simple mock HTTP server for retry testing
function createMockServer() {
  let callCount = 0;
  let statusSequence = [];

  const server = http.createServer((req, res) => {
    callCount++;
    const currentStatus = statusSequence.length > 0 ? statusSequence.shift() : 200;
    res.writeHead(currentStatus, { 'Content-Type': 'application/json' });
    if (currentStatus === 200) {
      res.end(JSON.stringify({ ok: true, callCount }));
    } else {
      res.end(JSON.stringify({ error: `Mock transient error ${currentStatus}`, callCount }));
    }
  });

  return {
    server,
    setSequence: (seq) => { statusSequence = [...seq]; },
    getCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; }
  };
}

async function runRetryTests() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING SOTA FULL-JITTER HTTP RETRY TRANSPORT (INVARIANT 5)');
  console.log('========================================================================\n');

  // Dynamically compile/transpile or require compiled version
  let fetchWithFullJitterRetry;
  try {
    fetchWithFullJitterRetry = require('../dist/utils/httpRetry').fetchWithFullJitterRetry;
  } catch {
    // If dist doesn't exist yet, require via ts-node register
    require('ts-node/register');
    fetchWithFullJitterRetry = require('../src/utils/httpRetry').fetchWithFullJitterRetry;
  }

  const { server, setSequence, getCallCount, resetCallCount } = createMockServer();

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/test`;

  try {
    // Test 1: Immediate 200 OK (no retries)
    console.log('--- Test 1: Immediate 200 OK ---');
    resetCallCount();
    setSequence([200]);
    const res1 = await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(getCallCount(), 1, 'Should only call once for 200 OK');
    console.log('  ✅ Test 1 PASSED: Single call on 200 OK');

    // Test 2: Transient 503 followed by 200 OK
    console.log('\n--- Test 2: Transient 503 recovered on retry ---');
    resetCallCount();
    setSequence([503, 200]);
    const res2 = await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(getCallCount(), 2, 'Should call twice (1 retry)');
    console.log('  ✅ Test 2 PASSED: Successfully recovered from 503 on retry');

    // Test 3: Rate Limit 429 followed by 200 OK
    console.log('\n--- Test 3: Transient 429 recovered on retry ---');
    resetCallCount();
    setSequence([429, 200]);
    const res3 = await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2);
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(getCallCount(), 2, 'Should call twice (1 retry on 429)');
    console.log('  ✅ Test 3 PASSED: Successfully recovered from 429 on retry');

    // Test 4: Persistent 503 exhausting maxRetries (throws error)
    console.log('\n--- Test 4: Persistent 503 exhausts maxRetries ---');
    resetCallCount();
    setSequence([503, 503, 503, 503]);
    let caughtErr = null;
    try {
      await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2);
    } catch (err) {
      caughtErr = err;
    }
    assert.ok(caughtErr, 'Must throw error when retries exhausted');
    assert.strictEqual(getCallCount(), 3, 'Must attempt initial + 2 retries = 3 total');
    console.log('  ✅ Test 4 PASSED: Exhausted retries thrown cleanly');

    // Test 5: Non-retryable 400 Bad Request (returns immediately without retry)
    console.log('\n--- Test 5: Non-retryable 400 returns immediately ---');
    resetCallCount();
    setSequence([400, 200]);
    const res5 = await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2);
    assert.strictEqual(res5.status, 400);
    assert.strictEqual(getCallCount(), 1, 'Must not retry 400 client error');
    console.log('  ✅ Test 5 PASSED: Non-retryable status returned without delay');

    // Test 6: AbortSignal cancellation
    console.log('\n--- Test 6: AbortSignal cancels retry flow ---');
    resetCallCount();
    setSequence([503, 503]);
    const abortController = new AbortController();
    abortController.abort();
    let abortCaught = null;
    try {
      await fetchWithFullJitterRetry(testUrl, { method: 'GET' }, 2, abortController.signal);
    } catch (err) {
      abortCaught = err;
    }
    assert.ok(abortCaught, 'Must abort immediately');
    assert.strictEqual(abortCaught.name, 'AbortError');
    assert.strictEqual(getCallCount(), 0, 'Must not dispatch request when signal pre-aborted');
    console.log('  ✅ Test 6 PASSED: AbortSignal strictly respected');

    console.log('\n🎉 ALL 6 FULL-JITTER RETRY INVARIANT TESTS PASSED CLEANLY!\n');
  } finally {
    server.close();
  }
}

runRetryTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
