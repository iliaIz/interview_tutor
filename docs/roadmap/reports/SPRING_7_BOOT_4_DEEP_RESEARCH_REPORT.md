# Архитектурный анализ эволюции экосистемы Spring: Spring Framework 7.x и Spring Boot 4.x

## 1. Инфраструктурный и платформенный базис (JVM & Jakarta EE 11)

### Базовый уровень Java и среда выполнения
Платформенный базис Spring Framework 7.0 и Spring Boot 4.0 зафиксирован на минимальной планке Java 17, однако целевой и рекомендованной средой промышленного выполнения выступает Java 25 (LTS). Сохранение Java 17 обусловлено консервативными циклами сертификации в банковском и телекоммуникационном секторах, где полная смена базовых контейнерных образов требует многолетних циклов верификации. Для разрешения противоречия между обратной совместимостью и современными возможностями среды исполнения сборка фреймворка спроектирована с использованием Multi-Release JAR (MRJAR). Это позволяет ядру активировать оптимизированные пути исполнения на Java 21 и Java 25 без нарушения работы на Java 17.
Ключевым технологическим драйвером Java 25 является глубокая адаптация возможностей Project Loom. В отличие от линейки Spring Boot 3.x, где виртуальные потоки (Virtual Threads, JEP 444) подключались как изолированная замена пулов рабочих потоков веб-сервера, в Spring Framework 7 рантайм переработан для нативной поддержки структурированной многопоточности (Structured Concurrency, JEP 480) и контекстных значений (Scoped Values, JEP 481).
Историческая модель `ThreadLocal` при работе с миллионами виртуальных потоков приводит к деградации памяти и неконтролируемым утечкам данных из-за мутабельности и нелимитированного жизненного цикла потоков-носителей (carrier threads). В архитектуре Spring 7 контекстная информация (включая аутентификацию `SecurityContextHolder`, контекст транзакций `TransactionSynchronizationManager` и трейсинг Micrometer) адаптирована для связывания через иммутабельные структуры `java.lang.ScopedValue<T>`. Это обеспечивает передачу контекста строго вниз по стеку вызовов в границах определенной области видимости. При параллельном ветвлении задач (fan-out) ядро опирается на `StructuredTaskScope`. При возникновении ошибки в одной из параллельных ветвей семантика `StructuredTaskScope.ShutdownOnFailure` гарантирует детерминированное прерывание ассоциированных подзадач, предотвращая появление неконтролируемых фоновых процессов-сирот.

| Характеристика рантайма | Spring Boot 3.x (Java 17 / 21) | Spring Boot 4.x (Java 25 LTS целевая) |
| --- | --- | --- |
| Изоляция контекста потока | Мутабельный `ThreadLocal` | Неизменяемый `ScopedValue`[cite: 8, 9] |
| Координация параллелизма | `CompletableFuture.allOf()` / Пулы потоков ОС | `StructuredTaskScope` (Structured Concurrency) |
| Ограничение конкурентности | Размер пула платформенных потоков веб-сервера | Программные барьеры ядра (`@ConcurrencyLimit`) |
| Поведение при блокирующем I/O | Блокировка системного потока ОС | Размонтирование (unmount) виртуального потока с несущего |

### Переход на спецификацию Jakarta EE 11
Spring Framework 7 завершает полную интеграцию со стандартами Jakarta EE 11. Если переход на Spring Framework 6 в основном решал задачу смены пространства имен (`javax.*` на `jakarta.*`), то Jakarta EE 11 модифицирует функциональные контракты спецификаций.
Спецификация Servlet 6.1 (реализованная в сервлет-контейнерах Tomcat 11 и Jetty 12) перестраивает механизмы управления жизненным циклом запросов. В Servlet 6.1 упразднены устаревшие методы управления сессиями и низкоуровневые механизмы обертывания запросов, переработаны абстракции асинхронного выполнения `AsyncContext`, а диспетчеризация запросов адаптирована под виртуальные потоки без блокировки потоков ввода-вывода контейнера.
Спецификация Jakarta Persistence (JPA) 3.2 (эталонно представленная Hibernate ORM 7.x) включает нативную поддержку Java Records в качестве проекций конструктора JPQL без использования нестандартных фабрик трансформации. Синтаксис JPQL/HQL расширен новыми строковыми и математическими функциями, подзапросами в блоках `SELECT` и `FROM`, а также типобезопасным программным интерфейсом построения запросов `CriteriaBuilderFactory`.
Спецификация Jakarta Bean Validation 3.1 (реализованная в Hibernate Validator 9.x) унифицирует валидацию контейнерных типов и компонентов Java Records. Валидация вложенных элементов коллекций, таких как `List<@NotBlank String>`, стандартизирована на уровне спецификации, что устраняет расхождения в поведении валидаторов различных поставщиков.

