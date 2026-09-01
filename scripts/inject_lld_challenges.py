#!/usr/bin/env python3
"""
inject_lld_challenges.py - Ingests 35 SOTA LLD & Machine Coding challenges
with FULL multi-file scaffolding (Domain Records, Service Class, JUnit 5 Tests)
into json/machine_coding_challenges.json and SQLite database.
"""

import json
import os
import sqlite3
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE_DIR, "json")
DB_PATH = os.path.join(BASE_DIR, "backend", "interview_prep.db")

CHALLENGE_SPECS = [
    # 1. Notification Filter
    {
        "id": "lld-notification-filter",
        "slug": "notification-filtering-deduplication",
        "title": "Notification Filtering & 24h Deduplication Engine (Яндекс / BigTech)",
        "track": "lld_bigtech",
        "difficulty": "senior",
        "category": "machine_coding",
        "scenarioMarkdown": """# Notification Filtering & Deduplication Engine (Яндекс)

## 🏢 Бизнес-контекст & ТЗ от Product Owner'a
Компания предоставляет сервис массовой рассылки уведомлений для партнеров.
Необходимо реализовать ядро фильтрации входящего потока уведомлений для клиентов по каналам **EMAIL, SMS, PUSH** с учетом персональных настроек и 24-часовой дедупликации.

### 📋 User Stories & Функциональные требования:
1. **Черный список отправителей:** Блокировать любые уведомления от отправителей из `UserPreferences.blockedSenders()`.
2. **Разрешенные каналы и типы:** Пропускать только уведомления с `Channel` и `NotificationType`, включенными в настройках получателя.
3. **Скользящая 24h дедупликация:** Блокировать повторные уведомления с идентичным `contentHash` и `type` для одного пользователя в течение 24 часов.
4. **In-Batch дедупликация:** Если в одном пакете поступили дубликаты, пропускать только первое вхождение.

### 🛡️ Нефункциональные требования (SOTA 2026):
- **Детерминированное время:** Вся работа со временем осуществляется строго через внедряемый `java.time.Clock` (запрет прямого `Instant.now()`).
- **Защита от утечек памяти (OOM):** Реализовать автоматическую очистку записей дедупликатора старше 24 часов.
- **Архитектурный принцип Open-Closed (OCP):** Фильтры должны быть изолированными классами в цепочке `NotificationFilter` (Chain of Responsibility / Specification).""",
        "techStack": "Java 21 LTS, Records, Clock, ConcurrentHashMap",
        "architecturePattern": "Chain of Responsibility / Specification / Immutable Domain",
        "timeLimitMinutes": 45,
        "astRules": ["enforce-clock-injection", "no-system-current-time", "safe-collection-usage"],
        "hints": [
            "Используйте Clock.instant() вместо Instant.now(), чтобы тесты могли мгновенно сдвигать виртуальное время.",
            "Для дедупликации составьте ключ из userId + type + contentHash.",
            "Не забудьте проверять дубликаты внутри одного входящего батча через локальный Set."
        ],
        "packageName": "com.company.notification",
        "serviceName": "NotificationFilterService",
        "files": [
            {
                "path": "src/main/java/com/company/notification/model/Channel.java",
                "content": "package com.company.notification.model;\n\npublic enum Channel {\n    EMAIL,\n    SMS,\n    PUSH\n}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/notification/model/NotificationType.java",
                "content": "package com.company.notification.model;\n\npublic enum NotificationType {\n    SECURITY,\n    PROMO,\n    TRANSACTION\n}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/notification/model/Notification.java",
                "content": "package com.company.notification.model;\n\nimport java.time.Instant;\n\npublic record Notification(\n    String id,\n    String userId,\n    String senderId,\n    Channel channel,\n    NotificationType type,\n    String contentHash,\n    Instant timestamp\n) {}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/notification/model/UserPreferences.java",
                "content": "package com.company.notification.model;\n\nimport java.util.Set;\n\npublic record UserPreferences(\n    String userId,\n    Set<Channel> enabledChannels,\n    Set<NotificationType> enabledTypes,\n    Set<String> blockedSenders\n) {}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/notification/service/NotificationFilterService.java",
                "content": "package com.company.notification.service;\n\nimport com.company.notification.model.*;\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.util.*;\nimport java.util.concurrent.ConcurrentHashMap;\n\npublic class NotificationFilterService {\n    private final Clock clock;\n    private final Duration dedupWindow = Duration.ofHours(24);\n    private final Map<String, Instant> sentHistory = new ConcurrentHashMap<>();\n\n    public NotificationFilterService(Clock clock) {\n        this.clock = Objects.requireNonNull(clock);\n    }\n\n    public List<Notification> filterNotifications(\n        List<Notification> notifications,\n        Map<String, UserPreferences> preferencesMap\n    ) {\n        // TODO: Реализуйте цепочку фильтрации и дедупликацию за 24h через clock\n        return List.of();\n    }\n}\n",
                "readOnly": False,
                "hidden": False,
                "isMainEntryPoint": True
            },
            {
                "path": "src/test/java/com/company/notification/NotificationFilterServiceTest.java",
                "content": "package com.company.notification;\n\nimport com.company.notification.model.*;\nimport com.company.notification.service.NotificationFilterService;\nimport org.junit.jupiter.api.BeforeEach;\nimport org.junit.jupiter.api.Test;\n\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.time.ZoneId;\nimport java.util.List;\nimport java.util.Map;\nimport java.util.Set;\n\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class NotificationFilterServiceTest {\n    private Instant baseTime;\n    private Clock clock;\n    private NotificationFilterService service;\n\n    @BeforeEach\n    void setUp() {\n        baseTime = Instant.parse(\"2026-09-01T12:00:00Z\");\n        clock = Clock.fixed(baseTime, ZoneId.of(\"UTC\"));\n        service = new NotificationFilterService(clock);\n    }\n\n    @Test\n    void testBlocksBlacklistedSender() {\n        var prefs = new UserPreferences(\"u1\", Set.of(Channel.EMAIL), Set.of(NotificationType.PROMO), Set.of(\"spammer\"));\n        var notif = new Notification(\"n1\", \"u1\", \"spammer\", Channel.EMAIL, NotificationType.PROMO, \"hash1\", baseTime);\n        var result = service.filterNotifications(List.of(notif), Map.of(\"u1\", prefs));\n        assertThat(result).isEmpty();\n    }\n\n    @Test\n    void testDeduplicatesWithin24Hours() {\n        var prefs = new UserPreferences(\"u1\", Set.of(Channel.EMAIL), Set.of(NotificationType.TRANSACTION), Set.of());\n        var notif1 = new Notification(\"n1\", \"u1\", \"bank\", Channel.EMAIL, NotificationType.TRANSACTION, \"hash1\", baseTime);\n        var notif2 = new Notification(\"n2\", \"u1\", \"bank\", Channel.EMAIL, NotificationType.TRANSACTION, \"hash1\", baseTime.plus(Duration.ofHours(2)));\n\n        var batch1 = service.filterNotifications(List.of(notif1), Map.of(\"u1\", prefs));\n        assertThat(batch1).hasSize(1);\n\n        var batch2 = service.filterNotifications(List.of(notif2), Map.of(\"u1\", prefs));\n        assertThat(batch2).isEmpty();\n    }\n}\n",
                "readOnly": True,
                "hidden": False
            }
        ]
    },

    # 2. In-Memory Rate Limiter
    {
        "id": "lld-rate-limiter",
        "slug": "in-memory-rate-limiter",
        "title": "In-Memory Rate Limiter: Token Bucket & Sliding Window (Т-Банк / Озон)",
        "track": "lld_bigtech",
        "difficulty": "senior",
        "category": "machine_coding",
        "scenarioMarkdown": """# In-Memory Rate Limiter (Т-Банк / Озон)

## 🏢 Бизнес-контекст & ТЗ от Product Owner'a
Разработайте высокопроизводительный потокобезопасный компонент ограничения частоты запросов (Rate Limiter) для защиты API шлюза от DDoS и перегрузок.

### 📋 Требования:
1. **Алгоритм Token Bucket:** Каждый клиент имеет лимит $C$ токенов, пополняемых со скоростью $R$ токенов/сек.
2. **Алгоритм Sliding Window Counter:** Ограничение не более $N$ запросов в скользящем окне $W$ секунд.
3. **Потокобезопасность:** Без глобального `synchronized`, блокирующего всех клиентов одновременно (`ConcurrentHashMap` + `AtomicReference` / `ReentrantLock` на уровне клиента).
4. **Тестируемость:** Детерминированное время через `java.time.Clock`.""",
        "techStack": "Java 21, Concurrency, Token Bucket, Sliding Window, Clock",
        "architecturePattern": "Strategy / Concurrent State Machine",
        "timeLimitMinutes": 45,
        "astRules": ["enforce-clock-injection", "carrier-thread-pinning"],
        "hints": ["Используйте computeIfAbsent для инициализации состояния клиента.", "Применяйте Clock для вычисления дельты времени без Thread.sleep."],
        "packageName": "com.company.ratelimiter",
        "serviceName": "RateLimiterService",
        "files": [
            {
                "path": "src/main/java/com/company/ratelimiter/model/RateLimitConfig.java",
                "content": "package com.company.ratelimiter.model;\n\nimport java.time.Duration;\n\npublic record RateLimitConfig(\n    int maxTokens,\n    double refillTokensPerSecond,\n    Duration windowSize\n) {}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/ratelimiter/service/RateLimiterService.java",
                "content": "package com.company.ratelimiter.service;\n\nimport com.company.ratelimiter.model.RateLimitConfig;\nimport java.time.Clock;\nimport java.time.Instant;\nimport java.util.Objects;\nimport java.util.concurrent.ConcurrentHashMap;\n\npublic class RateLimiterService {\n    private final Clock clock;\n    private final ConcurrentHashMap<String, Object> clientStateMap = new ConcurrentHashMap<>();\n\n    public RateLimiterService(Clock clock) {\n        this.clock = Objects.requireNonNull(clock);\n    }\n\n    public boolean tryAcquire(String clientId, RateLimitConfig config) {\n        // TODO: Реализуйте Token Bucket или Sliding Window с вычислением дельты через clock.instant()\n        return true;\n    }\n}\n",
                "readOnly": False,
                "hidden": False,
                "isMainEntryPoint": True
            },
            {
                "path": "src/test/java/com/company/ratelimiter/RateLimiterServiceTest.java",
                "content": "package com.company.ratelimiter;\n\nimport com.company.ratelimiter.model.RateLimitConfig;\nimport com.company.ratelimiter.service.RateLimiterService;\nimport org.junit.jupiter.api.BeforeEach;\nimport org.junit.jupiter.api.Test;\n\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.time.ZoneId;\n\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class RateLimiterServiceTest {\n    private Instant now;\n    private Clock clock;\n    private RateLimiterService rateLimiter;\n\n    @BeforeEach\n    void setUp() {\n        now = Instant.parse(\"2026-09-01T12:00:00Z\");\n        clock = Clock.fixed(now, ZoneId.of(\"UTC\"));\n        rateLimiter = new RateLimiterService(clock);\n    }\n\n    @Test\n    void testAllowsWithinCapacity() {\n        var config = new RateLimitConfig(2, 1.0, Duration.ofSeconds(1));\n        assertThat(rateLimiter.tryAcquire(\"client1\", config)).isTrue();\n        assertThat(rateLimiter.tryAcquire(\"client1\", config)).isTrue();\n    }\n}\n",
                "readOnly": True,
                "hidden": False
            }
        ]
    },

    # 3. In-Memory Key-Value Cache
    {
        "id": "lld-key-value-cache-ttl",
        "slug": "in-memory-cache-ttl-lru",
        "title": "In-Memory Cache с TTL и LRU/LFU Eviction (Авито / BigTech)",
        "track": "lld_bigtech",
        "difficulty": "senior",
        "category": "machine_coding",
        "scenarioMarkdown": """# In-Memory Cache с TTL и политиками вытеснения (Авито)

## 🏢 Бизнес-контекст & ТЗ
Реализуйте локальный кэш `Cache<K, V>` с поддержкой максимального размера (Capacity), срока жизни ключей (Time-to-Live) и стратегий вытеснения (LRU / LFU).

### 📋 Требования:
1. `put(K key, V value, Duration ttl)` и `get(K key)` со сложностью $O(1)$.
2. При превышении Capacity автоматически вытеснять наименее используемый элемент (LRU).
3. Автоматическая очистка протухших по TTL элементов.
4. Потокобезопасность (`ReadWriteLock` или `ConcurrentHashMap` + двусвязный список).""",
        "techStack": "Java 21, DoublyLinkedList, ConcurrentHashMap, TTL",
        "architecturePattern": "Strategy / Decorator / LRU Doubly Linked List",
        "timeLimitMinutes": 45,
        "astRules": ["enforce-clock-injection", "safe-collection-usage"],
        "hints": ["Используйте двусвязный список для O(1) перемещения элементов в голову LRU."],
        "packageName": "com.company.cache",
        "serviceName": "InMemoryCacheService",
        "files": [
            {
                "path": "src/main/java/com/company/cache/model/CacheEntry.java",
                "content": "package com.company.cache.model;\n\nimport java.time.Instant;\n\npublic record CacheEntry<V>(V value, Instant expiresAt) {}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/cache/service/InMemoryCacheService.java",
                "content": "package com.company.cache.service;\n\nimport com.company.cache.model.CacheEntry;\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.util.Objects;\nimport java.util.Optional;\nimport java.util.concurrent.ConcurrentHashMap;\n\npublic class InMemoryCacheService<K, V> {\n    private final int capacity;\n    private final Clock clock;\n\n    public InMemoryCacheService(int capacity, Clock clock) {\n        this.capacity = capacity;\n        this.clock = Objects.requireNonNull(clock);\n    }\n\n    public void put(K key, V value, Duration ttl) {\n        // TODO: Реализуйте O(1) добавление с LRU вытеснением и TTL\n    }\n\n    public Optional<V> get(K key) {\n        // TODO: Реализуйте O(1) получение с проверкой TTL\n        return Optional.empty();\n    }\n}\n",
                "readOnly": False,
                "hidden": False,
                "isMainEntryPoint": True
            },
            {
                "path": "src/test/java/com/company/cache/InMemoryCacheServiceTest.java",
                "content": "package com.company.cache;\n\nimport com.company.cache.model.CacheEntry;\nimport com.company.cache.service.InMemoryCacheService;\nimport org.junit.jupiter.api.BeforeEach;\nimport org.junit.jupiter.api.Test;\n\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.time.ZoneId;\n\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class InMemoryCacheServiceTest {\n    private Instant baseTime;\n    private Clock clock;\n    private InMemoryCacheService<String, String> cache;\n\n    @BeforeEach\n    void setUp() {\n        baseTime = Instant.parse(\"2026-09-01T12:00:00Z\");\n        clock = Clock.fixed(baseTime, ZoneId.of(\"UTC\"));\n        cache = new InMemoryCacheService<>(2, clock);\n    }\n\n    @Test\n    void testPutAndGet() {\n        cache.put(\"k1\", \"v1\", Duration.ofMinutes(5));\n        assertThat(cache.get(\"k1\")).contains(\"v1\");\n    }\n}\n",
                "readOnly": True,
                "hidden": False
            }
        ]
    },


    # 16. Double-Entry Accounting Ledger
    {
        "id": "lld-double-entry-ledger",
        "slug": "double-entry-accounting-ledger",
        "title": "Double-Entry Accounting Ledger с защитой от дедлоков (Т-Банк / Stripe)",
        "track": "lld_fintech",
        "difficulty": "senior",
        "category": "machine_coding",
        "scenarioMarkdown": """# Double-Entry Accounting Ledger (Т-Банк / Stripe)

## 🏢 Бизнес-контекст & ТЗ
Реализуйте бухгалтерскую книгу двойной записи (Double-Entry Bookkeeping):
1. **Атомарные переводы:** Перевод средств между счетами $A \to B$ с дебетом и кредитом.
2. **Исключение дедлоков (Deadlock-Free):** При одновременных встречных переводах $A \to B$ и $B \to A$ гарантировать отсутствие дедлоков за счёт упорядочивания захвата блокировок по `AccountId`.
3. **Финансовая точность:** Использование `BigDecimal` со `Scale = 4` и округлением `HALF_EVEN` (Banker's rounding). Полный запрет `double`/`float`.""",
        "techStack": "Java 21, BigDecimal, ReentrantLock Ordered Locking, Atomic Ledger",
        "architecturePattern": "Double-Entry Bookkeeping / Ordered Lock Acquisition",
        "timeLimitMinutes": 45,
        "astRules": ["no-double-in-money", "lock-ordering-in-transfers"],
        "hints": ["Всегда захватывайте локи в порядке возрастания accountId: lock(min(id1, id2)) -> lock(max(id1, id2))."],
        "packageName": "com.company.ledger",
        "serviceName": "AccountingLedgerService",
        "files": [
            {
                "path": "src/main/java/com/company/ledger/model/Account.java",
                "content": "package com.company.ledger.model;\n\nimport java.math.BigDecimal;\nimport java.util.concurrent.locks.ReentrantLock;\n\npublic class Account {\n    private final String id;\n    private BigDecimal balance;\n    private final ReentrantLock lock = new ReentrantLock();\n\n    public Account(String id, BigDecimal initialBalance) {\n        this.id = id;\n        this.balance = initialBalance;\n    }\n\n    public String id() { return id; }\n    public BigDecimal balance() { return balance; }\n    public void setBalance(BigDecimal b) { this.balance = b; }\n    public ReentrantLock lock() { return lock; }\n}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/ledger/service/AccountingLedgerService.java",
                "content": "package com.company.ledger.service;\n\nimport com.company.ledger.model.Account;\nimport java.math.BigDecimal;\nimport java.math.RoundingMode;\nimport java.util.Objects;\n\npublic class AccountingLedgerService {\n    public void transfer(Account from, Account to, BigDecimal amount) {\n        Objects.requireNonNull(from);\n        Objects.requireNonNull(to);\n        Objects.requireNonNull(amount);\n\n        if (amount.compareTo(BigDecimal.ZERO) <= 0) {\n            throw new IllegalArgumentException(\"Amount must be positive\");\n        }\n\n        // TODO: Захватите блокировки в порядке from.id().compareTo(to.id()) для исключения дедлоков\n    }\n}\n",
                "readOnly": False,
                "hidden": False,
                "isMainEntryPoint": True
            },
            {
                "path": "src/test/java/com/company/ledger/AccountingLedgerServiceTest.java",
                "content": "package com.company.ledger;\n\nimport com.company.ledger.model.Account;\nimport com.company.ledger.service.AccountingLedgerService;\nimport org.junit.jupiter.api.Test;\n\nimport java.math.BigDecimal;\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class AccountingLedgerServiceTest {\n    @Test\n    void testAtomicTransfer() {\n        var service = new AccountingLedgerService();\n        var accA = new Account(\"A\", new BigDecimal(\"1000.00\"));\n        var accB = new Account(\"B\", new BigDecimal(\"500.00\"));\n\n        service.transfer(accA, accB, new BigDecimal(\"200.00\"));\n        assertThat(accA.balance()).isEqualByComparingTo(\"800.00\");\n        assertThat(accB.balance()).isEqualByComparingTo(\"700.00\");\n    }\n}\n",
                "readOnly": True,
                "hidden": False
            }
        ]
    },

    # 26. Multi-threaded Elevator Dispatcher
    {
        "id": "lld-multi-threaded-elevator",
        "slug": "multi-threaded-elevator-dispatcher",
        "title": "Multi-threaded Elevator Dispatcher на Virtual Threads (Loom)",
        "track": "lld_concurrency",
        "difficulty": "lead",
        "category": "machine_coding",
        "scenarioMarkdown": """# Multi-threaded Elevator Dispatcher

Многопоточный диспетчер лифтов на Java 21 (Project Loom): обработка параллельных заявок с этажей, синхронизация очередей кабин через `ReentrantLock` и `Condition` без Carrier Pinning.""",
        "techStack": "Java 21, Virtual Threads, ReentrantLock, Condition, LOOK",
        "architecturePattern": "Dispatcher / Actor-like Worker / Producer-Consumer",
        "timeLimitMinutes": 45,
        "astRules": ["carrier-thread-pinning"],
        "hints": ["Используйте ReentrantLock вместо synchronized, чтобы не блокировать Carrier Threads."],
        "packageName": "com.company.elevator",
        "serviceName": "ElevatorDispatcherService",
        "files": [
            {
                "path": "src/main/java/com/company/elevator/model/ElevatorRequest.java",
                "content": "package com.company.elevator.model;\n\npublic record ElevatorRequest(int sourceFloor, int destinationFloor) {}\n",
                "readOnly": False,
                "hidden": False
            },
            {
                "path": "src/main/java/com/company/elevator/service/ElevatorDispatcherService.java",
                "content": "package com.company.elevator.service;\n\nimport com.company.elevator.model.ElevatorRequest;\nimport java.util.concurrent.locks.ReentrantLock;\nimport java.util.concurrent.locks.Condition;\n\npublic class ElevatorDispatcherService {\n    private final ReentrantLock lock = new ReentrantLock();\n    private final Condition requestAvailable = lock.newCondition();\n\n    public void submitRequest(ElevatorRequest request) {\n        // TODO: Реализуйте распределение запросов по кабинам лифтов\n    }\n}\n",
                "readOnly": False,
                "hidden": False,
                "isMainEntryPoint": True
            },
            {
                "path": "src/test/java/com/company/elevator/ElevatorDispatcherServiceTest.java",
                "content": "package com.company.elevator;\n\nimport com.company.elevator.model.ElevatorRequest;\nimport com.company.elevator.service.ElevatorDispatcherService;\nimport org.junit.jupiter.api.Test;\n\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class ElevatorDispatcherServiceTest {\n    @Test\n    void testSubmitRequest() {\n        var dispatcher = new ElevatorDispatcherService();\n        dispatcher.submitRequest(new ElevatorRequest(1, 10));\n    }\n}\n",
                "readOnly": True,
                "hidden": False
            }
        ]
    }
]

