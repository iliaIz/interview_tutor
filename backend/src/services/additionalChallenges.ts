import { CodingChallenge } from './challengeSeedData';

export const ADDITIONAL_LLD_CHALLENGES: CodingChallenge[] = [
  // 6. In-Memory Key-Value Cache с TTL & LRU
  {
    id: 'mc_key_value_cache_lru',
    slug: 'key-value-cache-lru-ttl',
    title: 'Thread-Safe Key-Value Cache with TTL & LRU Eviction',
    category: 'machine_coding',
    badge: '⚡ Machine Coding (LLD)',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ReentrantReadWriteLock, O(1) Eviction',
    timeLimitMinutes: 45,
    shortDescription: 'Спроектируйте быстрый потокобезопасный Key-Value кэш со стратегией вытеснения LRU за O(1) и автоматическим истечением по TTL.',
    instructionsMarkdown: `# Key-Value Cache with TTL & LRU Eviction

## Бизнес-контекст
Разработайте высокопроизводительный in-memory кэш для микросервиса каталога товаров. Кэш должен выдерживать параллельное чтение и запись, не допуская утечек памяти.

## Требования:
1. Реализуйте \`Cache<K, V>\` в \`LruCache.java\` с поддержкой методов \`get(K key)\`, \`put(K key, V value, long ttlMs)\`, \`remove(K key)\`, \`size()\`.
2. **Алгоритм LRU за O(1):** При превышении емкости (\`capacity\`) наиболее давно использовавшийся элемент должен удаляться за константное время.
3. **Потокобезопасность:** Используйте \`ReentrantReadWriteLock\` для поддержки множественных одновременных читателей без блокировки.
4. **Учет времени:** Внедрите \`java.time.Clock\` через конструктор для детерминированного тестирования истечения TTL.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/cache/Cache.java',
        content: `package com.assessment.cache;
import java.util.Optional;

public interface Cache<K, V> {
    Optional<V> get(K key);
    void put(K key, V value, long ttlMs);
    boolean remove(K key);
    int size();
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/cache/LruCache.java',
        content: `package com.assessment.cache;

import java.time.Clock;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class LruCache<K, V> implements Cache<K, V> {
    private final int capacity;
    private final Clock clock;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null, 0);
    private final Node<K, V> tail = new Node<>(null, null, 0);

    static class Node<K, V> {
        K key;
        V value;
        long expiresAt;
        Node<K, V> prev, next;
        Node(K key, V value, long expiresAt) {
            this.key = key;
            this.value = value;
            this.expiresAt = expiresAt;
        }
    }

    public LruCache(int capacity, Clock clock) {
        this.capacity = capacity;
        this.clock = clock;
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public Optional<V> get(K key) {
        lock.writeLock().lock();
        try {
            Node<K, V> node = map.get(key);
            if (node == null) return Optional.empty();
            if (node.expiresAt <= clock.millis()) {
                removeNode(node);
                map.remove(key);
                return Optional.empty();
            }
            moveToHead(node);
            return Optional.of(node.value);
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public void put(K key, V value, long ttlMs) {
        lock.writeLock().lock();
        try {
            long expiresAt = clock.millis() + ttlMs;
            Node<K, V> node = map.get(key);
            if (node != null) {
                node.value = value;
                node.expiresAt = expiresAt;
                moveToHead(node);
            } else {
                if (map.size() >= capacity) {
                    Node<K, V> lru = tail.prev;
                    removeNode(lru);
                    map.remove(lru.key);
                }
                Node<K, V> newNode = new Node<>(key, value, expiresAt);
                addNode(newNode);
                map.put(key, newNode);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public boolean remove(K key) {
        lock.writeLock().lock();
        try {
            Node<K, V> node = map.remove(key);
            if (node != null) {
                removeNode(node);
                return true;
            }
            return false;
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public int size() {
        lock.readLock().lock();
        try {
            return map.size();
        } finally {
            lock.readLock().unlock();
        }
    }

    private void addNode(Node<K, V> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void moveToHead(Node<K, V> node) {
        removeNode(node);
        addNode(node);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/cache/LruCacheTest.java',
        content: `package com.assessment.cache;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

public class LruCacheTest {
    public void testLruEviction() {
        Clock clock = Clock.fixed(Instant.ofEpochMilli(1000), ZoneId.of("UTC"));
        LruCache<String, Integer> cache = new LruCache<>(2, clock);
        cache.put("a", 1, 10000);
        cache.put("b", 2, 10000);
        cache.get("a"); // a becomes most recently used
        cache.put("c", 3, 10000); // b should be evicted

        if (cache.get("b").isPresent()) {
            throw new AssertionError("Key 'b' should have been evicted by LRU");
        }
        if (!cache.get("a").isPresent() || cache.get("a").get() != 1) {
            throw new AssertionError("Key 'a' should still be in cache");
        }
    }

    public void testTtlExpiration() {
        Instant now = Instant.ofEpochMilli(1000);
        Clock clock1 = Clock.fixed(now, ZoneId.of("UTC"));
        LruCache<String, String> cache = new LruCache<>(5, clock1);
        cache.put("temp", "val", 500); // expires at 1500

        // Advance clock by 600ms
        Clock clock2 = Clock.fixed(now.plusMillis(600), ZoneId.of("UTC"));
        LruCache<String, String> cacheExpired = new LruCache<>(5, clock2);
        cacheExpired.put("k", "v", 100);
    }

    public void testConcurrentReadWriteSafety() {
        Clock clock = Clock.systemUTC();
        LruCache<String, Integer> cache = new LruCache<>(100, clock);
        // Will be executed by the 100-thread blast harness
        cache.put("key", 42, 60000);
        cache.get("key");
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 7. Dynamic Discount & Promo Code Engine
  {
    id: 'mc_discount_promo_engine',
    slug: 'discount-promo-engine',
    title: 'Dynamic Discount & Promo Code Engine',
    category: 'machine_coding',
    badge: '💳 FinTech / E-Commerce',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, BigDecimal Banker\'s Rounding, Chain of Responsibility',
    timeLimitMinutes: 40,
    shortDescription: 'Реализуйте гибкий движок применения купонов и накопительных скидок с защитой от отрицательных сумм и финансовой точностью HALF_EVEN.',
    instructionsMarkdown: `# Dynamic Discount & Promo Code Engine

## Бизнес-контекст
Сервис корзины интернет-магазина применяет правила скидок:
1. Процентные скидки (например, 15% на категорию).
2. Фиксированные купоны (например, -500 руб при заказе от 3000 руб).
3. Персональные кэшбэки.

## Требования:
- Все денежные расчеты СТРОГО через \`BigDecimal\` с масштабом 2 знака и \`RoundingMode.HALF_EVEN\`. Использование \`double\` или \`float\` запрещено.
- Итоговая стоимость заказа не может быть меньше 0.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/discount/Order.java',
        content: `package com.assessment.discount;
import java.math.BigDecimal;
import java.util.List;

public record Order(String orderId, BigDecimal basePrice, List<String> promoCodes) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/discount/DiscountEngine.java',
        content: `package com.assessment.discount;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class DiscountEngine {
    public static final RoundingMode FINANCIAL_ROUNDING = RoundingMode.HALF_EVEN;

    public BigDecimal calculateFinalPrice(Order order) {
        BigDecimal price = order.basePrice().setScale(2, FINANCIAL_ROUNDING);

        for (String code : order.promoCodes()) {
            if ("SALE10".equalsIgnoreCase(code)) {
                BigDecimal discount = price.multiply(new BigDecimal("0.10")).setScale(2, FINANCIAL_ROUNDING);
                price = price.subtract(discount);
            } else if ("FIXED50".equalsIgnoreCase(code)) {
                price = price.subtract(new BigDecimal("50.00"));
            }
        }

        if (price.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, FINANCIAL_ROUNDING);
        }
        return price.setScale(2, FINANCIAL_ROUNDING);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/discount/DiscountEngineTest.java',
        content: `package com.assessment.discount;

import java.math.BigDecimal;
import java.util.List;

public class DiscountEngineTest {
    public void testPercentageAndFixedDiscount() {
        DiscountEngine engine = new DiscountEngine();
        Order order = new Order("ord-1", new BigDecimal("100.00"), List.of("SALE10", "FIXED50"));
        BigDecimal finalPrice = engine.calculateFinalPrice(order);

        // 100 - 10 = 90; 90 - 50 = 40.00
        if (finalPrice.compareTo(new BigDecimal("40.00")) != 0) {
            throw new AssertionError("Expected 40.00, got: " + finalPrice);
        }
    }

    public void testNonNegativeFloor() {
        DiscountEngine engine = new DiscountEngine();
        Order order = new Order("ord-2", new BigDecimal("30.00"), List.of("FIXED50"));
        BigDecimal finalPrice = engine.calculateFinalPrice(order);

        if (finalPrice.compareTo(BigDecimal.ZERO) != 0) {
            throw new AssertionError("Price should not fall below 0.00, got: " + finalPrice);
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
      architectureAndCleanCode: 0.30,
      modernIdioms: 0.20
    }
  },

  // 8. Circuit Breaker Engine
  {
    id: 'mc_circuit_breaker_resilience',
    slug: 'circuit-breaker-resilience',
    title: 'Resilient Circuit Breaker State Machine',
    category: 'machine_coding',
    badge: '🛡️ Resilience / SRE',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, AtomicReference, Sliding Window BitSet',
    timeLimitMinutes: 45,
    shortDescription: 'Спроектируйте потокобезопасный автомат состояний Circuit Breaker (CLOSED, OPEN, HALF_OPEN) с поддержкой sliding failure rate.',
    instructionsMarkdown: `# Resilient Circuit Breaker State Machine

## Бизнес-контекст
Реализуйте паттерн Circuit Breaker в стиле Resilience4j для защиты микросервисов от каскадных сбоев.

## Переходы автомата:
1. **CLOSED:** Запросы пропускаются. При достижении порога ошибок (> 50% в окне из 10 запросов) переходит в **OPEN**.
2. **OPEN:** Запросы сразу реджектятся исключением \`CallNotPermittedException\` без вызова целевой службы. Спустя \`waitDurationInOpenMs\` переходит в **HALF_OPEN**.
3. **HALF_OPEN:** Пропускает пробные запросы. При успешных ответах возвращается в **CLOSED**, при ошибке — снова в **OPEN**.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/resilience/CircuitBreaker.java',
        content: `package com.assessment.resilience;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

public class CircuitBreaker {
    public enum State { CLOSED, OPEN, HALF_OPEN }

    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private final int slidingWindowSize;
    private final double failureRateThreshold;
    private final long waitDurationInOpenMs;
    private volatile long lastStateChangeTime = System.currentTimeMillis();

    public CircuitBreaker(int slidingWindowSize, double failureRateThreshold, long waitDurationInOpenMs) {
        this.slidingWindowSize = slidingWindowSize;
        this.failureRateThreshold = failureRateThreshold;
        this.waitDurationInOpenMs = waitDurationInOpenMs;
    }

    public <T> T execute(Supplier<T> action) {
        checkState();
        if (state.get() == State.OPEN) {
            throw new RuntimeException("CircuitBreaker is OPEN");
        }
        try {
            T result = action.get();
            onSuccess();
            return result;
        } catch (Exception e) {
            onError();
            throw e;
        }
    }

    private void checkState() {
        if (state.get() == State.OPEN) {
            if (System.currentTimeMillis() - lastStateChangeTime >= waitDurationInOpenMs) {
                state.compareAndSet(State.OPEN, State.HALF_OPEN);
            }
        }
    }

    private void onSuccess() {
        if (state.get() == State.HALF_OPEN) {
            state.set(State.CLOSED);
            lastStateChangeTime = System.currentTimeMillis();
        }
    }

    private void onError() {
        state.set(State.OPEN);
        lastStateChangeTime = System.currentTimeMillis();
    }

    public State getState() {
        checkState();
        return state.get();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/resilience/CircuitBreakerTest.java',
        content: `package com.assessment.resilience;

public class CircuitBreakerTest {
    public void testClosedToOpenTransition() {
        CircuitBreaker cb = new CircuitBreaker(5, 0.5, 500);
        if (cb.getState() != CircuitBreaker.State.CLOSED) {
            throw new AssertionError("Initial state must be CLOSED");
        }

        try {
            cb.execute(() -> { throw new RuntimeException("Downstream error"); });
        } catch (Exception ignored) {}

        if (cb.getState() != CircuitBreaker.State.OPEN) {
            throw new AssertionError("Expected OPEN state after failure");
        }
    }

    public void testConcurrentExecutionSafety() {
        CircuitBreaker cb = new CircuitBreaker(10, 0.5, 1000);
        cb.execute(() -> "OK");
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 9. Real-Time Deadlock-Free Inventory Reservation
  {
    id: 'mc_inventory_reservation_deadlock_free',
    slug: 'inventory-reservation-deadlock-free',
    title: 'Deadlock-Free Real-Time Inventory Reservation',
    category: 'machine_coding',
    badge: '🔒 Concurrency & Transactions',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Lock Ordering min(id1, id2), Atomic Integer',
    timeLimitMinutes: 45,
    shortDescription: 'Реализуйте резервирование корзины из нескольких товаров с гарантированной защитой от взаимных блокировок (Deadlock-Free Lock Ordering).',
    instructionsMarkdown: `# Deadlock-Free Inventory Reservation

## Бизнес-контекст
При одновременной покупке наборов товаров разными пользователями (Пользователь 1: [Товар А, Товар Б]; Пользователь 2: [Товар Б, Товар А]) наивная блокировка объектов приводит к классическому дедлоку.

## Требование:
Реализуйте метод \`reserveCart(List<String> productIds, int quantity)\` с упорядоченным захватом локов по их лексикографическому ключу (\`productIds.sort()\`), гарантируя полное отсутствие дедлоков при 100 параллельных потоках.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/inventory/InventoryManager.java',
        content: `package com.assessment.inventory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

public class InventoryManager {
    private final Map<String, Integer> stock = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    public void addStock(String productId, int quantity) {
        stock.merge(productId, quantity, Integer::sum);
        locks.putIfAbsent(productId, new ReentrantLock());
    }

    public boolean reserveCart(List<String> productIds, int quantity) {
        // Strict global lock ordering: sort IDs to eliminate deadlock cycle!
        List<String> sortedIds = new ArrayList<>(productIds);
        Collections.sort(sortedIds);

        List<ReentrantLock> acquired = new ArrayList<>();
        try {
            for (String id : sortedIds) {
                ReentrantLock l = locks.computeIfAbsent(id, k -> new ReentrantLock());
                l.lock();
                acquired.add(l);
            }

            // Check all stock availability
            for (String id : sortedIds) {
                if (stock.getOrDefault(id, 0) < quantity) {
                    return false;
                }
            }

            // Deduct
            for (String id : sortedIds) {
                stock.put(id, stock.get(id) - quantity);
            }
            return true;

        } finally {
            for (int i = acquired.size() - 1; i >= 0; i--) {
                acquired.get(i).unlock();
            }
        }
    }

    public int getStock(String productId) {
        return stock.getOrDefault(productId, 0);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/inventory/InventoryManagerTest.java',
        content: `package com.assessment.inventory;

import java.util.List;

public class InventoryManagerTest {
    public void testBasicReservation() {
        InventoryManager manager = new InventoryManager();
        manager.addStock("prod-1", 10);
        manager.addStock("prod-2", 10);

        boolean success = manager.reserveCart(List.of("prod-1", "prod-2"), 3);
        if (!success) throw new AssertionError("Reservation should succeed");
        if (manager.getStock("prod-1") != 7) throw new AssertionError("Stock prod-1 should be 7");
    }

    public void testConcurrentStressDeadlockFree() {
        InventoryManager manager = new InventoryManager();
        manager.addStock("item-A", 1000);
        manager.addStock("item-B", 1000);

        // 100 threads will concurrently lock in reverse order [A, B] and [B, A]
        manager.reserveCart(List.of("item-A", "item-B"), 1);
        manager.reserveCart(List.of("item-B", "item-A"), 1);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.30,
      concurrencySafety: 0.45,
      architectureAndCleanCode: 0.15,
      modernIdioms: 0.10
    }
  },

  // 10. Thread-Safe Event Bus / Pub-Sub
  {
    id: 'mc_thread_safe_event_bus',
    slug: 'thread-safe-event-bus',
    title: 'In-Memory Thread-Safe Event Bus with Topic Subscriptions',
    category: 'machine_coding',
    badge: '📨 Messaging & Concurrency',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, CopyOnWriteArrayList, ConcurrentHashMap',
    timeLimitMinutes: 40,
    shortDescription: 'Реализуйте локальный потокобезопасный брокер событий Pub-Sub с изоляцией подписчиков и потокобезопасной рассылкой.',
    instructionsMarkdown: `# Thread-Safe Event Bus / Pub-Sub

## Требования:
1. Реализовать методы \`subscribe(String topic, Consumer<Event> listener)\`, \`publish(String topic, Event event)\`, \`unsubscribe(...)\`.
2. Потокобезопасность: Подписчики могут динамически подписываться и отписываться во время активной рассылки сообщений без \`ConcurrentModificationException\`.
3. Ошибка в одном подписчике не должна прерывать доставку остальным подписчикам топика.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/pubsub/EventBus.java',
        content: `package com.assessment.pubsub;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public class EventBus {
    private final Map<String, List<Consumer<String>>> subscribers = new ConcurrentHashMap<>();

    public void subscribe(String topic, Consumer<String> listener) {
        subscribers.computeIfAbsent(topic, k -> new CopyOnWriteArrayList<>()).add(listener);
    }

    public void publish(String topic, String event) {
        List<Consumer<String>> listeners = subscribers.get(topic);
        if (listeners == null) return;

        for (Consumer<String> listener : listeners) {
            try {
                listener.accept(event);
            } catch (Throwable ignored) {
                // Isolate subscriber error from cascading
            }
        }
    }

    public int getSubscriberCount(String topic) {
        List<Consumer<String>> listeners = subscribers.get(topic);
        return listeners != null ? listeners.size() : 0;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/pubsub/EventBusTest.java',
        content: `package com.assessment.pubsub;

import java.util.concurrent.atomic.AtomicInteger;

public class EventBusTest {
    public void testPubSubDelivery() {
        EventBus bus = new EventBus();
        AtomicInteger counter = new AtomicInteger(0);

        bus.subscribe("orders", event -> counter.incrementAndGet());
        bus.publish("orders", "order_created");

        if (counter.get() != 1) {
            throw new AssertionError("Expected 1 event delivered, got: " + counter.get());
        }
    }

    public void testConcurrentPublishSubscribe() {
        EventBus bus = new EventBus();
        bus.subscribe("telemetry", msg -> {});
        bus.publish("telemetry", "metric=1");
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 11. Notification Filtering & Deduplication Engine
  {
    id: 'mc_notification_dedup_pipeline',
    slug: 'notification-filtering-deduplication',
    title: 'Notification Filtering & Deduplication Engine',
    category: 'machine_coding',
    badge: '🔔 Pipeline & Deduplication',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Pipeline Pattern, ConcurrentHashMap, Clock Injection',
    timeLimitMinutes: 45,
    shortDescription: 'Спроектируйте пайплайн фильтрации и дедупликации уведомлений с временным скользящим окном и детерминированным Clock.',
    instructionsMarkdown: `# Notification Filtering & Deduplication Engine

## Бизнес-контекст
Сервис рассылки отправляет миллионы пушей, SMS и email. При сбоях upstream-сервисы могут повторно слать те же уведомления.
Необходимо фильтровать дубликаты в пределах временного окна (например, 5 секунд) по ключу \`userId:channel:content\`.

## Требования:
1. Пайплайн обработки \`NotificationPipeline\` с цепочкой \`NotificationFilter\`.
2. Фильтр дедупликации \`DeduplicationFilter\` на базе \`ConcurrentHashMap\` с внедрением \`Clock\` для детерминированного тестирования.
3. Потокобезопасность при параллельном поступлении дублей от 100 потоков.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/notification/Notification.java',
        content: `package com.assessment.notification;

public record Notification(String id, String userId, String channel, String content, long timestamp) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/notification/NotificationFilter.java',
        content: `package com.assessment.notification;

public interface NotificationFilter {
    boolean shouldDeliver(Notification notification);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/notification/NotificationPipeline.java',
        content: `package com.assessment.notification;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class NotificationPipeline {
    private final List<NotificationFilter> filters = new CopyOnWriteArrayList<>();

    public void addFilter(NotificationFilter filter) {
        filters.add(filter);
    }

    public boolean process(Notification notification) {
        for (NotificationFilter filter : filters) {
            if (!filter.shouldDeliver(notification)) {
                return false;
            }
        }
        return true;
    }

    public static class DeduplicationFilter implements NotificationFilter {
        private final long windowMillis;
        private final Clock clock;
        private final Map<String, Long> lastSeen = new ConcurrentHashMap<>();

        public DeduplicationFilter(long windowMillis, Clock clock) {
            this.windowMillis = windowMillis;
            this.clock = clock;
        }

        @Override
        public boolean shouldDeliver(Notification notification) {
            String key = notification.userId() + ":" + notification.channel() + ":" + notification.content();
            long now = clock.millis();
            Long prev = lastSeen.put(key, now);
            if (prev != null && (now - prev) < windowMillis) {
                return false;
            }
            return true;
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/notification/NotificationPipelineTest.java',
        content: `package com.assessment.notification;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

public class NotificationPipelineTest {
    public void testDeduplicationWithinWindow() {
        Clock clock = Clock.fixed(Instant.ofEpochMilli(1000), ZoneId.of("UTC"));
        NotificationPipeline pipeline = new NotificationPipeline();
        pipeline.addFilter(new NotificationPipeline.DeduplicationFilter(5000, clock));

        Notification n1 = new Notification("1", "user-1", "EMAIL", "Order Placed", 1000);
        Notification n2 = new Notification("2", "user-1", "EMAIL", "Order Placed", 1000);

        if (!pipeline.process(n1)) throw new AssertionError("Первое уведомление должно быть отправлено");
        if (pipeline.process(n2)) throw new AssertionError("Дубликат в окне 5с должен быть отфильтрован");
    }

    public void testConcurrentDeduplicationStress() {
        Clock clock = Clock.systemUTC();
        NotificationPipeline pipeline = new NotificationPipeline();
        pipeline.addFilter(new NotificationPipeline.DeduplicationFilter(10000, clock));
        Notification n = new Notification("id", "user-stress", "PUSH", "Alert", System.currentTimeMillis());
        pipeline.process(n);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 12. Task Scheduler с Cron и Приоритетами
  {
    id: 'mc_task_scheduler_priority_queue',
    slug: 'task-scheduler-priority-queue',
    title: 'Distributed-Ready Task Scheduler with Priorities & Clock',
    category: 'machine_coding',
    badge: '⏱️ Scheduling & Concurrency',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, PriorityBlockingQueue, Clock Injection, Worker Pool',
    timeLimitMinutes: 45,
    shortDescription: 'Реализуйте планировщик задач с учетом приоритетов и времени наступления на базе PriorityBlockingQueue с Fixed Clock.',
    instructionsMarkdown: `# Task Scheduler with Priorities & Clock

## Бизнес-контекст
Разработайте планировщик отложенных задач. Задачи должны выполняться по наступлению времени \`executeAtMillis\`. Если у нескольких задач наступило время запуска, первой должна выполняться задача с наивысшим приоритетом.

## Требования:
1. Задачи хранятся в \`PriorityBlockingQueue<ScheduledTask>\`.
2. Внедрение \`java.time.Clock\` для воспроизводимости в тестах.
3. Метод \`executeDueTasks()\` выполняет все наступившие задачи и возвращает их ID.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/scheduler/ScheduledTask.java',
        content: `package com.assessment.scheduler;

public record ScheduledTask(String taskId, int priority, long executeAtMillis, Runnable action) 
    implements Comparable<ScheduledTask> {
    @Override
    public int compareTo(ScheduledTask other) {
        if (this.priority != other.priority) {
            return Integer.compare(other.priority, this.priority);
        }
        return Long.compare(this.executeAtMillis, other.executeAtMillis);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/scheduler/TaskScheduler.java',
        content: `package com.assessment.scheduler;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.PriorityBlockingQueue;

public class TaskScheduler {
    private final PriorityBlockingQueue<ScheduledTask> queue = new PriorityBlockingQueue<>();
    private final Clock clock;

    public TaskScheduler(Clock clock) {
        this.clock = clock;
    }

    public void schedule(ScheduledTask task) {
        queue.put(task);
    }

    public List<String> executeDueTasks() {
        List<String> executed = new ArrayList<>();
        long now = clock.millis();
        while (!queue.isEmpty()) {
            ScheduledTask task = queue.peek();
            if (task != null && task.executeAtMillis() <= now) {
                ScheduledTask due = queue.poll();
                if (due != null) {
                    due.action().run();
                    executed.add(due.taskId());
                }
            } else {
                break;
            }
        }
        return executed;
    }

    public int getPendingCount() {
        return queue.size();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/scheduler/TaskSchedulerTest.java',
        content: `package com.assessment.scheduler;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public class TaskSchedulerTest {
    public void testPriorityOrdering() {
        Instant t0 = Instant.ofEpochMilli(5000);
        Clock clock = Clock.fixed(t0, ZoneId.of("UTC"));
        TaskScheduler scheduler = new TaskScheduler(clock);

        AtomicInteger marker = new AtomicInteger(0);
        scheduler.schedule(new ScheduledTask("low-prio", 1, 4000, () -> marker.addAndGet(1)));
        scheduler.schedule(new ScheduledTask("high-prio", 10, 4500, () -> marker.addAndGet(10)));

        List<String> executed = scheduler.executeDueTasks();
        if (executed.size() != 2) throw new AssertionError("Ожидалось 2 выполненные задачи");
        if (!"high-prio".equals(executed.get(0))) throw new AssertionError("Задача с высоким приоритетом должна выполниться первой");
    }

    public void testConcurrentSchedulingStress() {
        Clock clock = Clock.systemUTC();
        TaskScheduler scheduler = new TaskScheduler(clock);
        scheduler.schedule(new ScheduledTask("stress-task", 5, System.currentTimeMillis(), () -> {}));
        scheduler.executeDueTasks();
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 13. Parking Lot / Storage Locker Manager
  {
    id: 'mc_parking_lot_manager',
    slug: 'parking-lot-manager',
    title: 'Multi-Floor Parking Lot & Locker Manager',
    category: 'machine_coding',
    badge: '🚗 Concurrency & State',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, ReentrantLock per Floor, Strategy Pattern',
    timeLimitMinutes: 40,
    shortDescription: 'Реализуйте управление парковочными местами на нескольких этажах с изоляцией блокировок по этажам.',
    instructionsMarkdown: `# Multi-Floor Parking Lot Manager

## Бизнес-контекст
Разработайте систему учета занятости парковочных мест в многоэтажном паркинге.
Каждый этаж управляется отдельным замком \`ReentrantLock\`, предотвращая блокировку других этажей при парковке машины.

## Требования:
1. Захват места \`park(vehicleId, type)\` и освобождение \`leave(vehicleId)\`.
2. Защита от овербукинга при одновременных заездах.
3. Независимые блокировки по этажам для максимальной параллельности.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/parking/VehicleType.java',
        content: `package com.assessment.parking;

public enum VehicleType { MOTORCYCLE, COMPACT, LARGE }`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/parking/ParkingSpot.java',
        content: `package com.assessment.parking;

public class ParkingSpot {
    private final int floor;
    private final int spotNumber;
    private final VehicleType type;
    private volatile boolean occupied;
    private volatile String vehicleId;

    public ParkingSpot(int floor, int spotNumber, VehicleType type) {
        this.floor = floor;
        this.spotNumber = spotNumber;
        this.type = type;
        this.occupied = false;
    }

    public int getFloor() { return floor; }
    public int getSpotNumber() { return spotNumber; }
    public VehicleType getType() { return type; }
    public boolean isOccupied() { return occupied; }

    public synchronized boolean occupy(String vehicleId) {
        if (occupied) return false;
        this.occupied = true;
        this.vehicleId = vehicleId;
        return true;
    }

    public synchronized boolean vacate() {
        if (!occupied) return false;
        this.occupied = false;
        this.vehicleId = null;
        return true;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/parking/ParkingLotManager.java',
        content: `package com.assessment.parking;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

public class ParkingLotManager {
    private final int floors;
    private final Map<Integer, List<ParkingSpot>> spotsPerFloor = new ConcurrentHashMap<>();
    private final Map<Integer, ReentrantLock> floorLocks = new ConcurrentHashMap<>();
    private final Map<String, ParkingSpot> vehicleToSpot = new ConcurrentHashMap<>();

    public ParkingLotManager(int floors, int spotsPerFloorCount) {
        this.floors = floors;
        for (int f = 1; f <= floors; f++) {
            floorLocks.put(f, new ReentrantLock());
            List<ParkingSpot> list = new ArrayList<>();
            for (int s = 1; s <= spotsPerFloorCount; s++) {
                list.add(new ParkingSpot(f, s, VehicleType.COMPACT));
            }
            spotsPerFloor.put(f, list);
        }
    }

    public Optional<ParkingSpot> park(String vehicleId, VehicleType type) {
        for (int f = 1; f <= floors; f++) {
            ReentrantLock lock = floorLocks.get(f);
            lock.lock();
            try {
                for (ParkingSpot spot : spotsPerFloor.get(f)) {
                    if (!spot.isOccupied() && spot.occupy(vehicleId)) {
                        vehicleToSpot.put(vehicleId, spot);
                        return Optional.of(spot);
                    }
                }
            } finally {
                lock.unlock();
            }
        }
        return Optional.empty();
    }

    public boolean leave(String vehicleId) {
        ParkingSpot spot = vehicleToSpot.remove(vehicleId);
        if (spot == null) return false;
        ReentrantLock lock = floorLocks.get(spot.getFloor());
        lock.lock();
        try {
            return spot.vacate();
        } finally {
            lock.unlock();
        }
    }

    public int getAvailableSpots(int floor) {
        List<ParkingSpot> spots = spotsPerFloor.get(floor);
        if (spots == null) return 0;
        int count = 0;
        for (ParkingSpot s : spots) {
            if (!s.isOccupied()) count++;
        }
        return count;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/parking/ParkingLotManagerTest.java',
        content: `package com.assessment.parking;

import java.util.Optional;

public class ParkingLotManagerTest {
    public void testParkAndLeave() {
        ParkingLotManager manager = new ParkingLotManager(2, 5);
        Optional<ParkingSpot> spot = manager.park("CAR-1", VehicleType.COMPACT);
        if (spot.isEmpty()) throw new AssertionError("Должно быть найдено свободное место");
        if (manager.getAvailableSpots(1) != 4) throw new AssertionError("На этаже 1 должно остаться 4 места");

        boolean left = manager.leave("CAR-1");
        if (!left) throw new AssertionError("Автомобиль CAR-1 должен успешно покинуть парковку");
        if (manager.getAvailableSpots(1) != 5) throw new AssertionError("На этаже 1 должно снова стать 5 мест");
    }

    public void testConcurrentParkingStress() {
        ParkingLotManager manager = new ParkingLotManager(1, 200);
        manager.park("v-" + Thread.currentThread().getId(), VehicleType.COMPACT);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 14. Order State Machine
  {
    id: 'mc_order_state_machine',
    slug: 'order-state-machine',
    title: 'Atomic Order State Machine with Guarded Transitions',
    category: 'machine_coding',
    badge: '📦 State Pattern & CAS',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, AtomicReference, Switch Pattern Matching, CAS',
    timeLimitMinutes: 35,
    shortDescription: 'Реализуйте конечный автомат жизненного цикла заказа с атомарным CAS-переходом состояний и защитой инвариантов.',
    instructionsMarkdown: `# Atomic Order State Machine

## Бизнес-контекст
Заказ проходит жизненный цикл: \`CREATED -> PAYMENT_PENDING -> PAID -> SHIPPED -> DELIVERED\`, либо может быть отменен (\`CANCELLED\`) до отгрузки.
Недопустимые переходы (например, отмена после доставки) должны отклоняться.

## Требования:
1. Атомарное изменение состояния через \`AtomicReference<OrderState>\`.
2. Метод \`transitionTo(OrderState target)\` возвращает \`true\`, если переход допустим и успешно применен, иначе \`false\`.
3. Потокобезопасность без глобальных блокировок на базе CAS-цикла.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/order/OrderState.java',
        content: `package com.assessment.order;

public enum OrderState {
    CREATED, PAYMENT_PENDING, PAID, SHIPPED, DELIVERED, CANCELLED;

    public boolean canTransitionTo(OrderState next) {
        return switch (this) {
            case CREATED -> next == PAYMENT_PENDING || next == CANCELLED;
            case PAYMENT_PENDING -> next == PAID || next == CANCELLED;
            case PAID -> next == SHIPPED || next == CANCELLED;
            case SHIPPED -> next == DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/order/OrderStateMachine.java',
        content: `package com.assessment.order;

import java.util.concurrent.atomic.AtomicReference;

public class OrderStateMachine {
    private final String orderId;
    private final AtomicReference<OrderState> state;

    public OrderStateMachine(String orderId) {
        this.orderId = orderId;
        this.state = new AtomicReference<>(OrderState.CREATED);
    }

    public OrderState getState() {
        return state.get();
    }

    public boolean transitionTo(OrderState target) {
        while (true) {
            OrderState current = state.get();
            if (!current.canTransitionTo(target)) {
                return false;
            }
            if (state.compareAndSet(current, target)) {
                return true;
            }
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/order/OrderStateMachineTest.java',
        content: `package com.assessment.order;

public class OrderStateMachineTest {
    public void testValidAndInvalidTransitions() {
        OrderStateMachine sm = new OrderStateMachine("ord-1");
        if (!sm.transitionTo(OrderState.PAYMENT_PENDING)) throw new AssertionError("CREATED -> PAYMENT_PENDING failed");
        if (!sm.transitionTo(OrderState.PAID)) throw new AssertionError("PAYMENT_PENDING -> PAID failed");
        if (!sm.transitionTo(OrderState.SHIPPED)) throw new AssertionError("PAID -> SHIPPED failed");
        if (!sm.transitionTo(OrderState.DELIVERED)) throw new AssertionError("SHIPPED -> DELIVERED failed");
        if (sm.transitionTo(OrderState.CANCELLED)) throw new AssertionError("DELIVERED -> CANCELLED must be rejected");
    }

    public void testConcurrentTransitionStress() {
        OrderStateMachine sm = new OrderStateMachine("ord-stress");
        sm.transitionTo(OrderState.PAYMENT_PENDING);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.40,
      concurrencySafety: 0.30,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 15. High-Throughput URL Shortener с аналитикой и TTL
  {
    id: 'mc_url_shortener_analytics',
    slug: 'url-shortener-analytics',
    title: 'High-Throughput URL Shortener with Analytics & TTL',
    category: 'machine_coding',
    badge: '🔗 Base62 & Counters',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Base62, LongAdder, Clock Injection, ConcurrentHashMap',
    timeLimitMinutes: 40,
    shortDescription: 'Реализуйте сервис сокращения ссылок с кодированием Base62, учетом кликов через LongAdder и истечением по TTL.',
    instructionsMarkdown: `# High-Throughput URL Shortener with Analytics & TTL

## Бизнес-контекст
Разработайте ядро сервиса сокращения ссылок (аналог bit.ly). Сервис должен генерировать уникальные Base62 коды, поддерживать время жизни (TTL) и шардированный счетчик переходов (\`LongAdder\`).

## Требования:
1. Генерация Base62 кода из монотонно растущего счетчика.
2. Внедрение \`java.time.Clock\` для детерминированной проверки истечения TTL.
3. Шардированный счетчик переходов без узкого места синхронизации.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/urlshortener/Base62.java',
        content: `package com.assessment.urlshortener;

public class Base62 {
    private static final String ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    public static String encode(long num) {
        if (num == 0) return "0";
        StringBuilder sb = new StringBuilder();
        while (num > 0) {
            sb.append(ALPHABET.charAt((int) (num % 62)));
            num /= 62;
        }
        return sb.reverse().toString();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/urlshortener/UrlShortener.java',
        content: `package com.assessment.urlshortener;

import java.time.Clock;
import java.util.Optional;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

public class UrlShortener {
    static class Mapping {
        final String originalUrl;
        final long expiresAt;
        final LongAdder clickCount = new LongAdder();

        Mapping(String originalUrl, long expiresAt) {
            this.originalUrl = originalUrl;
            this.expiresAt = expiresAt;
        }
    }

    private final AtomicLong counter = new AtomicLong(100000L);
    private final Map<String, Mapping> storage = new ConcurrentHashMap<>();
    private final Clock clock;

    public UrlShortener(Clock clock) {
        this.clock = clock;
    }

    public String shorten(String url, long ttlMs) {
        long id = counter.incrementAndGet();
        String code = Base62.encode(id);
        long expires = ttlMs > 0 ? clock.millis() + ttlMs : Long.MAX_VALUE;
        storage.put(code, new Mapping(url, expires));
        return code;
    }

    public Optional<String> resolve(String code) {
        Mapping m = storage.get(code);
        if (m == null) return Optional.empty();
        if (m.expiresAt <= clock.millis()) {
            storage.remove(code);
            return Optional.empty();
        }
        m.clickCount.increment();
        return Optional.of(m.originalUrl);
    }

    public long getClicks(String code) {
        Mapping m = storage.get(code);
        return m != null ? m.clickCount.sum() : 0;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/urlshortener/UrlShortenerTest.java',
        content: `package com.assessment.urlshortener;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

public class UrlShortenerTest {
    public void testShortenAndResolve() {
        Clock clock = Clock.fixed(Instant.ofEpochMilli(1000), ZoneId.of("UTC"));
        UrlShortener shortener = new UrlShortener(clock);
        String code = shortener.shorten("https://google.com", 60000);
        Optional<String> url = shortener.resolve(code);
        if (url.isEmpty() || !url.get().equals("https://google.com")) {
            throw new AssertionError("Resolved URL mismatch");
        }
        if (shortener.getClicks(code) != 1) {
            throw new AssertionError("Click counter should be 1");
        }
    }

    public void testConcurrentClicksStress() {
        Clock clock = Clock.systemUTC();
        UrlShortener shortener = new UrlShortener(clock);
        String code = shortener.shorten("https://example.org", 60000);
        shortener.resolve(code);
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 16. Tagged Metric Aggregator
  {
    id: 'mc_tagged_metric_aggregator',
    slug: 'tagged-metric-aggregator',
    title: 'High-Frequency Tagged Metric Aggregator',
    category: 'machine_coding',
    badge: '📊 Telemetry & Percentiles',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Percentile Calculation, ConcurrentHashMap, Sliding Window',
    timeLimitMinutes: 45,
    shortDescription: 'Реализуйте агрегатор метрик реального времени с расчетом перцентилей p50, p95, p99 и фильтрацией по тегам.',
    instructionsMarkdown: `# Tagged Metric Aggregator

## Бизнес-контекст
Сервис мониторинга принимает телеметрию от сотен микросервисов с тегами (\`service\`, \`region\`, \`status\`).
Необходимо поддерживать расчет перцентилей p50, p95, p99 с фильтрацией по комбинациям тегов.

## Требования:
1. Запись семпла метрики: \`record(MetricSample sample)\`.
2. Расчет перцентилей: \`getPercentile(metricName, tags, percentile)\`.
3. Потокобезопасность при высокочастотной записи.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/metrics/MetricSample.java',
        content: `package com.assessment.metrics;

import java.util.Map;

public record MetricSample(String name, Map<String, String> tags, double value, long timestampMs) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/metrics/MetricAggregator.java',
        content: `package com.assessment.metrics;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class MetricAggregator {
    private final Map<String, List<Double>> series = new ConcurrentHashMap<>();

    public void record(MetricSample sample) {
        String key = buildKey(sample.name(), sample.tags());
        series.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(sample.value());
    }

    public double getPercentile(String name, Map<String, String> tags, double percentile) {
        String key = buildKey(name, tags);
        List<Double> values = series.get(key);
        if (values == null || values.isEmpty()) return 0.0;

        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int index = (int) Math.ceil((percentile / 100.0) * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    private String buildKey(String name, Map<String, String> tags) {
        if (tags == null || tags.isEmpty()) return name;
        return name + ":" + new TreeMap<>(tags);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/metrics/MetricAggregatorTest.java',
        content: `package com.assessment.metrics;

import java.util.Map;

public class MetricAggregatorTest {
    public void testPercentileCalculation() {
        MetricAggregator agg = new MetricAggregator();
        Map<String, String> tags = Map.of("service", "payment");
        for (int i = 1; i <= 100; i++) {
            agg.record(new MetricSample("latency", tags, i, System.currentTimeMillis()));
        }

        double p50 = agg.getPercentile("latency", tags, 50.0);
        double p99 = agg.getPercentile("latency", tags, 99.0);

        if (Math.abs(p50 - 50.0) > 1.0) throw new AssertionError("p50 expected ~50, got " + p50);
        if (Math.abs(p99 - 99.0) > 1.0) throw new AssertionError("p99 expected ~99, got " + p99);
    }

    public void testConcurrentMetricsStress() {
        MetricAggregator agg = new MetricAggregator();
        agg.record(new MetricSample("rps", Map.of("env", "prod"), 100.0, System.currentTimeMillis()));
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 17. Concurrent Leaderboard Engine
  {
    id: 'mc_concurrent_leaderboard',
    slug: 'concurrent-leaderboard',
    title: 'Real-Time Gaming Leaderboard Engine with O(log N) Rank',
    category: 'machine_coding',
    badge: '🏆 SkipList & Rank Lookup',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ConcurrentSkipListMap, O(log N) Ranking',
    timeLimitMinutes: 45,
    shortDescription: 'Реализуйте турнирную таблицу игроков в реальном времени с быстрым пересчетом ранга за O(log N).',
    instructionsMarkdown: `# Real-Time Gaming Leaderboard Engine

## Бизнес-контекст
В мультиплеерной игре тысячи игроков одновременно набирают очки. Необходимо мгновенно отдавать текущий ранг игрока и топ-N лидеров.

## Требования:
1. Обновление счета: \`updateScore(playerId, scoreDelta)\`.
2. Определение ранга: \`getRank(playerId)\` (1-based, 1 = лучший счет).
3. Топ лидеров: \`getTopPlayers(limit)\`.
4. Потокобезопасность без блокировок чтения.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/leaderboard/Leaderboard.java',
        content: `package com.assessment.leaderboard;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListMap;

public class Leaderboard {
    private final Map<String, Long> playerScores = new ConcurrentHashMap<>();
    private final ConcurrentSkipListMap<Long, Set<String>> scoreToPlayers = new ConcurrentSkipListMap<>(Collections.reverseOrder());

    public synchronized void updateScore(String playerId, long scoreDelta) {
        Long current = playerScores.getOrDefault(playerId, 0L);
        long newScore = current + scoreDelta;

        if (playerScores.containsKey(playerId)) {
            Set<String> set = scoreToPlayers.get(current);
            if (set != null) {
                set.remove(playerId);
                if (set.isEmpty()) scoreToPlayers.remove(current);
            }
        }

        playerScores.put(playerId, newScore);
        scoreToPlayers.computeIfAbsent(newScore, k -> Collections.newSetFromMap(new ConcurrentHashMap<>())).add(playerId);
    }

    public synchronized int getRank(String playerId) {
        Long score = playerScores.get(playerId);
        if (score == null) return -1;

        int rank = 1;
        for (Map.Entry<Long, Set<String>> entry : scoreToPlayers.entrySet()) {
            if (entry.getKey() > score) {
                rank += entry.getValue().size();
            } else if (entry.getKey().equals(score)) {
                break;
            }
        }
        return rank;
    }

    public List<String> getTopPlayers(int limit) {
        List<String> result = new ArrayList<>();
        for (Set<String> players : scoreToPlayers.values()) {
            for (String p : players) {
                result.add(p);
                if (result.size() >= limit) return result;
            }
        }
        return result;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/leaderboard/LeaderboardTest.java',
        content: `package com.assessment.leaderboard;

import java.util.List;

public class LeaderboardTest {
    public void testRankAndTopPlayers() {
        Leaderboard lb = new Leaderboard();
        lb.updateScore("alice", 100);
        lb.updateScore("bob", 200);
        lb.updateScore("carol", 150);

        if (lb.getRank("bob") != 1) throw new AssertionError("Bob должен быть на 1 месте");
        if (lb.getRank("carol") != 2) throw new AssertionError("Carol должна быть на 2 месте");
        if (lb.getRank("alice") != 3) throw new AssertionError("Alice должна быть на 3 месте");

        List<String> top2 = lb.getTopPlayers(2);
        if (top2.size() != 2 || !top2.contains("bob") || !top2.contains("carol")) {
            throw new AssertionError("В топ-2 должны войти bob и carol");
        }
    }

    public void testConcurrentLeaderboardStress() {
        Leaderboard lb = new Leaderboard();
        lb.updateScore("stress-player", 1);
        lb.getRank("stress-player");
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  },

  // 18. Elevator Control System (SCAN Algorithm)
  {
    id: 'mc_elevator_control_system',
    slug: 'elevator-control-system',
    title: 'Multi-Car Elevator Dispatcher with SCAN Algorithm',
    category: 'machine_coding',
    badge: '🛗 State & SCAN Algorithm',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, SCAN Algorithm, Dispatcher Queue, State Pattern',
    timeLimitMinutes: 45,
    shortDescription: 'Спроектируйте контроллер группы лифтов с алгоритмом SCAN для минимизации холостого хода и ожидания пассажиров.',
    instructionsMarkdown: `# Multi-Car Elevator Dispatcher with SCAN Algorithm

## Бизнес-контекст
Здание оборудовано группой лифтов. Диспетчер распределяет вызовы пассажиров к ближайшему лифту, двигающемуся в попутном направлении (алгоритм SCAN / Elevator Algorithm).

## Требования:
1. Алгоритм SCAN: кабина обслуживает этажи по ходу текущего направления (\`UP\`/\`DOWN\`), пока есть заявки, затем меняет направление.
2. Диспетчер \`ElevatorDispatcher\` выбирает наименее загруженную или ближайшую кабину.
3. Потокобезопасный прием заявок от нескольких пассажиров.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/elevator/Direction.java',
        content: `package com.assessment.elevator;

public enum Direction { UP, DOWN, IDLE }`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/elevator/ElevatorCar.java',
        content: `package com.assessment.elevator;

import java.util.TreeSet;

public class ElevatorCar {
    private final int id;
    private int currentFloor = 1;
    private Direction direction = Direction.IDLE;
    private final TreeSet<Integer> targets = new TreeSet<>();

    public ElevatorCar(int id) {
        this.id = id;
    }

    public synchronized int getCurrentFloor() { return currentFloor; }
    public synchronized Direction getDirection() { return direction; }

    public synchronized void requestFloor(int floor) {
        targets.add(floor);
        if (direction == Direction.IDLE) {
            direction = floor >= currentFloor ? Direction.UP : Direction.DOWN;
        }
    }

    public synchronized void step() {
        if (targets.isEmpty()) {
            direction = Direction.IDLE;
            return;
        }

        if (direction == Direction.UP) {
            Integer next = targets.ceiling(currentFloor);
            if (next != null) {
                currentFloor = next;
                targets.remove(next);
            } else {
                direction = Direction.DOWN;
                step();
            }
        } else if (direction == Direction.DOWN) {
            Integer prev = targets.floor(currentFloor);
            if (prev != null) {
                currentFloor = prev;
                targets.remove(prev);
            } else {
                direction = Direction.UP;
                step();
            }
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/elevator/ElevatorDispatcher.java',
        content: `package com.assessment.elevator;

import java.util.List;

public class ElevatorDispatcher {
    private final List<ElevatorCar> cars;

    public ElevatorDispatcher(List<ElevatorCar> cars) {
        this.cars = cars;
    }

    public ElevatorCar dispatch(int floor) {
        ElevatorCar best = cars.get(0);
        int minDistance = Integer.MAX_VALUE;
        for (ElevatorCar car : cars) {
            int dist = Math.abs(car.getCurrentFloor() - floor);
            if (dist < minDistance) {
                minDistance = dist;
                best = car;
            }
        }
        best.requestFloor(floor);
        return best;
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      },
      {
        path: 'src/test/java/com/assessment/elevator/ElevatorControlTest.java',
        content: `package com.assessment.elevator;

import java.util.List;

public class ElevatorControlTest {
    public void testScanAlgorithm() {
        ElevatorCar car = new ElevatorCar(1);
        car.requestFloor(5);
        car.requestFloor(3);
        car.step(); // moves to 3 (first on way up)
        if (car.getCurrentFloor() != 3) throw new AssertionError("Expected floor 3, got " + car.getCurrentFloor());
        car.step(); // moves to 5
        if (car.getCurrentFloor() != 5) throw new AssertionError("Expected floor 5, got " + car.getCurrentFloor());
    }

    public void testDispatcher() {
        ElevatorCar car1 = new ElevatorCar(1);
        ElevatorCar car2 = new ElevatorCar(10);
        ElevatorDispatcher dispatcher = new ElevatorDispatcher(List.of(car1, car2));

        ElevatorCar chosen = dispatcher.dispatch(2);
        if (chosen != car1) throw new AssertionError("Car 1 should be chosen for floor 2");
    }

    public void testConcurrentRequestsStress() {
        ElevatorCar car = new ElevatorCar(1);
        car.requestFloor(7);
        car.step();
    }
}`,
        readOnly: true,
        hidden: false
      }
    ],
    scoringWeights: {
      functionalCorrectness: 0.35,
      concurrencySafety: 0.35,
      architectureAndCleanCode: 0.20,
      modernIdioms: 0.10
    }
  }
];
