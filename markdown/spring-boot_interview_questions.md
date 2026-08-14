# Spring Boot — Вопросы и Ответы для Собеседования

> **Раздел:** Web & Enterprise | **Всего вопросов:** 25 | **Источник:** Baeldung / InterviewBit

*Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3, GraalVM AOT*

---
## Содержание / Быстрый переход

- [1. Что такое Spring Boot и в чем его основные преимущества перед классическим Spring Framework?](#q-1)
- [2. Что делает аннотация @SpringBootApplication и из каких аннотаций она состоит?](#q-2)
- [3. Как устроен механизм Auto-Configuration в Spring Boot?](#q-3)
- [4. Как отключить конкретную автоконфигурацию в Spring Boot?](#q-4)
- [5. Что такое Spring Boot Starters и какие популярные стартеры вы знаете?](#q-5)
- [6. В чем разница между application.properties и application.yml?](#q-6)
- [7. В каком порядке Spring Boot загружает конфигурационные свойства (Property Precedence)?](#q-7)
- [8. Что такое Spring Profiles и как их активировать?](#q-8)
- [9. Что такое Spring Boot Actuator и для чего он используется?](#q-9)
- [10. В чем разница между @ConfigurationProperties и @Value?](#q-10)
- [11. В чем разница между JpaRepository, CrudRepository и PagingAndSortingRepository?](#q-11)
- [12. Что такое проблема N+1 в Spring Data JPA / Hibernate и какими 3 способами её решают?](#q-12)
- [13. В чем разница между методами save() и saveAndFlush() в Spring Data JPA?](#q-13)
- [14. Как организовать версионирование и миграции базы данных в Spring Boot (Flyway / Liquibase)?](#q-14)
- [15. Как работает декларативное кэширование в Spring Boot (@Cacheable, @CachePut, @CacheEvict)?](#q-15)
- [16. Как настроить несколько источников данных (Multiple DataSources) в Spring Boot?](#q-16)
- [17. Что такое Spring Cloud и какие основные компоненты он включает?](#q-17)
- [18. Как работает паттерн Circuit Breaker (Предохранитель) в Spring Boot / Resilience4j?](#q-18)
- [19. Что такое OpenFeign (@FeignClient) и в чем его преимущества?](#q-19)
- [20. Что такое распределенная трассировка (Distributed Tracing) в Spring Boot 3?](#q-20)
- [21. Что такое паттерн Saga и в чем разница между Orchestration и Choreography?](#q-21)
- [22. Как работает асинхронная обработка в Spring Boot (@Async, @EnableAsync)?](#q-22)
- [23. Как работают аннотации тестирования в Spring Boot (@SpringBootTest, @WebMvcTest, @DataJpaTest, @MockBean)?](#q-23)
- [24. Как контейнеризировать Spring Boot приложение: Dockerfile vs Cloud Native Buildpacks?](#q-24)
- [25. Что нового появилось в Spring Boot 3.x и Spring Framework 6.x?](#q-25)

---

### <a id="q-1"></a>1. Что такое Spring Boot и в чем его основные преимущества перед классическим Spring Framework? `[BOOT-001]`

**Spring Boot** — это надстройка над Spring Framework, предназначенная для быстрого создания готовых к production автономных (*stand-alone*) приложений с минимальными начальными настройками (*convention-over-configuration*).

### Ключевые преимущества:
1. **Auto-Configuration (Автоконфигурация):** автоматическая настройка бинов на основе присутствующих в classpath библиотек и свойств.
2. **Spring Boot Starters:** агрегированные зависимости (starter POMs), избавляющие от ручного разрешения конфликтов версий библиотек.
3. **Встроенный сервлет-контейнер (Embedded Server):** Tomcat, Jetty или Undertow встроены прямо в исполняемый JAR. Не требуется внешний сервер приложений (Tomcat/WildFly).
4. **Production-Ready Features (Actuator):** встроенный мониторинг, проверка здоровья (`/health`), метрики (Micrometer/Prometheus), просмотр конфигурации (`/env`, `/beans`).
5. **Никакой генерации XML-кода:** полностью декларативная настройка через свойства и аннотации.

---

### <a id="q-2"></a>2. Что делает аннотация @SpringBootApplication и из каких аннотаций она состоит? `[BOOT-002]`

`@SpringBootApplication` — это составная мета-аннотация, объединяющая три ключевые аннотации:

1. **`@SpringBootConfiguration`:** специализированная версия `@Configuration`, обозначающая класс как источник определения бинов.
2. **`@EnableAutoConfiguration`:** включает интеллектуальный механизм автоконфигурации Spring Boot.
3. **`@ComponentScan`:** запускает сканирование компонентов (`@Component`, `@Service`, `@Repository`, `@Controller`) в текущем пакете и всех его подпакетах.

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

---

### <a id="q-3"></a>3. Как устроен механизм Auto-Configuration в Spring Boot? `[BOOT-003]`

Механизм автоконфигурации работает следующим образом:

1. При запуске аннотация `@EnableAutoConfiguration` ищет классы автоконфигураций:
   - В Spring Boot 2.x: через файл `META-INF/spring.factories`.
   - В Spring Boot 3.x: через `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
2. Каждая автоконфигурация проверяет условия с помощью аннотаций семейства **`@Conditional`**:
   - `@ConditionalOnClass`: класс присутствует в classpath (например, `DataSource.class`).
   - `@ConditionalOnMissingBean`: бин еще не объявлен разработчиком (позволяет легко переопределить стандартное поведение).
   - `@ConditionalOnProperty`: в свойствах включен соответствующий флаг.
   - `@ConditionalOnWebApplication`: приложение является веб-приложением.
3. Если все условия истинны, конфигурация регистрирует стандартный набор бинов.

*Для отладки автоконфигураций запустите приложение с флагом `--debug` — Spring Boot выведет полный Conditions Evaluation Report.*

---

### <a id="q-4"></a>4. Как отключить конкретную автоконфигурацию в Spring Boot? `[BOOT-004]`

Есть два основных способа:

1. **Через аннотацию `@SpringBootApplication` или `@EnableAutoConfiguration`:**
   ```java
   @SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, SecurityAutoConfiguration.class })
   public class Application { ... }
   ```
2. **Через файл конфигурации `application.properties` / `application.yml`:**
   ```properties
   spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
   ```

---

### <a id="q-5"></a>5. Что такое Spring Boot Starters и какие популярные стартеры вы знаете? `[BOOT-005]`

**Spring Boot Starter** — это готовый дескриптор зависимостей, объединяющий библиотеки, совместимые версии и транзитивные зависимости для решения определенной задачи.

### Популярные стартеры:
* `spring-boot-starter-web`: Spring MVC, RESTful сервисы, валидация, Jackson и встроенный Tomcat.
* `spring-boot-starter-data-jpa`: Spring Data JPA, Hibernate, HikariCP пул соединений.
* `spring-boot-starter-security`: Spring Security с базовой аутентификацией.
* `spring-boot-starter-actuator`: конечные точки мониторинга и сбора метрик.
* `spring-boot-starter-test`: JUnit 5, Mockito, AssertJ, Hamcrest, Spring Test.
* `spring-boot-starter-validation`: валидация моделей на базе Hibernate Validator / Bean Validation.

---

### <a id="q-6"></a>6. В чем разница между application.properties и application.yml? `[BOOT-006]`

Оба формата служат для внешней конфигурации приложения, но имеют синтаксические различия:

| Критерий | `application.properties` | `application.yml` |
| :--- | :--- | :--- |
| **Формат** | Плоский `key=value` синтаксис | Иерархический YAML с отступами |
| **Читаемость** | При длинных префиксах много повторений | Наглядная древовидная структура |
| **Сложные типы (Lists, Maps)** | `app.servers[0]=127.0.0.1` | Естественные списки (`- 127.0.0.1`) |
| **Использование с `@PropertySource`** | Поддерживается по умолчанию | Не поддерживается стандартным `@PropertySource` без кастомного `YamlPropertySourceFactory` |

---

### <a id="q-7"></a>7. В каком порядке Spring Boot загружает конфигурационные свойства (Property Precedence)? `[BOOT-007]`

Spring Boot загружает свойства из множества источников с четким приоритетом (от наивысшего к низшему):

1. **Аргументы командной строки (`--server.port=9090`)** — наивысший приоритет.
2. `SPRING_APPLICATION_JSON` (свойства в формате JSON в переменной окружения).
3. Системные свойства Java (`System.getProperties()`, переданные через `-Dserver.port=9090`).
4. **Переменные окружения ОС (`OS Environment Variables`, например `SERVER_PORT=9090`).**
5. Профиль-зависимый конфиг вне JAR (`file:./config/application-{profile}.properties`).
6. Профиль-зависимый конфиг внутри JAR (`classpath:application-{profile}.properties`).
7. Общий конфиг приложения вне JAR (`file:./config/application.properties`).
8. **Общий конфиг приложения внутри JAR (`classpath:application.properties`)** — наименьший приоритет.
9. Значения по умолчанию в `@ConfigurationProperties` / `@Value`.

---

### <a id="q-8"></a>8. Что такое Spring Profiles и как их активировать? `[BOOT-008]`

**Spring Profiles** — механизм изолирования конфигураций и бинов для различных сред выполнения (например, `dev`, `test`, `stage`, `prod`).

### Использование:
1. **На уровне бинов и классов конфигураций:**
   ```java
   @Configuration
   @Profile("dev")
   public class DevDatabaseConfig { ... }
   ```
2. **Через раздельные файлы настроек:**
   - `application-dev.yml` (активен при профиле `dev`)
   - `application-prod.yml` (активен при профиле `prod`)

### Способы активации профиля:
* В свойствах: `spring.profiles.active=dev,k8s`
* В аргументах JVM: `-Dspring.profiles.active=prod`
* В переменных окружения: `export SPRING_PROFILES_ACTIVE=prod`
* В тестах: `@ActiveProfiles("test")`

---

### <a id="q-9"></a>9. Что такое Spring Boot Actuator и для чего он используется? `[BOOT-009]`

**Spring Boot Actuator** — модуль, предоставляющий готовые HTTP-эндпоинты и JMX-интерфейсы для мониторинга, проверки жизнеспособности (*health checks*) и управления приложением в production.

### Основные эндпоинты:
* **`/actuator/health`:** статус доступности приложения (Liveness и Readiness пробы для Kubernetes, статус БД, Redis, диска).
* **`/actuator/info`:** информация о версии, git commit hash, сборке.
* **`/actuator/metrics`:** системные и кастомные метрики через Micrometer (CPU, JVM Heap, Garbage Collection, HTTP Latency).
* **`/actuator/env`:** просмотр текущих свойств и переменных окружения.
* **`/actuator/loggers`:** просмотр и **динамическое изменение уровня логирования на лету** без перезапуска приложения (`POST /actuator/loggers/com.example.service`).
* **`/actuator/beans`:** список всех зарегистрированных бинов в ApplicationContext.

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
```

---

### <a id="q-10"></a>10. В чем разница между @ConfigurationProperties и @Value? `[BOOT-010]`

| Критерий | `@ConfigurationProperties` | `@Value` |
| :--- | :--- | :--- |
| **Назначение** | Привязка иерархического блока свойств к POJO-классу | Внедрение единичного скалярного значения или SpEL выражения |
| **Поддержка Relaxed Binding** | **Да** (`kebab-case`, `camelCase`, `SNAKE_CASE` автоматически маппятся) | **Нет** (требует строгого совпадения имени) |
| **Валидация (JSR-380)** | **Да** (через `@Validated`, `@NotNull`, `@Min`) | Нет |
| **Типобезопасность** | Высокая (статическая типизация полей) | Низкая (строковые литералы) |
| **Поддержка SpEL** | Нет | **Да** (`@Value("#{systemProperties['user.home']}")`) |

---

### <a id="q-11"></a>11. В чем разница между JpaRepository, CrudRepository и PagingAndSortingRepository? `[BOOT-011]`

Иерархия репозиториев Spring Data:

```
CrudRepository
    └── PagingAndSortingRepository
            └── JpaRepository
```

* **`CrudRepository`:** предоставляет базовые методы CRUD (`save()`, `findById()`, `existsById()`, `deleteById()`, `count()`).
* **`PagingAndSortingRepository`:** добавляет методы пагинации и сортировки (`findAll(Pageable pageable)`, `findAll(Sort sort)`).
* **`JpaRepository`:** добавляет JPA-специфичные операции: сброс сессии (`flush()`, `saveAndFlush()`), пакетное удаление (`deleteInBatch()`), работу с `Example` запросами. В 95% проектов рекомендуется использовать `JpaRepository`.

---

### <a id="q-12"></a>12. Что такое проблема N+1 в Spring Data JPA / Hibernate и какими 3 способами её решают? `[BOOT-012]`

**Проблема N+1** возникает, когда при выборке списка из $N$ родительских сущностей для каждой сущности выполняется отдельный дополнительный SQL-запрос для загрузки её связанной Lazy-коллекции (итого $1 + N$ запросов вместо 1).

### 3 способа решения:
1. **JPQL `JOIN FETCH` (Рекомендуется для кастомных репозиториев):**
   ```java
   @Query("SELECT o FROM Order o JOIN FETCH o.customer WHERE o.status = :status")
   List<Order> findAllWithCustomer(@Param("status") OrderStatus status);
   ```
2. **`@EntityGraph` (Декларативное указание графа загрузки):**
   ```java
   @EntityGraph(attributePaths = {"customer", "orderItems"})
   List<Order> findByStatus(OrderStatus status);
   ```
3. **Пакетная загрузка `@BatchSize`:**
   ```java
   @BatchSize(size = 30)
   @OneToMany(mappedBy = "order")
   private List<OrderItem> items;
   ```
   Hibernate объединяет ID сущностей в условие `WHERE order_id IN (?, ?, ...)`.

---

### <a id="q-13"></a>13. В чем разница между методами save() и saveAndFlush() в Spring Data JPA? `[BOOT-013]`

* **`save()`:** сохраняет сущность в контекст постоянства Hibernate (First-Level Cache / Persistence Context). Реальный SQL `INSERT`/`UPDATE` может быть отложен до момента коммита транзакции.
* **`saveAndFlush()`:** выполняет сохранение и **немедленно принудительно синхронизирует состояние с базой данных** (вызывает `EntityManager.flush()`).

*Когда применять `saveAndFlush()`:* когда в рамках той же транзакции последующий нативный SQL-запрос или триггер БД зависит от уже вставленной записи.

---

### <a id="q-14"></a>14. Как организовать версионирование и миграции базы данных в Spring Boot (Flyway / Liquibase)? `[BOOT-014]`

В production-средах категорически запрещено использовать `ddl-auto: create` или `update`. Используются инструменты миграций:

### Использование Flyway:
1. Добавить `org.flywaydb:flyway-core` и `flyway-database-postgresql` в зависимости.
2. Поместить версионированные SQL-скрипты в `src/main/resources/db/migration/`:
   - `V1__create_users_table.sql`
   - `V2__add_email_index.sql`
3. При старте Spring Boot проверяет таблицу `flyway_schema_history` и накатывает только новые миграции.

---

### <a id="q-15"></a>15. Как работает декларативное кэширование в Spring Boot (@Cacheable, @CachePut, @CacheEvict)? `[BOOT-015]`

Кэширование включается аннотацией `@EnableCaching` на конфигурационном классе:

* **`@Cacheable("products")`:** сохраняет результат метода в кэш. При повторном вызове с теми же аргументами метод не выполняется, данные берутся из кэша.
* **`@CachePut(value = "products", key = "#product.id")`:** всегда выполняет метод и обновляет запись в кэше.
* **`@CacheEvict(value = "products", key = "#id")`:** удаляет запись из кэша (например, при удалении товара).

```java
@Service
public class ProductService {
    @Cacheable(value = "products", key = "#id")
    public ProductDto getById(Long id) {
        return productRepository.findById(id).map(mapper::toDto).orElseThrow();
    }

    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) {
        productRepository.deleteById(id);
    }
}
```
*В production-среде в качестве Cache Provider подключают **Redis** (`spring-boot-starter-data-redis`).*

---

### <a id="q-16"></a>16. Как настроить несколько источников данных (Multiple DataSources) в Spring Boot? `[BOOT-016]`

Для подключения к двум разным БД создаются отдельные конфигурации:

```java
@Configuration
public class MultiDataSourceConfig {

    @Primary
    @Bean
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.secondary")
    public DataSource secondaryDataSource() {
        return DataSourceBuilder.create().build();
    }
}
```
Затем для каждого источника настраиваются отдельные `LocalContainerEntityManagerFactoryBean` и `PlatformTransactionManager`, привязанные к разным пакетам репозиториев (`@EnableJpaRepositories(basePackages = "...", entityManagerFactoryRef = "...")`).

---

### <a id="q-17"></a>17. Что такое Spring Cloud и какие основные компоненты он включает? `[BOOT-017]`

**Spring Cloud** — это экосистема библиотек для упрощения разработки распределенных систем и микросервисов:

* **Spring Cloud Config:** централизованное хранилище конфигураций сервисов (в Git).
* **Service Discovery (Eureka / Consul):** динамическая регистрация и обнаружение сервисов без хардкода IP/портов.
* **Spring Cloud Gateway:** API Gateway для маршрутизации, rate limiting и безопасности.
* **OpenFeign:** декларативный HTTP-клиент для межсервисного взаимодействия.
* **Resilience4j:** паттерны отказоустойчивости (Circuit Breaker, Retry, RateLimiter, Bulkhead).
* **Micrometer Tracing:** сквозная распределенная трассировка запросов.

---

### <a id="q-18"></a>18. Как работает паттерн Circuit Breaker (Предохранитель) в Spring Boot / Resilience4j? `[BOOT-018]`

**Circuit Breaker** предотвращает каскадные сбои в микросервисной архитектуре, изолируя временно недоступный сервис.

### 3 состояния Circuit Breaker:
1. **Closed (Закрыт):** нормальная работа, запросы проходят без задержек. Если процент ошибок превышает порог, переходит в `Open`.
2. **Open (Открыт):** запросы блокируются немедленно без вызова упавшего сервиса (fail-fast) и сразу вызывается `fallbackMethod`.
3. **Half-Open (Полуоткрыт):** по истечении таймаута пропускает пробное количество запросов. Если они успешны — возвращается в `Closed`, иначе — снова в `Open`.

```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
public PaymentResponse processPayment(PaymentRequest request) {
    return paymentClient.executePayment(request);
}

public PaymentResponse paymentFallback(PaymentRequest request, Throwable ex) {
    return new PaymentResponse("PENDING", "Сервис платежей временно недоступен. Заказ в очереди.");
}
```

---

### <a id="q-19"></a>19. Что такое OpenFeign (@FeignClient) и в чем его преимущества? `[BOOT-019]`

**OpenFeign** — это декларативный HTTP-клиент, позволяющий описывать межсервисные вызовы через обычные Java-интерфейсы с аннотациями Spring MVC:

```java
@FeignClient(name = "inventory-service", path = "/api/v1/inventory")
public interface InventoryClient {

    @GetMapping("/{sku}")
    StockDto checkStock(@PathVariable("sku") String sku);

    @PostMapping("/reserve")
    ReservationDto reserveItems(@RequestBody ReserveRequest request);
}
```
*Преимущества:* не нужно писать шаблонный код с `RestTemplate`/`WebClient`, автоматическая интеграция с Service Discovery (Eureka), балансировкой нагрузки (Spring Cloud LoadBalancer) и Circuit Breakers (Resilience4j).

---

### <a id="q-20"></a>20. Что такое распределенная трассировка (Distributed Tracing) в Spring Boot 3? `[BOOT-020]`

В микросервисах один клиентский запрос может проходить через цепочку из 5-10 сервисов. **Distributed Tracing** связывает все логи и вызовы единым идентификатором.

* **`traceId`:** уникальный идентификатор всего сквозного запроса от клиента до финального ответа.
* **`spanId`:** идентификатор операции внутри конкретного сервиса.
* **Реализация в Spring Boot 3:** модуль **Micrometer Tracing** (пришедший на смену Spring Cloud Sleuth), экспортирующий трейсы в Zipkin, Jaeger или OpenTelemetry.

---

### <a id="q-21"></a>21. Что такое паттерн Saga и в чем разница между Orchestration и Choreography? `[BOOT-021]`

**Saga** — архитектурный паттерн управления распределенными транзакциями в микросервисах. Транзакция разбивается на цепочку локальных транзакций. Если один из шагов падает, запускаются **компенсирующие транзакции (Compensating Transactions)** для отката изменений.

### Два подхода к реализации Saga:
1. **Choreography (Хореография):** каждый сервис слушает события (Kafka/RabbitMQ) и самостоятельно решает, когда выполнять свое действие. *Плюсы:* слабая связанность. *Минусы:* сложно отслеживать сложный поток.
2. **Orchestration (Оркестрация):** выделенный сервис-оркестратор (например, на Camunda/Temporal или Spring Boot) централизованно отправляет команды сервисам и обрабатывает ошибки.

---

### <a id="q-22"></a>22. Как работает асинхронная обработка в Spring Boot (@Async, @EnableAsync)? `[BOOT-022]`

Для выполнения тяжелых задач в фоновом потоке:

1. Включить поддержку аннотацией `@EnableAsync`.
2. Настроить кастомный `ThreadPoolTaskExecutor`:
   ```java
   @Configuration
   @EnableAsync
   public class AsyncConfig {
       @Bean(name = "taskExecutor")
       public Executor taskExecutor() {
           ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
           executor.setCorePoolSize(10);
           executor.setMaxPoolSize(50);
           executor.setQueueCapacity(100);
           executor.setThreadNamePrefix("async-worker-");
           executor.initialize();
           return executor;
       }
   }
   ```
3. Пометить метод аннотацией `@Async`:
   ```java
   @Service
   public class EmailNotificationService {
       @Async("taskExecutor")
       public CompletableFuture<Void> sendEmailAsync(String to, String message) {
           emailClient.send(to, message);
           return CompletableFuture.completedFuture(null);
       }
   }
   ```

---

### <a id="q-23"></a>23. Как работают аннотации тестирования в Spring Boot (@SpringBootTest, @WebMvcTest, @DataJpaTest, @MockBean)? `[BOOT-023]`

Spring Boot предоставляет специализированные аннотации для интеграционного и срезового (slice) тестирования:

* **`@SpringBootTest`:** поднимает **полный контекст** приложения (ApplicationContext). Используется для полноценных end-to-end интеграционных тестов.
* **`@WebMvcTest`:** тестирует только веб-слой (контроллеры, фильтры, `Security`). Контроллер тестируется изолированно с помощью `MockMvc`, сервисы заменяются на моки.
* **`@DataJpaTest`:** тестирует слой доступа к данным (репозитории Spring Data JPA). Автоматически настраивает in-memory БД (H2) и включает откат транзакций после каждого теста.
* **`@MockBean` (в Spring Boot 3.4+ заменяется на `@MockitoBean`):** создает Mockito-мок и помещает его в Spring ApplicationContext вместо реального бина.

---

### <a id="q-24"></a>24. Как контейнеризировать Spring Boot приложение: Dockerfile vs Cloud Native Buildpacks? `[BOOT-024]`

### 1. Многоэтапный Dockerfile (Multi-stage Build с Eclipse Temurin 21):
```dockerfile
FROM eclipse-temurin:21-jre-alpine AS builder
WORKDIR /app
COPY target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 2. Spring Boot Cloud Native Buildpacks (Рекомендуется в Spring Boot 3+):
Сборка OCI-совместимого Docker-образа без написания Dockerfile:
```bash
# Maven
mvn spring-boot:build-image

# Gradle
./gradlew bootBuildImage
```
*Преимущества Buildpacks:* автоматическое разделение на слои (Dependencies, Spring Boot Loader, Application Classes), обновление базовой JRE без пересборки кода, оптимизированное кэширование слоев в Docker Registry.

---

### <a id="q-25"></a>25. Что нового появилось в Spring Boot 3.x и Spring Framework 6.x? `[BOOT-025]`

Ключевые новшества Spring Boot 3 и Spring 6 (актуальные стандарты на 2026 год):

1. **Минимальная версия Java:** базовой версией стала **Java 17** (с полной поддержкой Java 21 Virtual Threads / Project Loom).
2. **Миграция на Jakarta EE 10:** пакет `javax.*` заменен на `jakarta.*` (сервлеты `jakarta.servlet`, валидация `jakarta.validation`, JPA `jakarta.persistence`).
3. **GraalVM Native Image & AOT:** встроенная поддержка Ahead-of-Time компиляции в нативные бинарники с мгновенным стартом (< 50мс) и низким потреблением памяти.
4. **Виртуальные потоки (Virtual Threads):** включение одной строчкой `spring.threads.virtual.enabled=true`.
5. **Унифицированная обработка ошибок (RFC 7807):** стандартная поддержка спецификации `ProblemDetail`.
6. **HTTP Interfaces (Declarative Clients):** декларативные HTTP-клиенты через аннотации `@HttpExchange` без необходимости Feign.

---