# Standard template generator for all other challenges
ALL_35_IDS = [
    # BigTech
    ("lld-notification-filter", "Notification Filtering & 24h Deduplication", "lld_bigtech", "senior"),
    ("lld-rate-limiter", "In-Memory Rate Limiter (Token Bucket / Sliding Window)", "lld_bigtech", "senior"),
    ("lld-key-value-cache-ttl", "In-Memory Key-Value Cache с TTL и LRU/LFU", "lld_bigtech", "senior"),
    ("lld-dynamic-discount-engine", "Dynamic Discount & Promo Code Engine", "lld_bigtech", "middle"),
    ("lld-task-scheduler-cron", "Task Scheduler с Cron и Приоритетами", "lld_bigtech", "lead"),
    ("lld-parking-lot-manager", "Parking Lot / Storage Locker Manager", "lld_bigtech", "middle"),
    ("lld-order-state-machine", "Order State Machine", "lld_bigtech", "senior"),
    ("lld-url-shortener", "URL Shortener с Base62 и TTL", "lld_bigtech", "middle"),
    ("lld-metric-aggregator-percentiles", "Tagged Metric Aggregator (p50, p95, p99)", "lld_bigtech", "lead"),
    ("lld-circuit-breaker-engine", "Circuit Breaker: CLOSED, OPEN, HALF_OPEN", "lld_bigtech", "senior"),
    ("lld-event-bus-pub-sub", "In-Memory Thread-Safe Event Bus", "lld_bigtech", "senior"),
    ("lld-inventory-reservation", "Inventory Reservation & Lock Engine", "lld_bigtech", "senior"),
    ("lld-concurrent-leaderboard", "Concurrent Leaderboard Engine", "lld_bigtech", "senior"),
    ("lld-elevator-control-system", "Elevator Control System (LOOK/SCAN)", "lld_bigtech", "senior"),
    ("lld-splitwise-debt-simplification", "Expense Sharing & Debt Simplification", "lld_bigtech", "senior"),
    # FinTech
    ("lld-double-entry-ledger", "Double-Entry Accounting Ledger (Deadlock-Free)", "lld_fintech", "senior"),
    ("lld-idempotency-key-processor", "Idempotency Key Processor (SHA-256 / TTL)", "lld_fintech", "senior"),
    ("lld-transactional-outbox", "Transactional Outbox & Event Publisher", "lld_fintech", "senior"),
    ("lld-multi-currency-wallet", "Multi-Currency Wallet (Hold/Capture/Release)", "lld_fintech", "senior"),
    ("lld-fraud-detection-rules", "Fraud Detection Sliding Window Rules", "lld_fintech", "senior"),
    ("lld-payment-routing-engine", "Payment Routing & Fallback Engine", "lld_fintech", "middle"),
    ("lld-subscription-billing-engine", "Subscription Billing Engine (Grace & Retries)", "lld_fintech", "senior"),
    ("lld-account-limit-velocity", "Bank Account Daily Limit & Velocity Tracker", "lld_fintech", "senior"),
    ("lld-highload-counter-striped", "Highload Counter (Striped Cells / LongAdder)", "lld_fintech", "lead"),
    ("lld-split-payment-escrow", "Split Payment & Escrow Resolver", "lld_fintech", "senior"),
    # Concurrency
    ("lld-multi-threaded-elevator", "Multi-threaded Elevator Dispatcher (Virtual Threads)", "lld_concurrency", "lead"),
    ("lld-custom-threadpool", "Custom ThreadPoolExecutor & Work-Stealing", "lld_concurrency", "lead"),
    ("lld-connection-pool-manager", "Connection Pool Manager (Leak Detection & MaxWait)", "lld_concurrency", "senior"),
    ("lld-async-batch-flusher", "Asynchronous Batch Event Flusher (Size N || Time T)", "lld_concurrency", "senior"),
    ("lld-multi-tier-cache-stampede", "Multi-tier Cache with Cache Stampede Protection", "lld_concurrency", "lead"),
    ("lld-read-write-lock-writer-pref", "Read-Write Lock with Writer Preference", "lld_concurrency", "senior"),
    ("lld-fenced-lock-heartbeat", "In-Memory Fenced Lock & Heartbeat", "lld_concurrency", "senior"),
    ("lld-blocking-priority-queue", "Blocking Priority Queue on ReentrantLock", "lld_concurrency", "senior"),
    ("lld-disruptor-ring-buffer", "Producer-Consumer Ring Buffer (LMAX Disruptor)", "lld_concurrency", "lead"),
    ("lld-rate-limiting-gateway-priority", "Rate Limiting Gateway с VIP-приоритетами", "lld_concurrency", "senior")
]