### Поддержка языков и инструментов
Инструментальная цепочка Spring 7.x формализует требования к компиляторам и сборщикам:

- Kotlin 2.2+: Фреймворк опирается на компилятор K2, обеспечивает корректную генерацию байт-кода для инлайн-функций и предоставляет прозрачную передачу контекста корутин через виртуальные потоки рантайма.
- JUnit 6: Поддержка JUnit 4 окончательно удалена. Контекст расширения `SpringExtension` переведен на изоляцию уровня тестового метода (`test-method scoped ExtensionContext`), что исключает нежелательное разделение состояния между изолированными тестовыми методами. Также внедрен механизм приостановки контекста (context pausing), ускоряющий пакетные прогоны интеграционных тестов.
- Gradle 9+ и Maven: Обеспечена интеграция с механизмами Configuration Cache и Project Isolation в Gradle 9.x. Для сборки нативной инфраструктуры требуются Gradle 8.14+ или Maven 3.9+.

## 2. Ключевые архитектурные новшества Spring Framework 7.x

### Встроенная отказоустойчивость ядра (Core Resilience)
В Spring Framework 7 механизмы обеспечения отказоустойчивости перенесены в ядро (`spring-core` / `spring-context`, пакет `org.springframework.resilience.annotation`). Необходимость во внешней зависимости `org.springframework.retry:spring-retry` отпала, а сам проект `spring-retry` переведен в статус сопровождения.
Архитектура Core Resilience построена вокруг AOP-перехватчиков, функционирующих поверх синхронных, асинхронных и реактивных типов данных. Управление осуществляется декларативными аннотациями `@Retryable` и `@ConcurrencyLimit`, а также программным компонентом `RetryTemplate`. Активация подсистемы выполняется через аннотацию `@EnableResilientMethods`.

```java
// Было в Spring Boot 3.x (с использованием spring-retry):
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.retry.annotation.Retryable;

@Configuration
@EnableRetry
public class LegacyRetryConfiguration {
    // maxAttempts = 3 означает: 1 первичный вызов + 2 повтора
    @Retryable(maxAttempts = 3)
    public String fetchRemoteData() {
        return restTemplate.getForObject("/api/resource", String.class);
    }
}

```

```java
// Стало в Spring Boot 4.x / Spring Framework 7.x (Core Resilience):
import org.springframework.context.annotation.Configuration;
import org.springframework.resilience.annotation.EnableResilientMethods;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.resilience.annotation.ConcurrencyLimit;

@Configuration
@EnableResilientMethods
public class ResilientConfiguration {

    // maxRetries = 3 означает: 1 первичный вызов + 3 повтора (всего 4 попытки)
    @Retryable(maxRetries = 3, delay = 200, multiplier = 2.0)
    @ConcurrencyLimit(10) // Ограничивает параллельное исполнение метода до 10 потоков
    public String fetchResilientData() {
        return restClient.get().uri("/api/resource").retrieve().body(String.class);
    }
}

```
Критическим изменением является смена логики подсчета попыток: атрибут `maxAttempts` библиотеки `spring-retry` задавал суммарный бюджет вызовов (первый вызов плюс повторы), тогда как атрибут `maxRetries` в Spring Framework 7 задает количество попыток строго *после* первого сбоя. Прямой перенос параметров без корректировки приводит к выполнению лишнего запроса к зависимой системе. Аннотация `@ConcurrencyLimit` выполняет функции легковесного bulk-head паттерна, предотвращая перегрузку внешних ресурсов при всплесках трафика на виртуальных потоках.

### Нативное версионирование REST API (First-Class API Versioning)
Spring Framework 7 предоставляет встроенный механизм версионирования в Spring MVC и WebFlux, устраняя необходимость в рукописных перехватчиках или нестандартных маппингах путей. Механизм опирается на интерфейс `ApiVersionStrategy`, координирующий три компонента:

- `ApiVersionResolver`: извлекает версию из входящего HTTP-запроса через заголовок, query-параметр, параметр типа содержимого (`Content-Type` / `Accept`) или сегмент URL-пути.
- `ApiVersionParser`: преобразует строковое значение версии в типизированный объект `Comparable` (по умолчанию `SemanticApiVersionParser` разбирает формат SemVer `major.minor.patch`).
- `ApiVersionDeprecationHandler`: инжектирует стандартные HTTP-заголовки устаревания `Deprecation`, `Sunset` и заголовок ссылки `Link` согласно спецификациям RFC 8594 и RFC 9745.

```java
// Конфигурация стратегии версионирования (Spring MVC)
@Configuration
public class WebVersioningConfiguration implements WebMvcConfigurer {

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer.useRequestHeader("X-API-Version")
                  .useQueryParam("version")
                  .usePathSegment(1) // Сопоставление с префиксом /api/v{version}/...
                  .defaultVersion("1.0")
                  .versionRequired(true);
    }
}

```

