const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testSandboxInnerClassFiltering() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING INNER & SYNTHETIC CLASS FILTERING IN JAVA 21 SANDBOX');
  console.log('========================================================================\n');

  const files = [
    {
      path: 'src/main/java/com/assessment/demo/OrderService.java',
      content: `package com.assessment.demo;

public class OrderService {
    public int calculateTotal(int amount, int tax) {
        return amount + tax;
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/demo/OrderServiceTest.java',
      content: `package com.assessment.demo;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

public class OrderServiceTest {

    // Non-static inner class (synthetic enclosing reference, would fail newInstance without outer instance)
    public class InnerHelperTest {
        public String describe() {
            return "helper";
        }
    }

    // Static nested class
    public static class NestedStaticTestHelper {
        public static int getMultiplier() { return 1; }
    }

    @Test
    void testCalculationWithInnerHelper() {
        OrderService svc = new OrderService();
        InnerHelperTest helper = new InnerHelperTest();
        int res = svc.calculateTotal(100, 20) * NestedStaticTestHelper.getMultiplier();
        assertThat(res).isEqualTo(120);
        assertThat(helper.describe()).isEqualTo("helper");
    }
}`
    }
  ];

  console.log('Executing test with inner helper classes...');
  const res = await JvmExecutionService.execute({
    challengeId: 'test_inner_classes',
    files,
    enableStressHarness: false
  });

  console.log(`Is Compilable: ${res.isCompilable}`);
  console.log(`Passed: ${res.passedCount}, Failed: ${res.failedCount}`);
  if (res.testResults) {
    res.testResults.forEach(t => console.log(`  - [${t.status}] ${t.testName}`));
  }

  if (!res.isCompilable || res.failedCount > 0 || res.passedCount !== 1) {
    throw new Error('Inner class filtering failed!');
  }

  console.log('\n🎉 INNER CLASS FILTERING VERIFIED WITH FLYING COLORS!');
}

testSandboxInnerClassFiltering().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
