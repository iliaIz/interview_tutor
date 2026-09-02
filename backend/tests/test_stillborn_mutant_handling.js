const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testStillbornMutantHandling() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING STILLBORN MUTANT HONESTY IN MUTATION ENGINE');
  console.log('========================================================================\n');

  const files = [
    {
      path: 'src/main/java/com/CalcService.java',
      content: `package com;
public class CalcService {
    public int add(int a, int b) {
        return a + b;
    }
}`
    },
    {
      path: 'src/test/java/com/CalcServiceTest.java',
      content: `package com;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class CalcServiceTest {
    @Test
    public void testAdd() {
        CalcService c = new CalcService();
        assertEquals(5, c.add(2, 3));
    }
}`
    }
  ];

  const mutants = [
    // Mutant 1: Valid logical mutant (killed by test)
    {
      id: 'm1_subtraction',
      name: 'Replace addition with subtraction',
      file: 'src/main/java/com/CalcService.java',
      line: 4,
      mutatedContent: `package com;
public class CalcService {
    public int add(int a, int b) {
        return a - b;
    }
}`
    },
    // Mutant 2: Stillborn Mutant (Syntax Error: type mismatch)
    {
      id: 'm2_syntax_error',
      name: 'Syntax Broken Mutant',
      file: 'src/main/java/com/CalcService.java',
      line: 4,
      mutatedContent: `package com;
public class CalcService {
    public int add(int a, int b) {
        return "INVALID_TYPE_COMPILATION_ERROR";
    }
}`
    }
  ];

  const res = await JvmExecutionService.executeMutation({
    challengeId: 'test_mutation_stillborn',
    files,
    mutants,
    requiredScore: 80
  });

  console.log('  * Total Mutants:', res.totalMutants);
  console.log('  * Valid Mutants:', res.validMutants);
  console.log('  * Killed Count:', res.killedCount);
  console.log('  * Stillborn Count:', res.stillbornCount);
  console.log('  * Mutation Score:', res.mutationScore + '%');
  console.log('  * Mutant Results:');
  for (const m of res.mutantResults) {
    console.log(`     - [${m.status}] ${m.id}: ${m.name} (reason: ${m.failureReason || 'none'})`);
  }

  // Verification checks:
  // m1 should be KILLED
  const m1 = res.mutantResults.find(m => m.id === 'm1_subtraction');
  if (m1?.status !== 'KILLED') {
    throw new Error('m1 should be KILLED by testAdd!');
  }

  // m2 should be STILLBORN
  const m2 = res.mutantResults.find(m => m.id === 'm2_syntax_error');
  if (m2?.status !== 'STILLBORN') {
    throw new Error(`m2 should be STILLBORN, but was: ${m2?.status}`);
  }

  // Killed count should be 1 (NOT 2!)
  if (res.killedCount !== 1) {
    throw new Error(`Killed count should be exactly 1, but was: ${res.killedCount}`);
  }

  // Mutation score should be 100% (1 killed out of 1 valid mutant)
  if (res.mutationScore !== 100) {
    throw new Error(`Mutation score should be 100% of valid mutants, but was: ${res.mutationScore}`);
  }

  console.log('\n  ✅ Stillborn mutants are correctly isolated and do NOT falsely inflate killedCount!');
  console.log('🎉 MUTATION ENGINE HONESTY VERIFIED SUCCESSFULLY!');
}

testStillbornMutantHandling().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