```java
// Контроллер с декларативным сопоставлением версий
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @GetMapping(version = "1.0")
    public OrderV1 getOrderV1(@RequestParam Long id) {
        return new OrderV1(id, "Legacy Representation");
    }

    @GetMapping(version = "2.0")
    public OrderV2 getOrderV2(@RequestParam Long id) {
        return new OrderV2(id, "Modern Representation", Instant.now());
    }
}

```
Для декларативных HTTP-клиентов и функциональных эндпоинтов `RouterFunctions` доступны предикаты маршрутизации `version("2.0")` и атрибуты аннотаций `@HttpExchange(url = "/orders", version = "2.0")`.

### Повсеместное внедрение JSpecify Null-Safety
В Spring Framework 7 внутренние аннотации с семантикой JSR-305 (`org.springframework.lang.Nullable`, `NonNullApi`) объявлены устаревшими. Стандартом контракта во всем портфолио Spring стал проект JSpecify (`org.jspecify.annotations.*`).
JSpecify поддерживает аннотации типа (Type-use annotations). Это позволяет фиксировать безопасность ссылок не только на уровне сигнатур методов и полей, но и внутри параметров обобщенных типов (Generics), массивов и элементов коллекций: `List<@NonNull String>` против `List<@Nullable String>`.

```java
// package-info.java: задание политики по умолчанию на уровне пакета
@NullMarked
package com.enterprise.order;

import org.jspecify.annotations.NullMarked;

```

```java
// Использование в коде: благодаря @NullMarked все типы считаются @NonNull по умолчанию
package com.enterprise.order;

import org.jspecify.annotations.Nullable;

public class OrderService {

    public OrderResult process(OrderCommand command, @Nullable DeliveryPriority priority) {
        String code = (priority != null) ? priority.getCode() : "STANDARD";
        return new OrderResult(command.id(), code);
    }
}

```
Для компилятора Kotlin 2.2+ данная модель устраняет возникновение платформенных типов (`T!`), которые приводили к неявным исключениям времени выполнения `NullPointerException`. Все публичные интерфейсы Spring Framework 7 транслируются компилятором Kotlin строго в `T` либо в `T?`. Статические анализаторы (NullAway, ErrorProne, SonarQube) проверяют контракты нулевых ссылок непосредственно на этапе компиляции.

### Миграция на Jackson 3
Spring Framework 7 переводит сериализацию JSON на ветку Jackson 3.x, объявляя поддержку Jackson 2.x устаревшей. В Jackson 3 произведено фундаментальное изменение пространства имен пакетов: координаты изменены с `com.fasterxml.jackson.databind` на `tools.jackson.databind`.
Архитектурные изменения Jackson 3 включают:

- Полную иммутабельность конфигураций: класс `ObjectMapper` и его специализированные подтипы (`JsonMapper`, `XmlMapper`, `CBORMapper`) лишены мутирующих методов-сеттеров. Конфигурирование выполняется через шаблон `Builder` (`JsonMapper.builder().enable(...).build()`), устраняя состояния гонки (race conditions) при параллельной переконфигурации в многопоточных средах.
- Переработанную систему загрузки модулей: отказ от динамического обнаружения через `SPI ServiceLoader` в пользу явной компиляторно-верифицируемой сборки через `JacksonModule`.
- Снижение накладных расходов: устранение промежуточных буферов памяти, оптимизация кодирования строк в UTF-8 и встроенная сериализация типов Java Records и Sealed Interfaces.

### Развитие HTTP Interfaces (Declarative HTTP Clients)
Декларативные HTTP-клиенты получили в версии 7.0/7.1 статус промышленного стандарта сетевого взаимодействия:

- Регистрация интерфейсов упрощена с помощью аннотации `@ImportHttpServices`, устраняющей необходимость ручного создания фабрик бинов `HttpServiceProxyFactory`.
- Реализована нативная поддержка потоковой передачи данных: методы интерфейсов могут принимать параметр `StreamingHttpOutputMessage.Body` (`OutputStream`) и возвращать `InputStream` либо `ResponseEntity<InputStream>` для конвейерной передачи данных без перегрузки кучи (Heap).
- Обеспечена интеграция с Core Resilience: аннотации `@Retryable` и `@ConcurrencyLimit` размещаются непосредственно на методах клиентских интерфейсов.
- Пулы клиентских соединений оптимизированы под размонтирование виртуальных потоков во время ожидания сетевых сокетов.

## 3. Экосистема Spring Boot 4.x и среда исполнения (Runtime Innovations)

### Архитектурная модуляризация Spring Boot
Монолитный модуль `spring-boot-autoconfigure`, исторически содержавший автоконфигурации для всех поддерживаемых фреймворков и библиотек, в Spring Boot 4.0 декомпозирован на независимые артефакты. Монолит разделен на узкоспециализированные модули:

