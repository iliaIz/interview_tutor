# Аудит полноты и корректности каталога практических задач (132 каты)

> **Дата аудита:** Ноябрь 2026  
> **Статус задачи IBAN:** Сброшен (запись в `coding_submissions` удалена, состояние очищено)  
> **Общий объем каталога:** 132 задачи  

---

## 1. Резюме и Первопричины (Root Cause Analysis)

В ходе беспристрастного технического аудита всех 132 задач практики выявлена системная проблема:

1. **Смешение эталонного решения со стартовым каркасом (Starter Code Bleed):**
   - При первоначальной разработке и автотестировании задач в `json/machine_coding_challenges.json` и `additionalChallenges.ts` авторы создавали рабочий код с тестами для верификации песочницы.
   - При формировании манифестов `workspaceFiles` эталонное решение было **ошибочно сохранено как стартовый код кандидата** вместо замены тел методов на TDD-стабы (`throw new UnsupportedOperationException("Not implemented yet");`).
2. **Заранее убитые мутанты в Testing & Mutation (`TST-01`–`TST-42`):**
   - В 42 задачах на мутационное тестирование кандидат должен сам написать `@Test` методы, чтобы убить мутантов.
   - В стартовых файлах тестов уже были заложены 100% убивающие проверки (включая комментарии `// Убивающее утверждение`).
3. **Преждевременно исправленный код в Code Review (`case_transfer_service`, `case_account_collections`):**
   - Задачи позиционируются как поиск архитектурных дефектов (Deadlock, Lost Update, TreeMap collision, double).
   - В стартовом коде все эти дефекты уже были устранены.

### Статистика готовности каталога:
- 🔴 **Требуют исправления (Pre-solved / Defective):** 61 задача (46%)
- 🟢 **Корректные (TDD Red Stubs / Golden Master Legacy):** 71 задача (54%)

---

## 2. Разбор по трекам и категориям

### 🏦 2.1 Трек Райффайзенбанк (Фильтр Raiffeisen — 4 задачи)
Все 4 задачи фильтра Райффайзенбанк изначально поставлялись в полностью решенном виде:
1. `iban-validator` (LLD-27): Алгоритм ISO 13616 mod 97 полностью написан. Тесты 9/9 зеленые из коробки.
2. `sparse-vector` (LLD-74): Два указателя и `dotProduct` полностью написаны. Тесты зеленые.
3. `case_transfer_service` (LLD-24): 7 дефектов (Deadlock, Lost Update, idempotency) уже исправлены в коде.
4. `case_account_collections` (LLD-23): 6 дефектов (TreeMap, double, package) уже исправлены в коде.

### 🏛️ 2.2 BigTech / FinTech / Concurrency Machine Coding (51 задача)
- 🟢 **35 задач серии `lld-*`:** Спроектированы идеально. Содержат чистые интерфейсы, модели и стабы `// TODO` с возвратом дефолтных значений/исключений (тесты изначально КРАСНЫЕ).
- 🔴 **14 задач серии `mc_*` (из `additionalChallenges.ts`):** Поставляются с полным эталонным кодом в `workspaceFiles` (кэш LRU, Circuit Breaker, Leaderboard и др.).

### 🧪 2.3 Testing & Mutation Katas (42 задачи)
- 🔴 **Все 42 задачи (`TST-01`–`TST-42`):** Тестовые файлы кандидата содержат готовые ассерты, которые на 100% уничтожают всех мутантов сразу при открытии задачи.

### 🛡️ 2.4 Refactoring Arena (24 задачи)
- 🟢 **Все 24 задачи (`L0-REF`–`L3-REF`):** Архитектурно корректны. Задачи являются рефакторингом под защитой характеризационных тестов: легаси-код проходит тесты, но проваливает AST-правила и статический анализ запахов кода до проведения рефакторинга.

### ⚡ 2.5 Design Patterns Arena (7 задач)
- 🟢 **Все 7 задач (`DP-01`–`DP-07`):** Архитектурно корректны. Кандидат получает классический GoF-антипаттерн 1994 года и обязан переписать его на идиомы Java 21 (Sealed Types, Lambdas, Spring DI).

---

## 3. Детальный реестр всех 132 задач практики

