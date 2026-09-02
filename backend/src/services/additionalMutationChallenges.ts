import { CodingChallenge } from './challengeSeedData';

export const ADDITIONAL_MUTATION_CHALLENGES: CodingChallenge[] = [
  // 6. Gilded Rose Approval Testing
  {
    id: 'kata_test_gilded_rose_approval',
    slug: 'kata-test-gilded-rose-approval',
    title: 'KATA-TEST-02: Gilded Rose Approval Testing (Golden Master)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Approval Golden Master',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5',
    timeLimitMinutes: 45,
    shortDescription: 'Построение Golden Master снимка состояний для легаси инвентаря Gilded Rose.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Канонический легаси-класс **GildedRose** (Emily Bache) обновляет качество товаров в конце каждого дня:
- Обычные товары теряют по 1 единице качества в день, а после истечения срока (\`sellIn < 0\`) — в два раза быстрее.
- \`Aged Brie\` увеличивает качество со временем.
- Качество товара никогда не может превышать 50 или падать ниже 0.
- Легендарный предмет \`Sulfuras\` никогда не теряет качество (фиксировано 80) и не имеет срока годности.
- \`Backstage passes\` увеличивают качество на 2 за 10 дней, на 3 за 5 дней, и падают до 0 сразу после концерта (\`sellIn < 0\`).

### 🧪 Ваша цель
Напишите параметризованный тест-сьют в \`GildedRoseTest.java\`, уничтожающий всех 4 мутантов:
1. **Mutant 1 (QualityOver50):** Превышение лимита качества > 50 для Aged Brie.
2. **Mutant 2 (SulfurasQualityDegrade):** Деградация качества Sulfuras.
3. **Mutant 3 (BackstagePassZeroOmission):** Билеты не сгорают в 0 после концерта.
4. **Mutant 4 (NegativeQualityAllowed):** Качество падает ниже 0.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/gildedrose/Item.java',
        content: `package com.assessment.gildedrose;

public class Item {
    public String name;
    public int sellIn;
    public int quality;

    public Item(String name, int sellIn, int quality) {
        this.name = name;
        this.sellIn = sellIn;
        this.quality = quality;
    }

    @Override
    public String toString() {
        return this.name + ", " + this.sellIn + ", " + this.quality;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/gildedrose/GildedRose.java',
        content: `package com.assessment.gildedrose;

public class GildedRose {
    public Item[] items;

    public GildedRose(Item[] items) {
        this.items = items;
    }

    public void updateQuality() {
        for (Item item : items) {
            if (!item.name.equals("Aged Brie")
                    && !item.name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                if (item.quality > 0) {
                    if (!item.name.equals("Sulfuras, Hand of Ragnaros")) {
                        item.quality = item.quality - 1;
                    }
                }
            } else {
                if (item.quality < 50) {
                    item.quality = item.quality + 1;
                    if (item.name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                        if (item.sellIn < 11 && item.quality < 50) item.quality = item.quality + 1;
                        if (item.sellIn < 6 && item.quality < 50) item.quality = item.quality + 1;
                    }
                }
            }

            if (!item.name.equals("Sulfuras, Hand of Ragnaros")) {
                item.sellIn = item.sellIn - 1;
            }

            if (item.sellIn < 0) {
                if (!item.name.equals("Aged Brie")) {
                    if (!item.name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                        if (item.quality > 0 && !item.name.equals("Sulfuras, Hand of Ragnaros")) {
                            item.quality = item.quality - 1;
                        }
                    } else {
                        item.quality = 0;
                    }
                } else {
                    if (item.quality < 50) {
                        item.quality = item.quality + 1;
                    }
                }
            }
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/gildedrose/GildedRoseTest.java',
        content: `package com.assessment.gildedrose;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

public class GildedRoseTest {

    @Test
    @DisplayName("Normal item should degrade quality and sellIn by 1")
    public void testNormalItem() {
        Item[] items = new Item[] { new Item("Standard Item", 10, 20) };
        GildedRose app = new GildedRose(items);
        app.updateQuality();

        assertEquals(9, items[0].sellIn);
        assertEquals(19, items[0].quality);
    }

    // TODO: Write comprehensive approval tests to kill all 4 mutants!
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_gr_01_quality_over_50',
        name: 'QualityOver50Mutator',
        file: 'src/main/java/com/assessment/gildedrose/GildedRose.java',
        line: 20,
        mutatedContent: `package com.assessment.gildedrose;

public class GildedRose {
    public Item[] items;
    public GildedRose(Item[] items) { this.items = items; }
    public void updateQuality() {
        for (Item item : items) {
            if (item.name.equals("Aged Brie")) {
                item.quality += 1; // MUTANT: No limit at 50, quality can grow to 100!
                item.sellIn -= 1;
            } else {
                item.quality = Math.max(0, item.quality - 1);
                item.sellIn -= 1;
            }
        }
    }
}`
      },
      {
        id: 'mutant_gr_02_sulfuras_degrade',
        name: 'SulfurasDegradeMutator',
        file: 'src/main/java/com/assessment/gildedrose/GildedRose.java',
        line: 15,
        mutatedContent: `package com.assessment.gildedrose;

public class GildedRose {
    public Item[] items;
    public GildedRose(Item[] items) { this.items = items; }
    public void updateQuality() {
        for (Item item : items) {
            item.quality -= 1; // MUTANT: Sulfuras degraded by 1!
            item.sellIn -= 1;
        }
    }
}`
      },
      {
        id: 'mutant_gr_03_backstage_zero_omission',
        name: 'BackstageZeroOmissionMutator',
        file: 'src/main/java/com/assessment/gildedrose/GildedRose.java',
        line: 42,
        mutatedContent: `package com.assessment.gildedrose;

public class GildedRose {
    public Item[] items;
    public GildedRose(Item[] items) { this.items = items; }
    public void updateQuality() {
        for (Item item : items) {
            if (item.name.contains("Backstage")) {
                item.sellIn -= 1;
                // MUTANT: Quality kept instead of dropping to 0 when sellIn < 0!
            } else {
                item.sellIn -= 1;
                item.quality = Math.max(0, item.quality - 1);
            }
        }
    }
}`
      },
      {
        id: 'mutant_gr_04_negative_quality',
        name: 'NegativeQualityAllowedMutator',
        file: 'src/main/java/com/assessment/gildedrose/GildedRose.java',
        line: 14,
        mutatedContent: `package com.assessment.gildedrose;

public class GildedRose {
    public Item[] items;
    public GildedRose(Item[] items) { this.items = items; }
    public void updateQuality() {
        for (Item item : items) {
            item.quality -= 1; // MUTANT: Quality can become negative (-1, -2)!
            item.sellIn -= 1;
        }
    }
}`
      }
    ]
  },

  // 7. Overloaded Constructor Clock Seam
  {
    id: 'kata_test_overloaded_constructor_clock_seam',
    slug: 'kata-test-overloaded-constructor-clock-seam',
    title: 'KATA-TEST-03: Overloaded Constructor Clock Seam (Virtual Time)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Seam Injection',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, java.time.Clock',
    timeLimitMinutes: 35,
    shortDescription: 'Внедрение виртуального Clock через package-private конструктор без нарушения публичного контракта.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **SubscriptionExpiryCalculator** вычисляет дату окончания подписки (ровно +30 дней от текущего момента):
- Публичный конструктор по умолчанию \`SubscriptionExpiryCalculator()\` использует системное время.
- Для детерминированного тестирования добавлен шов — package-private конструктор \`SubscriptionExpiryCalculator(Clock clock)\`.

### 🧪 Ваша цель
Напишите тесты в \`SubscriptionExpiryCalculatorTest.java\` с использованием \`Clock.fixed(Instant, ZoneId)\`, уничтожающие всех 3 мутантов:
1. **Mutant 1 (IgnoreClockInjection):** Игнорирование внедренного Clock (вызов системного времени).
2. **Mutant 2 (DurationMath31Days):** Расчет +31 день вместо +30 дней.
3. **Mutant 3 (PastInstantAllowed):** Разрешение расчета при отрицательном интервале.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/subscription/SubscriptionExpiryCalculator.java',
        content: `package com.assessment.subscription;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class SubscriptionExpiryCalculator {
    private final Clock clock;

    public SubscriptionExpiryCalculator() {
        this(Clock.systemUTC());
    }

    // Package-private Seam for Deterministic Testing
    SubscriptionExpiryCalculator(Clock clock) {
        this.clock = clock;
    }

    public Instant calculateExpiry(int durationDays) {
        if (durationDays <= 0) {
            throw new IllegalArgumentException("Duration must be positive");
        }
        Instant now = clock.instant();
        return now.plus(durationDays, ChronoUnit.DAYS);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/subscription/SubscriptionExpiryCalculatorTest.java',
        content: `package com.assessment.subscription;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import static org.junit.jupiter.api.Assertions.*;

public class SubscriptionExpiryCalculatorTest {

    @Test
    @DisplayName("Should reject negative duration")
    public void testNegativeDuration() {
        SubscriptionExpiryCalculator calc = new SubscriptionExpiryCalculator();
        assertThrows(IllegalArgumentException.class, () -> {
            calc.calculateExpiry(-1);
        });
    }

    // TODO: Write tests using Clock.fixed to kill all 3 mutants!
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_sub_01_ignore_clock',
        name: 'IgnoreClockMutator',
        file: 'src/main/java/com/assessment/subscription/SubscriptionExpiryCalculator.java',
        line: 21,
        mutatedContent: `package com.assessment.subscription;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class SubscriptionExpiryCalculator {
    private final Clock clock;
    public SubscriptionExpiryCalculator() { this(Clock.systemUTC()); }
    SubscriptionExpiryCalculator(Clock clock) { this.clock = clock; }

    public Instant calculateExpiry(int durationDays) {
        if (durationDays <= 0) throw new IllegalArgumentException("Duration must be positive");
        Instant now = Instant.EPOCH; // MUTANT: Ignores injected clock!
        return now.plus(durationDays, ChronoUnit.DAYS);
    }
}`
      },
      {
        id: 'mutant_sub_02_duration_math_31',
        name: 'DurationMath31DaysMutator',
        file: 'src/main/java/com/assessment/subscription/SubscriptionExpiryCalculator.java',
        line: 22,
        mutatedContent: `package com.assessment.subscription;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class SubscriptionExpiryCalculator {
    private final Clock clock;
    public SubscriptionExpiryCalculator() { this(Clock.systemUTC()); }
    SubscriptionExpiryCalculator(Clock clock) { this.clock = clock; }

    public Instant calculateExpiry(int durationDays) {
        if (durationDays <= 0) throw new IllegalArgumentException("Duration must be positive");
        Instant now = clock.instant();
        return now.plus(durationDays + 1, ChronoUnit.DAYS); // MUTANT: adds 1 extra day!
    }
}`
      },
      {
        id: 'mutant_sub_03_zero_duration_allowed',
        name: 'ZeroDurationAllowedMutator',
        file: 'src/main/java/com/assessment/subscription/SubscriptionExpiryCalculator.java',
        line: 18,
        mutatedContent: `package com.assessment.subscription;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class SubscriptionExpiryCalculator {
    private final Clock clock;
    public SubscriptionExpiryCalculator() { this(Clock.systemUTC()); }
    SubscriptionExpiryCalculator(Clock clock) { this.clock = clock; }

    public Instant calculateExpiry(int durationDays) {
        if (durationDays < 0) { // MUTANT: < 0 allows 0 days!
            throw new IllegalArgumentException("Duration must be positive");
        }
        Instant now = clock.instant();
        return now.plus(durationDays, ChronoUnit.DAYS);
    }
}`
      }
    ]
  },

  // 8. Order State Machine Dynamic Tests
  {
    id: 'kata_test_order_state_machine_dynamic',
    slug: 'kata-test-order-state-machine-dynamic',
    title: 'KATA-TEST-05: Order State Machine Transitions (Finite Automata)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 State Machine Guard',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5',
    timeLimitMinutes: 40,
    shortDescription: 'Тестирование графа переходов состояний заказа: CREATED -> PAID -> SHIPPED -> DELIVERED.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Класс **OrderStateMachine** управляет жизненным циклом заказа:
- Допустимые переходы:
  - \`CREATED\` $\\to$ \`PAID\` или \`CANCELLED\`
  - \`PAID\` $\\to$ \`SHIPPED\` или \`CANCELLED\`
  - \`SHIPPED\` $\\to$ \`DELIVERED\` (после отгрузки отмена заказа строго запрещена!)
  - Любой другой переход обязан выбрасывать \`IllegalStateException\`.

### 🧪 Ваша цель
Напишите тесты в \`OrderStateMachineTest.java\`, уничтожающие всех 3 мутантов:
1. **Mutant 1 (AllowCancelAfterShipped):** Разрешение отмены после отгрузки.
2. **Mutant 2 (AllowBackwardsTransition):** Разрешение обратного перехода PAID $\\to$ CREATED.
3. **Mutant 3 (DeliveredPermitsTransition):** Разрешение переходов из финального DELIVERED.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/statemachine/OrderStatus.java',
        content: `package com.assessment.statemachine;

public enum OrderStatus {
    CREATED,
    PAID,
    SHIPPED,
    DELIVERED,
    CANCELLED
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        content: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;

    public OrderStatus getStatus() {
        return status;
    }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.CREATED) {
            if (next == OrderStatus.PAID || next == OrderStatus.CANCELLED) {
                status = next;
                return;
            }
        } else if (status == OrderStatus.PAID) {
            if (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED) {
                status = next;
                return;
            }
        } else if (status == OrderStatus.SHIPPED) {
            if (next == OrderStatus.DELIVERED) {
                status = next;
                return;
            }
        }
        throw new IllegalStateException("Illegal transition from " + status + " to " + next);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/statemachine/OrderStateMachineTest.java',
        content: `package com.assessment.statemachine;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

public class OrderStateMachineTest {

    @Test
    @DisplayName("Should start in CREATED status and transition to PAID")
    public void testCreatedToPaid() {
        OrderStateMachine sm = new OrderStateMachine();
        assertEquals(OrderStatus.CREATED, sm.getStatus());
        sm.transitionTo(OrderStatus.PAID);
        assertEquals(OrderStatus.PAID, sm.getStatus());
    }

    // TODO: Write illegal transition checks to kill all 3 mutants!
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_sm_01_cancel_after_shipped',
        name: 'CancelAfterShippedMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 22,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.SHIPPED) {
            if (next == OrderStatus.DELIVERED || next == OrderStatus.CANCELLED) { // MUTANT: allows CANCELLED after SHIPPED!
                status = next;
                return;
            }
        } else if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) {
            status = next; return;
        } else if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) {
            status = next; return;
        }
        throw new IllegalStateException("Illegal transition");
    }
}`
      },
      {
        id: 'mutant_sm_02_backwards_transition',
        name: 'BackwardsTransitionMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 17,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.PAID) {
            if (next == OrderStatus.CREATED) { // MUTANT: allows backwards transition to CREATED!
                status = next;
                return;
            }
        }
        if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.SHIPPED && next == OrderStatus.DELIVERED) { status = next; return; }
        throw new IllegalStateException("Illegal transition");
    }
}`
      },
      {
        id: 'mutant_sm_03_delivered_permits',
        name: 'DeliveredPermitsTransitionMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 26,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.DELIVERED) {
            status = next; // MUTANT: permits transition from final DELIVERED state!
            return;
        }
        if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.SHIPPED && next == OrderStatus.DELIVERED) { status = next; return; }
        throw new IllegalStateException("Illegal transition");
    }
}`
      }
    ]
  }
];