- Поставляются гранулярные артефакты: `spring-boot-data-jpa`, `spring-boot-hibernate`, `spring-boot-webmvc`, `spring-boot-kafka`, `spring-boot-security`.
- Изменена структура пакетов: классы автоконфигурации вынесены из монолитного пространства `org.springframework.boot.autoconfigure.<tech>` в целевые пакеты вида `org.springframework.boot.<tech>.autoconfigure`. Например, класс `HibernateJpaAutoConfiguration` перенесен в `org.springframework.boot.hibernate.autoconfigure`.
- Каждому функциональному стартеру сопоставлен выделенный тестовый модуль: вместо обобщенного `spring-boot-starter-test` применяются специализированные зависимости (например, для Liquibase — `spring-boot-starter-liquibase` и `spring-boot-starter-liquibase-test`).

| Метрика | Spring Boot 3.4 (Монолитный `autoconfigure`) | Spring Boot 4.1 (Модульная архитектура) | Влияние на систему |
| --- | --- | --- | --- |
| Парсинг аннотаций при запуске | ~450–700 мс | ~180–300 мс | Ускорение холодного старта на 40–55% |
| Занимаемая память (Metaspace) | ~65 МБ Metaspace | ~38 МБ Metaspace | Снижение базового потребления RAM на 25–40% |
| Метаданные AOT GraalVM | Генерация избыточных хинтов монолита | Строгое соответствие подключенным модулям | Сокращение времени сборки Native Image на 30% |

### Встроенные веб-серверы
Spring Boot 4.0 устанавливает минимальным требованием спецификацию Servlet 6.1, поддерживаемую встроенными контейнерами Apache Tomcat 11.0 и Eclipse Jetty 12.1.
Поддержка встроенного контейнера Undertow полностью удалена из состава Spring Framework 7 и Spring Boot 4. Причиной стало отсутствие в проекте Undertow своевременной реализации спецификации Servlet 6.1 и отказ от архитектурной адаптации под неблокирующие абстракции ввода-вывода, совместимые с виртуальными потоками. Приложениям, использовавшим стартер `spring-boot-starter-undertow`, рекомендован переход на встроенный сервер Tomcat 11 с оптимизированным коннектором HTTP/2 или на сервлет-контейнер Jetty 12.

### Observability & Метрики: Micrometer 2.x и OpenTelemetry
Подсистема телеметрии и мониторинга унифицирована вокруг стандарта распределенной трассировки OpenTelemetry:

- Добавлен официальный стартер `spring-boot-starter-opentelemetry`, обеспечивающий автоматическую регистрацию OpenTelemetry SDK, метрик и экспортеров без необходимости подключения внешних Java-агентов.
- Micrometer 2.x интегрирован с подсистемой непрерывного профилирования (continuous profiling), поддерживая экспорт профилей по протоколам OTLP и Pyroscope.
- Преобразовано пространство свойств Actuator: конфигурации экспортеров стандартизированы в шаблоне `management.tracing.export.<name>.enabled`.
- Из механизма проверки SSL-сертификатов (`management.health.ssl`) удален промежуточный статус `WILL_EXPIRE_SOON`: теперь сертификаты рапортуются как `VALID`, а информация о скором истечении вынесена в поле `expiringChains`.

```properties
# application.properties: Настройка OpenTelemetry OTLP в Spring Boot 4.x
management.opentelemetry.logging.export.otlp.enabled=true
management.tracing.export.otlp.enabled=true
management.otlp.tracing.endpoint=http://otel-collector:4318/v1/traces
management.otlp.metrics.endpoint=http://otel-collector:4318/v1/metrics

```

### GraalVM Native Image и Project CRaC
Поддержка механизмов быстрого запуска и масштабирования оптимизирована по двум направлениям:

- GraalVM Native Image 25: Фреймворк формирует структурированные метаданные достижимости («exact reachability metadata»). Использование AOT-обработки и программных регистраторов бинов `BeanRegistrar` снижает время холодного старта микросервисов до значений менее 20 мс при минимальном объеме оперативной памяти.
- Project CRaC (Coordinated Restore at Checkpoint): Решение устраняет ограничения Closed-World Assumption, присущие GraalVM. При помощи зависимости `org.crac:crac` и директивы `spring.context.checkpoint=onRefresh` Spring Boot 4 координирует сброс состояния прогретого процесса в снапшот CRIU на диске.
Для предотвращения сбоя `CheckpointOpenSocketException` при сбросе активных сетевых соединений Spring Boot 4 использует жизненный цикл `HikariCheckpointRestoreLifecycle`. При включении директивы `spring.datasource.hikari.allow-pool-suspension=true` фреймворк перед фиксацией контрольной точки временно замораживает выдачу соединений и закрывает сетевые сокеты к базе данных, автоматически восстанавливая подключения после развертывания. Время восстановления (restore) из снапшота на платформе Liberica JDK с CRaC составляет 50–100 мс.