| Код | ID задачи | Название | Трек | Текущее состояние | Необходимое действие |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DP-01 | `DP-01-SEALED-VISITOR` | Refactoring Double-Dispatch Visitor to Java 21 Sealed Hierarchy | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-02 | `DP-02-LAMBDA-STRATEGY` | Refactoring Class-Heavy Strategy Pattern to First-Class Functions | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-03 | `DP-03-SINGLETON-GOD` | Eliminating Mutable Singleton Anti-Pattern via Dependency Injection | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-04 | `DP-04-STATE-ORDER-FSM` | Refactoring Procedural Order Status Cascade to State Pattern | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-05 | `DP-05-HEXAGONAL-ADAPTER` | Decoupling Third-Party SDK via Hexagonal Ports & Adapters | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-06 | `DP-06-SPRING-PROXY-SELF-INVOCATION` | Fixing Spring AOP Proxy Self-Invocation Transaction Bypass | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| DP-07 | `DP-07-DECORATOR-AUDIT` | Composing Cross-Cutting Concerns via Decorator Pattern | design_patterns | 🟢 GoF Anti-Pattern | Корректно (легаси-паттерн требует рефакторинга) |
| LLD-14 | `lab_java21_modern_idioms` | Modern Java 21 Idioms Lab | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-15 | `lld-dynamic-discount-engine` | Dynamic Discount & Promo Code Engine | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-16 | `lld-parking-lot-manager` | Parking Lot / Storage Locker Manager | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-18 | `lld-url-shortener` | URL Shortener с Base62 и TTL | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-19 | `mc_discount_promo_engine` | Dynamic Discount & Promo Code Engine | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-20 | `mc_order_state_machine` | Atomic Order State Machine with Guarded Transitions | lld_bigtech | 🔴 Pre-solved | Заменить реализацию на стаб |
| LLD-21 | `mc_parking_lot_manager` | Multi-Floor Parking Lot & Locker Manager | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-22 | `mc_thread_safe_event_bus` | In-Memory Thread-Safe Event Bus with Topic Subscriptions | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-28 | `kata_gilded_rose` | Gilded Rose Refactoring Kata | lld_bigtech | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-29 | `kata_trip_service` | Trip Service Legacy Decoupling Kata | lld_bigtech | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-41 | `lld-circuit-breaker-engine` | Circuit Breaker: CLOSED, OPEN, HALF_OPEN | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-42 | `lld-concurrent-leaderboard` | Concurrent Leaderboard Engine | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-45 | `lld-elevator-control-system` | Elevator Control System (LOOK/SCAN) | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-46 | `lld-event-bus-pub-sub` | In-Memory Thread-Safe Event Bus | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-50 | `lld-inventory-reservation` | Inventory Reservation & Lock Engine | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-51 | `lld-key-value-cache-ttl` | In-Memory Key-Value Cache с TTL и LRU/LFU | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-53 | `lld-notification-filter` | Notification Filtering & 24h Deduplication | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-54 | `lld-order-state-machine` | Order State Machine | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-55 | `lld-rate-limiter` | In-Memory Rate Limiter (Token Bucket / Sliding Window) | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-59 | `lld-splitwise-debt-simplification` | Expense Sharing & Debt Simplification | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-62 | `mc_circuit_breaker_resilience` | Resilient Circuit Breaker State Machine | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-63 | `mc_concurrent_leaderboard` | Real-Time Gaming Leaderboard Engine with O(log N) Rank | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-64 | `mc_elevator_control_system` | Multi-Car Elevator Dispatcher with SCAN Algorithm | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-65 | `mc_flash_sale_engine` | Flash Sale Engine & Inventory Reservation | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-66 | `mc_inventory_reservation_deadlock_free` | Deadlock-Free Real-Time Inventory Reservation | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-67 | `mc_key_value_cache_lru` | Thread-Safe Key-Value Cache with TTL & LRU Eviction | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-68 | `mc_notification_dedup_pipeline` | Notification Filtering & Deduplication Engine | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-69 | `mc_rate_limiter_token_bucket` | In-Memory Thread-Safe Rate Limiter | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-70 | `mc_splitwise_system` | Splitwise (Expense Sharing & Debt Simplification) | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-71 | `mc_tagged_metric_aggregator` | High-Frequency Tagged Metric Aggregator | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-72 | `mc_task_scheduler_priority_queue` | Distributed-Ready Task Scheduler with Priorities & Clock | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-73 | `mc_url_shortener_analytics` | High-Throughput URL Shortener with Analytics & TTL | lld_bigtech | 🔴 Pre-solved | Заменить метод(ы) на стаб с TODO и исключением |
| LLD-83 | `lab_virtual_threads_pinning` | Virtual Thread Carrier Pinning & JMM Lab | lld_bigtech | 🔴 Pre-solved | Заменить реализацию на стаб |
| LLD-87 | `lld-metric-aggregator-percentiles` | Tagged Metric Aggregator (p50, p95, p99) | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-90 | `lld-task-scheduler-cron` | Task Scheduler с Cron и Приоритетами | lld_bigtech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-39 | `lld-async-batch-flusher` | Asynchronous Batch Event Flusher (Size N // Time T) | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-40 | `lld-blocking-priority-queue` | Blocking Priority Queue on ReentrantLock | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-43 | `lld-connection-pool-manager` | Connection Pool Manager (Leak Detection & MaxWait) | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-47 | `lld-fenced-lock-heartbeat` | In-Memory Fenced Lock & Heartbeat | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-56 | `lld-rate-limiting-gateway-priority` | Rate Limiting Gateway с VIP-приоритетами | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-57 | `lld-read-write-lock-writer-pref` | Read-Write Lock with Writer Preference | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-84 | `lld-custom-threadpool` | Custom ThreadPoolExecutor & Work-Stealing | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-85 | `lld-disruptor-ring-buffer` | Producer-Consumer Ring Buffer (LMAX Disruptor) | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-88 | `lld-multi-threaded-elevator` | Multi-threaded Elevator Dispatcher (Virtual Threads) | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-89 | `lld-multi-tier-cache-stampede` | Multi-tier Cache with Cache Stampede Protection | lld_concurrency | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-17 | `lld-payment-routing-engine` | Payment Routing & Fallback Engine | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-38 | `lld-account-limit-velocity` | Bank Account Daily Limit & Velocity Tracker | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-44 | `lld-double-entry-ledger` | Double-Entry Accounting Ledger (Deadlock-Free) | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-48 | `lld-fraud-detection-rules` | Fraud Detection Sliding Window Rules | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-49 | `lld-idempotency-key-processor` | Idempotency Key Processor (SHA-256 / TTL) | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-52 | `lld-multi-currency-wallet` | Multi-Currency Wallet (Hold/Capture/Release) | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-58 | `lld-split-payment-escrow` | Split Payment & Escrow Resolver | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-60 | `lld-subscription-billing-engine` | Subscription Billing Engine (Grace & Retries) | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-61 | `lld-transactional-outbox` | Transactional Outbox & Event Publisher | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-86 | `lld-highload-counter-striped` | Highload Counter (Striped Cells / LongAdder) | lld_fintech | 🟢 TDD Red Stub | Корректно (стаб не проходит тесты) |
| LLD-23 | `case_account_collections` | Account: Банковский счет и коллизия в TreeMap (Что выведет этот код?) | raiffeisen_code_review | 🔴 Bugs Fixed | Внедрить намеренные архитектурные дефекты по ТЗ |
| LLD-24 | `case_transfer_service` | TransferService: Банковский перевод (7 архитектурных дефектов) | raiffeisen_code_review | 🔴 Bugs Fixed | Внедрить намеренные архитектурные дефекты по ТЗ |
| LLD-27 | `iban-validator` | Валидация банковского счета IBAN (ISO 13616, mod 97) | raiffeisen_livecoding | 🔴 Pre-solved | Заменить тело метода на UnsupportedOperationException |
| LLD-74 | `sparse-vector` | Разреженный вектор и скалярное произведение (SparseVector) | raiffeisen_livecoding | 🔴 Pre-solved | Заменить тело метода на UnsupportedOperationException |
| LLD-02 | `L0-REF-01` | Multi-Tier Shipping Rate & Surcharge Calculator | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-03 | `L0-REF-03` | FinTech User Onboarding & KYC Validator | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-04 | `L0-REF-05` | User Account Lifecycle & Notification Manager | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-05 | `L0-REF-07` | Social Travel Network Trip Service | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-10 | `L1-REF-02` | E-Commerce Dynamic Discount & Promo Engine | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-11 | `L1-REF-04` | Cross-Border Invoice Billing & Settlement Processor | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-12 | `L1-REF-06` | E-Commerce Order Fulfillment Orchestrator | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-13 | `L1-REF-08` | Legacy Compliance Audit & PDF Report Generator | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-30 | `L2-REF-01` | ConcurrentPaymentGatewayClient: Пиннинг потоков-носителей и взаимная блокировка пула ForkJoinPool | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-31 | `L2-REF-02` | TokenBucketRateLimiterAndSessionCache: Оптимистичное чтение StampedLock и Lock-Free CAS в кэше сессий | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-32 | `L2-REF-03` | InventoryAllocationManager: Неатомарный Check-Then-Act в ConcurrentHashMap и потеря обновлений volatile | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-33 | `L2-REF-04` | DeadlockFreeTransferService: Упорядочивание блокировок и ReentrantLock в MultiAccountTransferLedger | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-34 | `L2-REF-05` | PostgresPessimisticLockTransferService: Дедлоки строк PostgreSQL 16 и Lost Update при SELECT FOR UPDATE | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-35 | `L2-REF-06` | OrderCheckoutWithExternalPaymentAndEmail: Удержание соединения БД во время HTTP I/O и ловушка Self-Invocation | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-36 | `L2-REF-07` | AuditBatchJobConnectionExhaustion: Приоритизация трафика и защита общего пула HikariCP от пакетных задач | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-37 | `L2-REF-08` | SecurityContextThreadLocalLeak: Взрыв памяти ThreadLocal, мутация контекста и миграция на ScopedValue | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-75 | `L3-REF-01` | OrderProcessingHexagonalDecoupling | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-76 | `L3-REF-02` | CustomerSubscriptionPortsAndAdapters | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-77 | `L3-REF-03` | DualWritePaymentNotifierRefactoring | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-78 | `L3-REF-04` | OrderPlacementOutboxMigration | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-79 | `L3-REF-05` | LegacySpring2EnterpriseGatewayMigration | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-80 | `L3-REF-06` | LegacyBankingSecurityMigration | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-81 | `L3-REF-07` | CoreBankingLegacyConnectorACL | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| LLD-82 | `L3-REF-08` | ThirdPartyLogisticsTranslator | refactoring | 🟢 Legacy Smells | Корректно (характеризационный тест + легаси) |
| TST-01 | `kata_prim_01_scalar_assertions` | PRIM-01: Scalar Assertions & AAA Pattern | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-02 | `kata_prim_02_exception_handling` | PRIM-02: Exception Assertions & Root Cause | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-03 | `kata_prim_03_parameterized_boundaries` | PRIM-03: Parameterized Boundaries (@CsvSource) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-04 | `kata_prim_04_mock_void_command` | PRIM-04: Mocking Void Commands (verify & times) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-05 | `kata_prim_05_argument_captor` | PRIM-05: ArgumentCaptor & Payload Inspection | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-06 | `kata_prim_06_time_virtualization` | PRIM-06: Time Virtualization with java.time.Clock | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-07 | `kata_rev_01_fake_assertion` | REV-01: Spot the Fake Assertion (Line Hitter) | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-08 | `kata_rev_02_survived_boundary` | REV-02: Survived Conditionals Boundary (< vs <=) | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-09 | `kata_rev_03_over_mocking_trap` | REV-03: The Over-Mocked Ghost Test | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-10 | `kata_rev_04_flaky_sleep_race` | REV-04: Flaky Sleep vs Awaitility Polling | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-11 | `kata_rev_05_void_bypass_audit` | REV-05: The Void Method Bypass (Audit Log) | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-12 | `kata_rev_06_archunit_cyclic_hole` | REV-06: ArchUnit Package Slices Guard | testing_mutation | 🔴 Tests Pre-written | Удалить убивающее утверждение (оставить только слабый тест) |
| TST-13 | `kata_test_overloaded_constructor_clock_seam` | KATA-TEST-03: Overloaded Constructor Clock Seam (Virtual Time) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-14 | `kata_test_archunit_enterprise_api_governance` | KATA-TEST-31: Enterprise API Governance Rules | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-15 | `kata_test_archunit_layer_isolation` | KATA-TEST-30: ArchUnit Layer Isolation & Inversion | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-16 | `kata_test_archunit_transactional_integrity` | KATA-TEST-32: Transactional Integrity Guard | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-17 | `kata_test_async_event_dto_captor` | KATA-TEST-15: Async Event DTO Captor & PII Masking (ArgumentCaptor) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-18 | `kata_test_awaitility_polling_stability` | KATA-TEST-25: Awaitility Polling vs Flaky Sleep (State Stability) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-19 | `kata_test_banking_account_lifecycle_nested` | KATA-TEST-13: Banking Lifecycle BDD Hierarchy (@Nested) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-20 | `kata_test_combinatorial_pricing_discounts` | KATA-TEST-11: Combinatorial Pricing Engine (@ParameterizedTest) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-21 | `kata_test_deadlock_provocation_ordered_locking` | KATA-TEST-27: Deadlock Provocation & Ordered Locking (ThreadMXBean) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-22 | `kata_test_deterministic_time_mockstatic_uuid` | KATA-TEST-19: Deterministic Time & UUID with mockStatic (JDK 21 Trap) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-23 | `kata_test_distributed_saga_orchestrator` | KATA-TEST-24: Distributed Saga Orchestrator (LIFO Compensations) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-24 | `kata_test_dynamic_rbac_matrix_testfactory` | KATA-TEST-12: Dynamic RBAC Matrix via @TestFactory (72 Permutations) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-25 | `kata_test_financial_tx_validator` | KATA-TEST-04: Financial Transaction Validator (@ParameterizedTest) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-26 | `kata_test_gilded_rose_approval` | KATA-TEST-02: Gilded Rose Approval Testing (Golden Master) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-27 | `kata_test_idempotent_account_service` | KATA-TEST-10: Idempotent Account Service (Double-Spending Guard) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-28 | `kata_test_jackson_financial_pan_masking` | KATA-TEST-34: Jackson Financial Serializer & PAN Masking | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-29 | `kata_test_legacy_security_context_seam` | KATA-TEST-21: Legacy Static Security & Ambient Context Seam | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-30 | `kata_test_legacy_tax_engine_golden_master` | KATA-TEST-22: Non-Deterministic Financial Engine Golden Master | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-31 | `kata_test_lock_free_ringbuffer_contention` | KATA-TEST-29: Lock-Free RingBuffer (AtomicReferenceArray & CAS) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-32 | `kata_test_order_state_machine_dynamic` | KATA-TEST-05: Order State Machine Transitions (Finite Automata) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-33 | `kata_test_race_condition_ledger_transfer` | KATA-TEST-26: Double-Spending Race Condition (CyclicBarrier & CAS) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-34 | `kata_test_resilience_circuit_breaker` | KATA-TEST-17: Resilience4j Circuit Breaker State Transition | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-35 | `kata_test_resilient_cascading_retry` | KATA-TEST-18: Resilient Cascading Retry & Backoff (InOrder & Sleeper) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-36 | `kata_test_security_context_cleanup_extension` | KATA-TEST-14: Security Context JUnit 5 Extension (ThreadLocal Guard) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-37 | `kata_test_sliding_window_rate_limiter` | KATA-TEST-23: Sliding Window Rate Limiter Automaton (Lock-Free CAS) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-38 | `kata_test_spring_webmvc_problem_detail` | KATA-TEST-33: WebMvc Slice & RFC 7807 ProblemDetail | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-39 | `kata_test_spy_partial_mocking_var` | KATA-TEST-16: Partial Mocking @Spy (doReturn vs when Bytecode Trap) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-40 | `kata_test_strict_in_order_audit` | KATA-TEST-07: Strict Audit Trail Verification (InOrder Verification) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-41 | `kata_test_trip_service_seam` | KATA-TEST-01: TripService Decoupling (Subclass & Override Seam) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |
| TST-42 | `kata_test_virtual_thread_carrier_pinning` | KATA-TEST-28: Virtual Thread Carrier Pinning (synchronized vs Lock) | testing_mutation | 🔴 Tests Pre-written | Оставить заготовку @Test без убивающих проверок |

---

## 4. План системного устранения первопричины (Remediation Roadmap)

Чтобы исключить повторение дефекта и гарантировать педагогическую ценность платформы:

1. **Пакет Райффайзенбанк (Приоритет 1):**
   - `iban-validator`: замена тела `validate(String iban)` на стаб с выбросом `UnsupportedOperationException("Not implemented yet")`.
   - `sparse-vector`: замена тел конструктора и `dotProduct` на стабы с выбросом исключения.
   - `case_transfer_service`: возвращение 7 дефектов (отсутствие `findForUpdate`, потенциальный Deadlock на сортировке ID, отсутствие проверки баланса до списания).
   - `case_account_collections`: возвращение 6 дефектов (`package java.snippet.account`, `TreeMap<Date>`, `double balance`).
2. **Пакет Machine Coding `mc_*` (Приоритет 2):**
   - В `additionalChallenges.ts` заменить тела рабочих методов на стабы с TODO, чтобы тесты падали до реализации.
3. **Пакет Testing & Mutation `TST-01`..`TST-42` (Приоритет 3):**
   - В `mutationChallenges/` очистить файлы `*Test.java` от убивающих проверок, оставив либо пустые методы `@Test void test...() { // TODO }`, либо базовый неполный тест.
4. **CI/CD Quality Gate (Предотвращение регрессий):**
   - Добавить автоматический пре-флайт тест `testZeroStillbornStarterWorkspaces.ts`, который компилирует стартовые файлы и проверяет, что для Machine Coding тесты ПАДАЮТ (Red), а для Mutation стартовый мутационный скор равен 0% (мутанты выживают).
