import { CodingChallenge } from '../challengeSeedData';

export const L0_PRIMITIVES_PART1: CodingChallenge[] = [
  // 1. PRIM-01: Scalar Assertions & AAA Pattern
  {
    id: 'kata_prim_01_scalar_assertions',
    slug: 'kata-prim-01-scalar-assertions',
    title: 'PRIM-01: Scalar Assertions & AAA Pattern',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 15,
    shortDescription: 'Освойте паттерн Arrange-Act-Assert и точные оракулы состояния в AssertJ.',
    instructionsMarkdown: `### 🎯 Учебная цель
В первом упражнении лестницы вы освоите канонический паттерн **AAA (Arrange-Act-Assert)**:
- **Arrange**: Подготовка входных данных и создание экземпляра сервиса.
- **Act**: Вызов ровно одного тестируемого метода.
- **Assert**: Проверка полученного результата через AssertJ.

### 🧪 Ваша задача:
В \`DiscountCalculatorTest.java\` дополните тесты проверками для уничтожения 2 мутантов:
1. **Mutant 1 (MathMutator):** Замена вычитания скидки на сложение (наценка вместо скидки).
2. **Mutant 2 (ReturnValsMutator):** Замена возвращаемого значения на \`BigDecimal.ZERO\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/DiscountCalculator.java',
        content: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class DiscountCalculator {
    private static final BigDecimal DISCOUNT_RATE = new BigDecimal("0.10");

    public BigDecimal applyDiscount(BigDecimal originalPrice) {
        if (originalPrice == null || originalPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price must be non-negative");
        }
        BigDecimal discount = originalPrice.multiply(DISCOUNT_RATE);
        return originalPrice.subtract(discount).setScale(2, RoundingMode.HALF_UP);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/DiscountCalculatorTest.java',
        content: `package com.curriculum.primitives;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class DiscountCalculatorTest {

    private final DiscountCalculator calculator = new DiscountCalculator();

    @Test
    @DisplayName("Should correctly calculate 10 percent discount for standard price")
    public void shouldCalculateStandardDiscount() {
        // Arrange
        BigDecimal price = new BigDecimal("100.00");

        // Act
        BigDecimal result = calculator.applyDiscount(price);

        // Assert: 100.00 - 10.00 = 90.00
        assertThat(result)
            .isNotNull()
            .isEqualByComparingTo(new BigDecimal("90.00"));
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_01_math',
        name: 'MathMutator (+ instead of -)',
        description: 'Замена originalPrice.subtract(discount) на originalPrice.add(discount)',
        file: 'src/main/java/com/curriculum/primitives/DiscountCalculator.java',
        line: 14,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class DiscountCalculator {
    private static final BigDecimal DISCOUNT_RATE = new BigDecimal("0.10");

    public BigDecimal applyDiscount(BigDecimal originalPrice) {
        if (originalPrice == null || originalPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price must be non-negative");
        }
        BigDecimal discount = originalPrice.multiply(DISCOUNT_RATE);
        return originalPrice.add(discount).setScale(2, RoundingMode.HALF_UP);
    }
}`
      },
      {
        id: 'mutant_prim_01_return_zero',
        name: 'ReturnValsMutator (return ZERO)',
        description: 'Возврат BigDecimal.ZERO вместо вычисленной скидки',
        file: 'src/main/java/com/curriculum/primitives/DiscountCalculator.java',
        line: 14,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class DiscountCalculator {
    private static final BigDecimal DISCOUNT_RATE = new BigDecimal("0.10");

    public BigDecimal applyDiscount(BigDecimal originalPrice) {
        if (originalPrice == null || originalPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price must be non-negative");
        }
        BigDecimal discount = originalPrice.multiply(DISCOUNT_RATE);
        return BigDecimal.ZERO;
    }
}`
      }
    ]
  },

  // 2. PRIM-02: Exception Assertions & Root Cause
  {
    id: 'kata_prim_02_exception_handling',
    slug: 'kata-prim-02-exception-handling',
    title: 'PRIM-02: Exception Assertions & Root Cause',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 15,
    shortDescription: 'Узнайте, как строго верифицировать исключения и их сообщения с помощью assertThatThrownBy.',
    instructionsMarkdown: `### 🎯 Учебная цель
Тестирование ошибок — это не просто перехват исключения через \`try-catch\`.
Необходимо гарантировать:
1. Точный тип выбрасываемого исключения (например, \`IllegalArgumentException\`, а не общий \`RuntimeException\`).
2. Содержимое сообщения об ошибке (\`.hasMessage(...)\`).

### 🧪 Ваша задача:
Уничтожьте 2 мутантов в \`UserValidatorTest.java\`:
1. **Mutant 1 (EmptyExceptionMessage):** Выброс исключения с пустой строкой вместо понятного сообщения.
2. **Mutant 2 (WrongExceptionType):** Выброс \`IllegalStateException\` вместо \`IllegalArgumentException\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/UserValidator.java',
        content: `package com.curriculum.primitives;

public class UserValidator {
    public void validateUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("Username must not be empty");
        }
        if (username.length() < 3) {
            throw new IllegalArgumentException("Username is too short (min 3 chars)");
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/UserValidatorTest.java',
        content: `package com.curriculum.primitives;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class UserValidatorTest {

    private final UserValidator validator = new UserValidator();

    @Test
    @DisplayName("Should reject null or empty username with explicit message")
    public void shouldRejectEmptyUsername() {
        assertThatThrownBy(() -> validator.validateUsername("  "))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("Username must not be empty");
    }

    @Test
    @DisplayName("Should reject username shorter than 3 characters")
    public void shouldRejectTooShortUsername() {
        assertThatThrownBy(() -> validator.validateUsername("ab"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("Username is too short (min 3 chars)");
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_02_empty_msg',
        name: 'EmptyExceptionMessage',
        description: 'Выброс исключения с пустой строкой в сообщении',
        file: 'src/main/java/com/curriculum/primitives/UserValidator.java',
        line: 6,
        mutatedContent: `package com.curriculum.primitives;

public class UserValidator {
    public void validateUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("");
        }
        if (username.length() < 3) {
            throw new IllegalArgumentException("Username is too short (min 3 chars)");
        }
    }
}`
      },
      {
        id: 'mutant_prim_02_wrong_type',
        name: 'WrongExceptionType',
        description: 'Выброс IllegalStateException вместо IllegalArgumentException',
        file: 'src/main/java/com/curriculum/primitives/UserValidator.java',
        line: 9,
        mutatedContent: `package com.curriculum.primitives;

public class UserValidator {
    public void validateUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("Username must not be empty");
        }
        if (username.length() < 3) {
            throw new IllegalStateException("Username is too short (min 3 chars)");
        }
    }
}`
      }
    ]
  }
];
