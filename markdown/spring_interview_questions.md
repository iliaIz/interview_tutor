# Spring Framework — Вопросы и Ответы для Собеседования

> **Раздел:** Web & Enterprise | **Всего вопросов:** 27 | **Источник:** Baeldung / InterviewBit

*IoC/DI контейнер, бины, скоупы, AOP, @Transactional, Spring MVC, WebFlux*

---
## Содержание / Быстрый переход

- [1. Что такое Spring Framework и каковы его ключевые преимущества?](#q-1)
- [2. Что такое Inversion of Control (IoC) и Dependency Injection (DI)?](#q-2)
- [3. В чем разница между BeanFactory и ApplicationContext?](#q-3)
- [4. Что такое Spring Bean и какие существуют способы его объявления?](#q-4)
- [5. Какие способы внедрения зависимостей (Dependency Injection) существуют и какой является предпочтительным?](#q-5)
- [6. Какие существуют Scope (области видимости) Spring бинов?](#q-6)
- [7. Являются ли Singleton-бины в Spring потокобезопасными (Thread-Safe)?](#q-7)
- [8. Как решить проблему внедрения Prototype-бина в Singleton-бин (Method Injection)?](#q-8)
- [9. Опишите полный жизненный цикл Spring бина (Bean Life Cycle).](#q-9)
- [10. В чем разница между BeanPostProcessor и BeanFactoryPostProcessor?](#q-10)
- [11. В чем разница между аннотациями @Autowired, @Resource и @Inject?](#q-11)
- [12. В чем разница между @Component, @Service, @Repository и @Controller?](#q-12)
- [13. Что такое Spring AOP и каковы его основные концепции (Aspect, JoinPoint, Pointcut, Advice)?](#q-13)
- [14. Как реализовать кастомный аспект AOP для замера времени выполнения методов (@Around + @TrackTime)?](#q-14)
- [15. В чем разница между JDK Dynamic Proxy и CGLIB Proxy в Spring?](#q-15)
- [16. Почему вызов метода внутри того же класса (Self-Invocation) не запускает @Transactional или аспект?](#q-16)
- [17. Как работает аннотация @Transactional и какие параметры она имеет?](#q-17)
- [18. Как устроен Spring Web MVC и каков путь обработки HTTP-запроса через DispatcherServlet?](#q-18)
- [19. В чем разница между @PathVariable, @RequestParam и @RequestBody в Spring MVC?](#q-19)
- [20. Зачем использовать ResponseEntity и в чем его преимущества перед возвратом обычного DTO?](#q-20)
- [21. Как устроена валидация входных DTO в Spring (@Valid, @NotBlank, JSR-380) и обработка ошибок валидации?](#q-21)
- [22. Что такое CORS и как настроить Cross-Origin запросы в Spring?](#q-22)
- [23. В чем разница между @ControllerAdvice и @ExceptionHandler?](#q-23)
- [24. В чем разница между HTTP-методами PUT и PATCH в REST API?](#q-24)
- [25. В чем разница между Authentication и Authorization в Spring Security?](#q-25)
- [26. Что такое Spring WebFlux и чем он отличается от Spring MVC?](#q-26)
- [27. В чем разница между реактивными типами Mono и Flux в Project Reactor?](#q-27)

---

### <a id="q-1"></a>1. Что такое Spring Framework и каковы его ключевые преимущества? `[SPRING-001]`

**Spring Framework** — это наиболее популярный в корпоративной Java-разработке легковесный фреймворк и контейнер управления жизненным циклом компонентов (Inversion of Control).

### Ключевые преимущества:
* **Слабая связанность (Loose Coupling):** достигается благодаря паттерну *Inversion of Control (IoC)* и *Dependency Injection (DI)*.
* **Минимум бойлерплейта:** интеграция с JDBC, JPA, JMS, транзакциями с автоматическим освобождением ресурсов и маппингом исключений.
* **Декларативное управление транзакциями (`@Transactional`):** разделение бизнес-логики и инфраструктурного управления транзакциями.
* **Аспектно-ориентированное программирование (Spring AOP):** сквозная функциональность (логирование, аудит, безопасность, кэширование) выносится в отдельные аспекты.
* **Модульность и экосистема:** возможность подключать только необходимые модули (Spring MVC, Spring Data, Spring Security, Spring WebFlux).
* **Тестируемость:** благодаря DI и интерфейсам компоненты легко тестируются с помощью Mock-объектов (Mockito) без поднятия тяжелого окружения.

---

### <a id="q-2"></a>2. Что такое Inversion of Control (IoC) и Dependency Injection (DI)? `[SPRING-002]`

* **Inversion of Control (IoC, Инверсия управления):** фундаментальный архитектурный принцип, при котором управление созданием объектов, связыванием их зависимостей и контролем их жизненного цикла передается внешнему контейнеру (Spring IoC Container), а не осуществляется вручную через оператор `new`.
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
```

---

### <a id="q-3"></a>3. В чем разница между BeanFactory и ApplicationContext? `[SPRING-003]`

Оба интерфейса представляют собой Spring IoC контейнеры, однако имеют разный уровень возможностей:

| Характеристика | BeanFactory | ApplicationContext |
| :--- | :--- | :--- |
| **Уровень** | Базовый интерфейс контейнера (root interface) | Расширенный интерфейс (наследник BeanFactory) |
| **Инициализация бинов** | **Lazy** (по умолчанию бины создаются при вызове `getBean()`) | **Eager** (все Singleton-бины создаются при старте приложения) |
| **Интернационализация (i18n)** | Не поддерживается | Поддерживается через `MessageSource` |
| **Публикация событий (Events)** | Не поддерживается | Поддерживается через `ApplicationEventPublisher` |
| **Интеграция с AOP** | Базовая | Полная автоматическая интеграция с `BeanPostProcessor` |
| **Сфера применения** | Ограниченные по ресурсам мобильные/IoT системы (устарело) | Стандарт для всех современных Spring-приложений |

---

### <a id="q-4"></a>4. Что такое Spring Bean и какие существуют способы его объявления? `[SPRING-004]`

**Spring Bean** — это объект, который создается, настраивается, связывается и управляется контейнером Spring IoC.

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
3. **XML-конфигурация (Legacy):** `<bean id="paymentService" class="com.example.PaymentService" />`.

---

### <a id="q-5"></a>5. Какие способы внедрения зависимостей (Dependency Injection) существуют и какой является предпочтительным? `[SPRING-005]`

В Spring существует 3 способа внедрения зависимостей:

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
   * *Минусы:* нарушает инкапсуляцию; невозможно сделать поле `final`; затрудняет Unit-тестирование (требует Reflection/Mockito).

---

### <a id="q-6"></a>6. Какие существуют Scope (области видимости) Spring бинов? `[SPRING-006]`

В Spring Framework поддерживаются следующие скоупы бинов:

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
```

---

### <a id="q-7"></a>7. Являются ли Singleton-бины в Spring потокобезопасными (Thread-Safe)? `[SPRING-007]`

**Нет, сами по себе Singleton-бины в Spring НЕ являются потокобезопасными.**

* Spring гарантирует лишь то, что будет создан **один экземпляр** бина на контейнер.
* Если несколько потоков одновременно вызывают методы этого бина, а бин имеет **изменяемое состояние (mutable state)** (например, поля экземпляра, списки, счетчики), возникнет состояние гонки (*race condition*).
* **Best Practice:** Singleton-бины должны быть **Stateless (без изменяемого состояния)**. Все промежуточные данные должны храниться в локальных переменных методов (стек вызова потока) или передаваться как аргументы.

---

### <a id="q-8"></a>8. Как решить проблему внедрения Prototype-бина в Singleton-бин (Method Injection)? `[SPRING-008]`

Если внедрить `Prototype` бин в `Singleton` бин обычным способом через `@Autowired`, то `Prototype` бин внедрится **ровно один раз** при создании Singleton-бина и фактически станет Singleton.

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
3. **`@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)`:** создает CGLIB-прокси вокруг бина.

---

### <a id="q-9"></a>9. Опишите полный жизненный цикл Spring бина (Bean Life Cycle). `[SPRING-009]`

Жизненный цикл бина в Spring состоит из четких этапов:

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
15. Вызов кастомного метода `destroy-method` (в `@Bean(destroyMethod = "...")`).

---

### <a id="q-10"></a>10. В чем разница между BeanPostProcessor и BeanFactoryPostProcessor? `[SPRING-010]`

| Критерий | BeanFactoryPostProcessor (BFPP) | BeanPostProcessor (BPP) |
| :--- | :--- | :--- |
| **Момент выполнения** | До создания экземпляров бинов | Во время инициализации каждого конкретного экземпляра бина |
| **С чем работает** | С метаданными (`BeanDefinition`), хранящимися в контейнере | С готовыми созданными Java-объектами |
| **Что может менять** | Значения свойств в `BeanDefinition` (например, подставить переменные из `application.properties`) | Обернуть бин в Proxy (AOP, `@Transactional`, `@Async`), валидировать поля |
| **Примеры реализации** | `PropertySourcesPlaceholderConfigurer`, `CustomScopeConfigurer` | `AutowiredAnnotationBeanPostProcessor`, `CommonAnnotationBeanPostProcessor`, AOP auto-proxy creators |

---

### <a id="q-11"></a>11. В чем разница между аннотациями @Autowired, @Resource и @Inject? `[SPRING-011]`

* **`@Autowired` (Spring Framework):**
  - По умолчанию ищет зависимость **по типу (byType)**.
  - Если найдено несколько кандидатов, можно уточнить с помощью `@Qualifier("beanName")` или `@Primary`.
  - Имеет флаг `required = false`.
* **`@Resource` (Jakarta EE / JSR-250):**
  - По умолчанию ищет зависимость **по имени (byName)**.
  - Если по имени не найдено, выполняет поиск по типу (byType).
* **`@Inject` (Jakarta Dependency Injection / JSR-330):**
  - Ищет **по типу (byType)**.
  - Для разрешения неоднозначности используется аннотация `@Named` вместо `@Qualifier`.

---

### <a id="q-12"></a>12. В чем разница между @Component, @Service, @Repository и @Controller? `[SPRING-012]`

Все эти аннотации являются **стереотипами** Spring и помечены мета-аннотацией `@Component`, поэтому автоматически обнаруживаются механизмом Component Scan:

* **`@Component`:** базовый универсальный стереотип для любого Spring-управляемого компонента.
* **`@Service`:** семантический маркер для классов слоя бизнес-логики (Service Layer). Не добавляет особого поведения, служит для архитектурной выразительности.
* **`@Repository`:** маркер для слоя доступа к данным (DAO / Data Access). **Важная особенность:** Spring автоматически применяет к нему `PersistenceExceptionTranslationPostProcessor`, который перехватывает специфичные SQL/ORM исключения и транслирует их в унифицированную иерархию unchecked исключений `DataAccessException`.
* **`@Controller` / `@RestController`:** маркер для презентационного слоя (Spring Web MVC). `@RestController` объединяет `@Controller` и `@ResponseBody`.

---

### <a id="q-13"></a>13. Что такое Spring AOP и каковы его основные концепции (Aspect, JoinPoint, Pointcut, Advice)? `[SPRING-013]`

**Spring AOP (Aspect-Oriented Programming)** — парадигма программирования, позволяющая модульно выделять сквозную функциональность (Cross-Cutting Concerns: безопасность, логирование, аудит, кэширование, управление транзакциями), не засоряя основную бизнес-логику.

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
* **Weaving (Связывание):** процесс внедрения аспектов в целевой код (в Spring AOP выполняется в Runtime через динамические Proxy).

---

### <a id="q-14"></a>14. Как реализовать кастомный аспект AOP для замера времени выполнения методов (@Around + @TrackTime)? `[SPRING-014]`

Для создания кастомного аспекта профилирования выполняются следующие шаги:

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
   ```

---

### <a id="q-15"></a>15. В чем разница между JDK Dynamic Proxy и CGLIB Proxy в Spring? `[SPRING-015]`

Spring AOP использует динамические прокси для оборачивания бинов:

| Характеристика | JDK Dynamic Proxy | CGLIB Proxy |
| :--- | :--- | :--- |
| **Механизм** | Встроен в Java Reflection API (`java.lang.reflect.Proxy`) | Сторонняя библиотека генерации байткода (упакована в Spring) |
| **Требование** | Класс **обязан реализовывать интерфейс** | Создает класс-наследник (subclass) целевого класса |
| **Ограничения** | Проксирует только методы интерфейса | Не может проксировать `final` классы и `final` методы |
| **Использование в Spring** | Использовался по умолчанию в Spring Framework до 5.x при наличии интерфейса | **Используется по умолчанию в Spring Boot 2+ и Spring 6** (`spring.aop.proxy-target-class=true`) |

---

### <a id="q-16"></a>16. Почему вызов метода внутри того же класса (Self-Invocation) не запускает @Transactional или аспект? `[SPRING-016]`

Потому что Spring AOP построен на **динамических Proxy-объектах**.

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
* Использовать AspectJ Compile-time/Load-time Weaving вместо Spring Proxy AOP.

---

### <a id="q-17"></a>17. Как работает аннотация @Transactional и какие параметры она имеет? `[SPRING-017]`

`@Transactional` декларативно оборачивает выполнение метода в транзакцию базы данных с помощью Spring AOP и `PlatformTransactionManager`.

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
5. **`timeout`:** максимальное время выполнения транзакции в секундах.

---

### <a id="q-18"></a>18. Как устроен Spring Web MVC и каков путь обработки HTTP-запроса через DispatcherServlet? `[SPRING-018]`

Spring MVC реализует паттерн *Front Controller* через центральный сервлет **`DispatcherServlet`**.

### Путь обработки входящего HTTP-запроса:
1. Запрос приходит на **`DispatcherServlet`**.
2. `DispatcherServlet` обращается к **`HandlerMapping`**, чтобы найти подходящий контроллер и метод обработки (по URL, HTTP-методу, заголовкам).
3. `DispatcherServlet` вызывает **`HandlerAdapter`**, который выполняет подготовку аргументов (валидация, `@RequestBody`, `@PathVariable`) и вызывает метод контроллера.
4. Метод контроллера выполняет бизнес-логику и возвращает результат (`ModelAndView` или объект данных).
5. Если это REST API (`@RestController` / `@ResponseBody`), **`HttpMessageConverter`** (например, Jackson) сериализует объект напрямую в JSON/XML и записывает в HTTP Response.
6. Если это классический MVC с шаблонами (Thymeleaf/JSP), `DispatcherServlet` передает имя представления в **`ViewResolver`**, который рендерит HTML-страницу.

---

### <a id="q-19"></a>19. В чем разница между @PathVariable, @RequestParam и @RequestBody в Spring MVC? `[SPRING-019]`

Эти три аннотации служат для извлечения различных частей входящего HTTP-запроса:

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
   ```

---

### <a id="q-20"></a>20. Зачем использовать ResponseEntity и в чем его преимущества перед возвратом обычного DTO? `[SPRING-020]`

`ResponseEntity<T>` представляет собой полную обертку HTTP-ответа, позволяющую гибко контролировать:
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
```

---

### <a id="q-21"></a>21. Как устроена валидация входных DTO в Spring (@Valid, @NotBlank, JSR-380) и обработка ошибок валидации? `[SPRING-021]`

Валидация основана на спецификации **Jakarta Bean Validation (JSR-380 / Hibernate Validator)**:

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
   ```

---

### <a id="q-22"></a>22. Что такое CORS и как настроить Cross-Origin запросы в Spring? `[SPRING-022]`

**CORS (Cross-Origin Resource Sharing)** — механизм безопасности браузера, блокирующий HTTP-запросы скриптов между разными доменами, протоколами или портами (Same-Origin Policy).

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
   ```

---

### <a id="q-23"></a>23. В чем разница между @ControllerAdvice и @ExceptionHandler? `[SPRING-023]`

* **`@ExceptionHandler`:** объявляется внутри метода контроллера для обработки конкретного типа исключения. По умолчанию перехватывает ошибки **только внутри того контроллера, где объявлен**.
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
```

---

### <a id="q-24"></a>24. В чем разница между HTTP-методами PUT и PATCH в REST API? `[SPRING-024]`

| Критерий | `PUT` | `PATCH` |
| :--- | :--- | :--- |
| **Семантика** | **Полная замена** ресурса (Full Replacement) | **Частичное обновление** ресурса (Partial Update) |
| **Непереданные поля** | Сбрасываются в `null` или значения по умолчанию | Остаются без изменений |
| **Идемпотентность** | **Идемпотентен** (повторные одинаковые вызовы дают тот же результат) | Как правило, **не идемпотентен** (в зависимости от логики операции) |
| **Тело запроса** | Полный объект сущности | Только изменяемые поля (например, `{ "status": "ACTIVE" }`) |

---

### <a id="q-25"></a>25. В чем разница между Authentication и Authorization в Spring Security? `[SPRING-025]`

* **Authentication (Аутентификация — Кто вы?):** процесс проверки подлинности пользователя (логин/пароль, JWT токен, сертификат, OAuth2).
  - В Spring Security управляется через `AuthenticationManager`, `AuthenticationProvider`, `UserDetailsService`.
* **Authorization (Авторизация — Что вам разрешено делать?):** проверка прав/ролей пользователя для доступа к конкретному ресурсу или методу.
  - В Spring Security настраивается на уровне URL-фильтров (`authorizeHttpRequests`) или методов (`@PreAuthorize("hasRole('ADMIN')")`, `@Secured`).

```java
@PreAuthorize("hasAuthority('ORDER_DELETE') or hasRole('ADMIN')")
@DeleteMapping("/orders/{id}")
public ResponseEntity<Void> deleteOrder(@PathVariable Long id) { ... }
```

---

### <a id="q-26"></a>26. Что такое Spring WebFlux и чем он отличается от Spring MVC? `[SPRING-026]`

**Spring WebFlux** — это реактивный неблокирующий веб-фреймворк, появившийся в Spring 5, построенный на базе Project Reactor и спецификации Reactive Streams.

| Характеристика | Spring Web MVC | Spring WebFlux |
| :--- | :--- | :--- |
| **Модель потоков** | One Thread per Request (Блокирующий I/O) | Event Loop (Неблокирующий асинхронный I/O) |
| **Сервер по умолчанию** | Apache Tomcat, Jetty | Netty, Undertow |
| **Типы данных** | Синхронные объекты (`User`, `List<User>`) | Реактивные типы (`Mono<User>`, `Flux<User>`) |
| **Работа с БД** | Блокирующие JDBC, JPA / Hibernate | Неблокирующие R2DBC, Reactive Mongo/Redis |
| **Потребление ресурсов** | Требует много потоков и памяти при высокой нагрузке | Высокая пропускная способность при малом числе потоков |
| **Применение** | Стандартные CRUD корпоративные приложения | Высоконагруженные микросервисы, стриминг данных, WebSockets |

---

### <a id="q-27"></a>27. В чем разница между реактивными типами Mono и Flux в Project Reactor? `[SPRING-027]`

* **`Mono<T>`:** реактивный поток, эмитирующий **от 0 до 1 элемента** (или ошибку `onError`). Аналог `Optional<T>` или `CompletableFuture<T>` в реактивном мире.
* **`Flux<T>`:** реактивный поток, эмитирующий **от 0 до N элементов** (бесконечный поток событий или конечная последовательность), завершающийся сигналом `onComplete` или `onError`.

```java
Mono<User> userMono = Mono.just(new User("Alice"));
Flux<String> namesFlux = Flux.just("Alice", "Bob", "Charlie");
```

---
