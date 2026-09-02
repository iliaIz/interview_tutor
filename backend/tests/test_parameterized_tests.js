const { JvmExecutionService } = require('../dist/services/sandbox/JvmExecutionService');

async function testParameterizedTests() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING JUNIT 5 @ParameterizedTest WITH @ValueSource & @CsvSource');
  console.log('========================================================================\n');

  const files = [
    {
      path: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
      content: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public boolean isValid(BigDecimal amount, String currency) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return false;
        if (amount.compareTo(MAX_LIMIT) > 0) return false;
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) return false;
        return true;
    }
}`
    },
    {
      path: 'src/test/java/com/assessment/fintech/TransactionValidatorTest.java',
      content: `package com.assessment.fintech;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

public class TransactionValidatorTest {

    private final TransactionValidator validator = new TransactionValidator();

    @ParameterizedTest
    @ValueSource(strings = {"RUB", "USD", "EUR"})
    public void shouldAcceptValidCurrencies(String currency) {
        assertTrue(validator.isValid(new BigDecimal("100.00"), currency));
    }

    @ParameterizedTest
    @CsvSource({
        "100.00, RUB, true",
        "10000.00, USD, true",
        "0.00, EUR, false",
        "10000.01, RUB, false"
    })
    public void shouldValidateBoundaryAmounts(String amountStr, String currency, boolean expectedValid) {
        boolean actual = validator.isValid(new BigDecimal(amountStr), currency);
        assertEquals(expectedValid, actual);
    }
}`
    }
  ];

  const result = await JvmExecutionService.execute({
    challengeId: 'test_params_kata',
    files,
    activePhase: 1
  });

  console.log('Result Compilable:', result.isCompilable);
  console.log('Passed count:', result.passedCount);
  console.log('Failed count:', result.failedCount);
  console.log('Test Results:');
  result.testResults.forEach((t) => {
    console.log(`  - [${t.status}] ${t.testName} (${t.durationMs}ms)`);
  });

  if (!result.isCompilable || result.failedCount > 0 || result.passedCount < 7) {
    console.error('❌ Parameterized test verification failed!');
    process.exit(1);
  }

  console.log('\n🎉 ALL JUNIT 5 @ParameterizedTest INVOCATIONS PASSED WITH FLYING COLORS!');
  process.exit(0);
}

testParameterizedTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
