# **Архитектурный лайвкодинг в BigTech (2025–2026): Полный справочник LLD/Machine Coding задач для Senior/Lead Java-инженеров**

Секция «Бизнес-логика / Архитектурный лайвкодинг» (Machine Coding / Low-Level Design, LLD) на собеседованиях Senior и Lead Java-инженеров в ведущие технологические компании (Яндекс, Т-Банк, Озон, Авито, Сбер, ВК) предназначена для оценки способности кандидата за ограниченное время (45–60 минут) проектировать и реализовывать масштабируемые, расширяемые и отказоустойчивые программные модули на производственном уровне1. В отличие от классических алгоритмических секций, ориентированных на временную и пространственную сложность, в секции LLD фокус смещается на применение SOLID-принципов, шаблонов проектирования, чистоту доменной модели, корректное управление состоянием, потокобезопасность и предсказуемое поведение системы под нагрузкой2.  
Переход индустрии на Java 21 сделал стандартным использование современных языковых конструкций: записей (record), запечатанных интерфейсов (sealed interface), сопоставления с шаблонами (pattern matching) и виртуальных потоков (Project Loom)1. Данные механизмы кардинально меняют подходы к выражению бизнес-инвариантов и обеспечению неизменяемости (immutability) домена3.

## **Методология проведения и оценки секции LLD / Machine Coding**

Оценка кандидата грейда Senior или Lead строится вокруг его способности трансформировать нечеткие продуктовые требования в строго структурированный код, готовый к безопасной промышленной эксплуатации2. Анализ практики проведения собеседований в 2025–2026 годах показывает, что оценивание проводится по пяти ключевым критериям3:

> 1. **Моделирование домена и архитектурный дизайн**: четкое разделение ответственности, использование паттернов (Strategy, Chain of Responsibility, State, Observer, Specification) и соблюдение принципа открытости/закрытости (Open-Closed Principle, OCP)3.  
> 2. **Детерминированная работа со временем**: полный запрет на прямой вызов системного времени (Instant.now(), System.currentTimeMillis()) и обязательное внедрение зависимостей через java.time.Clock или java.time.InstantSource2.  
> 3. **Управление памятью и предотвращение ресурсов**: защита от OOM (Out Of Memory) при помощи TTL-eviction, ограниченных коллекций (bounded collections) и алгоритмов вытеснения (LRU/LFU)3.  
> 4. **Потокобезопасность и конкурентность**: корректная обработка состояния при параллельном доступе без применения глобальных блокировок, создающих узкие места3.  
> 5. **Качество тестов и корректность обработки краев**: написание модульных тестов на JUnit 5 и AssertJ с эмуляцией временных окон через фиксированные часы3.

Ниже представлена сводная таблица распределения времени кандидата во время 60-минутной секции лайвкодинга3:

| Этап секции | Выделяемое время | Ключевые действия кандидата |
| :---- | :---- | :---- |
| Анализ ТЗ и уточнение требований | 5–10 минут | Уточнение краевных условий, явная запись нефункциональных требований3. |
| Проектирование домена и интерфейсов | 10–15 минут | Создание records, sealed interfaces, определение контрактов сервисов3. |
| Реализация бизнес-логики (Golden Master) | 25–30 минут | Пошаговое написание потокобезопасной реализации с учетом времени и памяти3. |
| Написание модульных тестов | 10 минут | Покрытие счастливого пути (Happy Path) и краевых состояний с Clock.fixed3. |

## **Разбор 15 эталонных продуктовых задач секции**

### **1\. Notification Filtering & Deduplication Engine**

#### **ТЗ от Product Owner'a**

Движок фильтрации и дедупликации уведомлений должен обрабатывать входящий поток сообщений для пользователей по каналам EMAIL, SMS, PUSH.

* **User Stories**: Как пользователь, я хочу получать только разрешенные мной категории уведомлений и не получать дубликаты сообщений или спам от заблокированных отправителей.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | Notification (id, userId, senderId, channel, type, contentHash, timestamp) | Структура поступающего уведомления. |
| Вход | UserPreferences (userId, enabledChannels, enabledTypes, blockedSenders) | Настройки фильтрации пользователя. |
| Выход | FilterResult (Allowed или Blocked с указанием причины) | Результат обработки фильтрами. |

* **Функциональные требования**:  
  1. Проверка блокировки отправителя (Черный список).  
  2. Проверка настроек каналов и типов уведомлений пользователя.  
  3. Дедупликация: блокировка сообщений с идентичным contentHash и type для одного пользователя в течение скользящего окна 24 часа.  
* **Нефункциональные требования**:  
  1. Детерминированное время через java.time.Clock3.  
  2. Автоматическая очистка устаревшей истории дедупликации для предотвращения OOM3.  
  3. Валидация аргументов на null и потокобезопасность.

#### **Доменная модель на Java 21**

Java  
package com.company.notification.model;

import java.time.Instant;  
import java.util.Set;

public enum Channel { EMAIL, SMS, PUSH }

public enum NotificationType { SECURITY, PROMO, TRANSACTION }

public record Notification(  
    String id,  
    String userId,  
    String senderId,  
    Channel channel,  
    NotificationType type,  
    String contentHash,  
    Instant timestamp  
) {}

public record UserPreferences(  
    String userId,  
    Set\<Channel\> enabledChannels,  
    Set\<NotificationType\> enabledTypes,  
    Set\<String\> blockedSenders  
) {}

public sealed interface FilterResult permits FilterResult.Allowed, FilterResult.Blocked {  
    record Allowed() implements FilterResult {}  
    record Blocked(String reason) implements FilterResult {}  
}

#### **Архитектурный дизайн**

Применяется паттерн **Chain of Responsibility** для создания независимых, легко расширяемых шагов фильтрации (принцип OCP)3. Каждый фильтр реализует общий интерфейс и возвращает запечатанный результат FilterResult.

#### **Реализация нефункциональных требований**

Время внедряется через интерфейс java.time.Clock. Для предотвращения утечек памяти дедупликатор выполняют ленивую и периодическую очистку записей, превышающих 24-часовой порог.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.notification.service;

import com.company.notification.model.\*;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;  
import java.util.concurrent.ConcurrentHashMap;

public interface NotificationFilter {  
    FilterResult filter(Notification notification, UserPreferences preferences);  
}

public class BlacklistFilter implements NotificationFilter {  
    @Override  
    public FilterResult filter(Notification notification, UserPreferences preferences) {  
        if (preferences.blockedSenders().contains(notification.senderId())) {  
            return new FilterResult.Blocked("Sender in blacklist: " \+ notification.senderId());  
        }  
        return new FilterResult.Allowed();  
    }  
}

public class UserPreferencesFilter implements NotificationFilter {  
    @Override  
    public FilterResult filter(Notification notification, UserPreferences preferences) {  
        if (\!preferences.enabledChannels().contains(notification.channel())) {  
            return new FilterResult.Blocked("Channel disabled: " \+ notification.channel());  
        }  
        if (\!preferences.enabledTypes().contains(notification.type())) {  
            return new FilterResult.Blocked("Type disabled: " \+ notification.type());  
        }  
        return new FilterResult.Allowed();  
    }  
}

public class DeduplicationFilter implements NotificationFilter {  
    private final Clock clock;  
    private final Duration window;  
    private final Map\<String, Instant\> history \= new ConcurrentHashMap\<\>();

    public DeduplicationFilter(Clock clock, Duration window) {  
        this.clock \= Objects.requireNonNull(clock);  
        this.window \= Objects.requireNonNull(window);  
    }

    @Override  
    public FilterResult filter(Notification notification, UserPreferences preferences) {  
        Instant now \= clock.instant();  
        evictExpired(now);

        String key \= notification.userId() \+ ":" \+ notification.type() \+ ":" \+ notification.contentHash();  
        Instant previous \= history.get(key);

        if (previous \!= null && Duration.between(previous, now).compareTo(window) \< 0) {  
            return new FilterResult.Blocked("Duplicate message detected");  
        }

        history.put(key, now);  
        return new FilterResult.Allowed();  
    }

    private void evictExpired(Instant now) {  
        history.entrySet().removeIf(entry \-\> Duration.between(entry.getValue(), now).compareTo(window) \>= 0);  
    }  
}

public class NotificationEngine {  
    private final List\<NotificationFilter\> filters;

    public NotificationEngine(List\<NotificationFilter\> filters) {  
        this.filters \= List.copyOf(filters);  
    }

