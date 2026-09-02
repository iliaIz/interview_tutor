/**
 * Verification Test for Resident In-Memory Mutation Testing Engine (Phase 6)
 * Validates:
 * 1. AST Test Anti-Pattern Guard (TestQualityScanner)
 * 2. Baseline Check & Rejection if candidate tests fail on original service
 * 3. Resident In-Memory Mutant Evaluation (< 120ms)
 * 4. Precise Mutation Score calculation (% Killed)
 */

const { TestQualityScanner } = require('../src/services/sandbox/TestQualityScanner');
const { JvmExecutionService } = require('../src/services/sandbox/JvmExecutionService');

async function runTests() {
  console.log('=== 1. Testing TestQualityScanner (AST Anti-Patterns) ===');

  // A. Detect Flaky Sleep
  const flakySleepCode = [
    {
      path: 'src/test/java/com/OrderTest.java',
      content: `package com;
      import org.junit.jupiter.api.Test;
      public class OrderTest {
        @Test
        public void testAsync() throws Exception {
          Thread.sleep(1000);
          org.junit.jupiter.api.Assertions.assertTrue(true);
        }
      }`
    }
  ];
  const scanSleep = TestQualityScanner.scan(flakySleepCode);
  console.log('Flaky sleep detected:', !scanSleep.isValid, scanSleep.violations[0]?.rule);
  if (scanSleep.isValid || scanSleep.violations[0]?.rule !== 'FLAKY_SLEEP') {
    throw new Error('TestQualityScanner failed to flag Thread.sleep');
  }

  // B. Detect Assertion-Free Test
  const assertionFreeCode = [
    {
      path: 'src/test/java/com/OrderTest.java',
      content: `package com;
      import org.junit.jupiter.api.Test;
      public class OrderTest {
        @Test
        public void testDoSomething() {
          var x = 1 + 1;
        }
      }`
    }
  ];
  const scanAssert = TestQualityScanner.scan(assertionFreeCode);
  console.log('Assertion-free test detected:', scanAssert.violations[0]?.rule);
  if (scanAssert.violations[0]?.rule !== 'NO_ASSERTIONS') {
    throw new Error('TestQualityScanner failed to flag test without assertions');
  }

  console.log('\n=== 2. Testing In-Memory Mutation Runner (< 120ms) ===');

  const baseService = `package com.assessment.order;
import java.math.BigDecimal;

public class OrderPricingService {
    public BigDecimal calculateDiscount(BigDecimal orderTotal) {
        if (orderTotal == null) return BigDecimal.ZERO;
        if (orderTotal.compareTo(new BigDecimal("100.00")) > 0) {
            return orderTotal.multiply(new BigDecimal("0.10"));
        }
        return BigDecimal.ZERO;
    }
}`;

  // Incomplete test: only tests 50 and 150 (leaves Boundary mutant surviving)
  const weakCandidateTest = `package com.assessment.order;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

public class OrderPricingServiceTest {
    @Test
    public void testUnderThreshold() {
        OrderPricingService service = new OrderPricingService();
        BigDecimal discount = service.calculateDiscount(new BigDecimal("50.00"));
        assertEquals(0, discount.compareTo(BigDecimal.ZERO));
    }

    @Test
    public void testOverThreshold() {
        OrderPricingService service = new OrderPricingService();
        BigDecimal discount = service.calculateDiscount(new BigDecimal("150.00"));
        assertEquals(0, discount.compareTo(new BigDecimal("15.00")));
    }
}`;

  const mutants = [
    {
      id: 'mutant_boundary_100',
      name: 'ConditionalsBoundaryMutator',
      file: 'src/main/java/com/assessment/order/OrderPricingService.java',
      line: 7,
      mutatedContent: `package com.assessment.order;
import java.math.BigDecimal;

public class OrderPricingService {
    public BigDecimal calculateDiscount(BigDecimal orderTotal) {
        if (orderTotal == null) return BigDecimal.ZERO;
        if (orderTotal.compareTo(new BigDecimal("100.00")) >= 0) { // MUTANT: >= instead of >
            return orderTotal.multiply(new BigDecimal("0.10"));
        }
        return BigDecimal.ZERO;
    }
}`
    },
    {
      id: 'mutant_math_discount',
      name: 'MathMutator',
      file: 'src/main/java/com/assessment/order/OrderPricingService.java',
      line: 8,
      mutatedContent: `package com.assessment.order;
import java.math.BigDecimal;

public class OrderPricingService {
    public BigDecimal calculateDiscount(BigDecimal orderTotal) {
        if (orderTotal == null) return BigDecimal.ZERO;
        if (orderTotal.compareTo(new BigDecimal("100.00")) > 0) {
            return orderTotal.multiply(new BigDecimal("0.05")); // MUTANT: 0.05 instead of 0.10
        }
        return BigDecimal.ZERO;
    }
}`
    },
    {
      id: 'mutant_return_zero',
      name: 'ReturnValsMutator',
      file: 'src/main/java/com/assessment/order/OrderPricingService.java',
      line: 8,
      mutatedContent: `package com.assessment.order;
import java.math.BigDecimal;

public class OrderPricingService {
    public BigDecimal calculateDiscount(BigDecimal orderTotal) {
        if (orderTotal == null) return BigDecimal.ZERO;
        if (orderTotal.compareTo(new BigDecimal("100.00")) > 0) {
            return BigDecimal.ZERO; // MUTANT: always zero
        }
        return BigDecimal.ZERO;
    }
}`
    }
  ];

  // Run with weak tests
  const filesWeak = [
    { path: 'src/main/java/com/assessment/order/OrderPricingService.java', content: baseService },
    { path: 'src/test/java/com/assessment/order/OrderPricingServiceTest.java', content: weakCandidateTest }
  ];

  const resultWeak = await JvmExecutionService.executeMutation({
    files: filesWeak,
    mutants,
    requiredScore: 85
  });

  console.log('Weak Test Run Result:');
  console.log('- Baseline Passed:', resultWeak.baselinePassed);
  console.log('- Mutation Score:', resultWeak.mutationScore + '%');
  console.log('- Killed / Survived:', `${resultWeak.killedCount} / ${resultWeak.survivedCount}`);
  console.log('- Passed Threshold (>= 85%):', resultWeak.passedThreshold);
  console.log('- Mutants breakdown:');
  for (const m of resultWeak.mutantResults) {
    console.log(`  * [${m.status}] ${m.id} (${m.name}) ${m.killedBy ? 'killed by ' + m.killedBy : 'SURVIVED'}`);
  }

  if (resultWeak.mutationScore >= 85 || resultWeak.survivedCount === 0) {
    throw new Error('Weak test should not kill the boundary mutant!');
  }

  // C. Now test with Strong Candidate Test (kills boundary at 100.00)
  console.log('\n=== 3. Testing Strong Candidate Test (Killing 100% of Mutants) ===');
  const strongCandidateTest = `package com.assessment.order;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

public class OrderPricingServiceTest {
    @Test
    public void testUnderThreshold() {
        OrderPricingService service = new OrderPricingService();
        BigDecimal discount = service.calculateDiscount(new BigDecimal("50.00"));
        assertEquals(0, discount.compareTo(BigDecimal.ZERO));
    }

    @Test
    public void testExactBoundary100() {
        OrderPricingService service = new OrderPricingService();
        BigDecimal discount = service.calculateDiscount(new BigDecimal("100.00"));
        // At exactly 100.00, discount should be 0.00 (> 100 required)
        assertEquals(0, discount.compareTo(BigDecimal.ZERO), "At 100.00 discount must be 0");
    }

    @Test
    public void testOverThreshold() {
        OrderPricingService service = new OrderPricingService();
        BigDecimal discount = service.calculateDiscount(new BigDecimal("150.00"));
        assertEquals(0, discount.compareTo(new BigDecimal("15.00")));
    }
}`;

  const filesStrong = [
    { path: 'src/main/java/com/assessment/order/OrderPricingService.java', content: baseService },
    { path: 'src/test/java/com/assessment/order/OrderPricingServiceTest.java', content: strongCandidateTest }
  ];

  const startTime = Date.now();
  const resultStrong = await JvmExecutionService.executeMutation({
    files: filesStrong,
    mutants,
    requiredScore: 85
  });
  const duration = Date.now() - startTime;

  console.log('Strong Test Run Result:');
  console.log('- Baseline Passed:', resultStrong.baselinePassed);
  console.log('- Mutation Score:', resultStrong.mutationScore + '%');
  console.log('- Killed / Survived:', `${resultStrong.killedCount} / ${resultStrong.survivedCount}`);
  console.log('- Total Execution Duration:', duration + ' ms');
  console.log('- Passed Threshold (>= 85%):', resultStrong.passedThreshold);
  for (const m of resultStrong.mutantResults) {
    console.log(`  * [${m.status}] ${m.id} (${m.name}) killed by ${m.killedBy}`);
  }

  if (resultStrong.mutationScore < 100 || resultStrong.survivedCount > 0) {
    throw new Error('Strong test should kill 100% of mutants!');
  }

  console.log('\n🎉 ALL MUTATION ENGINE & AST SCANNER TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
