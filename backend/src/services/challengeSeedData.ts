/**
 * Curated Premier Catalog of Java 21 & Spring Coding Challenges
 * Distilled from Top 20 GitHub Repositories (August 2026 SOTA)
 */

export interface FileNode {
  path: string;
  content: string;
  readOnly: boolean;
  hidden: boolean;
  isMainEntryPoint?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  phase: number;
  weight: number;
  timeoutMs: number;
  input?: string;
  expectedOutput?: string;
  assertionScript?: string;
  isHidden: boolean;
}

export interface PhasedRequirement {
  phase: number;
  unlockTimeMinutes: number;
  title: string;
  descriptionMarkdown: string;
  addedFiles: FileNode[];
  testCases: TestCase[];
}

export interface GoldenMasterConfig {
  enabled: boolean;
  approvedSnapshotPath: string;
  receivedSnapshotPath: string;
  snapshotGeneratorClass: string;
  simulatedIterations: number;
  ignoreLineEndings: boolean;
  sampleBaselineText?: string;
}

export interface ConcurrencyHarnessConfig {
  enabled: boolean;
  useVirtualThreads: boolean;
  concurrentThreadCount: number;
  executionTimeoutMs: number;
  detectCarrierThreadPinning: boolean;
  detectThreadLeaks: boolean;
  stressLoopCount: number;
}

export interface JavaIdiomRequirements {
  requireSealedClasses?: boolean;
  requireRecords?: boolean;
  requirePatternMatching?: boolean;
  disallowSynchronizedKeyword?: boolean;
}

export interface CodingChallenge {
  id: string;
  slug: string;
  title: string;
  category: 'machine_coding' | 'refactoring_kata' | 'concurrency_lab' | 'java21_idioms';
  badge: string;
  difficulty: 'Junior' | 'Middle' | 'Senior' | 'Lead';
  targetStack: string;
  timeLimitMinutes: number;
  shortDescription: string;
  instructionsMarkdown: string;
  workspaceFiles: FileNode[];
  phasedRequirements?: PhasedRequirement[];
  goldenMasterConfig?: GoldenMasterConfig;
  enforceSeamValidation?: boolean;
  allowedPublicSignatureChanges?: number;
  concurrencyConfig?: ConcurrencyHarnessConfig;
  idiomRequirements?: JavaIdiomRequirements;
  scoringWeights: {
    functionalCorrectness: number;
    concurrencySafety: number;
    architectureAndCleanCode: number;
    modernIdioms: number;
  };
}

