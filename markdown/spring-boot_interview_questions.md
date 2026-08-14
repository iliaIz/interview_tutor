# Spring Boot — Вопросы и Ответы для Собеседования

> **Раздел:** Web & Enterprise | **Всего вопросов:** 13 | **Источник:** Baeldung / InterviewBit

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
- [11. Какие встроенные сервлет-контейнеры поддерживает Spring Boot и как заменить Tomcat на Jetty или Undertow?](#q-11)
- [12. Как работают аннотации тестирования в Spring Boot (@SpringBootTest, @WebMvcTest, @DataJpaTest, @MockBean)?](#q-12)
- [13. Что нового появилось в Spring Boot 3.x и Spring Framework 6.x?](#q-13)

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

### <a id="q-11"></a>11. Какие встроенные сервлет-контейнеры поддерживает Spring Boot и как заменить Tomcat на Jetty или Undertow? `[BOOT-011]`

По умолчанию `spring-boot-starter-web` использует **Apache Tomcat**. Также поддерживаются **Jetty** и **Undertow**.

### Как заменить Tomcat на Undertow в Maven:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-undertow</artifactId>
</dependency>
```

---

### <a id="q-12"></a>12. Как работают аннотации тестирования в Spring Boot (@SpringBootTest, @WebMvcTest, @DataJpaTest, @MockBean)? `[BOOT-012]`

Spring Boot предоставляет специализированные аннотации для интеграционного и срезового (slice) тестирования:

* **`@SpringBootTest`:** поднимает **полный контекст** приложения (ApplicationContext). Используется для полноценных end-to-end интеграционных тестов.
* **`@WebMvcTest`:** тестирует только веб-слой (контроллеры, фильтры, `Security`). Контроллер тестируется изолированно с помощью `MockMvc`, сервисы заменяются на моки.
* **`@DataJpaTest`:** тестирует слой доступа к данным (репозитории Spring Data JPA). Автоматически настраивает in-memory БД (H2) и включает откат транзакций после каждого теста.
* **`@MockBean` (в Spring Boot 3.4+ заменяется на `@MockitoBean`):** создает Mockito-мок и помещает его в Spring ApplicationContext вместо реального бина.

---

### <a id="q-13"></a>13. Что нового появилось в Spring Boot 3.x и Spring Framework 6.x? `[BOOT-013]`

Ключевые новшества Spring Boot 3 и Spring 6 (актуальные стандарты на 2026 год):

1. **Минимальная версия Java:** базовой версией стала **Java 17** (с полной поддержкой Java 21 Virtual Threads / Project Loom).
2. **Миграция на Jakarta EE 10:** пакет `javax.*` заменен на `jakarta.*` (сервлеты `jakarta.servlet`, валидация `jakarta.validation`, JPA `jakarta.persistence`).
3. **GraalVM Native Image & AOT:** встроенная поддержка Ahead-of-Time компиляции в нативные бинарники с мгновенным стартом (< 50мс) и низким потреблением памяти.
4. **Виртуальные потоки (Virtual Threads):** включение одной строчкой `spring.threads.virtual.enabled=true`.
5. **Унифицированная обработка ошибок (RFC 7807):** стандартная поддержка спецификации `ProblemDetail`.
6. **HTTP Interfaces (Declarative Clients):** декларативные HTTP-клиенты через аннотации `@HttpExchange` без необходимости Feign.

---