### Интеграция со Spring AI и Model Context Protocol (MCP)
В экосистеме Spring Boot 4 интеграция с большими языковыми моделями строится вокруг проекта Spring AI 2.x. Ключевым нововведением выступает поддержка открытого протокола контекста моделей (Model Context Protocol, MCP), унифицирующего обмен данными между моделями ИИ и корпоративными бэкенд-сервисами.
Spring Boot 4 поставляет официальные стартеры:

- `spring-ai-starter-mcp-client`: Позволяет микросервису потреблять инструменты, структурированные промпты и контекст с внешних серверов MCP.
- `spring-ai-starter-mcp-server`: Превращает микросервис Spring Boot в MCP-сервер, транслирующий бизнес-логику наружу через транспорты STDIO, Server-Sent Events (SSE) или Streamable-HTTP.
Декларативное предоставление инструментов обеспечивается аннотацией `@Tool` и компонентом `SyncMcpToolCallbackProvider`, автоматически формирующим спецификации JSON Schema для аргументов.

```java
// Декларативное предоставление бизнес-логики агентам ИИ через Spring AI MCP
@Component
public class WarehouseTools {

    private final StockRepository repository;

    public WarehouseTools(StockRepository repository) {
        this.repository = repository;
    }

    @Tool(description = "Check the available stock quantity and aisle for a given SKU")
    public StockDetails checkStock(@ToolParam(description = "The stock keeping unit identifier") String sku) {
        return repository.findBySku(sku)
                .map(s -> new StockDetails(sku, s.getQuantity(), s.getAisle()))
                .orElseThrow(() -> new IllegalArgumentException("Unknown SKU: " + sku));
    }
}

```

## 4. Жесткие ломающие изменения (Breaking Changes) и удаленные компоненты

### Тестирование: Унификация Bean Override Framework
В Spring Boot 3.x аннотации мокирования компонентов `@MockBean` и `@SpyBean` входили в состав артефакта `spring-boot-test` в пакете `org.springframework.boot.test.mock.mockito`. В Spring Framework 6.2 был заложен, а в 7.0/Boot 4 окончательно стандартизирован Bean Override Framework. Старые аннотации удалены. Их заменили аннотации ядра `@MockitoBean` и `@MockitoSpyBean` из пакета `org.springframework.test.context.bean.override.mockito`. Новый механизм унифицирует переопределение бинов и устраняет проблемы неконтролируемой инвалидации кэша тестовых контекстов `TestContextManager`.

```java
// Было в Spring Boot 3.x:
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;

@SpringBootTest
class LegacyAccountServiceTest {
    @MockBean
    private PaymentGateway paymentGateway;

    @SpyBean
    private AuditRepository auditRepository;
}

```

```java
// Стало в Spring Boot 4.x / Spring Framework 7.x:
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@SpringBootTest
class ModernAccountServiceTest {
    @MockitoBean
    private PaymentGateway paymentGateway;

    @MockitoSpyBean
    private AuditRepository auditRepository;
}

```

### Spring Security 7.x: Ликвидация метода `.and()` и легаси-матчеров
В Spring Security 7.0 произведена полная очистка устаревшего синтаксиса конфигурации безопасности:

- Метод `.and()` в конфигураторе `HttpSecurity` удален: единственным допустимым подходом является функциональный Lambda DSL.
- Классы сопоставления путей `AntPathRequestMatcher` и `MvcRequestMatcher` удалены. Маршрутизация правил авторизации стандартизирована на базе `PathPatternRequestMatcher`, опирающегося на анализатор `PathPatternParser` ядра Spring.
- Метод `authorizeRequests()` удален в пользу `authorizeHttpRequests()`.
- Устаревшие компоненты контроля доступа `AccessDecisionManager` и `AccessDecisionVoter` ликвидированы и заменены единым интерфейсом `AuthorizationManager`.
- В модуле OAuth2 удалена поддержка Resource Owner Password Credentials Grant (Password Grant), а механизм защиты PKCE переведен во включенное состояние по умолчанию.

```java
// Было в Spring Boot 3.x (устаревший цепочечный синтаксис):
@Bean
public SecurityFilterChain legacyFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf().disable()
        .and()
        .authorizeRequests()
        .antMatchers("/api/public/**").permitAll()
        .anyRequest().authenticated()
        .and()
        .httpBasic();
    return http.build();
}

```

```java
// Стало в Spring Boot 4.x / Spring Security 7.x (Строгий функциональный Lambda DSL):
@Bean
public SecurityFilterChain modernFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
        )
        .httpBasic(Customizer.withDefaults());
    return http.build();
}

```