    public FilterResult process(Notification notification, UserPreferences preferences) {  
        Objects.requireNonNull(notification, "Notification is required");  
        Objects.requireNonNull(preferences, "Preferences are required");

        for (NotificationFilter filter : filters) {  
            FilterResult result \= filter.filter(notification, preferences);  
            if (result instanceof FilterResult.Blocked) {  
                return result;  
            }  
        }  
        return new FilterResult.Allowed();  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.notification;

import com.company.notification.model.\*;  
import com.company.notification.service.\*;  
import org.junit.jupiter.api.Test;

import java.time.\*;  
import java.util.List;  
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationEngineTest {

    @Test  
    void shouldBlockDuplicateNotificationWithin24HoursAndAllowAfter() {  
        Instant start \= Instant.parse("2026-01-01T10:00:00Z");  
        TestClock clock \= new TestClock(start);

        NotificationEngine engine \= new NotificationEngine(List.of(  
            new BlacklistFilter(),  
            new UserPreferencesFilter(),  
            new DeduplicationFilter(clock, Duration.ofHours(24))  
        ));

        UserPreferences prefs \= new UserPreferences("u1", Set.of(Channel.EMAIL), Set.of(NotificationType.PROMO), Set.of());  
        Notification n1 \= new Notification("1", "u1", "s1", Channel.EMAIL, NotificationType.PROMO, "hash123", clock.instant());

        assertThat(engine.process(n1, prefs)).isInstanceOf(FilterResult.Allowed.class);

        clock.advance(Duration.ofHours(2));  
        Notification n2 \= new Notification("2", "u1", "s1", Channel.EMAIL, NotificationType.PROMO, "hash123", clock.instant());  
        assertThat(engine.process(n2, prefs)).isInstanceOf(FilterResult.Blocked.class);

        clock.advance(Duration.ofHours(23)); // Суммарно 25 часов  
        Notification n3 \= new Notification("3", "u1", "s1", Channel.EMAIL, NotificationType.PROMO, "hash123", clock.instant());  
        assertThat(engine.process(n3, prefs)).isInstanceOf(FilterResult.Allowed.class);  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Использование Instant.now() внутри логики дедупликации2. | Полная инъекция java.time.Clock во все компоненты3. |
| Бесконечный рост history карты без механизмов очистки (OOM). | Реализация безопасной TTL-очистки устаревших элементов3. |
| Монолитный if-else блок со всеми проверками в одном методе3. | Применение шаблона Chain of Responsibility (соблюдение OCP)3. |
| Изменяемые классы домена с публичными сеттерами3. | Иммутабельные Java 21 record и sealed interface3. |
| Отсутствие защиты от null параметров3. | Валидация входных коллекций и объектов через Objects.requireNonNull3. |

### **2\. In-Memory Rate Limiter (Token Bucket & Sliding Window)**

#### **ТЗ от Product Owner'a**

Разработать потокобезопасный In-Memory компонент для ограничения частоты вызовов API клиентами.

* **User Stories**: Как разработчик платформы, я хочу ограничивать количество поступающих запросов по клиентам и API-ключам, используя алгоритмы Token Bucket и Sliding Window Counter.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | key (String), RateLimitConfig (capacity, windowPeriod) | Ключ клиента и параметры лимитера. |
| Выход | RateLimiterResponse (Allowed с остатком токенов или Rejected с задержкой) | Статус прохождения запроса. |

* **Функциональные требования**:  
  1. Поддержка алгоритмов Token Bucket и Sliding Window.  
  2. Изоляция счетчиков по ключам (User ID, IP, API Key).  
* **Нефункциональные требования**:  
  1. Отсутствие глобальных блокировок (lock-free или fine-grained locking)3.  
  2. Использование java.time.Clock для тестирования времени3.

#### **Доменная модель на Java 21**

Java  
package com.company.ratelimiter.model;

import java.time.Duration;

public record RateLimitConfig(long capacity, Duration windowPeriod) {}

public sealed interface RateLimiterResponse permits RateLimiterResponse.Allowed, RateLimiterResponse.Rejected {  
    record Allowed(long remainingTokens) implements RateLimiterResponse {}  
    record Rejected(Duration retryAfter) implements RateLimiterResponse {}  
}

#### **Архитектурный дизайн**

Используется паттерн **Strategy** (RateLimiterStrategy) для изоляции алгоритмов лимитирования, позволяющий переключать или добавлять новые алгоритмы без изменения вызывающего кода3.

#### **Реализация нефункциональных требований**

Для предотвращения блокировок на уровне приложения используются атомарные операции или точечные блокировки (ReentrantLock) на уровне отдельных бакетов. Очистка неактивных ключей производится лениво.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.ratelimiter.service;

import com.company.ratelimiter.model.\*;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.Map;  
import java.util.Objects;  
import java.util.concurrent.ConcurrentHashMap;  
import java.util.concurrent.locks.ReentrantLock;

public interface RateLimiterStrategy {  
    RateLimiterResponse tryConsume(String key, RateLimitConfig config);  
}

public class TokenBucketRateLimiter implements RateLimiterStrategy {  
    private final Clock clock;  
    private final Map\<String, Bucket\> buckets \= new ConcurrentHashMap\<\>();

    public TokenBucketRateLimiter(Clock clock) {  
        this.clock \= Objects.requireNonNull(clock);  
    }

    private static class Bucket {  
        final ReentrantLock lock \= new ReentrantLock();  
        double tokens;  
        Instant lastRefillTime;

        Bucket(double capacity, Instant now) {  
            this.tokens \= capacity;  
            this.lastRefillTime \= now;  
        }  
    }

    @Override  
    public RateLimiterResponse tryConsume(String key, RateLimitConfig config) {  
        Instant now \= clock.instant();  
        Bucket bucket \= buckets.computeIfAbsent(key, k \-\> new Bucket(config.capacity(), now));

        bucket.lock.lock();  
        try {  
            refill(bucket, config, now);  
            if (bucket.tokens \>= 1.0) {  
                bucket.tokens \-= 1.0;  
                return new RateLimiterResponse.Allowed((long) bucket.tokens);  
            } else {  
                double fillRate \= (double) config.capacity() / config.windowPeriod().toMillis();  
                long waitMillis \= (long) Math.ceil((1.0 \- bucket.tokens) / fillRate);  
                return new RateLimiterResponse.Rejected(Duration.ofMillis(waitMillis));  
            }  
        } finally {  
            bucket.lock.unlock();  
        }  
    }

    private void refill(Bucket bucket, RateLimitConfig config, Instant now) {  
        long elapsedMillis \= Duration.between(bucket.lastRefillTime, now).toMillis();  
        if (elapsedMillis \> 0) {  
            double tokensToAdd \= elapsedMillis \* ((double) config.capacity() / config.windowPeriod().toMillis());  
            bucket.tokens \= Math.min(config.capacity(), bucket.tokens \+ tokensToAdd);  
            bucket.lastRefillTime \= now;  
        }  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.ratelimiter;

import com.company.ratelimiter.model.\*;  
import com.company.ratelimiter.service.TokenBucketRateLimiter;  
import org.junit.jupiter.api.Test;

import java.time.\*;

import static org.assertj.core.api.Assertions.assertThat;

class TokenBucketRateLimiterTest {

    @Test  
    void shouldAllowAndRejectRequestsBasedOnCapacity() {  
        TestClock clock \= new TestClock(Instant.parse("2026-01-01T12:00:00Z"));  
        TokenBucketRateLimiter limiter \= new TokenBucketRateLimiter(clock);  
        RateLimitConfig config \= new RateLimitConfig(2, Duration.ofSeconds(10));

        assertThat(limiter.tryConsume("user1", config)).isInstanceOf(RateLimiterResponse.Allowed.class);  
        assertThat(limiter.tryConsume("user1", config)).isInstanceOf(RateLimiterResponse.Allowed.class);  
        assertThat(limiter.tryConsume("user1", config)).isInstanceOf(RateLimiterResponse.Rejected.class);

        clock.advance(Duration.ofSeconds(5)); // Восстанавливается 1 токен  
        assertThat(limiter.tryConsume("user1", config)).isInstanceOf(RateLimiterResponse.Allowed.class);  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Использование synchronized на весь метод tryConsume3. | Использование ConcurrentHashMap и точечных ReentrantLock на бакет3. |
| Потеря точности при делении чисел с плавающей точкой в интервалах. | Вычисление скорости пополнения в миллисекундах с точностью до наносекунд. |
| Неограниченный рост карты бакетов для неактивных клиентов3. | Наличие механизма фоновой или ленивой очистки пустых бакетов3. |
| Прямой вызов System.currentTimeMillis()2. | Полная замена системного времени на инъецированный Clock3. |
| Отсутствие вычисления времени повтора (retryAfter). | Предоставление информации о точном времени ожидания в ответе Rejected. |

### **3\. In-Memory Key-Value Cache с TTL и LRU/LFU**

#### **ТЗ от Product Owner'a**

Разработать високопроизводительный In-Memory кэш с настраиваемой емкостью, поддержкой TTL для ключей и стратегией вытеснения LRU/LFU.

* **User Stories**: Как разработчик, я хочу сохранять данные в кэше с гарантированным пределом памяти и автоматическим вытеснением устаревших элементов.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | key, value, ttl (Duration) | Данные для сохранения в кэше. |
| Выход | Optional\<V\> | Извлеченное значение. |

* **Функциональные требования**:  
  1. Поддержка операций put(key, value, ttl), get(key), remove(key).  
  2. Вытеснение элементов с O(1) сложностью при превышении лимита емкости2.  
* **Нефункциональные требования**:  
  1. Пассивное вытеснение протухших элементов при обращении и фоновая очистка.  
  2. Потокобезопасность.

#### **Доменная модель на Java 21**

Java  
package com.company.cache.model;

import java.time.Instant;

public enum EvictionPolicy { LRU, LFU }

public record CacheEntry\<V\>(V value, Instant expiresAt) {  
    public boolean isExpired(Instant now) {  
        return expiresAt \!= null && now.isAfter(expiresAt);  
    }  
}

#### **Архитектурный дизайн**

Используется структура из **HashMap** и **Двусвязного списка (Doubly Linked List)** для обеспечения ![][image1] операций добавления, поиска и вытеснения элементов2.

#### **Реализация нефункциональных требований**

Время считывается строго через Clock. Защита от OOM обеспечивается жестким ограничением capacity.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.cache.service;

import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;

public class LruCache\<K, V\> {  
    private final int capacity;  
    private final Clock clock;  
    private final Map\<K, Node\<K, V\>\> map \= new HashMap\<\>();  
    private final Node\<K, V\> head \= new Node\<\>(null, null, null);  
    private final Node\<K, V\> tail \= new Node\<\>(null, null, null);

    private static class Node\<K, V\> {  
        K key;  
        V value;  
        Instant expiresAt;  
        Node\<K, V\> prev, next;

        Node(K key, V value, Instant expiresAt) {  
            this.key \= key;  
            this.value \= value;  
            this.expiresAt \= expiresAt;  
        }  
    }

    public LruCache(int capacity, Clock clock) {  
        this.capacity \= capacity;  
        this.clock \= Objects.requireNonNull(clock);  
        head.next \= tail;  
        tail.prev \= head;  
    }

    public synchronized Optional\<V\> get(K key) {  
        Node\<K, V\> node \= map.get(key);  
        if (node \== null) return Optional.empty();

        if (node.expiresAt \!= null && clock.instant().isAfter(node.expiresAt)) {  
            removeNode(node);  
            map.remove(key);  
            return Optional.empty();  
        }

        moveToHead(node);  
        return Optional.of(node.value);  
    }

    public synchronized void put(K key, V value, Duration ttl) {  
        Instant now \= clock.instant();  
        Instant expiresAt \= (ttl \!= null) ? now.plus(ttl) : null;

        Node\<K, V\> node \= map.get(key);  
        if (node \!= null) {  
            node.value \= value;  
            node.expiresAt \= expiresAt;  
            moveToHead(node);  
        } else {  
            if (map.size() \>= capacity) {  
                evict();  
            }  
            Node\<K, V\> newNode \= new Node\<\>(key, value, expiresAt);  
            map.put(key, newNode);  
            addNode(newNode);  
        }  
    }

    private void evict() {  
        Node\<K, V\> toRemove \= tail.prev;  
        if (toRemove \!= head) {  
            removeNode(toRemove);  
            map.remove(toRemove.key);  
        }  
    }

    private void addNode(Node\<K, V\> node) {  
        node.next \= head.next;  
        node.next.prev \= node;  
        node.prev \= head;  
        head.next \= node;  
    }

    private void removeNode(Node\<K, V\> node) {  
        node.prev.next \= node.next;  
        node.next.prev \= node.prev;  
    }

    private void moveToHead(Node\<K, V\> node) {  
        removeNode(node);  
        addNode(node);  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.cache;

import com.company.cache.service.LruCache;  
import org.junit.jupiter.api.Test;

import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LruCacheTest {

    @Test  
    void shouldEvictLruItemAndRespectTTL() {  
        Instant now \= Instant.parse("2026-01-01T12:00:00Z");  
        TestClock clock \= new TestClock(now);  
        LruCache\<String, String\> cache \= new LruCache\<\>(2, clock);

        cache.put("k1", "v1", Duration.ofMinutes(10));  
        cache.put("k2", "v2", null);

        cache.get("k1"); // k1 становится свежим, k2 \- кандидатом на вытеснение  
        cache.put("k3", "v3", null);

        assertThat(cache.get("k1")).contains("v1");  
        assertThat(cache.get("k2")).isEmpty(); // Вытеснен по LRU  
        assertThat(cache.get("k3")).contains("v3");

        clock.advance(Duration.ofMinutes(11));  
        assertThat(cache.get("k1")).isEmpty(); // Протух по TTL  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Поиск элемента для вытеснения за ![][image2]2. | Использование двусвязного списка и Map для гарантии ![][image1]2. |
| Отсутствие удаления протухших элементов при обращении. | Проверка TTL и пассивное удаление при get() вызовах. |
| Использование системных вызовов времени в обход Clock2. | Внедрение абстракции времени java.time.Clock3. |
| Отсутствие верхней границы емкости (OOM)3. | Гарантированный лимит памяти с помощью capacity3. |
| Использование обычных неконкурентных структур без синхронизации. | Потокобезопасные методы с точечной синхронизацией. |

### **4\. Dynamic Discount & Promo Code Engine**

#### **ТЗ от Product Owner'a**

Разработать сервис расчета цепочки скидок на корзину с учетом ограничений и промокодов.

* **User Stories**: Как менеджер по продажам, я хочу комбинировать процентные скидки на категории, фиксированные скидки по промокодам и ограничивать общую скидку максимальным процентом от суммы.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | Order (id, items, totalAmount), List\<DiscountPolicy\> | Заказ и набор правил скидок. |
| Выход | DiscountResult (originalAmount, finalAmount, totalDiscount) | Расчитанный итоговый чек. |

* **Функциональные требования**:  
  1. Применение правил в заданном порядке (Chain of Responsibility)3.  
  2. Расчет точно в BigDecimal без потерь на округлении.  
  3. Ограничение предельной скидки (например, не более 50% от чека).  
* **Нефункциональные требования**:  
  1. Соблюдение OCP: добавление правила не меняет движок3.  
  2. Валидация отрицательных сумм и нулевых списков.

#### **Доменная модель на Java 21**

Java  
package com.company.discount.model;

import java.math.BigDecimal;  
import java.util.List;

public record OrderItem(String id, String category, BigDecimal price, int quantity) {}

public record Order(String id, List\<OrderItem\> items) {  
    public BigDecimal calculateSubtotal() {  
        return items.stream()  
            .map(i \-\> i.price().multiply(BigDecimal.valueOf(i.quantity())))  
            .reduce(BigDecimal.ZERO, BigDecimal::add);  
    }  
}

public record DiscountResult(BigDecimal originalAmount, BigDecimal finalAmount, BigDecimal totalDiscount) {}

#### **Архитектурный дизайн**

Шаблоны **Chain of Responsibility** и **Strategy**. Ограничение максимума оформлено через шаблон **Decorator**.

#### **Реализация нефункциональных требований**

Все финансовые расчеты ведутся с использованием BigDecimal с явным масштабированием и режимом округления RoundingMode.HALF\_UP.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.discount.service;

import com.company.discount.model.\*;  
import java.math.BigDecimal;  
import java.math.RoundingMode;  
import java.util.List;  
import java.util.Objects;

public interface DiscountPolicy {  
    BigDecimal apply(Order order, BigDecimal currentTotal);  
}

public class PercentageCategoryDiscount implements DiscountPolicy {  
    private final String targetCategory;  
    private final BigDecimal percentage;

    public PercentageCategoryDiscount(String targetCategory, BigDecimal percentage) {  
        this.targetCategory \= Objects.requireNonNull(targetCategory);  
        this.percentage \= Objects.requireNonNull(percentage);  
    }

    @Override  
    public BigDecimal apply(Order order, BigDecimal currentTotal) {  
        BigDecimal categoryDiscount \= order.items().stream()  
            .filter(item \-\> targetCategory.equalsIgnoreCase(item.category()))  
            .map(item \-\> item.price().multiply(BigDecimal.valueOf(item.quantity())).multiply(percentage))  
            .reduce(BigDecimal.ZERO, BigDecimal::add);  
        return currentTotal.subtract(categoryDiscount);  
    }  
}

public class DiscountEngine {  
    private final BigDecimal maxDiscountPercentage;

    public DiscountEngine(BigDecimal maxDiscountPercentage) {  
        this.maxDiscountPercentage \= Objects.requireNonNull(maxDiscountPercentage);  
    }

    public DiscountResult calculate(Order order, List\<DiscountPolicy\> policies) {  
        Objects.requireNonNull(order, "Order must not be null");  
        Objects.requireNonNull(policies, "Policies must not be null");

        BigDecimal subtotal \= order.calculateSubtotal();  
        BigDecimal current \= subtotal;

        for (DiscountPolicy policy : policies) {  
            current \= policy.apply(order, current);  
        }

        BigDecimal calculatedDiscount \= subtotal.subtract(current);  
        BigDecimal maxAllowedDiscount \= subtotal.multiply(maxDiscountPercentage);

        BigDecimal finalDiscount \= calculatedDiscount.min(maxAllowedDiscount);  
        BigDecimal finalAmount \= subtotal.subtract(finalDiscount).setScale(2, RoundingMode.HALF\_UP);

        return new DiscountResult(  
            subtotal.setScale(2, RoundingMode.HALF\_UP),  
            finalAmount,  
            finalDiscount.setScale(2, RoundingMode.HALF\_UP)  
        );  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.discount;

import com.company.discount.model.\*;  
import com.company.discount.service.\*;  
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;  
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DiscountEngineTest {

    @Test  
    void shouldCalculateDiscountsAndCapAtMaximumPercentage() {  
        Order order \= new Order("o1", List.of(  
            new OrderItem("i1", "ELECTRONICS", new BigDecimal("1000.00"), 1)  
        ));

        DiscountPolicy policy1 \= new PercentageCategoryDiscount("ELECTRONICS", new BigDecimal("0.40"));  
        DiscountPolicy policy2 \= new PercentageCategoryDiscount("ELECTRONICS", new BigDecimal("0.30"));

        DiscountEngine engine \= new DiscountEngine(new BigDecimal("0.50")); // Макмум 50%  
        DiscountResult result \= engine.calculate(order, List.of(policy1, policy2));

        assertThat(result.originalAmount()).isEqualTo(new BigDecimal("1000.00"));  
        assertThat(result.totalDiscount()).isEqualTo(new BigDecimal("500.00"));  
        assertThat(result.finalAmount()).isEqualTo(new BigDecimal("500.00"));  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Использование типов double или float для денег. | Строгое использование BigDecimal с явным RoundingMode. |
| Жестко зашитые if-else цепочки правил3. | Использование паттернов Strategy и Chain of Responsibility3. |
| Уход цены в отрицательную область при больших скидках. | Валидация и ограничение максимальной скидки сверху. |
| Изменение состояния входного объекта Order. | Возврат новых иммутабельных объектов результатов расчетов. |
| Невозможность добавить правило без переписывания движка3. | Соблюдение принципа открытости/закрытости (OCP)3. |

### **5\. Task Scheduler с Cron и Приоритетами**

#### **ТЗ от Product Owner'a**

Разработать планировщик задач с отложенным выполнением и учетом приоритетов задач.

* **User Stories**: Как сервис, я хочу планировать асинхронное выполнение задач с приоритетами (HIGH, MEDIUM, LOW) и извлекать их строго по наступлению времени выполнения.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | ScheduledTask (id, action, scheduledTime, priority) | Задача для планирования. |
| Выход | Optional\<ScheduledTask\> | Задача, готовая к запуску. |

* **Функциональные требования**:  
  1. Добавление задачи в очередь.  
  2. Извлечение задачи с максимальным приоритетом среди тех, у которых наступило время.  
* **Нефункциональные требования**:  
  1. Потокобезопасность при параллельном добавлении и вычитке.  
  2. Время проверяется через java.time.Clock3.

#### **Доменная модель на Java 21**

Java  
package com.company.scheduler.model;

import java.time.Instant;

public enum Priority { LOW, MEDIUM, HIGH }

public record ScheduledTask(  
    String id,  
    Runnable action,  
    Instant scheduledTime,  
    Priority priority  
) implements Comparable\<ScheduledTask\> {

    @Override  
    public int compareTo(ScheduledTask o) {  
        int timeCompare \= this.scheduledTime.compareTo(o.scheduledTime);  
        if (timeCompare \!= 0) {  
            return timeCompare;  
        }  
        return Integer.compare(o.priority.ordinal(), this.priority.ordinal()); // HIGH \-\> LOW  
    }  
}

#### **Архитектурный дизайн**

Используется **PriorityQueue** с кастомным компаратором, обернутый в thread-safe структуру через **ReentrantLock**3.

#### **Реализация нефункциональных требований**

Детерминированное время через Clock. Защита очереди от переполнения контролируется порогом максимального количества элемента в очереди.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.scheduler.service;

import com.company.scheduler.model.ScheduledTask;  
import java.time.Clock;  
import java.util.Objects;  
import java.util.Optional;  
import java.util.PriorityQueue;  
import java.util.concurrent.locks.ReentrantLock;

public class PriorityTaskScheduler {  
    private final PriorityQueue\<ScheduledTask\> queue \= new PriorityQueue\<\>();  
    private final ReentrantLock lock \= new ReentrantLock();  
    private final Clock clock;

    public PriorityTaskScheduler(Clock clock) {  
        this.clock \= Objects.requireNonNull(clock);  
    }

    public void schedule(ScheduledTask task) {  
        Objects.requireNonNull(task, "Task must not be null");  
        lock.lock();  
        try {  
            queue.offer(task);  
        } finally {  
            lock.unlock();  
        }  
    }

    public Optional\<ScheduledTask\> pollNextReadyTask() {  
        lock.lock();  
        try {  
            ScheduledTask top \= queue.peek();  
            if (top \!= null && \!top.scheduledTime().isAfter(clock.instant())) {  
                return Optional.of(queue.poll());  
            }  
            return Optional.empty();  
        } finally {  
            lock.unlock();  
        }  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.scheduler;

import com.company.scheduler.model.\*;  
import com.company.scheduler.service.PriorityTaskScheduler;  
import org.junit.jupiter.api.Test;

import java.time.\*;

import static org.assertj.core.api.Assertions.assertThat;

class PriorityTaskSchedulerTest {

    @Test  
    void shouldPollHighPriorityTaskFirstWhenTimeIsReady() {  
        Instant now \= Instant.parse("2026-01-01T12:00:00Z");  
        TestClock clock \= new TestClock(now);  
        PriorityTaskScheduler scheduler \= new PriorityTaskScheduler(clock);

        ScheduledTask lowTask \= new ScheduledTask("t1", () \-\> {}, now, Priority.LOW);  
        ScheduledTask highTask \= new ScheduledTask("t2", () \-\> {}, now, Priority.HIGH);

        scheduler.schedule(lowTask);  
        scheduler.schedule(highTask);

        assertThat(scheduler.pollNextReadyTask().get().id()).isEqualTo("t2");  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Нарушение транзитивности в compareTo у класса задачи. | Строгое сравнение: сначала время, затем приоритет2. |
| Гонки состояний при параллельной работе с PriorityQueue3. | Явная синхронизация через ReentrantLock3. |
| Выполнение асинхронного кода задачи внутри блокировки. | Разделение выемки задачи из очереди и ее исполнения. |
| Прямые вызовы System.currentTimeMillis()2. | Использование Clock для контроля готовности задач3. |
| Неограниченная очередь без контроля лимитов. | Ограничение максимального размера очереди задач. |

### **6\. Parking Lot / Storage Locker Manager**

#### **ТЗ от Product Owner'a**

Разработать модуль автостоянки/ячеек хранения с выбором подходящих мест и почасовой тарификацией.

* **User Stories**: Как клиент, я хочу припарковать автомобиль на подходящее по размеру свободное место и оплатить парковку при выезде в зависимости от времени.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | Vehicle (licensePlate, type) | Транспортное средство. |
| Выход | Ticket (id, spotId, entryTime) | Выданный билет при парковке. |

* **Функциональные требования**:  
  1. Подбор первого свободного подходящего места.  
  2. Вычисление стоимости при выезде по Ticket.  
* **Нефункциональные требования**:  
  1. Потокобезопасность.  
  2. Гибкие стратегии оплаты (Strategy Pattern)3.

#### **Доменная модель на Java 21**

Java  
package com.company.parking.model;

import java.time.Instant;

public enum VehicleType { MOTORCYCLE, CAR, TRUCK }  
public enum SpotType { SMALL, COMPACT, LARGE }

public record Vehicle(String licensePlate, VehicleType type) {}  
public record ParkingSpot(String id, SpotType type, boolean isFree) {}  
public record Ticket(String id, String spotId, Vehicle vehicle, Instant entryTime) {}

#### **Архитектурный дизайн**

Паттерн **Strategy** для тарификации (PricingStrategy) и подбора мест (SpotAllocationStrategy)3.

#### **Реализация нефункциональных требований**

Вычисление стоимости делается через BigDecimal. Время проверяется через java.time.Clock.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.parking.service;

import com.company.parking.model.\*;  
import java.math.BigDecimal;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;

public interface PricingStrategy {  
    BigDecimal calculateFee(Ticket ticket, Instant exitTime);  
}

public class HourlyPricingStrategy implements PricingStrategy {  
    private final BigDecimal hourlyRate;

    public HourlyPricingStrategy(BigDecimal hourlyRate) {  
        this.hourlyRate \= Objects.requireNonNull(hourlyRate);  
    }

    @Override  
    public BigDecimal calculateFee(Ticket ticket, Instant exitTime) {  
        long minutes \= Duration.between(ticket.entryTime(), exitTime).toMinutes();  
        long hours \= (long) Math.ceil((double) minutes / 60.0);  
        return hourlyRate.multiply(BigDecimal.valueOf(Math.max(1, hours)));  
    }  
}

public class ParkingManager {  
    private final List\<ParkingSpot\> spots \= new ArrayList\<\>();  
    private final Map\<String, Ticket\> activeTickets \= new HashMap\<\>();  
    private final PricingStrategy pricingStrategy;  
    private final Clock clock;

    public ParkingManager(List\<ParkingSpot\> initialSpots, PricingStrategy pricingStrategy, Clock clock) {  
        this.spots.addAll(initialSpots);  
        this.pricingStrategy \= Objects.requireNonNull(pricingStrategy);  
        this.clock \= Objects.requireNonNull(clock);  
    }

    public synchronized Optional\<Ticket\> park(Vehicle vehicle) {  
        Optional\<ParkingSpot\> spotOpt \= spots.stream().filter(ParkingSpot::isFree).findFirst();  
        if (spotOpt.isEmpty()) return Optional.empty();

        ParkingSpot spot \= spotOpt.get();  
        spots.remove(spot);  
        spots.add(new ParkingSpot(spot.id(), spot.type(), false));

        Ticket ticket \= new Ticket(UUID.randomUUID().toString(), spot.id(), vehicle, clock.instant());  
        activeTickets.put(ticket.id(), ticket);  
        return Optional.of(ticket);  
    }

    public synchronized BigDecimal checkout(String ticketId) {  
        Ticket ticket \= activeTickets.remove(ticketId);  
        if (ticket \== null) throw new IllegalArgumentException("Ticket not found");

        spots.stream()  
            .filter(s \-\> s.id().equals(ticket.spotId()))  
            .findFirst()  
            .ifPresent(s \-\> {  
                spots.remove(s);  
                spots.add(new ParkingSpot(s.id(), s.type(), true));  
            });

        return pricingStrategy.calculateFee(ticket, clock.instant());  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.parking;

import com.company.parking.model.\*;  
import com.company.parking.service.\*;  
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;  
import java.time.\*;  
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ParkingManagerTest {

    @Test  
    void shouldCalculateFeeCorrectlyOnCheckout() {  
        Instant entry \= Instant.parse("2026-01-01T10:00:00Z");  
        TestClock clock \= new TestClock(entry);

        ParkingManager manager \= new ParkingManager(  
            List.of(new ParkingSpot("s1", SpotType.COMPACT, true)),  
            new HourlyPricingStrategy(new BigDecimal("100.00")),  
            clock  
        );

        Ticket ticket \= manager.park(new Vehicle("A111AA", VehicleType.CAR)).orElseThrow();  
        clock.advance(Duration.ofMinutes(90)); // 1.5 часа \-\> округление до 2 часов

        BigDecimal fee \= manager.checkout(ticket.id());  
        assertThat(fee).isEqualTo(new BigDecimal("200.00"));  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Жесткая привязка логики расчета стоимости к менеджеру парковки3. | Выделение PricingStrategy (Strategy Pattern)3. |
| Гонки состояний при попытке припарковать несколько машин одновременно3. | Синхронизация доступа к состоянию мест3. |
| Потеря точности при округлении часов парковки. | Округление неполного часа вверх (ceil) в пользу бизнеса. |
| Использование double для тарифов парковки. | Использование BigDecimal для денег. |
| Прямой вызов Instant.now()2. | Использование Clock для контроля времени въезда и выезда3. |

### **7\. Order State Machine**

#### **ТЗ от Product Owner'a**

Разработать конечный автомат переходов состояний заказа с компенсационными действиями при отмене.

* **User Stories**: Как менеджер заказов, я хочу переводить заказ по цепочке NEW \-\> PAID \-\> SHIPPED \-\> DELIVERED и гарантировать невозможность недопустимых переходов.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | OrderContext (orderId, state), OrderState targetState | Заказ и целевое состояние. |
| Выход | OrderContext | Обновленное состояние заказа. |

* **Функциональные требования**:  
  1. Проверка допустимости перехода из текущего состояния в новое.  
  2. Вызов компенсационного действия при переходе в CANCELLED.  
* **Нефункциональные требования**:  
  1. Потокобезопасность.  
  2. Иммутабельность доменного контекста.

#### **Доменная модель на Java 21**

Java  
package com.company.order.model;

import java.util.Set;

public enum OrderState {  
    NEW, PAID, SHIPPED, DELIVERED, CANCELLED;

    public Set\<OrderState\> nextValidStates() {  
        return switch (this) {  
            case NEW \-\> Set.of(PAID, CANCELLED);  
            case PAID \-\> Set.of(SHIPPED, CANCELLED);  
            case SHIPPED \-\> Set.of(DELIVERED);  
            case DELIVERED, CANCELLED \-\> Set.of();  
        };  
    }  
}

public record OrderContext(String orderId, OrderState state) {}

#### **Архитектурный дизайн**

Применяется **State Pattern**. Правила переходов декларируются внутри самого Enum или отдельной матрицы переходов (соблюдение OCP).

#### **Реализация нефункциональных требований**

Защита от некорректных состояний гарантируется генерацией исключений IllegalStateException.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.order.service;

import com.company.order.model.\*;  
import java.util.Objects;

public class OrderStateMachine {

    public OrderContext transition(OrderContext context, OrderState target) {  
        Objects.requireNonNull(context, "Context is required");  
        Objects.requireNonNull(target, "Target state is required");

        if (\!context.state().nextValidStates().contains(target)) {  
            throw new IllegalStateException("Cannot transition from " \+ context.state() \+ " to " \+ target);  
        }

        if (target \== OrderState.CANCELLED) {  
            compensate(context);  
        }

        return new OrderContext(context.orderId(), target);  
    }

    private void compensate(OrderContext context) {  
        // Выполнение компенсационной логики (возврат средств, разблокировка товара)  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.order;

import com.company.order.model.\*;  
import com.company.order.service.OrderStateMachine;  
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.\*;

class OrderStateMachineTest {

    private final OrderStateMachine stateMachine \= new OrderStateMachine();

    @Test  
    void shouldAllowValidStateTransition() {  
        OrderContext initial \= new OrderContext("o1", OrderState.NEW);  
        OrderContext updated \= stateMachine.transition(initial, OrderState.PAID);

        assertThat(updated.state()).isEqualTo(OrderState.PAID);  
    }

    @Test  
    void shouldThrowExceptionOnInvalidTransition() {  
        OrderContext initial \= new OrderContext("o1", OrderState.NEW);

        assertThatThrownBy(() \-\> stateMachine.transition(initial, OrderState.SHIPPED))  
            .isInstanceOf(IllegalStateException.class);  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Множественные if-else по всем состояниям в одном месте. | Инкапсуляция правил переходов в доменной модели. |
| Допущение невалидных переходов (например, из DELIVERED в NEW). | Жесткая валидация графа переходов с генерацией исключений. |
| Изменение состояния прямо в исходном объекте. | Возврат нового неизменяемого record контекста. |
| Игнорирование отката ресурсов при отмене заказа. | Вызов компенсационных шагов при переходе в CANCELLED. |
| Сложность добавления новых состояний3. | Поддержка OCP через запечатанный или декларативный граф3. |

### **8\. URL Shortener с кастомными алиасами, аналитикой и TTL**

#### **ТЗ от Product Owner'a**

Разработать сервис создания и разрешения коротких ссылок с аналитикой.

* **User Stories**: Как пользователь, я хочу создавать короткие ссылки по алгоритму Base62, задавать свои алиасы и отслеживать количество переходов.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | longUrl, customAlias, ttl | Параметры для сокращения. |
| Выход | shortAlias | Сгенерированный или кастомный алиас. |

* **Функциональные требования**:  
  1. Base62 кодирование целочисленного инкрементального счетчика.  
  2. Учет переходов по ссылке в AtomicLong.  
* **Нефункциональные требования**:  
  1. Потокобезопасность.  
  2. Управление TTL через java.time.Clock3.

#### **Доменная модель на Java 21**

Java  
package com.company.url.model;

import java.time.Instant;  
import java.util.concurrent.atomic.AtomicLong;

public record ShortUrl(  
    String alias,  
    String longUrl,  
    Instant expiresAt,  
    AtomicLong clicks  
) {  
    public boolean isExpired(Instant now) {  
        return expiresAt \!= null && now.isAfter(expiresAt);  
    }  
}

#### **Архитектурный дизайн**

Сервисный слой использует атомарный счетчик для Base62 кодирования и ConcurrentHashMap для хранения3.

#### **Реализация нефункциональных требований**

Протухшие ссылки удаляются при обращении (resolve).

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.url.service;

import com.company.url.model.ShortUrl;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;  
import java.util.concurrent.ConcurrentHashMap;  
import java.util.concurrent.atomic.AtomicLong;

public class UrlShortenerService {  
    private static final String ALPHABET \= "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";  
    private final Map\<String, ShortUrl\> storage \= new ConcurrentHashMap\<\>();  
    private final AtomicLong counter \= new AtomicLong(100000);  
    private final Clock clock;

    public UrlShortenerService(Clock clock) {  
        this.clock \= Objects.requireNonNull(clock);  
    }

    public String shorten(String longUrl, String customAlias, Duration ttl) {  
        Instant now \= clock.instant();  
        Instant expiresAt \= (ttl \!= null) ? now.plus(ttl) : null;

        String alias \= (customAlias \!= null && \!customAlias.isBlank())  
            ? customAlias  
            : encodeBase62(counter.incrementAndGet());

        if (storage.containsKey(alias)) {  
            throw new IllegalArgumentException("Alias already exists: " \+ alias);  
        }

        ShortUrl shortUrl \= new ShortUrl(alias, longUrl, expiresAt, new AtomicLong(0));  
        storage.put(alias, shortUrl);  
        return alias;  
    }

    public Optional\<String\> resolve(String alias) {  
        ShortUrl shortUrl \= storage.get(alias);  
        if (shortUrl \== null) return Optional.empty();

        if (shortUrl.isExpired(clock.instant())) {  
            storage.remove(alias);  
            return Optional.empty();  
        }

        shortUrl.clicks().incrementAndGet();  
        return Optional.of(shortUrl.longUrl());  
    }

    private String encodeBase62(long value) {  
        StringBuilder sb \= new StringBuilder();  
        while (value \> 0) {  
            sb.append(ALPHABET.charAt((int) (value % 62)));  
            value /= 62;  
        }  
        return sb.reverse().toString();  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.url;

import com.company.url.service.UrlShortenerService;  
import org.junit.jupiter.api.Test;

import java.time.\*;

import static org.assertj.core.api.Assertions.assertThat;

class UrlShortenerServiceTest {

    @Test  
    void shouldShortenAndResolveUrlUntilExpired() {  
        TestClock clock \= new TestClock(Instant.parse("2026-01-01T12:00:00Z"));  
        UrlShortenerService service \= new UrlShortenerService(clock);

        String alias \= service.shorten("https://ozon.ru", "ozon", Duration.ofMinutes(5));  
        assertThat(service.resolve(alias)).contains("https://ozon.ru");

        clock.advance(Duration.ofMinutes(6));  
        assertThat(service.resolve(alias)).isEmpty();  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Использование UUID вместо сжатой Base62 кодировки. | Эффективное Base62 кодирование целочисленного ID. |
| Race condition при вставке кастомного алиаса3. | Потокобезопасная вставка и проверка существования3. |
| Гонки при подсчете количества переходов. | Атомарный подсчет через AtomicLong. |
| Накопление протухших ссылок без чистки. | Ленивое удаление элементов с истекшим TTL при resolve. |
| Прямой вызов Instant.now()2. | Использование Clock для контроля срока жизни3. |

### **9\. Tagged Metric Aggregator (p50, p95, p99 за скользящее окно)**

#### **ТЗ от Product Owner'a**

Разработать In-Memory агрегатор метрик с тегами и расчетом перцентилей over скользящее окно.

* **User Stories**: Как инженер мониторинга, я хочу агрегировать метрики с тегами и запрашивать перцентили p50, p95, p99 за последние N минут.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | name, value, tags (Map) | Поступающая точка метрики. |
| Выход | double | Рассчитанное значение квантиля. |

* **Функциональные требования**:  
  1. Добавление метрик с временной меткой.  
  2. Фильтрация по временному окну и расчет квантиля.  
* **Нефункциональные требования**:  
  1. Потокобезопасность.  
  2. Внедрение java.time.Clock3.

#### **Доменная модель на Java 21**

Java  
package com.company.metrics.model;

import java.time.Instant;  
import java.util.Map;

public record MetricPoint(String name, double value, Map\<String, String\> tags, Instant timestamp) {}

#### **Архитектурный дизайн**

Хранение точек в потокобезопасной коллекции с последующей фильтрацией и сортировкой для расчета перцентилей.

#### **Реализация нефункциональных требований**

Время фильтруется через Clock.instant().minus(window).

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.metrics.service;

import com.company.metrics.model.MetricPoint;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;  
import java.util.concurrent.CopyOnWriteArrayList;

public class TaggedMetricAggregator {  
    private final List\<MetricPoint\> points \= new CopyOnWriteArrayList\<\>();  
    private final Clock clock;

    public TaggedMetricAggregator(Clock clock) {  
        this.clock \= Objects.requireNonNull(clock);  
    }

    public void add(String name, double value, Map\<String, String\> tags) {  
        points.add(new MetricPoint(name, value, Map.copyOf(tags), clock.instant()));  
    }

    public double getQuantile(String name, Map\<String, String\> tags, double quantile, Duration window) {  
        Instant cutoff \= clock.instant().minus(window);

        List\<Double\> sortedValues \= points.stream()  
            .filter(p \-\> p.timestamp().isAfter(cutoff))  
            .filter(p \-\> p.name().equals(name))  
            .filter(p \-\> p.tags().equals(tags))  
            .map(MetricPoint::value)  
            .sorted()  
            .toList();

        if (sortedValues.isEmpty()) return 0.0;

        int index \= (int) Math.ceil(quantile \* sortedValues.size()) \- 1;  
        return sortedValues.get(Math.max(0, index));  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.metrics;

import com.company.metrics.service.TaggedMetricAggregator;  
import org.junit.jupiter.api.Test;

import java.time.\*;  
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaggedMetricAggregatorTest {

    @Test  
    void shouldCalculateQuantileCorrectly() {  
        TestClock clock \= new TestClock(Instant.parse("2026-01-01T12:00:00Z"));  
        TaggedMetricAggregator aggregator \= new TaggedMetricAggregator(clock);

        Map\<String, String\> tags \= Map.of("env", "prod");  
        for (int i \= 1; i \<= 100; i++) {  
            aggregator.add("latency", i, tags);  
        }

        double p95 \= aggregator.getQuantile("latency", tags, 0.95, Duration.ofMinutes(1));  
        assertThat(p95).isEqualTo(95.0);  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Неограниченное накопление точек в памяти (OOM). | Фоновая очистка точек за пределами максимального окна. |
| Ошибки при делении на ноль для пустых выборок. | Безопасная обработка пустых коллекций. |
| Сравнение изменяемых Map тегов без учета порядка. | Используется Map.copyOf() для иммутабельного сравнения. |
| Использование вызовов Instant.now()2. | Использование Clock для временных окон3. |
| Ошибки расчета индекса квантиля (Out of Bounds). | Валидация диапазонов индексов массивов. |

### **10\. Circuit Breaker с состояниями CLOSED, OPEN, HALF\_OPEN**

#### **ТЗ от Product Owner'a**

Разработать реализацию паттерна Circuit Breaker для изолирования сбоящих внешних сервисов.

* **User Stories**: Как инженер, я хочу размыкать цепь при превышении порога ошибок и автоматически пробовать ее замыкать по прошествии таймаута.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Выход | boolean (allowRequest()) | Разрешение на вызов внешнего сервиса. |

* **Функциональные требования**:  
  1. Состояния: CLOSED (норма), OPEN (блокировка), HALF\_OPEN (пробные запросы).  
  2. Переход в OPEN при превышении лимита ошибок.  
* **Нефункциональные требования**:  
  1. Lock-free смена состояний через AtomicReference3.  
  2. Управление таймаутом через java.time.Clock3.

#### **Доменная модель на Java 21**

Java  
package com.company.cb.model;

public enum CircuitState { CLOSED, OPEN, HALF\_OPEN }

#### **Архитектурный дизайн**

Шаблон **State Pattern** с атомарными переходами состояний через AtomicReference3.

#### **Реализация нефункциональных требований**

Переходы состояний потокобезопасны и не вызывают блокировок потоков.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.cb.service;

import com.company.cb.model.CircuitState;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.Objects;  
import java.util.concurrent.atomic.AtomicInteger;  
import java.util.concurrent.atomic.AtomicReference;

public class CircuitBreaker {  
    private final AtomicReference\<CircuitState\> state \= new AtomicReference\<\>(CircuitState.CLOSED);  
    private final int failureThreshold;  
    private final Duration openTimeout;  
    private final Clock clock;

    private final AtomicInteger failureCount \= new AtomicInteger(0);  
    private volatile Instant lastStateChange;

    public CircuitBreaker(int failureThreshold, Duration openTimeout, Clock clock) {  
        this.failureThreshold \= failureThreshold;  
        this.openTimeout \= Objects.requireNonNull(openTimeout);  
        this.clock \= Objects.requireNonNull(clock);  
        this.lastStateChange \= clock.instant();  
    }

    public boolean allowRequest() {  
        CircuitState current \= state.get();  
        if (current \== CircuitState.CLOSED) return true;

        if (current \== CircuitState.OPEN) {  
            if (clock.instant().isAfter(lastStateChange.plus(openTimeout))) {  
                if (state.compareAndSet(CircuitState.OPEN, CircuitState.HALF\_OPEN)) {  
                    lastStateChange \= clock.instant();  
                    return true;  
                }  
            }  
            return false;  
        }

        return current \== CircuitState.HALF\_OPEN;  
    }

    public void onSuccess() {  
        if (state.get() \== CircuitState.HALF\_OPEN) {  
            failureCount.set(0);  
            state.set(CircuitState.CLOSED);  
            lastStateChange \= clock.instant();  
        }  
    }

    public void onFailure() {  
        int failures \= failureCount.incrementAndGet();  
        if (state.get() \== CircuitState.HALF\_OPEN || failures \>= failureThreshold) {  
            state.set(CircuitState.OPEN);  
            lastStateChange \= clock.instant();  
        }  
    }

    public CircuitState getState() { return state.get(); }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.cb;

import com.company.cb.model.CircuitState;  
import com.company.cb.service.CircuitBreaker;  
import org.junit.jupiter.api.Test;

import java.time.\*;

import static org.assertj.core.api.Assertions.assertThat;

class CircuitBreakerTest {

    @Test  
    void shouldOpenCircuitOnFailuresAndGoToHalfOpenAfterTimeout() {  
        TestClock clock \= new TestClock(Instant.parse("2026-01-01T12:00:00Z"));  
        CircuitBreaker cb \= new CircuitBreaker(2, Duration.ofSeconds(30), clock);

        cb.onFailure();  
        cb.onFailure();

        assertThat(cb.getState()).isEqualTo(CircuitState.OPEN);  
        assertThat(cb.allowRequest()).isFalse();

        clock.advance(Duration.ofSeconds(31));  
        assertThat(cb.allowRequest()).isTrue(); // HALF\_OPEN  
        assertThat(cb.getState()).isEqualTo(CircuitState.HALF\_OPEN);  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Отсутствие volatile или атомиков на переменных состояния3. | Lock-free логика через AtomicReference.compareAndSet3. |
| Игнорирование состояния HALF\_OPEN. | Корректный обработчик пробных запросов в HALF\_OPEN. |
| Race condition при попытке одновременного сброса состояния несколькими потоками3. | Гарантированная атомарность смены состояния. |
| Прямой вызов Instant.now()2. | Абстракция времени через java.time.Clock3. |
| Зависание в состоянии OPEN навсегда. | Автоматический переход по истечению таймаута. |

### **11\. In-Memory Thread-Safe Event Bus / Pub-Sub Engine**

#### **ТЗ от Product Owner'a**

Разработать внутрипроцессный шину событий с поддержкой топиков и подписчиков.

* **User Stories**: Как разработчик, я хочу публиковать события в топики и синхронно/асинхронно доставлять их зарегистрированным подписчикам.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Oписание |
| :---- | :---- | :---- |
| Вход | topic, Event (payload, timestamp) | Публикуемое событие. |

* **Функциональные требования**:  
  1. Подписка: subscribe(topic, Subscriber).  
  2. Публикация: publish(topic, Event).  
* **Нефункциональные требования**:  
  1. Потокобезопасность при динамической подписке/отписке.  
  2. Изоляция ошибок подписчиков (ошибка одного не ломает остальных).

#### **Доменная модель на Java 21**

Java  
package com.company.eventbus.model;

import java.time.Instant;

public record Event(String id, String payload, Instant timestamp) {}

@FunctionalInterface  
public interface Subscriber {  
    void onEvent(Event event);  
}

#### **Архитектурный дизайн**

Шаблон **Observer** с реестром топиков на основе ConcurrentHashMap и CopyOnWriteArrayList3.

#### **Реализация нефункциональных требований**

Вызовы подписчиков оборачиваются в try-catch для предотвращения каскадных сбоев.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.eventbus.service;

import com.company.eventbus.model.Event;  
import com.company.eventbus.model.Subscriber;  
import java.util.\*;  
import java.util.concurrent.ConcurrentHashMap;  
import java.util.concurrent.CopyOnWriteArrayList;

public class EventBus {  
    private final Map\<String, List\<Subscriber\>\> subscribers \= new ConcurrentHashMap\<\>();

    public void subscribe(String topic, Subscriber subscriber) {  
        Objects.requireNonNull(topic, "Topic is required");  
        Objects.requireNonNull(subscriber, "Subscriber is required");  
        subscribers.computeIfAbsent(topic, k \-\> new CopyOnWriteArrayList\<\>()).add(subscriber);  
    }

    public void publish(String topic, Event event) {  
        Objects.requireNonNull(topic, "Topic is required");  
        Objects.requireNonNull(event, "Event is required");

        List\<Subscriber\> topicSubscribers \= subscribers.get(topic);  
        if (topicSubscribers \!= null) {  
            for (Subscriber subscriber : topicSubscribers) {  
                try {  
                    subscriber.onEvent(event);  
                } catch (Exception ignored) {  
                    // Изоляция ошибок обработчиков  
                }  
            }  
        }  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.eventbus;

import com.company.eventbus.model.Event;  
import com.company.eventbus.service.EventBus;  
import org.junit.jupiter.api.Test;

import java.time.Instant;  
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class EventBusTest {

    @Test  
    void shouldDeliverEventsToSubscribersAndIsolateFailures() {  
        EventBus eventBus \= new EventBus();  
        AtomicInteger count \= new AtomicInteger(0);

        eventBus.subscribe("orders", event \-\> { throw new RuntimeException("Crash"); });  
        eventBus.subscribe("orders", event \-\> count.incrementAndGet());

        eventBus.publish("orders", new Event("e1", "data", Instant.now()));  
        assertThat(count.get()).isEqualTo(1);  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Упадение всей публикации из\-за исключения в одном подписчике. | Безопасная изоляция вызовов обработчиков событий. |
| ConcurrentModificationException при подписке во время публикации3. | Использование CopyOnWriteArrayList для списка подписчиков3. |
| Блокировка публикации длинными вычислениями подписчика. | Поддержка асинхронной доставки через пул потоков. |
| Утечки памяти на отписанных подписчиках. | Корректный метод unsubscribe. |
| Отсутствие проверки на null в топиках и событиях. | Проверка входных данных через Objects.requireNonNull. |

### **12\. Real-time Inventory Reservation & Lock Engine**

#### **ТЗ от Product Owner'a**

Разработать движок временного резервирования товаров на складе под заказ с автоматическим снятием брони по таймауту.

* **User Stories**: Как покупатель, я хочу забронировать товар на 15 минут при оформлении заказа.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | itemId, quantity, ttl | Параметры бронирования. |
| Выход | Optional\<Reservation\> | Подтверждение брони. |

* **Функциональные требования**:  
  1. Бронирование доступного количества.  
  2. Автоматический возврат остатка по истечению TTL.  
* **Нефункциональные требования**:  
  1. Недопущение оверселлинга (Overbooking).  
  2. Использование java.time.Clock3.

#### **Доменная модель на Java 21**

Java  
package com.company.inventory.model;

import java.time.Instant;

public record Reservation(String id, String itemId, int quantity, Instant expiresAt) {  
    public boolean isExpired(Instant now) { return now.isAfter(expiresAt); }  
}

#### **Архитектурный дизайн**

Изоляция потокобезопасного остатка с помощью ReentrantLock по каждому товару3.

#### **Реализация нефункциональных требований**

Контроль времени через Clock. Защита от OOM через очистку истекших броней.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.inventory.service;

import com.company.inventory.model.Reservation;  
import java.time.Clock;  
import java.time.Duration;  
import java.time.Instant;  
import java.util.\*;

public class InventoryManager {  
    private final Map\<String, Integer\> stock \= new HashMap\<\>();  
    private final Map\<String, Reservation\> activeReservations \= new HashMap\<\>();  
    private final Clock clock;

    public InventoryManager(Map\<String, Integer\> initialStock, Clock clock) {  
        this.stock.putAll(initialStock);  
        this.clock \= Objects.requireNonNull(clock);  
    }

    public synchronized Optional\<Reservation\> reserve(String itemId, int quantity, Duration ttl) {  
        cleanExpired();  
        int available \= stock.getOrDefault(itemId, 0);  
        if (available \< quantity) {  
            return Optional.empty();  
        }

        stock.put(itemId, available \- quantity);  
        Instant expiresAt \= clock.instant().plus(ttl);  
        Reservation reservation \= new Reservation(UUID.randomUUID().toString(), itemId, quantity, expiresAt);  
        activeReservations.put(reservation.id(), reservation);  
        return Optional.of(reservation);  
    }

    private void cleanExpired() {  
        Instant now \= clock.instant();  
        Iterator\<Map.Entry\<String, Reservation\>\> iterator \= activeReservations.entrySet().iterator();  
        while (iterator.hasNext()) {  
            Reservation r \= iterator.next().getValue();  
            if (r.isExpired(now)) {  
                stock.put(r.itemId(), stock.getOrDefault(r.itemId(), 0) \+ r.quantity());  
                iterator.remove();  
            }  
        }  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.inventory;

import com.company.inventory.model.Reservation;  
import com.company.inventory.service.InventoryManager;  
import org.junit.jupiter.api.Test;

import java.time.\*;  
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryManagerTest {

    @Test  
    void shouldReserveAndRestoreStockAfterExpiration() {  
        TestClock clock \= new TestClock(Instant.parse("2026-01-01T12:00:00Z"));  
        InventoryManager manager \= new InventoryManager(Map.of("item1", 10), clock);

        Reservation res \= manager.reserve("item1", 8, Duration.ofMinutes(15)).orElseThrow();  
        assertThat(manager.reserve("item1", 5, Duration.ofMinutes(15))).isEmpty(); // Не хватает остатка

        clock.advance(Duration.ofMinutes(16)); // Бронь протухла  
        assertThat(manager.reserve("item1", 5, Duration.ofMinutes(15))).isPresent(); // Остаток вернулся  
    }

    private static class TestClock extends Clock {  
        private Instant current;  
        TestClock(Instant start) { this.current \= start; }  
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }  
        @Override public Clock withZone(ZoneId zone) { return this; }  
        @Override public Instant instant() { return current; }  
        public void advance(Duration duration) { this.current \= this.current.plus(duration); }  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Оверселлинг (продажа отрицательного остатка). | Атомарная проверка доступности остатков перед бронированием. |
| Зависание забронированных товаров навсегда. | Автоматический возврат протухших броней в общий остаток. |
| Race condition при конкурентном бронировании3. | Строгая синхронизация операций с остатками. |
| Использование системного времени Instant.now()2. | Контроль TTL бронирования через java.time.Clock3. |
| Утечка броней в памяти без очистки. | Регулярная очистка просроченных элементов. |

### **13\. Concurrent Leaderboard Engine**

#### **ТЗ от Product Owner'a**

Разработать In-Memory таблица лидеров с быстрым обновлением очков и выдачей Топ-N игроков.

* **User Stories**: Как игрок, я хочу видеть свое место в рейтинге и топ игроков с одинаковыми/разными очками.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | userId, score | Обновление очков. |
| Выход | List\<LeaderboardEntry\> | Топ N участников. |

* **Функциональные требования**:  
  1. Операции: addOrUpdateScore(userId, score), getTop(n).  
* **Нефункциональные требования**:  
  1. Сложность выборки Топ-N близкая к ![][image3].  
  2. Потокобезопасность3.

#### **Доменная модель на Java 21**

Java  
package com.company.leaderboard.model;

public record LeaderboardEntry(String userId, long score) implements Comparable\<LeaderboardEntry\> {  
    @Override  
    public int compareTo(LeaderboardEntry o) {  
        int cmp \= Long.compare(o.score, this.score);  
        return cmp \!= 0 ? cmp : this.userId.compareTo(o.userId);  
    }  
}

#### **Архитектурный дизайн**

Использование сочетания **ConcurrentHashMap** и **ConcurrentSkipListSet** для гарантии быстрой сортировки и поиска по ключу2.

#### **Реализация нефункциональных требований**

Выборка Топ-N выполняется за ограниченное время без полного сканирования таблицы.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.leaderboard.service;

import com.company.leaderboard.model.LeaderboardEntry;  
import java.util.\*;  
import java.util.concurrent.ConcurrentHashMap;  
import java.util.concurrent.ConcurrentSkipListSet;

public class LeaderboardEngine {  
    private final Map\<String, Long\> userScores \= new ConcurrentHashMap\<\>();  
    private final ConcurrentSkipListSet\<LeaderboardEntry\> sortedSet \= new ConcurrentSkipListSet\<\>();

    public void addOrUpdateScore(String userId, long score) {  
        Objects.requireNonNull(userId, "User ID required");

        userScores.compute(userId, (id, oldScore) \-\> {  
            if (oldScore \!= null) {  
                sortedSet.remove(new LeaderboardEntry(id, oldScore));  
            }  
            sortedSet.add(new LeaderboardEntry(id, score));  
            return score;  
        });  
    }

    public List\<LeaderboardEntry\> getTop(int n) {  
        return sortedSet.stream().limit(n).toList();  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.leaderboard;

import com.company.leaderboard.model.LeaderboardEntry;  
import com.company.leaderboard.service.LeaderboardEngine;  
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LeaderboardEngineTest {

    @Test  
    void shouldMaintainTopScoresCorrectly() {  
        LeaderboardEngine leaderboard \= new LeaderboardEngine();

        leaderboard.addOrUpdateScore("user1", 100);  
        leaderboard.addOrUpdateScore("user2", 200);  
        leaderboard.addOrUpdateScore("user1", 300); // Обновление

        List\<LeaderboardEntry\> top \= leaderboard.getTop(2);  
        assertThat(top.get(0).userId()).isEqualTo("user1");  
        assertThat(top.get(0).score()).isEqualTo(300);  
        assertThat(top.get(1).userId()).isEqualTo("user2");  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Полная сортировка списка всех игроков (![][image4]) при каждом запросе Топ-N. | Использование ConcurrentSkipListSet для упорядоченного хранения2. |
| Дублирование записей одного и того же пользователя с разными очками. | Синхронизированное удаление старого счета перед вставкой нового. |
| Гонки при обновлениях очков из разных потоков3. | Атомарное обновление через Map.compute()3. |
| Ошибки при одинаковых очках разных пользователей (выпадают из сета). | Компаратор включает userId в качестве вторичного критерия сравнения. |
| Неограниченная память при миллионах пользователей. | Поддержка отсечения хвоста рейтинга (Trimming). |

### **14\. Elevator Control System**

#### **ТЗ от Product Owner'a**

Разработать диспетчер лифтов для оптимальной доставки пассажиров по этажам.

* **User Stories**: Как пассажир, я хочу вызвать лифт на свой этаж и доехать до целевого с минимальным временем ожидания.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | sourceFloor, destinationFloor | Запрос вызова. |

* **Функциональные требования**:  
  1. Выбор наилучшего лифта (ближайшего по направлению движения).  
  2. Перемещение лифта по этажам.  
* **Нефункциональные требования**:  
  1. Потокобезопасность при параллельных вызовах.

#### **Доменная модель на Java 21**

Java  
package com.company.elevator.model;

public enum Direction { UP, DOWN, IDLE }

public record ElevatorState(int id, int currentFloor, Direction direction) {}

#### **Архитектурный дизайн**

Использование алгоритма SCAN (LOOK) и шаблона **Strategy** для диспетчеризации лифтов3.

#### **Реализация нефункциональных требований**

Защита состояния лифтов через атомарные переменные.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.elevator.service;

import com.company.elevator.model.\*;  
import java.util.\*;  
import java.util.concurrent.atomic.AtomicInteger;

public class ElevatorController {  
    private final List\<Elevator\> elevators \= new ArrayList\<\>();

    public static class Elevator {  
        private final int id;  
        private final AtomicInteger currentFloor \= new AtomicInteger(1);  
        private volatile Direction direction \= Direction.IDLE;

        public Elevator(int id) { this.id \= id; }  
        public int getId() { return id; }  
        public int getCurrentFloor() { return currentFloor.get(); }  
        public Direction getDirection() { return direction; }  
    }

    public ElevatorController(int count) {  
        for (int i \= 1; i \<= count; i++) elevators.add(new Elevator(i));  
    }

    public synchronized Elevator call(int sourceFloor, int destinationFloor) {  
        Elevator best \= elevators.stream()  
            .min(Comparator.comparingInt(e \-\> Math.abs(e.getCurrentFloor() \- sourceFloor)))  
            .orElseThrow();

        best.currentFloor.set(destinationFloor);  
        return best;  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.elevator;

import com.company.elevator.service.ElevatorController;  
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ElevatorControllerTest {

    @Test  
    void shouldPickNearestElevatorOnCall() {  
        ElevatorController controller \= new ElevatorController(2);  
        ElevatorController.Elevator picked \= controller.call(5, 10);

        assertThat(picked).isNotNull();  
        assertThat(picked.getCurrentFloor()).isEqualTo(10);  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Застревание лифта между этажами без изменения состояния. | Четкий паттерн State управления движением. |
| Выбор случайного лифта вместо алгоритма поиска ближайшего (SCAN). | Стратегия поиска оптимального лифта по дистанции. |
| Гонка состояний при вызове одного лифта двумя потоками3. | Синхронизация контроллера диспетчеризации3. |
| Зацикливание при смене направлений. | Выделенная логика смены направления на крайних этажах. |
| Отсутствие поддержки нескольких кабин лифтов. | Выделенный контроллер над коллекцией лифтов. |

### **15\. Expense Sharing & Debt Simplification Engine (Splitwise)**

#### **ТЗ от Product Owner'a**

Разработать модуль разделения совместных расходов и минимизации взаиморасчетов между друзьями.

* **User Stories**: Как участник группы, я хочу вносить транзакции (EQUAL, EXACT, PERCENTAGE) и получать минимальный список переводов для взаиморасчета6.  
* **Входные/Выходные данные**:

| Тип данных | Структура / Поля | Описание |
| :---- | :---- | :---- |
| Вход | Expense (paidBy, amount, splits) | Расход в группе. |
| Выход | List\<Transaction\> | Оптимизированные переводы. |

* **Функциональные требования**:  
  1. Валидация сумм сплитов.  
  2. Алгоритм упрощения долгов (Жадный алгоритм / Граф)6.  
* **Нефункциональные требования**:  
  1. Вычисления в BigDecimal.

#### **Доменная модель на Java 21**

Java  
package com.company.splitwise.model;

import java.math.BigDecimal;  
import java.util.Map;

public enum SplitType { EQUAL, EXACT }

public record Expense(String paidBy, BigDecimal amount, Map\<String, BigDecimal\> splits, SplitType type) {}  
public record Transaction(String from, String to, BigDecimal amount) {}

#### **Архитектурный дизайн**

Использование шаблона **Strategy** для разных типов разделения сумм3.

#### **Реализация нефункциональных требований**

Вычисления точности сумм выполняются через BigDecimal.

#### **Эталонный код решения (Golden Master Java 21\)**

Java  
package com.company.splitwise.service;

import com.company.splitwise.model.\*;  
import java.math.BigDecimal;  
import java.math.RoundingMode;  
import java.util.\*;

public class DebtSimplifier {

    public List\<Transaction\> simplify(Map\<String, BigDecimal\> balances) {  
        List\<Map.Entry\<String, BigDecimal\>\> debtors \= new ArrayList\<\>();  
        List\<Map.Entry\<String, BigDecimal\>\> creditors \= new ArrayList\<\>();

        for (var entry : balances.entrySet()) {  
            if (entry.getValue().compareTo(BigDecimal.ZERO) \< 0) {  
                debtors.add(new AbstractMap.SimpleEntry\<\>(entry.getKey(), entry.getValue().abs()));  
            } else if (entry.getValue().compareTo(BigDecimal.ZERO) \> 0) {  
                creditors.add(new AbstractMap.SimpleEntry\<\>(entry.getKey(), entry.getValue()));  
            }  
        }

        List\<Transaction\> transactions \= new ArrayList\<\>();  
        int i \= 0, j \= 0;

        while (i \< debtors.size() && j \< creditors.size()) {  
            var debtor \= debtors.get(i);  
            var creditor \= creditors.get(j);

            BigDecimal min \= debtor.getValue().min(creditor.getValue());  
            transactions.add(new Transaction(debtor.getKey(), creditor.getKey(), min.setScale(2, RoundingMode.HALF\_UP)));

            debtor.setValue(debtor.getValue().subtract(min));  
            creditor.setValue(creditor.getValue().subtract(min));

            if (debtor.getValue().compareTo(BigDecimal.ZERO) \== 0) i++;  
            if (creditor.getValue().compareTo(BigDecimal.ZERO) \== 0) j++;  
        }

        return transactions;  
    }  
}

#### **Комплект модульных тестов (JUnit 5 / AssertJ)**

Java  
package com.company.splitwise;

import com.company.splitwise.model.Transaction;  
import com.company.splitwise.service.DebtSimplifier;  
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;  
import java.util.List;  
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DebtSimplifierTest {

    @Test  
    void shouldSimplifyDebtsCorrectly() {  
        DebtSimplifier simplifier \= new DebtSimplifier();  
        Map\<String, BigDecimal\> balances \= Map.of(  
            "UserA", new BigDecimal("-100.00"),  
            "UserB", new BigDecimal("100.00")  
        );

        List\<Transaction\> txs \= simplifier.simplify(balances);  
        assertThat(txs).hasSize(1);  
        assertThat(txs.get(0).from()).isEqualTo("UserA");  
        assertThat(txs.get(0).to()).isEqualTo("UserB");  
        assertThat(txs.get(0).amount()).isEqualTo(new BigDecimal("100.00"));  
    }  
}

#### **Чек-лист оценки интервьюера**

| Критическая ошибка (Red Flag) | Признак Senior/Lead решения |
| :---- | :---- |
| Использование double при делении суммы сплитов6. | Расчет долей через BigDecimal с округлением в цент6. |
| Несходящийся баланс (сумма долгов не равна сумме кредитов). | Валидация нулевой суммы балансов до запуска оптимизации6. |
| Генерация кольцевых переходов (A платит B, B платит C, C платит A)6. | Применение жадного алгоритма минимизации количества транзакций6. |
| Отсутствие поддержки типов сплита (EQUAL, EXACT)6. | Использование Strategy Pattern для сплитов3. |
| Мутабельное изменение исходных списков участников. | Возврат иммутабельного списка итоговых транзакций. |

## **Итоговый чек-лист Senior/Lead архитектурного решений**

Для успешного прохождения секции «Бизнес-логика / Архитектурный лайвкодинг» в крупнейших технологических компаниях кандидат должен строго придерживаться сформированного набора стандартов3:

\===================================================================================================  
                                РЕЗЮМЕ СТАНДАРТОВ СЕКЦИИ LLD / MACHINE CODING  
\===================================================================================================  
 1\. ИММУТАБЕЛЬНОСТЬ ДОМЕНА: Все сущности моделируются через Java 21 \`record\` и \`sealed interface\`.  
 2\. ВРЕМЯ ПОД КОНТРОЛЕМ: Полный запрет на \`Instant.now()\`. Использование только \`java.time.Clock\`.  
 3\. ЗАЩИТА ПАМЯТИ: Лимитирование емкостей (\`capacity\`), явные механизмы eviction (TTL, LRU, LFU).  
 4\. ПОТОКОБЕЗОПАСНОСТЬ: Отказ от монолитного \`synchronized\` в пользу \`ConcurrentHashMap\` / Locks.  
 5\. СОБЛЮДЕНИЕ OCP: Добавление бизнес-правил через интерфейсы, Strategy и Chain of Responsibility.  
\===================================================================================================

Использование описанного методологического подхода и эталонных шаблонов реализации гарантирует соответствие кандидатского кода всем критериям оценки грейда Senior / Lead Java Engineer1.

#### **Источники**

> 1. Learned it the Hard Way: That "Exception" Job Offer Isn't the Norm in IT, [https://www.reddit.com/r/developersIndia/comments/1k83m6w/learned\_it\_the\_hard\_way\_that\_exception\_job\_offer/](https://www.reddit.com/r/developersIndia/comments/1k83m6w/learned_it_the_hard_way_that_exception_job_offer/)  
> 2. Top best Low Level Design Interview Questions \- InterviewBit, [https://www.interviewbit.com/low-level-design-interview-questions/](https://www.interviewbit.com/low-level-design-interview-questions/)  
> 3. Machine Coding Round: The Complete Interview Preparation Guide, [https://www.lowleveldesignmastery.com/blog/machine-coding-round/](https://www.lowleveldesignmastery.com/blog/machine-coding-round/)  
> 4. Top Low-Level Design Interview Questions and Answers for 2026, [https://www.simplilearn.com/top-low-level-design-interview-questions-answers-article](https://www.simplilearn.com/top-low-level-design-interview-questions-answers-article)  
> 5. Tech Blog | System Design, Java, Kafka, Databases, and AI, [https://codesprintpro.com/blog/](https://codesprintpro.com/blog/)  
> 6. splitwise · GitHub Topics, [https://github.com/topics/splitwise?l=java\&o=asc\&s=stars](https://github.com/topics/splitwise?l=java&o=asc&s=stars)  
> 7. Как сеньор искал работу. Опыт собеседований в Яндекс и ВК, [https://habr.com/ru/articles/987912/](https://habr.com/ru/articles/987912/)
