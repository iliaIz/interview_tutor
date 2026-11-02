import assert from 'assert';
import { RefactoringAstVerifier } from '../services/sandbox/RefactoringAstVerifier';

console.log('========================================================================');
console.log('🧪 SOTA REFACTORING AST VERIFIER & DESIGN PATTERN INVARIANTS SUITE');
console.log('========================================================================\n');

// 1. Singleton Anti-Pattern Detection (getInstance())
console.log('--- 1. Testing Singleton Anti-Pattern Rejection ---');
const singletonCode = `
package com.example;
public class ConfigManager {
    private static ConfigManager instance;
    private ConfigManager() {}
    public static ConfigManager getInstance() {
        if (instance == null) {
            instance = new ConfigManager();
        }
        return instance;
    }
}
`;
const res1 = RefactoringAstVerifier.verify(
  [{ path: 'src/main/java/com/example/ConfigManager.java', content: singletonCode }],
  {
    disallowedConstructs: ['getInstance'],
    disallowedAstNodes: [],
    disallowedClassImports: [],
    disallowedFieldTypes: [],
    requiredInjections: []
  }
);
assert.strictEqual(res1.passed, false, 'Singleton with getInstance() must fail');
assert.ok(res1.violations.some(v => v.rule === 'DISALLOWED_SINGLETON_CONSTRUCT'), 'Must have DISALLOWED_SINGLETON_CONSTRUCT');
console.log('✅ Test 1 Passed: getInstance() flagged as DISALLOWED_SINGLETON_CONSTRUCT');

// 2. Procedural State Switch Detection
console.log('\n--- 2. Testing Procedural State Switch Rejection ---');
const proceduralSwitchCode = `
package com.example;
public class OrderService {
    public void process(Order order) {
        switch (order.getStatus()) {
            case PENDING:
                order.setStatus(OrderStatus.PAID);
                break;
            case PAID:
                order.setStatus(OrderStatus.SHIPPED);
                break;
            case SHIPPED:
                order.setStatus(OrderStatus.DELIVERED);
                break;
            default:
                throw new IllegalStateException();
        }
    }
}
`;
const res2 = RefactoringAstVerifier.verify(
  [{ path: 'src/main/java/com/example/OrderService.java', content: proceduralSwitchCode }],
  {
    disallowedConstructs: ['PROCEDURAL_STATE_SWITCH'],
    disallowedAstNodes: [],
    disallowedClassImports: [],
    disallowedFieldTypes: [],
    requiredInjections: []
  }
);
assert.strictEqual(res2.passed, false, 'Procedural switch on status must fail');
assert.ok(res2.violations.some(v => v.rule === 'DISALLOWED_PROCEDURAL_SWITCH'), 'Must have DISALLOWED_PROCEDURAL_SWITCH');
console.log('✅ Test 2 Passed: Procedural status switch flagged as DISALLOWED_PROCEDURAL_SWITCH');

// 3. Required Keywords Enforcement (Java 21 Sealed Interface)
console.log('\n--- 3. Testing Missing Required Keywords ---');
const missingSealedCode = `
package com.example;
public interface OrderState {
    void handle();
}
`;
const res3 = RefactoringAstVerifier.verify(
  [{ path: 'src/main/java/com/example/OrderState.java', content: missingSealedCode }],
  {
    requiredKeywords: ['sealed interface', 'permits'],
    disallowedConstructs: [],
    disallowedAstNodes: [],
    disallowedClassImports: [],
    disallowedFieldTypes: [],
    requiredInjections: []
  }
);
assert.strictEqual(res3.passed, false, 'Missing sealed interface must fail');
assert.strictEqual(res3.violations.length, 2, 'Expected 2 missing keyword violations');
assert.ok(res3.violations.every(v => v.rule === 'MISSING_REQUIRED_KEYWORD'), 'Must be MISSING_REQUIRED_KEYWORD');
console.log('✅ Test 3 Passed: Missing sealed interface and permits rejected');

// 4. Max Method Lines Enforcement
console.log('\n--- 4. Testing Max Method Lines Enforcement ---');
const giantMethodCode = `
package com.example;
public class GiantService {
    public void doMassiveWork() {
        int a = 1;
        int b = 2;
        int c = 3;
        int d = 4;
        int e = 5;
        int f = 6;
        int g = 7;
        int h = 8;
        int i = 9;
        int j = 10;
        int k = 11;
        int l = 12;
    }
}
`;
const res4 = RefactoringAstVerifier.verify(
  [{ path: 'src/main/java/com/example/GiantService.java', content: giantMethodCode }],
  {
    maxMethodLines: 8,
    disallowedConstructs: [],
    disallowedAstNodes: [],
    disallowedClassImports: [],
    disallowedFieldTypes: [],
    requiredInjections: []
  }
);
assert.strictEqual(res4.passed, false, 'Giant method must exceed 8 lines');
assert.ok(res4.violations.some(v => v.rule === 'METHOD_LENGTH_EXCEEDED'), 'Must flag METHOD_LENGTH_EXCEEDED');
console.log('✅ Test 4 Passed: Giant method capped and flagged');

// 5. Compliant Java 21 Code Passes Cleanly
console.log('\n--- 5. Testing Compliant Modern Java 21 Code ---');
const compliantCode = `
package com.example;
import java.time.Clock;

public sealed interface OrderState permits PaidState, ShippedState {
    void execute();
}

record PaidState(Clock clock) implements OrderState {
    public void execute() {}
}

record ShippedState(Clock clock) implements OrderState {
    public void execute() {}
}
`;
const res5 = RefactoringAstVerifier.verify(
  [{ path: 'src/main/java/com/example/OrderState.java', content: compliantCode }],
  {
    requiredKeywords: ['sealed interface', 'permits', 'record'],
    requiredInjections: ['java.time.Clock'],
    disallowedConstructs: ['getInstance', 'PROCEDURAL_STATE_SWITCH'],
    disallowedAstNodes: [],
    disallowedClassImports: [],
    disallowedFieldTypes: [],
    maxMethodLines: 20
  }
);
assert.strictEqual(res5.passed, true, 'Compliant modern code must pass');
assert.strictEqual(res5.violations.length, 0, 'Must have zero violations');
console.log('✅ Test 5 Passed: Compliant modern Java 21 code passes with 0 violations');

console.log('\n🎉 ALL REFACTORING AST VERIFIER TESTS PASSED DETERMINISTICALLY!');