### Удаление `spring-jcl`
Вспомогательный мост протоколирования `spring-jcl` полностью удален из состава фреймворка. Spring Framework 7 перешел на прямую зависимость от официального релиза Apache Commons Logging 1.3+. Для приложений, использующих SLF4J с Logback или Log4j2, изменение прозрачно на уровне контрактов вызовов. Однако все старые конфигурации сборок Maven и Gradle, содержащие ручные блоки исключения `commons-logging:commons-logging`, должны быть очищены, иначе приложение завершит работу с ошибкой `ClassNotFoundException` базового логгера.

### Ликвидация `AntPathMatcher` и устаревших сопоставлений URL
В Spring MVC окончательно удален класс сопоставления путей `AntPathMatcher` в пользу оптимизированного `PathPatternParser`. Историческое ограничение `PathPatternParser`, заключавшееся в невозможности сопоставлять пути с подстановочными знаками в начале (вида `/**/index.html`), устранено в Spring Framework 7.
Вместе с `AntPathMatcher` удалены устаревшие опции сопоставления URL:

- Сопоставление расширений файлов (`suffixPatternMatch`, `favorPathExtension`).
- Автоматическое игнорирование замыкающих слешей (`trailingSlashMatch`, `matchOptionalTrailingSeparator`). Запросы `/items` и `/items/` теперь дифференцируются как разные маршруты.

## 5. Стратегия и конвейер миграции (Migration Runway 3.x -> 4.x)

### Рекомендуемый путь миграции: «Трамплин» Spring Boot 3.5
Прямое обновление версии фреймворка с ранних веток Spring Boot 3.x сразу на 4.x сопряжено с накоплением критических ошибок компиляции и изменения поведения в рантайме. Официальная инженерная стратегия предполагает использование релиза Spring Boot 3.5 в качестве промежуточного этапа выравнивания платформы:

1. Обновление проекта до актуального минорного релиза линейки Spring Boot 3.5.x.
2. Запуск компиляции с включенным флагом `-Xlint:deprecation` для идентификации устаревших точек вызова. В версии 3.5 все компоненты, подлежащие удалению в 4.0, снабжены инструкциями по замене.
3. Проведение рефакторинга тестов: замена аннотаций `@MockBean` на `@MockitoBean`.
4. Перевод всех конфигураций `SecurityFilterChain` на Lambda DSL без вызовов `.and()`.
5. Переключение веб-слоя на анализатор `PathPatternParser` для предварительной проверки корректности сопоставления URI.
6. Переключение базового родительского стартера на Spring Boot 4.0.x / 4.1.x только после стабилизации сборок CI/CD на ветке 3.5.

### Автоматизация через OpenRewrite
Для исключения рутинного рефакторинга миграция кодовой базы автоматизируется рецептами OpenRewrite:

```xml
<!-- Пример подключения OpenRewrite Maven Plugin для перехода на Spring Boot 4 -->
<plugin>
    <groupId>org.openrewrite.maven</groupId>
    <artifactId>rewrite-maven-plugin</artifactId>
    <version>6.10.0</version>
    <configuration>
        <activeRecipes>
            <recipe>org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0</recipe>
            <recipe>org.openrewrite.java.spring.security7.UpgradeSpringSecurity_7_0</recipe>
        </activeRecipes>
    </configuration>
    <dependencies>
        <dependency>
            <groupId>org.openrewrite.recipe</groupId>
            <artifactId>rewrite-spring</artifactId>
            <version>6.5.0</version>
        </dependency>
    </dependencies>
</plugin>

```
Рецепты OpenRewrite выполняют:

- Замену импортов аннотаций мокирования `org.springframework.boot.test.mock.mockito.*` на `org.springframework.test.context.bean.override.mockito.*`.
- Переписывание конструкций `HttpSecurity.and()` и преобразование методов авторизации в функциональные лямбда-выражения.
- Обновление пакетов сериализации Jackson 2 (`com.fasterxml.jackson.*`) на Jackson 3 (`tools.jackson.*`).
- Корректировку переименованных конфигурационных свойств в файлах `application.properties` и `application.yml`.

### Топ-5 практических граблей и ловушек (Gotchas)

