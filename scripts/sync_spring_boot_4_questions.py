#!/usr/bin/env python3
"""
Synchronizes Spring Boot 4.x and Spring Framework 7.x interview questions
across all platform SSOT artifacts:
1. scripts/build_spring_topics.py
2. json/all_interview_questions.json
3. json/spring-boot_questions.json
4. json/topics_metadata.json
5. markdown/spring-boot_interview_questions.md
6. markdown/all_interview_questions.md
7. SQLite databases (data/interview.db and backend/data/interview.db)
"""

import os
import sys
import json
import sqlite3
import re

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Define questions 25 (refined) and 26..30
QUESTIONS = [
    {
        "id": "BOOT-025",
        "num": 25,
        "topic": "Spring Boot",
        "question": "Что нового появилось в Spring Boot 3.x и Spring Framework 6.x?",
        "answer": """Ключевые новшества Spring Boot 3 и Spring 6 (базовый фундамент современной платформы):

1. **Минимальная версия Java:** базовой версией стала **Java 17** (с долгосрочной поддержкой и адаптацией под Java 21 Virtual Threads / Project Loom).
2. **Миграция на спецификацию Jakarta EE 10:** пакет `javax.*` полностью заменен на `jakarta.*` (сервлеты `jakarta.servlet`, валидация `jakarta.validation`, JPA `jakarta.persistence`).
3. **GraalVM Native Image & AOT Engine:** встроенная поддержка Ahead-of-Time компиляции в нативные бинарники с мгновенным стартом (< 50 мс) и минимальным потреблением оперативной памяти.
4. **Виртуальные потоки (Virtual Threads):** возможность активации одной строчкой конфигурации `spring.threads.virtual.enabled=true`.
5. **Унифицированная обработка ошибок (RFC 7807):** стандартизированная поддержка спецификации `ProblemDetail` в контроллерах.
6. **HTTP Interfaces (Declarative Clients):** декларативные HTTP-клиенты через аннотации `@HttpExchange` без необходимости подключения внешнего Spring Cloud OpenFeign.
7. **Унифицированная Observability:** появление `Micrometer Observation API` и распределенной трассировки «из коробки» взамен устаревшего Spring Cloud Sleuth.

*Архитектурное примечание:* Стек Spring Boot 3.x / Spring 6.x сформировал обязательный технологический трамплин (Java 17+, Jakarta EE 10, AOT-инфраструктура), необходимый для бесшовного перехода на генерацию Spring Boot 4.x и Spring Framework 7.x.""",
        "source_pages": ["Baeldung / InterviewBit (Curated)"]
    },
    {
        "id": "BOOT-026",
        "num": 26,
        "topic": "Spring Boot",
        "question": "Что нового появилось в Spring Boot 4.x и Spring Framework 7.x?",
        "answer": """Spring Boot 4.x и Spring Framework 7.x представляют собой следующее мажорное поколение экосистемы Spring:

1. **JVM-базис и Java 25 LTS:** абсолютным минимальным порогом остается Java 17, однако рантайм полностью оптимизирован для **Java 25 LTS**. Внедрена нативная интеграция со Scoped Values (`ScopedValue<T>`) и Structured Concurrency (`StructuredTaskScope`), вытесняющими тяжелые и подверженные утечкам `ThreadLocal`.
2. **Jakarta EE 11:** переход на Servlet 6.1, JPA 3.2 (нативная поддержка Java Records как конструкторных проекций JPQL без кастомных фабрик) и Bean Validation 3.1 (стандартизированная валидация дженериков `List<@NotBlank String>`).
3. **Core Resilience (Отказоустойчивость ядра):** подсистема отказоустойчивости перенесена напрямую в ядро (`spring-core` / `spring-context`). Аннотации `@EnableResilientMethods`, `@Retryable`, `@ConcurrencyLimit` доступны из коробки без устаревшей библиотеки `spring-retry`.
4. **First-Class API Versioning:** нативная поддержка версионирования в Spring MVC и WebFlux через интерфейс `ApiVersionStrategy`, парсер `SemanticApiVersionParser` (SemVer) и инжекцию стандартных HTTP-заголовков устаревания `Deprecation` и `Sunset` (RFC 8594 / RFC 9745).
5. **JSpecify Null-Safety:** полный отказ от JSR-305 в пользу стандарта `org.jspecify.annotations.*` (`@NullMarked`, `@Nullable`). Обеспечивает строгую проверку null-safety для дженериков и коллекций на этапе компиляции в Java и Kotlin 2.2+.
6. **Jackson 3 Integration:** штатная интеграция с `tools.jackson.databind` (взамен `com.fasterxml.jackson`), переход на потокобезопасные неизменяемые билдеры (`JsonMapper.builder()`).
7. **Модуляризация и удаление легаси:**
   * Декомпозиция монолитного `spring-boot-starter-web` на модульные стартеры;
   * Окончательное удаление сервера **Undertow** (рекомендуются Tomcat 11 или Jetty 12);
   * Ликвидация `AntPathMatcher` в пользу строгого `PathPatternParser`;
   * Замена `@MockBean` / `@SpyBean` на официальный Bean Override Framework (`@MockitoBean` / `@MockitoSpyBean`);
   * Spring Security 7: ликвидация метода `.and()` и легаси-матчеров URL в пользу чистого лямбда-DSL.
8. **Spring AI & Model Context Protocol (MCP):** стандартизированная интеграция с большими языковыми моделями (LLM) и открытым протоколом MCP (Model Context Protocol Client & Server), декларативная публикация сервисов в виде AI-инструментов через аннотацию `@Tool`.""",
        "source_pages": ["Spring Framework 7 & Spring Boot 4 Reference / SOTA 2026 Deep Research"]
    },
    {
        "id": "BOOT-027",
        "num": 27,
        "topic": "Spring Boot",
        "question": "Как устроена встроенная подсистема Core Resilience в Spring Framework 7 и в чем ее отличие от Resilience4j и legacy spring-retry?",
        "answer": """В Spring Framework 7 подсистема обеспечения отказоустойчивости перенесена непосредственно в ядро фреймворка (`spring-core` / `spring-context`, пакет `org.springframework.resilience.annotation`). Проект `spring-retry` официально переведен в статус сопровождения.

### 1. Архитектура и декларативное использование
Core Resilience базируется на AOP-перехватчиках и единообразно поддерживает синхронные методы, `CompletableFuture` и реактивные типы Project Reactor (`Mono`/`Flux`). Активируется аннотацией `@EnableResilientMethods`:

```java
@Configuration
@EnableResilientMethods
public class ResilientClientConfig {

    // maxRetries = 3 означает: 1 первичный вызов + 3 повтора (всего 4 попытки)
    @Retryable(maxRetries = 3, delay = 200, multiplier = 2.0, includes = {RemoteTimeoutException.class})
    @ConcurrencyLimit(15) // Ограничивает параллельное выполнение до 15 одновременных потоков
    public String executeResilientCall() {
        return restClient.get().uri("/api/data").retrieve().body(String.class);
    }
}
```

### 2. Критическая ловушка семантики (Off-by-one Retry Trap)
При миграции с legacy `spring-retry` важно учитывать фундаментальную смену контрактной логики:
* В `spring-retry`: атрибут `maxAttempts = 3` означал **суммарный бюджет попыток** (1 первичная попытка + 2 повтора).
* В Spring 7 Core Resilience: атрибут называется `maxRetries = 3` и задает **количество повторов строго после первичного сбоя** (1 первичная попытка + 3 повтора = 4 вызова).
* *Последствие:* прямой механический перенос значения без уменьшения на 1 создает непредусмотренную лишнюю нагрузку на зависимый сервис.

### 3. Легковесный Bulkhead (`@ConcurrencyLimit`)
Аннотация `@ConcurrencyLimit` ограничивает параллельное выполнение методов семафором в рамках локальной JVM. Это критически необходимо в эпоху виртуальных потоков (Virtual Threads), предотвращая перегрузку пулов потоков, соединений с базами данных и downstream HTTP-сервисов.

### 4. Разграничение: Core Resilience vs Resilience4j
* **Core Resilience (Spring 7):** закрывает базовые потребности 80% микросервисов — экспоненциальные повторы (Exponential Backoff), ограничение локальной конкурентности (`@ConcurrencyLimit`) и простые fallback-методы без сторонних зависимостей.
* **Resilience4j:** остается отраслевым enterprise-стандартом для распределенных и сложных топологий, где требуются:
  * Полноценный **Circuit Breaker** (с динамическими состояниями CLOSED / OPEN / HALF_OPEN, скользящими окнами времени и процентом допустимых ошибок `failureRateThreshold`);
  * Распределенный **RateLimiter** (Token Bucket / Leaky Bucket);
  * Потоковая публикация событий и глубокие метрики через Micrometer в Prometheus/Grafana для аварийных алертов.""",
        "source_pages": ["Spring Framework 7 Reference / SOTA 2026 Deep Research"]
    },
    {
        "id": "BOOT-028",
        "num": 28,
        "topic": "Spring Boot",
        "question": "Как изменилась работа с Virtual Threads в Spring Boot 4 и как избежать исчерпания пула соединений БД (HikariCP starvation)?",
        "answer": """В Spring Boot 4 под капотом Java 25 LTS виртуальные потоки (Virtual Threads, Project Loom) перешли в категорию промышленного стандарта, но потребовали пересмотра архитектурных паттернов управления ресурсами.

### 1. Эволюция рантайма и уход от ThreadLocal
* **Ликвидация Carrier Pinning:** в ранних версиях виртуальные потоки «прикалывались» (pinned) к платформенным потокам-носителям при входе в блоки `synchronized`. В современном рантайме синхронизация деблокирована на уровне виртуальной машины.
* **Scoped Values (`ScopedValue<T>`):** в Spring Boot 4 передача контекста безопасности (`SecurityContext`), трассировки и транзакций постепенно переводится с `ThreadLocal` на Scoped Values. `ThreadLocal` выделяет отдельную изменяемую карту для каждого потока, что при создании миллионов короткоживущих виртуальных потоков приводило к колоссальному расходу памяти и деградации GC. `ScopedValue` иммутабелен, легковесен и наследуется дочерними виртуальными задачами без накладных расходов.

### 2. Проблема исчерпания пула соединений (HikariCP Starvation)
Виртуальные потоки снимают ограничение на количество одновременных задач в сервлетном контейнере (Tomcat может одновременно обрабатывать 10 000+ запросов вместо 200). Однако физические ресурсы базы данных остаются строго ограниченными:
* Если 5 000 виртуальных потоков одновременно обращаются к `DataSource.getConnection()`, а пул HikariCP настроен на стандартные 30–50 соединений, 4 950 потоков зависают в ожидании соединения.
* Наступает истощение пула (**HikariCP Pool Starvation**): время ожидания превышает `connectionTimeout` (по умолчанию 30 с), запросы массово падают с ошибками тайм-аута, а накладные расходы на переключение виртуальных потоков перегружают планировщик JVM и саму СУБД.

### 3. Методы решения и архитектурные барьеры
1. **Применение `@ConcurrencyLimit`:** критические участки бизнес-логики, требующие доступа к БД, защищаются аннотацией ограничения конкурентности Spring 7:
   ```java
   @Service
   public class OrderProcessingService {
       @Transactional
       @ConcurrencyLimit(30) // Не более 30 параллельных транзакций (согласовано с размером HikariCP)
       public OrderConfirmation processOrder(OrderRequest request) { ... }
   }
   ```
2. **Асинхронные семафоры и изоляция очередей:** использование семафоров (`java.util.concurrent.Semaphore`) перед обращением к транзакционному слою, чтобы виртуальные потоки ожидали в контролируемой очереди до вызова `getConnection()`.
3. **Разделение доменов (Virtual Threads vs WebFlux):**
   * *Virtual Threads (Spring MVC):* идеальный выбор для CRUD, классического JDBC, JPA и блокирующего ввода-вывода (IO-bound).
   * *Spring WebFlux:* сохраняет преимущество для сценариев с миллионами длительных полуактивных соединений с низким трафиком (SSE, WebSockets, streaming), где даже минимальные накладные расходы стека виртуального потока (1–2 КБ) уступают реактивным цепочкам.""",
        "source_pages": ["Spring Boot 4 Performance Guide / SOTA 2026 Deep Research"]
    },
    {
        "id": "BOOT-029",
        "num": 29,
        "topic": "Spring Boot",
        "question": "Какова стратегия безопасной миграции крупного приложения со Spring Boot 3.x на Spring Boot 4.x и какие ключевые ломающие изменения нужно учитывать?",
        "answer": """Миграция enterprise-приложения на Spring Boot 4.x требует поэтапного подхода для минимизации рисков простоя и регрессий.

### 1. Стратегия двух фаз: Трамплин Spring Boot 3.5
Прямой переход с устаревших веток Spring Boot 3.2/3.3 на 4.x категорически не рекомендуется.
* **Фаза 1 (Подготовка):** перевод проекта на промежуточный «трамплин» **Spring Boot 3.5**. На этом этапе включаются флаги предупреждения о депрекейтах, устраняются вызовы устаревших методов и проверяется совместимость с Java 21 / 25.
* **Фаза 2 (Миграция на 4.x):** перевод зависимостей на `spring-boot-starter-parent:4.x` и запуск автоматизированных рецептов OpenRewrite.

### 2. Автоматизация рефакторинга через OpenRewrite
Рецепт `org.openrewrite.recipe:rewrite-spring:upgradeSpringBoot_4_0` выполняет до 80-85% механической работы:
```bash
mvn rewrite:run -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST -Drewrite.activeRecipes=org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0
```
Рецепт автоматически производит:
* Замену пакетов Jackson 2 (`com.fasterxml.jackson.*`) на Jackson 3 (`tools.jackson.*`);
* Переход на унифицированный Bean Override Framework в тестах: замена `@MockBean` и `@SpyBean` на `@MockitoBean` и `@MockitoSpyBean` из пакета `org.springframework.test.context.bean.override.mockito`;
* Замену легаси-конфигураций Spring Security на декларативный лямбда-синтаксис.

### 3. Топ-4 критических ломающих изменений (Breaking Changes)
1. **Ликвидация `.and()` в Spring Security 7:** устаревший метод `.and()` при настройке цепочки фильтров `SecurityFilterChain` окончательно удален. Поддерживается исключительно лямбда-DSL:
   ```java
   // Было: http.authorizeHttpRequests().requestMatchers("/api/**").authenticated().and().csrf().disable();
   // Стало:
   http
       .authorizeHttpRequests(auth -> auth.requestMatchers("/api/**").authenticated())
       .csrf(AbstractHttpConfigurer::disable);
   ```
2. **Ликвидация `AntPathMatcher`:** маршрутизация URL в Spring MVC опирается исключительно на строгий парсер `PathPatternParser`. Шаблоны с неопределенностями (например, множественные wildcard-символы `**` в середине пути) вызывают фатальную ошибку конфигурации при старте приложения.
3. **Удаление сервлет-контейнера Undertow:** стартер `spring-boot-starter-undertow` удален из официальной поставки (в связи с прекращением апстрим-развития Undertow в пользу Quarkus). Проектам требуется мигрировать на `spring-boot-starter-tomcat` (Tomcat 11) или `spring-boot-starter-jetty` (Jetty 12).
4. **Конфликт сериализации Jackson 2 vs Jackson 3 (Split-Brain):** сторонние транзитивные библиотеки могут по-прежнему зависеть от классов `com.fasterxml.jackson`, в то время как Spring Boot 4 конфигурирует бин `JsonMapper` из пакета `tools.jackson`. Решается подключением адаптера обратной совместимости `jackson-core-compat` либо регистрацией дополнительного legacy-бина `ObjectMapper`.""",
        "source_pages": ["Spring Boot 4 Migration Guide / SOTA 2026 Deep Research"]
    },
    {
        "id": "BOOT-030",
        "num": 30,
        "topic": "Spring Boot",
        "question": "Как Spring Boot 4 интегрируется со Spring AI и Model Context Protocol (MCP), и как предоставить сервис в виде инструмента (@Tool) для LLM?",
        "answer": """В экосистеме Spring Boot 4 искусственный интеллект и большие языковые модели (LLM) интегрированы в качестве первоклассных граждан через стек **Spring AI** и нативную реализацию открытого отраслевого стандарта **Model Context Protocol (MCP)**.

### 1. Архитектура Model Context Protocol (MCP) в Spring Boot
MCP стандартизирует безопасное взаимодействие AI-ассистентов с корпоративными источниками данных и исполняемыми функциями:
* **MCP Server:** Spring Boot приложение выступает сервером, экспортируя свои бизнес-методы (Tools), структурированные данные (Resources) и контекстные шаблоны (Prompts) для подключенных AI-агентов.
* **MCP Client:** приложение может выступать клиентом, подключаясь к внешним MCP-серверам (PostgreSQL MCP, GitHub MCP, Slack MCP, Jira MCP) и выполняя оркестрацию мультиагентных систем.

### 2. Декларативное объявление AI-инструментов (`@Tool`)
Любой Spring-бин может объявить метод в качестве инструмента для LLM с помощью аннотации `@Tool`:

```java
@Service
public class AccountManagementService {

    private final AccountRepository repository;

    public AccountManagementService(AccountRepository repository) {
        this.repository = repository;
    }

    @Tool(
        name = "getAccountBalance", 
        description = "Возвращает текущий баланс счета и валюту по заданному номеру счета IBAN"
    )
    public AccountBalanceResponse getBalance(
        @ToolParam(description = "Международный номер банковского счета (IBAN)") String iban
    ) {
        return repository.findBalanceByIban(iban)
            .map(b -> new AccountBalanceResponse(iban, b.getAmount(), b.getCurrency()))
            .orElseThrow(() -> new AccountNotFoundException("Счет не найден: " + iban));
    }
}
```

### 3. Автоматическая генерация JSON-схемы и валидация
При старте приложения Spring AI:
1. Анализирует сигнатуру метода, типы параметров (включая Java Records) и аннотации валидации Jakarta Bean Validation (`@NotNull`, `@Pattern`, `@Size`).
2. Генерирует строгую спецификацию JSON Schema для Function Calling.
3. При поступлении от LLM запроса на вызов инструмента (Tool Call) автоматически валидирует аргументы, конвертирует JSON в Java-объекты и выполняет целевой метод в пуле виртуальных потоков.

### 4. Поддерживаемые транспортные протоколы MCP
Spring Boot 4 поддерживает различные сетевые транспорты MCP в зависимости от архитектурного профиля:
* **STDIO (Стандартный ввод/вывод):** взаимодействие через консольные потоки ввода-вывода с локальными десктопными клиентами (Claude Desktop, IDE-ассистенты);
* **SSE (Server-Sent Events) поверх HTTP:** асинхронный веб-транспорт для облачных микросервисов;
* **WebSockets & gRPC:** высокопроизводительные каналы для распределенных мультиагентных сетей с двунаправленным обменом данными и минимальной сетевой задержкой.""",
        "source_pages": ["Spring AI & Model Context Protocol Reference / SOTA 2026 Deep Research"]
    }
]

