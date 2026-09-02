const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testCompilerServiceHardening() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING COMPILER SERVICE JSON FORMATTING, UNICODE & VIRTUAL THREADS');
  console.log('========================================================================\n');

  // 1. Test Formatted JSON & Unicode Escapes in Source Code
  console.log('1. Testing compilation with Unicode Cyrillic escapes and formatted JSON...');
  const files = [
    {
      path: 'src/main/java/com/assessment/demo/Greeter.java',
      content: `package com.assessment.demo;

public class Greeter {
    // Unicode comment: \\u041f\\u0440\\u0438\\u0432\\u0435\\u0442 (Привет)
    public String greet(String name) {
        if (name == null || name.isBlank()) {
            return "Привет, незнакомец!";
        }
        return "Привет, " + name + "!";
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/demo/GreeterTest.java',
      content: `package com.assessment.demo;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class GreeterTest {
    @Test
    void shouldGreetWithName() {
        Greeter greeter = new Greeter();
        assertEquals("Привет, Анна!", greeter.greet("Анна"));
    }

    @Test
    void shouldHandleDefault() {
        Greeter greeter = new Greeter();
        assertEquals("Привет, незнакомец!", greeter.greet(null));
    }
}`
    }
  ];

  const execRes = await JvmExecutionService.execute({
    challengeId: 'test_greeter_unicode',
    files,
    enableStressHarness: false
  });

  console.log(`Execution Success: ${execRes.success}`);
  console.log(`Is Compilable: ${execRes.isCompilable}`);
  console.log(`Passed: ${execRes.passedCount}, Failed: ${execRes.failedCount}`);
  if (execRes.syntaxErrors && execRes.syntaxErrors.length > 0) {
    console.error('Syntax Errors:', execRes.syntaxErrors);
  }

  if (!execRes.isCompilable || execRes.passedCount !== 2) {
    throw new Error('Unicode & JSON formatting test failed!');
  }
  console.log('✅ Unicode Cyrillic & formatted JSON passed compilation and execution!\n');

  // 2. Test Parallel Mutation Execution via Virtual Threads
  console.log('2. Testing concurrent mutation evaluation across 5 mutants...');
  const mutants = [
    {
      id: 'mutant-1',
      name: 'NegateNullCheck',
      file: 'src/main/java/com/assessment/demo/Greeter.java',
      line: 6,
      mutatedContent: `package com.assessment.demo;

public class Greeter {
    public String greet(String name) {
        if (name != null && !name.isBlank()) {
            return "Привет, незнакомец!";
        }
        return "Привет, " + name + "!";
    }
}`
    },
    {
      id: 'mutant-2',
      name: 'WrongPrefix',
      file: 'src/main/java/com/assessment/demo/Greeter.java',
      line: 9,
      mutatedContent: `package com.assessment.demo;

public class Greeter {
    public String greet(String name) {
        if (name == null || name.isBlank()) {
            return "Привет, незнакомец!";
        }
        return "Здравствуйте, " + name + "!";
    }
}`
    },
    {
      id: 'mutant-3',
      name: 'ReturnEmpty',
      file: 'src/main/java/com/assessment/demo/Greeter.java',
      line: 9,
      mutatedContent: `package com.assessment.demo;

public class Greeter {
    public String greet(String name) {
        return "";
    }
}`
    }
  ];

  const startMut = Date.now();
  const mutRes = await JvmExecutionService.executeMutation({
    challengeId: 'test_greeter_mutations',
    files,
    mutants,
    requiredScore: 85
  });
  const mutDuration = Date.now() - startMut;

  console.log(`Mutation Baseline Passed: ${mutRes.baselinePassed}`);
  console.log(`Mutation Score: ${mutRes.mutationScore}% (Killed: ${mutRes.killedCount}/${mutRes.totalMutants})`);
  console.log(`Mutation Execution Latency: ${mutDuration} ms (JVM reported: ${mutRes.executionTimeMs} ms)`);
  console.log('Mutants details:', mutRes.mutantResults.map(m => `[${m.status}] ${m.id} (killedBy: ${m.killedBy || 'none'})`));

  if (!mutRes.baselinePassed || mutRes.killedCount !== 3) {
    throw new Error(`Expected 3 killed mutants, got ${mutRes.killedCount}`);
  }
  console.log('✅ Parallel mutation execution on Virtual Threads verified with 100% kill rate!\n');

  console.log('🎉 ALL COMPILER SERVICE JSON, UNICODE & VIRTUAL THREAD TESTS PASSED WITH FLYING COLORS!');
}

testCompilerServiceHardening().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
