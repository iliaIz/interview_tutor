import { CodingChallenge } from '../challengeSeedData';

// ============================================================================
// L0: FUNDAMENTALS & PRIMITIVES (Worked Examples & Micro-Completions)
// ============================================================================

export const L0_PRIMITIVES_CHALLENGES: CodingChallenge[] = [
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
        line: 13,
        mutatedContent: `        return originalPrice.add(discount).setScale(2, RoundingMode.HALF_UP);`
      },
      {
        id: 'mutant_prim_01_return_zero',
        name: 'ReturnValsMutator (return ZERO)',
        description: 'Возврат BigDecimal.ZERO вместо вычисленной скидки',
        file: 'src/main/java/com/curriculum/primitives/DiscountCalculator.java',
        line: 13,
        mutatedContent: `        return BigDecimal.ZERO;`
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
        mutatedContent: `            throw new IllegalArgumentException("");`
      },
      {
        id: 'mutant_prim_02_wrong_type',
        name: 'WrongExceptionType',
        description: 'Выброс IllegalStateException вместо IllegalArgumentException',
        file: 'src/main/java/com/curriculum/primitives/UserValidator.java',
        line: 9,
        mutatedContent: `            throw new IllegalStateException("Username is too short (min 3 chars)");`
      }
    ]
  },

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
        line: 15,
        mutatedContent: `        if (amount.compareTo(TIER_THRESHOLD) >= 0) {`
      },
      {
        id: 'mutant_prim_03_fee_rate',
        name: 'MathMutator (Fee Rate)',
        description: 'Использование PREMIUM_FEE = 0.05 вместо 0.02',
        file: 'src/main/java/com/curriculum/primitives/TieredFeeCalculator.java',
        line: 16,
        mutatedContent: `            return amount.multiply(new BigDecimal("0.05")).setScale(2, RoundingMode.HALF_UP);`
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
2. **Mutant 2 (UnwantedCall):** Отправка письма даже при ошибке сохранения в репозиторий.`,
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
        assertThatThrownBy(() -> registrationService.registerUser("invalid-email"))
            .isInstanceOf(IllegalArgumentException.class);

        // Доказательство отсутствия побочного эффекта
        verify(notificationClient, never()).sendWelcomeEmail(anyString());
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
        line: 16,
        mutatedContent: `        // notificationClient.sendWelcomeEmail(email);`
      },
      {
        id: 'mutant_prim_04_send_always',
        name: 'UnconditionalNotificationMutator',
        description: 'Отправка нотификации до валидации',
        file: 'src/main/java/com/curriculum/primitives/RegistrationService.java',
        line: 13,
        mutatedContent: `        notificationClient.sendWelcomeEmail(email);
        if (email == null || !email.contains("@")) {`
      }
    ]
  },

  // 5. PRIM-05: ArgumentCaptor & Payload Inspection
  {
    id: 'kata_prim_05_argument_captor',
    slug: 'kata-prim-05-argument-captor',
    title: 'PRIM-05: ArgumentCaptor & Payload Inspection',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Захват и инспекция сложных объектов-аргументов через Mockito ArgumentCaptor.',
    instructionsMarkdown: `### 🎯 Учебная цель
Иногда мок вызывается с объектом (DTO / Record), который создается динамически внутри сервиса.
Чтобы проверить правильность заполнения его полей, используют **ArgumentCaptor**.

### 🧪 Ваша задача:
Уничтожьте 2 мутантов в \`OrderDispatcherTest.java\`:
1. **Mutant 1 (CorruptedPayload):** Передача суммы 0.0 вместо реальной суммы заказа в Event.
2. **Mutant 2 (WrongRoutingKey):** Подмена ключа маршрутизации события.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/OrderEvent.java',
        content: `package com.curriculum.primitives;

import java.math.BigDecimal;

public record OrderEvent(String orderId, BigDecimal amount, String routingKey) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/primitives/EventBus.java',
        content: `package com.curriculum.primitives;

public interface EventBus {
    void publish(OrderEvent event);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/primitives/OrderDispatcher.java',
        content: `package com.curriculum.primitives;

import java.math.BigDecimal;

public class OrderDispatcher {
    private final EventBus eventBus;

    public OrderDispatcher(EventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void dispatch(String orderId, BigDecimal amount) {
        String routingKey = "orders.finance";
        OrderEvent event = new OrderEvent(orderId, amount, routingKey);
        eventBus.publish(event);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/OrderDispatcherTest.java',
        content: `package com.curriculum.primitives;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class OrderDispatcherTest {

    @Mock
    private EventBus eventBus;

    private OrderDispatcher dispatcher;

    @Captor
    private ArgumentCaptor<OrderEvent> eventCaptor;

    @BeforeEach
    public void setUp() {
        dispatcher = new OrderDispatcher(eventBus);
    }

    @Test
    @DisplayName("Should publish correctly populated OrderEvent")
    public void shouldPublishCorrectEvent() {
        dispatcher.dispatch("ORD-123", new BigDecimal("450.00"));

        verify(eventBus).publish(eventCaptor.capture());
        OrderEvent captured = eventCaptor.getValue();

        assertThat(captured.orderId()).isEqualTo("ORD-123");
        assertThat(captured.amount()).isEqualByComparingTo(new BigDecimal("450.00"));
        assertThat(captured.routingKey()).isEqualTo("orders.finance");
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_05_zero_amount',
        name: 'CorruptedPayloadMutator',
        description: 'Передача BigDecimal.ZERO вместо фактической суммы',
        file: 'src/main/java/com/curriculum/primitives/OrderDispatcher.java',
        line: 14,
        mutatedContent: `        OrderEvent event = new OrderEvent(orderId, BigDecimal.ZERO, routingKey);`
      },
      {
        id: 'mutant_prim_05_wrong_route',
        name: 'RoutingKeyMutator',
        description: 'Подмена routingKey на orders.default',
        file: 'src/main/java/com/curriculum/primitives/OrderDispatcher.java',
        line: 13,
        mutatedContent: `        String routingKey = "orders.default";`
      }
    ]
  },

  // 6. PRIM-06: Time Virtualization with Clock
  {
    id: 'kata_prim_06_time_virtualization',
    slug: 'kata-prim-06-time-virtualization',
    title: 'PRIM-06: Time Virtualization with java.time.Clock',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟢 L0: Primitives',
    difficulty: 'Junior',
    targetStack: 'Java 21 LTS, java.time.Clock, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Инъекция Clock вместо System.currentTimeMillis() для детерминированных тестов за 0 мс.',
    instructionsMarkdown: `### 🎯 Учебная цель
**Хард-инвариант платформы:** Никогда не используйте \`Instant.now()\` или \`Thread.sleep()\`!
Инъекция \`java.time.Clock\` позволяет мгновенно перемещать время в тестах вперед или назад через \`Clock.fixed(...)\`.

### 🧪 Ваша задача:
Уничтожьте 2 мутантов в \`SessionTokenServiceTest.java\`:
1. **Mutant 1 (ConditionalsBoundary):** Токен считается просроченным в момент экспирации (замена \`isAfter\` на \`isBefore\`).
2. **Mutant 2 (DurationShift):** Использование времени жизни 5 минут вместо 15.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/primitives/SessionTokenService.java',
        content: `package com.curriculum.primitives;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

public class SessionTokenService {
    public static final Duration TTL = Duration.ofMinutes(15);
    private final Clock clock;

    public SessionTokenService(Clock clock) {
        this.clock = clock;
    }

    public boolean isTokenExpired(Instant createdAt) {
        Instant expiresAt = createdAt.plus(TTL);
        // Просрочен, если текущее время строго позже expiresAt
        return clock.instant().isAfter(expiresAt);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/primitives/SessionTokenServiceTest.java',
        content: `package com.curriculum.primitives;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import static org.assertj.core.api.Assertions.assertThat;

public class SessionTokenServiceTest {

    private final Instant baseTime = Instant.parse("2026-09-01T12:00:00Z");

    @Test
    @DisplayName("Token should be valid within 15 minutes TTL")
    public void shouldBeValidWithinTTL() {
        // Системные часы зафиксированы на 12:10:00 (10 минут после создания)
        Clock clock = Clock.fixed(baseTime.plusSeconds(600), ZoneOffset.UTC);
        SessionTokenService service = new SessionTokenService(clock);

        assertThat(service.isTokenExpired(baseTime)).isFalse();
    }

    @Test
    @DisplayName("Token should be expired after 15 minutes TTL")
    public void shouldBeExpiredAfterTTL() {
        // Системные часы зафиксированы на 12:16:00 (16 минут после создания)
        Clock clock = Clock.fixed(baseTime.plusSeconds(960), ZoneOffset.UTC);
        SessionTokenService service = new SessionTokenService(clock);

        assertThat(service.isTokenExpired(baseTime)).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_prim_06_inverted_time',
        name: 'InvertedTimeComparisonMutator',
        description: 'Замена isAfter на isBefore в проверке экспирации',
        file: 'src/main/java/com/curriculum/primitives/SessionTokenService.java',
        line: 18,
        mutatedContent: `        return clock.instant().isBefore(expiresAt);`
      },
      {
        id: 'mutant_prim_06_short_ttl',
        name: 'DurationShiftMutator',
        description: 'Уменьшение TTL до 5 минут',
        file: 'src/main/java/com/curriculum/primitives/SessionTokenService.java',
        line: 8,
        mutatedContent: `    public static final Duration TTL = Duration.ofMinutes(5);`
      }
    ]
  }
];

// ============================================================================
// L1: REVERSE TESTING & MUTANT SPOTTING (Code Defenders & Bug Finding)
// ============================================================================

export const L1_REVERSE_TESTING_CHALLENGES: CodingChallenge[] = [
  // 1. REV-01: Spot the Fake Assertion (Line Hitter Smell)
  {
    id: 'kata_rev_01_fake_assertion',
    slug: 'kata-rev-01-fake-assertion',
    title: 'REV-01: Spot the Fake Assertion (Line Hitter)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, AssertJ, PITest Gregor',
    timeLimitMinutes: 20,
    shortDescription: 'Тест дает 100% Line Coverage, но пропускает фатальный дефект. Добавьте убивающее утверждение.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация (Code Defenders)
Перед вами тест, написанный недобросовестным разработчиком:
- Он дает **100% Line Coverage** в JaCoCo.
- Однако он содержит псевдо-оракул: \`assertNotNull(user)\` вместо проверки полей.
- В результате **Mutant 1** выживает!

### 🧪 Ваша цель:
Изучите выжившего мутанта и добавьте точное утверждение на поле \`status\`, чтобы уничтожить его.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/UserAccount.java',
        content: `package com.curriculum.reverse;

public record UserAccount(String id, String email, String status) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/AccountActivationService.java',
        content: `package com.curriculum.reverse;

public class AccountActivationService {
    public UserAccount activate(String id, String email) {
        // Корректная логика: статус обязан быть ACTIVE
        return new UserAccount(id, email, "ACTIVE");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/AccountActivationTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.assertj.core.api.Assertions.assertThat;

public class AccountActivationTest {

    private final AccountActivationService service = new AccountActivationService();

    @Test
    @DisplayName("Should activate user account")
    public void shouldActivateAccount() {
        UserAccount account = service.activate("USR-1", "test@domain.com");

        // Слабый оракул (Line Hitter): покрывает строку, но не проверяет статус!
        assertThat(account).isNotNull();
        // Убивающее утверждение
        assertThat(account.status()).isEqualTo("ACTIVE");
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_01_corrupt_status',
        name: 'ReturnValsMutator (Corrupted status)',
        description: 'Возврат статуса PENDING вместо ACTIVE',
        file: 'src/main/java/com/curriculum/reverse/AccountActivationService.java',
        line: 6,
        mutatedContent: `        return new UserAccount(id, email, "PENDING");`
      }
    ]
  },

  // 2. REV-02: Survived Conditionals Boundary (< vs <=)
  {
    id: 'kata_rev_02_survived_boundary',
    slug: 'kata-rev-02-survived-boundary',
    title: 'REV-02: Survived Conditionals Boundary (< vs <=)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Найдите пропущенную граничную точку в существующем сьюте и уничтожьте мутанта.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Существующий тест проверяет балансы $50$ и $500$, но пропускает точную границу кредитного лимита $0.00$.
Мутатор заменил \`balance.compareTo(BigDecimal.ZERO) < 0\` на \`<= 0\`.
Счет с балансом ровно $0.00$ стал считаться заблокированным!

### 🧪 Ваша цель:
Добавьте тест на нулевой баланс, чтобы убить **ConditionalsBoundaryMutator**.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/CreditService.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;

public class CreditService {
    public boolean canWithdraw(BigDecimal currentBalance, BigDecimal amount) {
        BigDecimal remaining = currentBalance.subtract(amount);
        // Разрешено, если остаток строго >= 0.00 (т.е. remaining < 0 запрещено)
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        return true;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/CreditServiceTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class CreditServiceTest {

    private final CreditService creditService = new CreditService();

    @Test
    @DisplayName("Should allow withdrawal when funds are sufficient")
    public void shouldAllowWithdrawal() {
        boolean allowed = creditService.canWithdraw(new BigDecimal("100.00"), new BigDecimal("50.00"));
        assertThat(allowed).isTrue();
    }

    @Test
    @DisplayName("Should allow withdrawal to exact zero balance")
    public void shouldAllowExactZeroBalance() {
        // Убивает мутацию < на <= при нулевом остатке
        boolean allowed = creditService.canWithdraw(new BigDecimal("100.00"), new BigDecimal("100.00"));
        assertThat(allowed).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_02_boundary',
        name: 'ConditionalsBoundaryMutator (< to <=)',
        description: 'Замена remaining.compareTo(ZERO) < 0 на <= 0',
        file: 'src/main/java/com/curriculum/reverse/CreditService.java',
        line: 9,
        mutatedContent: `        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {`
      }
    ]
  },

  // 3. REV-03: The Over-Mocked Ghost Test
  {
    id: 'kata_rev_03_over_mocking_trap',
    slug: 'kata-rev-03-over-mocking-trap',
    title: 'REV-03: The Over-Mocked Ghost Test',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 25,
    shortDescription: 'Устраните хрупкость теста: замените избыточное мокирование внутренних вызовов проверкой результата.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Тест мокает чистый внутренний хелпер \`TaxCalculator\`. 
При смене алгоритма округления тест ломается, хотя публичный контракт не нарушен!
Перепишите тест, используя реальный экземпляр хелпера, проверяя конечное состояние.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/TaxHelper.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TaxHelper {
    public BigDecimal calculateVat(BigDecimal amount) {
        return amount.multiply(new BigDecimal("0.20")).setScale(2, RoundingMode.HALF_UP);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/InvoiceService.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;

public class InvoiceService {
    private final TaxHelper taxHelper;

    public InvoiceService(TaxHelper taxHelper) {
        this.taxHelper = taxHelper;
    }

    public BigDecimal calculateTotal(BigDecimal netAmount) {
        BigDecimal vat = taxHelper.calculateVat(netAmount);
        return netAmount.add(vat);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/InvoiceServiceTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class InvoiceServiceTest {

    // Тестируем с реальным хелпером (State Testing вместо Over-Mocking)
    private final TaxHelper realTaxHelper = new TaxHelper();
    private final InvoiceService invoiceService = new InvoiceService(realTaxHelper);

    @Test
    @DisplayName("Should correctly calculate total with 20 percent VAT")
    public void shouldCalculateTotalWithVat() {
        BigDecimal total = invoiceService.calculateTotal(new BigDecimal("100.00"));

        // 100.00 + 20.00 = 120.00
        assertThat(total).isEqualByComparingTo(new BigDecimal("120.00"));
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_03_vat_rate',
        name: 'TaxRateMutator (0.10 instead of 0.20)',
        description: 'Подмена ставки НДС в TaxHelper',
        file: 'src/main/java/com/curriculum/reverse/TaxHelper.java',
        line: 8,
        mutatedContent: `        return amount.multiply(new BigDecimal("0.10")).setScale(2, RoundingMode.HALF_UP);`
      }
    ]
  },

  // 4. REV-04: Flaky Sleep vs Awaitility Polling
  {
    id: 'kata_rev_04_flaky_sleep_race',
    slug: 'kata-rev-04-flaky-sleep-race',
    title: 'REV-04: Flaky Sleep vs Awaitility Polling',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Awaitility, Concurrency',
    timeLimitMinutes: 25,
    shortDescription: 'Замените хрупкий недетерминированный Thread.sleep() на быстрый поллинг Awaitility.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Асинхронный воркер обновляет флаг \`processed\` через случайную задержку.
Тест с \`Thread.sleep(50)\` падает в CI при нагрузке на процессор.
Используйте \`org.awaitility.Awaitility\` для стабильного ожидания.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/AsyncWorker.java',
        content: `package com.curriculum.reverse;

import java.util.concurrent.atomic.AtomicBoolean;

public class AsyncWorker {
    private final AtomicBoolean ready = new AtomicBoolean(false);

    public void triggerWork() {
        Thread.ofVirtual().start(() -> {
            try {
                Thread.sleep(10);
            } catch (InterruptedException ignored) {}
            ready.set(true);
        });
    }

    public boolean isReady() {
        return ready.get();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/AsyncWorkerTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.awaitility.Awaitility;
import java.time.Duration;
import static org.assertj.core.api.Assertions.assertThat;

public class AsyncWorkerTest {

    @Test
    @DisplayName("Should reliably wait for async worker without Thread.sleep")
    public void shouldWaitForWorker() {
        AsyncWorker worker = new AsyncWorker();
        worker.triggerWork();

        // Стабильный поллинг Awaitility
        Awaitility.await()
            .atMost(Duration.ofSeconds(1))
            .pollInterval(Duration.ofMillis(5))
            .untilAsserted(() -> assertThat(worker.isReady()).isTrue());
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_04_skip_set',
        name: 'VoidMethodCallMutator (Skip ready.set)',
        description: 'Удаление ready.set(true) в асинхронном потоке',
        file: 'src/main/java/com/curriculum/reverse/AsyncWorker.java',
        line: 13,
        mutatedContent: `            // ready.set(true);`
      }
    ]
  },

  // 5. REV-05: The Void Method Bypass (Unchecked Side-Effect)
  {
    id: 'kata_rev_05_void_bypass_audit',
    slug: 'kata-rev-05-void-bypass-audit',
    title: 'REV-05: The Void Method Bypass (Audit Log)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Защитите безопасность: добавьте верификацию записи аудита при блокировке счета.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Мутант удалил вызов \`auditService.logSecurityEvent(...)\`.
Существующий тест проверял только статус счета, поэтому мутант выжил незамеченным.
Добавьте проверку аудита через \`verify()\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/AuditService.java',
        content: `package com.curriculum.reverse;

public interface AuditService {
    void logSecurityEvent(String accountId, String event);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/SecurityManager.java',
        content: `package com.curriculum.reverse;

public class SecurityManager {
    private final AuditService auditService;

    public SecurityManager(AuditService auditService) {
        this.auditService = auditService;
    }

    public void lockAccount(String accountId, String reason) {
        auditService.logSecurityEvent(accountId, "ACCOUNT_LOCKED: " + reason);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/SecurityManagerTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class SecurityManagerTest {

    @Mock
    private AuditService auditService;

    private SecurityManager securityManager;

    @BeforeEach
    public void setUp() {
        securityManager = new SecurityManager(auditService);
    }

    @Test
    @DisplayName("Should write audit security event on account lock")
    public void shouldLogSecurityEvent() {
        securityManager.lockAccount("ACC-99", "SUSPICIOUS_LOGIN");

        verify(auditService).logSecurityEvent("ACC-99", "ACCOUNT_LOCKED: SUSPICIOUS_LOGIN");
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_05_skip_audit',
        name: 'VoidMethodCallMutator',
        description: 'Удаление записи в аудит-лог',
        file: 'src/main/java/com/curriculum/reverse/SecurityManager.java',
        line: 11,
        mutatedContent: `        // auditService.logSecurityEvent(...)`
      }
    ]
  },

  // 6. REV-06: ArchUnit Package Slices Guard
  {
    id: 'kata_rev_06_archunit_cyclic_hole',
    slug: 'kata-rev-06-archunit-cyclic-hole',
    title: 'REV-06: ArchUnit Package Slices Guard',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, ArchUnit 1.3, SlicesRuleDefinition',
    timeLimitMinutes: 25,
    shortDescription: 'Защитите модульную архитектуру: настройте правило запрета циклических зависимостей.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Архитектурное правило должно запрещать циклические зависимости между доменными модулями.
Настройте \`SlicesRuleDefinition.slices().matching("com.curriculum.modular.(*)..").should().beFreeOfCycles()\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/modular/billing/BillingService.java',
        content: `package com.curriculum.modular.billing;

public class BillingService {
    public void processInvoice() {}
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/modular/shipping/ShippingService.java',
        content: `package com.curriculum.modular.shipping;

public class ShippingService {
    public void scheduleDelivery() {}
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/modular/ArchitectureRulesTest.java',
        content: `package com.curriculum.modular;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

public class ArchitectureRulesTest {

    private final JavaClasses classes = new ClassFileImporter().importPackages("com.curriculum.modular");

    @Test
    @DisplayName("Domain packages should be completely free of cyclic dependencies")
    public void slicesShouldBeFreeOfCycles() {
        SlicesRuleDefinition.slices()
            .matching("com.curriculum.modular.(*)..")
            .should()
            .beFreeOfCycles()
            .check(classes);
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_06_cyclic_import',
        name: 'CyclicDependencyMutator',
        description: 'Внедрение циклической зависимости billing -> shipping',
        file: 'src/main/java/com/curriculum/modular/billing/BillingService.java',
        line: 4,
        mutatedContent: `    private com.curriculum.modular.shipping.ShippingService shippingService;
    public void processInvoice() { if (shippingService != null) shippingService.scheduleDelivery(); }`
      }
    ]
  }
];
