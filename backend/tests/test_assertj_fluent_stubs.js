const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testAssertjFluentStubs() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING EXPANDED ASSERTJ FLUENT STUBS IN JAVA 21 SANDBOX');
  console.log('========================================================================\n');

  const files = [
    {
      path: 'src/main/java/com/assessment/demo/UserDirectory.java',
      content: `package com.assessment.demo;

import java.util.List;
import java.util.ArrayList;

public class UserDirectory {
    public static record User(String name, int age) {}

    private final List<User> users = new ArrayList<>();

    public void addUser(String name, int age) {
        users.add(new User(name, age));
    }

    public List<User> getUsers() {
        return users;
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/demo/UserDirectoryTest.java',
      content: `package com.assessment.demo;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;

public class UserDirectoryTest {
    @Test
    void shouldTestFluentAssertions() {
        UserDirectory dir = new UserDirectory();
        dir.addUser("Alice", 25);
        dir.addUser("Bob", 30);
        dir.addUser("Charlie", 17);

        List<UserDirectory.User> users = dir.getUsers();

        // 1. Basic collection checks
        assertThat(users).hasSize(3);

        // 2. extracting()
        assertThat(users).extracting(u -> u.name())
            .contains("Alice", "Bob")
            .containsExactly("Alice", "Bob", "Charlie");

        // 3. filteredOn()
        assertThat(users).filteredOn(u -> u.age() >= 18)
            .hasSize(2)
            .extracting(u -> u.name())
            .containsExactly("Alice", "Bob");

        // 4. allMatch(), anyMatch(), noneMatch()
        assertThat(users).allMatch(u -> u.age() > 10);
        assertThat(users).anyMatch(u -> u.age() == 25);
        assertThat(users).noneMatch(u -> u.age() < 5);

        // 5. ObjectAssert matches(), isIn(), satisfies()
        assertThat("Alice").isIn("Alice", "Bob", "Charlie");
        assertThat("Dave").isNotIn("Alice", "Bob");
        assertThat(users.get(0)).satisfies(u -> assertThat(u.name()).isEqualTo("Alice"));
        assertThat(users.get(0)).matches(u -> u.age() == 25);
    }
}`
    }
  ];

  const res = await JvmExecutionService.execute({
    challengeId: 'test_assertj_fluent',
    files,
    enableStressHarness: false
  });

  console.log(`Compilable: ${res.isCompilable}`);
  console.log(`Passed: ${res.passedCount}, Failed: ${res.failedCount}`);
  if (res.syntaxErrors && res.syntaxErrors.length > 0) {
    console.error('Syntax Errors:', res.syntaxErrors);
  }
  if (res.testResults) {
    res.testResults.forEach(tr => console.log(`  - [${tr.status}] ${tr.testName} (${tr.durationMs}ms)`));
  }

  if (!res.isCompilable || res.failedCount > 0 || res.passedCount !== 1) {
    throw new Error('AssertJ fluent test failed!');
  }

  console.log('\n🎉 ALL ASSERTJ FLUENT STUBS VERIFIED WITH FLYING COLORS!');
}

testAssertjFluentStubs().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
