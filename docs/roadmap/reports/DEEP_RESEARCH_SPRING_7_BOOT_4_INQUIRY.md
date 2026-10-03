# Deep Research Inquiry Battery: Spring Framework 7.x & Spring Boot 4.x SOTA Landscape (September 2026)

> **Цель исследования:** Сбор исчерпывающих, фактологически верифицированных данных о релизе и продакшен-стандартах **Spring Framework 7.x** и **Spring Boot 4.x** (релиз ноябрь 2025 года, актуальное состояние на сентябрь 2026 года) для модернизации базы вопросов, ката-задач и оценочных рубрик платформы `InterviewPrep AI`.

---

## Промпт для отправки в Deep Research (Perplexity Pro / Gemini Advanced / Claude Research / OpenAI Deep Research)

Скопируйте текст ниже целиком в инструмент Deep Research:

```text
Ты — ведущий Java/Spring архитектор и технический ревьюер мирового уровня (FAANG/Staff/Principal Engineer), специализирующийся на глубоком анализе исходного кода, спецификаций и архитектурных эволюций экосистемы Spring.

Проведи исчерпывающее глубокое исследование (Deep Research) текущего состояния экосистемы Spring по состоянию на сентябрь 2026 года, сфокусированное на двух ключевых релизах:
1. Spring Framework 7.0 / 7.1
2. Spring Boot 4.0 / 4.1

Опирайся исключительно на первоисточники: официальные Release Notes Spring Framework 7.x и Spring Boot 4.x, Spring Boot Migration Guides, спецификации Jakarta EE 11, спецификации JSpecify, коммиты и ишью в репозиториях spring-projects/spring-framework и spring-projects/spring-boot, а также реальный опыт энтерпрайз-миграций 2025–2026 годов.

Твой отчет должен быть структурирован строго по следующим 6 разделам с приведением точных сигнатур классов, аннотаций, конфигурационных параметров и примеров кода (было в 3.x -> стало в 4.x):

### 1. Инфраструктурный и платформенный базис (JVM & Jakarta EE 11)
- Минимальный базовый уровень Java (Java Baseline): почему сохранен Java 17, но официально рекомендован Java 25 (LTS). Как Spring Framework 7 утилизирует Virtual Threads (Loom), Structured Concurrency (JEP 453/480) и Scoped Values (JEP 446/481) на уровне рантайма.
- Переход на Jakarta EE 11: спецификации Servlet 6.1, JPA 3.2, Bean Validation 3.1. Какие фундаментальные изменения это принесло по сравнению с Jakarta EE 10?
- Поддержка языков и инструментов: Kotlin 2.2+, JUnit 6, Gradle 9+.

### 2. Ключевые архитектурные новшества Spring Framework 7.x
- Встроенная отказоустойчивость ядра (Core Resilience): нативная поддержка retry, backoff и concurrency throttling непосредственно в ядре Spring Framework без необходимости во внешнем `spring-retry`. Архитектура, аннотации и интерфейсы.
- Нативное версионирование REST API (First-Class API Versioning): как устроено версионирование в Spring MVC и WebFlux из коробки (поддержка заголовков, query-параметров, media-type, URL-path). Примеры контроллеров и конфигурации.
- JSpecify Null-Safety: повсеместное внедрение аннотаций JSpecify (`@Nullable`, `@NonNull`, `@NullMarked`) по всему портфолио Spring. Отличие от старых `@NonNullApi` / JSR-305 и влияние на статический анализ и Kotlin-интероп.
- Миграция на Jackson 3: переход на новый пакет `tools.jackson` и архитектурные преимущества Jackson 3 по сравнению с Jackson 2.x.
- Развитие HTTP Interfaces (Declarative HTTP Clients): поддержка стриминга, интеграция с Core Resilience, пулинг соединений.

### 3. Экосистема Spring Boot 4.x и среда исполнения (Runtime Innovations)
- Архитектурная модуляризация Spring Boot: декомпозиция монолитных стартеров и `spring-boot-autoconfigure` на легковесные, узкоспециализированные модули. Влияние на потребление памяти (RAM footprint) и время холодного старта.
- Встроенные веб-серверы: Tomcat 11, Jetty 12. Удаление поддержки Undertow — причины и альтернативы.
- Observability & Метрики: Micrometer 2.x, OpenTelemetry 2.x Tracing, continuous profiling, изменения в Spring Boot Actuator.
- GraalVM Native Image и Project CRaC (Coordinated Restore at Checkpoint): нативная поддержка checkpoint/restore и оптимизация AOT-компиляции (Startup < 20ms).
- Интеграция со Spring AI (1.x / 2.x) и протоколом Model Context Protocol (MCP): нативные стартеры для AI-агентов, Tool Calling и интеграции локальных/облачных LLM в архитектуру микросервисов Spring Boot.

### 4. Жесткие ломающие изменения (Breaking Changes) и удаленные компоненты
- Тестирование: окончательное удаление `@MockBean` и `@SpyBean` в пользу `@MockitoBean` и `@MockitoSpyBean` из Spring Bean Override Framework.
- Spring Security 7.x: полный отказ от устаревшего метода `.and()` и цепочек, удаление устаревших `RequestMatcher`, переход на строгий функциональный Lambda DSL.
- Удаление `spring-jcl` в пользу Apache Commons Logging 1.3+.
- Удаление устаревших URL-маппингов и `AntPathMatcher` в пользу `PathPatternParser`.

### 5. Стратегия и конвейер миграции (Migration Runway 3.x -> 4.x)
- Рекомендуемый путь миграции: роль версии Spring Boot 3.5 как промежуточного «трамплина» (migration runway) для устранения deprecation warnings.
- Автоматизация через OpenRewrite: ключевые рецепты (recipes) для автоматического обновления кодовой базы с Boot 3.5 на 4.0.
- Топ-5 практических граблей и ловушек (Gotchas), с которыми сталкиваются реальные проекты при миграции.

### 6. Силлабус для технических интервью в 2026 году (Junior -> Middle -> Senior -> Staff)
- Какие темы и вопросы по Spring Boot 3 vs 4 актуальны для каждого грейда:
  * Junior+: базовое понимание dependency injection, стартеров, структуры проекта.
  * Middle+: миграция на Jakarta EE 11, Virtual Threads vs Reactive, аннотации тестирования (`@MockitoBean`, `@ServiceConnection`), REST API Versioning.
  * Senior+: компромиссы модульности Spring Boot 4, встроенный Core Resilience против Resilience4j, оптимизация GraalVM/CRaC, Observability стек.
  * Staff / Lead Architect: стратегия постепенной миграции монолита и 50+ микросервисов с Boot 3 на 4, управление зависимостями в эпоху Jackson 3 и JSpecify, интеграция Spring AI/MCP в корпоративный ландшафт.
- Сформулируй 3 эталонных вопроса с эталонными краткими ответами (Golden Answers) для включения в каталог собеседований.
```

---

## Куда сохранить результат исследования
После того как Deep Research сгенерирует подробный отчет, сохраните его в файл:
`docs/roadmap/reports/SPRING_7_BOOT_4_DEEP_RESEARCH_REPORT.md`