def sync_all_interview_questions_json():
    json_path = os.path.join(BASE_DIR, "json", "all_interview_questions.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update BOOT-025
    idx_25 = next(i for i, q in enumerate(data) if q.get("id") == "BOOT-025")
    data[idx_25]["question"] = QUESTIONS[0]["question"]
    data[idx_25]["answer"] = QUESTIONS[0]["answer"]

    # 2. Check if BOOT-026..BOOT-030 already exist or need insertion
    existing_ids = {q.get("id") for q in data}
    insert_after_idx = idx_25
    for q_spec in QUESTIONS[1:]:
        if q_spec["id"] in existing_ids:
            # Update existing
            cur_idx = next(i for i, q in enumerate(data) if q.get("id") == q_spec["id"])
            data[cur_idx]["question"] = q_spec["question"]
            data[cur_idx]["answer"] = q_spec["answer"]
            data[cur_idx]["source_pages"] = q_spec["source_pages"]
        else:
            # Insert right after
            insert_after_idx += 1
            new_entry = dict(q_spec)
            data.insert(insert_after_idx, new_entry)

    # 3. Recalculate sequential global_id across all questions
    for idx, q in enumerate(data):
        q["global_id"] = idx + 1

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Synced json/all_interview_questions.json: total {len(data)} questions")
    return data

def sync_spring_boot_questions_json():
    json_path = os.path.join(BASE_DIR, "json", "spring-boot_questions.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Update BOOT-025
    idx_25 = next(i for i, q in enumerate(data) if q.get("id") == "BOOT-025")
    data[idx_25]["question"] = QUESTIONS[0]["question"]
    data[idx_25]["answer"] = QUESTIONS[0]["answer"]

    existing_ids = {q.get("id") for q in data}
    start_gid = data[idx_25]["global_id"]
    for i, q_spec in enumerate(QUESTIONS[1:], start=1):
        if q_spec["id"] in existing_ids:
            cur_idx = next(idx for idx, q in enumerate(data) if q.get("id") == q_spec["id"])
            data[cur_idx]["question"] = q_spec["question"]
            data[cur_idx]["answer"] = q_spec["answer"]
            data[cur_idx]["source_pages"] = q_spec["source_pages"]
        else:
            entry = dict(q_spec)
            entry["global_id"] = start_gid + i
            data.append(entry)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Synced json/spring-boot_questions.json: total {len(data)} questions")

def sync_topics_metadata_json():
    json_path = os.path.join(BASE_DIR, "json", "topics_metadata.json")
    with open(json_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    for item in meta:
        if item.get("id") == "spring-boot":
            item["count"] = 30
            item["description"] = "Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3 & 4, Core Resilience, Virtual Threads, Spring AI & MCP"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("✅ Synced json/topics_metadata.json: spring-boot count=30")

def sync_spring_boot_markdown():
    md_path = os.path.join(BASE_DIR, "markdown", "spring-boot_interview_questions.md")
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Update header count and description
    content = re.sub(
        r">\s*\*\*Раздел:\*\*\s*Web & Enterprise\s*\|\s*\*\*Всего вопросов:\*\*\s*\d+\s*\|\s*\*\*Источник:\*\*.*",
        "> **Раздел:** Web & Enterprise | **Всего вопросов:** 30 | **Источник:** Baeldung / InterviewBit / SOTA 2026 Deep Research",
        content
    )
    content = content.replace(
        "*Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3, GraalVM AOT*",
        "*Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3 & 4, Core Resilience, Virtual Threads, Spring AI & MCP*"
    )

    # Check TOC: add 26..30 if missing
    for q in QUESTIONS[1:]:
        toc_entry = f"- [{q['num']}. {q['question']}](#q-{q['num']})"
        if f"(#q-{q['num']})" not in content:
            # Insert after question 25 in TOC
            prev_num = q['num'] - 1
            pattern = re.compile(rf"(\[?{prev_num}\.[^\]\n]+\]\(#q-{prev_num}\))")
            match = pattern.search(content)
            if match:
                content = content[:match.end()] + f"\n{toc_entry}" + content[match.end():]

    # Replace / update question 25 body
    # Find question 25 section
    q25_header_pattern = r"(###\s*<a id=\"q-25\"></a>25\.\s*Что нового появилось в Spring Boot 3\.x и Spring Framework 6\.x\?\s*`\[BOOT-025\]`\s*\n\n)(.*?)(?=\n---\n|$)"
    updated_q25_section = f"### <a id=\"q-25\"></a>25. {QUESTIONS[0]['question']} `[BOOT-025]`\n\n{QUESTIONS[0]['answer']}"
    
    # Check if questions 26..30 already exist in body
    for q in QUESTIONS[1:]:
        q_tag = f"`[{q['id']}]`"
        if q_tag not in content:
            # Append question before trailing content
            new_block = f"\n\n---\n\n### <a id=\"q-{q['num']}\"></a>{q['num']}. {q['question']} `[{q['id']}]`\n\n{q['answer']}"
            content = content.rstrip() + new_block + "\n\n---\n"
        else:
            # Replace existing question block
            pattern = re.compile(rf"(###\s*<a id=\"q-{q['num']}\"></a>{q['num']}\..*?`\[{q['id']}\]`\s*\n\n)(.*?)(?=\n---\n|$)", re.DOTALL)
            replacement = f"### <a id=\"q-{q['num']}\"></a>{q['num']}. {q['question']} `[{q['id']}]`\n\n{q['answer']}"
            content = pattern.sub(lambda m: replacement, content)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("✅ Synced markdown/spring-boot_interview_questions.md (30 questions)")

def sync_all_interview_questions_markdown():
    md_path = os.path.join(BASE_DIR, "markdown", "all_interview_questions.md")
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Locate BOOT-025 in all_interview_questions.md
    # Target pattern for BOOT-025:
    pattern = re.compile(r"### 25\. Что нового появилось в Spring Boot 3\.x и Spring Framework 6\.x\? `\[BOOT-025\]`.*?(?=\n---\n\n\n# <a id=\"реактивное-программирование\">)", re.DOTALL)
    
    blocks = [f"### 25. {QUESTIONS[0]['question']} `[BOOT-025]`\n\n{QUESTIONS[0]['answer']}"]
    for q in QUESTIONS[1:]:
        blocks.append(f"### {q['num']}. {q['question']} `[{q['id']}]`\n\n{q['answer']}")

    replacement = "\n\n---\n\n".join(blocks)
    
    if pattern.search(content):
        content = pattern.sub(replacement, content)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("✅ Synced markdown/all_interview_questions.md (inserted BOOT-026..BOOT-030)")
    else:
        print("⚠️ Pattern for BOOT-025 in all_interview_questions.md did not match exactly, checking manual insertion...")
        pos = content.find("`[BOOT-025]`")
        if pos != -1:
            # find end of section before '# <a id="реактивное-программирование">'
            next_topic = content.find('# <a id="реактивное-программирование">', pos)
            if next_topic != -1:
                # Find the '---' before next_topic
                last_sep = content.rfind('---', pos, next_topic)
                section_before = content[:pos-7] # up to '### 25.'
                section_after = content[last_sep:]
                content = section_before + replacement + "\n\n" + section_after
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print("✅ Synced markdown/all_interview_questions.md via positional slice")

def sync_sqlite_databases(all_questions):
    db_paths = [
        os.path.join(BASE_DIR, "data", "interview.db"),
        os.path.join(BASE_DIR, "backend", "data", "interview.db")
    ]

    for db_path in db_paths:
        if not os.path.exists(db_path):
            print(f"Skipping non-existent DB: {db_path}")
            continue

        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()

            # Check table
            c.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='questions'")
            if c.fetchone()[0] == 0:
                print(f"No questions table in {db_path}")
                conn.close()
                continue

            upsert_sql = """
                INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    global_id = excluded.global_id,
                    num = excluded.num,
                    topic = excluded.topic,
                    question = excluded.question,
                    answer = excluded.answer,
                    source_pages = excluded.source_pages
            """

            # Upsert all questions from all_questions array to keep global_ids in perfect sync
            batch = [
                (
                    q["id"],
                    q["global_id"],
                    q["num"],
                    q["topic"],
                    q["question"],
                    q["answer"],
                    json.dumps(q.get("source_pages", []))
                )
                for q in all_questions
            ]
            c.executemany(upsert_sql, batch)
            conn.commit()

            total = c.execute("SELECT count(*) FROM questions").fetchone()[0]
            boot_cnt = c.execute("SELECT count(*) FROM questions WHERE topic='Spring Boot'").fetchone()[0]
            conn.close()
            print(f"✅ Synced SQLite DB {db_path}: total={total} questions, Spring Boot={boot_cnt}")
        except Exception as e:
            print(f"⚠️ Notice: could not sync secondary DB {db_path}: {e}")

def update_build_spring_topics_py():
    script_path = os.path.join(BASE_DIR, "scripts", "build_spring_topics.py")
    with open(script_path, "r", encoding="utf-8") as f:
        py_content = f.read()

    # Search for question 25 in build_spring_topics.py
    target = '            "question": "Что нового появилось в Spring Boot 3.x и Spring Framework 6.x?",'
    if target in py_content:
        # Find where the dict starts
        dict_start = py_content.rfind('        {\n            "question": "Что нового появилось в Spring Boot 3.x', 0, py_content.find(target))
        if dict_start == -1:
            dict_start = py_content.rfind('        {', 0, py_content.find(target))

        # Find the end of get_spring_boot_questions list:
        # Look for the last '        }' before '    ]'
        list_end = py_content.find('    ]\n\ndef main():', dict_start)
        if list_end != -1:
            # Build Python dict entries for QUESTIONS[0..5]
            new_entries = []
            for q in QUESTIONS:
                entry = f"""        {{
            "question": "{q['question']}",
            "answer": \"\"\"{q['answer']}\"\"\"
        }}"""
                new_entries.append(entry)

            replacement = ",\n".join(new_entries)
            py_content = py_content[:dict_start] + replacement + "\n" + py_content[list_end:]
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(py_content)
            print("✅ Updated scripts/build_spring_topics.py with questions 25..30")

if __name__ == "__main__":
    print("🚀 Synchronizing Spring Boot 4.x and Spring Framework 7.x Questions...")
    all_qs = sync_all_interview_questions_json()
    sync_spring_boot_questions_json()
    sync_topics_metadata_json()
    sync_spring_boot_markdown()
    sync_all_interview_questions_markdown()
    sync_sqlite_databases(all_qs)
    update_build_spring_topics_py()
    print("🎉 All SSOT artifacts successfully synchronized!")