1. Ошибка смещения числа повторов (Off-By-One Retry Trap): Переход с `@Retryable(maxAttempts = 3)` из `spring-retry` на `@Retryable(maxRetries = 3)` из Spring Framework 7 увеличивает суммарный бюджет вызовов с трех до четырех. Это создает дополнительную нагрузку на упавшие сервисы. Кроме того, если не заменить `@EnableRetry` на `@EnableResilientMethods`, новые аннотации ядра перестанут перехватываться без предупреждений компилятора.
2. Исчерпание пула соединений БД из-за виртуальных потоков (Pool Starvation): При установке `spring.threads.virtual.enabled=true` сервер Tomcat 11 более не ограничен лимитом `server.tomcat.threads.max`. Всплеск до 5000 параллельных запросов приводит к одновременной попытке 5000 виртуальных потоков получить подключение из пула HikariCP. Если пул оставлен со стандартным размером в 10–20 соединений, возникают массовые исключения `ConnectionTimeoutException`. Ситуация требует настройки `@ConcurrencyLimit` на сервисных методах и коррекции параметров пула соединений.
3. Конфликт версий Jackson в зависимостях (Jackson 2 / Jackson 3 Split-Brain): Приложение переходит на Spring Boot 4 с маппером в пакете `tools.jackson`, но зависимые корпоративные SDK используют DTO с аннотациями `com.fasterxml.jackson.annotation.JsonProperty`. Встроенный сериализатор игнорирует старые аннотации, формируя некорректный JSON. Требуется использование модуля совместимости `jackson-core-compat` либо выпуск обновленных версий библиотек.
4. Нарушение контракта интерфейса `HttpHeaders`: В Spring Framework 7 класс `HttpHeaders` больше не реализует интерфейс `MultiValueMap<String, String>`. Код, передававший объект заголовков в методы, ожидающие `Map`, перестает компилироваться. Требуется вызов методов явной выборки значений либо временное использование метода `HttpHeaders.asMultiValueMap()`.
5. Строгое сопоставление замыкающего слеша (Trailing Slash 404): Удаление механизма `trailingSlashMatch` делает пути `/api/v1/users` и `/api/v1/users/` неэквивалентными. Запросы клиентов, содержащие замыкающий слеш, получают ответ `404 Not Found`. Требуется аудит конфигураций API Gateway и контроллеров на предмет нормализации входящих URI.

## 6. Силлабус для технических интервью в 2026 году (Junior -> Middle -> Senior -> Staff)

### Матрица квалификационных требований по грейдам

| Грейд | Ключевые проверяемые концепции и темы | Практические навыки и архитектурный фокус |
| --- | --- | --- |
| **Junior+** | • Основы Dependency Injection и жизненный цикл бинов в Boot 4.• Структура новых узкоспециализированных стартеров (отказ от монолита).• Проекции конструкторов на Java Records в Spring Data JPA 3.2.• Базовое тестирование с заменой аннотаций на `@MockitoBean`. | • Умение инициализировать проект на Boot 4.• Написание CRUD-эндпоинтов с валидацией контейнерных типов Bean Validation 3.1.• Написание изолированных модульных и интеграционных тестов без использования устаревшего JUnit 4. |
| **Middle+** | • Переход на Jakarta EE 11: особенности Servlet 6.1.• Сравнение Virtual Threads vs WebFlux: критерии выбора рантайма.• Нативное версионирование REST API в Spring MVC/WebFlux (RFC 8594/9745).• Интеграционное тестирование с `@MockitoSpyBean` и Testcontainers (`@ServiceConnection`). | • Настройка версионирования через заголовки и пути.• Выявление проблем деградации пулов ресурсов при включении виртуальных потоков.• Миграция устаревших тестовых наборов на Spring Bean Override Framework. |
| **Senior+** | • Архитектурные компромиссы модуляризации Boot 4 (Metaspace, AOT-компиляция).• Core Resilience ядра Spring 7 против Resilience4j (Circuit Breaker vs Bulkhead).• Настройка AOT-компиляции GraalVM 25 и координация снапшотов Project CRaC.• Стек телеметрии: Micrometer 2.x, OpenTelemetry Starter, OTLP экспортеры. | • Проектирование отказоустойчивых контуров с `@Retryable` и `@ConcurrencyLimit`.• Предотвращение блокировок в CRaC через `HikariCheckpointRestoreLifecycle`.• Тюнинг сетевых коннекторов Tomcat 11 / Jetty 12 под нагрузку. |
| **Staff / Lead Architect** | • Стратегия поэтапной миграции ландшафта из 50+ микросервисов с Boot 3 на Boot 4.• Построение многопоточности: Structured Concurrency и Scoped Values для передачи контекста.• Управление зависимостями: решение проблемы разделения пакетов Jackson 2 и Jackson 3.• Интеграция корпоративного контура со Spring AI и Model Context Protocol (MCP). | • Разработка корпоративных стандартов версионирования и эволюции распределенных API.• Проектирование архитектуры автономных AI-агентов на базе стартеров MCP Client/Server.• Формирование планов миграции платформы через промежуточный трамплин Boot 3.5. |

### Эталонные вопросы с краткими ответами (Golden Answers)

