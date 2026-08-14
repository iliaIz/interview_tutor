#!/usr/bin/env python3
"""
Скрипт генерации синтезированных, обогащенных и дедуплицированных вопросов
по Spring Framework и Spring Boot на русском языке,
объединяющий базу Baeldung, InterviewBit и Medium 2026 Edition (Sumanth Poola).
"""

import os
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
MD_DIR = os.path.join(BASE_DIR, "markdown")
JSON_DIR = os.path.join(BASE_DIR, "json")

def get_spring_framework_questions():
    """Returns curated, comprehensive questions for Spring Framework topic."""
    return [
        {
            "question": "Что такое Spring Framework и каковы его ключевые преимущества?",
            "answer": """**Spring Framework** — это наиболее популярный в корпоративной Java-разработке легковесный фреймворк и контейнер управления жизненным циклом компонентов (Inversion of Control).

### Ключевые преимущества:
* **Слабая связанность (Loose Coupling):** достигается благодаря паттерну *Inversion of Control (IoC)* и *Dependency Injection (DI)*.
* **Минимум бойлерплейта:** интеграция с JDBC, JPA, JMS, транзакциями с автоматическим освобождением ресурсов и маппингом исключений.
* **Декларативное управление транзакциями (`@Transactional`):** разделение бизнес-логики и инфраструктурного управления транзакциями.
* **Аспектно-ориентированное программирование (Spring AOP):** сквозная функциональность (логирование, аудит, безопасность, кэширование) выносится в отдельные аспекты.
* **Модульность и экосистема:** возможность подключать только необходимые модули (Spring MVC, Spring Data, Spring Security, Spring WebFlux).
* **Тестируемость:** благодаря DI и интерфейсам компоненты легко тестируются с помощью Mock-объектов (Mockito) без поднятия тяжелого окружения."""
        },
        {
            "question": "Что такое Inversion of Control (IoC) и Dependency Injection (DI)?",
            "answer": """* **Inversion of Control (IoC, Инверсия управления):** фундаментальный архитектурный принцип, при котором управление созданием объектов, связыванием их зависимостей и контролем их жизненного цикла передается внешнему контейнеру (Spring IoC Container), а не осуществляется вручную через оператор `new`.
* **Dependency Injection (DI, Внедрение зависимостей):** конкретный паттерн реализации IoC, при котором зависимости передаются объекту извне (через конструктор, сеттер или поле).

```java
// Без IoC/DI (жесткая связанность)
public class UserService {
    private final UserRepository repository = new UserRepositoryImpl();
}

// С IoC/DI (слабая связанность, управление контейнером)
@Service
public class UserService {
    private final UserRepository repository;

    @Autowired
    public UserService(UserRepository repository) {
        this.repository = repository;
    }
}
```"""
        },
        {
            "question": "В чем разница между BeanFactory и ApplicationContext?",
            "answer": """Оба интерфейса представляют собой Spring IoC контейнеры, однако имеют разный уровень возможностей:

| Характеристика | BeanFactory | ApplicationContext |
| :--- | :--- | :--- |
| **Уровень** | Базовый интерфейс контейнера (root interface) | Расширенный интерфейс (наследник BeanFactory) |
| **Инициализация бинов** | **Lazy** (по умолчанию бины создаются при вызове `getBean()`) | **Eager** (все Singleton-бины создаются при старте приложения) |
| **Интернационализация (i18n)** | Не поддерживается | Поддерживается через `MessageSource` |
| **Публикация событий (Events)** | Не поддерживается | Поддерживается через `ApplicationEventPublisher` |
| **Интеграция с AOP** | Базовая | Полная автоматическая интеграция с `BeanPostProcessor` |
| **Сфера применения** | Ограниченные по ресурсам мобильные/IoT системы (устарело) | Стандарт для всех современных Spring-приложений |"""
        },
        {
            "question": "Что такое Spring Bean и какие существуют способы его объявления?",
            "answer": """**Spring Bean** — это объект, который создается, настраивается, связывается и управляется контейнером Spring IoC.

### Способы объявления бинов:
1. **Аннотации стереотипов (Component Scanning):**
   ```java
   @Component // Базовая аннотация
   @Service    // Слой бизнес-логики
   @Repository // Слой доступа к данным (с трансляцией исключений)
   @Controller // Слой Web MVC
   public class PaymentService { ... }
   ```
2. **Java-based Configuration (`@Configuration` + `@Bean`):**
   ```java
   @Configuration
   public class AppConfig {
       @Bean
       public ObjectMapper objectMapper() {
           return new ObjectMapper();
       }
   }
   ```
3. **XML-конфигурация (Legacy):** `<bean id=\"paymentService\" class=\"com.example.PaymentService\" />`."""
        },
        {
            "question": "Какие способы внедрения зависимостей (Dependency Injection) существуют и какой является предпочтительным?",
            "answer": """В Spring существует 3 способа внедрения зависимостей:

1. **Constructor Injection (Внедрение через конструктор — РЕКОМЕНДУЕТСЯ):**
   ```java
   @Service
   public class OrderService {
       private final PaymentService paymentService;

       @Autowired // Начиная со Spring 4.3 аннотация необязательна, если конструктор один
       public OrderService(PaymentService paymentService) {
           this.paymentService = paymentService;
       }
   }
   ```
   * *Плюсы:* поля можно объявить `final` (неизменяемость); невозможно создать объект в неполном состоянии; легко писать Unit-тесты без Spring-контекста; выявляет циклические зависимости на этапе компиляции/старта.

2. **Setter Injection (Внедрение через сеттер):**
   ```java
   @Service
   public class OrderService {
       private PaymentService paymentService;

       @Autowired
       public void setPaymentService(PaymentService paymentService) {
           this.paymentService = paymentService;
       }
   }
   ```
   * *Плюсы:* подходит для опциональных зависимостей и возможности реконфигурации во время работы.

3. **Field Injection (Внедрение через поле — НЕ РЕКОМЕНДУЕТСЯ / Code Smell):**
   ```java
   @Service
   public class OrderService {
       @Autowired
       private PaymentService paymentService;
   }
   ```
   * *Минусы:* нарушает инкапсуляцию; невозможно сделать поле `final`; затрудняет Unit-тестирование (требует Reflection/Mockito)."""
        },
        {
            "question": "Какие существуют Scope (области видимости) Spring бинов?",
            "answer": """В Spring Framework поддерживаются следующие скоупы бинов:

1. **Singleton (по умолчанию):** создается ровно **один экземпляр** бина на весь Spring IoC контейнер (ApplicationContext).
2. **Prototype:** каждый раз при запросе бина из контейнера (`getBean()`) или при внедрении создается **новый экземпляр**.

### Веб-скоупы (доступны в веб-контекстах, например Spring MVC):
3. **Request:** создается один экземпляр бина на каждый входящий HTTP-запрос.
4. **Session:** создается один экземпляр бина на время существования HTTP-сессии.
5. **Application:** создается один экземпляр на весь жизненный цикл `ServletContext` (в отличие от Singleton, может разделяться между несколькими ApplicationContext в одном ServletContext).
6. **WebSocket:** экземпляр привязан к жизненному циклу конкретной WebSocket-сессии.

```java
@Component
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
public class PrototypeBean { ... }
```"""
        },
        {
            "question": "Являются ли Singleton-бины в Spring потокобезопасными (Thread-Safe)?",
            "answer": """**Нет, сами по себе Singleton-бины в Spring НЕ являются потокобезопасными.**

* Spring гарантирует лишь то, что будет создан **один экземпляр** бина на контейнер.
* Если несколько потоков одновременно вызывают методы этого бина, а бин имеет **изменяемое состояние (mutable state)** (например, поля экземпляра, списки, счетчики), возникнет состояние гонки (*race condition*).
* **Best Practice:** Singleton-бины должны быть **Stateless (без изменяемого состояния)**. Все промежуточные данные должны храниться в локальных переменных методов (стек вызова потока) или передаваться как аргументы."""
        },
        {
            "question": "Как решить проблему внедрения Prototype-бина в Singleton-бин (Method Injection)?",
            "answer": """Если внедрить `Prototype` бин в `Singleton` бин обычным способом через `@Autowired`, то `Prototype` бин внедрится **ровно один раз** при создании Singleton-бина и фактически станет Singleton.

### Способы решения:
1. **`@Lookup` (Method Injection — РЕКОМЕНДУЕТСЯ):** Spring переопределяет метод с помощью CGLIB и вызывает контейнер при каждом обращении:
   ```java
   @Service
   public class SingletonService {
       @Lookup
       public PrototypeBean getPrototypeBean() {
           return null; // Spring CGLIB переопределит тело метода
       }
   }
   ```
2. **`ObjectFactory<T>` / `ObjectProvider<T>`:**
   ```java
   @Service
   public class SingletonService {
       private final ObjectProvider<PrototypeBean> prototypeProvider;

       public SingletonService(ObjectProvider<PrototypeBean> prototypeProvider) {
           this.prototypeProvider = prototypeProvider;
       }

       public void process() {
           PrototypeBean bean = prototypeProvider.getObject(); // Каждый раз новый
       }
   }
   ```
3. **`@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)`:** создает CGLIB-прокси вокруг бина."""
        },
        {
            "question": "Опишите полный жизненный цикл Spring бина (Bean Life Cycle).",
            "answer": """Жизненный цикл бина в Spring состоит из четких этапов:

### 1. Создание и внедрение:
1. **Загрузка определений бинов (`BeanDefinition`)** и работа `BeanFactoryPostProcessor`.
2. **Инстанцирование:** вызов конструктора (создание Java-объекта).
3. **Внедрение зависимостей (Populating Properties):** внедрение значений полей и ссылок на другие бины.

### 2. Awareness интерфейсы (Осведомленность):
4. Вызов `BeanNameAware.setBeanName()`.
5. Вызов `BeanFactoryAware.setBeanFactory()`.
6. Вызов `ApplicationContextAware.setApplicationContext()`.

### 3. Инициализация (Initialization):
7. Вызов `BeanPostProcessor.postProcessBeforeInitialization()`.
8. Вызов методов с аннотацией `@PostConstruct` (JSR-250).
9. Вызов `InitializingBean.afterPropertiesSet()`.
10. Вызов кастомного метода `init-method` (заданного в `@Bean(initMethod = "...")`).
11. Вызов `BeanPostProcessor.postProcessAfterInitialization()` (здесь создаются AOP-прокси!).

### 4. Использование (Ready for use):
12. Бин готов к обработке запросов.

### 5. Уничтожение (Destruction — при закрытии ApplicationContext):
13. Вызов методов с аннотацией `@PreDestroy`.
14. Вызов `DisposableBean.destroy()`.
15. Вызов кастомного метода `destroy-method` (в `@Bean(destroyMethod = "...")`)."""
        },
        {
            "question": "В чем разница между BeanPostProcessor и BeanFactoryPostProcessor?",
            "answer": """| Критерий | BeanFactoryPostProcessor (BFPP) | BeanPostProcessor (BPP) |
| :--- | :--- | :--- |
| **Момент выполнения** | До создания экземпляров бинов | Во время инициализации каждого конкретного экземпляра бина |
| **С чем работает** | С метаданными (`BeanDefinition`), хранящимися в контейнере | С готовыми созданными Java-объектами |
| **Что может менять** | Значения свойств в `BeanDefinition` (например, подставить переменные из `application.properties`) | Обернуть бин в Proxy (AOP, `@Transactional`, `@Async`), валидировать поля |
| **Примеры реализации** | `PropertySourcesPlaceholderConfigurer`, `CustomScopeConfigurer` | `AutowiredAnnotationBeanPostProcessor`, `CommonAnnotationBeanPostProcessor`, AOP auto-proxy creators |"""
        },
        {
            "question": "В чем разница между аннотациями @Autowired, @Resource и @Inject?",
            "answer": """* **`@Autowired` (Spring Framework):**
  - По умолчанию ищет зависимость **по типу (byType)**.
  - Если найдено несколько кандидатов, можно уточнить с помощью `@Qualifier(\"beanName\")` или `@Primary`.
  - Имеет флаг `required = false`.
* **`@Resource` (Jakarta EE / JSR-250):**
  - По умолчанию ищет зависимость **по имени (byName)**.
  - Если по имени не найдено, выполняет поиск по типу (byType).
* **`@Inject` (Jakarta Dependency Injection / JSR-330):**
  - Ищет **по типу (byType)**.
  - Для разрешения неоднозначности используется аннотация `@Named` вместо `@Qualifier`."""
        },
        {
            "question": "В чем разница между @Component, @Service, @Repository и @Controller?",
            "answer": """Все эти аннотации являются **стереотипами** Spring и помечены мета-аннотацией `@Component`, поэтому автоматически обнаруживаются механизмом Component Scan:

* **`@Component`:** базовый универсальный стереотип для любого Spring-управляемого компонента.
* **`@Service`:** семантический маркер для классов слоя бизнес-логики (Service Layer). Не добавляет особого поведения, служит для архитектурной выразительности.
* **`@Repository`:** маркер для слоя доступа к данным (DAO / Data Access). **Важная особенность:** Spring автоматически применяет к нему `PersistenceExceptionTranslationPostProcessor`, который перехватывает специфичные SQL/ORM исключения и транслирует их в унифицированную иерархию unchecked исключений `DataAccessException`.
* **`@Controller` / `@RestController`:** маркер для презентационного слоя (Spring Web MVC). `@RestController` объединяет `@Controller` и `@ResponseBody`."""
        },
        {
            "question": "Что такое Spring AOP и каковы его основные концепции (Aspect, JoinPoint, Pointcut, Advice)?",
            "answer": """**Spring AOP (Aspect-Oriented Programming)** — парадигма программирования, позволяющая модульно выделять сквозную функциональность (Cross-Cutting Concerns: безопасность, логирование, аудит, кэширование, управление транзакциями), не засоряя основную бизнес-логику.

### Ключевые термины AOP:
* **Aspect (Аспект):** модуль/класс, инкапсулирующий сквозную логику (помечается `@Aspect`).
* **JoinPoint (Точка соединения):** конкретная точка в выполнении программы, где может быть применен аспект (в Spring AOP это **всегда вызов метода**).
* **Pointcut (Срез точек):** предикат/выражение (например, `execution(* com.example.service.*.*(..))`), определяющее, к каким именно JoinPoint применяется Advice.
* **Advice (Совет/Действие):** код, выполняемый в точке соединения:
  - `@Before`: перед выполнением целевого метода.
  - `@AfterReturning`: после успешного возврата значения.
  - `@AfterThrowing`: после выброса исключения.
  - `@After`: (finally) после завершения метода в любом случае.
  - `@Around`: оборачивает вызов метода, позволяя изменить аргументы, перехватить вызов или изменить возвращаемое значение (`joinPoint.proceed()`).
* **Weaving (Связывание):** процесс внедрения аспектов в целевой код (в Spring AOP выполняется в Runtime через динамические Proxy)."""
        },
        {
            "question": "Как реализовать кастомный аспект AOP для замера времени выполнения методов (@Around + @TrackTime)?",
            "answer": """Для создания кастомного аспекта профилирования выполняются следующие шаги:

1. **Создание аннотации-маркера:**
   ```java
   @Target(ElementType.METHOD)
   @Retention(RetentionPolicy.RUNTIME)
   public @interface TrackTime { }
   ```
2. **Создание аспекта с `@Around` advice:**
   ```java
   @Aspect
   @Component
   public class PerformanceAspect {
       private static final Logger log = LoggerFactory.getLogger(PerformanceAspect.class);

       @Around("@annotation(TrackTime)")
       public Object trackExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
           long start = System.currentTimeMillis();
           
           Object result = joinPoint.proceed(); // Вызов целевого метода
           
           long duration = System.currentTimeMillis() - start;
           log.info("Метод {} выполнен за {} мс", joinPoint.getSignature().getName(), duration);
           return result;
       }
   }
   ```
3. **Использование на методе сервиса:**
   ```java
   @Service
   public class ReportService {
       @TrackTime
       public Report generateAnnualReport() { ... }
   }
   ```"""
        },
        {
            "question": "В чем разница между JDK Dynamic Proxy и CGLIB Proxy в Spring?",
            "answer": """Spring AOP использует динамические прокси для оборачивания бинов:

| Характеристика | JDK Dynamic Proxy | CGLIB Proxy |
| :--- | :--- | :--- |
| **Механизм** | Встроен в Java Reflection API (`java.lang.reflect.Proxy`) | Сторонняя библиотека генерации байткода (упакована в Spring) |
| **Требование** | Класс **обязан реализовывать интерфейс** | Создает класс-наследник (subclass) целевого класса |
| **Ограничения** | Проксирует только методы интерфейса | Не может проксировать `final` классы и `final` методы |
| **Использование в Spring** | Использовался по умолчанию в Spring Framework до 5.x при наличии интерфейса | **Используется по умолчанию в Spring Boot 2+ и Spring 6** (`spring.aop.proxy-target-class=true`) |"""
        },
        {
            "question": "Почему вызов метода внутри того же класса (Self-Invocation) не запускает @Transactional или аспект?",
            "answer": """Потому что Spring AOP построен на **динамических Proxy-объектах**.

1. Когда внешний класс вызывает метод проксируемого бина, вызов идет через `Proxy` -> срабатывает `Advice` (например, открывается транзакция) -> `Proxy` делегирует вызов целевому объекту `Target`.
2. Когда один метод внутри целевого объекта напрямую вызывает другой метод того же объекта (`this.otherMethod()`), вызов происходит напрямую в обход Proxy:
   ```java
   @Service
   public class OrderService {
       public void processOrder() {
           // Вызов идет напрямую через this, Proxy не участвует!
           saveToDatabase(); 
       }

       @Transactional
       public void saveToDatabase() { ... }
   }
   ```

### Решения:
* Вынести метод `@Transactional` в отдельный сервис.
* Внедрить ссылку на `self` (через `@Autowired private OrderService self;` или `ObjectProvider`).
* Использовать AspectJ Compile-time/Load-time Weaving вместо Spring Proxy AOP."""
        },
        {
            "question": "Как работает аннотация @Transactional и какие параметры она имеет?",
            "answer": """`@Transactional` декларативно оборачивает выполнение метода в транзакцию базы данных с помощью Spring AOP и `PlatformTransactionManager`.

### Ключевые параметры `@Transactional`:
1. **`propagation` (Распространение):** поведение при вызове одного транзакционного метода из другого:
   * `REQUIRED` (по умолчанию): использует текущую транзакцию, если она есть; если нет — создает новую.
   * `REQUIRES_NEW`: всегда создает новую независимую физическую транзакцию (текущая приостанавливается).
   * `NESTED`: создает savepoint внутри текущей транзакции (вложенный откат).
   * `SUPPORTS`: выполняется в транзакции, если она есть, иначе без нее.
   * `MANDATORY`: требует существующую транзакцию, иначе выбрасывает `IllegalTransactionStateException`.
   * `NOT_SUPPORTED`: выполняется без транзакции (текущая приостанавливается).
   * `NEVER`: требует отсутствие транзакции, иначе выбрасывает исключение.
2. **`isolation` (Уровень изоляции):** `DEFAULT`, `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`.
3. **`readOnly = true`:** оптимизация производительности (Hibernate отключает dirty checking, JDBC драйвер направляет запросы на read-only реплики).
4. **`rollbackFor`:** по умолчанию транзакция откатывается **только при `RuntimeException` и `Error`**. Чтобы откатывать при checked исключениях, указывают `@Transactional(rollbackFor = Exception.class)`.
5. **`timeout`:** максимальное время выполнения транзакции в секундах."""
        },
        {
            "question": "Как устроен Spring Web MVC и каков путь обработки HTTP-запроса через DispatcherServlet?",
            "answer": """Spring MVC реализует паттерн *Front Controller* через центральный сервлет **`DispatcherServlet`**.

### Путь обработки входящего HTTP-запроса:
1. Запрос приходит на **`DispatcherServlet`**.
2. `DispatcherServlet` обращается к **`HandlerMapping`**, чтобы найти подходящий контроллер и метод обработки (по URL, HTTP-методу, заголовкам).
3. `DispatcherServlet` вызывает **`HandlerAdapter`**, который выполняет подготовку аргументов (валидация, `@RequestBody`, `@PathVariable`) и вызывает метод контроллера.
4. Метод контроллера выполняет бизнес-логику и возвращает результат (`ModelAndView` или объект данных).
5. Если это REST API (`@RestController` / `@ResponseBody`), **`HttpMessageConverter`** (например, Jackson) сериализует объект напрямую в JSON/XML и записывает в HTTP Response.
6. Если это классический MVC с шаблонами (Thymeleaf/JSP), `DispatcherServlet` передает имя представления в **`ViewResolver`**, который рендерит HTML-страницу."""
        },
        {
            "question": "В чем разница между @PathVariable, @RequestParam и @RequestBody в Spring MVC?",
            "answer": """Эти три аннотации служат для извлечения различных частей входящего HTTP-запроса:

1. **`@PathVariable` (Переменная пути):** извлекает значение напрямую из шаблона URL.
   ```java
   // GET /api/users/42
   @GetMapping("/users/{id}")
   public UserDto getUserById(@PathVariable("id") Long id) { ... }
   ```
2. **`@RequestParam` (Query-параметры):** извлекает параметры строки запроса (`?key=value`) или данные формы.
   ```java
   // GET /api/users?page=1&size=20
   @GetMapping("/users")
   public List<UserDto> getUsers(@RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "10") int size) { ... }
   ```
3. **`@RequestBody` (Тело запроса):** считывает тело HTTP-запроса (JSON, XML) и десериализует его в Java-объект через `HttpMessageConverter` (Jackson).
   ```java
   // POST /api/users (Body: {"name": "Alice", "email": "alice@example.com"})
   @PostMapping("/users")
   public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) { ... }
   ```"""
        },
        {
            "question": "Зачем использовать ResponseEntity и в чем его преимущества перед возвратом обычного DTO?",
            "answer": """`ResponseEntity<T>` представляет собой полную обертку HTTP-ответа, позволяющую гибко контролировать:
* **HTTP Статус-код** (например, `201 CREATED`, `204 NO_CONTENT`, `404 NOT_FOUND` вместо дефолтного `200 OK`).
* **HTTP Заголовки (Headers)** (например, `Location: /api/users/42`, `Cache-Control`, `Set-Cookie`).
* **Тело ответа (Body)**.

```java
@PostMapping("/users")
public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest dto) {
    UserDto created = userService.create(dto);
    URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(created.getId())
            .toUri();
    
    return ResponseEntity
            .created(location) // 201 Created с заголовком Location
            .body(created);
}
```"""
        },
        {
            "question": "Как устроена валидация входных DTO в Spring (@Valid, @NotBlank, JSR-380) и обработка ошибок валидации?",
            "answer": """Валидация основана на спецификации **Jakarta Bean Validation (JSR-380 / Hibernate Validator)**:

1. **Аннотации на полях DTO:**
   ```java
   public class CreateUserRequest {
       @NotBlank(message = "Имя обязательно для заполнения")
       @Size(min = 2, max = 50, message = "Имя должно содержать от 2 до 50 символов")
       private String name;

       @NotBlank(message = "Email обязателен")
       @Email(message = "Некорректный формат email")
       private String email;

       @Min(value = 18, message = "Возраст должен быть не менее 18 лет")
       private int age;
   }
   ```
2. **Активация валидации в контроллере через `@Valid`:**
   ```java
   @PostMapping("/users")
   public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest req) { ... }
   ```
3. **Глобальный перехват ошибок валидации в `@RestControllerAdvice`:**
   При провале валидации Spring выбрасывает `MethodArgumentNotValidException`:
   ```java
   @ExceptionHandler(MethodArgumentNotValidException.class)
   public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
       Map<String, String> errors = new HashMap<>();
       ex.getBindingResult().getFieldErrors().forEach(error -> 
           errors.put(error.getField(), error.getDefaultMessage())
       );
       return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
   }
   ```"""
        },
        {
            "question": "Что такое CORS и как настроить Cross-Origin запросы в Spring?",
            "answer": """**CORS (Cross-Origin Resource Sharing)** — механизм безопасности браузера, блокирующий HTTP-запросы скриптов между разными доменами, протоколами или портами (Same-Origin Policy).

### Настройка CORS в Spring:
1. **На уровне отдельного контроллера или метода (`@CrossOrigin`):**
   ```java
   @CrossOrigin(origins = "https://frontend.example.com", maxAge = 3600)
   @RestController
   @RequestMapping("/api/orders")
   public class OrderController { ... }
   ```
2. **Глобальная конфигурация для всего приложения (Рекомендуется):**
   ```java
   @Configuration
   public class WebCorsConfig implements WebMvcConfigurer {
       @Override
       public void addCorsMappings(CorsRegistry registry) {
           registry.addMapping("/api/**")
                   .allowedOrigins("https://frontend.example.com")
                   .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                   .allowedHeaders("*")
                   .allowCredentials(true)
                   .maxAge(3600);
       }
   }
   ```"""
        },
        {
            "question": "В чем разница между @ControllerAdvice и @ExceptionHandler?",
            "answer": """* **`@ExceptionHandler`:** объявляется внутри метода контроллера для обработки конкретного типа исключения. По умолчанию перехватывает ошибки **только внутри того контроллера, где объявлен**.
* **`@ControllerAdvice` / `@RestControllerAdvice`:** глобальный перехватчик исключений для всего приложения. Позволяет централизованно обрабатывать ошибки всех контроллеров и возвращать унифицированные ответы (например, RFC 7807 Problem Details / `ResponseEntity<ErrorDto>`):

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }
}
```"""
        },
        {
            "question": "В чем разница между HTTP-методами PUT и PATCH в REST API?",
            "answer": """| Критерий | `PUT` | `PATCH` |
| :--- | :--- | :--- |
| **Семантика** | **Полная замена** ресурса (Full Replacement) | **Частичное обновление** ресурса (Partial Update) |
| **Непереданные поля** | Сбрасываются в `null` или значения по умолчанию | Остаются без изменений |
| **Идемпотентность** | **Идемпотентен** (повторные одинаковые вызовы дают тот же результат) | Как правило, **не идемпотентен** (в зависимости от логики операции) |
| **Тело запроса** | Полный объект сущности | Только изменяемые поля (например, `{ "status": "ACTIVE" }`) |"""
        },
        {
            "question": "В чем разница между Authentication и Authorization в Spring Security?",
            "answer": """* **Authentication (Аутентификация — Кто вы?):** процесс проверки подлинности пользователя (логин/пароль, JWT токен, сертификат, OAuth2).
  - В Spring Security управляется через `AuthenticationManager`, `AuthenticationProvider`, `UserDetailsService`.
* **Authorization (Авторизация — Что вам разрешено делать?):** проверка прав/ролей пользователя для доступа к конкретному ресурсу или методу.
  - В Spring Security настраивается на уровне URL-фильтров (`authorizeHttpRequests`) или методов (`@PreAuthorize("hasRole('ADMIN')")`, `@Secured`).

```java
@PreAuthorize("hasAuthority('ORDER_DELETE') or hasRole('ADMIN')")
@DeleteMapping("/orders/{id}")
public ResponseEntity<Void> deleteOrder(@PathVariable Long id) { ... }
```"""
        },
        {
            "question": "Что такое Spring WebFlux и чем он отличается от Spring MVC?",
            "answer": """**Spring WebFlux** — это реактивный неблокирующий веб-фреймворк, появившийся в Spring 5, построенный на базе Project Reactor и спецификации Reactive Streams.

| Характеристика | Spring Web MVC | Spring WebFlux |
| :--- | :--- | :--- |
| **Модель потоков** | One Thread per Request (Блокирующий I/O) | Event Loop (Неблокирующий асинхронный I/O) |
| **Сервер по умолчанию** | Apache Tomcat, Jetty | Netty, Undertow |
| **Типы данных** | Синхронные объекты (`User`, `List<User>`) | Реактивные типы (`Mono<User>`, `Flux<User>`) |
| **Работа с БД** | Блокирующие JDBC, JPA / Hibernate | Неблокирующие R2DBC, Reactive Mongo/Redis |
| **Потребление ресурсов** | Требует много потоков и памяти при высокой нагрузке | Высокая пропускная способность при малом числе потоков |
| **Применение** | Стандартные CRUD корпоративные приложения | Высоконагруженные микросервисы, стриминг данных, WebSockets |"""
        },
        {
            "question": "В чем разница между реактивными типами Mono и Flux в Project Reactor?",
            "answer": """* **`Mono<T>`:** реактивный поток, эмитирующий **от 0 до 1 элемента** (или ошибку `onError`). Аналог `Optional<T>` или `CompletableFuture<T>` в реактивном мире.
* **`Flux<T>`:** реактивный поток, эмитирующий **от 0 до N элементов** (бесконечный поток событий или конечная последовательность), завершающийся сигналом `onComplete` или `onError`.

```java
Mono<User> userMono = Mono.just(new User("Alice"));
Flux<String> namesFlux = Flux.just("Alice", "Bob", "Charlie");
```"""
        }
    ]

