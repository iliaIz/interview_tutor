const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testSandboxInfiniteLoopTimeout() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING INFINITE LOOP SAFETY TIMEOUT IN JAVA 21 SANDBOX');
  console.log('========================================================================\n');

  const files = [
    {
      path: 'src/main/java/com/assessment/demo/LoopService.java',
      content: `package com.assessment.demo;

public class LoopService {
    public void runInfinite() {
        while (true) {
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                // intentionally loop
            }
        }
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/demo/LoopServiceTest.java',
      content: `package com.assessment.demo;

import org.junit.jupiter.api.Test;

public class LoopServiceTest {
    @Test
    void shouldTimeoutGracefully() {
        LoopService svc = new LoopService();
        svc.runInfinite();
    }
}`
    }
  ];

  console.log('Executing test with intentional while(true) loop...');
  const start = Date.now();
  const res = await JvmExecutionService.execute({
    challengeId: 'test_infinite_loop',
    files,
    enableStressHarness: false
  });
  const duration = Date.now() - start;

  console.log(`Execution completed in ${duration}ms`);
  console.log('RES:', JSON.stringify(res, null, 2));

  if (res.failedCount !== 1 || !res.testResults[0].failureReason.includes('2500ms')) {
    throw new Error('Infinite loop was not properly caught by timeout guard!');
  }

  console.log('\n🎉 INFINITE LOOP TIMEOUT GUARD VERIFIED WITH FLYING COLORS!');
}

testSandboxInfiniteLoopTimeout().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