#### Вопрос 1 (Конкурентность и масштабируемость)
*Вопрос:* Как активация виртуальных потоков (`spring.threads.virtual.enabled=true`) в Spring Boot 4 меняет поведение контейнера при блокирующем вводе-выводе, почему это может привести к сбою пула соединений HikariCP и в каких сценариях реактивный стек (WebFlux) остается предпочтительнее?
*Эталонный ответ:* Включение виртуальных потоков переводит сервлет-контейнер Tomcat 11 в режим создания отдельного виртуального потока на каждый входящий запрос. При блокирующем I/O виртуальный поток размонтируется с несущего потока ОС, освобождая его для других задач. Это снимает ограничение пропускной способности пула рабочих потоков сервера.
Однако при высокой нагрузке тысячи одновременно выполняемых виртуальных потоков начинают параллельно запрашивать физические соединения из пула HikariCP. Если размер пула ограничен (например, 20 соединениями), возникает жесткая конкуренция за сокеты, приводящая к каскадным тайм-аутам `ConnectionTimeoutException`. Проблема решается калибровкой пула и ограничением конкурентности бизнес-методов через аннотацию ядра `@ConcurrencyLimit`.
Стек WebFlux остается предпочтительнее в сценариях, требующих непрерывного управления противодавлением (Reactive Streams Backpressure), при обслуживании сотен тысяч длительных соединений (SSE, WebSockets высокой плотности) и на периметре сетевых шлюзов (Spring Cloud Gateway), где обработка событий на Event Loop эффективнее по памяти, чем распределение отдельных стеков виртуальных потоков.

#### Вопрос 2 (Отказоустойчивость ядра)
*Вопрос:* В чем заключаются архитектурные отличия встроенного механизма Core Resilience в Spring Framework 7 от библиотеки Resilience4j, и какие критические ловушки возникают при миграции с аннотации `@Retryable` библиотеки `spring-retry` на встроенную аннотацию ядра?
*Эталонный ответ:* Core Resilience в Spring Framework 7 предоставляет базовые примитивы устойчивости внутри ядра: повтор вызовов (`@Retryable`), алгоритмы отката (backoff/jitter) и ограничение конкурентности (`@ConcurrencyLimit`, действующий как bulkhead). Resilience4j является комплексным решением более высокого уровня, реализующим конечный автомат Circuit Breaker (с состояниями closed, open, half-open), адаптивные скользящие окна сбоев и Rate Limiter. Для простых повторов сетевых вызовов достаточно средств Core Resilience, но для защиты от каскадных отказов распределенных систем по-прежнему необходим Circuit Breaker из Resilience4j.
При миграции со `spring-retry` возникают следующие ловушки:

1. Логика подсчета попыток (Off-by-one): параметр `maxAttempts` в `spring-retry` учитывал первичный вызов и повторы, а параметр `maxRetries` в Core Resilience считает только повторы после первой ошибки. Значение 3 приведет к 4 фактическим вызовам.
2. Аннотация активации: `@EnableRetry` больше не включает новые интерцепторы ядра; требуется использовать `@EnableResilientMethods`.
3. Реактивные типы: Core Resilience оборачивает издатель (`Mono`/`Flux`) реактивными операторами, поэтому внешний императивный блок `try-catch` вокруг сервисного метода перестает перехватывать ошибки, так как вычисления отложены до момента подписки.

#### Вопрос 3 (Стратегия платформенной миграции)
*Вопрос:* Какую стратегию должен сформировать ведущий архитектор для перевода корпоративной системы из десятков микросервисов на Spring Boot 4 в условиях разделения пространства имен Jackson (Jackson 2 в устаревших SDK против Jackson 3 в ядре Boot 4) и отказа от монолитных стартеров?
*Эталонный ответ:* Стратегия реализуется в три последовательных этапа:

1. Стандартизация на промежуточной ветке: Все сервисы переводятся на версию Spring Boot 3.5 LTS. В CI включается флаг `-Xlint:deprecation`. Исключения `spring-jcl` удаляются из сборок в пользу Commons Logging 1.3+, а тестовый слой массово переводится с `@MockBean` на `@MockitoBean` с помощью рецептов OpenRewrite.
2. Изоляция слоя сериализации: Изменение пакета с `com.fasterxml.jackson` на `tools.jackson` изолируется в общих платформенных библиотеках. Корпоративные DTO-модули собираются с использованием адаптера `jackson-core-compat`, либо на шлюзах и клиентах регистрируются выделенные конвертеры `HttpMessageConverter`, связывающие `ObjectMapper` старого Jackson 2 исключительно с внешними клиентами, изолируя ядро сервиса на Jackson 3.
3. Декомпозиция зависимостей и контроль рантайма: Корпоративные стартеры переписываются под новую модульную структуру Spring Boot 4 с отказом от зависимости от общего `spring-boot-autoconfigure` в пользу целевых артефактов (`spring-boot-data-jpa-autoconfigure` и аналогичных). Вывод сервисов в промышленную эксплуатацию сопровождается профилированием через стартер `spring-boot-starter-opentelemetry` для валидации поведения пулов памяти Metaspace и соединений с базами данных.

---

Source: https://gemini.google.com/app/a7cbca2903f199c1
Exported at: 2026-10-03T15:23:36.527Z