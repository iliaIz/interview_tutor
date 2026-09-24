import assert from 'assert';
import { TestQualityScanner } from '../services/sandbox/TestQualityScanner';

console.log('========================================================================');
console.log('🧪 SOTA TEST QUALITY SCANNER & POTEMKIN TEST BYPASS VERIFICATION SUITE');
console.log('========================================================================\n');

// 1. Valid test with nested braces (if block, lambda) + AssertJ
const validNestedCode = `
package com.example;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class UserServiceTest {
    @Test
    void testUserProcessing() {
        var user = new User("Alice", 25);
        if (user.getAge() > 18) {
            System.out.println("Adult user");
        }
        assertThat(user.getName()).isEqualTo("Alice");
    }
}
`;

const res1 = TestQualityScanner.scan([{ path: 'src/test/java/UserServiceTest.java', content: validNestedCode }]);
assert.strictEqual(res1.isValid, true, 'Test with nested blocks and assertThat must be valid');
assert.strictEqual(res1.violations.length, 0, 'No violations expected for valid test');
console.log('✅ Test 1 Passed: Nested brace test with assertThat correctly identified as valid');

// 2. Potemkin Test (Empty method body)
const potemkinCode = `
package com.example;
import org.junit.jupiter.api.Test;

class EmptyTest {
    @Test
    void emptyTestMethod() {
        // No assertions here!
    }
}
`;

const res2 = TestQualityScanner.scan([{ path: 'src/test/java/EmptyTest.java', content: potemkinCode }]);
assert.strictEqual(res2.isValid, false, 'Empty test method must be invalid (Potemkin test)');
const noAssertViolation = res2.violations.find((v) => v.rule === 'NO_ASSERTIONS');
assert.ok(noAssertViolation, 'Must have NO_ASSERTIONS violation');
assert.strictEqual(noAssertViolation?.severity, 'ERROR', 'NO_ASSERTIONS must have ERROR severity');
console.log('✅ Test 2 Passed: Potemkin test rejected with ERROR severity');

// 3. Flaky Sleep Test
const sleepCode = `
package com.example;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class SleepTest {
    @Test
    void testWithSleep() throws Exception {
        Thread.sleep(100);
        assertThat(1).isEqualTo(1);
    }
}
`;

const res3 = TestQualityScanner.scan([{ path: 'src/test/java/SleepTest.java', content: sleepCode }]);
assert.strictEqual(res3.isValid, false, 'Thread.sleep test must be invalid');
assert.ok(res3.violations.some((v) => v.rule === 'FLAKY_SLEEP' && v.severity === 'ERROR'));
console.log('✅ Test 3 Passed: Flaky Thread.sleep rejected with ERROR severity');

// 4. Over-Mocking Test
const overMockCode = `
package com.example;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;

class OverMockTest {
    @Test
    void testCollectionMock() {
        var list = mock(List.class);
        verify(list, never()).clear();
    }
}
`;

const res4 = TestQualityScanner.scan([{ path: 'src/test/java/OverMockTest.java', content: overMockCode }]);
assert.strictEqual(res4.isValid, false, 'mock(List.class) must be invalid');
assert.ok(res4.violations.some((v) => v.rule === 'OVER_MOCKING' && v.severity === 'ERROR'));
console.log('✅ Test 4 Passed: mock(List.class) over-mocking rejected with ERROR severity');

console.log('\n========================================================================');
console.log('🎉 ALL TEST QUALITY SCANNER CONTRACT TESTS PASSED (4/4)!');
console.log('========================================================================');