def generate_default_files(challenge_id: str, title: str, track: str):
    clean_name = "".join(w.capitalize() for w in challenge_id.replace("lld-", "").replace("-", " ").split())
    service_name = clean_name + "Service"
    package = "com.company." + challenge_id.replace("lld-", "").replace("-", "")

    files = [
        {
            "path": f"src/main/java/{package.replace('.', '/')}/model/{clean_name}Config.java",
            "content": f"package {package}.model;\n\nimport java.time.Duration;\n\npublic record {clean_name}Config(\n    String name,\n    Duration timeout\n) {{}}\n",
            "readOnly": False,
            "hidden": False
        },
        {
            "path": f"src/main/java/{package.replace('.', '/')}/service/{service_name}.java",
            "content": f"package {package}.service;\n\nimport {package}.model.{clean_name}Config;\nimport java.time.Clock;\nimport java.util.Objects;\n\npublic class {service_name} {{\n    private final Clock clock;\n\n    public {service_name}(Clock clock) {{\n        this.clock = Objects.requireNonNull(clock);\n    }}\n\n    public boolean execute({clean_name}Config config) {{\n        // TODO: Реализуйте бизнес-логику задачи с соблюдением SOTA 2026 инвариантов\n        return true;\n    }}\n}}\n",
            "readOnly": False,
            "hidden": False,
            "isMainEntryPoint": True
        },
        {
            "path": f"src/test/java/{package.replace('.', '/')}/{service_name}Test.java",
            "content": f"package {package};\n\nimport {package}.model.{clean_name}Config;\nimport {package}.service.{service_name};\nimport org.junit.jupiter.api.BeforeEach;\nimport org.junit.jupiter.api.Test;\n\nimport java.time.Clock;\nimport java.time.Duration;\nimport java.time.Instant;\nimport java.time.ZoneId;\n\nimport static org.assertj.core.api.Assertions.assertThat;\n\npublic class {service_name}Test {{\n    private Instant now;\n    private Clock clock;\n    private {service_name} service;\n\n    @BeforeEach\n    void setUp() {{\n        now = Instant.parse(\"2026-09-01T12:00:00Z\");\n        clock = Clock.fixed(now, ZoneId.of(\"UTC\"));\n        service = new {service_name}(clock);\n    }}\n\n    @Test\n    void testExecuteHappyPath() {{\n        var config = new {clean_name}Config(\"test\", Duration.ofSeconds(5));\n        assertThat(service.execute(config)).isTrue();\n    }}\n}}\n",
            "readOnly": True,
            "hidden": False
        }
    ]
    return files

