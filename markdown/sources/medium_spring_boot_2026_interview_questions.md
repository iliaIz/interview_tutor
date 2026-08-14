# Top 50 Java Spring Boot Interview Questions (2026 Edition)

> **Source:** [Medium — Sumanth Poola (ILLUMINATION)](https://medium.com/illumination/top-50-java-spring-boot-interview-questions-2026-edition-57ecfbdf3061)  
> **Total Questions:** 50  
> **Target Levels:** Junior, Middle, Senior (2026 Standards)

---

## Table of Contents

### Section 1: Spring Boot Basics (Questions 1–10)
- [1. What is Spring Boot and How is it Different from Spring Framework?](#q-1)
- [2. What Does @SpringBootApplication Do?](#q-2)
- [3. What is Auto-Configuration and how does it work?](#q-3)
- [4. What is the Spring IoC Container?](#q-4)
- [5. What is Dependency Injection? What are its types?](#q-5)
- [6. What is the difference between @Component, @Service, @Repository, and @Controller?](#q-6)
- [7. What is the Bean lifecycle in Spring?](#q-7)
- [8. What are Bean Scopes?](#q-8)
- [9. What is @Autowired and how does Spring resolve ambiguity?](#q-9)
- [10. What is application.properties vs application.yml?](#q-10)

### Section 2: REST API & Web Layer (Questions 11–20)
- [11. What is the difference between @RestController and @Controller?](#q-11)
- [12. Explain @PathVariable vs @RequestParam vs @RequestBody](#q-12)
- [13. What is ResponseEntity and why use it?](#q-13)
- [14. How do you handle exceptions globally in Spring Boot?](#q-14)
- [15. What is request validation and how do you implement it?](#q-15)
- [16. What is CORS and how do you configure it?](#q-16)
- [17. What is the difference between PUT and PATCH?](#q-17)
- [18. How do you implement pagination in Spring Boot?](#q-18)
- [19. What is Spring Security and how does authentication work?](#q-19)
- [20. What is the difference between Authentication and Authorization?](#q-20)

### Section 3: Data & JPA (Questions 21–30)
- [21. What is Spring Data JPA?](#q-21)
- [22. What is the difference between JpaRepository, CrudRepository, and PagingAndSortingRepository?](#q-22)
- [23. What is the N+1 problem and how do you fix it?](#q-23)
- [24. What is @Transactional and when should you use it?](#q-24)
- [25. What is Lazy vs Eager loading?](#q-25)
- [26. What is the difference between save() and saveAndFlush()?](#q-26)
- [27. How do you write custom queries in Spring Data JPA?](#q-27)
- [28. What is database migration and how do you use Flyway or Liquibase?](#q-28)
- [29. What is Caching in Spring Boot?](#q-29)
- [30. How do you configure multiple datasources?](#q-30)

### Section 4: Microservices (Questions 31–40)
- [31. What is a Microservices Architecture?](#q-31)
- [32. What is Spring Cloud?](#q-32)
- [33. What is Service Discovery?](#q-33)
- [34. What is a Circuit Breaker pattern?](#q-34)
- [35. What is an API Gateway?](#q-35)
- [36. What is Feign Client?](#q-36)
- [37. What is an Event-Driven Architecture?](#q-37)
- [38. What is Distributed Tracing?](#q-38)
- [39. What is the Saga Pattern?](#q-39)
- [40. What is the difference between Orchestration and Choreography?](#q-40)

### Section 5: Advanced Topics (Questions 41–50)
- [41. What is Actuator and why is it important?](#q-41)
- [42. How do you externalize configuration?](#q-42)
- [43. What are Spring Profiles?](#q-43)
- [44. What is AOP (Aspect-Oriented Programming)?](#q-44)
- [45. What is the difference between @Bean and @Component?](#q-45)
- [46. How do you write unit tests in Spring Boot?](#q-46)
- [47. What is @SpringBootTest vs @WebMvcTest?](#q-47)
- [48. How does Spring Boot handle async processing?](#q-48)
- [49. What is the difference between Monolithic and Microservices architectures?](#q-49)
- [50. How do you containerize a Spring Boot application?](#q-50)

---

## Section 1: Spring Boot Basics (Questions 1–10)

### <a id="q-1"></a>1. What is Spring Boot and How is it Different from Spring Framework?

Spring Framework is a powerful but complex framework. To set up a basic web application, you needed to configure XML files, set up a servlet container, manage dependencies manually, and wire dozens of beans together.

Spring Boot changed everything by introducing three core ideas:
* **Auto-Configuration:** Spring Boot looks at your classpath and automatically configures beans based on what it finds.
* **Starter Dependencies:** Instead of hunting for compatible library versions, you add one starter and Spring Boot handles the rest.
* **Embedded Server:** No more deploying WAR files to external Tomcat. Your application runs as a standalone JAR.

**Key Difference:** Spring Framework gives you the tools. Spring Boot gives you a working application.

---

### <a id="q-2"></a>2. What Does @SpringBootApplication Do?

`@SpringBootApplication` is a combination of three annotations:
* `@SpringBootConfiguration` — Marks this as a configuration class (specialized `@Configuration`).
* `@EnableAutoConfiguration` — Enables Spring Boot auto-configuration mechanism.
* `@ComponentScan` — Scans packages for Spring components (`@Component`, `@Service`, `@Repository`, `@Controller`).

When your application starts, Spring Boot scans the package where this annotation is placed, loads auto-configurations from `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (or `spring.factories`), and wires everything together.

---

### <a id="q-3"></a>3. What is Auto-Configuration and how does it work?

Auto-configuration works through conditional bean registration. Spring Boot ships with hundreds of `@Configuration` classes, each annotated with conditions:
* `@ConditionalOnClass(DataSource.class)` — Bean is created only if class exists on classpath.
* `@ConditionalOnMissingBean(DataSource.class)` — Bean is created only if user has not defined their own bean.
* `@ConditionalOnProperty(name = "spring.datasource.url")` — Bean is created only if property is configured.

You can inspect conditions evaluation by starting your app with `--debug`.

---

### <a id="q-4"></a>4. What is the Spring IoC Container?

IoC stands for **Inversion of Control**. With IoC, you flip the responsibility of object creation from manual instantiation (`new`) to the container. You declare what you need, and the container provides it.

```java
@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository; // injected by Spring
    }
}
```

The container manages object creation, lifecycle, and wiring.

---

### <a id="q-5"></a>5. What is Dependency Injection? What are its types?

Dependency Injection is the practical implementation of IoC. Spring supports three types:

1. **Constructor Injection (Recommended):**
   ```java
   @Service
   public class OrderService {
       private final PaymentService paymentService;

       public OrderService(PaymentService paymentService) {
           this.paymentService = paymentService;
       }
   }
   ```
2. **Setter Injection:**
   ```java
   @Autowired
   public void setPaymentService(PaymentService paymentService) {
       this.paymentService = paymentService;
   }
   ```
3. **Field Injection (Avoid in production):**
   ```java
   @Autowired
   private PaymentService paymentService;
   ```

*Why constructor injection is preferred:* Makes dependencies explicit, supports immutability with `final`, and makes testing easier without a Spring context.

---

### <a id="q-6"></a>6. What is the difference between @Component, @Service, @Repository, and @Controller?

| Annotation | Layer | Extra behavior |
| :--- | :--- | :--- |
| `@Component` | Generic | None |
| `@Service` | Business logic | None (marker only) |
| `@Repository` | Data access | Translates database exceptions to Spring's `DataAccessException` |
| `@Controller` | Web layer | Handles HTTP requests, works with `@RequestMapping` |

---

### <a id="q-7"></a>7. What is the Bean lifecycle in Spring?

1. Spring reads configuration and instantiates beans (constructors called).
2. Dependencies are injected.
3. `@PostConstruct` method is called (custom initialization).
4. Bean is ready for use.
5. On shutdown, `@PreDestroy` method is called (custom cleanup).
6. Bean is destroyed.

```java
@Component
public class DatabaseConnection {
    @PostConstruct
    public void init() {
        System.out.println("Connection pool initialized");
    }

    @PreDestroy
    public void cleanup() {
        System.out.println("Connection pool closed");
    }
}
```

---

### <a id="q-8"></a>8. What are Bean Scopes?

| Scope | Behavior |
| :--- | :--- |
| `singleton` | One instance per Spring context (default) |
| `prototype` | New instance every time it is requested |
| `request` | One instance per HTTP request (web apps) |
| `session` | One instance per HTTP session (web apps) |
| `application` | One instance per `ServletContext` |

*Singleton depending on Prototype:* The prototype bean only gets created once when injected into a singleton. To fix this, use `@Lookup` or `ObjectProvider<T>`.

---

### <a id="q-9"></a>9. What is @Autowired and how does Spring resolve ambiguity?

`@Autowired` tells Spring to inject a matching bean by type. When there are multiple beans of the same type, Spring throws `NoUniqueBeanDefinitionException`. Resolve with:
* `@Primary` — Marks the default bean.
* `@Qualifier("name")` — Specifies which bean to inject by name.

---

### <a id="q-10"></a>10. What is application.properties vs application.yml?

* `application.yml` uses hierarchical YAML format which handles nested properties cleanly.
* `application.properties` uses flat `key=value` format.

For complex configurations, YAML is cleaner. For simple apps, properties works fine.

---

## Section 2: REST API & Web Layer (Questions 11–20)

### <a id="q-11"></a>11. What is the difference between @RestController and @Controller?

* `@Controller` returns view names — used in MVC apps that render HTML templates (Thymeleaf, JSP).
* `@RestController = @Controller + @ResponseBody` — every method automatically serializes the return value to JSON and writes it to the HTTP response.

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }
}
```

---

### <a id="q-12"></a>12. Explain @PathVariable vs @RequestParam vs @RequestBody

```java
// URL: /users/42
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) { ... }

// URL: /users?page=1&size=10
@GetMapping("/users")
public List<User> getUsers(
    @RequestParam int page,
    @RequestParam int size) { ... }

// POST body: {"name": "John", "email": "john@example.com"}
@PostMapping("/users")
public User createUser(@RequestBody UserDto userDto) { ... }
```

---

### <a id="q-13"></a>13. What is ResponseEntity and why use it?

`ResponseEntity` gives full control over HTTP status codes, headers, and body:

```java
@PostMapping("/users")
public ResponseEntity<UserDto> createUser(@RequestBody UserDto dto) {
    UserDto created = userService.create(dto);
    return ResponseEntity
        .status(HttpStatus.CREATED) // 201 Created
        .header("Location", "/users/" + created.getId())
        .body(created);
}
```

---

### <a id="q-14"></a>14. How do you handle exceptions globally in Spring Boot?

Using `@RestControllerAdvice` with `@ExceptionHandler`:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("INTERNAL_ERROR", "Something went wrong"));
    }
}
```

---

### <a id="q-15"></a>15. What is request validation and how do you implement it?

Add `spring-boot-starter-validation` and use Bean Validation (JSR-380) annotations:

```java
public class UserDto {
    @NotBlank(message = "Name is required")
    private String name;

    @Email(message = "Invalid email format")
    private String email;

    @Min(value = 18, message = "Age must be at least 18")
    private int age;
}
```

In controller:
```java
@PostMapping("/users")
public ResponseEntity<UserDto> createUser(@Valid @RequestBody UserDto dto) {
    return ResponseEntity.ok(userService.create(dto));
}
```

---

### <a id="q-16"></a>16. What is CORS and how do you configure it?

CORS controls which browser domains can access your API.

* **Method level:** `@CrossOrigin(origins = "https://myapp.com")`
* **Global configuration:**
  ```java
  @Configuration
  public class CorsConfig implements WebMvcConfigurer {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
          registry.addMapping("/api/**")
              .allowedOrigins("https://myapp.com")
              .allowedMethods("GET", "POST", "PUT", "DELETE")
              .allowedHeaders("*");
      }
  }
  ```

---

### <a id="q-17"></a>17. What is the difference between PUT and PATCH?

* **`PUT`:** Replaces the entire resource. Fields not included are reset to `null`/default.
* **`PATCH`:** Partial update. Only the supplied fields are updated.

---

### <a id="q-18"></a>18. How do you implement pagination in Spring Boot?

```java
@GetMapping("/users")
public ResponseEntity<Page<UserDto>> getUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "id") String sortBy) {
    Pageable pageable = PageRequest.of(page, size, Sort.by(sortBy));
    Page<UserDto> users = userService.findAll(pageable);
    return ResponseEntity.ok(users);
}
```

---

### <a id="q-19"></a>19. What is Spring Security and how does authentication work?

Spring Security acts as a filter chain between HTTP requests and application controllers:
1. Request arrives at `SecurityFilterChain`.
2. Filter intercepts and extracts authentication token (e.g. Bearer JWT).
3. `AuthenticationProvider` / `AuthenticationManager` validates signature/credentials.
4. `SecurityContext` stores the authenticated `Principal`.
5. Controller processes request.

---

### <a id="q-20"></a>20. What is the difference between Authentication and Authorization?

* **Authentication (Who are you?):** Verifying identity (username/password, JWT, OAuth2). Handled by `AuthenticationManager`.
* **Authorization (What can you do?):** Checking permissions/roles. Handled via `@PreAuthorize("hasRole('ADMIN')")`.

---

## Section 3: Data & JPA (Questions 21–30)

### <a id="q-21"></a>21. What is Spring Data JPA?

Spring Data JPA generates repository implementations dynamically from interface definitions and method naming conventions:

```java
public interface UserRepository extends JpaRepository<User, Long> {
    List<User> findByEmail(String email);
    List<User> findByAgeGreaterThan(int age);
    Optional<User> findByEmailAndActive(String email, boolean active);
}
```

---

### <a id="q-22"></a>22. What is the difference between JpaRepository, CrudRepository, and PagingAndSortingRepository?

* `CrudRepository` — Basic CRUD operations (`save`, `findById`, `delete`).
* `PagingAndSortingRepository` — Adds pagination and sorting methods.
* `JpaRepository` — Extends both, adding JPA-specific methods (`flush`, `saveAndFlush`, batch delete).

---

### <a id="q-23"></a>23. What is the N+1 problem and how do you fix it?

Occurs when fetching a collection of $N$ entities causes $N$ additional database queries for lazy relations.

**Solutions:**
1. **JPQL `JOIN FETCH`:** `@Query("SELECT o FROM Order o JOIN FETCH o.customer")`
2. **`@EntityGraph`:** `@EntityGraph(attributePaths = {"customer", "items"})`
3. **Batch Fetching:** `@BatchSize(size = 20)`

---

### <a id="q-24"></a>24. What is @Transactional and when should you use it?

Ensures atomic execution (commit/rollback) across database operations:

```java
@Transactional
public void transferFunds(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepository.findById(fromId).orElseThrow();
    Account to = accountRepository.findById(toId).orElseThrow();
    from.debit(amount);
    to.credit(amount);
    accountRepository.save(from);
    accountRepository.save(to);
}
```

* Rollbacks happen on `RuntimeException` by default.
* Does not trigger on self-invocation due to Spring proxying.

---

### <a id="q-25"></a>25. What is Lazy vs Eager loading?

* `EAGER`: Related entities are loaded immediately.
* `LAZY`: Related entities are loaded only when accessed.
* Defaults: `@OneToMany`, `@ManyToMany` = `LAZY`; `@ManyToOne`, `@OneToOne` = `EAGER`.

---

### <a id="q-26"></a>26. What is the difference between save() and saveAndFlush()?

* `save()` — Persists to Hibernate session / first-level cache. Actual SQL INSERT/UPDATE may be delayed until commit.
* `saveAndFlush()` — Immediately forces SQL flush to the database.

---

### <a id="q-27"></a>27. How do you write custom queries in Spring Data JPA?

1. **Method name derivation:** `findByLastNameAndActive(String name, boolean active)`
2. **JPQL with `@Query`:** `@Query("SELECT u FROM User u WHERE u.email = :email")`
3. **Native SQL:** `@Query(value = "SELECT * FROM users WHERE created_at > NOW()", nativeQuery = true)`

---

### <a id="q-28"></a>28. What is database migration and how do you use Flyway or Liquibase?

Never use `ddl-auto: update` in production. Flyway manages versioned SQL scripts in `src/main/resources/db/migration/` (e.g. `V1__init.sql`, `V2__add_index.sql`) and applies only pending scripts.

---

### <a id="q-29"></a>29. What is Caching in Spring Boot?

Enabled via `@EnableCaching`:
* `@Cacheable("products")` — Caches method return value on cache miss.
* `@CachePut(value = "products", key = "#product.id")` — Updates cache value.
* `@CacheEvict(value = "products", key = "#id")` — Evicts entry from cache.

---

### <a id="q-30"></a>30. How do you configure multiple datasources?

```java
@Configuration
public class DataSourceConfig {

    @Primary
    @Bean("primaryDataSource")
    @ConfigurationProperties("spring.datasource.primary")
    public DataSource primaryDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean("secondaryDataSource")
    @ConfigurationProperties("spring.datasource.secondary")
    public DataSource secondaryDataSource() {
        return DataSourceBuilder.create().build();
    }
}
```

---

## Section 4: Microservices (Questions 31–40)

### <a id="q-31"></a>31. What is a Microservices Architecture?

Decomposes monolithic applications into small, independently deployable services that communicate over APIs, each owning its database.

---

### <a id="q-32"></a>32. What is Spring Cloud?

Suite of tools for distributed systems:
* **Spring Cloud Config:** Centralized configuration repository.
* **Eureka / Consul:** Service discovery.
* **Spring Cloud Gateway:** API Gateway routing and rate limiting.
* **OpenFeign:** Declarative HTTP client.
* **Resilience4j:** Circuit breakers and retries.
* **Micrometer Tracing:** Distributed tracing.

---

### <a id="q-33"></a>33. What is Service Discovery?

Services dynamically register their IP/port with a discovery server (Eureka) on startup, and query the registry to locate other services by service name.

---

### <a id="q-34"></a>34. What is a Circuit Breaker pattern?

Prevents cascading failures by stopping calls to failing services.
* **Closed:** Normal operation.
* **Open:** Fails fast and executes fallback method.
* **Half-Open:** Allows limited trial requests to test recovery.

```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
public PaymentResponse processPayment(PaymentRequest request) {
    return paymentClient.process(request);
}

public PaymentResponse paymentFallback(PaymentRequest request, Exception ex) {
    return PaymentResponse.builder()
        .status("PENDING")
        .message("Payment service temporarily unavailable")
        .build();
}
```

---

### <a id="q-35"></a>35. What is an API Gateway?

Unified entry point for client traffic providing routing, security, rate limiting, and SSL termination:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://USER-SERVICE
          predicates:
            - Path=/api/users/**
```

---

### <a id="q-36"></a>36. What is Feign Client?

Declarative REST client generating HTTP calls from annotated interfaces:

```java
@FeignClient(name = "inventory-service")
public interface InventoryClient {
    @GetMapping("/api/inventory/{productId}")
    InventoryResponse checkStock(@PathVariable String productId);
}
```

---

### <a id="q-37"></a>37. What is an Event-Driven Architecture?

Services communicate asynchronously via events (Kafka / RabbitMQ), decoupling producers and consumers.

---

### <a id="q-38"></a>38. What is Distributed Tracing?

Assigns a unique `traceId` and `spanId` to track requests across multiple microservice hops using Zipkin, Jaeger, and Micrometer Tracing.

---

### <a id="q-39"></a>39. What is the Saga Pattern?

Manages distributed transactions across microservices via a sequence of local transactions and compensating transactions for rollbacks.

---

### <a id="q-40"></a>40. What is the difference between Orchestration and Choreography?

* **Orchestration:** Central coordinator controls workflow steps.
* **Choreography:** Services react independently to domain events.

---

## Section 5: Advanced Topics (Questions 41–50)

### <a id="q-41"></a>41. What is Actuator and why is it important?

Exposes production monitoring endpoints (`/actuator/health`, `/actuator/metrics`, `/actuator/env`, `/actuator/loggers`).

---

### <a id="q-42"></a>42. How do you externalize configuration?

Hierarchy: Command line args > Environment variables > Profile properties > Default properties > Git repository (Spring Cloud Config).

---

### <a id="q-43"></a>43. What are Spring Profiles?

Environment segregation (`dev`, `prod`, `test`) activated via `spring.profiles.active=prod`.

---

### <a id="q-44"></a>44. What is AOP (Aspect-Oriented Programming)?

Modularizes cross-cutting concerns (logging, metrics, security):

```java
@Aspect
@Component
public class PerformanceAspect {
    @Around("@annotation(TrackTime)")
    public Object trackExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long duration = System.currentTimeMillis() - start;
        log.info("{} executed in {}ms", joinPoint.getSignature().getName(), duration);
        return result;
    }
}
```

---

### <a id="q-45"></a>45. What is the difference between @Bean and @Component?

* `@Component`: Class-level, auto-detected via component scan.
* `@Bean`: Method-level in `@Configuration`, used for 3rd party classes and custom creation logic.

---

### <a id="q-46"></a>46. How do you write unit tests in Spring Boot?

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void shouldReturnUserWhenFound() {
        User user = new User(1L, "John", "john@example.com");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        UserDto result = userService.findById(1L);
        assertThat(result.getName()).isEqualTo("John");
        verify(userRepository).findById(1L);
    }
}
```

---

### <a id="q-47"></a>47. What is @SpringBootTest vs @WebMvcTest?

* `@SpringBootTest` — Loads complete ApplicationContext for full integration tests.
* `@WebMvcTest` — Loads only controller layer for fast slice testing with `MockMvc`.

---

### <a id="q-48"></a>48. How does Spring Boot handle async processing?

Enabled with `@EnableAsync`, using `@Async` on methods returning `CompletableFuture<T>`.

---

### <a id="q-49"></a>49. What is the difference between Monolithic and Microservices architectures?

Monoliths offer simplicity for small teams; Microservices offer independent scaling and fault isolation at scale.

---

### <a id="q-50"></a>50. How do you containerize a Spring Boot application?

1. **Dockerfile:**
   ```dockerfile
   FROM eclipse-temurin:21-jre-alpine
   WORKDIR /app
   COPY target/myapp.jar app.jar
   EXPOSE 8080
   ENTRYPOINT ["java", "-jar", "app.jar"]
   ```
2. **Cloud Native Buildpacks (Spring Boot 3+):**
   ```bash
   mvn spring-boot:build-image
   ```
