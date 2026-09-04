const { TreeEditDistanceGuard } = require('../dist/services/sandbox/TreeEditDistanceGuard');
const { buildPracticeTutorSystemPrompt, TESTING_COMPASS_RULES } = require('../dist/prompts/practiceTutorPrompts');

function testTreeEditDistanceGuard() {
  console.log('🧪 Testing TreeEditDistanceGuard...');

  const targetSolution = `
  @Test
  public void shouldCalculateTieredFee() {
      TieredFeeCalculator calculator = new TieredFeeCalculator();
      BigDecimal fee = calculator.calculateFee(new BigDecimal("1500.00"));
      assertThat(fee).isEqualByComparingTo(new BigDecimal("30.00"));
  }
  `;

  // 1. Verbatim Leaked Code
  const leakedResponse = `
  Вот готовое решение для вашего теста:
  \`\`\`java
  @Test
  public void shouldCalculateTieredFee() {
      TieredFeeCalculator calc = new TieredFeeCalculator();
      BigDecimal result = calc.calculateFee(new BigDecimal("1500.00"));
      assertThat(result).isEqualByComparingTo(new BigDecimal("30.00"));
  }
  \`\`\`
  Попробуйте вставить этот код.
  `;

  const leakResult = TreeEditDistanceGuard.guardResponse(leakedResponse, [targetSolution], {
    leakThreshold: 0.40,
    isSocraticEnforced: true
  });

  console.log('  - Leaked Code Detected:', leakResult.leakDetected ? '✅ YES' : '❌ NO');
  console.log('  - Max Similarity:', (leakResult.maxSimilarity * 100).toFixed(1) + '%');
  console.log('  - Redacted Text Has Socratic Guard:', leakResult.redactedText.includes('[Socratic Guard]') ? '✅ YES' : '❌ NO');

  if (!leakResult.leakDetected) {
    throw new Error('TreeEditDistanceGuard failed to detect direct code leak!');
  }

  // 2. Socratic / Pedagogical Nudge (Safe)
  const safeResponse = `
  Обратите внимание на значение 1000.00. Что происходит, когда сумма в точности равна пороговой?
  Проверьте метод \`calculateFee\` при граничном значении.
  `;

  const safeResult = TreeEditDistanceGuard.guardResponse(safeResponse, [targetSolution], {
    leakThreshold: 0.40,
    isSocraticEnforced: true
  });

  console.log('  - Safe Nudge Passed Without False Positive:', !safeResult.leakDetected ? '✅ YES' : '❌ NO');
  if (safeResult.leakDetected) {
    throw new Error('TreeEditDistanceGuard gave a false positive on safe conceptual explanation!');
  }
}

function testPracticeTutorPrompts() {
  console.log('\n🧪 Testing PracticeTutorPrompts & Testing Compass...');

  const rulesKeys = Object.keys(TESTING_COMPASS_RULES);
  console.log(`  - Testing Compass Rules Count: ${rulesKeys.length} (Expected: 5)`);
  if (rulesKeys.length !== 5) {
    throw new Error(`Expected 5 Testing Compass rules, got ${rulesKeys.length}`);
  }

  const personas = ['junior_explainer', 'middle_scaffold', 'senior_socratic', 'faang_interviewer'];
  for (const persona of personas) {
    const prompt = buildPracticeTutorSystemPrompt({
      persona,
      assistanceLevel: 2,
      kataTitle: 'PRIM-01: Scalar Assertions',
      kataCategory: 'testing_mutation',
      kataInstructions: 'Write scalar assertions',
      activeFilePath: 'src/test/java/CalculatorTest.java',
      activeFileContent: 'public class CalculatorTest {}',
      activeCompassRuleId: 'AAA_PATTERN',
      hintTier: 2
    });

    if (!prompt.includes('PRIM-01: Scalar Assertions') || !prompt.includes('AAA (Arrange — Act — Assert)')) {
      throw new Error(`Prompt missing context for persona: ${persona}`);
    }
  }
  console.log('  - All 4 Personas, RIPR Hints, and Compass Grounding prompts generated cleanly: ✅ YES');
}

try {
  testTreeEditDistanceGuard();
  testPracticeTutorPrompts();
  console.log('\n✅ ALL PRACTICE TUTOR ENGINE & SENSORY TESTS PASSED CLEANLY!\n');
} catch (e) {
  console.error('❌ Test failed:', e);
  process.exit(1);
}
