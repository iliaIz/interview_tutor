const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testInCompilerSecurityAndLifecycle() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING IN-COMPILER AST SECURITY & JUNIT LIFECYCLE');
  console.log('========================================================================\n');

  // Test 1: Comments and Strings mentioning System.exit should NOT be blocked (Zero False Positives)
  console.log('--- 1. Testing Zero False Positives on Comments and String Literals ---');
  const safeCode = [
    {
      path: 'src/main/java/com/SafeService.java',
      content: `package com;
public class SafeService {
    /* Multi-line comment mentioning System.exit(0) and ProcessBuilder */
    // Single line mentioning Runtime.getRuntime().exec()
    public String getWarning() {
        return "Warning: System.exit is prohibited!";
    }
}`
    },
    {
      path: 'src/test/java/com/SafeServiceTest.java',
      content: `package com;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;
import static org.assertj.core.api.Assertions.assertThat;
import java.util.Map;
import java.util.HashMap;

public class SafeServiceTest {
    private SafeService service;
    private boolean beforeRan = false;

    @BeforeEach
    public void setup() {
        service = new SafeService();
        beforeRan = true;
    }

    @AfterEach
    public void cleanup() {
        service = null;
    }

    @Test
    public void testSafeCommentsAndLifecycle() {
        assertTrue(beforeRan);
        assertEquals("Warning: System.exit is prohibited!", service.getWarning());

        // Test extended AssertJ map assertions
        Map<String, String> map = new HashMap<>();
        map.put("key1", "val1");
        assertThat(map).as("Checking config map").hasSize(1).containsEntry("key1", "val1");
    }
}`
    }
  ];

  const safeRes = await JvmExecutionService.execute({ challengeId: 'test_safe', files: safeCode });
  console.log('  * Safe Code Compilable:', safeRes.isCompilable);
  console.log('  * Safe Code Tests Passed:', safeRes.passedCount, 'Failed:', safeRes.failedCount);
  if (!safeRes.isCompilable || safeRes.failedCount > 0) {
    console.error('Safe code failed:', safeRes);
    throw new Error('In-Compiler AST scanner falsely flagged comment/string as security violation!');
  }
  console.log('  ✅ Zero False Positives Confirmed! @BeforeEach and extended AssertJ work perfectly.');

  // Test 2: Actual forbidden invocation System.exit(1) must be blocked
  console.log('\n--- 2. Testing Real Forbidden Method Invocation Blocked ---');
  const attackCode = [
    {
      path: 'src/main/java/com/AttackService.java',
      content: `package com;
public class AttackService {
    public void exploit() {
        System.exit(1);
    }
}`
    }
  ];

  const attackRes = await JvmExecutionService.execute({ challengeId: 'test_attack', files: attackCode });
  console.log('  * Attack Code Blocked:', !attackRes.isCompilable);
  console.log('  * Violation Reported:', attackRes.syntaxErrors?.[0]?.errorMessage || attackRes.error);
  if (attackRes.isCompilable) {
    throw new Error('Security scanner failed to block actual System.exit() call!');
  }
  console.log('  ✅ Security Violation Correctly Blocked!');

  console.log('\n🎉 IN-COMPILER AST SECURITY & JUNIT 5 LIFECYCLE VERIFIED SUCCESSFULLY!');
}

testInCompilerSecurityAndLifecycle().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