const BASE_CHALLENGES: CodingChallenge[] = [
  // 1. In-Memory Thread-Safe Rate Limiter (Machine Coding / LLD)
  {
    id: 'mc_rate_limiter_token_bucket',
    slug: 'rate-limiter-token-bucket',
    title: 'In-Memory Thread-Safe Rate Limiter',
    category: 'machine_coding',
    badge: '⚡ Machine Coding (LLD)',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Concurrency Primitives, Virtual Threads Safe',
    timeLimitMinutes: 60,
    shortDescription: 'Спроектируйте высокопроизводительный потокобезопасный ограничитель частоты запросов (Token Bucket / Sliding Window) с поддержкой burst capacity и ленивого пополнения.',
    instructionsMarkdown: `# In-Memory Thread-Safe Rate Limiter (LLD)

## Бизнес-контекст
Вы разрабатываете критический компонент API Gateway, через который проходит до 100 000 rps. Необходимо ограничить доступ клиентов (по \`clientId\` или IP) в соответствии с заданными лимитами.

## Требования к реализации:
1. Реализовать интерфейс \`RateLimiterStrategy\` для алгоритма **Token Bucket** в \`TokenBucketStrategy.java\`.
2. Поддерживать настраиваемую емкость (\`capacity\`) и скорость пополнения токенов (\`refillRatePerSecond\`).
3. **Потокобезопасность:** Решение должно корректно работать при одновременных запросах от сотен виртуальных потоков (Virtual Threads) без грубых блокировок всего класса.
4. **Ленивое пополнение (Lazy Refill):** Вместо сотен фоновых таймеров используйте вычисление прошедшего времени (\`elapsedTime\`) при поступлении запроса.
5. Обеспечить корректную работу метода \`allowRequest(String clientId, int tokens)\`.

## Фаза 2 (OCP Shift на 45-й минуте):
Система должна поддерживать динамические тарифы (Free, Pro, Enterprise) с разными лимитами без изменения существующего интерфейса.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/ratelimiter/contract/RateLimiter.java',
        content: `package com.assessment.ratelimiter.contract;

public interface RateLimiter {
    /**
     * Checks if the client is allowed to consume the requested tokens.
     * @param clientId unique client identifier
     * @param tokens number of tokens requested (usually 1)
     * @return true if request is permitted, false if rate limit exceeded
     */
    boolean allowRequest(String clientId, int tokens);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/ratelimiter/contract/RateLimiterStrategy.java',
        content: `package com.assessment.ratelimiter.contract;

public interface RateLimiterStrategy {
    boolean tryAcquire(String clientId, int tokens);
    void updateLimits(long capacity, double refillRatePerSecond);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/ratelimiter/model/TokenBucket.java',
        content: `package com.assessment.ratelimiter.model;

import java.util.concurrent.atomic.AtomicLong;

public record TokenBucket(
    long capacity,
    double refillRatePerSecond,
    AtomicLong currentTokens,
    AtomicLong lastRefillTimestampNanos
) {
    public static TokenBucket create(long capacity, double refillRatePerSecond) {
        return new TokenBucket(
            capacity,
            refillRatePerSecond,
            new AtomicLong(capacity),
            new AtomicLong(System.nanoTime())
        );
    }
}`,
        readOnly: false,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/ratelimiter/service/TokenBucketStrategy.java',
        content: `package com.assessment.ratelimiter.service;

import com.assessment.ratelimiter.contract.RateLimiterStrategy;
import com.assessment.ratelimiter.model.TokenBucket;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public class TokenBucketStrategy implements RateLimiterStrategy {
    private final ConcurrentMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private volatile long capacity;
    private volatile double refillRatePerSecond;

    public TokenBucketStrategy(long capacity, double refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRatePerSecond = refillRatePerSecond;
    }

    @Override
    public boolean tryAcquire(String clientId, int tokens) {
        // TODO: Implement lazy refill and atomic token decrement under concurrency
        TokenBucket bucket = buckets.computeIfAbsent(clientId, id -> TokenBucket.create(capacity, refillRatePerSecond));
        
        // Write your thread-safe token acquisition logic here:
        return true;
    }

    @Override
    public void updateLimits(long capacity, double refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRatePerSecond = refillRatePerSecond;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/ratelimiter/TokenBucketStrategyTest.java',
        content: `package com.assessment.ratelimiter;

import com.assessment.ratelimiter.service.TokenBucketStrategy;

public class TokenBucketStrategyTest {
    public void testBasicAcquire() {
        TokenBucketStrategy strategy = new TokenBucketStrategy(10, 5);
        if (!strategy.tryAcquire("client-1", 1)) {
            throw new AssertionError("Should allow initial request");
        }
    }

    public void testConcurrentAcquireStress() {
        TokenBucketStrategy strategy = new TokenBucketStrategy(1000, 100);
        strategy.tryAcquire("stress-client", 1);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    phasedRequirements: [
      {
        phase: 2,
        unlockTimeMinutes: 45,
        title: 'Phase 2: Dynamic Tiered Policies (Free, Pro, Enterprise)',
        descriptionMarkdown: 'Расширьте сервис для поддержки тарифов: Free (10 rps), Pro (100 rps), Enterprise (1000 rps + burst 2x). Существующие контракты не должны быть сломаны.',
        addedFiles: [
          {
            path: 'src/main/java/com/assessment/ratelimiter/contract/ClientTierPolicy.java',
            content: `package com.assessment.ratelimiter.contract;

public enum ClientTier { FREE, PRO, ENTERPRISE }

public interface ClientTierPolicy {
    long getCapacityForTier(ClientTier tier);
    double getRefillRateForTier(ClientTier tier);
}`,
            readOnly: true,
            hidden: false
          }
        ],
        testCases: [
          {
            id: 'TC_PHASE2_TIERED_LIMIT',
            name: 'Verify Enterprise Tier 10x capacity under load',
            phase: 2,
            weight: 25,
            timeoutMs: 1500,
            isHidden: false
          }
        ]
      }
    ],
    concurrencyConfig: {
      enabled: true,
      useVirtualThreads: true,
      concurrentThreadCount: 1000,
      executionTimeoutMs: 3000,
      detectCarrierThreadPinning: true,
      detectThreadLeaks: true,
      stressLoopCount: 10000
    },
    idiomRequirements: {
      requireRecords: true,
      disallowSynchronizedKeyword: true
    },
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.25,
      architectureAndCleanCode: 0.25,
      modernIdioms: 0.15
    }
  },

  // 2. Gilded Rose Refactoring Kata (Approval Testing / Golden Master)
  {
    id: 'kata_gilded_rose',
    slug: 'gilded-rose-refactoring-kata',
    title: 'Gilded Rose Refactoring Kata',
    category: 'refactoring_kata',
    badge: '🛡️ Refactoring Kata',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, OOP Polymorphism, Characterization Approval Tests',
    timeLimitMinutes: 45,
    shortDescription: 'Рефакторинг классического запутанного легаси-кода с глубокой вложенностью. Замените conditional complexity на полиморфизм и добавьте категорию "Conjured" без нарушения контрактов.',
    instructionsMarkdown: `# Gilded Rose Refactoring Kata

## Легенда
Добро пожаловать в команду трактира Gilded Rose! Все товары имеют свойство \`sellIn\` (срок реализации) и \`quality\` (качество).
Метод \`updateQuality()\` ежедневно обновляет показатели всех товаров.

## Правила системы:
* В конце каждого дня оба значения снижаются.
* После истечения срока годности качество падает в 2 раза быстрее.
* Качество никогда не может быть отрицательным и не превышает 50 (кроме легендарного \`Sulfuras\`, качество которого всегда 80).
* \`Aged Brie\` увеличивает качество со временем.
* \`Backstage passes\` увеличивают качество на 2, если осталось $\le 10$ дней, на 3, если $\le 5$ дней, и обнуляется после концерта.

## Новая задача:
Добавить новый тип товара: **"Conjured"** (Магические предметы теряют качество в два раза быстрее обычных товаров).

## Архитектурные ограничения:
1. Запрещено менять структуру класса \`Item\` (он принадлежит злому гоблину в углу).
2. Замените запутанный клубок \`if/else\` на чистый полиморфизм (Strategy / Factory).
3. Проверьте сохранность поведения через Golden Master Snapshot.`,
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
    Item[] items;

    public GildedRose(Item[] items) {
        this.items = items;
    }

    public void updateQuality() {
        for (int i = 0; i < items.length; i++) {
            if (!items[i].name.equals("Aged Brie")
                    && !items[i].name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                if (items[i].quality > 0) {
                    if (!items[i].name.equals("Sulfuras, Hand of Ragnaros")) {
                        items[i].quality = items[i].quality - 1;
                    }
                }
            } else {
                if (items[i].quality < 50) {
                    items[i].quality = items[i].quality + 1;

                    if (items[i].name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                        if (items[i].sellIn < 11) {
                            if (items[i].quality < 50) {
                                items[i].quality = items[i].quality + 1;
                            }
                        }

                        if (items[i].sellIn < 6) {
                            if (items[i].quality < 50) {
                                items[i].quality = items[i].quality + 1;
                            }
                        }
                    }
                }
            }

            if (!items[i].name.equals("Sulfuras, Hand of Ragnaros")) {
                items[i].sellIn = items[i].sellIn - 1;
            }

            if (items[i].sellIn < 0) {
                if (!items[i].name.equals("Aged Brie")) {
                    if (!items[i].name.equals("Backstage passes to a TAFKAL80ETC concert")) {
                        if (items[i].quality > 0) {
                            if (!items[i].name.equals("Sulfuras, Hand of Ragnaros")) {
                                items[i].quality = items[i].quality - 1;
                            }
                        }
                    } else {
                        items[i].quality = items[i].quality - items[i].quality;
                    }
                } else {
                    if (items[i].quality < 50) {
                        items[i].quality = items[i].quality + 1;
                    }
                }
            }
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    goldenMasterConfig: {
      enabled: true,
      approvedSnapshotPath: '.approved.txt',
      receivedSnapshotPath: '.received.txt',
      snapshotGeneratorClass: 'GildedRoseTest',
      simulatedIterations: 30,
      ignoreLineEndings: true,
      sampleBaselineText: `Day 0:
+5 Dexterity Vest, 10, 20
Aged Brie, 2, 0
Elixir of the Mongoose, 5, 7
Sulfuras, Hand of Ragnaros, 0, 80
Backstage passes to a TAFKAL80ETC concert, 15, 20

Day 1:
+5 Dexterity Vest, 9, 19
Aged Brie, 1, 1
Elixir of the Mongoose, 4, 6
Sulfuras, Hand of Ragnaros, 0, 80
Backstage passes to a TAFKAL80ETC concert, 14, 21`
    },
    allowedPublicSignatureChanges: 0,
    scoringWeights: {
      functionalCorrectness: 0.40,
      concurrencySafety: 0.00,
      architectureAndCleanCode: 0.45,
      modernIdioms: 0.15
    }
  },

  // 3. Trip Service Legacy Kata (Seams: Subclass and Override)
  {
    id: 'kata_trip_service',
    slug: 'trip-service-legacy-seams',
    title: 'Trip Service Legacy Decoupling Kata',
    category: 'refactoring_kata',
    badge: '🔬 Seam Pattern Kata',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Unit Testing, Seam Technique (Subclass and Override)',
    timeLimitMinutes: 45,
    shortDescription: 'Изолируйте статические зависимости базы данных и HTTP-сессии (UserSession, TripDAO) без изменения публичного API с помощью техники архитектурных швов (Seams).',
    instructionsMarkdown: `# Trip Service Legacy Decoupling Kata (Sandro Mancuso)

## Проблема
Класс \`TripService\` жестко привязан к статическим синглтонам \`UserSession.getInstance().getLoggedUser()\` и \`TripDAO.findTripsByUser(user)\`. Попытка запустить модульный тест вызывает \`CollaboratorCallException\`, так как тестовое окружение не имеет доступа к БД и веб-сессиям.

## Задача:
1. Покрыть метод \`getTripsByUser(User user)\` модульными тестами.
2. **Правило швов (Seam Technique):** Запрещено использовать PowerMock или рефлексию. Выделите приватные обращения к статическим методам в защищенные (\`protected\`) методы в \`TripService\`.
3. Создайте тестовый подкласс \`TestableTripService\` в тестах, переопределяющий эти швы.
4. Проведите полный рефакторинг \`TripService\` на внедрение зависимостей через конструктор (Dependency Injection), сохранив конструктор по умолчанию для обратной совместимости.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/tripservice/User.java',
        content: `package com.assessment.tripservice;

import java.util.ArrayList;
import java.util.List;

public class User {
    private final List<Trip> trips = new ArrayList<>();
    private final List<User> friends = new ArrayList<>();

    public List<User> getFriends() { return friends; }
    public void addFriend(User user) { friends.add(user); }
    public List<Trip> trips() { return trips; }
    public void addTrip(Trip trip) { trips.add(trip); }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/tripservice/Trip.java',
        content: `package com.assessment.tripservice;

public record Trip(String destination) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/tripservice/TripService.java',
        content: `package com.assessment.tripservice;

import java.util.ArrayList;
import java.util.List;

public class TripService {

    public List<Trip> getTripsByUser(User user) throws UserNotLoggedInException {
        List<Trip> tripList = new ArrayList<>();
        User loggedUser = UserSession.getInstance().getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) {
                    isFriend = true;
                    break;
                }
            }
            if (isFriend) {
                tripList = TripDAO.findTripsByUser(user);
            }
            return tripList;
        } else {
            throw new UserNotLoggedInException();
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    enforceSeamValidation: true,
    allowedPublicSignatureChanges: 0,
    scoringWeights: {
      functionalCorrectness: 0.40,
      concurrencySafety: 0.00,
      architectureAndCleanCode: 0.45,
      modernIdioms: 0.15
    }
  },

  // 4. Virtual Thread Carrier Pinning & JMM Concurrency Lab
  {
    id: 'lab_virtual_threads_pinning',
    slug: 'virtual-threads-carrier-pinning',
    title: 'Virtual Thread Carrier Pinning & JMM Lab',
    category: 'concurrency_lab',
    badge: '🧵 Concurrency Lab',
    difficulty: 'Lead',
    targetStack: 'Java 21 LTS, Project Loom, JMM Memory Safety, Lock-Free Primitives',
    timeLimitMinutes: 45,
    shortDescription: 'Устраните блокировку системных несущих потоков (Carrier Thread Pinning) и гонки данных в высоконагруженном транзакционном сервисе на Java 21.',
    instructionsMarkdown: `# Virtual Thread Carrier Pinning & JMM Concurrency Lab

## Описание дефекта
Сервис \`PaymentAuditService\` обрабатывает транзакции с использованием виртуальных потоков Java 21 (\`Executors.newVirtualThreadPerTaskExecutor()\`). 
Однако при нагрузке 500 rps задержка p99 подскочила с 5 мс до 4500 мс, а системный пул ForkJoinPool перестал отвечать.

## Причина сбоя:
1. Метод \`processPayment\` содержит блок \`synchronized (this)\`, внутри которого вызывается блокирующий HTTP-запрос аудита. Это намертво привязывает (pins) виртуальный поток к ОС-потоку carrier.
2. Поле \`totalVolume\` инкрементируется через \`totalVolume += amount\` без атомарности и \`volatile\`, что приводит к потере финансового баланса.

## Ваша задача:
1. Заменить \`synchronized\` на \`ReentrantLock\` для защиты только критической секции памяти (исключив блокирующий I/O из-под лок).
2. Заменить примитивные поля на \`DoubleAdder\` или \`AtomicReference\` для потокобезопасного учета.
3. Обеспечить корректную работу при 1000 одновременных вызовов.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/concurrency/PaymentAuditService.java',
        content: `package com.assessment.concurrency;

import java.util.concurrent.locks.ReentrantLock;

public class PaymentAuditService {
    private double totalVolume = 0.0;
    private long transactionCount = 0;

    public void processPayment(String transactionId, double amount) {
        // DEFECT: Synchronized block wrapping blocking remote call (Carrier Pinning)
        synchronized (this) {
            simulateRemoteAuditHttpCall(transactionId);
            this.totalVolume += amount;
            this.transactionCount++;
        }
    }

    private void simulateRemoteAuditHttpCall(String txId) {
        try {
            Thread.sleep(20); // Simulates 20ms network latency
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public double getTotalVolume() { return totalVolume; }
    public long getTransactionCount() { return transactionCount; }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    concurrencyConfig: {
      enabled: true,
      useVirtualThreads: true,
      concurrentThreadCount: 1000,
      executionTimeoutMs: 2500,
      detectCarrierThreadPinning: true,
      detectThreadLeaks: true,
      stressLoopCount: 50000
    },
    idiomRequirements: {
      disallowSynchronizedKeyword: true
    },
    scoringWeights: {
      functionalCorrectness: 0.30,
      concurrencySafety: 0.45,
      architectureAndCleanCode: 0.15,
      modernIdioms: 0.10
    }
  },

  // 5. Flash Sale Deal Engine & Inventory Lock (Machine Coding / LLD)
  {
    id: 'mc_flash_sale_engine',
    slug: 'flash-sale-deal-engine',
    title: 'Flash Sale Engine & Inventory Reservation',
    category: 'machine_coding',
    badge: '💳 FinTech & E-Commerce',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, State Pattern, Optimistic Locks, TTL Expiry Sweeps',
    timeLimitMinutes: 60,
    shortDescription: 'Спроектируйте движок мгновенных распродаж (Flash Deals): резервирование остатков с защитой от овербукинга, валидация временного окна и автоматический возврат невыкупленных броней.',
    instructionsMarkdown: `# Flash Sale Deal Engine & Inventory Reservation (LLD)

## Бизнес-требования:
1. Создание сделки (\`createDeal\`): товар, начальное количество, скидочная цена, время старта и окончания.
2. Заявка на покупку (\`claimDeal\`): пользователь может зарезервировать только 1 шт товара. Если остаток 0 или сделка не активна — отклонить.
3. Потокобезопасность: При одновременном обращении 5000 покупателей на 50 доступных единиц товара овербукинг строго запрещен (ровно 50 успешных заявок).
4. Резервация действует 10 минут. Если заказ не оплачен, остаток возвращается в общий пул.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/flashsale/contract/FlashSaleService.java',
        content: `package com.assessment.flashsale.contract;

public interface FlashSaleService {
    boolean createDeal(String dealId, String productId, int totalStock, long durationSeconds);
    boolean claimDeal(String dealId, String userId);
    int getAvailableStock(String dealId);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/flashsale/service/FlashSaleServiceImpl.java',
        content: `package com.assessment.flashsale.service;

import com.assessment.flashsale.contract.FlashSaleService;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

public class FlashSaleServiceImpl implements FlashSaleService {
    private final ConcurrentMap<String, AtomicInteger> stockMap = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ConcurrentHashMap<String, Boolean>> userClaims = new ConcurrentHashMap<>();

    @Override
    public boolean createDeal(String dealId, String productId, int totalStock, long durationSeconds) {
        stockMap.put(dealId, new AtomicInteger(totalStock));
        userClaims.put(dealId, new ConcurrentHashMap<>());
        return true;
    }

    @Override
    public boolean claimDeal(String dealId, String userId) {
        // TODO: Implement atomic claim with user deduplication and no overselling
        AtomicInteger stock = stockMap.get(dealId);
        if (stock == null) return false;
        
        ConcurrentHashMap<String, Boolean> claims = userClaims.get(dealId);
        if (claims.putIfAbsent(userId, Boolean.TRUE) != null) {
            return false; // User already claimed
        }

        int remaining = stock.decrementAndGet();
        if (remaining < 0) {
            stock.incrementAndGet(); // rollback
            claims.remove(userId);
            return false;
        }
        return true;
    }

    @Override
    public int getAvailableStock(String dealId) {
        AtomicInteger stock = stockMap.get(dealId);
        return stock != null ? Math.max(0, stock.get()) : 0;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/flashsale/FlashSaleServiceTest.java',
        content: `package com.assessment.flashsale;

import com.assessment.flashsale.service.FlashSaleServiceImpl;

public class FlashSaleServiceTest {
    public void testClaimDeal() {
        FlashSaleServiceImpl service = new FlashSaleServiceImpl();
        service.createDeal("deal-1", "prod-1", 5, 3600);
        if (!service.claimDeal("deal-1", "user-1")) {
            throw new AssertionError("First claim should succeed");
        }
        if (service.claimDeal("deal-1", "user-1")) {
            throw new AssertionError("Duplicate claim by same user should fail");
        }
        if (service.getAvailableStock("deal-1") != 4) {
            throw new AssertionError("Stock should be 4");
        }
    }

    public void testConcurrentClaimStress() {
        FlashSaleServiceImpl service = new FlashSaleServiceImpl();
        service.createDeal("deal-stress", "prod-s", 1000, 3600);
        service.claimDeal("deal-stress", "u-" + Thread.currentThread().getId());
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    concurrencyConfig: {
      enabled: true,
      useVirtualThreads: true,
      concurrentThreadCount: 500,
      executionTimeoutMs: 3000,
      detectCarrierThreadPinning: true,
      detectThreadLeaks: true,
      stressLoopCount: 20000
    },
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.30,
      architectureAndCleanCode: 0.25,
      modernIdioms: 0.10
    }
  },

  // 6. Splitwise Expense Sharing System (Machine Coding / LLD)
  {
    id: 'mc_splitwise_system',
    slug: 'splitwise-expense-sharing',
    title: 'Splitwise (Expense Sharing & Debt Simplification)',
    category: 'machine_coding',
    badge: '👥 LLD Domain Modeling',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Strategy Pattern, Graph Simplification, BigDecimal',
    timeLimitMinutes: 75,
    shortDescription: 'Спроектируйте систему совместного учета расходов (Equal, Exact, Percentage splits) с алгоритмом упрощения графа взаимных долгов и защитой от ошибок округления.',
    instructionsMarkdown: `# Splitwise Expense Sharing System (LLD)

## Требования:
1. Поддержка трех стратегий разделения расходов (\`SplitStrategy\`):
   - **EQUAL:** сумма делится поровну между всеми участниками.
   - **EXACT:** каждый платит точную сумму (сумма долей обязана совпадать с общим чеком).
   - **PERCENT:** доли в процентах (сумма процентов обязана быть ровно 100.0%).
2. **Точность вычислений:** Исключить ошибки округления с плавающей точкой с помощью \`BigDecimal\` (\`RoundingMode.HALF_UP\`).
3. **Упрощение взаимозадолженностей (Debt Simplification):** Свернуть циклические долги (если А должен Б $10, а Б должен В $10, то А должен напрямую В $10).`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/splitwise/contract/SplitStrategy.java',
        content: `package com.assessment.splitwise.contract;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface SplitStrategy {
    Map<String, BigDecimal> calculateSplits(BigDecimal totalAmount, List<String> userIds, Map<String, Object> params);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/splitwise/service/EqualSplitStrategy.java',
        content: `package com.assessment.splitwise.service;

import com.assessment.splitwise.contract.SplitStrategy;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class EqualSplitStrategy implements SplitStrategy {
    @Override
    public Map<String, BigDecimal> calculateSplits(BigDecimal totalAmount, List<String> userIds, Map<String, Object> params) {
        Map<String, BigDecimal> result = new HashMap<>();
        if (userIds.isEmpty()) return result;

        BigDecimal count = BigDecimal.valueOf(userIds.size());
        BigDecimal share = totalAmount.divide(count, 2, RoundingMode.HALF_UP);
        
        for (String user : userIds) {
            result.put(user, share);
        }
        return result;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/splitwise/SplitwiseTest.java',
        content: `package com.assessment.splitwise;

import com.assessment.splitwise.service.EqualSplitStrategy;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class SplitwiseTest {
    public void testEqualSplit() {
        EqualSplitStrategy strategy = new EqualSplitStrategy();
        Map<String, BigDecimal> splits = strategy.calculateSplits(
            new BigDecimal("100.00"),
            List.of("Alice", "Bob", "Charlie", "David"),
            Map.of()
        );
        if (splits.size() != 4) throw new AssertionError("Expected 4 splits");
        if (splits.get("Alice").compareTo(new BigDecimal("25.00")) != 0) {
            throw new AssertionError("Expected 25.00 for Alice");
        }
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.40,
      concurrencySafety: 0.10,
      architectureAndCleanCode: 0.35,
      modernIdioms: 0.15
    }
  },

  // 7. Modern Java 21 Idioms Lab (Pattern Matching, Sealed Classes, Sequenced Collections)
  {
    id: 'lab_java21_modern_idioms',
    slug: 'java21-modern-idioms-lab',
    title: 'Modern Java 21 Idioms Lab',
    category: 'java21_idioms',
    badge: '✨ Java 21 Modernization',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Sealed Interfaces, Record Patterns, Sequenced Collections',
    timeLimitMinutes: 30,
    shortDescription: 'Рефакторинг устаревшего императивного кода Java 8 на современные конструкции Java 21: исчерпывающий switch по sealed-иерархиям, деконструкция Record Patterns и методы SequencedCollection.',
    instructionsMarkdown: `# Modern Java 21 Idioms Lab

## Задача:
Замените устаревший спагетти-код с ручным приведением типов \`(Order) obj\`, проверками \`instanceof\` и громоздкими классами данных на чистые идиомы Java 21:
1. Замените POJO-классы событий на **Java Records**.
2. Создайте запечатанный интерфейс \`sealed interface PaymentEvent permits ...\`.
3. Реализуйте исчерпывающее сопоставление с шаблоном (**Pattern Matching in switch**) с деконструкцией записей (\`case CardPayment(var cardNo, var amount)\`).
4. Используйте \`SequencedCollection\` (\`getFirst()\`, \`getLast()\`) вместо громоздкого \`list.get(list.size() - 1)\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/idioms/EventProcessor.java',
        content: `package com.assessment.idioms;

import java.util.List;

public class EventProcessor {

    // TODO: Refactor using Sealed Interfaces and Record Patterns
    public String formatPaymentReceipt(Object event) {
        if (event instanceof CardEvent) {
            CardEvent ce = (CardEvent) event;
            return "Card: " + ce.getCardNumber() + ", Amount: " + ce.getAmount();
        } else if (event instanceof CryptoEvent) {
            CryptoEvent cye = (CryptoEvent) event;
            return "Crypto: " + cye.getWallet() + ", Coin: " + cye.getCoin();
        }
        return "Unknown payment";
    }

    public static class CardEvent {
        private final String cardNumber;
        private final double amount;
        public CardEvent(String cardNumber, double amount) { this.cardNumber = cardNumber; this.amount = amount; }
        public String getCardNumber() { return cardNumber; }
        public double getAmount() { return amount; }
    }

    public static class CryptoEvent {
        private final String wallet;
        private final String coin;
        public CryptoEvent(String wallet, String coin) { this.wallet = wallet; this.coin = coin; }
        public String getWallet() { return wallet; }
        public String getCoin() { return coin; }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    idiomRequirements: {
      requireRecords: true,
      requireSealedClasses: true,
      requirePatternMatching: true
    },
    scoringWeights: {
      functionalCorrectness: 0.30,
      concurrencySafety: 0.00,
      architectureAndCleanCode: 0.30,
      modernIdioms: 0.40
    }
  }
];

import { ADDITIONAL_LLD_CHALLENGES } from './additionalChallenges';

export const SEEDED_CHALLENGES: CodingChallenge[] = [
  ...BASE_CHALLENGES,
  ...ADDITIONAL_LLD_CHALLENGES
];