def get_spring_boot_questions():
    """Returns curated, comprehensive questions for Spring Boot topic."""
    return [
        {
            "question": "Что такое Spring Boot и в чем его основные преимущества перед классическим Spring Framework?",
            "answer": """**Spring Boot** — это надстройка над Spring Framework, предназначенная для быстрого создания готовых к production автономных (*stand-alone*) приложений с минимальными начальными настройками (*convention-over-configuration*).

### Ключевые преимущества:
1. **Auto-Configuration (Автоконфигурация):** автоматическая настройка бинов на основе присутствующих в classpath библиотек и свойств.
2. **Spring Boot Starters:** агрегированные зависимости (starter POMs), избавляющие от ручного разрешения конфликтов версий библиотек.
3. **Встроенный сервлет-контейнер (Embedded Server):** Tomcat, Jetty или Undertow встроены прямо в исполняемый JAR. Не требуется внешний сервер приложений (Tomcat/WildFly).
4. **Production-Ready Features (Actuator):** встроенный мониторинг, проверка здоровья (`/health`), метрики (Micrometer/Prometheus), просмотр конфигурации (`/env`, `/beans`).
5. **Никакой генерации XML-кода:** полностью декларативная настройка через свойства и аннотации."""
        },
        {
            "question": "Что делает аннотация @SpringBootApplication и из каких аннотаций она состоит?",
            "answer": """`@SpringBootApplication` — это составная мета-аннотация, объединяющая три ключевые аннотации:

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
```"""
        },
        {
            "question": "Как устроен механизм Auto-Configuration в Spring Boot?",
            "answer": """Механизм автоконфигурации работает следующим образом:

1. При запуске аннотация `@EnableAutoConfiguration` ищет классы автоконфигураций:
   - В Spring Boot 2.x: через файл `META-INF/spring.factories`.
   - В Spring Boot 3.x: через `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.
2. Каждая автоконфигурация проверяет условия с помощью аннотаций семейства **`@Conditional`**:
   - `@ConditionalOnClass`: класс присутствует в classpath (например, `DataSource.class`).
   - `@ConditionalOnMissingBean`: бин еще не объявлен разработчиком (позволяет легко переопределить стандартное поведение).
   - `@ConditionalOnProperty`: в свойствах включен соответствующий флаг.
   - `@ConditionalOnWebApplication`: приложение является веб-приложением.
3. Если все условия истинны, конфигурация регистрирует стандартный набор бинов.

*Для отладки автоконфигураций запустите приложение с флагом `--debug` — Spring Boot выведет полный Conditions Evaluation Report.*"""
        },
        {
            "question": "Как отключить конкретную автоконфигурацию в Spring Boot?",
            "answer": """Есть два основных способа:

1. **Через аннотацию `@SpringBootApplication` или `@EnableAutoConfiguration`:**
   ```java
   @SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, SecurityAutoConfiguration.class })
   public class Application { ... }
   ```
2. **Через файл конфигурации `application.properties` / `application.yml`:**
   ```properties
   spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
   ```"""
        },
        {
            "question": "Что такое Spring Boot Starters и какие популярные стартеры вы знаете?",
            "answer": """**Spring Boot Starter** — это готовый дескриптор зависимостей, объединяющий библиотеки, совместимые версии и транзитивные зависимости для решения определенной задачи.

### Популярные стартеры:
* `spring-boot-starter-web`: Spring MVC, RESTful сервисы, валидация, Jackson и встроенный Tomcat.
* `spring-boot-starter-data-jpa`: Spring Data JPA, Hibernate, HikariCP пул соединений.
* `spring-boot-starter-security`: Spring Security с базовой аутентификацией.
* `spring-boot-starter-actuator`: конечные точки мониторинга и сбора метрик.
* `spring-boot-starter-test`: JUnit 5, Mockito, AssertJ, Hamcrest, Spring Test.
* `spring-boot-starter-validation`: валидация моделей на базе Hibernate Validator / Bean Validation."""
        },
        {
            "question": "В чем разница между application.properties и application.yml?",
            "answer": """Оба формата служат для внешней конфигурации приложения, но имеют синтаксические различия:

| Критерий | `application.properties` | `application.yml` |
| :--- | :--- | :--- |
| **Формат** | Плоский `key=value` синтаксис | Иерархический YAML с отступами |
| **Читаемость** | При длинных префиксах много повторений | Наглядная древовидная структура |
| **Сложные типы (Lists, Maps)** | `app.servers[0]=127.0.0.1` | Естественные списки (`- 127.0.0.1`) |
| **Использование с `@PropertySource`** | Поддерживается по умолчанию | Не поддерживается стандартным `@PropertySource` без кастомного `YamlPropertySourceFactory` |"""
        },
        {
            "question": "В каком порядке Spring Boot загружает конфигурационные свойства (Property Precedence)?",
            "answer": """Spring Boot загружает свойства из множества источников с четким приоритетом (от наивысшего к низшему):

1. **Аргументы командной строки (`--server.port=9090`)** — наивысший приоритет.
2. `SPRING_APPLICATION_JSON` (свойства в формате JSON в переменной окружения).
3. Системные свойства Java (`System.getProperties()`, переданные через `-Dserver.port=9090`).
4. **Переменные окружения ОС (`OS Environment Variables`, например `SERVER_PORT=9090`).**
5. Профиль-зависимый конфиг вне JAR (`file:./config/application-{profile}.properties`).
6. Профиль-зависимый конфиг внутри JAR (`classpath:application-{profile}.properties`).
7. Общий конфиг приложения вне JAR (`file:./config/application.properties`).
8. **Общий конфиг приложения внутри JAR (`classpath:application.properties`)** — наименьший приоритет.
9. Значения по умолчанию в `@ConfigurationProperties` / `@Value`."""
        },
        {
            "question": "Что такое Spring Profiles и как их активировать?",
            "answer": """**Spring Profiles** — механизм изолирования конфигураций и бинов для различных сред выполнения (например, `dev`, `test`, `stage`, `prod`).

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
* В тестах: `@ActiveProfiles("test")`"""
        },
        {
            "question": "Что такое Spring Boot Actuator и для чего он используется?",
            "answer": """**Spring Boot Actuator** — модуль, предоставляющий готовые HTTP-эндпоинты и JMX-интерфейсы для мониторинга, проверки жизнеспособности (*health checks*) и управления приложением в production.

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
```"""
        },
        {
            "question": "В чем разница между @ConfigurationProperties и @Value?",
            "answer": """| Критерий | `@ConfigurationProperties` | `@Value` |
| :--- | :--- | :--- |
| **Назначение** | Привязка иерархического блока свойств к POJO-классу | Внедрение единичного скалярного значения или SpEL выражения |
| **Поддержка Relaxed Binding** | **Да** (`kebab-case`, `camelCase`, `SNAKE_CASE` автоматически маппятся) | **Нет** (требует строгого совпадения имени) |
| **Валидация (JSR-380)** | **Да** (через `@Validated`, `@NotNull`, `@Min`) | Нет |
| **Типобезопасность** | Высокая (статическая типизация полей) | Низкая (строковые литералы) |
| **Поддержка SpEL** | Нет | **Да** (`@Value(\"#{systemProperties['user.home']}\")`) |"""
        },
        {
            "question": "В чем разница между JpaRepository, CrudRepository и PagingAndSortingRepository?",
            "answer": """Иерархия репозиториев Spring Data:

```
CrudRepository
    └── PagingAndSortingRepository
            └── JpaRepository
```

* **`CrudRepository`:** предоставляет базовые методы CRUD (`save()`, `findById()`, `existsById()`, `deleteById()`, `count()`).
* **`PagingAndSortingRepository`:** добавляет методы пагинации и сортировки (`findAll(Pageable pageable)`, `findAll(Sort sort)`).
* **`JpaRepository`:** добавляет JPA-специфичные операции: сброс сессии (`flush()`, `saveAndFlush()`), пакетное удаление (`deleteInBatch()`), работу с `Example` запросами. В 95% проектов рекомендуется использовать `JpaRepository`."""
        },
        {
            "question": "Что такое проблема N+1 в Spring Data JPA / Hibernate и какими 3 способами её решают?",
            "answer": """**Проблема N+1** возникает, когда при выборке списка из $N$ родительских сущностей для каждой сущности выполняется отдельный дополнительный SQL-запрос для загрузки её связанной Lazy-коллекции (итого $1 + N$ запросов вместо 1).

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
   Hibernate объединяет ID сущностей в условие `WHERE order_id IN (?, ?, ...)`."""
        },
        {
            "question": "В чем разница между методами save() и saveAndFlush() в Spring Data JPA?",
            "answer": """* **`save()`:** сохраняет сущность в контекст постоянства Hibernate (First-Level Cache / Persistence Context). Реальный SQL `INSERT`/`UPDATE` может быть отложен до момента коммита транзакции.
* **`saveAndFlush()`:** выполняет сохранение и **немедленно принудительно синхронизирует состояние с базой данных** (вызывает `EntityManager.flush()`).

*Когда применять `saveAndFlush()`:* когда в рамках той же транзакции последующий нативный SQL-запрос или триггер БД зависит от уже вставленной записи."""
        },
        {
            "question": "Как организовать версионирование и миграции базы данных в Spring Boot (Flyway / Liquibase)?",
            "answer": """В production-средах категорически запрещено использовать `ddl-auto: create` или `update`. Используются инструменты миграций:

### Использование Flyway:
1. Добавить `org.flywaydb:flyway-core` и `flyway-database-postgresql` в зависимости.
2. Поместить версионированные SQL-скрипты в `src/main/resources/db/migration/`:
   - `V1__create_users_table.sql`
   - `V2__add_email_index.sql`
3. При старте Spring Boot проверяет таблицу `flyway_schema_history` и накатывает только новые миграции."""
        },
        {
            "question": "Как работает декларативное кэширование в Spring Boot (@Cacheable, @CachePut, @CacheEvict)?",
            "answer": """Кэширование включается аннотацией `@EnableCaching` на конфигурационном классе:

* **`@Cacheable(\"products\")`:** сохраняет результат метода в кэш. При повторном вызове с теми же аргументами метод не выполняется, данные берутся из кэша.
* **`@CachePut(value = \"products\", key = \"#product.id\")`:** всегда выполняет метод и обновляет запись в кэше.
* **`@CacheEvict(value = \"products\", key = \"#id\")`:** удаляет запись из кэша (например, при удалении товара).

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
*В production-среде в качестве Cache Provider подключают **Redis** (`spring-boot-starter-data-redis`).*"""
        },
        {
            "question": "Как настроить несколько источников данных (Multiple DataSources) в Spring Boot?",
            "answer": """Для подключения к двум разным БД создаются отдельные конфигурации:

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
Затем для каждого источника настраиваются отдельные `LocalContainerEntityManagerFactoryBean` и `PlatformTransactionManager`, привязанные к разным пакетам репозиториев (`@EnableJpaRepositories(basePackages = "...", entityManagerFactoryRef = "...")`)."""
        },
        {
            "question": "Что такое Spring Cloud и какие основные компоненты он включает?",
            "answer": """**Spring Cloud** — это экосистема библиотек для упрощения разработки распределенных систем и микросервисов:

* **Spring Cloud Config:** централизованное хранилище конфигураций сервисов (в Git).
* **Service Discovery (Eureka / Consul):** динамическая регистрация и обнаружение сервисов без хардкода IP/портов.
* **Spring Cloud Gateway:** API Gateway для маршрутизации, rate limiting и безопасности.
* **OpenFeign:** декларативный HTTP-клиент для межсервисного взаимодействия.
* **Resilience4j:** паттерны отказоустойчивости (Circuit Breaker, Retry, RateLimiter, Bulkhead).
* **Micrometer Tracing:** сквозная распределенная трассировка запросов."""
        },
        {
            "question": "Как работает паттерн Circuit Breaker (Предохранитель) в Spring Boot / Resilience4j?",
            "answer": """**Circuit Breaker** предотвращает каскадные сбои в микросервисной архитектуре, изолируя временно недоступный сервис.

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
```"""
        },
        {
            "question": "Что такое OpenFeign (@FeignClient) и в чем его преимущества?",
            "answer": """**OpenFeign** — это декларативный HTTP-клиент, позволяющий описывать межсервисные вызовы через обычные Java-интерфейсы с аннотациями Spring MVC:

```java
@FeignClient(name = "inventory-service", path = "/api/v1/inventory")
public interface InventoryClient {

    @GetMapping("/{sku}")
    StockDto checkStock(@PathVariable("sku") String sku);

    @PostMapping("/reserve")
    ReservationDto reserveItems(@RequestBody ReserveRequest request);
}
```
*Преимущества:* не нужно писать шаблонный код с `RestTemplate`/`WebClient`, автоматическая интеграция с Service Discovery (Eureka), балансировкой нагрузки (Spring Cloud LoadBalancer) и Circuit Breakers (Resilience4j)."""
        },
        {
            "question": "Что такое распределенная трассировка (Distributed Tracing) в Spring Boot 3?",
            "answer": """В микросервисах один клиентский запрос может проходить через цепочку из 5-10 сервисов. **Distributed Tracing** связывает все логи и вызовы единым идентификатором.

* **`traceId`:** уникальный идентификатор всего сквозного запроса от клиента до финального ответа.
* **`spanId`:** идентификатор операции внутри конкретного сервиса.
* **Реализация в Spring Boot 3:** модуль **Micrometer Tracing** (пришедший на смену Spring Cloud Sleuth), экспортирующий трейсы в Zipkin, Jaeger или OpenTelemetry."""
        },
        {
            "question": "Что такое паттерн Saga и в чем разница между Orchestration и Choreography?",
            "answer": """**Saga** — архитектурный паттерн управления распределенными транзакциями в микросервисах. Транзакция разбивается на цепочку локальных транзакций. Если один из шагов падает, запускаются **компенсирующие транзакции (Compensating Transactions)** для отката изменений.

### Два подхода к реализации Saga:
1. **Choreography (Хореография):** каждый сервис слушает события (Kafka/RabbitMQ) и самостоятельно решает, когда выполнять свое действие. *Плюсы:* слабая связанность. *Минусы:* сложно отслеживать сложный поток.
2. **Orchestration (Оркестрация):** выделенный сервис-оркестратор (например, на Camunda/Temporal или Spring Boot) централизованно отправляет команды сервисам и обрабатывает ошибки."""
        },
        {
            "question": "Как работает асинхронная обработка в Spring Boot (@Async, @EnableAsync)?",
            "answer": """Для выполнения тяжелых задач в фоновом потоке:

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
   ```"""
        },
        {
            "question": "Как работают аннотации тестирования в Spring Boot (@SpringBootTest, @WebMvcTest, @DataJpaTest, @MockBean)?",
            "answer": """Spring Boot предоставляет специализированные аннотации для интеграционного и срезового (slice) тестирования:

* **`@SpringBootTest`:** поднимает **полный контекст** приложения (ApplicationContext). Используется для полноценных end-to-end интеграционных тестов.
* **`@WebMvcTest`:** тестирует только веб-слой (контроллеры, фильтры, `Security`). Контроллер тестируется изолированно с помощью `MockMvc`, сервисы заменяются на моки.
* **`@DataJpaTest`:** тестирует слой доступа к данным (репозитории Spring Data JPA). Автоматически настраивает in-memory БД (H2) и включает откат транзакций после каждого теста.
* **`@MockBean` (в Spring Boot 3.4+ заменяется на `@MockitoBean`):** создает Mockito-мок и помещает его в Spring ApplicationContext вместо реального бина."""
        },
        {
            "question": "Как контейнеризировать Spring Boot приложение: Dockerfile vs Cloud Native Buildpacks?",
            "answer": """### 1. Многоэтапный Dockerfile (Multi-stage Build с Eclipse Temurin 21):
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
*Преимущества Buildpacks:* автоматическое разделение на слои (Dependencies, Spring Boot Loader, Application Classes), обновление базовой JRE без пересборки кода, оптимизированное кэширование слоев в Docker Registry."""
        },
        {
            "question": "Что нового появилось в Spring Boot 3.x и Spring Framework 6.x?",
            "answer": """Ключевые новшества Spring Boot 3 и Spring 6 (актуальные стандарты на 2026 год):

1. **Минимальная версия Java:** базовой версией стала **Java 17** (с полной поддержкой Java 21 Virtual Threads / Project Loom).
2. **Миграция на Jakarta EE 10:** пакет `javax.*` заменен на `jakarta.*` (сервлеты `jakarta.servlet`, валидация `jakarta.validation`, JPA `jakarta.persistence`).
3. **GraalVM Native Image & AOT:** встроенная поддержка Ahead-of-Time компиляции в нативные бинарники с мгновенным стартом (< 50мс) и низким потреблением памяти.
4. **Виртуальные потоки (Virtual Threads):** включение одной строчкой `spring.threads.virtual.enabled=true`.
5. **Унифицированная обработка ошибок (RFC 7807):** стандартная поддержка спецификации `ProblemDetail`.
6. **HTTP Interfaces (Declarative Clients):** декларативные HTTP-клиенты через аннотации `@HttpExchange` без необходимости Feign."""
        }
    ]

def main():
    print("🚀 Compiling synthesized Spring Framework and Spring Boot datasets...")
    spring_qs = get_spring_framework_questions()
    boot_qs = get_spring_boot_questions()
    print(f"  • Spring Framework: {len(spring_qs)} questions")
    print(f"  • Spring Boot:      {len(boot_qs)} questions")

if __name__ == "__main__":
    main()
