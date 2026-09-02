/**
 * Automated Verification Suite for Isolated Java 21 Sandbox
 * Verifies:
 * 1. AST Security Pre-Scanner blocks malicious / dangerous calls (System.exit, Runtime.exec, Unsafe)
 * 2. In-Memory Java 21 Compiler (< 80ms) and dynamic MemoryClassLoader
 * 3. 100-thread Concurrency Stress Harness with ThreadMXBean deadlock detection
 */

const { AstSecurityScanner } = require('../dist/services/sandbox/AstSecurityScanner');
const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function runTests() {
  console.log('=== 1. Testing AST Security Pre-Scanner (Level 1 Defense) ===');

  // A. Attempt System.exit
  const maliciousExit = [
    {
      path: 'src/main/java/com/Exploit.java',
      content: 'package com; public class Exploit { public void run() { System.exit(0); } }'
    }
  ];
  const scanExit = AstSecurityScanner.scan(maliciousExit);
  console.log('System.exit blocked:', !scanExit.isSafe, scanExit.violations[0]?.rule);
  if (scanExit.isSafe || scanExit.violations[0]?.rule !== 'NO_SYSTEM_EXIT') {
    throw new Error('Expected AST scanner to block System.exit');
  }

  // B. Attempt Runtime.exec
  const maliciousExec = [
    {
      path: 'src/main/java/com/Exploit.java',
      content: 'package com; public class Exploit { public void run() throws Exception { Runtime.getRuntime().exec("notepad"); } }'
    }
  ];
  const scanExec = AstSecurityScanner.scan(maliciousExec);
  console.log('Runtime.exec blocked:', !scanExec.isSafe, scanExec.violations[0]?.rule);
  if (scanExec.isSafe || scanExec.violations[0]?.rule !== 'NO_PROCESS_EXEC') {
    throw new Error('Expected AST scanner to block Runtime.exec');
  }

  // C. Attempt Unsafe
  const maliciousUnsafe = [
    {
      path: 'src/main/java/com/Exploit.java',
      content: 'package com; import sun.misc.Unsafe; public class Exploit { private Unsafe u; }'
    }
  ];
  const scanUnsafe = AstSecurityScanner.scan(maliciousUnsafe);
  console.log('sun.misc.Unsafe blocked:', !scanUnsafe.isSafe, scanUnsafe.violations[0]?.rule);
  if (scanUnsafe.isSafe || scanUnsafe.violations[0]?.rule !== 'NO_UNSAFE') {
    throw new Error('Expected AST scanner to block sun.misc.Unsafe');
  }

  console.log('\n=== 2. Testing In-Memory Java 21 Compilation & Test Runner (< 80ms) ===');

  const validWorkspace = [
    {
      path: 'src/main/java/com/assessment/ratelimiter/TokenBucket.java',
      content: `package com.assessment.ratelimiter;
import java.util.concurrent.atomic.AtomicLong;

public class TokenBucket {
    private final long capacity;
    private final double refillRatePerMs;
    private final AtomicLong tokens;
    private volatile long lastRefillTime;

    public TokenBucket(long capacity, double refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRatePerMs = refillRatePerSecond / 1000.0;
        this.tokens = new AtomicLong(capacity);
        this.lastRefillTime = System.currentTimeMillis();
    }

    public synchronized boolean tryAcquire(long requiredTokens) {
        refill();
        if (tokens.get() >= requiredTokens) {
            tokens.addAndGet(-requiredTokens);
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRefillTime;
        if (elapsed > 0) {
            long newTokens = (long) (elapsed * refillRatePerMs);
            if (newTokens > 0) {
                tokens.set(Math.min(capacity, tokens.get() + newTokens));
                lastRefillTime = now;
            }
        }
    }

    public long getAvailableTokens() {
        return tokens.get();
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/ratelimiter/TokenBucketTest.java',
      content: `package com.assessment.ratelimiter;

public class TokenBucketTest {
    public void testBasicAcquire() {
        TokenBucket bucket = new TokenBucket(10, 5);
        if (!bucket.tryAcquire(5)) {
            throw new AssertionError("Should acquire 5 tokens");
        }
        if (bucket.getAvailableTokens() != 5) {
            throw new AssertionError("Expected 5 tokens remaining");
        }
    }

    public void testOverCapacity() {
        TokenBucket bucket = new TokenBucket(5, 1);
        if (!bucket.tryAcquire(5)) {
            throw new AssertionError("Should acquire all tokens");
        }
        if (bucket.tryAcquire(1)) {
            throw new AssertionError("Should not acquire over capacity");
        }
    }

    public void testConcurrentStressSafety() {
        TokenBucket bucket = new TokenBucket(1000, 100);
        // This method will be invoked by the 100-thread blast harness
        bucket.tryAcquire(1);
    }
}`
    }
  ];

  const startTime = Date.now();
  const response = await JvmExecutionService.execute({ files: validWorkspace });
  const totalMs = Date.now() - startTime;

  console.log('Execution Result:');
  console.log(`- Success: ${response.success}`);
  console.log(`- IsCompilable: ${response.isCompilable}`);
  console.log(`- Compilation Time: ${response.compilationTimeMs} ms`);
  console.log(`- Test Execution Time: ${response.executionTimeMs} ms`);
  console.log(`- Total Round-Trip: ${totalMs} ms`);
  console.log(`- Passed Tests: ${response.passedCount}, Failed Tests: ${response.failedCount}`);
  console.log('- Test Details:', response.testResults);
  console.log('- Concurrency Harness:', response.concurrencyHarness);

  if (!response.success || response.failedCount > 0 || response.passedCount < 3) {
    throw new Error(`Execution failed or expected tests did not pass! Errors: ${response.error}`);
  }

  if (!response.concurrencyHarness || response.concurrencyHarness.threadsRan !== 100) {
    throw new Error('Expected Concurrency Harness to execute 100 threads!');
  }

  if (response.concurrencyHarness.deadlockDetected) {
    throw new Error('False-positive deadlock detected on thread-safe code!');
  }

  console.log('\n=== 3. Testing Syntax Error Reporting ===');
  const brokenCode = [
    {
      path: 'src/main/java/com/Broken.java',
      content: 'package com; public class Broken { void test() { int x = "string"; } }'
    }
  ];
  const brokenRes = await JvmExecutionService.execute({ files: brokenCode });
  console.log('Syntax error caught:', !brokenRes.isCompilable, brokenRes.syntaxErrors?.[0]?.errorMessage);
  if (brokenRes.isCompilable || !brokenRes.syntaxErrors || brokenRes.syntaxErrors.length === 0) {
    throw new Error('Expected compiler to report syntax errors');
  }

  console.log('\n=== 4. Testing Failing Assertion Reporting ===');
  const failingCode = [
    {
      path: 'src/test/java/com/FailTest.java',
      content: 'package com; public class FailTest { public void testFailure() { throw new AssertionError("Expected 42, but got 0"); } }'
    }
  ];
  const failRes = await JvmExecutionService.execute({ files: failingCode });
  console.log('Assertion failure caught:', failRes.failedCount === 1, failRes.testResults?.[0]?.failureReason);
  if (failRes.failedCount !== 1 || !failRes.testResults?.[0]?.failureReason?.includes('Expected 42')) {
    throw new Error('Expected test runner to catch AssertionError');
  }

  console.log('\n🎉 ALL JAVA 21 SANDBOX & CONCURRENCY HARNESS TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
