import { CodingChallenge } from '../challengeSeedData';

export const L0_PRIMITIVES_PART3: CodingChallenge[] = [
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
        id: 'mutant_prim_05_zero_amount',
        name: 'CorruptedPayloadMutator',
        description: 'Передача BigDecimal.ZERO вместо фактической суммы',
        file: 'src/main/java/com/curriculum/primitives/OrderDispatcher.java',
        line: 14,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;

public class OrderDispatcher {
    private final EventBus eventBus;

    public OrderDispatcher(EventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void dispatch(String orderId, BigDecimal amount) {
        String routingKey = "orders.finance";
        OrderEvent event = new OrderEvent(orderId, BigDecimal.ZERO, routingKey);
        eventBus.publish(event);
    }
}`
      },
      {
        id: 'mutant_prim_05_wrong_route',
        name: 'RoutingKeyMutator',
        description: 'Подмена routingKey на orders.default',
        file: 'src/main/java/com/curriculum/primitives/OrderDispatcher.java',
        line: 13,
        mutatedContent: `package com.curriculum.primitives;

import java.math.BigDecimal;

public class OrderDispatcher {
    private final EventBus eventBus;

    public OrderDispatcher(EventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void dispatch(String orderId, BigDecimal amount) {
        String routingKey = "orders.default";
        OrderEvent event = new OrderEvent(orderId, amount, routingKey);
        eventBus.publish(event);
    }
}`
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
        Clock clock = Clock.fixed(baseTime.plusSeconds(600), ZoneOffset.UTC);
        SessionTokenService service = new SessionTokenService(clock);

        assertThat(service.isTokenExpired(baseTime)).isFalse();
    }

    @Test
    @DisplayName("Token should be expired after 15 minutes TTL")
    public void shouldBeExpiredAfterTTL() {
        // TODO: Реализуйте проверки для метода shouldBeExpiredAfterTTL для уничтожения целевых мутантов
        assertThat(true).isTrue();
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
        line: 17,
        mutatedContent: `package com.curriculum.primitives;

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
        return clock.instant().isBefore(expiresAt);
    }
}`
      },
      {
        id: 'mutant_prim_06_short_ttl',
        name: 'DurationShiftMutator',
        description: 'Уменьшение TTL до 5 минут',
        file: 'src/main/java/com/curriculum/primitives/SessionTokenService.java',
        line: 8,
        mutatedContent: `package com.curriculum.primitives;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

public class SessionTokenService {
    public static final Duration TTL = Duration.ofMinutes(5);
    private final Clock clock;

    public SessionTokenService(Clock clock) {
        this.clock = clock;
    }

    public boolean isTokenExpired(Instant createdAt) {
        Instant expiresAt = createdAt.plus(TTL);
        // Просрочен, если текущее время строго позже expiresAt
        return clock.instant().isAfter(expiresAt);
    }
}`
      }
    ]
  }
];
