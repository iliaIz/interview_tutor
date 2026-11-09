import { CodingChallenge } from '../challengeSeedData';

export const L0_PRIMITIVES_PART2: CodingChallenge[] = [
  // 3. PRIM-03: Parameterized Boundaries (@CsvSource)
  {
    id: 'kata_prim_03_parameterized_boundaries',
    slug: 'kata-prim-03-parameterized-boundaries',
    title: 'PRIM-03: Parameterized Boundaries (@CsvSource)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ, @ParameterizedTest',
    timeLimitMinutes: 20,
    shortDescription: 'Тестирование граничных условий предикатов через @ParameterizedTest и @CsvSource.',
    instructionsMarkdown: `### 🎯 Учебная цель
Ошибка на единицу (**off-by-one**) — самый частый дефект в коде (замена \`>\` на \`>=\`).
Параметризованный тест с таблицей значений позволяет в одном методе проверить границу, шаг ниже и шаг выше.

### 🧪 Ваша задача:
Уничтожьте 2 мутантов в \`TieredFeeCalculatorTest.java\`:
1. **Mutant 1 (ConditionalsBoundary):** Замена \`amount.compareTo(TIER_THRESHOLD) > 0\` на \`>= 0\`.
2. **Mutant 2 (FeeRateMath):** Расчет повышенной комиссии 0.05 вместо 0.02.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/TieredFeeCalculator.java',
        content: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TieredFeeCalculator {
    public static final BigDecimal TIER_THRESHOLD = new BigDecimal("1000.00");
    private static final BigDecimal STANDARD_FEE = new BigDecimal("0.01");
    private static final BigDecimal PREMIUM_FEE = new BigDecimal("0.02");

    public BigDecimal calculateFee(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount must not be negative");
        }
        // Граница: строго больше 1000.00 -> 2%, иначе 1%
        if (amount.compareTo(TIER_THRESHOLD) > 0) {
            return amount.multiply(PREMIUM_FEE).setScale(2, RoundingMode.HALF_UP);
        }
        return amount.multiply(STANDARD_FEE).setScale(2, RoundingMode.HALF_UP);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/TieredFeeCalculatorTest.java',
        content: `package com.curriculum.primitives;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class TieredFeeCalculatorTest {

    private final TieredFeeCalculator calculator = new TieredFeeCalculator();

    @ParameterizedTest(name = "Amount {0} should have fee {1}")
    @CsvSource({
        "999.99,   10.00",  // 1% от 999.99 = 10.00 (округление)
        "1000.00,  10.00",  // Точная граница: 1000 * 0.01 = 10.00 (убивает > на >=)
        "1000.01,  20.00"   // Шаг выше границы: 1000.01 * 0.02 = 20.00
    })
    @DisplayName("Should enforce exact tier threshold boundaries")
    public void shouldEnforceExactTierThreshold(String inputAmount, String expectedFee) {
        BigDecimal actual = calculator.calculateFee(new BigDecimal(inputAmount));
        assertThat(actual).isEqualByComparingTo(new BigDecimal(expectedFee));
    
        // TODO: Добавьте проверки граничных условий для уничтожения мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_03_boundary',
        name: 'ConditionalsBoundaryMutator (> to >=)',
        description: 'Замена amount.compareTo(TIER_THRESHOLD) > 0 на >= 0',
        file: 'src/main/java/com/curriculum/primitives/TieredFeeCalculator.java',
        line: 14,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TieredFeeCalculator {
    public static final BigDecimal TIER_THRESHOLD = new BigDecimal("1000.00");
    private static final BigDecimal STANDARD_FEE = new BigDecimal("0.01");
    private static final BigDecimal PREMIUM_FEE = new BigDecimal("0.02");

    public BigDecimal calculateFee(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount must not be negative");
        }
        // Граница: строго больше 1000.00 -> 2%, иначе 1%
        if (amount.compareTo(TIER_THRESHOLD) >= 0) {
            return amount.multiply(PREMIUM_FEE).setScale(2, RoundingMode.HALF_UP);
        }
        return amount.multiply(STANDARD_FEE).setScale(2, RoundingMode.HALF_UP);
    }
}`
      },
      {
        id: 'mutant_prim_03_fee_rate',
        name: 'MathMutator (Fee Rate)',
        description: 'Использование PREMIUM_FEE = 0.05 вместо 0.02',
        file: 'src/main/java/com/curriculum/primitives/TieredFeeCalculator.java',
        line: 15,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TieredFeeCalculator {
    public static final BigDecimal TIER_THRESHOLD = new BigDecimal("1000.00");
    private static final BigDecimal STANDARD_FEE = new BigDecimal("0.01");
    private static final BigDecimal PREMIUM_FEE = new BigDecimal("0.02");

    public BigDecimal calculateFee(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount must not be negative");
        }
        // Граница: строго больше 1000.00 -> 2%, иначе 1%
        if (amount.compareTo(TIER_THRESHOLD) > 0) {
            return amount.multiply(new BigDecimal("0.05")).setScale(2, RoundingMode.HALF_UP);
        }
        return amount.multiply(STANDARD_FEE).setScale(2, RoundingMode.HALF_UP);
    }
}`
      }
    ]
  },

  // 4. PRIM-04: Mocking Void Commands (verify & times)
  {
    id: 'kata_prim_04_mock_void_command',
    slug: 'kata-prim-04-mock-void-command',
    title: 'PRIM-04: Mocking Void Commands (verify & times)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Верификация побочных эффектов методов без возвращаемого значения через Mockito.verify().',
    instructionsMarkdown: `### 🎯 Учебная цель
Методы командной логики (CQS) возвращают \`void\`, выполняя побочный эффект (сохранение в БД, отправка нотификации).
Их невозможно протестировать через \`assertEquals\`. Единственный надежный способ — **Mockito.verify()**.

### 🧪 Ваша задача:
Уничтожьте 2 мутантов в \`RegistrationServiceTest.java\`:
1. **Mutant 1 (VoidMethodCallMutator):** Удаление вызова \`notificationClient.sendWelcomeEmail(email)\`.
2. **Mutant 2 (UnwantedCall):** Отправка письма даже при ошибке валидации email.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/NotificationClient.java',
        content: `package com.curriculum.primitives;

public interface NotificationClient {
    void sendWelcomeEmail(String email);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/primitives/RegistrationService.java',
        content: `package com.curriculum.primitives;

public class RegistrationService {
    private final NotificationClient notificationClient;

    public RegistrationService(NotificationClient notificationClient) {
        this.notificationClient = notificationClient;
    }

    public void registerUser(String email) {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
        // Побочный эффект: отправка письма
        notificationClient.sendWelcomeEmail(email);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/RegistrationServiceTest.java',
        content: `package com.curriculum.primitives;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
public class RegistrationServiceTest {

    @Mock
    private NotificationClient notificationClient;

    private RegistrationService registrationService;

    @BeforeEach
    public void setUp() {
        registrationService = new RegistrationService(notificationClient);
    }

    @Test
    @DisplayName("Should send welcome email on valid registration")
    public void shouldSendWelcomeEmail() {
        registrationService.registerUser("user@example.com");

        // Верификация вызова void-метода
        verify(notificationClient, times(1)).sendWelcomeEmail("user@example.com");
    }

    @Test
    @DisplayName("Should NOT send welcome email when email is invalid")
    public void shouldNotSendEmailOnInvalidInput() {
        // TODO: Реализуйте проверки для метода shouldNotSendEmailOnInvalidInput для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_04_skip_notification',
        name: 'VoidMethodCallMutator',
        description: 'Удаление вызова sendWelcomeEmail',
        file: 'src/main/java/com/curriculum/primitives/RegistrationService.java',
        line: 15,
        mutatedContent: `package com.curriculum.primitives;

public class RegistrationService {
    private final NotificationClient notificationClient;

    public RegistrationService(NotificationClient notificationClient) {
        this.notificationClient = notificationClient;
    }

    public void registerUser(String email) {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
        // notificationClient.sendWelcomeEmail(email) удален
    }
}`
      },
      {
        id: 'mutant_prim_04_send_always',
        name: 'UnconditionalNotificationMutator',
        description: 'Отправка нотификации до валидации',
        file: 'src/main/java/com/curriculum/primitives/RegistrationService.java',
        line: 12,
        mutatedContent: `package com.curriculum.primitives;

public class RegistrationService {
    private final NotificationClient notificationClient;

    public RegistrationService(NotificationClient notificationClient) {
        this.notificationClient = notificationClient;
    }

    public void registerUser(String email) {
        notificationClient.sendWelcomeEmail(email);
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
    }
}`
      }
    ]
  }
];