def build_full_challenge(cid, title, track, difficulty):
    spec = next((s for s in CHALLENGE_SPECS if s["id"] == cid), None)
    if spec:
        files = spec["files"]
        scenario = spec["scenarioMarkdown"]
        techStack = spec.get("techStack", "Java 21 LTS, Records, Clock")
        pattern = spec.get("architecturePattern", "Clean Architecture / Specification")
        astRules = spec.get("astRules", ["enforce-clock-injection"])
        hints = spec.get("hints", ["Используйте Clock.instant() для проверки времени."])
    else:
        files = generate_default_files(cid, title, track)
        scenario = f"# {title}\n\n## 🏢 Бизнес-контекст & ТЗ от Product Owner'a\nРеализуйте высокопроизводительный потокобезопасный модуль `{title}` на Java 21 с соблюдением принципов SOLID и детерминированного времени через `java.time.Clock`."
        techStack = "Java 21 LTS, Records, Clock, Concurrency"
        pattern = "Strategy / State / Specification"
        astRules = ["enforce-clock-injection", "carrier-thread-pinning" if track == "lld_concurrency" else "no-double-in-money"]
        hints = [
            "Внедряйте java.time.Clock в конструктор класса.",
            "Используйте неизменяемые record для доменных моделей.",
            "Избегайте прямого System.currentTimeMillis() и Instant.now()."
        ]

    return {
        "id": cid,
        "slug": cid.replace("lld-", ""),
        "title": title,
        "track": track,
        "badge": "💳 FinTech" if track == "lld_fintech" else "⚡ Concurrency" if track == "lld_concurrency" else "🏛️ BigTech LLD",
        "difficulty": difficulty,
        "category": "machine_coding",
        "scenarioMarkdown": scenario,
        "shortDescription": f"Архитектурный лайвкодинг: {title} на Java 21 с детерминированным временем через Clock.",
        "instructionsMarkdown": scenario,
        "techStack": techStack,
        "architecturePattern": pattern,
        "timeLimitMinutes": 45,
        "workspaceFiles": files,
        "phases": [
            {
                "phase": 1,
                "unlockTimeMinutes": 0,
                "title": "Фаза 1: Доменная модель & Сервис",
                "descriptionMarkdown": "Реализуйте доменную модель и сервис с внедрением Clock.",
                "addedFiles": files,
                "testCases": [
                    {
                        "id": f"tc_{cid}_1",
                        "name": "Проверка базового контракта и Happy Path",
                        "phase": 1,
                        "weight": 50,
                        "timeoutMs": 1000,
                        "isHidden": False
                    },
                    {
                        "id": f"tc_{cid}_2",
                        "name": "Проверка граничных условий и детерминированного времени",
                        "phase": 1,
                        "weight": 50,
                        "timeoutMs": 1000,
                        "isHidden": False
                    }
                ]
            }
        ],
        "astRules": astRules,
        "hints": hints
    }

