import { CodingChallenge } from '../challengeSeedData';

export const LEGACY_SEAMS_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. TripService Subclass and Override Seam
  // =========================================================================
  {
    id: 'kata_test_trip_service_seam',
    slug: 'kata-test-trip-service-seam',
    title: 'KATA-TEST-01: TripService Decoupling (Subclass & Override Seam)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Seam Decoupling',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Изоляция статического UserSession и TripDAO через Subclass and Override без изменения публичного API.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Перед вами канонический класс **TripService** (Sandro Mancuso). 
Код сервиса **зафиксирован и доступен только для чтения**. В нём присутствуют две скрытые статические зависимости:
- \`UserSession.getInstance().getLoggedUser()\` — выбрасывает \`CollaboratorCallException\`, если вызывается вне веб-контейнера.
- \`TripDAO.findTripsByUser(user)\` — выбрасывает \`CollaboratorCallException\`, если вызывается без подключения к БД.

### 🧪 Ваша цель
В файле \`TripServiceTest.java\` напишите тесты на JUnit 5, создав локальный класс-наследник (шов *Subclass and Override*), переопределяющий \`getLoggedUser()\` и \`findTrips()\`.

Уничтожьте **все 5 скрытых мутантов** (Целевой Mutation Score: **100%**, минимум $\\ge 85\\%$):
1. **Mutant 1 (NegateSessionCheck):** Инверсия проверки авторизации.
2. **Mutant 2 (FriendLoopBreak):** Пропуск поиска друзей в цикле.
3. **Mutant 3 (ReturnEmptyOnFriend):** Возврат пустого списка вместо вызова DAO при совпадении друга.
4. **Mutant 4 (CollaboratorOmission):** Удаление вызова DAO.
5. **Mutant 5 (AlwaysThrowNotLoggedIn):** Выброс исключения независимо от сессии.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/legacy/User.java',
        content: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class User {
    private final String name;
    private final List<User> friends = new ArrayList<>();

    public User(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public List<User> getFriends() {
        return friends;
    }

    public void addFriend(User friend) {
        friends.add(friend);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/Trip.java',
        content: `package com.assessment.legacy;

public record Trip(String destination) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/CollaboratorCallException.java',
        content: `package com.assessment.legacy;

public class CollaboratorCallException extends RuntimeException {
    public CollaboratorCallException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/UserSession.java',
        content: `package com.assessment.legacy;

public class UserSession {
    private static final UserSession INSTANCE = new UserSession();

    private UserSession() {}

    public static UserSession getInstance() {
        return INSTANCE;
    }

    public User getLoggedUser() {
        throw new CollaboratorCallException("UserSession.getLoggedUser() cannot be called in unit tests!");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/TripDAO.java',
        content: `package com.assessment.legacy;
import java.util.List;

public class TripDAO {
    public static List<Trip> findTripsByUser(User user) {
        throw new CollaboratorCallException("TripDAO.findTripsByUser() cannot be invoked without real DB!");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/TripService.java',
        content: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) {
                    isFriend = true;
                    break;
                }
            }
            if (isFriend) {
                return findTrips(user);
            }
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }

    protected User getLoggedUser() {
        return UserSession.getInstance().getLoggedUser();
    }

    protected List<Trip> findTrips(User user) {
        return TripDAO.findTripsByUser(user);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/legacy/TripServiceTest.java',
        content: `package com.assessment.legacy;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

public class TripServiceTest {

    @Test
    @DisplayName("Should throw exception when user is not logged in")
    public void shouldThrowExceptionWhenUserNotLoggedIn() {
        TestableTripService service = new TestableTripService(null, new ArrayList<>());
        User target = new User("TargetUser");

        assertThrows(CollaboratorCallException.class, () -> {
            service.getTripsByUser(target);
        });
    }

    @Test
    @DisplayName("Should return trips when users are friends")
    public void shouldReturnTripsWhenFriends() {
        // TODO: Реализуйте проверки для метода shouldReturnTripsWhenFriends для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Should return empty list when users are not friends")
    public void shouldReturnEmptyListWhenNotFriends() {
        // TODO: Реализуйте проверки для метода shouldReturnEmptyListWhenNotFriends для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    static class TestableTripService extends TripService {
        private final User loggedUser;
        private final List<Trip> trips;

        public TestableTripService(User loggedUser, List<Trip> trips) {
            this.loggedUser = loggedUser;
            this.trips = trips;
        }

        @Override
        protected User getLoggedUser() {
            return loggedUser;
        }

        @Override
        protected List<Trip> findTrips(User user) {
            return trips;
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_trip_01_negate_session',
        name: 'NegateSessionCheckMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 11,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser == null) { // MUTANT: == instead of !=
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            if (isFriend) return findTrips(user);
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_02_friend_loop',
        name: 'FriendLoopBreakMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 13,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            // MUTANT: Loop bypassed, isFriend remains false
            if (isFriend) return findTrips(user);
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_03_return_empty',
        name: 'ReturnEmptyOnFriendMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 20,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            return new ArrayList<>(); // MUTANT: returns empty even for friends
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_04_dao_omission',
        name: 'VoidDaoCallMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 21,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            if (isFriend) return new ArrayList<>(); // MUTANT: does not call findTrips
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_05_always_throw',
        name: 'AlwaysThrowExceptionMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 25,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        throw new CollaboratorCallException("Unconditional failure"); // MUTANT: unconditional throw
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      }
    ]
  },

  // =========================================================================
  // 2. Gilded Rose Approval Testing (Golden Master)
  // =========================================================================
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
import static org.assertj.core.api.Assertions.assertThat;

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

    @Test
    @DisplayName("Aged Brie quality should never exceed 50")
    public void testAgedBrieQualityLimit() {
        // TODO: Реализуйте проверки для метода testAgedBrieQualityLimit для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Sulfuras should never degrade in quality")
    public void testSulfurasQualityFixed() {
        // TODO: Реализуйте проверки для метода testSulfurasQualityFixed для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Backstage passes quality drops to 0 after concert")
    public void testBackstagePassesDropToZero() {
        // TODO: Реализуйте проверки для метода testBackstagePassesDropToZero для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Quality should never become negative")
    public void testQualityNeverNegative() {
        // TODO: Реализуйте проверки для метода testQualityNeverNegative для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
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
                item.sellIn -= 1; // MUTANT: Quality kept instead of dropping to 0 when sellIn < 0!
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

  // =========================================================================
  // 3. Clock Seam (Virtual Time)
  // =========================================================================
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
import static org.assertj.core.api.Assertions.assertThat;

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

    @Test
    @DisplayName("Should reject zero duration")
    public void testZeroDuration() {
        // TODO: Реализуйте проверки для метода testZeroDuration для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Should use injected clock and calculate exact expiry")
    public void testInjectedClockExpiry() {
        // TODO: Реализуйте проверки для метода testInjectedClockExpiry для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
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

  // =========================================================================
  // 4. Legacy Static Security & Ambient Context Seam
  // =========================================================================
  {
    id: 'kata_test_legacy_security_context_seam',
    slug: 'kata-test-legacy-security-context-seam',
    title: 'KATA-TEST-21: Legacy Static Security & Ambient Context Seam',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Ambient Seam',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Отвязка сервиса расчёта счетов от синглтонов SecurityContextHolder и TCP-аудита через Object Seam.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **LegacyInvoiceProcessor** рассчитывает региональный налог и пишет аудит. Исторически он жестко связан со статическими синглтонами:
- \`SecurityContextHolder.getPrincipal()\` — бросает \`SecurityInitializationException\` вне enterprise-контейнера.
- \`LegacyAuditManager.logEntry()\` — отправляет аудит по TCP-сокету и бросает \`AuditServerUnavailableException\` в CI.
- \`SystemClock.currentTimeMillis()\` — недетерминированное время.

Публичный конструктор \`new LegacyInvoiceProcessor()\` и сигнатура \`process(Invoice)\` **не могут быть изменены**, чтобы не сломать внешних клиентов.

### 🧪 Ваша цель
В файле \`LegacyInvoiceProcessorTest.java\` используйте предоставленные швы (*Object Seam* через package-private конструктор или *Subclass and Override*) для изолированного тестирования.

Уничтожьте **все 5 мутантов**:
1. **Mutant 1 (HighValueBoundary):** \`> 5000.00\` заменено на \`>= 5000.00\`.
2. **Mutant 2 (AuditOmission):** Удаление вызова \`executeAudit(...)\`.
3. **Mutant 3 (NegateElevatedCheck):** Инверсия проверки прав привилегированного пользователя.
4. **Mutant 4 (MathMutator):** Вычитание налога вместо сложения при расчете \`netAmount\`.
5. **Mutant 5 (TaxExemptMutator):** Налог для налогонеоблагаемых счетов возвращает ненулевую ставку.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/tier1/billing/legacy/DomainModels.java',
        content: `package com.tier1.billing.legacy;

import java.math.BigDecimal;
import java.util.Objects;

class SecurityInitializationException extends RuntimeException {
    public SecurityInitializationException(String message) { super(message); }
}

class AuditServerUnavailableException extends RuntimeException {
    public AuditServerUnavailableException(String message) { super(message); }
}

record UserPrincipal(String username, String role, boolean isElevated) {}

record Invoice(String invoiceId, String customerId, BigDecimal grossAmount, boolean isTaxExempt) {
    public Invoice {
        Objects.requireNonNull(invoiceId, "invoiceId must not be null");
        Objects.requireNonNull(customerId, "customerId must not be null");
        Objects.requireNonNull(grossAmount, "grossAmount must not be null");
    }
}

record InvoiceResult(
    String invoiceId,
    BigDecimal grossAmount,
    BigDecimal taxAmount,
    BigDecimal netAmount,
    String processedBy,
    long timestampMs,
    boolean ledgerWritten
) {}

class SecurityContextHolder {
    private static final ThreadLocal<UserPrincipal> CONTEXT = new ThreadLocal<>();
    public static UserPrincipal getPrincipal() {
        UserPrincipal p = CONTEXT.get();
        if (p == null) throw new SecurityInitializationException("Vault/LDAP uninitialized");
        return p;
    }
    public static void setPrincipal(UserPrincipal p) { CONTEXT.set(p); }
    public static void clear() { CONTEXT.remove(); }
}

class LegacyAuditManager {
    public static void logEntry(String action, String user, double amount, long timestamp) {
        throw new AuditServerUnavailableException("TCP audit cluster unavailable");
    }
}

class SystemClock {
    public static long currentTimeMillis() { return System.currentTimeMillis(); }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        content: `package com.tier1.billing.legacy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface
    public interface SecurityProvider {
        UserPrincipal getPrincipal();
    }

    @FunctionalInterface
    public interface AuditLogger {
        void log(String action, String user, double amount, long timestampMs);
    }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() {
        this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC());
    }

    // Object Seam
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    protected UserPrincipal resolvePrincipal() { return securityProvider.getPrincipal(); }
    protected void executeAudit(String action, String user, BigDecimal amount, long timestampMs) {
        auditLogger.log(action, user, amount.doubleValue(), timestampMs);
    }
    protected long getCurrentTimestamp() { return clock.millis(); }

    public InvoiceResult process(Invoice invoice) {
        Objects.requireNonNull(invoice, "Invoice cannot be null");
        UserPrincipal principal = resolvePrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");

        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) > 0;
        if (isHighValue && !principal.isElevated()) {
            throw new SecurityException("Forbidden: User " + principal.username() + " lacks elevated clearance");
        }

        BigDecimal taxRate;
        if (invoice.isTaxExempt()) {
            taxRate = BigDecimal.ZERO;
        } else if (isHighValue) {
            taxRate = REDUCED_TAX_RATE;
        } else {
            taxRate = STANDARD_TAX_RATE;
        }

        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = invoice.grossAmount().add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        long processingTime = getCurrentTimestamp();

        executeAudit("INVOICE_PROCESSED", principal.username(), netAmount, processingTime);

        return new InvoiceResult(
            invoice.invoiceId(),
            invoice.grossAmount(),
            taxAmount,
            netAmount,
            principal.username(),
            processingTime,
            true
        );
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/tier1/billing/legacy/LegacyInvoiceProcessorTest.java',
        content: `package com.tier1.billing.legacy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LegacyInvoiceProcessorTest {

    private static final Instant FIXED_INSTANT = Instant.parse("2026-03-30T10:00:00Z");
    private static final Clock FIXED_CLOCK = Clock.fixed(FIXED_INSTANT, ZoneId.of("UTC"));

    record AuditEntry(String action, String user, double amount, long timestampMs) {}

    static class TestAuditLogger implements LegacyInvoiceProcessor.AuditLogger {
        final List<AuditEntry> entries = new ArrayList<>();
        @Override
        public void log(String action, String user, double amount, long timestampMs) {
            entries.add(new AuditEntry(action, user, amount, timestampMs));
        }
    }

    @Test
    @DisplayName("Should calculate standard 10% tax for non-exempt invoice under 5000")
    void standardTaxCalculation() {
        TestAuditLogger audit = new TestAuditLogger();
        UserPrincipal user = new UserPrincipal("alice", "STAFF", false);
        LegacyInvoiceProcessor processor = new LegacyInvoiceProcessor(() -> user, audit, FIXED_CLOCK);

        Invoice inv = new Invoice("INV-1", "CUST-1", new BigDecimal("1000.00"), false);
        InvoiceResult res = processor.process(inv);

        assertThat(res.taxAmount()).isEqualByComparingTo("100.00");
        assertThat(res.netAmount()).isEqualByComparingTo("1100.00");
        assertThat(audit.entries).hasSize(1);
    }

    @Test
    @DisplayName("Boundary: Exactly 5000.00 remains standard value (Kills M1)")
    void exactlyFiveThousandStandardRate() {
        // TODO: Реализуйте проверки для метода exactlyFiveThousandStandardRate для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("High value above 5000 rejects non-elevated user (Kills M3)")
    void highValueRejectsNonElevated() {
        // TODO: Реализуйте проверки для метода highValueRejectsNonElevated для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Tax exempt customers incur 0.00 tax (Kills M4, M5)")
    void taxExemptZeroTax() {
        // TODO: Реализуйте проверки для метода taxExemptZeroTax для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_lip_01_high_value_boundary',
        name: 'HighValueBoundaryMutator',
        file: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        line: 41,
        mutatedContent: `package com.tier1.billing.legacy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface public interface SecurityProvider { UserPrincipal getPrincipal(); }
    @FunctionalInterface public interface AuditLogger { void log(String action, String user, double amount, long timestampMs); }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() { this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC()); }
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    public InvoiceResult process(Invoice invoice) {
        UserPrincipal principal = securityProvider.getPrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");
        // MUTANT: >= instead of >
        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) >= 0;
        if (isHighValue && !principal.isElevated()) {
            throw new SecurityException("Forbidden");
        }
        BigDecimal taxRate = invoice.isTaxExempt() ? BigDecimal.ZERO : (isHighValue ? REDUCED_TAX_RATE : STANDARD_TAX_RATE);
        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = invoice.grossAmount().add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        auditLogger.log("INVOICE_PROCESSED", principal.username(), netAmount.doubleValue(), clock.millis());
        return new InvoiceResult(invoice.invoiceId(), invoice.grossAmount(), taxAmount, netAmount, principal.username(), clock.millis(), true);
    }
}`
      },
      {
        id: 'mutant_lip_02_audit_omission',
        name: 'AuditOmissionMutator',
        file: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        line: 55,
        mutatedContent: `package com.tier1.billing.legacy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface public interface SecurityProvider { UserPrincipal getPrincipal(); }
    @FunctionalInterface public interface AuditLogger { void log(String action, String user, double amount, long timestampMs); }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() { this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC()); }
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    public InvoiceResult process(Invoice invoice) {
        UserPrincipal principal = securityProvider.getPrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");
        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) > 0;
        if (isHighValue && !principal.isElevated()) throw new SecurityException("Forbidden");
        BigDecimal taxRate = invoice.isTaxExempt() ? BigDecimal.ZERO : (isHighValue ? REDUCED_TAX_RATE : STANDARD_TAX_RATE);
        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = invoice.grossAmount().add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        // MUTANT: auditLogger.log(...) omitted!
        return new InvoiceResult(invoice.invoiceId(), invoice.grossAmount(), taxAmount, netAmount, principal.username(), clock.millis(), true);
    }
}`
      },
      {
        id: 'mutant_lip_03_negate_elevated',
        name: 'NegateElevatedCheckMutator',
        file: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        line: 42,
        mutatedContent: `package com.tier1.billing.legacy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface public interface SecurityProvider { UserPrincipal getPrincipal(); }
    @FunctionalInterface public interface AuditLogger { void log(String action, String user, double amount, long timestampMs); }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() { this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC()); }
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    public InvoiceResult process(Invoice invoice) {
        UserPrincipal principal = securityProvider.getPrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");
        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) > 0;
        // MUTANT: checks isElevated() instead of !principal.isElevated()
        if (isHighValue && principal.isElevated()) {
            throw new SecurityException("Forbidden");
        }
        BigDecimal taxRate = invoice.isTaxExempt() ? BigDecimal.ZERO : (isHighValue ? REDUCED_TAX_RATE : STANDARD_TAX_RATE);
        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = invoice.grossAmount().add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        auditLogger.log("INVOICE_PROCESSED", principal.username(), netAmount.doubleValue(), clock.millis());
        return new InvoiceResult(invoice.invoiceId(), invoice.grossAmount(), taxAmount, netAmount, principal.username(), clock.millis(), true);
    }
}`
      },
      {
        id: 'mutant_lip_04_math_subtract',
        name: 'MathSubtractTaxMutator',
        file: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        line: 52,
        mutatedContent: `package com.tier1.billing.legacy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface public interface SecurityProvider { UserPrincipal getPrincipal(); }
    @FunctionalInterface public interface AuditLogger { void log(String action, String user, double amount, long timestampMs); }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() { this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC()); }
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    public InvoiceResult process(Invoice invoice) {
        UserPrincipal principal = securityProvider.getPrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");
        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) > 0;
        if (isHighValue && !principal.isElevated()) throw new SecurityException("Forbidden");
        BigDecimal taxRate = invoice.isTaxExempt() ? BigDecimal.ZERO : (isHighValue ? REDUCED_TAX_RATE : STANDARD_TAX_RATE);
        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        // MUTANT: subtract instead of add!
        BigDecimal netAmount = invoice.grossAmount().subtract(taxAmount).setScale(2, RoundingMode.HALF_UP);
        auditLogger.log("INVOICE_PROCESSED", principal.username(), netAmount.doubleValue(), clock.millis());
        return new InvoiceResult(invoice.invoiceId(), invoice.grossAmount(), taxAmount, netAmount, principal.username(), clock.millis(), true);
    }
}`
      },
      {
        id: 'mutant_lip_05_exempt_non_zero',
        name: 'ExemptTaxNonZeroMutator',
        file: 'src/main/java/com/tier1/billing/legacy/LegacyInvoiceProcessor.java',
        line: 48,
        mutatedContent: `package com.tier1.billing.legacy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;

public class LegacyInvoiceProcessor {
    private static final BigDecimal STANDARD_TAX_RATE = new BigDecimal("0.1000");
    private static final BigDecimal REDUCED_TAX_RATE = new BigDecimal("0.0500");
    private static final BigDecimal HIGH_VALUE_THRESHOLD = new BigDecimal("5000.00");

    @FunctionalInterface public interface SecurityProvider { UserPrincipal getPrincipal(); }
    @FunctionalInterface public interface AuditLogger { void log(String action, String user, double amount, long timestampMs); }

    private final SecurityProvider securityProvider;
    private final AuditLogger auditLogger;
    private final Clock clock;

    public LegacyInvoiceProcessor() { this(SecurityContextHolder::getPrincipal, LegacyAuditManager::logEntry, Clock.systemUTC()); }
    LegacyInvoiceProcessor(SecurityProvider securityProvider, AuditLogger auditLogger, Clock clock) {
        this.securityProvider = Objects.requireNonNull(securityProvider);
        this.auditLogger = Objects.requireNonNull(auditLogger);
        this.clock = Objects.requireNonNull(clock);
    }

    public InvoiceResult process(Invoice invoice) {
        UserPrincipal principal = securityProvider.getPrincipal();
        if (principal == null) throw new SecurityException("Unauthorized");
        boolean isHighValue = invoice.grossAmount().compareTo(HIGH_VALUE_THRESHOLD) > 0;
        if (isHighValue && !principal.isElevated()) throw new SecurityException("Forbidden");
        // MUTANT: exempt returns 0.02 instead of ZERO!
        BigDecimal taxRate = invoice.isTaxExempt() ? new BigDecimal("0.0200") : (isHighValue ? REDUCED_TAX_RATE : STANDARD_TAX_RATE);
        BigDecimal taxAmount = invoice.grossAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = invoice.grossAmount().add(taxAmount).setScale(2, RoundingMode.HALF_UP);
        auditLogger.log("INVOICE_PROCESSED", principal.username(), netAmount.doubleValue(), clock.millis());
        return new InvoiceResult(invoice.invoiceId(), invoice.grossAmount(), taxAmount, netAmount, principal.username(), clock.millis(), true);
    }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Non-Deterministic Financial Engine Golden Master
  // =========================================================================
  {
    id: 'kata_test_legacy_tax_engine_golden_master',
    slug: 'kata-test-legacy-tax-engine-golden-master',
    title: 'KATA-TEST-22: Non-Deterministic Financial Engine Golden Master',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Golden Master Parity',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 50,
    shortDescription: 'Изоляция недетерминированного PRNG и Golden Master верификация прогрессивных налоговых шкал.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Монолитный класс **LegacyTaxEngine** рассчитывает налоги по 4 прогрессивным шкалам:
- До 10,000.00 — 5%
- 10,000.01 до 50,000.00 — 12%
- 50,000.01 до 100,000.00 — 22%
- Свыше 100,000.00 — 30% + 3% кумулятивный налог на роскошь.

Сервис содержит скрытый недетерминизм:
\`\`\`java
if (isHolidaySeason && new Random().nextDouble() < 0.20) {
    // 5% сезонная скидка
}
\`\`\`
Отрицательные суммы облагаются штрафом в $15.00 без налога. Поддерживается 5 валют (USD, EUR, GBP, CAD, JPY).

### 🧪 Ваша цель
В \`LegacyTaxEngineTest.java\` изолируйте источник случайности через внедрение детерминированного \`new Random(seed)\` и постройте параметризованный тест-сьют, уничтожающий всех 5 мутантов:
1. **Mutant 1 (BracketCeilingShift):** Смещение границы 3-й шкалы налога.
2. **Mutant 2 (LuxuryFeeMath):** Замена сложения на вычитание в налоге на роскошь.
3. **Mutant 3 (FxRateScaleTruncate):** Потеря точности при конвертации валют.
4. **Mutant 4 (NegativeCheckShift):** Начисление штрафа в $15 на нулевые чеки ($0.00).
5. **Mutant 5 (SeasonalDiscountSubtract):** Вычитание праздничной скидки вместо сложения.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        content: `package com.tier1.financial.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

public class LegacyTaxEngine {

    public record LegacyTaxCalculation(
        BigDecimal grossAmount,
        BigDecimal discountAmount,
        BigDecimal taxableAmount,
        BigDecimal taxAmount,
        BigDecimal feeAmount,
        BigDecimal netTotalAmount,
        String currency
    ) {}

    private static final Map<String, BigDecimal> FX_RATES = Map.of(
        "USD", new BigDecimal("1.0000"),
        "EUR", new BigDecimal("0.9200"),
        "GBP", new BigDecimal("0.7900"),
        "CAD", new BigDecimal("1.3600"),
        "JPY", new BigDecimal("155.0000")
    );

    private final Random random;

    public LegacyTaxEngine() {
        this(new Random());
    }

    public LegacyTaxEngine(Random random) {
        this.random = Objects.requireNonNull(random);
    }

    public LegacyTaxCalculation calculate(
        BigDecimal amount,
        String currency,
        String customerType,
        boolean isHolidaySeason
    ) {
        Objects.requireNonNull(amount);
        Objects.requireNonNull(currency);
        Objects.requireNonNull(customerType);

        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            BigDecimal fee = new BigDecimal("15.00");
            BigDecimal net = amount.subtract(fee).setScale(2, RoundingMode.HALF_UP);
            return new LegacyTaxCalculation(
                amount.setScale(2, RoundingMode.HALF_UP),
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                fee,
                net,
                currency
            );
        }

        BigDecimal fxRate = FX_RATES.get(currency);
        if (fxRate == null) throw new IllegalArgumentException("UNSUPPORTED_CURRENCY: " + currency);

        BigDecimal baseDiscountRate = switch (customerType) {
            case "WHOLESALE" -> new BigDecimal("0.08");
            case "GOVERNMENT" -> new BigDecimal("0.05");
            case "RETAIL" -> BigDecimal.ZERO;
            case "EXEMPT" -> BigDecimal.ZERO;
            default -> throw new IllegalArgumentException("INVALID_CUSTOMER_TYPE: " + customerType);
        };

        BigDecimal seasonalDiscountRate = BigDecimal.ZERO;
        if (isHolidaySeason) {
            if (this.random.nextDouble() < 0.20) {
                seasonalDiscountRate = new BigDecimal("0.05");
            }
        }

        BigDecimal totalDiscountRate = baseDiscountRate.add(seasonalDiscountRate);
        BigDecimal discount = amount.multiply(totalDiscountRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal taxableNative = amount.subtract(discount).setScale(2, RoundingMode.HALF_UP);

        BigDecimal taxableUsd = taxableNative.divide(fxRate, 4, RoundingMode.HALF_UP);
        BigDecimal taxUsd = BigDecimal.ZERO;

        if (!"EXEMPT".equals(customerType) && taxableUsd.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal remaining = taxableUsd;

            // Bracket 1: 0 to 10,000 @ 5%
            BigDecimal b1Chunk = remaining.min(new BigDecimal("10000.00"));
            if (b1Chunk.compareTo(BigDecimal.ZERO) > 0) {
                taxUsd = taxUsd.add(b1Chunk.multiply(new BigDecimal("0.05")));
                remaining = remaining.subtract(b1Chunk);
            }

            // Bracket 2: 10,000 to 50,000 @ 12%
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal b2Chunk = remaining.min(new BigDecimal("40000.00"));
                taxUsd = taxUsd.add(b2Chunk.multiply(new BigDecimal("0.12")));
                remaining = remaining.subtract(b2Chunk);
            }

            // Bracket 3: 50,000 to 100,000 @ 22%
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal b3Chunk = remaining.min(new BigDecimal("50000.00"));
                taxUsd = taxUsd.add(b3Chunk.multiply(new BigDecimal("0.22")));
                remaining = remaining.subtract(b3Chunk);
            }

            // Bracket 4: > 100,000 @ 30% + 3% compounding luxury
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal t4BaseTax = remaining.multiply(new BigDecimal("0.30"));
                BigDecimal luxuryFee = remaining.add(t4BaseTax).multiply(new BigDecimal("0.03"));
                taxUsd = taxUsd.add(t4BaseTax).add(luxuryFee);
            }
        }

        BigDecimal taxNative = taxUsd.multiply(fxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netTotal = taxableNative.add(taxNative).setScale(2, RoundingMode.HALF_UP);

        return new LegacyTaxCalculation(
            amount.setScale(2, RoundingMode.HALF_UP),
            discount,
            taxableNative,
            taxNative,
            BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
            netTotal,
            currency
        );
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/tier1/financial/engine/LegacyTaxEngineTest.java',
        content: `package com.tier1.financial.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Random;
import static org.assertj.core.api.Assertions.assertThat;

class LegacyTaxEngineTest {

    private static final long SEED = 42_1337_9092L;

    @Test
    @DisplayName("Should correctly calculate tax for 50,000 USD (Kills KM1)")
    void testFiftyThousandCeiling() {
        LegacyTaxEngine engine = new LegacyTaxEngine(new Random(SEED));
        var res = engine.calculate(new BigDecimal("50000.00"), "USD", "RETAIL", false);

        assertThat(res.taxAmount()).isEqualByComparingTo("5300.00");
        assertThat(res.netTotalAmount()).isEqualByComparingTo("55300.00");
    }

    @Test
    @DisplayName("Should correctly calculate luxury compounding for 150,000 USD (Kills KM2)")
    void testLuxuryCompounding() {
        // TODO: Реализуйте проверки для метода testLuxuryCompounding для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Should maintain decimal precision for foreign currency EUR (Kills KM3)")
    void testEurPrecision() {
        // TODO: Реализуйте проверки для метода testEurPrecision для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Zero dollar invoice should incur zero tax and zero fee (Kills KM4)")
    void testZeroDollarNoFee() {
        // TODO: Реализуйте проверки для метода testZeroDollarNoFee для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Wholesale customer receives seasonal discount (Kills KM5)")
    void testWholesaleSeasonalDiscount() {
        // TODO: Реализуйте проверки для метода testWholesaleSeasonalDiscount для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_lte_01_bracket_ceiling',
        name: 'BracketCeilingShiftMutator',
        file: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        line: 95,
        mutatedContent: `package com.tier1.financial.engine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Random;

public class LegacyTaxEngine {
    public record LegacyTaxCalculation(BigDecimal grossAmount, BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal feeAmount, BigDecimal netTotalAmount, String currency) {}
    private static final Map<String, BigDecimal> FX_RATES = Map.of("USD", BigDecimal.ONE);
    private final Random random;
    public LegacyTaxEngine() { this(new Random()); }
    public LegacyTaxEngine(Random random) { this.random = random; }

    public LegacyTaxCalculation calculate(BigDecimal amount, String currency, String customerType, boolean isHolidaySeason) {
        if (amount.compareTo(BigDecimal.ZERO) < 0) return new LegacyTaxCalculation(amount, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("15.00"), amount.subtract(new BigDecimal("15.00")), currency);
        BigDecimal taxableUsd = amount;
        BigDecimal taxUsd = BigDecimal.ZERO;
        BigDecimal remaining = taxableUsd;
        BigDecimal b1 = remaining.min(new BigDecimal("10000.00"));
        if (b1.compareTo(BigDecimal.ZERO) > 0) { taxUsd = taxUsd.add(b1.multiply(new BigDecimal("0.05"))); remaining = remaining.subtract(b1); }
        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            // MUTANT: 45000 instead of 40000
            BigDecimal b2 = remaining.min(new BigDecimal("45000.00"));
            taxUsd = taxUsd.add(b2.multiply(new BigDecimal("0.12")));
            remaining = remaining.subtract(b2);
        }
        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal b3 = remaining.min(new BigDecimal("50000.00"));
            taxUsd = taxUsd.add(b3.multiply(new BigDecimal("0.22")));
            remaining = remaining.subtract(b3);
        }
        return new LegacyTaxCalculation(amount, BigDecimal.ZERO, amount, taxUsd, BigDecimal.ZERO, amount.add(taxUsd), currency);
    }
}`
      },
      {
        id: 'mutant_lte_02_luxury_fee_math',
        name: 'LuxuryFeeMathMutator',
        file: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        line: 108,
        mutatedContent: `package com.tier1.financial.engine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Random;

public class LegacyTaxEngine {
    public record LegacyTaxCalculation(BigDecimal grossAmount, BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal feeAmount, BigDecimal netTotalAmount, String currency) {}
    private final Random random;
    public LegacyTaxEngine() { this(new Random()); }
    public LegacyTaxEngine(Random random) { this.random = random; }

    public LegacyTaxCalculation calculate(BigDecimal amount, String currency, String customerType, boolean isHolidaySeason) {
        BigDecimal remaining = amount;
        BigDecimal taxUsd = BigDecimal.ZERO;
        BigDecimal b1 = remaining.min(new BigDecimal("10000.00")); remaining = remaining.subtract(b1); taxUsd = taxUsd.add(b1.multiply(new BigDecimal("0.05")));
        BigDecimal b2 = remaining.min(new BigDecimal("40000.00")); remaining = remaining.subtract(b2); taxUsd = taxUsd.add(b2.multiply(new BigDecimal("0.12")));
        BigDecimal b3 = remaining.min(new BigDecimal("50000.00")); remaining = remaining.subtract(b3); taxUsd = taxUsd.add(b3.multiply(new BigDecimal("0.22")));
        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal t4BaseTax = remaining.multiply(new BigDecimal("0.30"));
            // MUTANT: subtract instead of add!
            BigDecimal luxuryFee = remaining.subtract(t4BaseTax).multiply(new BigDecimal("0.03"));
            taxUsd = taxUsd.add(t4BaseTax).add(luxuryFee);
        }
        return new LegacyTaxCalculation(amount, BigDecimal.ZERO, amount, taxUsd, BigDecimal.ZERO, amount.add(taxUsd), currency);
    }
}`
      },
      {
        id: 'mutant_lte_03_fx_truncate',
        name: 'FxScaleTruncateMutator',
        file: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        line: 82,
        mutatedContent: `package com.tier1.financial.engine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Random;

public class LegacyTaxEngine {
    public record LegacyTaxCalculation(BigDecimal grossAmount, BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal feeAmount, BigDecimal netTotalAmount, String currency) {}
    private static final Map<String, BigDecimal> FX_RATES = Map.of("USD", BigDecimal.ONE, "EUR", new BigDecimal("0.9200"));
    private final Random random;
    public LegacyTaxEngine() { this(new Random()); }
    public LegacyTaxEngine(Random random) { this.random = random; }

    public LegacyTaxCalculation calculate(BigDecimal amount, String currency, String customerType, boolean isHolidaySeason) {
        BigDecimal fxRate = FX_RATES.get(currency);
        // MUTANT: scale 1 instead of 4
        BigDecimal taxableUsd = amount.divide(fxRate, 1, RoundingMode.HALF_UP);
        BigDecimal taxUsd = taxableUsd.multiply(new BigDecimal("0.05"));
        BigDecimal taxNative = taxUsd.multiply(fxRate).setScale(2, RoundingMode.HALF_UP);
        return new LegacyTaxCalculation(amount, BigDecimal.ZERO, amount, taxNative, BigDecimal.ZERO, amount.add(taxNative), currency);
    }
}`
      },
      {
        id: 'mutant_lte_04_negative_check',
        name: 'NegativeCheckBoundaryMutator',
        file: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        line: 45,
        mutatedContent: `package com.tier1.financial.engine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Random;

public class LegacyTaxEngine {
    public record LegacyTaxCalculation(BigDecimal grossAmount, BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal feeAmount, BigDecimal netTotalAmount, String currency) {}
    private final Random random;
    public LegacyTaxEngine() { this(new Random()); }
    public LegacyTaxEngine(Random random) { this.random = random; }

    public LegacyTaxCalculation calculate(BigDecimal amount, String currency, String customerType, boolean isHolidaySeason) {
        // MUTANT: <= 0 assesses fee on zero dollar invoices!
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            BigDecimal fee = new BigDecimal("15.00");
            return new LegacyTaxCalculation(amount, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, fee, amount.subtract(fee), currency);
        }
        return new LegacyTaxCalculation(amount, BigDecimal.ZERO, amount, BigDecimal.ZERO, BigDecimal.ZERO, amount, currency);
    }
}`
      },
      {
        id: 'mutant_lte_05_seasonal_subtract',
        name: 'SeasonalDiscountSubtractMutator',
        file: 'src/main/java/com/tier1/financial/engine/LegacyTaxEngine.java',
        line: 67,
        mutatedContent: `package com.tier1.financial.engine;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Random;

public class LegacyTaxEngine {
    public record LegacyTaxCalculation(BigDecimal grossAmount, BigDecimal discountAmount, BigDecimal taxableAmount, BigDecimal taxAmount, BigDecimal feeAmount, BigDecimal netTotalAmount, String currency) {}
    private final Random random;
    public LegacyTaxEngine() { this(new Random()); }
    public LegacyTaxEngine(Random random) { this.random = random; }

    public LegacyTaxCalculation calculate(BigDecimal amount, String currency, String customerType, boolean isHolidaySeason) {
        BigDecimal baseDiscountRate = new BigDecimal("0.08");
        BigDecimal seasonalDiscountRate = new BigDecimal("0.05");
        // MUTANT: subtract instead of add!
        BigDecimal totalDiscountRate = baseDiscountRate.subtract(seasonalDiscountRate);
        BigDecimal discount = amount.multiply(totalDiscountRate).setScale(2, RoundingMode.HALF_UP);
        return new LegacyTaxCalculation(amount, discount, amount.subtract(discount), BigDecimal.ZERO, BigDecimal.ZERO, amount, currency);
    }
}`
      }
    ]
  }
];
