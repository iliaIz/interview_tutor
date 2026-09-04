import { CodingChallenge } from '../challengeSeedData';

export const ARCHUNIT_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. ArchUnit Layer Isolation & Inversion
  // =========================================================================
  {
    id: 'kata_test_archunit_layer_isolation',
    slug: 'kata-test-archunit-layer-isolation',
    title: 'KATA-TEST-30: ArchUnit Layer Isolation & Inversion',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🏛️ Layer Isolation',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ArchUnit 1.3+, JUnit 5',
    timeLimitMinutes: 45,
    shortDescription: 'Фитнес-функция контроля однонаправленного потока зависимостей: запрет контроллерам вызывать репозитории и гарантия ацикличности графа.',
    instructionsMarkdown: `### 🎯 Архитектурная фитнес-функция
В распределенных микросервисах электронной коммерции и биллинга архитектурный дрейф часто приводит к прямому обращению веб-контроллеров к интерфейсам репозиториев в обход сервисного слоя.
Подобная практика нарушает принцип единственной ответственности и инверсии зависимостей, провоцируя размытие границ транзакций, обход валидационных фильтров доменных моделей и исключение механизмов аудита.
Возникновение циклических зависимостей между пакетами блокирует возможность разделения монолита на обособленные модули.

### 🧪 Ваша цель
В \`ArchitectureLayerIsolationTest.java\` реализуйте правила **ArchUnit 1.3+**:
1. **Layered Architecture:**
   - Слой \`Controller\` (\`..controller..\`) не вызывается никем.
   - Слой \`Service\` (\`..service..\`) вызывается только \`Controller\`.
   - Слой \`Repository\` (\`..repository..\`) вызывается только \`Service\`.
   - Слой \`Domain\` (\`..domain..\`) вызывается \`Service\`, \`Repository\`, \`Controller\`.
2. **Прямой запрет:** \`noClasses().that().resideInAPackage("..controller..").should().dependOnClassesThat().resideInAPackage("..repository..")\`.
3. **Защита домена:** \`noClasses().that().resideInAPackage("..service..").should().dependOnClassesThat().resideInAPackage("..controller..")\`.
4. **Ацикличность срезов:** \`slices().matching("com.enterprise.order.(*)..").should().beFreeOfCycles()\`.

Уничтожьте всех 5 архитектурных мутантов!`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/order/domain/Order.java',
        content: `package com.enterprise.order.domain;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

public final class Order {
    private final UUID orderId;
    private final String customerId;
    private final BigDecimal totalAmount;
    private final String status;

    public Order(UUID orderId, String customerId, BigDecimal totalAmount, String status) {
        this.orderId = Objects.requireNonNull(orderId, "orderId must not be null");
        this.customerId = Objects.requireNonNull(customerId, "customerId must not be null");
        this.totalAmount = Objects.requireNonNull(totalAmount, "totalAmount must not be null");
        this.status = Objects.requireNonNull(status, "status must not be null");
    }

    public UUID getOrderId() { return orderId; }
    public String getCustomerId() { return customerId; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getStatus() { return status; }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/order/repository/OrderRepository.java',
        content: `package com.enterprise.order.repository;

import com.enterprise.order.domain.Order;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository {
    Order save(Order order);
    Optional<Order> findById(UUID orderId);
    void deleteById(UUID orderId);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/order/service/OrderService.java',
        content: `package com.enterprise.order.service;

import com.enterprise.order.domain.Order;
import java.math.BigDecimal;
import java.util.UUID;

public interface OrderService {
    Order createOrder(String customerId, BigDecimal amount);
    Order getOrder(UUID orderId);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/order/service/impl/OrderServiceImpl.java',
        content: `package com.enterprise.order.service.impl;

import com.enterprise.order.domain.Order;
import com.enterprise.order.repository.OrderRepository;
import com.enterprise.order.service.OrderService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;

    public OrderServiceImpl(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(String customerId, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be strictly positive");
        }
        Order order = new Order(UUID.randomUUID(), customerId, amount, "CREATED");
        return orderRepository.save(order);
    }

    @Override
    @Transactional(readOnly = true, rollbackFor = Exception.class)
    public Order getOrder(UUID orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalStateException("Order not found: " + orderId));
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/order/controller/OrderController.java',
        content: `package com.enterprise.order.controller;

import com.enterprise.order.domain.Order;
import com.enterprise.order.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<OrderResponse> createOrder(@RequestBody CreateOrderRequest request) {
        Order order = orderService.createOrder(request.customerId(), request.amount());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new OrderResponse(order.getOrderId(), order.getCustomerId(), order.getTotalAmount(), order.getStatus()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable UUID id) {
        Order order = orderService.getOrder(id);
        return ResponseEntity.ok(
                new OrderResponse(order.getOrderId(), order.getCustomerId(), order.getTotalAmount(), order.getStatus()));
    }

    public record CreateOrderRequest(String customerId, BigDecimal amount) {}
    public record OrderResponse(UUID orderId, String customerId, BigDecimal amount, String status) {}
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/order/ArchitectureLayerIsolationTest.java',
        content: `package com.enterprise.order;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(packages = "com.enterprise.order")
public class ArchitectureLayerIsolationTest {

    @ArchTest
    public static final ArchRule layered_architecture_must_be_respected =
            layeredArchitecture()
                    .consideringAllDependencies()
                    .layer("Controller").definedBy("com.enterprise.order.controller..")
                    .layer("Service").definedBy("com.enterprise.order.service..")
                    .layer("Repository").definedBy("com.enterprise.order.repository..")
                    .layer("Domain").definedBy("com.enterprise.order.domain..")
                    .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
                    .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
                    .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
                    .whereLayer("Domain").mayOnlyBeAccessedByLayers("Service", "Repository", "Controller");

    @ArchTest
    public static final ArchRule controllers_must_not_depend_on_repositories =
            noClasses()
                    .that().resideInAPackage("..controller..")
                    .should().dependOnClassesThat().resideInAPackage("..repository..")
                    .because("Web layer must communicate with persistence strictly through domain services");

    @ArchTest
    public static final ArchRule services_must_not_depend_on_controllers =
            noClasses()
                    .that().resideInAPackage("..service..")
                    .should().dependOnClassesThat().resideInAPackage("..controller..")
                    .because("Domain/Service core must remain independent of external transport adapters");

    @ArchTest
    public static final ArchRule packages_must_be_free_of_cycles =
            slices()
                    .matching("com.enterprise.order.(*)..")
                    .should().beFreeOfCycles()
                    .because("Circular package dependencies undermine modularity and prevent independent compilation");

    @Test
    @DisplayName("Verify layer isolation and dependency rules against imported classes")
    void testArchitectureRules() {
        JavaClasses importedClasses = new ClassFileImporter().importPackages("com.enterprise.order");
        layered_architecture_must_be_respected.check(importedClasses);
        controllers_must_not_depend_on_repositories.check(importedClasses);
        services_must_not_depend_on_controllers.check(importedClasses);
        packages_must_be_free_of_cycles.check(importedClasses);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_arch_layer_controller_to_repo',
        name: 'ControllerDirectRepositoryCallMutator',
        file: 'src/main/java/com/enterprise/order/controller/OrderController.java',
        line: 23,
        mutatedContent: `package com.enterprise.order.controller;
import com.enterprise.order.domain.Order;
import com.enterprise.order.service.OrderService;
import com.enterprise.order.repository.OrderRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
public class OrderController {
    private final OrderService orderService;
    // MUTANT: Controller directly accesses persistence layer!
    private OrderRepository orderRepository;
    public OrderController(OrderService os) { this.orderService = os; }
    public Order bypassService(UUID id) { return orderRepository.findById(id).orElse(null); }
}`
      },
      {
        id: 'mutant_arch_layer_service_imports_controller',
        name: 'ServiceImportsControllerDtoMutator',
        file: 'src/main/java/com/enterprise/order/service/impl/OrderServiceImpl.java',
        line: 8,
        mutatedContent: `package com.enterprise.order.service.impl;
import com.enterprise.order.domain.Order;
import com.enterprise.order.service.OrderService;
// MUTANT: Service layer depends on transport controller layer!
import com.enterprise.order.controller.OrderController.CreateOrderRequest;
import java.math.BigDecimal;
import java.util.UUID;
public class OrderServiceImpl implements OrderService {
    public Order createOrder(String c, BigDecimal a) { return null; }
    public Order getOrder(UUID id) { return null; }
    public void handleTransportDto(CreateOrderRequest req) {}
}`
      },
      {
        id: 'mutant_arch_layer_repo_imports_service',
        name: 'CircularPackageDependencyMutator',
        file: 'src/main/java/com/enterprise/order/repository/OrderRepository.java',
        line: 5,
        mutatedContent: `package com.enterprise.order.repository;
import com.enterprise.order.domain.Order;
// MUTANT: Repository references Service creating a cyclical package dependency!
import com.enterprise.order.service.OrderService;
import java.util.Optional;
import java.util.UUID;
public interface OrderRepository {
    Order save(Order o);
    Optional<Order> findById(UUID id);
    void deleteById(UUID id);
    default void triggerAudit(OrderService s) {}
}`
      },
      {
        id: 'mutant_arch_layer_controller_catches_dao',
        name: 'ControllerCatchesDataAccessExceptionMutator',
        file: 'src/main/java/com/enterprise/order/controller/OrderController.java',
        line: 30,
        mutatedContent: `package com.enterprise.order.controller;
import com.enterprise.order.domain.Order;
import com.enterprise.order.service.OrderService;
import com.enterprise.order.repository.OrderRepository;
public class OrderController {
    private final OrderService orderService;
    private OrderRepository orderRepository;
    public OrderController(OrderService orderService) { this.orderService = orderService; }
    public Order directQuery(java.util.UUID id) { return orderRepository.findById(id).orElse(null); }
}`
      },
      {
        id: 'mutant_arch_layer_circular_slice',
        name: 'SlicesCircularDependencyMutator',
        file: 'src/main/java/com/enterprise/order/domain/Order.java',
        line: 6,
        mutatedContent: `package com.enterprise.order.domain;
import java.math.BigDecimal; import java.util.UUID;
// MUTANT: Domain entity depends on Service interface, causing cycle in order.(*)..
import com.enterprise.order.service.OrderService;
public final class Order {
    private final UUID orderId;
    public Order(UUID id) { this.orderId = id; }
    public void attachService(OrderService s) {}
}`
      }
    ]
  },

  // =========================================================================
  // 2. Enterprise API Governance Rules
  // =========================================================================
  {
    id: 'kata_test_archunit_enterprise_api_governance',
    slug: 'kata-test-archunit-enterprise-api-governance',
    title: 'KATA-TEST-31: Enterprise API Governance Rules',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🛡️ API Governance',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ArchUnit 1.3+, JUnit 5',
    timeLimitMinutes: 45,
    shortDescription: 'Запрет устаревших Date/Calendar, System.currentTimeMillis, System.exit() и ручного new Thread() в пользу Virtual Threads и Clock.',
    instructionsMarkdown: `### 🎯 Архитектурная фитнес-функция
В распределенных финансовых транзакционных системах критически важна абсолютная детерминированность шкалы времени и предсказуемость жизненного цикла потоков операционной системы.
- Использование устаревших API (\`java.util.Date\`, \`java.util.Calendar\`, \`SimpleDateFormat\`) провоцирует состояние гонки.
- Прямые вызовы \`System.currentTimeMillis()\` или \`Instant.now()\` делают невозможным симуляцию временных сдвигов в тестах.
- Использование \`System.exit()\` уничтожает контейнер без фазы graceful shutdown.
- Ручное создание \`new Thread()\` в среде с виртуальными потоками Java 21 нарушает планирование задач и обходит контексты MDC.

### 🧪 Ваша цель
В \`EnterpriseApiGovernanceArchTest.java\` опишите правила:
1. **Запрет Legacy Date/Time:** \`noClasses().should().dependOnClassesThat().haveFullyQualifiedName("java.util.Date").orShould()...\` (Date, Calendar, SimpleDateFormat).
2. **Инъекция Clock:** \`noClasses().should().callMethod(System.class, "currentTimeMillis")\`.
3. **Запрет аварийного падения:** \`noClasses().should().callMethod(System.class, "exit", int.class)...\`.
4. **Запрет ручных потоков:** \`noClasses().should().callConstructor(Thread.class)...\`.

Уничтожьте всех 5 нарушителей корпоративного стандарта!`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/governance/service/CriticalEnterpriseDomainException.java',
        content: `package com.enterprise.governance.service;

public class CriticalEnterpriseDomainException extends RuntimeException {
    public CriticalEnterpriseDomainException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        content: `package com.enterprise.governance.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

@Service
public class AuditingProcessingService {

    private static final Logger log = LoggerFactory.getLogger(AuditingProcessingService.class);

    private final Clock clock;
    private final TaskExecutor taskExecutor;

    public AuditingProcessingService(Clock clock, TaskExecutor taskExecutor) {
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
        this.taskExecutor = Objects.requireNonNull(taskExecutor, "taskExecutor must not be null");
    }

    public Instant recordAuditTimestamp(String eventId) {
        Instant currentInstant = clock.instant();
        log.info("Audit event registered: {} at {}", eventId, currentInstant);
        return currentInstant;
    }

    public void dispatchAuditTask(Runnable auditTask) {
        taskExecutor.execute(() -> {
            try {
                auditTask.run();
            } catch (Exception ex) {
                log.error("Asynchronous audit task failed execution", ex);
            }
        });
    }

    public void handleCriticalFailure(String reason) {
        log.error("Critical enterprise system failure: {}. Propagating domain termination event.", reason);
        throw new CriticalEnterpriseDomainException(reason);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/governance/EnterpriseApiGovernanceArchTest.java',
        content: `package com.enterprise.governance;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "com.enterprise.governance")
public class EnterpriseApiGovernanceArchTest {

    @ArchTest
    public static final ArchRule no_legacy_date_time_apis =
            noClasses()
                    .should().dependOnClassesThat().haveFullyQualifiedName("java.util.Date")
                    .orShould().dependOnClassesThat().haveFullyQualifiedName("java.util.Calendar")
                    .orShould().dependOnClassesThat().haveFullyQualifiedName("java.text.SimpleDateFormat")
                    .because("Modern temporal logic must exclusively utilize java.time types (Instant, LocalDate, ZonedDateTime)");

    @ArchTest
    public static final ArchRule no_direct_system_time_calls =
            noClasses()
                    .should().callMethod(System.class, "currentTimeMillis")
                    .because("Time extraction must be decoupled via java.time.Clock to enable deterministic testability");

    @ArchTest
    public static final ArchRule no_system_exit_or_runtime_halt =
            noClasses()
                    .should().callMethod(System.class, "exit", int.class)
                    .orShould().callMethod(Runtime.class, "exit", int.class)
                    .orShould().callMethod(Runtime.class, "halt", int.class)
                    .because("Services must rely on structured Spring Boot lifecycle and container orchestrators for termination");

    @ArchTest
    public static final ArchRule no_manual_thread_instantiation =
            noClasses()
                    .should().callConstructor(Thread.class)
                    .orShould().callConstructor(Thread.class, Runnable.class)
                    .orShould().callConstructor(Thread.class, String.class)
                    .orShould().callConstructor(Thread.class, Runnable.class, String.class)
                    .because("Direct Thread instantiation bypasses managed task execution, virtual thread schedulers, and MDC context propagation");

    @Test
    @DisplayName("Verify API governance rules against imported classes")
    void testGovernanceRules() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.enterprise.governance");
        no_legacy_date_time_apis.check(classes);
        no_direct_system_time_calls.check(classes);
        no_system_exit_or_runtime_halt.check(classes);
        no_manual_thread_instantiation.check(classes);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_gov_legacy_date',
        name: 'LegacyDateInjectionMutator',
        file: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        line: 23,
        mutatedContent: `package com.enterprise.governance.service;
import java.time.Instant;
import java.util.Date;
public class AuditingProcessingService {
    // MUTANT: uses java.util.Date!
    public Instant recordAuditTimestamp(String id) {
        Date d = new Date();
        return d.toInstant();
    }
}`
      },
      {
        id: 'mutant_gov_system_current_time',
        name: 'SystemCurrentTimeMillisMutator',
        file: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        line: 24,
        mutatedContent: `package com.enterprise.governance.service;
import java.time.Instant;
public class AuditingProcessingService {
    // MUTANT: Direct call to System.currentTimeMillis()!
    public Instant recordAuditTimestamp(String id) {
        long ts = System.currentTimeMillis();
        return Instant.ofEpochMilli(ts);
    }
}`
      },
      {
        id: 'mutant_gov_manual_thread',
        name: 'ManualThreadInstantiationMutator',
        file: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        line: 30,
        mutatedContent: `package com.enterprise.governance.service;
public class AuditingProcessingService {
    // MUTANT: Direct new Thread().start() instead of TaskExecutor!
    public void dispatchAuditTask(Runnable task) {
        new Thread(task).start();
    }
}`
      },
      {
        id: 'mutant_gov_system_exit',
        name: 'SystemExitInvocationMutator',
        file: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        line: 39,
        mutatedContent: `package com.enterprise.governance.service;
public class AuditingProcessingService {
    // MUTANT: Kills JVM process without graceful shutdown!
    public void handleCriticalFailure(String reason) {
        System.exit(1);
    }
}`
      },
      {
        id: 'mutant_gov_simple_date_format',
        name: 'SimpleDateFormatUsageMutator',
        file: 'src/main/java/com/enterprise/governance/service/AuditingProcessingService.java',
        line: 15,
        mutatedContent: `package com.enterprise.governance.service;
import java.text.SimpleDateFormat;
public class AuditingProcessingService {
    // MUTANT: Thread-unsafe SimpleDateFormat usage!
    private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd");
}`
      }
    ]
  },

  // =========================================================================
  // 3. Transactional Integrity Guard
  // =========================================================================
  {
    id: 'kata_test_archunit_transactional_integrity',
    slug: 'kata-test-archunit-transactional-integrity',
    title: 'KATA-TEST-32: Transactional Integrity Guard',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🔒 Transaction Guard',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ArchUnit 1.3+, Spring AOP',
    timeLimitMinutes: 45,
    shortDescription: 'ArchUnit ArchCondition для защиты Spring AOP: @Transactional только на public методах и обязательное указание rollbackFor = Exception.class.',
    instructionsMarkdown: `### 🎯 Архитектурная фитнес-функция
Транзакционная надежность финансовых операций базируется на перехвате методов динамическими прокси Spring AOP.
- **Инвариант 1 (Публичная видимость):** Прокси активируется **только** при вызове \`public\` методов. Маркировка \`private\` или \`protected\` методов аннотацией \`@Transactional\` молчаливо игнорируется: код выполняется вне транзакции в режиме autocommit.
- **Инвариант 2 (Защита от Checked Exceptions):** Стандартный откат Spring инициируется исключительно при \`RuntimeException\` и \`Error\`. Если метод бросает Checked Exception (\`InsufficientFundsException\`, \`AccountSuspendedException\`), Spring коммитит транзакцию, приводя к финансовому дисбалансу!
- Поэтому все \`@Transactional\` обязаны явно указывать \`rollbackFor = Exception.class\`.

### 🧪 Ваша цель
В \`TransactionalIntegrityArchTest.java\` реализуйте:
1. \`methods().that().areAnnotatedWith(Transactional.class).should().bePublic()\`.
2. Пользовательский \`ArchCondition<JavaMethod>\`, проверяющий, что атрибут \`rollbackFor\` или \`rollbackForClassName\` не пуст.
3. Классовое правило \`classes().that().areAnnotatedWith(Transactional.class).should(...)\`.

Уничтожьте всех 5 транзакционных мутантов!`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/finance/service/InsufficientFundsException.java',
        content: `package com.enterprise.finance.service;

public class InsufficientFundsException extends Exception {
    public InsufficientFundsException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/finance/service/AccountSuspendedException.java',
        content: `package com.enterprise.finance.service;

public class AccountSuspendedException extends Exception {
    public AccountSuspendedException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/finance/service/Account.java',
        content: `package com.enterprise.finance.service;

import java.math.BigDecimal;
import java.util.UUID;

public class Account {
    private final UUID id;
    private BigDecimal balance;
    private final boolean active;

    public Account(UUID id, BigDecimal balance, boolean active) {
        this.id = id;
        this.balance = balance;
        this.active = active;
    }

    public UUID getId() { return id; }
    public BigDecimal getBalance() { return balance; }
    public boolean isActive() { return active; }

    public void debit(BigDecimal amount) {
        this.balance = this.balance.subtract(amount);
    }

    public void credit(BigDecimal amount) {
        this.balance = this.balance.add(amount);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/finance/service/AccountRepository.java',
        content: `package com.enterprise.finance.service;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository {
    Optional<Account> findById(UUID id);
    Account save(Account account);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        content: `package com.enterprise.finance.service;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinancialLedgerService {

    private final AccountRepository accountRepository;

    public FinancialLedgerService(AccountRepository accountRepository) {
        this.accountRepository = Objects.requireNonNull(accountRepository, "accountRepository must not be null");
    }

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public void transferFunds(UUID sourceAccountId, UUID targetAccountId, BigDecimal amount) 
            throws InsufficientFundsException, AccountSuspendedException {
        
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Transfer amount must be strictly positive");
        }

        Account source = accountRepository.findById(sourceAccountId)
                .orElseThrow(() -> new IllegalArgumentException("Source account not found"));
        Account target = accountRepository.findById(targetAccountId)
                .orElseThrow(() -> new IllegalArgumentException("Target account not found"));

        if (!source.isActive()) {
            throw new AccountSuspendedException("Source account is suspended: " + sourceAccountId);
        }

        if (source.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException("Insufficient balance for debit: " + sourceAccountId);
        }

        source.debit(amount);
        target.credit(amount);

        accountRepository.save(source);
        accountRepository.save(target);
    }

    @Transactional(readOnly = true, rollbackFor = Exception.class)
    public BigDecimal calculateSettlementBalance(UUID accountId) {
        return accountRepository.findById(accountId)
                .map(Account::getBalance)
                .orElse(BigDecimal.ZERO);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/finance/TransactionalIntegrityArchTest.java',
        content: `package com.enterprise.finance;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

@AnalyzeClasses(packages = "com.enterprise.finance")
public class TransactionalIntegrityArchTest {

    @ArchTest
    public static final ArchRule transactional_methods_must_be_public =
            methods()
                    .that().areAnnotatedWith(Transactional.class)
                    .or().areAnnotatedWith(jakarta.transaction.Transactional.class)
                    .should().bePublic()
                    .because("Spring AOP proxies can only intercept public methods; transactional private/protected methods are silently bypassed");

    @ArchTest
    public static final ArchRule transactional_methods_must_specify_rollback_for =
            methods()
                    .that().areAnnotatedWith(Transactional.class)
                    .should(declareExplicitRollbackForAttribute())
                    .because("Default Spring @Transactional ignores Checked Exceptions, resulting in corrupted database state");

    @ArchTest
    public static final ArchRule class_level_transactional_must_specify_rollback_for =
            classes()
                    .that().areAnnotatedWith(Transactional.class)
                    .should(declareClassLevelRollbackForAttribute())
                    .because("Class-level transactions must explicitly govern rollback policies for checked exceptions");

    public static ArchCondition<JavaMethod> declareExplicitRollbackForAttribute() {
        return new ArchCondition<>("declare explicit rollbackFor specifying Exception.class or checked targets") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                method.tryGetAnnotationOfType(Transactional.class).ifPresent(tx -> {
                    boolean hasRollbackForClasses = tx.rollbackFor().length > 0;
                    boolean hasRollbackForNames = tx.rollbackForClassName().length > 0;

                    if (!hasRollbackForClasses && !hasRollbackForNames) {
                        String message = String.format(
                                "Method <%s> is annotated with @Transactional but lacks explicit rollbackFor",
                                method.getFullName());
                        events.add(SimpleConditionEvent.violated(method, message));
                    }
                });
            }
        };
    }

    public static ArchCondition<JavaClass> declareClassLevelRollbackForAttribute() {
        return new ArchCondition<>("declare explicit class-level rollbackFor") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                javaClass.tryGetAnnotationOfType(Transactional.class).ifPresent(tx -> {
                    boolean hasRollbackForClasses = tx.rollbackFor().length > 0;
                    boolean hasRollbackForNames = tx.rollbackForClassName().length > 0;

                    if (!hasRollbackForClasses && !hasRollbackForNames) {
                        String message = String.format(
                                "Class <%s> is annotated with @Transactional but lacks explicit rollbackFor",
                                javaClass.getName());
                        events.add(SimpleConditionEvent.violated(javaClass, message));
                    }
                });
            }
        };
    }

    @Test
    @DisplayName("Verify Transactional AOP compliance rules against imported classes")
    void testTransactionalCompliance() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.enterprise.finance");
        transactional_methods_must_be_public.check(classes);
        transactional_methods_must_specify_rollback_for.check(classes);
        class_level_transactional_must_specify_rollback_for.check(classes);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_tx_omit_rollback_for',
        name: 'OmitRollbackForAttributeMutator',
        file: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        line: 19,
        mutatedContent: `package com.enterprise.finance.service;
import org.springframework.transaction.annotation.Transactional;
public class FinancialLedgerService {
    // MUTANT: Default @Transactional ignores Checked Exceptions!
    @Transactional
    public void transferFunds() throws InsufficientFundsException {}
}`
      },
      {
        id: 'mutant_tx_private_transactional',
        name: 'PrivateTransactionalMethodMutator',
        file: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        line: 48,
        mutatedContent: `package com.enterprise.finance.service;
import org.springframework.transaction.annotation.Transactional;
public class FinancialLedgerService {
    // MUTANT: private @Transactional is silently bypassed by Spring AOP proxy!
    @Transactional(rollbackFor = Exception.class)
    private void syncBalance(Account acc) {}
}`
      },
      {
        id: 'mutant_tx_protected_transactional',
        name: 'ProtectedTransactionalMethodMutator',
        file: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        line: 49,
        mutatedContent: `package com.enterprise.finance.service;
import org.springframework.transaction.annotation.Transactional;
public class FinancialLedgerService {
    // MUTANT: protected method cannot be proxied by standard CGLIB proxy!
    @Transactional(rollbackFor = Exception.class)
    protected void auditEntry() {}
}`
      },
      {
        id: 'mutant_tx_narrow_rollback_for',
        name: 'NarrowRollbackForRuntimeExceptionOnlyMutator',
        file: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        line: 19,
        mutatedContent: `package com.enterprise.finance.service;
import org.springframework.transaction.annotation.Transactional;
public class FinancialLedgerService {
    // MUTANT: rollbackFor only specifies RuntimeException while throws InsufficientFundsException!
    @Transactional(rollbackFor = RuntimeException.class)
    public void transferFunds() throws Exception {}
}`
      },
      {
        id: 'mutant_tx_class_level_missing_rollback',
        name: 'ClassLevelMissingRollbackForMutator',
        file: 'src/main/java/com/enterprise/finance/service/FinancialLedgerService.java',
        line: 13,
        mutatedContent: `package com.enterprise.finance.service;
import org.springframework.transaction.annotation.Transactional;
// MUTANT: Class-level transactional lacks rollbackFor!
@Transactional
public class FinancialLedgerService {
    public void calculate() {}
}`
      }
    ]
  },

  // =========================================================================
  // 4. WebMvc Slice & RFC 7807 ProblemDetail (@WebMvcTest & @MockitoBean)
  // =========================================================================
  {
    id: 'kata_test_spring_webmvc_problem_detail',
    slug: 'kata-test-spring-webmvc-problem-detail',
    title: 'KATA-TEST-33: WebMvc Slice & RFC 7807 ProblemDetail',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🌐 WebMvc RFC 7807',
    difficulty: 'Senior',
    targetStack: 'Spring Boot 3.4+, Java 21 LTS, @MockitoBean, MockMvc',
    timeLimitMinutes: 45,
    shortDescription: 'Срезовое тестирование контроллера через @WebMvcTest с новым @MockitoBean, проверкой 201/400/404/409 и валидацией ProblemDetail.',
    instructionsMarkdown: `### 🎯 Инженерная задача
В распределенных микросервисных экосистемах консистентность обработки исключений является частью контракта интеграции.
- Спецификация **RFC 7807 («Problem Details for HTTP APIs»)** устанавливает универсальный формат JSON-сбоев (\`type\`, \`title\`, \`status\`, \`detail\`, \`instance\`).
- Начиная со **Spring Boot 3.4**, устаревшая аннотация \`@MockBean\` выведена из эксплуатации в пользу \`org.springframework.test.context.bean.override.mockito.MockitoBean\`.
- Slice-тестирование (\`@WebMvcTest\`) верифицирует HTTP-контракты за <150 мс без поднятия БД.

### 🧪 Ваша цель
В \`CustomerControllerWebMvcTest.java\` протестируйте:
1. \`POST /api/v1/customers\`: 201 Created с заголовком \`Location\` и валидным телом JSON.
2. \`POST /api/v1/customers\`: 400 Bad Request с RFC 7807 ProblemDetail и картой \`invalidParams\` (\`name\`, \`email\`, \`tier\`).
3. \`GET /api/v1/customers/{id}\`: 404 Not Found с RFC 7807 ProblemDetail и \`timestamp\`.
4. \`POST /api/v1/customers\`: 409 Conflict при коллизии уникального email.

Уничтожьте всех 5 веб-мутантов!`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/web/dto/CustomerRegistrationRequest.java',
        content: `package com.enterprise.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CustomerRegistrationRequest(
        @NotBlank(message = "Name must not be blank")
        @Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
        String name,

        @NotBlank(message = "Email must not be blank")
        @Email(message = "Email must be well-formed")
        String email,

        @NotNull(message = "Tier must not be null")
        String tier
) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/dto/CustomerResponse.java',
        content: `package com.enterprise.web.dto;

import java.util.UUID;

public record CustomerResponse(UUID id, String name, String email, String tier) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/exception/ResourceNotFoundException.java',
        content: `package com.enterprise.web.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/exception/ResourceConflictException.java',
        content: `package com.enterprise.web.exception;

public class ResourceConflictException extends RuntimeException {
    public ResourceConflictException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/service/CustomerService.java',
        content: `package com.enterprise.web.service;

import com.enterprise.web.dto.CustomerRegistrationRequest;
import com.enterprise.web.dto.CustomerResponse;
import java.util.UUID;

public interface CustomerService {
    CustomerResponse registerCustomer(CustomerRegistrationRequest request);
    CustomerResponse getCustomerById(UUID id);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/controller/GlobalProblemDetailsExceptionHandler.java',
        content: `package com.enterprise.web.controller;

import com.enterprise.web.exception.ResourceConflictException;
import com.enterprise.web.exception.ResourceNotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problemDetail.setTitle("Resource Not Found");
        problemDetail.setType(URI.create("https://api.enterprise.com/errors/not-found"));
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return problemDetail;
    }

    @ExceptionHandler(ResourceConflictException.class)
    public ProblemDetail handleResourceConflict(ResourceConflictException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problemDetail.setTitle("Resource Conflict");
        problemDetail.setType(URI.create("https://api.enterprise.com/errors/conflict"));
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return problemDetail;
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed");
        problemDetail.setTitle("Bad Request");
        problemDetail.setType(URI.create("https://api.enterprise.com/errors/bad-request"));
        problemDetail.setProperty("timestamp", Instant.now().toString());

        Map<String, String> invalidParams = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            invalidParams.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        problemDetail.setProperty("invalidParams", invalidParams);

        return ResponseEntity.status(status).headers(headers).body(problemDetail);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/web/controller/CustomerController.java',
        content: `package com.enterprise.web.controller;

import com.enterprise.web.dto.CustomerRegistrationRequest;
import com.enterprise.web.dto.CustomerResponse;
import com.enterprise.web.service.CustomerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CustomerResponse> register(@Valid @RequestBody CustomerRegistrationRequest request) {
        CustomerResponse response = customerService.registerCustomer(request);
        return ResponseEntity.created(URI.create("/api/v1/customers/" + response.id())).body(response);
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CustomerResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(customerService.getCustomerById(id));
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/web/controller/CustomerControllerWebMvcTest.java',
        content: `package com.enterprise.web.controller;

import com.enterprise.web.dto.CustomerRegistrationRequest;
import com.enterprise.web.dto.CustomerResponse;
import com.enterprise.web.exception.ResourceConflictException;
import com.enterprise.web.exception.ResourceNotFoundException;
import com.enterprise.web.service.CustomerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CustomerController.class)
class CustomerControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @Test
    @DisplayName("POST /api/v1/customers - 201 Created при валидном запросе")
    void registerCustomer_ValidPayload_Returns201() throws Exception {
        UUID customerId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        CustomerResponse mockResponse = new CustomerResponse(customerId, "John Doe", "john.doe@enterprise.com", "GOLD");

        when(customerService.registerCustomer(any(CustomerRegistrationRequest.class))).thenReturn(mockResponse);

        String jsonRequest = """
                {
                    "name": "John Doe",
                    "email": "john.doe@enterprise.com",
                    "tier": "GOLD"
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/customers/" + customerId))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value(customerId.toString()))
                .andExpect(jsonPath("$.name").value("John Doe"))
                .andExpect(jsonPath("$.email").value("john.doe@enterprise.com"))
                .andExpect(jsonPath("$.tier").value("GOLD"));
    }

    @Test
    @DisplayName("POST /api/v1/customers - 400 Bad Request и валидный RFC 7807 при ошибках валидации")
    void registerCustomer_InvalidPayload_ReturnsProblemDetail400() throws Exception {
        String invalidJsonRequest = """
                {
                    "name": "",
                    "email": "invalid-email-address",
                    "tier": null
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJsonRequest))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://api.enterprise.com/errors/bad-request"))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Request validation failed"))
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.invalidParams.name").exists())
                .andExpect(jsonPath("$.invalidParams.email").value("Email must be well-formed"))
                .andExpect(jsonPath("$.invalidParams.tier").value("Tier must not be null"));
    }

    @Test
    @DisplayName("GET /api/v1/customers/{id} - 404 Not Found и RFC 7807 при отсутствии ресурса")
    void getCustomer_NotFound_ReturnsProblemDetail404() throws Exception {
        UUID nonExistentId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        when(customerService.getCustomerById(nonExistentId))
                .thenThrow(new ResourceNotFoundException("Customer with ID not found: " + nonExistentId));

        mockMvc.perform(get("/api/v1/customers/{id}", nonExistentId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://api.enterprise.com/errors/not-found"))
                .andExpect(jsonPath("$.title").value("Resource Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Customer with ID not found: " + nonExistentId))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("POST /api/v1/customers - 409 Conflict и RFC 7807 при коллизии уникального email")
    void registerCustomer_ConflictEmail_ReturnsProblemDetail409() throws Exception {
        when(customerService.registerCustomer(any(CustomerRegistrationRequest.class)))
                .thenThrow(new ResourceConflictException("Email already registered in system"));

        String jsonRequest = """
                {
                    "name": "Jane Doe",
                    "email": "jane.doe@enterprise.com",
                    "tier": "SILVER"
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonRequest))
                .andExpect(status().isConflict())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://api.enterprise.com/errors/conflict"))
                .andExpect(jsonPath("$.title").value("Resource Conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Email already registered in system"))
                .andExpect(jsonPath("$.timestamp").exists());
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_webmvc_omit_valid',
        name: 'OmitValidAnnotationMutator',
        file: 'src/main/java/com/enterprise/web/controller/CustomerController.java',
        line: 31,
        mutatedContent: `package com.enterprise.web.controller;
import com.enterprise.web.dto.*;
import com.enterprise.web.service.CustomerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
public class CustomerController {
    private final CustomerService customerService;
    public CustomerController(CustomerService cs) { this.customerService = cs; }
    // MUTANT: Removed @Valid annotation! Invalid payloads pass without validation!
    @PostMapping
    public ResponseEntity<CustomerResponse> register(@RequestBody CustomerRegistrationRequest request) {
        CustomerResponse r = customerService.registerCustomer(request);
        return ResponseEntity.created(URI.create("/api/v1/customers/" + r.id())).body(r);
    }
}`
      },
      {
        id: 'mutant_webmvc_wrong_conflict_status',
        name: 'ConflictMappedToBadRequestMutator',
        file: 'src/main/java/com/enterprise/web/controller/GlobalProblemDetailsExceptionHandler.java',
        line: 37,
        mutatedContent: `package com.enterprise.web.controller;
import com.enterprise.web.exception.ResourceConflictException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
public class GlobalProblemDetailsExceptionHandler {
    // MUTANT: Returns 400 Bad Request instead of 409 Conflict!
    public ProblemDetail handleResourceConflict(ResourceConflictException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }
}`
      },
      {
        id: 'mutant_webmvc_wrong_timestamp_field',
        name: 'ProblemDetailTimestampFieldMutator',
        file: 'src/main/java/com/enterprise/web/controller/GlobalProblemDetailsExceptionHandler.java',
        line: 29,
        mutatedContent: `package com.enterprise.web.controller;
import com.enterprise.web.exception.ResourceNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import java.time.Instant;
public class GlobalProblemDetailsExceptionHandler {
    // MUTANT: sets "time" instead of "timestamp" breaking RFC 7807 contract!
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setProperty("time", Instant.now().toString());
        return pd;
    }
}`
      },
      {
        id: 'mutant_webmvc_missing_invalid_params',
        name: 'OmitInvalidParamsMapMutator',
        file: 'src/main/java/com/enterprise/web/controller/GlobalProblemDetailsExceptionHandler.java',
        line: 49,
        mutatedContent: `package com.enterprise.web.controller;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.WebRequest;
public class GlobalProblemDetailsExceptionHandler {
    // MUTANT: Missing invalidParams map property in 400 response!
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed");
        return ResponseEntity.status(status).body(pd);
    }
}`
      },
      {
        id: 'mutant_webmvc_status_code_override',
        name: 'CreatedStatusToOkMutator',
        file: 'src/main/java/com/enterprise/web/controller/CustomerController.java',
        line: 33,
        mutatedContent: `package com.enterprise.web.controller;
import com.enterprise.web.dto.*;
import com.enterprise.web.service.CustomerService;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
public class CustomerController {
    private final CustomerService customerService;
    public CustomerController(CustomerService cs) { this.customerService = cs; }
    // MUTANT: Returns 200 OK without Location header instead of 201 Created!
    @PostMapping
    public ResponseEntity<CustomerResponse> register(@Valid @RequestBody CustomerRegistrationRequest request) {
        CustomerResponse r = customerService.registerCustomer(request);
        return ResponseEntity.ok(r);
    }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Jackson Financial Serializer & PAN Masking (@JsonTest)
  // =========================================================================
  {
    id: 'kata_test_jackson_financial_pan_masking',
    slug: 'kata-test-jackson-financial-pan-masking',
    title: 'KATA-TEST-34: Jackson Financial Serializer & PAN Masking',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '💳 Jackson & PCI-DSS',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Spring Boot 3.4+, @JsonTest, Jackson',
    timeLimitMinutes: 45,
    shortDescription: 'Тестирование сериализации @JsonTest: исключение потери точности IEEE 754 через BigDecimal, банковское HALF_EVEN и маскирование карт по PCI-DSS.',
    instructionsMarkdown: `### 🎯 Инженерная задача
В процессинговых и финансовых сервисах обращение с денежными суммами требует исключения типов данных с плавающей запятой (\`float\`, \`double\`).
- Ограничения двоичного формата IEEE 754 (\`0.1 + 0.2 = 0.30000000000000004\`) приводят к финансовым расхождениям при передаче чисел.
- Денежные величины должны передаваться как \`BigDecimal\` в виде строки с фиксацией \`scale = 2\` и банковским округлением \`RoundingMode.HALF_EVEN\` (округление Гаусса).
- **PCI-DSS Requirement 3.3:** Номер платежной карты (PAN) при сериализации обязан маскироваться с сохранением первых 6 и последних 4 цифр (\`453275******7890\`).

### 🧪 Ваша цель
В \`PaymentTransactionDtoJsonTest.java\` протестируйте через \`@JsonTest\` и \`JacksonTester<PaymentTransactionDto>\`:
1. Банковское округление \`HALF_EVEN\` без потери точности (\`12.505\` $\\to$ \`"12.50"\`, \`12.515\` $\\to$ \`"12.52"\`).
2. Сериализация в виде JSON-строки, защищенной от IEEE 754 Double.
3. Строгое маскирование 16-значных Visa/MasterCard и 15-значных Amex, а также PAN с пробелами и дефисами.
4. Граничные случаи: невалидный PAN (\`"INVALID_PAN"\`), \`null\` PAN и \`null\` amount.

Уничтожьте всех 5 сериализационных мутантов!`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/payment/serializer/FinancialAmountSerializer.java',
        content: `package com.enterprise.payment.serializer;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;

public class FinancialAmountSerializer extends JsonSerializer<BigDecimal> {

    @Override
    public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        if (value == null) {
            gen.writeNull();
            return;
        }
        BigDecimal scaled = value.setScale(2, RoundingMode.HALF_EVEN);
        gen.writeString(scaled.toPlainString());
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/payment/serializer/PanMaskingSerializer.java',
        content: `package com.enterprise.payment.serializer;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;

public class PanMaskingSerializer extends JsonSerializer<String> {

    @Override
    public void serialize(String value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        if (value == null) {
            gen.writeNull();
            return;
        }

        String sanitized = value.replaceAll("[\\\\s-]", "");
        int length = sanitized.length();

        if (length < 13 || length > 19) {
            gen.writeString("INVALID_PAN");
            return;
        }

        String firstSix = sanitized.substring(0, 6);
        String lastFour = sanitized.substring(length - 4);
        String maskedMiddle = "*".repeat(length - 10);

        gen.writeString(firstSix + maskedMiddle + lastFour);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/payment/dto/PaymentTransactionDto.java',
        content: `package com.enterprise.payment.dto;

import com.enterprise.payment.serializer.FinancialAmountSerializer;
import com.enterprise.payment.serializer.PanMaskingSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.util.UUID;

public record PaymentTransactionDto(
        UUID transactionId,

        @JsonSerialize(using = FinancialAmountSerializer.class)
        BigDecimal amount,

        String currency,

        @JsonSerialize(using = PanMaskingSerializer.class)
        String primaryAccountNumber,

        String merchantId
) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/payment/dto/PaymentTransactionDtoJsonTest.java',
        content: `package com.enterprise.payment.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import org.springframework.boot.test.json.JacksonTester;
import org.springframework.boot.test.json.JsonContent;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@JsonTest
class PaymentTransactionDtoJsonTest {

    @Autowired
    private JacksonTester<PaymentTransactionDto> jsonTester;

    @Test
    @DisplayName("Сериализация BigDecimal: гарантированное банковское округление HALF_EVEN без потери точности")
    void shouldSerializeAmountWithBankersRoundingAndNoDoublePrecisionLoss() throws IOException {
        UUID txId = UUID.fromString("11111111-2222-3333-4444-555555555555");

        PaymentTransactionDto txEven = new PaymentTransactionDto(
                txId, new BigDecimal("12.505"), "USD", "4532751234567890", "M-100");
        JsonContent<PaymentTransactionDto> resultEven = jsonTester.write(txEven);

        assertThat(resultEven).extractingJsonPathStringValue("$.amount").isEqualTo("12.50");

        PaymentTransactionDto txOdd = new PaymentTransactionDto(
                txId, new BigDecimal("12.515"), "USD", "4532751234567890", "M-100");
        JsonContent<PaymentTransactionDto> resultOdd = jsonTester.write(txOdd);

        assertThat(resultOdd).extractingJsonPathStringValue("$.amount").isEqualTo("12.52");

        BigDecimal precisionEdgeCase = new BigDecimal("0.1000000000000000055511151231257827021181583404541015625");
        PaymentTransactionDto txPrecision = new PaymentTransactionDto(
                txId, precisionEdgeCase, "USD", "4532751234567890", "M-100");
        JsonContent<PaymentTransactionDto> resultPrecision = jsonTester.write(txPrecision);

        assertThat(resultPrecision).extractingJsonPathStringValue("$.amount").isEqualTo("0.10");
    }

    @Test
    @DisplayName("Сериализация PAN: строгое маскирование номера карты по стандарту PCI-DSS (6+mask+4)")
    void shouldMaskPrimaryAccountNumberAccordingToPciDss() throws IOException {
        UUID txId = UUID.fromString("11111111-2222-3333-4444-555555555555");

        PaymentTransactionDto tx16 = new PaymentTransactionDto(
                txId, new BigDecimal("100.00"), "USD", "4532751234567890", "M-100");
        assertThat(jsonTester.write(tx16))
                .extractingJsonPathStringValue("$.primaryAccountNumber")
                .isEqualTo("453275******7890");

        PaymentTransactionDto txAmex = new PaymentTransactionDto(
                txId, new BigDecimal("100.00"), "USD", "378282246310005", "M-100");
        assertThat(jsonTester.write(txAmex))
                .extractingJsonPathStringValue("$.primaryAccountNumber")
                .isEqualTo("378282*****0005");

        PaymentTransactionDto txDelimiters = new PaymentTransactionDto(
                txId, new BigDecimal("100.00"), "USD", "4532-7512-3456-7890", "M-100");
        assertThat(jsonTester.write(txDelimiters))
                .extractingJsonPathStringValue("$.primaryAccountNumber")
                .isEqualTo("453275******7890");
    }

    @Test
    @DisplayName("Сериализация граничных и некорректных значений PAN")
    void shouldHandleInvalidOrNullPanValues() throws IOException {
        UUID txId = UUID.fromString("11111111-2222-3333-4444-555555555555");

        PaymentTransactionDto txInvalidPan = new PaymentTransactionDto(
                txId, new BigDecimal("50.00"), "USD", "12345", "M-100");
        assertThat(jsonTester.write(txInvalidPan))
                .extractingJsonPathStringValue("$.primaryAccountNumber")
                .isEqualTo("INVALID_PAN");

        PaymentTransactionDto txNullPan = new PaymentTransactionDto(
                txId, new BigDecimal("50.00"), "USD", null, "M-100");
        assertThat(jsonTester.write(txNullPan))
                .hasEmptyJsonPathValue("$.primaryAccountNumber");
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_json_number_loss',
        name: 'JsonNumberDoublePrecisionLossMutator',
        file: 'src/main/java/com/enterprise/payment/serializer/FinancialAmountSerializer.java',
        line: 18,
        mutatedContent: `package com.enterprise.payment.serializer;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException; import java.math.BigDecimal; import java.math.RoundingMode;
public class FinancialAmountSerializer extends JsonSerializer<BigDecimal> {
    public void serialize(BigDecimal v, JsonGenerator gen, SerializerProvider s) throws IOException {
        if (v == null) { gen.writeNull(); return; }
        // MUTANT: Writes raw double number instead of string, introducing IEEE 754 precision loss!
        gen.writeNumber(v.setScale(2, RoundingMode.HALF_EVEN).doubleValue());
    }
}`
      },
      {
        id: 'mutant_json_half_up',
        name: 'RoundingModeHalfUpMutator',
        file: 'src/main/java/com/enterprise/payment/serializer/FinancialAmountSerializer.java',
        line: 17,
        mutatedContent: `package com.enterprise.payment.serializer;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException; import java.math.BigDecimal; import java.math.RoundingMode;
public class FinancialAmountSerializer extends JsonSerializer<BigDecimal> {
    public void serialize(BigDecimal v, JsonGenerator gen, SerializerProvider s) throws IOException {
        if (v == null) { gen.writeNull(); return; }
        // MUTANT: HALF_UP instead of Bankers Rounding HALF_EVEN!
        BigDecimal scaled = v.setScale(2, RoundingMode.HALF_UP);
        gen.writeString(scaled.toPlainString());
    }
}`
      },
      {
        id: 'mutant_json_pan_off_by_one',
        name: 'PanMaskingOffByOneMutator',
        file: 'src/main/java/com/enterprise/payment/serializer/PanMaskingSerializer.java',
        line: 27,
        mutatedContent: `package com.enterprise.payment.serializer;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException;
public class PanMaskingSerializer extends JsonSerializer<String> {
    public void serialize(String value, JsonGenerator gen, SerializerProvider s) throws IOException {
        if (value == null) { gen.writeNull(); return; }
        String sanitized = value.replaceAll("[\\\\s-]", "");
        int length = sanitized.length();
        if (length < 13 || length > 19) { gen.writeString("INVALID_PAN"); return; }
        String firstSix = sanitized.substring(0, 6);
        // MUTANT: leaves 5 digits unmasked (off-by-one error violating PCI-DSS)!
        String lastFive = sanitized.substring(length - 5);
        String maskedMiddle = "*".repeat(length - 11);
        gen.writeString(firstSix + maskedMiddle + lastFive);
    }
}`
      },
      {
        id: 'mutant_json_null_npe',
        name: 'FinancialAmountNullPointerMutator',
        file: 'src/main/java/com/enterprise/payment/serializer/FinancialAmountSerializer.java',
        line: 14,
        mutatedContent: `package com.enterprise.payment.serializer;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException; import java.math.BigDecimal; import java.math.RoundingMode;
public class FinancialAmountSerializer extends JsonSerializer<BigDecimal> {
    public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider s) throws IOException {
        // MUTANT: Null check removed! Throws NullPointerException when value is null!
        BigDecimal scaled = value.setScale(2, RoundingMode.HALF_EVEN);
        gen.writeString(scaled.toPlainString());
    }
}`
      },
      {
        id: 'mutant_json_skip_sanitization',
        name: 'PanSkipSanitizationMutator',
        file: 'src/main/java/com/enterprise/payment/serializer/PanMaskingSerializer.java',
        line: 14,
        mutatedContent: `package com.enterprise.payment.serializer;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import java.io.IOException;
public class PanMaskingSerializer extends JsonSerializer<String> {
    public void serialize(String value, JsonGenerator gen, SerializerProvider s) throws IOException {
        if (value == null) { gen.writeNull(); return; }
        // MUTANT: Skips delimiter sanitization! Formatting characters corrupt length and masking!
        String sanitized = value;
        int length = sanitized.length();
        if (length < 13 || length > 19) { gen.writeString("INVALID_PAN"); return; }
        String firstSix = sanitized.substring(0, 6);
        String lastFour = sanitized.substring(length - 4);
        String maskedMiddle = "*".repeat(length - 10);
        gen.writeString(firstSix + maskedMiddle + lastFour);
    }
}`
      }
    ]
  }
];