def main():
    print("🚀 Generating Full Multi-File Scaffolds for all 35 SOTA LLD Challenges...")
    challenges = []
    for cid, title, track, diff in ALL_35_IDS:
        ch = build_full_challenge(cid, title, track, diff)
        challenges.append(ch)

    # 1. Write json/machine_coding_challenges.json
    out_json = os.path.join(JSON_DIR, "machine_coding_challenges.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(challenges, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Saved {len(challenges)} fully scaffolded challenges to {out_json}")

    # 2. Seed SQLite database
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(coding_challenges)")
        cols = [col[1] for col in cur.fetchall()]
        if "track" not in cols:
            cur.execute("ALTER TABLE coding_challenges ADD COLUMN track TEXT DEFAULT 'general'")
            conn.commit()

        inserted = 0
        for ch in challenges:
            manifest_str = json.dumps(ch, ensure_ascii=False)
            cur.execute("""
                INSERT INTO coding_challenges (id, slug, title, track, difficulty, category, estimated_minutes, manifest_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    slug = excluded.slug,
                    title = excluded.title,
                    track = excluded.track,
                    difficulty = excluded.difficulty,
                    category = excluded.category,
                    estimated_minutes = excluded.estimated_minutes,
                    manifest_json = excluded.manifest_json
            """, (
                ch["id"],
                ch["slug"],
                ch["title"],
                ch.get("track", "lld_bigtech"),
                ch["difficulty"],
                ch.get("category", "machine_coding"),
                ch.get("timeLimitMinutes", 45),
                manifest_str
            ))
            inserted += 1
        
        conn.commit()
        conn.close()
        print(f"  ✓ Seeded {inserted} fully scaffolded challenges into SQLite database ({DB_PATH})")

    print("\n🎉 ALL 35 SOTA LLD CHALLENGES NOW HAVE 100% READY MULTI-FILE SCAFFOLDS!")

if __name__ == "__main__":
    main()
