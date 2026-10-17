# Архитектурный рефакторинг уровня Staff и Principal (L3): декомпозиция монолитов, гексагональная архитектура и миграция корпоративного легаси на стек Java 21 и Spring Boot 3.4+
Проектирование и проведение технических интервью на уровни Staff Software Engineer, Principal Architect и Tech Lead (L3 / L7–L8) требует принципиально иного инструментария оценки, нежели алгоритмические задачи или базовый системный дизайн. На этом уровне инженерная зрелость определяется способностью безопасно трансформировать критически важные корпоративные подсистемы с размытыми границами контекстов, монолитным сцеплением на уровне базы данных и устаревшими инфраструктурными фреймворками в слабосвязанную, предметно-ориентированную (DDD) архитектуру без нарушения жестких соглашений об уровне обслуживания (SLA).
Настоящий аналитический отчет синтезирует восемь эталонных архитектурных ката (refactoring katas) высокой сложности, разделенных на четыре фундаментальных архетипа: переход от связного монолита к гексагональной архитектуре (Ports & Adapters), устранение рассинхронизации двойной записи (Dual-Write) через паттерн Transactional Outbox и CDC, миграция корпоративных шлюзов со Spring Boot 2.7 на Spring Boot 3.4+ и виртуальные потоки Java 21, а также построение антикоррупционных слоев (Anti-Corruption Layer, ACL) при интеграции с унаследованными мейнфреймами и внешними провайдерами.

| Код и каноническое название ката | Архетип трансформации | Ключевые уязвимости исходной системы | Целевой паттерн и стек (Java 21 / Spring Boot 3.4+) | Инженерный фокус оценки (Bar-Raiser Сигналы) |
| --- | --- | --- | --- | --- |
| **[L3-REF-01]** `OrderProcessingHexagonalDecoupling` | Архетип 3.1: Декомпозиция монолита в гексагональную архитектуру | Прямое сцепление домена с `HttpServletRequest`, JPA, Jackson, сырым SQL и AWS S3 SDK | Чистое ядро (Java 21 Records), входящие/исходящие порты, адаптеры Spring Web и JPA, защита ArchUnit | Инверсия зависимостей, стоимость двойного маппинга сущностей, `FreezingArchRule`[cite: 5, 9] |
| **[L3-REF-02]** `CustomerSubscriptionPortsAndAdapters` | Архетип 3.1: Декомпозиция монолита в гексагональную архитектуру | Зависимость бизнес-правил от `SecurityContext`, нативных запросов `EntityManager` и `JavaMailSender`[cite: 1, 10] | Sealed-интерфейсы состояний подписки, изоляция Use Case, тестирование через In-Memory Fake-адаптеры | Социабельные модульные тесты против мокирования, границы `@Transactional`[cite: 5, 12] |
| **[L3-REF-03]** `DualWritePaymentNotifierRefactoring` | Архетип 3.2: Устранение Dual-Write через Transactional Outbox | Неатомарный вызов `repository.save()` и `kafkaTemplate.send()` внутри одной транзакции БД | Локальная таблица Outbox, поллинг через `SELECT ... FOR UPDATE SKIP LOCKED`, конечный автомат коротких транзакций | Предотвращение удерживания блокировок при сетевом I/O, упорядочивание через advisory locks |
| **[L3-REF-04]** `OrderPlacementOutboxMigration` | Архетип 3.2: Событийная декомпозиция и CDC Outbox | Синхронная отправка «God Events» в несколько топиков Kafka, блокировки пула соединений HikariCP | Доменные события агрегата, таблица под Debezium Event Router SMT, идемпотентный Consumer Inbox | Поллинг БД против чтения WAL через Debezium CDC, очистка таблицы Outbox, идемпотентность |
| **[L3-REF-05]** `LegacySpring2EnterpriseGatewayMigration` | Архетип 3.3: Миграция легаси Spring Boot 2.7 на 3.4+ и Java 21 | Пакеты `javax.*`, устаревший `RestTemplate` на HttpClient 4, пиннинг виртуальных потоков в `synchronized`, рефлексия | Переход на `jakarta.*`, `RestClient` со `SslBundles`, замена `synchronized` на `ReentrantLock`, Records + Pattern Matching | Механика пиннинга платформенных потоков в JDK 21 (и JEP 491), диагностика через JFR |
| **[L3-REF-06]** `LegacyBankingSecurityMigration` | Архетип 3.3: Модернизация контура безопасности и HTTP-шлюза | Синхронная криптография и маскирование PII в потоке запроса, блокировки на `Cipher`, кастомные ошибки | Асинхронный движок крипто-редактирования PII, стандарт ошибок RFC 9457 (`ProblemDetail`), Graceful Shutdown | Соблюдение задержки `<2ms p99` при аудите безопасности, бюджеты остановки подов в Kubernetes |
| **[L3-REF-07]** `CoreBankingLegacyConnectorACL` | Архетип 3.4: Антикоррупционный слой (ACL) для мейнфрейма | Протекание криптографических полей COBOL/SOAP (`CUST_STAT_CD_01`, юлианских дат) в доменную модель | Выделенный ACL-фасад, трансляторы и адаптеры, чистые доменные объекты-значения (Value Objects) | Снижение коэффициента влияния изменений (CIF `-0.599`) против накладных расходов на трансляцию |
| **[L3-REF-08]** `ThirdPartyLogisticsTranslator` | Архетип 3.4: Полиглотный ACL и защита инвариантов агрегата | Мутация сущностей доставки напрямую из вебхуков внешних 3PL-провайдеров, регрессия статусов при дублях | Входящий/исходящий ACL-транслятор, монотонная машина состояний агрегата, оптимистическая блокировка `@Version`[cite: 4] | Естественная идемпотентность доменной модели против дедупликационных таблиц, контекстное картирование DDD |

## Архетип 3.1: Декомпозиция монолита в гексагональную архитектуру (Ports & Adapters)
Традиционная многослойная архитектура, повсеместно воспроизводимая в базовых руководствах по Spring Boot, организует систему в горизонтальные слои (контроллеры, сервисы, репозитории), где вектор зависимостей направлен строго сверху вниз — от представления к базе данных. В крупных корпоративных системах такой подход неизбежно приводит к эрозии границ: бизнес-логика оказывается пронизанной деталями персистентности (аннотации JPA/Hibernate, особенности ленивой загрузки), деталями транспортного протокола (`HttpServletRequest`, аннотации Jackson) и прямыми вызовами внешних SDK. Гексагональная архитектура (Порты и Адаптеры), сформулированная Алистером Кокберном, инвертирует эти зависимости, помещая чистое доменное ядро в центр системы и позволяя приложению одинаково управляться пользователями, внешними программами, пакетными скриптами или автоматизированными тестами в полной изоляции от баз данных и периферийных устройств времени выполнения.
Критическим следствием второго порядка при переходе к гексагональной архитектуре является трансформация стратегии тестирования и верификации архитектуры. В связанном монолите проверка бизнес-сценариев вынуждает инженеров либо поднимать тяжеловесный контекст Spring с базой данных для каждого приемочного теста, либо создавать хрупкие каскады моков (Mockito), жестко привязанные к внутренним вызовам ORM. Инверсия зависимостей через порты позволяет перенести центр тяжести на быстрые социабельные модульные тесты (sociable unit tests), работающие поверх легковесных In-Memory стабов вторичных портов, без использования фреймворков мокирования. В то же время, поскольку модульная система пакетов Java сама по себе не способна полностью предотвратить случайный импорт инфраструктурного класса (например, через полное квалифицированное имя без директивы `import`), архитектурные правила быстро деградируют, если полагаться только на документацию или код-ревью. Поэтому обязательным элементом рефакторинга уровня Staff/Principal выступает механическая фиксация границ с помощью байткод-анализатора ArchUnit, а на живых легаси-кодовых базах — применение механизма `FreezingArchRule`, который фиксирует существующие нарушения и блокирует сборку только при появлении новых регрессий.

### Kata 1: [L3-REF-01] OrderProcessingHexagonalDecoupling — Декомпозиция монолитного ядра обработки заказов в гексагональную архитектуру

#### 1. Title & Grade
**[L3-REF-01] OrderProcessingHexagonalDecoupling** — Декомпозиция монолитного ядра обработки заказов в гексагональную архитектуру (Ports & Adapters). Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Данный сценарий регулярно используется на архитектурных секциях в **Ozon Core Architecture** (платформа оформления и маршрутизации заказов), **Stripe Core** (ядро биллинговых операций) и **Yandex Market**. Интервьюер оценивает способность кандидата разрезать спагетти-зависимости в центральном сервисе электронной коммерции, где сущность БД одновременно служит DTO ответа, бизнес-правила читают заголовки напрямую из `HttpServletRequest`, а сохранение состояния перемешано с прямыми SQL-запросами и вызовами облачного хранилища AWS S3.

#### 3. The Legacy Code (150–250 lines)
Ниже представлен компилируемый многоклассовый фрагмент унаследованной подсистемы обработки заказов, демонстрирующий глубокое проникновение инфраструктурных деталей в бизнес-логику.

```java
package com.enterprise.legacy.order;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class LegacyOrderEntity {

    @Id
    @JsonProperty("order_id")
    private String id;

    @Column(name = "customer_id", nullable = false)
    @JsonProperty("customer_id")
    private String customerId;

    @Column(name = "client_ip")
    @JsonIgnore
    private String clientIp;

    @Column(name = "vip_tier")
    private boolean vipTier;

    @Column(name = "total_amount", precision = 19, scale = 4)
    @JsonProperty("total_amount")
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "status")
    private String status;

    @Column(name = "invoice_s3_url")
    @JsonProperty("invoice_url")
    private String invoiceS3Url;

    @Column(name = "created_at")
    private Instant createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "order_lines", joinColumns = @JoinColumn(name = "order_id"))
    @JsonProperty("items")
    private List<LegacyOrderLineEmbeddable> items = new ArrayList<>();

    @PrePersist
    public void onPrePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        this.createdAt = Instant.now();
        if (this.status == null) {
            this.status = "CREATED";
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public String getClientIp() { return clientIp; }
    public void setClientIp(String clientIp) { this.clientIp = clientIp; }
    public boolean isVipTier() { return vipTier; }
    public void setVipTier(boolean vipTier) { this.vipTier = vipTier; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getInvoiceS3Url() { return invoiceS3Url; }
    public void setInvoiceS3Url(String invoiceS3Url) { this.invoiceS3Url = invoiceS3Url; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public List<LegacyOrderLineEmbeddable> getItems() { return items; }
    public void setItems(List<LegacyOrderLineEmbeddable> items) { this.items = items; }
}

@Embeddable
class LegacyOrderLineEmbeddable {
    @Column(name = "sku")
    @JsonProperty("sku")
    private String sku;

    @Column(name = "quantity")
    @JsonProperty("qty")
    private int quantity;

    @Column(name = "unit_price")
    @JsonProperty("price")
    private BigDecimal unitPrice;

    public LegacyOrderLineEmbeddable() {}

    public LegacyOrderLineEmbeddable(String sku, int quantity, BigDecimal unitPrice) {
        this.sku = sku;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
}

interface LegacyOrderJpaRepository extends JpaRepository<LegacyOrderEntity, String> {
}

class LegacyAwsS3SdkClient {
    public String putObject(String bucket, String key, byte[] content, String contentType) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalArgumentException("Bucket name cannot be empty");
        }
        return "https://" + bucket + ".s3.amazonaws.com/" + key;
    }
}

@Service
class LegacyOrderCoreService {

    @Autowired
    private LegacyOrderJpaRepository orderRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final LegacyAwsS3SdkClient s3Client = new LegacyAwsS3SdkClient();

    @Transactional
    public LegacyOrderEntity checkoutOrder(LegacyOrderEntity orderEntity, HttpServletRequest servletRequest) {
        String forwardedFor = servletRequest.getHeader("X-Forwarded-For");
        String remoteIp = (forwardedFor != null && !forwardedFor.isBlank())
                ? forwardedFor.split(",")[0].trim()
                : servletRequest.getRemoteAddr();
        orderEntity.setClientIp(remoteIp);

        String vipHeader = servletRequest.getHeader("X-Customer-Vip");
        boolean isVip = "true".equalsIgnoreCase(vipHeader);
        orderEntity.setVipTier(isVip);

        if (orderEntity.getItems() == null || orderEntity.getItems().isEmpty()) {
            throw new IllegalStateException("Order must contain at least one item");
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (LegacyOrderLineEmbeddable line : orderEntity.getItems()) {
            if (line.getQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity must be positive for SKU: " + line.getSku());
            }
            Integer availableStock = jdbcTemplate.queryForObject(
                    "SELECT stock_count FROM warehouse_inventory WHERE sku = ?",
                    Integer.class,
                    line.getSku()
            );
            if (availableStock == null || availableStock < line.getQuantity()) {
                throw new IllegalStateException("Insufficient stock for SKU: " + line.getSku());
            }
            jdbcTemplate.update(
                    "UPDATE warehouse_inventory SET stock_count = stock_count - ? WHERE sku = ?",
                    line.getQuantity(),
                    line.getSku()
            );
            BigDecimal lineCost = line.getUnitPrice().multiply(BigDecimal.valueOf(line.getQuantity()));
            subtotal = subtotal.add(lineCost);
        }

        if (isVip && subtotal.compareTo(BigDecimal.valueOf(1000)) > 0) {
            subtotal = subtotal.multiply(BigDecimal.valueOf(0.90)).setScale(2, RoundingMode.HALF_UP);
        } else {
            subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        }

        orderEntity.setTotalAmount(subtotal);
        orderEntity.setStatus("CONFIRMED");
        if (orderEntity.getId() == null) {
            orderEntity.setId(UUID.randomUUID().toString());
        }

        String invoicePayload = "INVOICE|ORDER:" + orderEntity.getId()
                + "|CUSTOMER:" + orderEntity.getCustomerId()
                + "|TOTAL:" + orderEntity.getTotalAmount();
        String s3Url = s3Client.putObject(
                "corp-production-invoices",
                "invoices/" + orderEntity.getId() + ".txt",
                invoicePayload.getBytes(StandardCharsets.UTF_8),
                "text/plain"
        );
        orderEntity.setInvoiceS3Url(s3Url);

        return orderRepository.save(orderEntity);
    }
}

@RestController
@RequestMapping("/api/v1/legacy-orders")
class LegacyOrderRestController {

    @Autowired
    private LegacyOrderCoreService orderService;

    @PostMapping
    public ResponseEntity<LegacyOrderEntity> createOrder(
            @RequestBody LegacyOrderEntity payload,
            HttpServletRequest request) {
        LegacyOrderEntity saved = orderService.checkoutOrder(payload, request);
        return ResponseEntity.ok(saved);
    }
}

```

#### 4. Architectural Smells & Systemic Risks
Анализ представленного монолитного класса выявляет критическую концентрацию архитектурных антипаттернов, блокирующих горизонтальное масштабирование и эволюцию продукта. Прежде всего наблюдается прямое протекание транспортного уровня в доменную логику (Transport Layer Leakage): метод `checkoutOrder` принимает `HttpServletRequest` напрямую и извлекает заголовки `X-Forwarded-For` и `X-Customer-Vip` внутри транзакционного бизнес-метода. Это нарушает фундаментальный принцип гексагональной архитектуры, согласно которому бизнес-ядро должно быть инвариантно к источнику вызова — будь то REST API, gRPC, Kafka-консьюмер или консольный планировщик.
Вторым фундаментальным дефектом выступает слияние моделей персистентности, представления и домена (Anemic & Coupled Entity). Класс `LegacyOrderEntity` одновременно размечен аннотациями `@Entity`/`@Table` (Jakarta Persistence) и `@JsonProperty`/`@JsonIgnore` (Jackson), при этом часть инициализации состояния скрыта в колбэке жизненного цикла ORM `@PrePersist`. Любое изменение схемы таблиц автоматически ломает внешний JSON-контракт API, а открытые мутабельные сеттеры позволяют внешнему коду перевести заказ в невалидное состояние в обход бизнес-инвариантов.
Еще более опасный эксплуатационный риск порождается выполнением сетевого ввода-вывода внутри открытой транзакции базы данных (I/O Inside Database Transaction). Вызов `s3Client.putObject(...)` выполняется синхронно внутри метода, размеченного `@Transactional`, после того как `jdbcTemplate.update(...)` уже наложил эксклюзивные строковые блокировки (`ROW EXCLUSIVE`) на записи таблицы `warehouse_inventory`. При деградации сети или троттлинге AWS S3 соединение из пула HikariCP и строковые блокировки в БД удерживаются на все время сетевого таймаута, что при высокой нагрузке мгновенно вызывает исчерпание пула соединений (Connection Pool Starvation) и каскадный отказ всей подсистемы оформления заказов. Наконец, наличие жестко зашитого поля `new LegacyAwsS3SdkClient()`, внедрения полей через `@Autowired` (Field Injection) и прямых SQL-запросов через `JdbcTemplate` делает невозможным тестирование правил расчета VIP-скидки без поднятия контейнера сервлетов и реляционной базы данных.

#### 5. Characterization Harness
Перед проведением структурного рефакторинга создается характеризационный тестовый контур (Characterization Harness), который фиксирует бизнес-инварианты (расчет стоимости позиций, условие 10%-ной VIP-скидки при сумме свыше 1000, резервирование стока, генерацию документа счета) через социабельные тесты без моков, а также вводит жесткие архитектурные правила ArchUnit для контроля чистоты пакетов.

```java
package com.enterprise.order.VerificationHarnessTest;

import com.enterprise.order.application.port.in.PlaceOrderCommand;
import com.enterprise.order.application.port.in.PlaceOrderUseCase;
import com.enterprise.order.application.port.out.InventoryReservationPort;
import com.enterprise.order.application.port.out.InvoiceStoragePort;
import com.enterprise.order.application.port.out.OrderRepositoryPort;
import com.enterprise.order.application.service.PlaceOrderApplicationService;
import com.enterprise.order.domain.model.*;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static org.junit.jupiter.api.Assertions.*;

public class OrderHexagonalCharacterizationTest {

    private InMemoryOrderRepositoryStub orderRepositoryStub;
    private InMemoryInventoryStub inventoryStub;
    private InMemoryInvoiceStorageStub invoiceStorageStub;
    private PlaceOrderUseCase placeOrderUseCase;

    @BeforeEach
    void setUp() {
        orderRepositoryStub = new InMemoryOrderRepositoryStub();
        inventoryStub = new InMemoryInventoryStub();
        invoiceStorageStub = new InMemoryInvoiceStorageStub();
        placeOrderUseCase = new PlaceOrderApplicationService(
                orderRepositoryStub, inventoryStub, invoiceStorageStub
        );
    }

    @Test
    @DisplayName("VIP-клиент получает скидку 10% при сумме заказа свыше 1000 и сток корректно списывается")
    void shouldApplyVipDiscountAndReserveStockAndStoreInvoice() {
        inventoryStub.seedStock("SKU-PRO-1", 10);
        inventoryStub.seedStock("SKU-ACC-2", 5);

        PlaceOrderCommand command = new PlaceOrderCommand(
                new CustomerId("CUST-99"),
                "203.0.113.15",
                true,
                List.of(
                        new OrderLineItem("SKU-PRO-1", 2, new BigDecimal("600.00")),
                        new OrderLineItem("SKU-ACC-2", 1, new BigDecimal("100.00"))
                )
        );

        Order placedOrder = placeOrderUseCase.placeOrder(command);

        assertEquals(new BigDecimal("1170.00"), placedOrder.totalAmount());
        assertEquals(OrderStatus.CONFIRMED, placedOrder.status());
        assertEquals(8, inventoryStub.getRemainingStock("SKU-PRO-1"));
        assertEquals(4, inventoryStub.getRemainingStock("SKU-ACC-2"));
        assertTrue(placedOrder.invoiceUrl().startsWith("https://corp-production-invoices.s3.amazonaws.com/invoices/"));
        assertTrue(orderRepositoryStub.findById(placedOrder.id()).isPresent());
    }

    @Test
    @DisplayName("ArchUnit: Доменное ядро не должно зависеть от Spring, JPA, Jackson или Servlet API")
    void domainShouldBeCompletelyIsolatedFromFrameworks() {
        JavaClasses importedClasses = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages("com.enterprise.order");

        ArchRule pureDomainRule = noClasses()
                .that().resideInAPackage("..domain..")
                .should().dependOnClassesThat()
                .resideInAnyPackage(
                        "org.springframework..",
                        "jakarta.persistence..",
                        "jakarta.servlet..",
                        "com.fasterxml.jackson..",
                        "..adapter.."
                );

        ArchRule hexagonalLayersRule = layeredArchitecture()
                .consideringOnlyDependenciesInLayers()
                .layer("Domain").definedBy("..domain..")
                .layer("Application").definedBy("..application..")
                .layer("Adapter").definedBy("..adapter..")
                .whereLayer("Domain").mayNotAccessAnyLayer()
                .whereLayer("Application").mayOnlyAccessLayers("Domain")
                .whereLayer("Adapter").mayOnlyAccessLayers("Application", "Domain");

        pureDomainRule.check(importedClasses);
        hexagonalLayersRule.check(importedClasses);
    }

    static class InMemoryOrderRepositoryStub implements OrderRepositoryPort {
        private final Map<OrderId, Order> storage = new HashMap<>();
        @Override
        public Order save(Order order) {
            storage.put(order.id(), order);
            return order;
        }
        public Optional<Order> findById(OrderId id) { return Optional.ofNullable(storage.get(id)); }
    }

    static class InMemoryInventoryStub implements InventoryReservationPort {
        private final Map<String, Integer> stock = new HashMap<>();
        void seedStock(String sku, int count) { stock.put(sku, count); }
        int getRemainingStock(String sku) { return stock.getOrDefault(sku, 0); }
        @Override
        public void reserveStock(String sku, int quantity) {
            int current = stock.getOrDefault(sku, 0);
            if (current < quantity) {
                throw new IllegalStateException("Insufficient stock for SKU: " + sku);
            }
            stock.put(sku, current - quantity);
        }
    }

    static class InMemoryInvoiceStorageStub implements InvoiceStoragePort {
        @Override
        public String uploadInvoice(OrderId orderId, String content) {
            return "https://corp-production-invoices.s3.amazonaws.com/invoices/" + orderId.value() + ".txt";
        }
    }
}

```

#### 6. Refactored Architecture
Целевая архитектура разделена на три строго изолированных кольца: чистое доменное ядро (`domain.model`), прикладной уровень портов и сценариев использования (`application.port.in`, `application.port.out`, `application.service`) и периферийные инфраструктурные адаптеры (`adapter.in.web`, `adapter.out.persistence`, `adapter.out.storage`). Доменные объекты реализованы через неизменяемые Java 21 `record` с проверкой инвариантов в компактных конструкторах, а сетевая загрузка счета в S3 вынесена за пределы короткой транзакции БД.

```java
// --- ПАКЕТ: com.enterprise.order.domain.model ---
package com.enterprise.order.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record OrderId(String value) {
    public OrderId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("OrderId cannot be blank");
        }
    }
    public static OrderId generate() {
        return new OrderId(UUID.randomUUID().toString());
    }
}

public record CustomerId(String value) {
    public CustomerId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("CustomerId cannot be blank");
        }
    }
}

public enum OrderStatus {
    CONFIRMED, FAILED
}

public record OrderLineItem(String sku, int quantity, BigDecimal unitPrice) {
    public OrderLineItem {
        if (sku == null || sku.isBlank()) {
            throw new IllegalArgumentException("SKU cannot be blank");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive for SKU: " + sku);
        }
        if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Unit price cannot be negative");
        }
    }

    public BigDecimal lineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}

public record Order(
        OrderId id,
        CustomerId customerId,
        String clientIp,
        boolean vipTier,
        List<OrderLineItem> items,
        BigDecimal totalAmount,
        OrderStatus status,
        String invoiceUrl,
        Instant createdAt
) {
    private static final BigDecimal VIP_THRESHOLD = BigDecimal.valueOf(1000);
    private static final BigDecimal VIP_MULTIPLIER = new BigDecimal("0.90");

    public Order {
        Objects.requireNonNull(id, "id is required");
        Objects.requireNonNull(customerId, "customerId is required");
        if (items == null || items.isEmpty()) {
            throw new IllegalStateException("Order must contain at least one item");
        }
        items = List.copyOf(items);
    }

    public static Order createConfirmed(
            OrderId id,
            CustomerId customerId,
            String clientIp,
            boolean vipTier,
            List<OrderLineItem> items,
            String invoiceUrl,
            Instant now
    ) {
        BigDecimal rawTotal = items.stream()
                .map(OrderLineItem::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal finalTotal = (vipTier && rawTotal.compareTo(VIP_THRESHOLD) > 0)
                ? rawTotal.multiply(VIP_MULTIPLIER).setScale(2, RoundingMode.HALF_UP)
                : rawTotal.setScale(2, RoundingMode.HALF_UP);

        return new Order(id, customerId, clientIp, vipTier, items, finalTotal, OrderStatus.CONFIRMED, invoiceUrl, now);
    }

    public String renderInvoicePayload() {
        return "INVOICE|ORDER:" + id.value() + "|CUSTOMER:" + customerId.value() + "|TOTAL:" + totalAmount;
    }
}

// --- ПАКЕТ: com.enterprise.order.application.port.in ---
package com.enterprise.order.application.port.in;

import com.enterprise.order.domain.model.CustomerId;
import com.enterprise.order.domain.model.Order;
import com.enterprise.order.domain.model.OrderLineItem;
import java.util.List;

public record PlaceOrderCommand(
        CustomerId customerId,
        String clientIp,
        boolean vipTier,
        List<OrderLineItem> items
) {}

public interface PlaceOrderUseCase {
    Order placeOrder(PlaceOrderCommand command);
}

// --- ПАКЕТ: com.enterprise.order.application.port.out ---
package com.enterprise.order.application.port.out;

import com.enterprise.order.domain.model.Order;
import com.enterprise.order.domain.model.OrderId;

public interface OrderRepositoryPort {
    Order save(Order order);
}

public interface InventoryReservationPort {
    void reserveStock(String sku, int quantity);
}

public interface InvoiceStoragePort {
    String uploadInvoice(OrderId orderId, String content);
}

// --- ПАКЕТ: com.enterprise.order.application.service ---
package com.enterprise.order.application.service;

import com.enterprise.order.application.port.in.PlaceOrderCommand;
import com.enterprise.order.application.port.in.PlaceOrderUseCase;
import com.enterprise.order.application.port.out.InventoryReservationPort;
import com.enterprise.order.application.port.out.InvoiceStoragePort;
import com.enterprise.order.application.port.out.OrderRepositoryPort;
import com.enterprise.order.domain.model.Order;
import com.enterprise.order.domain.model.OrderId;
import com.enterprise.order.domain.model.OrderLineItem;

import java.time.Instant;

public class PlaceOrderApplicationService implements PlaceOrderUseCase {

    private final OrderRepositoryPort orderRepository;
    private final InventoryReservationPort inventoryReservation;
    private final InvoiceStoragePort invoiceStorage;

    public PlaceOrderApplicationService(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservation,
            InvoiceStoragePort invoiceStorage) {
        this.orderRepository = orderRepository;
        this.inventoryReservation = inventoryReservation;
        this.invoiceStorage = invoiceStorage;
    }

    @Override
    public Order placeOrder(PlaceOrderCommand command) {
        OrderId orderId = OrderId.generate();
        Order draftOrder = Order.createConfirmed(
                orderId,
                command.customerId(),
                command.clientIp(),
                command.vipTier(),
                command.items(),
                "",
                Instant.now()
        );

        String uploadedUrl = invoiceStorage.uploadInvoice(orderId, draftOrder.renderInvoicePayload());

        for (OrderLineItem item : command.items()) {
            inventoryReservation.reserveStock(item.sku(), item.quantity());
        }

        Order confirmedOrder = new Order(
                draftOrder.id(),
                draftOrder.customerId(),
                draftOrder.clientIp(),
                draftOrder.vipTier(),
                draftOrder.items(),
                draftOrder.totalAmount(),
                draftOrder.status(),
                uploadedUrl,
                draftOrder.createdAt()
        );

        return orderRepository.save(confirmedOrder);
    }
}

// --- ПАКЕТ: com.enterprise.order.adapter.in.web ---
package com.enterprise.order.adapter.in.web;

import com.enterprise.order.application.port.in.PlaceOrderCommand;
import com.enterprise.order.application.port.in.PlaceOrderUseCase;
import com.enterprise.order.domain.model.CustomerId;
import com.enterprise.order.domain.model.Order;
import com.enterprise.order.domain.model.OrderLineItem;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderWebController {

    private final PlaceOrderUseCase placeOrderUseCase;

    public OrderWebController(PlaceOrderUseCase placeOrderUseCase) {
        this.placeOrderUseCase = placeOrderUseCase;
    }

    public record OrderItemRequestDto(String sku, int qty, BigDecimal price) {}
    public record CreateOrderRequestDto(String customerId, List<OrderItemRequestDto> items) {}
    public record OrderResponseDto(String orderId, String customerId, BigDecimal totalAmount, String status, String invoiceUrl) {
        static OrderResponseDto fromDomain(Order order) {
            return new OrderResponseDto(
                    order.id().value(),
                    order.customerId().value(),
                    order.totalAmount(),
                    order.status().name(),
                    order.invoiceUrl()
            );
        }
    }

    @PostMapping
    public ResponseEntity<OrderResponseDto> createOrder(
            @RequestBody CreateOrderRequestDto requestDto,
            HttpServletRequest servletRequest) {
        String forwardedFor = servletRequest.getHeader("X-Forwarded-For");
        String clientIp = (forwardedFor != null && !forwardedFor.isBlank())
                ? forwardedFor.split(",")[0].trim()
                : servletRequest.getRemoteAddr();
        boolean vipTier = "true".equalsIgnoreCase(servletRequest.getHeader("X-Customer-Vip"));

        List<OrderLineItem> domainItems = requestDto.items().stream()
                .map(i -> new OrderLineItem(i.sku(), i.qty(), i.price()))
                .toList();

        Order placed = placeOrderUseCase.placeOrder(
                new PlaceOrderCommand(new CustomerId(requestDto.customerId()), clientIp, vipTier, domainItems)
        );
        return ResponseEntity.ok(OrderResponseDto.fromDomain(placed));
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
На уровне Staff/Principal защита этого архитектурного решения фокусируется на анализе накладных расходов двойного маппинга (Two-Way Mapping Overhead) и стратегии поэтапного внедрения архитектурных проверок в живой монолит. Разделение доменной модели `Order` (Java 21 Record), транспортного DTO (`CreateOrderRequestDto`/`OrderResponseDto`) и JPA-сущности (`OrderJpaEntity`) требует написания мапперов на границах адаптеров и создает краткоживущие объекты в куче. Для тривиальных CRUD-сервисов без бизнес-инвариантов это избыточно, однако в ядре обработки заказов такое разделение полностью окупается: неизменяемые `record`-объекты эффективно аллоцируются в молодом поколении (Eden Space) сборщиков мусора ZGC и G1, исключают побочные эффекты механизма dirty-checking в Hibernate и позволяют менять структуру хранения БД без риска сломать публичное API.
Второй важный компромисс касается внедрения ArchUnit в существующий монолит. В унаследованной кодовой базе на сотни тысяч строк кода одномоментное включение правила `layeredArchitecture()` в конвейер CI/CD приведет к сотням ошибок сборки, и команда просто закомментирует падающий тест. Инженерная стратегия уровня Staff заключается в оборачивании правила в `FreezingArchRule.freeze(...)`, который сохраняет текущие нарушения в версионируемый текстовый стоп-лист и блокирует слияние пулл-реквестов только при появлении *новых* нарушений, обеспечивая монотонное сокращение технического долга.

### Kata 2: [L3-REF-02] CustomerSubscriptionPortsAndAdapters — Изоляция доменной логики биллинга подписок от инфраструктурных фреймворков

#### 1. Title & Grade
**[L3-REF-02] CustomerSubscriptionPortsAndAdapters** — Изоляция доменной логики продления подписок от Spring Security, нативного SQL и почтовых протоколов. Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача основана на реальных кейсах рефакторинга биллинговых ядер **Yandex Plus**, **Stripe Billing** и облачных SaaS-платформ. Основная проблема легаси-системы заключается в том, что продление подписки (re-billing) было изначально написано для вызова из пользовательского UI-контроллера (с чтением `SecurityContextHolder`), но по мере роста бизнеса тот же сценарий потребовалось запускать из ночного пакетного планировщика, кафка-консьюмера вебхуков и административной консоли поддержки.

#### 3. The Legacy Code (150–250 lines)
Ниже представлен компилируемый фрагмент легаси-системы управления подписками, где доменная логика переплетена с `EntityManager`, `SecurityContextHolder`, `JavaMailSender` и `Environment`.

```java
package com.enterprise.legacy.subscription;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "customer_subscriptions")
public class LegacySubscriptionEntity {

    @Id
    @JsonProperty("sub_id")
    private String subscriptionId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "plan_code", nullable = false)
    private String planCode;

    @Column(name = "state", nullable = false)
    private String state; // TRIAL, ACTIVE, PAST_DUE, CANCELLED

    @Column(name = "failed_attempts")
    private int failedAttempts;

    @Column(name = "monthly_fee", precision = 12, scale = 2)
    private BigDecimal monthlyFee;

    @Column(name = "next_billing_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate nextBillingDate;

    @Column(name = "last_modified_by")
    private String lastModifiedBy;

    public String getSubscriptionId() { return subscriptionId; }
    public void setSubscriptionId(String subscriptionId) { this.subscriptionId = subscriptionId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
    public BigDecimal getMonthlyFee() { return monthlyFee; }
    public void setMonthlyFee(BigDecimal monthlyFee) { this.monthlyFee = monthlyFee; }
    public LocalDate getNextBillingDate() { return nextBillingDate; }
    public void setNextBillingDate(LocalDate nextBillingDate) { this.nextBillingDate = nextBillingDate; }
    public String getLastModifiedBy() { return lastModifiedBy; }
    public void setLastModifiedBy(String lastModifiedBy) { this.lastModifiedBy = lastModifiedBy; }
}

class LegacySecurityContextHolder {
    private static final ThreadLocal<String> CURRENT_ACTOR = new ThreadLocal<>();
    public static void setActor(String actor) { CURRENT_ACTOR.set(actor); }
    public static String getAuthenticatedPrincipal() {
        String actor = CURRENT_ACTOR.get();
        if (actor == null) {
            throw new SecurityException("No authenticated user in thread-local SecurityContext!");
        }
        return actor;
    }
}

class LegacySmtpMailClient {
    public void sendRawHtmlEmail(String smtpHost, String to, String subject, String htmlBody) {
        if (smtpHost == null || to == null) {
            throw new IllegalStateException("SMTP configuration incomplete");
        }
    }
}

class LegacyBillingHttpGateway {
    public boolean chargeCardSynchronously(String userId, BigDecimal amount, String idempotencyToken) {
        return amount.compareTo(new BigDecimal("5000.00")) <= 0;
    }
}

@Service
class LegacySubscriptionRenewalService {

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private Environment springEnvironment;

    private final LegacySmtpMailClient smtpMailClient = new LegacySmtpMailClient();
    private final LegacyBillingHttpGateway billingGateway = new LegacyBillingHttpGateway();

    @Transactional
    public LegacySubscriptionEntity renewSubscription(String subscriptionId, LocalDate processingDate) {
        String actor = LegacySecurityContextHolder.getAuthenticatedPrincipal();

        LegacySubscriptionEntity sub = (LegacySubscriptionEntity) entityManager
                .createNativeQuery(
                        "SELECT * FROM customer_subscriptions WHERE subscription_id = :id FOR UPDATE",
                        LegacySubscriptionEntity.class)
                .setParameter("id", subscriptionId)
                .getSingleResult();

        if ("CANCELLED".equals(sub.getState())) {
            throw new IllegalStateException("Cannot renew a cancelled subscription: " + subscriptionId);
        }

        int maxRetries = Integer.parseInt(
                Objects.requireNonNullElse(springEnvironment.getProperty("billing.max-retries"), "3")
        );
        String smtpHost = springEnvironment.getProperty("mail.smtp.host", "smtp.internal.corp");

        if ("TRIAL".equals(sub.getState()) || "ACTIVE".equals(sub.getState()) || "PAST_DUE".equals(sub.getState())) {
            String chargeToken = UUID.randomUUID().toString();
            boolean paymentSuccess = billingGateway.chargeCardSynchronously(
                    sub.getUserId(), sub.getMonthlyFee(), chargeToken
            );

            if (paymentSuccess) {
                sub.setState("ACTIVE");
                sub.setFailedAttempts(0);
                sub.setNextBillingDate(processingDate.plusMonths(1));
                sub.setLastModifiedBy(actor);
                entityManager.merge(sub);

                smtpMailClient.sendRawHtmlEmail(
                        smtpHost,
                        sub.getUserEmail(),
                        "Subscription Renewed",
                        "<html><body>Charged: " + sub.getMonthlyFee() + "</body></html>"
                );
            } else {
                int attempts = sub.getFailedAttempts() + 1;
                sub.setFailedAttempts(attempts);
                sub.setLastModifiedBy(actor);

                if (attempts >= maxRetries) {
                    sub.setState("CANCELLED");
                    smtpMailClient.sendRawHtmlEmail(
                            smtpHost,
                            sub.getUserEmail(),
                            "Subscription Cancelled due to Non-Payment",
                            "<html><body>Reached max retries: " + attempts + "</body></html>"
                    );
                } else {
                    sub.setState("PAST_DUE");
                    sub.setNextBillingDate(processingDate.plusDays(3));
                    smtpMailClient.sendRawHtmlEmail(
                            smtpHost,
                            sub.getUserEmail(),
                            "Payment Failed - Retry Scheduled",
                            "<html><body>Attempt " + attempts + " failed.</body></html>"
                    );
                }
                entityManager.merge(sub);
            }
        }
        return sub;
    }
}

```

#### 4. Architectural Smells & Systemic Risks
В представленной реализации продления подписок присутствуют четыре взаимосвязанные архитектурные уязвимости. Во-первых, жесткая привязка к ThreadLocal-контексту безопасности (`LegacySecurityContextHolder`) через вызов `getAuthenticatedPrincipal()` внутри бизнес-сервиса приводит к немедленному падению с `SecurityException`, если метод вызывается из фонового планировщика (`@Scheduled`), пула виртуальных потоков или консьюмера очереди сообщений, где HTTP-сессия пользователя отсутствует. Во-вторых, переходы между состояниями `"TRIAL"`, `"ACTIVE"`, `"PAST_DUE"` и `"CANCELLED"` представляют собой строково-типизированный конечный автомат (Stringly-Typed State Machine), закодированный через условные операторы `if/else` над сырыми строками; отсутствие компиляторной проверки исчерпанности состояний (Exhaustiveness Check) позволяет случайно перевести отмененную подписку в активную или забыть обнулить счетчик `failedAttempts`.
В-третьих, генерация недетерминированного `UUID.randomUUID()` в качестве ключа идемпотентности прямо перед вызовом платежного шлюза (`String chargeToken = UUID.randomUUID().toString()`) полностью обесценивает защиту от повторных списаний. Если сетевой вызов к платежному шлюзу завершится по таймауту чтения, повторный запуск задачи сгенерирует новый UUID и спишет деньги с карты клиента второй раз. В-четвертых, формирование HTML-шаблонов писем, чтение системных свойств из `Environment` и нативные SQL-запросы через `EntityManager` внутри бизнес-метода делают невозможным проверку матрицы переходов состояний подписки в быстрых модульных тестах.

#### 5. Characterization Harness
Тестовый контур проверяет все ветви конечного автомата переходов подписки (`Trial -> Active`, `Active -> PastDue`, `PastDue -> Cancelled` при исчерпании лимита попыток), детерминированность ключа идемпотентности (`subscriptionId + billingCycleDate`) и соблюдение правил отсутствия циклических зависимостей в ArchUnit.

```java
package com.enterprise.subscription;

import com.enterprise.subscription.application.port.in.RenewSubscriptionCommand;
import com.enterprise.subscription.application.port.in.RenewSubscriptionUseCase;
import com.enterprise.subscription.application.port.out.BillingGatewayPort;
import com.enterprise.subscription.application.port.out.SubscriptionNotificationPort;
import com.enterprise.subscription.application.port.out.SubscriptionPersistencePort;
import com.enterprise.subscription.application.service.RenewSubscriptionService;
import com.enterprise.subscription.domain.model.*;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class SubscriptionPortsAndAdaptersTest {

    private FakeSubscriptionPersistence persistence;
    private ConfigurableBillingGatewayStub billingGateway;
    private CapturingNotificationStub notificationStub;
    private RenewSubscriptionUseCase useCase;

    @BeforeEach
    void setUp() {
        persistence = new FakeSubscriptionPersistence();
        billingGateway = new ConfigurableBillingGatewayStub();
        notificationStub = new CapturingNotificationStub();
        useCase = new RenewSubscriptionService(persistence, billingGateway, notificationStub, 3);
    }

    @Test
    @DisplayName("Переход из PastDue в Cancelled при достижении лимита неудачных списаний и детерминированный ключ идемпотентности")
    void shouldTransitionFromPastDueToCancelledOnMaxFailuresWithDeterministicIdempotencyKey() {
        LocalDate cycleDate = LocalDate.of(2026, 10, 17);
        Subscription sub = new Subscription(
                new SubscriptionId("SUB-500"),
                "USER-77",
                "user77@example.com",
                "PRO_MONTHLY",
                new BigDecimal("49.99"),
                new SubscriptionStatus.PastDue(2, cycleDate),
                "SYSTEM"
        );
        persistence.save(sub);
        billingGateway.setShouldSucceed(false);

        Subscription updated = useCase.renew(new RenewSubscriptionCommand(
                new SubscriptionId("SUB-500"), cycleDate, "BATCH_SCHEDULER"
        ));

        assertInstanceOf(SubscriptionStatus.Cancelled.class, updated.status());
        assertEquals("SUB-500:2026-10-17:attempt-3", billingGateway.lastIdempotencyKey);
        assertEquals("CANCELLED_NON_PAYMENT", notificationStub.lastTemplateCode);
        assertEquals("BATCH_SCHEDULER", updated.lastModifiedBy());
    }

    @Test
    @DisplayName("ArchUnit: Отсутствие циклических зависимостей между пакетами подсистемы подписок")
    void slicesShouldBeFreeOfCycles() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.enterprise.subscription");
        SlicesRuleDefinition.slices()
                .matching("com.enterprise.subscription.(*)..")
                .should().beFreeOfCycles()
                .check(classes);
    }

    static class FakeSubscriptionPersistence implements SubscriptionPersistencePort {
        private final Map<SubscriptionId, Subscription> db = new HashMap<>();
        @Override
        public Optional<Subscription> loadForUpdate(SubscriptionId id) { return Optional.ofNullable(db.get(id)); }
        @Override
        public Subscription save(Subscription subscription) {
            db.put(subscription.id(), subscription);
            return subscription;
        }
    }

    static class ConfigurableBillingGatewayStub implements BillingGatewayPort {
        private boolean shouldSucceed = true;
        String lastIdempotencyKey;
        void setShouldSucceed(boolean shouldSucceed) { this.shouldSucceed = shouldSucceed; }
        @Override
        public boolean charge(String userId, BigDecimal amount, String idempotencyKey) {
            this.lastIdempotencyKey = idempotencyKey;
            return shouldSucceed;
        }
    }

    static class CapturingNotificationStub implements SubscriptionNotificationPort {
        String lastTemplateCode;
        @Override
        public void notifyCustomer(String email, String templateCode, Map<String, String> variables) {
            this.lastTemplateCode = templateCode;
        }
    }
}

```

#### 6. Refactored Architecture
В целевой архитектуре строковые статусы заменены на запечатанный интерфейс Java 21 (`sealed interface SubscriptionStatus`) и сопоставление с образцом в `switch` (`Pattern Matching for switch`), что гарантирует проверку всех возможных переходов состояний на этапе компиляции. Идентификатор инициатора (`actor`) передается явно во входящей команде `RenewSubscriptionCommand`, что позволяет одинаково вызывать сценарий из REST-контроллера, планировщика или CLI.

```java
// --- ПАКЕТ: com.enterprise.subscription.domain.model ---
package com.enterprise.subscription.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

public record SubscriptionId(String value) {
    public SubscriptionId {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("SubscriptionId cannot be blank");
        }
    }
}

public sealed interface SubscriptionStatus permits
        SubscriptionStatus.Trial,
        SubscriptionStatus.Active,
        SubscriptionStatus.PastDue,
        SubscriptionStatus.Cancelled {

    record Trial(LocalDate trialEndsAt) implements SubscriptionStatus {}
    record Active(LocalDate nextBillingDate) implements SubscriptionStatus {}
    record PastDue(int failedAttempts, LocalDate nextRetryDate) implements SubscriptionStatus {}
    record Cancelled(LocalDate cancelledAt, String reason) implements SubscriptionStatus {}
}

public record Subscription(
        SubscriptionId id,
        String userId,
        String userEmail,
        String planCode,
        BigDecimal monthlyFee,
        SubscriptionStatus status,
        String lastModifiedBy
) {
    public Subscription {
        Objects.requireNonNull(id);
        Objects.requireNonNull(status);
    }

    public String buildDeterministicChargeKey(LocalDate processingDate) {
        int nextAttemptNumber = switch (status) {
            case SubscriptionStatus.Trial t -> 1;
            case SubscriptionStatus.Active a -> 1;
            case SubscriptionStatus.PastDue p -> p.failedAttempts() + 1;
            case SubscriptionStatus.Cancelled c ->
                    throw new IllegalStateException("Cannot generate charge key for cancelled subscription: " + id.value());
        };
        return id.value() + ":" + processingDate + ":attempt-" + nextAttemptNumber;
    }

    public Subscription onPaymentSuccess(LocalDate processingDate, String actor) {
        if (status instanceof SubscriptionStatus.Cancelled) {
            throw new IllegalStateException("Cannot renew cancelled subscription");
        }
        return new Subscription(
                id, userId, userEmail, planCode, monthlyFee,
                new SubscriptionStatus.Active(processingDate.plusMonths(1)),
                actor
        );
    }

    public Subscription onPaymentFailure(LocalDate processingDate, int maxRetries, String actor) {
        int currentFailures = switch (status) {
            case SubscriptionStatus.Trial t -> 0;
            case SubscriptionStatus.Active a -> 0;
            case SubscriptionStatus.PastDue p -> p.failedAttempts();
            case SubscriptionStatus.Cancelled c ->
                    throw new IllegalStateException("Already cancelled: " + id.value());
        };
        int updatedFailures = currentFailures + 1;
        SubscriptionStatus nextStatus = (updatedFailures >= maxRetries)
                ? new SubscriptionStatus.Cancelled(processingDate, "MAX_RETRIES_EXCEEDED")
                : new SubscriptionStatus.PastDue(updatedFailures, processingDate.plusDays(3));

        return new Subscription(id, userId, userEmail, planCode, monthlyFee, nextStatus, actor);
    }
}

// --- ПАКЕТ: com.enterprise.subscription.application.port.in ---
package com.enterprise.subscription.application.port.in;

import com.enterprise.subscription.domain.model.Subscription;
import com.enterprise.subscription.domain.model.SubscriptionId;
import java.time.LocalDate;

public record RenewSubscriptionCommand(
        SubscriptionId subscriptionId,
        LocalDate processingDate,
        String actor
) {}

public interface RenewSubscriptionUseCase {
    Subscription renew(RenewSubscriptionCommand command);
}

// --- ПАКЕТ: com.enterprise.subscription.application.port.out ---
package com.enterprise.subscription.application.port.out;

import com.enterprise.subscription.domain.model.Subscription;
import com.enterprise.subscription.domain.model.SubscriptionId;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

public interface SubscriptionPersistencePort {
    Optional<Subscription> loadForUpdate(SubscriptionId id);
    Subscription save(Subscription subscription);
}

public interface BillingGatewayPort {
    boolean charge(String userId, BigDecimal amount, String idempotencyKey);
}

public interface SubscriptionNotificationPort {
    void notifyCustomer(String email, String templateCode, Map<String, String> variables);
}

// --- ПАКЕТ: com.enterprise.subscription.application.service ---
package com.enterprise.subscription.application.service;

import com.enterprise.subscription.application.port.in.RenewSubscriptionCommand;
import com.enterprise.subscription.application.port.in.RenewSubscriptionUseCase;
import com.enterprise.subscription.application.port.out.BillingGatewayPort;
import com.enterprise.subscription.application.port.out.SubscriptionNotificationPort;
import com.enterprise.subscription.application.port.out.SubscriptionPersistencePort;
import com.enterprise.subscription.domain.model.Subscription;
import com.enterprise.subscription.domain.model.SubscriptionStatus;

import java.util.Map;

public class RenewSubscriptionService implements RenewSubscriptionUseCase {

    private final SubscriptionPersistencePort persistencePort;
    private final BillingGatewayPort billingGatewayPort;
    private final SubscriptionNotificationPort notificationPort;
    private final int maxRetries;

    public RenewSubscriptionService(
            SubscriptionPersistencePort persistencePort,
            BillingGatewayPort billingGatewayPort,
            SubscriptionNotificationPort notificationPort,
            int maxRetries) {
        this.persistencePort = persistencePort;
        this.billingGatewayPort = billingGatewayPort;
        this.notificationPort = notificationPort;
        this.maxRetries = maxRetries;
    }

    @Override
    public Subscription renew(RenewSubscriptionCommand command) {
        Subscription current = persistencePort.loadForUpdate(command.subscriptionId())
                .orElseThrow(() -> new IllegalArgumentException("Subscription not found: " + command.subscriptionId().value()));

        String idempotencyKey = current.buildDeterministicChargeKey(command.processingDate());
        boolean paid = billingGatewayPort.charge(current.userId(), current.monthlyFee(), idempotencyKey);

        if (paid) {
            Subscription renewed = current.onPaymentSuccess(command.processingDate(), command.actor());
            Subscription saved = persistencePort.save(renewed);
            notificationPort.notifyCustomer(
                    saved.userEmail(),
                    "RENEWAL_SUCCESS",
                    Map.of("amount", saved.monthlyFee().toPlainString())
            );
            return saved;
        } else {
            Subscription failed = current.onPaymentFailure(command.processingDate(), maxRetries, command.actor());
            Subscription saved = persistencePort.save(failed);
            String template = (saved.status() instanceof SubscriptionStatus.Cancelled)
                    ? "CANCELLED_NON_PAYMENT"
                    : "PAYMENT_RETRY_SCHEDULED";
            notificationPort.notifyCustomer(saved.userEmail(), template, Map.of("subId", saved.id().value()));
            return saved;
        }
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Защита данного рефакторинга строится вокруг выбора социабельных модульных тестов с In-Memory стабами вместо классического мокирования через Mockito и определения границ транзакционности. Использование легковесных стабов (`FakeSubscriptionPersistence`) вместо конструкций `Mockito.when(...)/verify(...)` делает тесты устойчивыми к рефакторингу сигнатур внутренних приватных вызовов и проверяет конечное состояние бизнес-процесса, а не детали реализации. При этом в адаптерных тестах (`@DataJpaTest`) проверяется исключительно корректность трансляции между доменным объектом `Subscription` и JPA-сущностью через вторичный порт, что предотвращает комбинаторный взрыв числа медленных интеграционных тестов. Кроме того, отказ от аннотаций `@Service` и `@Transactional` внутри доменного и прикладного пакетов сохраняет ядро полностью независимым от Spring Framework: регистрация бинов и управление транзакциями выносятся в явный `@Configuration`-класс инфраструктурного модуля либо реализуются через собственную мета-аннотацию домена, сканируемую Spring Boot на старте приложения.

## Архетип 3.2: Устранение несогласованности двойной записи (Dual-Write) через Transactional Outbox и CDC
В событийно-ориентированных микросервисных архитектурах одной из самых опасных и распространенных ошибок является антипаттерн двойной записи (Dual-Write), когда сервис обновляет состояние в реляционной базе данных (например, PostgreSQL) и в том же методе напрямую публикует сообщение в брокер (Apache Kafka или RabbitMQ). Локальная транзакция PostgreSQL не способна атомарно координировать коммит с транзакцией брокера Kafka без тяжеловесных распределенных протоколов двухфазного коммита (2PC/XA), которые неприменимы в высоконагруженных системах из-за деградации доступности и пропускной способности.
Частым заблуждением инженеров на интервью является утверждение, что включение семантики ровно-однократной доставки в Kafka (`enable.idempotence=true` и транзакционный продюсер Kafka EOS) решает проблему Dual-Write. В действительности Kafka EOS гарантирует атомарность только внутри границ самого кластера Kafka (например, в конвейерах `read-process-write` Kafka Streams) и отсекает дубликаты при сетевых ретраях продюсера за счет порядковых номеров (sequence numbers), но никак не связывает транзакцию брокера с коммитом в PostgreSQL. Если приложение выполняет коммит в БД, а затем падает в окне сбоя (Crash / Network Partition Window) перед вызовом `commitTransaction()` в Kafka, событие безвозвратно теряется; если же отправка в Kafka выполняется *до* коммита транзакции БД, а сам коммит БД откатывается из-за нарушения ограничения целостности или разрыва соединения, в Kafka уходит фантомное событие о несуществующей операции.
Единственным надежным решением является паттерн **Transactional Outbox**, при котором бизнес-сущность и запись о событии сохраняются в одной локальной ACID-транзакции базы данных, после чего асинхронный ретранслятор доставляет события в брокер с гарантией *at-least-once*, а потребители обеспечивают идемпотентную обработку через паттерн **Transactional Inbox** (таблицу дедупликации по `event_id`) или естественную идемпотентность доменных команд, что в сумме дает семантику *effectively-once*. В промышленной эксплуатации применяются две базовые топологии ретрансляции из таблицы Outbox: конкурентный поллинг на базе коротких транзакций и лог-ориентированный захват изменений (Log-Based CDC). При использовании промышленного поллинга критически важно не удерживать блокировку базы данных во время сетевого вызова к брокеру: сначала выполняется короткая транзакция захвата строки (`SELECT ... FOR UPDATE SKIP LOCKED`), переводящая задачу из статуса `PENDING` в `PROCESSING` с немедленным коммитом, затем вне транзакции БД выполняется сетевой ввод-вывод в Kafka с передачей стабильного `taskId` в качестве ключа идемпотентности, и, наконец, третья короткая транзакция переводит запись в финальное состояние `COMPLETED` (или возвращает в очередь при ошибке). Во второй топологии — лог-ориентированном CDC — приложение вообще не опрашивает таблицу Outbox: коннектор Debezium вычитывает операции `INSERT` напрямую из бинарного журнала предзаписи PostgreSQL (Write-Ahead Log, WAL) и с помощью односообщенческой трансформации (SMT) `OutboxEventRouter` маршрутизирует события в топики Kafka на основе колонки `aggregatetype`, используя `aggregateid` как ключ партиционирования сообщения и `id` как заголовок для дедупликации на стороне Consumer Inbox.

| Критерий сравнения | Наивный поллинг (`@Scheduled` в 1 транзакции) | Промышленный поллинг (`SKIP LOCKED` + короткие транзакции) | Лог-ориентированный CDC (Debezium + PostgreSQL WAL) |
| --- | --- | --- | --- |
| **Механизм захвата событий** | `SELECT ... WHERE status = 'PENDING'` с удержанием блокировки на время отправки | Короткая транзакция захвата `FOR UPDATE SKIP LOCKED` с переводом в `PROCESSING`[cite: 14, 15] | Чтение бинарного лога предзаписи (`WAL`) коннектором Debezium без `SELECT`-запросов |
| **Влияние на пул соединений БД при деградации Kafka** | Критическое: соединения и блокировки строк удерживаются до таймаута брокера | Минимальное: во время сетевого I/O транзакция БД закрыта, соединение возвращено в пул | Нулевое: приложение вообще не обращается к Kafka, запись идет только в локальную таблицу |
| **Задержка доставки (Latency)** | Зависит от интервала поллинга (100–1000 мс) + риск блокировки воркеров | Низкая (50–250 мс), параллельная обработка батчей до 30 000 сообщ./сек | Сверхнизкая (единицы миллисекунд, близко к реальному времени) |
| **Операционная сложность инфраструктуры** | Низкая (только приложение и PostgreSQL) | Средняя (требуется таблица состояний, heartbeat-восстановление зависших задач и очистка) | Высокая (требуется кластер Kafka Connect, мониторинг репликационных слотов PostgreSQL WAL) |
| **Управление ростом таблицы Outbox** | Ручной `DELETE` опубликованных записей по расписанию | Пакетная архивация или секционирование (`PARTITION BY RANGE`) по дате | Поддержка `remove-after-insert` (мгновенное удаление после вставки, так как запись уже в WAL) |

### Kata 3: [L3-REF-03] DualWritePaymentNotifierRefactoring — Устранение антипаттерна Dual-Write в платежном шлюзе через Transactional Outbox и SKIP LOCKED

#### 1. Title & Grade
**[L3-REF-03] DualWritePaymentNotifierRefactoring** — Рефакторинг платежного шлюза с двойной записью (Dual-Write) на паттерн Transactional Outbox с конкурентным пулом воркеров (`FOR UPDATE SKIP LOCKED`) и короткими транзакциями захвата. Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача моделирует реальный архитектурный баг-репорт на собеседованиях в **Stripe Core Payments**, **Yandex Pay** и процессинговых центрах крупных финтех-платформ. При пиковых распродажах и кратковременных сетевых флапах брокера Kafka наблюдаются два типа инцидентов: потерянные события списания средств (деньги списаны в БД, но мерчант не получил уведомление) и полное исчерпание пула HikariCP из-за блокирующих вызовов `kafkaTemplate.send().get()` внутри `@Transactional`.

#### 3. The Legacy Code (150–250 lines)
Ниже представлен компилируемый фрагмент унаследованного платежного сервиса, демонстрирующий классический Dual-Write и блокировку транзакции БД на время синхронного ожидания ответа от брокера сообщений.

```java
package com.enterprise.legacy.payment;

import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Entity
@Table(name = "payment_ledger")
public class LegacyPaymentLedgerEntity {

    @Id
    private String paymentId;

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;

    @Column(name = "customer_account_id", nullable = false)
    private String customerAccountId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "status", nullable = false)
    private String status; // CAPTURED, NOTIFIED, FAILED

    @Column(name = "kafka_offset")
    private Long kafkaOffset;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public LegacyPaymentLedgerEntity() {}

    public LegacyPaymentLedgerEntity(
            String paymentId,
            String merchantId,
            String customerAccountId,
            BigDecimal amount,
            String currency,
            String status,
            Instant createdAt) {
        this.paymentId = paymentId;
        this.merchantId = merchantId;
        this.customerAccountId = customerAccountId;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }
    public String getMerchantId() { return merchantId; }
    public void setMerchantId(String merchantId) { this.merchantId = merchantId; }
    public String getCustomerAccountId() { return customerAccountId; }
    public void setCustomerAccountId(String customerAccountId) { this.customerAccountId = customerAccountId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getKafkaOffset() { return kafkaOffset; }
    public void setKafkaOffset(Long kafkaOffset) { this.kafkaOffset = kafkaOffset; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

interface LegacyPaymentRepository extends JpaRepository<LegacyPaymentLedgerEntity, String> {
    List<LegacyPaymentLedgerEntity> findByStatus(String status);
}

interface LegacyKafkaProducerClient {
    CompletableFuture<Long> sendEvent(String topic, String key, String jsonPayload);
}

@Service
class LegacyDualWritePaymentService {

    @Autowired
    private LegacyPaymentRepository paymentRepository;

    @Autowired
    private LegacyKafkaProducerClient kafkaProducer;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public LegacyPaymentLedgerEntity captureAndNotify(
            String merchantId,
            String customerAccountId,
            BigDecimal amount,
            String currency) {

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be strictly positive");
        }

        int updatedRows = entityManager.createNativeQuery(
                        "UPDATE customer_wallets SET balance = balance - :amt " +
                        "WHERE account_id = :acc AND balance >= :amt")
                .setParameter("amt", amount)
                .setParameter("acc", customerAccountId)
                .executeUpdate();

        if (updatedRows == 0) {
            throw new IllegalStateException("Insufficient funds for account: " + customerAccountId);
        }

        String paymentId = UUID.randomUUID().toString();
        LegacyPaymentLedgerEntity payment = new LegacyPaymentLedgerEntity(
                paymentId,
                merchantId,
                customerAccountId,
                amount,
                currency,
                "CAPTURED",
                Instant.now()
        );
        paymentRepository.saveAndFlush(payment);

        String payload = "{\"paymentId\":\"" + paymentId + "\",\"merchantId\":\"" + merchantId
                + "\",\"amount\":" + amount.toPlainString() + ",\"currency\":\"" + currency + "\"}";

        try {
            Long offset = kafkaProducer.sendEvent("payment-captured-events", merchantId, payload)
                    .get(5, TimeUnit.SECONDS);
            payment.setStatus("NOTIFIED");
            payment.setKafkaOffset(offset);
            return paymentRepository.save(payment);
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            throw new RuntimeException("Kafka publish failed after DB flush, triggering messy state!", e);
        }
    }

    @Scheduled(fixedDelay = 10000)
    @Transactional
    public void naiveRetryUnnotifiedPayments() {
        List<LegacyPaymentLedgerEntity> stuckPayments = paymentRepository.findByStatus("CAPTURED");
        for (LegacyPaymentLedgerEntity payment : stuckPayments) {
            String payload = "{\"paymentId\":\"" + payment.getPaymentId() + "\",\"merchantId\":\""
                    + payment.getMerchantId() + "\",\"amount\":" + payment.getAmount().toPlainString() + "}";
            try {
                Long offset = kafkaProducer.sendEvent("payment-captured-events", payment.getMerchantId(), payload)
                        .get(5, TimeUnit.SECONDS);
                payment.setStatus("NOTIFIED");
                payment.setKafkaOffset(offset);
                paymentRepository.save(payment);
            } catch (Exception ignored) {
                // Проглатывание ошибки в наивном ретрае
            }
        }
    }
}

```

#### 4. Architectural Smells & Systemic Risks
В представленном коде платежного сервиса переплетены три критических режима отказа распределенных систем. Первая проблема заключается в генерации фантомных событий при откате транзакции и потере событий при аварийном завершении JVM: в методе `captureAndNotify` вызов `kafkaProducer.sendEvent(...).get()` выполняется *до* завершения метода `@Transactional`. Если сообщение успешно записано в Kafka, но в момент коммита транзакции PostgreSQL происходит разрыв сетевого соединения с базой или ошибка отложенного ограничения целостности (`DEFERRABLE CONSTRAINT`), транзакция БД откатывается, однако событие о списании денег уже отправлено в Kafka и не может быть отозвано. Напротив, если вынести отправку в Kafka за пределы `@Transactional`, падение пода Kubernetes между коммитом БД и отправкой в Kafka приведет к безвозвратной потере события.
Второй системный риск связан с удержанием блокировки строки кошелька на время сетевого таймаута Kafka. Запрос `UPDATE customer_wallets ...` берет эксклюзивную блокировку строки клиента, после чего ожидание `.get(5, TimeUnit.SECONDS)` при недоступности брокера блокирует рабочий поток и соединение БД на 5 секунд. При потоке 500 платежей в секунду пул HikariCP (обычно 20–50 соединений) исчерпывается за 100 миллисекунд, парализуя всю базу данных. Наконец, фоновый метод `naiveRetryUnnotifiedPayments` содержит классическую гонку данных: вызов `findByStatus("CAPTURED")` не использует конструкцию `FOR UPDATE SKIP LOCKED`, поэтому если в кластере запущено четыре инстанса сервиса, все четыре планировщика одновременно прочитают одни и те же записи и отправят четыре дубликата каждого платежа, удерживая одну длинную транзакцию на весь цикл итерации.

#### 5. Characterization Harness
Характеризационный тест моделирует сбой брокера в момент проведения платежа, проверяя, что платеж и запись Outbox сохраняются атомарно без блокировки вызывающего потока, а затем запускает конкурентные воркеры ретрансляции при восстановлении брокера, гарантируя ровно однократную публикацию каждой задачи без коллизий между потоками.

```java
package com.enterprise.payment.outbox;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class DualWritePaymentOutboxVerificationTest {

    @Test
    @DisplayName("При падении брокера платеж атомарно фиксируется в Outbox, а конкурентные воркеры публикуют его без дублей после восстановления")
    void shouldSurviveBrokerOutageAndProcessConcurrentlyWithoutDuplicates() throws InterruptedException {
        InMemoryTransactionalPaymentStore store = new InMemoryTransactionalPaymentStore();
        store.seedWallet("ACC-100", new BigDecimal("1000.00"));

        FlakyBrokerClientStub brokerStub = new FlakyBrokerClientStub();
        brokerStub.setBrokerDown(true);

        PaymentCaptureUseCase captureService = new PaymentCaptureUseCase(store);
        OutboxRelayEngine relayEngine = new OutboxRelayEngine(store, brokerStub, 3);

        // 1. Оформление платежа во время полного отказа Kafka проходит успешно и быстро
        String paymentId = captureService.capturePayment("MERCH-1", "ACC-100", new BigDecimal("250.00"), "USD");
        assertNotNull(paymentId);
        assertEquals(new BigDecimal("750.00"), store.getWalletBalance("ACC-100"));
        assertEquals(1, store.countOutboxByState(OutboxState.PENDING));

        // 2. Попытка ретрансляции при лежащем брокере переводит задачу в ретрай (PENDING с увеличенным счетчиком), не теряя ее
        relayEngine.processBatch(10);
        assertEquals(0, brokerStub.publishedEvents.size());
        OutboxTaskRecord afterFailure = store.getOutboxTaskByAggregateId(paymentId);
        assertEquals(OutboxState.PENDING, afterFailure.state());
        assertEquals(1, afterFailure.attempts());

        // 3. Брокер восстанавливается; 4 конкурентных воркера одновременно запускают поллинг (SKIP LOCKED симуляция)
        brokerStub.setBrokerDown(false);
        int workerCount = 4;
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch doneGate = new CountDownLatch(workerCount);
        ExecutorService pool = Executors.newFixedThreadPool(workerCount);

        for (int i = 0; i < workerCount; i++) {
            pool.submit(() -> {
                try {
                    startGate.await();
                    relayEngine.processBatch(10);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneGate.countDown();
                }
            });
        }
        startGate.countDown();
        assertTrue(doneGate.await(5, TimeUnit.SECONDS));
        pool.shutdown();

        // 4. Событие доставлено ровно один раз, статус задачи COMPLETED
        assertEquals(1, brokerStub.publishedEvents.size());
        OutboxTaskRecord completed = store.getOutboxTaskByAggregateId(paymentId);
        assertEquals(OutboxState.COMPLETED, completed.state());
        assertTrue(brokerStub.publishedEvents.containsKey(completed.taskId()));
    }

    static class FlakyBrokerClientStub implements OutboxBrokerPublisherPort {
        private final AtomicBoolean brokerDown = new AtomicBoolean(false);
        final ConcurrentMap<String, String> publishedEvents = new ConcurrentHashMap<>();
        final AtomicInteger publishCalls = new AtomicInteger(0);

        void setBrokerDown(boolean down) { this.brokerDown.set(down); }

        @Override
        public void publishIdempotently(String idempotencyTaskId, String topic, String partitionKey, String payload) {
            publishCalls.incrementAndGet();
            if (brokerDown.get()) {
                throw new IllegalStateException("Kafka broker unavailable");
            }
            publishedEvents.putIfAbsent(idempotencyTaskId, payload);
        }
    }
}

```

#### 6. Refactored Architecture
В отрефакторенной архитектуре запись в таблицу `payment_ledger` и вставка задачи в `outbox_tasks` выполняются строго в одной локальной транзакции без каких-либо сетевых вызовов. Фоновый движок `OutboxRelayEngine` реализует трехшаговый протокол коротких транзакций, полностью исключающий удержание блокировок БД во время сетевого обмена. На первом шаге в короткой транзакции выполняется захват пачки записей через `SELECT ... WHERE state = 'PENDING' AND next_attempt_at <= :now ORDER BY created_at ASC FOR UPDATE SKIP LOCKED` с переводом их в статус `PROCESSING` и немедленным коммитом для снятия блокировок строк БД. На втором шаге, уже вне транзакции базы данных, осуществляется отправка событий в брокер с передачей неизменного идентификатора `taskId` в качестве ключа идемпотентности. На третьем шаге выполняется еще одна короткая транзакция, фиксирующая статус `COMPLETED` либо возвращающая задачу в `PENDING` с расчетом экспоненциальной задержки (`next_attempt_at`), или переводящая ее в терминальный статус `FAILED` при исчерпании лимита попыток.

```java
package com.enterprise.payment.outbox;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public enum OutboxState {
    PENDING, PROCESSING, COMPLETED, FAILED
}

public record OutboxTaskRecord(
        String taskId,
        String aggregateType,
        String aggregateId,
        String topic,
        String partitionKey,
        String payload,
        OutboxState state,
        int attempts,
        Instant nextAttemptAt,
        Instant createdAt
) {
    public OutboxTaskRecord markProcessing() {
        return new OutboxTaskRecord(
                taskId, aggregateType, aggregateId, topic, partitionKey,
                payload, OutboxState.PROCESSING, attempts, nextAttemptAt, createdAt
        );
    }

    public OutboxTaskRecord markCompleted() {
        return new OutboxTaskRecord(
                taskId, aggregateType, aggregateId, topic, partitionKey,
                payload, OutboxState.COMPLETED, attempts, nextAttemptAt, createdAt
        );
    }

    public OutboxTaskRecord markFailedAttempt(int maxAttempts, Instant retryTimestamp) {
        int nextAttempts = this.attempts + 1;
        OutboxState targetState = (nextAttempts >= maxAttempts) ? OutboxState.FAILED : OutboxState.PENDING;
        return new OutboxTaskRecord(
                taskId, aggregateType, aggregateId, topic, partitionKey,
                payload, targetState, nextAttempts, retryTimestamp, createdAt
        );
    }
}

public interface OutboxPersistencePort {
    String executeAtomicPaymentAndOutboxInsert(
            String merchantId, String accountId, BigDecimal amount, String currency);
    List<OutboxTaskRecord> claimPendingBatchSkipLocked(int batchSize, Instant now);
    void completeTaskInShortTx(String taskId);
    void recordFailureInShortTx(String taskId, int maxAttempts, Instant nextRetryAt);
}

public interface OutboxBrokerPublisherPort {
    void publishIdempotently(String idempotencyTaskId, String topic, String partitionKey, String payload);
}

class PaymentCaptureUseCase {
    private final OutboxPersistencePort persistencePort;

    public PaymentCaptureUseCase(OutboxPersistencePort persistencePort) {
        this.persistencePort = persistencePort;
    }

    public String capturePayment(String merchantId, String accountId, BigDecimal amount, String currency) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        return persistencePort.executeAtomicPaymentAndOutboxInsert(merchantId, accountId, amount, currency);
    }
}

class OutboxRelayEngine {
    private final OutboxPersistencePort persistencePort;
    private final OutboxBrokerPublisherPort brokerPublisher;
    private final int maxAttempts;

    public OutboxRelayEngine(
            OutboxPersistencePort persistencePort,
            OutboxBrokerPublisherPort brokerPublisher,
            int maxAttempts) {
        this.persistencePort = persistencePort;
        this.brokerPublisher = brokerPublisher;
        this.maxAttempts = maxAttempts;
    }

    public void processBatch(int batchSize) {
        // Шаг 1: Короткая транзакция захвата строк (SELECT ... FOR UPDATE SKIP LOCKED -> PROCESSING)
        List<OutboxTaskRecord> claimedTasks = persistencePort.claimPendingBatchSkipLocked(batchSize, Instant.now());

        // Шаг 2: Выполнение сетевого I/O ВНЕ транзакции базы данных
        for (OutboxTaskRecord task : claimedTasks) {
            try {
                brokerPublisher.publishIdempotently(
                        task.taskId(), task.topic(), task.partitionKey(), task.payload()
                );
                // Шаг 3а: Короткая транзакция фиксации успеха
                persistencePort.completeTaskInShortTx(task.taskId());
            } catch (Exception ex) {
                // Шаг 3б: Короткая транзакция возврата в очередь с экспоненциальным бэкоффом
                long backoffSeconds = (long) Math.pow(2, task.attempts());
                persistencePort.recordFailureInShortTx(
                        task.taskId(), maxAttempts, Instant.now().plusSeconds(backoffSeconds)
                );
            }
        }
    }
}

class InMemoryTransactionalPaymentStore implements OutboxPersistencePort {
    private final Map<String, BigDecimal> wallets = new ConcurrentHashMap<>();
    private final Map<String, OutboxTaskRecord> outboxTable = new LinkedHashMap<>();

    public synchronized void seedWallet(String accountId, BigDecimal balance) {
        wallets.put(accountId, balance);
    }

    public synchronized BigDecimal getWalletBalance(String accountId) {
        return wallets.getOrDefault(accountId, BigDecimal.ZERO);
    }

    @Override
    public synchronized String executeAtomicPaymentAndOutboxInsert(
            String merchantId, String accountId, BigDecimal amount, String currency) {
        BigDecimal current = wallets.getOrDefault(accountId, BigDecimal.ZERO);
        if (current.compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient funds for account: " + accountId);
        }
        wallets.put(accountId, current.subtract(amount));

        String paymentId = UUID.randomUUID().toString();
        String taskId = UUID.randomUUID().toString();
        String payload = "{\"paymentId\":\"" + paymentId + "\",\"merchantId\":\"" + merchantId
                + "\",\"amount\":" + amount.toPlainString() + ",\"currency\":\"" + currency + "\"}";

        OutboxTaskRecord task = new OutboxTaskRecord(
                taskId, "PAYMENT", paymentId, "payment-captured-events", merchantId,
                payload, OutboxState.PENDING, 0, Instant.EPOCH, Instant.now()
        );
        outboxTable.put(taskId, task);
        return paymentId;
    }

    @Override
    public synchronized List<OutboxTaskRecord> claimPendingBatchSkipLocked(int batchSize, Instant now) {
        List<OutboxTaskRecord> claimed = new ArrayList<>();
        for (Map.Entry<String, OutboxTaskRecord> entry : outboxTable.entrySet()) {
            if (claimed.size() >= batchSize) break;
            OutboxTaskRecord row = entry.getValue();
            if (row.state() == OutboxState.PENDING && !row.nextAttemptAt().isAfter(now)) {
                OutboxTaskRecord lockedRow = row.markProcessing();
                entry.setValue(lockedRow);
                claimed.add(lockedRow);
            }
        }
        return claimed;
    }

    @Override
    public synchronized void completeTaskInShortTx(String taskId) {
        OutboxTaskRecord existing = outboxTable.get(taskId);
        if (existing != null) {
            outboxTable.put(taskId, existing.markCompleted());
        }
    }

    @Override
    public synchronized void recordFailureInShortTx(String taskId, int maxAttempts, Instant nextRetryAt) {
        OutboxTaskRecord existing = outboxTable.get(taskId);
        if (existing != null) {
            outboxTable.put(taskId, existing.markFailedAttempt(maxAttempts, nextRetryAt));
        }
    }

    public synchronized long countOutboxByState(OutboxState state) {
        return outboxTable.values().stream().filter(t -> t.state() == state).count();
    }

    public synchronized OutboxTaskRecord getOutboxTaskByAggregateId(String aggregateId) {
        return outboxTable.values().stream()
                .filter(t -> t.aggregateId().equals(aggregateId))
                .findFirst()
                .orElseThrow();
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
На собеседовании уровня Staff/Principal защита этого решения охватывает две глубокие операционные проблемы: восстановление зависших задач при краше воркера и сохранение строгого FIFO-порядка событий внутри одного агрегата. Поскольку воркер переводит строку в `PROCESSING` и закрывает транзакцию БД перед отправкой в Kafka, внезапное уничтожение пода (`OOMKilled` / `SIGKILL`) оставит запись в статусе `PROCESSING` навсегда. Для устранения этого риска в схему таблицы вводится колонка `locked_until` (или `claimed_at` с механизмом heartbeats) и фоновый процесс восстановления (reaper), который возвращает зависшие записи из `PROCESSING` обратно в `PENDING`, если время обработки превысило допустимый порог без обновления пульса.
Второй тонкий аспект касается упорядочивания. Параллельный поллинг через `SKIP LOCKED` может привести к тому, что Воркер А захватит событие `PaymentCaptured`, а Воркер Б одновременно захватит следующее событие `PaymentRefunded` того же платежа и доставит его в Kafka раньше первого. Для сохранения строгого хронологического порядка в рамках `aggregate_id` при максимальной параллельной пропускной способности применяется хэширование `aggregate_id` в `bucket_id`: перед захватом задачи воркер пытается получить транзакционную рекомендательную блокировку PostgreSQL (`pg_try_advisory_xact_lock(bucket_id)`), и если бакет уже занят другим воркером, `SKIP LOCKED` мгновенно переходит к следующему свободному бакету. Кроме того, на практике вместо написания собственного планировщика команды часто используют проверенную библиотеку `db-scheduler`, которая реализует паттерн одной таблицы со `SKIP LOCKED` и heartbeats из коробки.

### Kata 4: [L3-REF-04] OrderPlacementOutboxMigration — Миграция размещения заказов на лог-ориентированный CDC Outbox (Debezium Event Router SMT)

#### 1. Title & Grade
**[L3-REF-04] OrderPlacementOutboxMigration** — Миграция высоконагруженного сервиса размещения заказов (5 000+ TPS) с синхронной мульти-топиковой публикации на лог-ориентированный CDC Outbox (Debezium Event Router SMT) и идемпотентный Consumer Inbox. Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача используется на интервью уровня Principal/Staff в **Ozon Core**, **Yandex Go / Lavka** и высоконагруженных процессинговых платформах (масштаб 5 000 – 30 000 сообщений в секунду, свыше 2 млрд событий в сутки). На таких объемах даже оптимизированный поллинг БД через `SKIP LOCKED` создает ощутимую нагрузку на дисковую подсистему и `autovacuum` PostgreSQL из-за постоянных `UPDATE`-операций смены статуса, поэтому индустриальным стандартом становится вычитка бинарного лога предзаписи (`WAL`) через коннектор Debezium с трансформацией `OutboxEventRouter`.

#### 3. The Legacy Code (150–250 lines)
В приведенном ниже фрагменте унаследованный сервис размещения заказов сохраняет заказ и синхронно публикует «толстые» события (Fat God Events) сразу в три разных топика Kafka внутри транзакции БД, а консьюмер склада списывает остатки без дедупликации входящих сообщений.

```java
package com.enterprise.legacy.ordercdc;

import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "commerce_orders")
public class LegacyCommerceOrderEntity {

    @Id
    private String orderId;

    @Column(name = "buyer_id", nullable = false)
    private String buyerId;

    @Column(name = "sku_code", nullable = false)
    private String skuCode;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Column(name = "order_state", nullable = false)
    private String orderState;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public LegacyCommerceOrderEntity() {}

    public LegacyCommerceOrderEntity(
            String orderId,
            String buyerId,
            String skuCode,
            int quantity,
            BigDecimal totalPrice,
            String orderState,
            Instant createdAt) {
        this.orderId = orderId;
        this.buyerId = buyerId;
        this.skuCode = skuCode;
        this.quantity = quantity;
        this.totalPrice = totalPrice;
        this.orderState = orderState;
        this.createdAt = createdAt;
    }

    public String getOrderId() { return orderId; }
    public String getBuyerId() { return buyerId; }
    public String getSkuCode() { return skuCode; }
    public int getQuantity() { return quantity; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public String getOrderState() { return orderState; }
    public void setOrderState(String orderState) { this.orderState = orderState; }
    public Instant getCreatedAt() { return createdAt; }
}

interface LegacyCommerceOrderRepository extends JpaRepository<LegacyCommerceOrderEntity, String> {}

interface LegacySyncKafkaBridge {
    void sendBlocking(String topic, String key, String value);
}

@Service
class LegacyOrderPlacementService {

    @Autowired
    private LegacyCommerceOrderRepository orderRepository;

    @Autowired
    private LegacySyncKafkaBridge kafkaBridge;

    @Transactional
    public LegacyCommerceOrderEntity placeOrderAndBroadcast(
            String buyerId,
            String skuCode,
            int quantity,
            BigDecimal unitPrice,
            String buyerFullDumpJson,
            String catalogFullDumpJson) {

        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }

        String orderId = UUID.randomUUID().toString();
        BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));

        LegacyCommerceOrderEntity entity = new LegacyCommerceOrderEntity(
                orderId,
                buyerId,
                skuCode,
                quantity,
                totalPrice,
                "PLACED",
                Instant.now()
        );

        orderRepository.save(entity);

        // АНТИПАТТЕРН 1: Event-Sourced God Event (передача полных дампов других доменов)
        String godEventPayload = "{"
                + "\"eventId\":\"" + UUID.randomUUID() + "\","
                + "\"orderId\":\"" + orderId + "\","
                + "\"buyerId\":\"" + buyerId + "\","
                + "\"skuCode\":\"" + skuCode + "\","
                + "\"quantity\":" + quantity + ","
                + "\"totalPrice\":" + totalPrice.toPlainString() + ","
                + "\"buyerFullDump\":" + buyerFullDumpJson + ","
                + "\"catalogFullDump\":" + catalogFullDumpJson
                + "}";

        // АНТИПАТТЕРН 2: Синхронный Dual-Write в три топика внутри @Transactional
        int retries = 0;
        while (true) {
            try {
                kafkaBridge.sendBlocking("orders-main-topic", null, godEventPayload);
                kafkaBridge.sendBlocking("warehouse-allocation-topic", null, godEventPayload);
                kafkaBridge.sendBlocking("loyalty-points-topic", null, godEventPayload);
                break;
            } catch (RuntimeException ex) {
                retries++;
                if (retries >= 3) {
                    throw ex;
                }
                try {
                    Thread.sleep(200L * retries);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException(ie);
                }
            }
        }

        return entity;
    }

    @Transactional
    public void cancelOrderAndBroadcast(String orderId) {
        LegacyCommerceOrderEntity entity = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
        entity.setOrderState("CANCELLED");
        orderRepository.save(entity);

        String cancelPayload = "{\"orderId\":\"" + orderId + "\",\"state\":\"CANCELLED\"}";
        // Потеря ключа партиционирования (key == null): отмена может обогнать создание заказа!
        kafkaBridge.sendBlocking("orders-main-topic", null, cancelPayload);
        kafkaBridge.sendBlocking("warehouse-allocation-topic", null, cancelPayload);
    }
}

@Service
class LegacyWarehouseConsumer {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void onWarehouseMessageReceived(String orderId, String skuCode, int quantity) {
        // АНТИПАТТЕРН 3: Неидемпотентный консьюмер. При ребалансировке Kafka сток спишется повторно!
        entityManager.createNativeQuery(
                        "UPDATE warehouse_stock SET allocated = allocated + :qty WHERE sku = :sku")
                .setParameter("qty", quantity)
                .setParameter("sku", skuCode)
                .executeUpdate();
    }
}

```

#### 4. Architectural Smells & Systemic Risks
Данная подсистема сочетает в себе четыре тяжелых дефекта событийно-ориентированной архитектуры. Прежде всего, в вызовах `sendBlocking("orders-main-topic", null, ...)` отсутствует ключ партиционирования (`key == null`), вследствие чего брокер Kafka распределяет события `PLACED` и `CANCELLED` одного и того же заказа по разным партициям в режиме round-robin; в результате консьюмер склада может получить и обработать событие отмены заказа *до* того, как до него дойдет событие создания заказа.
Наряду с этим система страдает от антипаттерна «God Event» (Fat Payloads): встраивание полных JSON-дампов покупателя и каталога (`buyerFullDumpJson`, `catalogFullDumpJson`) в событие заказа раздувает сетевой трафик Kafka и жестко связывает схему события со внутренними структурами чужих ограниченных контекстов. Еще более разрушительным является цикл `Thread.sleep()` с ретраями внутри `@Transactional`: при сбое публикации в третий топик поток засыпает внутри открытой транзакции БД, а поскольку первые два топика уже приняли сообщение, каждая повторная итерация цикла `while` порождает дубликаты в `orders-main-topic` и `warehouse-allocation-topic`. Наконец, на стороне консьюмера склада полностью отсутствует идемпотентность (Missing Consumer Inbox): поскольку доставка из Outbox и Kafka гарантирует семантику *at-least-once*, любой сетевой ретрай или ребалансировка консьюмер-группы вызовет `onWarehouseMessageReceived` повторно и выполнит двойное списание товара `allocated = allocated + :qty`.

#### 5. Characterization Harness
Тестовый контур верифицирует соблюдение строгого контракта колонок таблицы Outbox для коннектора Debezium Outbox Event Router SMT (`id`, `aggregatetype`, `aggregateid`, `type`, `payload`), атомарность отката записи Outbox при нарушении бизнес-инвариантов, а также гарантированное подавление дубликатов на стороне консьюмера склада через таблицу `ProcessedEventInbox`.

```java
package com.enterprise.ordercdc;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class DebeziumOutboxAndInboxMigrationTest {

    @Test
    @DisplayName("Заказ и запись Debezium Outbox сохраняются атомарно с корректными полями маршрутизации aggregatetype и aggregateid")
    void shouldPersistOrderAndDebeziumOutboxAtomically() {
        InMemoryOrderAndOutboxUnitOfWork uow = new InMemoryOrderAndOutboxUnitOfWork();
        OrderCdcPlacementService service = new OrderCdcPlacementService(uow);

        OrderPlacedResult result = service.placeOrder("BUYER-42", "SKU-LAPTOP", 2, new BigDecimal("1200.00"));

        List<DebeziumOutboxRecord> outboxRows = uow.getCapturedOutboxWalRecords();
        assertEquals(1, outboxRows.size());

        DebeziumOutboxRecord record = outboxRows.getFirst();
        assertNotNull(record.id());
        // Контракт Debezium Outbox Event Router SMT:
        // route.by.field = aggregatetype -> формирует топик outbox.event.orders
        // table.field.event.key = aggregateid -> гарантирует попадание всех событий заказа в одну партицию Kafka
        assertEquals("orders", record.aggregatetype());
        assertEquals(result.orderId(), record.aggregateid());
        assertEquals("OrderPlaced", record.type());
        assertTrue(record.payload().contains("\"orderId\":\"" + result.orderId() + "\""));
        assertFalse(record.payload().contains("buyerFullDump"));
    }

    @Test
    @DisplayName("Идемпотентный консьюмер склада с таблицей Inbox игнорирует повторную доставку одного и того же события из Kafka")
    void warehouseConsumerShouldDeduplicateRepeatedEventsViaInbox() {
        IdempotentWarehouseAllocationConsumer consumer = new IdempotentWarehouseAllocationConsumer();
        consumer.seedStock("SKU-LAPTOP", 0);

        UUID eventId = UUID.randomUUID();
        // Первая доставка события
        boolean firstProcessed = consumer.consumeOrderPlacedEvent(eventId, "ORD-101", "SKU-LAPTOP", 3);
        // Дублирующая доставка того же события после ребалансировки консьюмер-группы Kafka
        boolean duplicateProcessed = consumer.consumeOrderPlacedEvent(eventId, "ORD-101", "SKU-LAPTOP", 3);

        assertTrue(firstProcessed);
        assertFalse(duplicateProcessed);
        assertEquals(3, consumer.getAllocatedQuantity("SKU-LAPTOP"));
    }
}

```

#### 6. Refactored Architecture
Рефакторинг заменяет прямые вызовы Kafka на запись канонической строки `DebeziumOutboxRecord` в рамках транзакции сохранения заказа. Схема таблицы точно соответствует ожиданиям трансформации Debezium `io.debezium.transforms.outbox.EventRouter`: колонка `id` переходит в заголовок Kafka-сообщения для дедупликации, `aggregatetype` определяет целевой топик (`outbox.event.orders`), а `aggregateid` становится ключом партиционирования Kafka-сообщения, гарантируя строгий порядок `OrderPlaced -> OrderCancelled`. На стороне консьюмера склада внедрен паттерн **Transactional Inbox**, атомарно фиксирующий `event_id` в таблице обработанных сообщений вместе с бизнес-изменением стока.

```java
package com.enterprise.ordercdc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Каноническая структура таблицы outbox_events под Debezium Outbox Event Router SMT.
 * DDL:
 * CREATE TABLE outbox_events (
 *     id UUID PRIMARY KEY,
 *     aggregatetype VARCHAR(255) NOT NULL,
 *     aggregateid VARCHAR(255) NOT NULL,
 *     type VARCHAR(255) NOT NULL,
 *     payload JSONB NOT NULL,
 *     created_at TIMESTAMPTZ NOT NULL
 * );
 */
public record DebeziumOutboxRecord(
        UUID id,
        String aggregatetype,
        String aggregateid,
        String type,
        String payload,
        Instant createdAt
) {}

public record OrderPlacedResult(String orderId, UUID outboxEventId, BigDecimal totalPrice) {}

public interface OrderOutboxUnitOfWorkPort {
    void saveOrderAndAppendOutboxEvent(
            String orderId,
            String buyerId,
            String skuCode,
            int quantity,
            BigDecimal totalPrice,
            String state,
            DebeziumOutboxRecord outboxRecord,
            boolean removeAfterInsert
    );
}

class OrderCdcPlacementService {

    private final OrderOutboxUnitOfWorkPort unitOfWork;

    public OrderCdcPlacementService(OrderOutboxUnitOfWorkPort unitOfWork) {
        this.unitOfWork = unitOfWork;
    }

    public OrderPlacedResult placeOrder(String buyerId, String skuCode, int quantity, BigDecimal unitPrice) {
        if (buyerId == null || buyerId.isBlank()) {
            throw new IllegalArgumentException("buyerId is required");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be strictly positive");
        }

        String orderId = UUID.randomUUID().toString();
        BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(quantity));
        UUID eventId = UUID.randomUUID();
        Instant now = Instant.now();

        // Узкий, защищенный контракт интеграционного события (ACL Integration Event) без дампов чужих доменов
        String cleanPayload = "{"
                + "\"orderId\":\"" + orderId + "\","
                + "\"buyerId\":\"" + buyerId + "\","
                + "\"skuCode\":\"" + skuCode + "\","
                + "\"quantity\":" + quantity + ","
                + "\"totalPrice\":" + totalPrice.toPlainString()
                + "}";

        DebeziumOutboxRecord outboxRecord = new DebeziumOutboxRecord(
                eventId,
                "orders",
                orderId,
                "OrderPlaced",
                cleanPayload,
                now
        );

        // Вставка заказа и записи Outbox в одной локальной транзакции;
        // опция removeAfterInsert=true удаляет строку сразу после INSERT, оставляя событие в PostgreSQL WAL для Debezium
        unitOfWork.saveOrderAndAppendOutboxEvent(
                orderId, buyerId, skuCode, quantity, totalPrice, "PLACED", outboxRecord, true
        );

        return new OrderPlacedResult(orderId, eventId, totalPrice);
    }
}

class InMemoryOrderAndOutboxUnitOfWork implements OrderOutboxUnitOfWorkPort {
    private final Map<String, String> ordersTable = new ConcurrentHashMap<>();
    private final Map<UUID, DebeziumOutboxRecord> activeOutboxTable = new ConcurrentHashMap<>();
    private final List<DebeziumOutboxRecord> walStream = Collections.synchronizedList(new ArrayList<>());

    @Override
    public synchronized void saveOrderAndAppendOutboxEvent(
            String orderId,
            String buyerId,
            String skuCode,
            int quantity,
            BigDecimal totalPrice,
            String state,
            DebeziumOutboxRecord outboxRecord,
            boolean removeAfterInsert) {

        ordersTable.put(orderId, state);
        activeOutboxTable.put(outboxRecord.id(), outboxRecord);
        // Любой INSERT фиксируется в Write-Ahead Log (WAL) PostgreSQL
        walStream.add(outboxRecord);

        if (removeAfterInsert) {
            // Оптимизация хранения: удаление из таблицы не мешает Debezium прочитать INSERT из WAL,
            // так как SMT OutboxEventRouter автоматически фильтрует операции DELETE
            activeOutboxTable.remove(outboxRecord.id());
        }
    }

    public List<DebeziumOutboxRecord> getCapturedOutboxWalRecords() {
        return List.copyOf(walStream);
    }
}

class IdempotentWarehouseAllocationConsumer {
    private final Set<UUID> processedEventInboxTable = ConcurrentHashMap.newKeySet();
    private final Map<String, Integer> allocatedStockTable = new ConcurrentHashMap<>();

    public void seedStock(String sku, int initialAllocated) {
        allocatedStockTable.put(sku, initialAllocated);
    }

    public synchronized boolean consumeOrderPlacedEvent(UUID eventId, String orderId, String skuCode, int quantity) {
        // Шаг 1: Попытка вставить eventId в таблицу inbox (INSERT INTO processed_inbox (event_id) VALUES (?))
        // Если возникает нарушение уникальности первичного ключа — сообщение является дубликатом и отбрасывается
        if (!processedEventInboxTable.add(eventId)) {
            return false;
        }

        // Шаг 2: Выполнение бизнес-операции в той же локальной транзакции БД, что и вставка в Inbox
        int currentAllocated = allocatedStockTable.getOrDefault(skuCode, 0);
        allocatedStockTable.put(skuCode, currentAllocated + quantity);
        return true;
    }

    public int getAllocatedQuantity(String sku) {
        return allocatedStockTable.getOrDefault(sku, 0);
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Защита этого решения на уровне Staff/Principal требует глубокого понимания эксплуатационных рисков Debezium CDC и механизмов управления объемом хранения таблицы Outbox. В отличие от поллинга, CDC переносит сложность из кода приложения в инфраструктурный контур. Если коннектор Debezium остановится из-за сбоя кластера Kafka Connect, а логический слот репликации в PostgreSQL останется активным, база данных перестанет удалять старые сегменты журнала предзаписи (WAL), что приведет к исчерпанию дискового пространства и аварийной остановке СУБД. Архитектор уровня Staff обязан предусмотреть ограничение размера удерживаемого лога (`max_slot_wal_keep_size`), алерты на отставание слота репликации и автоматизацию перезапуска коннекторов.
Второй важный компромисс связан с предотвращением бесконечного разрастания таблицы Outbox. Поскольку трансформация `OutboxEventRouter` в Debezium реагирует исключительно на события `INSERT` в логе предзаписи и автоматически фильтрует операции `DELETE`, приложение может удалять запись из таблицы `outbox_events` сразу после ее вставки в рамках той же транзакции (как это реализовано в опции `quarkus.debezium-outbox.remove-after-insert`). Это полностью избавляет базу данных от накопления миллионов мертвых строк и необходимости запускать тяжелые фоновые задания очистки `DELETE FROM outbox_event WHERE status = 'PUBLISHED' AND published_at < now() - interval '7 days'`, хотя и лишает инженеров возможности запрашивать историю отправленных событий SQL-запросом напрямую из таблицы (для расследования инцидентов в этом случае используется сам лог Kafka).

## Архетип 3.3: Миграция корпоративного легаси со Spring Boot 2.7 на 3.4+, Jakarta EE и виртуальные потоки Java 21
Переход с платформы Java 8/11 и Spring Boot 2.7 на стек Java 21 LTS и Spring Boot 3.4+ представляет собой не механическую замену версий в `pom.xml`, а глубокий архитектурный сдвиг в модели параллелизма, управления сетевыми соединениями и контрактами безопасности. Включение виртуальных потоков Project Loom (`spring.threads.virtual.enabled=true`) кардинально меняет поведение блокирующего ввода-вывода: когда виртуальный поток выполняет сетевой запрос, JVM автоматически размонтирует (unmounts) его с платформенного потока-носителя (carrier thread), освобождая поток ОС для других задач.
Однако в унаследованном корпоративном коде скрыта критическая ловушка — **пиннинг (привязка) виртуальных потоков (Virtual Thread Pinning)**. В среде исполнения Java 21 виртуальный поток жестко привязывается к своему потоку-носителю и не может быть размонтирован при блокировке в двух случаях: если он находится внутри блока или метода `synchronized`, либо если в стеке вызовов присутствует нативный метод (JNI / Foreign Function).
Глубокий системный эффект третьего порядка заключается в том, что пиннинг виртуальных потоков в JDK 21 приводит не просто к снижению пропускной способности (как видно из деградации времени выполнения до 6 799 мс при 128 виртуальных потоках на 8 потоках-носителях), но и к **дедлокам исчерпания потоков-носителей (Carrier Thread Starvation Deadlock)** в коде, который с точки зрения классической теории многопоточности является абсолютно корректным. Например, если виртуальный поток `VT-A` захватывает `ReentrantLock` вне блока `synchronized`, а затем выполняет сетевой ввод-вывод и размонтируется с потока-носителя (удерживая `ReentrantLock`), в то время как виртуальные потоки `VT-B` и `VT-C` входят в метод `synchronized` (привязываясь к двум доступным потокам-носителям) и пытаются захватить тот же `ReentrantLock`, возникает взаимная блокировка: `VT-B` и `VT-C` переходят в состояние `WAITING`, но не освобождают потоки-носители из-за пиннинга в `synchronized`, а готовый к продолжению `VT-A` (`RUNNABLE`) никогда не сможет завершиться и отпустить лок, так как в пуле не осталось свободных потоков-носителей для его монтирования. Эта проблема особенно остро проявляется при использовании унаследованного Apache HttpClient 4.x (`HTTPCORE-746`) внутри `RestTemplate` на JDK 21, поскольку на уровне самой виртуальной машины пиннинг в `synchronized` устраняется только начиная с JDK 24+ (JEP 491).

### Kata 5: [L3-REF-05] LegacySpring2EnterpriseGatewayMigration — Миграция корпоративного API-шлюза со Spring Boot 2.7 / Java 8 на Spring Boot 3.4+ / Java 21 и Virtual Threads

#### 1. Title & Grade
**[L3-REF-05] LegacySpring2EnterpriseGatewayMigration** — Комплексная миграция корпоративного платежно-тарифного шлюза со стека Java 8 / Spring Boot 2.7 (`javax.*`, `RestTemplate`, `synchronized` кэш, рефлексия) на Java 21 LTS и Spring Boot 3.4+ (`jakarta.*`, `RestClient`, `ReentrantLock`, Records, Pattern Matching). Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача используется на собеседованиях в **Yandex Cloud Infrastructure**, **Ozon Platform Engineering** и командах платформенной архитектуры крупных банков. Кандидату предоставляется унаследованный пограничный шлюз, который после механического включения виртуальных потоков в JDK 21 начал намертво зависать под конкурентной нагрузкой при обновлении OAuth2-токена и вызовах внешних апстримов.

#### 3. The Legacy Code (150–250 lines)
Ниже представлен компилируемый код унаследованного шлюза (с имитацией пакетов `javax.*` и блокирующего кэша токенов), демонстрирующий причины пиннинга потоков-носителей, уязвимую рефлексию и устаревший HTTP-клиент.

```java
package com.enterprise.legacy.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;

/**
 * Унаследованный корпоративный шлюз в стиле Java 8 / Spring Boot 2.7.
 * Использует синхронизированные мониторы вокруг сетевого I/O, RestTemplate,
 * рефлексивное создание обработчиков и небезопасный парсинг XML.
 */
@Component
public class LegacySpring2EnterpriseGateway {

    @Value("${gateway.upstream.base-url:https://upstream.internal.corp}")
    private String upstreamBaseUrl;

    @Value("${gateway.auth.token-url:https://auth.internal.corp/oauth/token}")
    private String tokenUrl;

    @Value("${gateway.client.timeout-ms:5000}")
    private int timeoutMs;

    private final RestTemplate restTemplate;
    private final Object tokenMonitor = new Object();

    private String cachedBearerToken;
    private Instant tokenExpiresAt = Instant.EPOCH;

    public LegacySpring2EnterpriseGateway(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * КРИТИЧЕСКИЙ ДЕФЕКТ ДЛЯ JAVA 21 VIRTUAL THREADS:
     * Сетевой вызов restTemplate.postForEntity выполняется ВНУТРИ блока synchronized (tokenMonitor).
     * Виртуальный поток привязывается (pinned) к платформенному потоку-носителю на все время HTTP-запроса!
     */
    public String obtainValidBearerToken() {
        synchronized (tokenMonitor) {
            if (cachedBearerToken == null || Instant.now().isAfter(tokenExpiresAt)) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                HttpEntity<String> entity = new HttpEntity<>("grant_type=client_credentials", headers);

                ResponseEntity<String> response = restTemplate.postForEntity(
                        tokenUrl, entity, String.class
                );

                if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
                    throw new IllegalStateException("Failed to refresh token from " + tokenUrl);
                }
                this.cachedBearerToken = response.getBody().trim();
                this.tokenExpiresAt = Instant.now().plusSeconds(300);
            }
            return cachedBearerToken;
        }
    }

    /**
     * Устаревший диспетчер маршрутизации на базе рефлексии Class.forName().newInstance()
     * и синхронизированной отправки запросов.
     */
    public synchronized Map<String, Object> dispatchLegacyPayload(
            String handlerClassName,
            String routeType,
            String rawPayload) {

        try {
            Class<?> clazz = Class.forName(handlerClassName);
            Object instance = clazz.getDeclaredConstructor().newInstance();
            if (!(instance instanceof LegacyPayloadProcessor)) {
                throw new IllegalArgumentException("Invalid processor class: " + handlerClassName);
            }
            LegacyPayloadProcessor processor = (LegacyPayloadProcessor) instance;
            String transformed = processor.transform(rawPayload);

            String token = obtainValidBearerToken();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_XML));

            HttpEntity<String> requestEntity = new HttpEntity<>(transformed, headers);
            ResponseEntity<String> upstreamResponse = restTemplate.exchange(
                    upstreamBaseUrl + "/v1/dispatch/" + routeType,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            // УЯЗВИМОСТЬ XXE: DocumentBuilderFactory без отключения внешних сущностей DOCTYPE
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            DocumentBuilder db = dbf.newDocumentBuilder();
            Document xmlDoc = db.parse(new ByteArrayInputStream(
                    upstreamResponse.getBody().getBytes(StandardCharsets.UTF_8)
            ));

            String statusCode = xmlDoc.getElementsByTagName("status").item(0).getTextContent();
            String txRef = xmlDoc.getElementsByTagName("reference").item(0).getTextContent();

            Map<String, Object> result = new HashMap<>();
            result.put("status", statusCode);
            result.put("reference", txRef);
            result.put("timeoutConfigured", timeoutMs);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Legacy gateway dispatch failure", e);
        }
    }

    public interface LegacyPayloadProcessor {
        String transform(String input);
    }

    public static class StandardPaymentPayloadProcessor implements LegacyPayloadProcessor {
        @Override
        public String transform(String input) {
            return "<request><data>" + input + "</data></request>";
        }
    }
}

```

#### 4. Architectural Smells & Systemic Risks
Данный корпоративный шлюз содержит три критических дефекта, препятствующих миграции на Java 21 LTS и Spring Boot 3.4+. Главная проблема заключается в монополизации и взаимной блокировке потоков-носителей из-за использования `synchronized` вокруг сетевого ввода-вывода: и метод `dispatchLegacyPayload`, и блок обновления токена в `obtainValidBearerToken` удерживают встроенный монитор во время выполнения блокирующих HTTP-запросов через `restTemplate`. При включении виртуальных потоков в JDK 21 все потоки-носители базового `ForkJoinPool` мгновенно оказываются привязанными (pinned) на время сетевой задержки апстрима, полностью останавливая выполнение любых других виртуальных потоков в виртуальной машине. Диагностика такого состояния в продакшене требует запуска JVM с флагом `-Djdk.tracePinnedThreads=full` или анализа событий `jdk.VirtualThreadPinned` в Java Flight Recorder.
Вторым недостатком является использование устаревшего `RestTemplate` с россыпью невалидируемых полей `@Value`: в Spring Framework 6.1 и Spring Boot 3.4 для императивного HTTP-взаимодействия поверх виртуальных потоков стандартом де-факто стал текучий (fluent) интерфейс `RestClient`, который обеспечивает лучшую тестируемость и автоконфигурируется через `RestClient.Builder` и `ClientHttpRequestFactoryBuilder`. Третий системный риск лежит в плоскости информационной безопасности: динамическая загрузка классов по имени через `Class.forName(handlerClassName)` открывает вектор удаленного выполнения кода (RCE), а инициализация `DocumentBuilderFactory.newInstance()` без отключения внешних DTD-сущностей делает шлюз уязвимым к атакам XML External Entity (XXE).

#### 5. Characterization Harness
Тестовый контур запускает 64 конкурентных виртуальных потока Java 21 (`Executors.newVirtualThreadPerTaskExecutor()`), которые одновременно обращаются к шлюзу при протухшем токене и искусственной задержке сети апстрима в 50–80 мс. Тест подтверждает, что обновленный шлюз на базе `ReentrantLock` и `RestClient` не блокирует параллельные виртуальные потоки, выполняет ровно один запрос на обновление токена (double-checked locking поверх `ReentrantLock`) и корректно маршрутизирует запросы через типизированные `sealed`-команды без рефлексии.

```java
package com.enterprise.gateway.modern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class ModernEnterpriseGatewayVirtualThreadTest {

    @Test
    @DisplayName("64 виртуальных потока выполняют запросы через шлюз на ReentrantLock без пиннинга и обновляют токен ровно один раз")
    void shouldHandleHighVirtualThreadConcurrencyWithoutPinningAndSingleTokenRefresh() throws Exception {
        AtomicInteger tokenRefreshCalls = new AtomicInteger(0);
        AtomicInteger upstreamCalls = new AtomicInteger(0);

        GatewayHttpTransportPort simulatedTransport = new GatewayHttpTransportPort() {
            @Override
            public String fetchOAuthToken(String tokenUrl) {
                tokenRefreshCalls.incrementAndGet();
                try {
                    // Во время Thread.sleep внутри ReentrantLock виртуальный поток корректно размонтируется с носителя!
                    Thread.sleep(80);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return "JWT-TOKEN-2026";
            }

            @Override
            public GatewayDispatchResponse postToUpstream(String path, String bearerToken, String body) {
                upstreamCalls.incrementAndGet();
                try {
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return new GatewayDispatchResponse("OK", "REF-" + upstreamCalls.get());
            }
        };

        GatewayConfigurationProperties config = new GatewayConfigurationProperties(
                "https://upstream.internal.corp",
                "https://auth.internal.corp/oauth/token",
                Duration.ofSeconds(5)
        );

        ModernSpring3EnterpriseGateway gateway = new ModernSpring3EnterpriseGateway(config, simulatedTransport);

        int virtualTasks = 64;
        try (ExecutorService vThreadExecutor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Callable<GatewayDispatchResponse>> tasks = new ArrayList<>();
            for (int i = 0; i < virtualTasks; i++) {
                final int idx = i;
                tasks.add(() -> gateway.dispatch(new GatewayRouteCommand.PaymentRoute("PAY-" + idx, 1000L)));
            }

            long startNanos = System.nanoTime();
            List<Future<GatewayDispatchResponse>> futures = vThreadExecutor.invokeAll(tasks);
            for (Future<GatewayDispatchResponse> f : futures) {
                GatewayDispatchResponse resp = f.get(3, TimeUnit.SECONDS);
                assertEquals("OK", resp.status());
            }
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);

            // Если бы потоки блокировались последовательно (как в synchronized метода dispatchLegacyPayload),
            // 64 вызова по 50 мс заняли бы > 3200 мс. На виртуальных потоках без пиннинга все завершается быстрее 600 мс.
            assertTrue(elapsedMs < 1000, "Execution took too long (" + elapsedMs + " ms), indicating thread pinning or serialization!");
            assertEquals(1, tokenRefreshCalls.get(), "Token should be refreshed exactly once by concurrent virtual threads");
            assertEquals(virtualTasks, upstreamCalls.get());
        }
    }
}

```

#### 6. Refactored Architecture
Отрефакторенный шлюз полностью переведен на идиоматический стек Java 21 и Spring Boot 3.4+. Конфигурационные свойства собраны в неизменяемый `record GatewayConfigurationProperties` с валидацией Jakarta Bean Validation (`jakarta.validation.constraints.*`). Мониторы `synchronized` полностью заменены на `ReentrantLock`, благодаря чему виртуальный поток при ожидании ответа от сервера авторизации вызывает `LockSupport.park()` и мгновенно освобождает платформенный поток-носитель. Рефлексия `Class.forName` заменена на запечатанную иерархию команд `sealed interface GatewayRouteCommand` и исчерпывающий `switch` с деконструкцией `record`-паттернов Java 21, а сетевой обмен делегирован `org.springframework.web.client.RestClient`.

```java
package com.enterprise.gateway.modern;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

@Validated
@ConfigurationProperties(prefix = "gateway")
public record GatewayConfigurationProperties(
        @NotBlank String upstreamBaseUrl,
        @NotBlank String tokenUrl,
        @NotNull Duration timeout
) {
    public GatewayConfigurationProperties {
        Objects.requireNonNull(upstreamBaseUrl);
        Objects.requireNonNull(tokenUrl);
        Objects.requireNonNull(timeout);
    }
}

public sealed interface GatewayRouteCommand permits
        GatewayRouteCommand.PaymentRoute,
        GatewayRouteCommand.RefundRoute {

    record PaymentRoute(String paymentId, long amountCents) implements GatewayRouteCommand {}
    record RefundRoute(String refundId, String originalPaymentId) implements GatewayRouteCommand {}
}

public record GatewayDispatchResponse(String status, String reference) {}

public interface GatewayHttpTransportPort {
    String fetchOAuthToken(String tokenUrl);
    GatewayDispatchResponse postToUpstream(String path, String bearerToken, String jsonPayload);
}

/**
 * Промышленный адаптер на базе Spring Framework 6.1 / Spring Boot 3.4 RestClient.
 */
class SpringRestClientTransportAdapter implements GatewayHttpTransportPort {

    private final RestClient restClient;

    public SpringRestClientTransportAdapter(RestClient.Builder builder, GatewayConfigurationProperties props) {
        this.restClient = builder
                .baseUrl(props.upstreamBaseUrl())
                .build();
    }

    @Override
    public String fetchOAuthToken(String tokenUrl) {
        String body = restClient.post()
                .uri(tokenUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("grant_type=client_credentials")
                .retrieve()
                .body(String.class);
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("Empty token response from " + tokenUrl);
        }
        return body.trim();
    }

    @Override
    public GatewayDispatchResponse postToUpstream(String path, String bearerToken, String jsonPayload) {
        return restClient.post()
                .uri(path)
                .headers(h -> h.setBearerAuth(bearerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve()
                .body(GatewayDispatchResponse.class);
    }
}

public class ModernSpring3EnterpriseGateway {

    private final GatewayConfigurationProperties properties;
    private final GatewayHttpTransportPort transportPort;
    private final ReentrantLock tokenLock = new ReentrantLock();

    private volatile String cachedBearerToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public ModernSpring3EnterpriseGateway(
            GatewayConfigurationProperties properties,
            GatewayHttpTransportPort transportPort) {
        this.properties = properties;
        this.transportPort = transportPort;
    }

    public String obtainValidBearerTokenUnpinned() {
        Instant now = Instant.now();
        String currentToken = this.cachedBearerToken;
        if (currentToken != null && now.isBefore(this.tokenExpiresAt)) {
            return currentToken;
        }

        // ReentrantLock позволяет виртуальному потоку размонтироваться с потока-носителя во время блокировки!
        tokenLock.lock();
        try {
            Instant recheckNow = Instant.now();
            if (this.cachedBearerToken == null || recheckNow.isAfter(this.tokenExpiresAt)) {
                this.cachedBearerToken = transportPort.fetchOAuthToken(properties.tokenUrl());
                this.tokenExpiresAt = Instant.now().plusSeconds(300);
            }
            return this.cachedBearerToken;
        } finally {
            tokenLock.unlock();
        }
    }

    public GatewayDispatchResponse dispatch(GatewayRouteCommand command) {
        // Pattern Matching for switch с деконструкцией Java 21 Record заменяет уязвимую рефлексию Class.forName
        record RouteSpec(String path, String jsonBody) {}

        RouteSpec spec = switch (command) {
            case GatewayRouteCommand.PaymentRoute(String id, long cents) when cents > 0 ->
                    new RouteSpec(
                            "/v1/dispatch/payment",
                            "{\"paymentId\":\"" + id + "\",\"amountCents\":" + cents + "}"
                    );
            case GatewayRouteCommand.PaymentRoute(String id, long cents) ->
                    throw new IllegalArgumentException("Payment amount must be positive for " + id);
            case GatewayRouteCommand.RefundRoute(String refundId, String origId) ->
                    new RouteSpec(
                            "/v1/dispatch/refund",
                            "{\"refundId\":\"" + refundId + "\",\"originalPaymentId\":\"" + origId + "\"}"
                    );
        };

        String token = obtainValidBearerTokenUnpinned();
        return transportPort.postToUpstream(spec.path(), token, spec.jsonBody());
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Архитектурная защита данного решения строится вокруг тонкостей автоконфигурации HTTP-клиентов в Spring Boot 3.4 и управления параллелизмом при переходе на виртуальные потоки. В Spring Boot 3.4 появился `ClientHttpRequestFactoryBuilder` и расширенная автоконфигурация `RestClient`. Если в classpath присутствует библиотека Apache HttpComponents 5, Spring Boot автоматически сконфигурирует `HttpComponentsClientHttpRequestFactory`, а при ее отсутствии на Java 21+ выберет `JdkClientHttpRequestFactory` поверх встроенного `java.net.http.HttpClient`, который полностью свободен от проблем пиннинга. При этом важно учитывать нетривиальный нюанс настройки взаимного TLS (mTLS) через `RestClientSsl` и `SslBundles`: прямой вызов `ssl.fromBundle(...)` на `RestClient.Builder` перезаписывает кастомную фабрику `HttpComponentsClientHttpRequestFactory`, поэтому для одновременного использования тонкого пулинга соединений Apache HttpClient 5 и сертификатов из `SslBundles` необходимо явно передавать `SslBundle` в `SSLConnectionSocketFactoryBuilder` при конструировании `PoolingHttpClientConnectionManagerBuilder`.
Второй фундаментальный компромисс касается ограничения параллелизма (Bulkheading). В старой архитектуре фиксированный размер пула платформенных потоков сервлет-контейнера косвенно ограничивал число одновременных исходящих запросов к внешнему апстриму. Поскольку виртуальные потоки создаются миллионами и не пулируются, резкий всплеск входящего трафика откроет десятки тысяч одновременных HTTP-соединений и вызовет отказ внешнего партнера или исчерпание эфемерных портов ОС. Поэтому на уровне Staff вокруг вызовов `RestClient` вводится явный ограничитель параллелизма на базе `java.util.concurrent.Semaphore`, который паркует избыточные виртуальные потоки без блокировки потоков-носителей ОС.

### Kata 6: [L3-REF-06] LegacyBankingSecurityMigration — Модернизация контура безопасности, инспекции трафика и обработки ошибок (Spring Boot 3.4+, RFC 9457, асинхронное крипто-редактирование PII)

#### 1. Title & Grade
**[L3-REF-06] LegacyBankingSecurityMigration** — Рефакторинг банковского фильтра безопасности и аудита трафика: переход на `jakarta.servlet.*`, устранение блокировок на разделяемом `javax.crypto.Cipher`, вынос CPU-емкого редактирования персональных данных (PII) в асинхронный конвейер для соблюдения SLA `<2ms p99` и стандартизация ошибок по RFC 9457 (`ProblemDetail`). Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача прямо отражает вопросы для Principal Software Engineer в **Stripe Security Edge**, **Revolut Core** и платежных шлюзах уровня PCI DSS Level 1. Требование бизнеса и информационной безопасности создает классический архитектурный конфликт: каждое обращение к платежному API должно проходить глубокую инспекцию полезной нагрузки с маскированием PAN/PII-данных и криптографическим хешированием/шифрованием для неизменяемого журнала аудита, но при этом накладные расходы фильтра на критическом пути запроса не должны превышать `<2ms p99`.

#### 3. The Legacy Code (150–250 lines)
Ниже представлен компилируемый код унаследованного банковского фильтра безопасности, который выполняет тяжелые регулярные выражения и криптографию синхронно в потоке HTTP-запроса, использует `synchronized` вокруг единого экземпляра `Cipher` и возвращает нестандартные ошибки с утечкой внутренних деталей.

```java
package com.enterprise.legacy.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Унаследованный фильтр безопасности и PCI-DSS аудита.
 * Выполняет синхронное регулярное маскирование и AES-шифрование в потоке запроса
 * через глобальный synchronized монитор.
 */
public class LegacyBankingSecurityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(LegacyBankingSecurityFilter.class);

    private static final Pattern CARD_PAN_PATTERN = Pattern.compile("\\b(?:\\d[ -]*?){13,16}\\b");
    private static final Pattern SSN_PATTERN = Pattern.compile("\\b\\d{3}-\\d{2}-\\d{4}\\b");

    private final Cipher sharedAesCipher;
    private final SecretKeySpec secretKeySpec;
    private final List<String> synchronousAuditStorage = Collections.synchronizedList(new ArrayList<>());

    public LegacyBankingSecurityFilter(byte[] rawAesKey16Bytes) {
        try {
            this.secretKeySpec = new SecretKeySpec(rawAesKey16Bytes, "AES");
            // АНТИПАТТЕРН 1: Единый экземпляр Cipher на весь сервис + небезопасный режим AES/ECB/PKCS5Padding
            this.sharedAesCipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize legacy cipher", e);
        }
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String requestPayloadSummary = request.getHeader("X-Payload-Mirror");

        // АНТИПАТТЕРН 2: Логирование сырого пейлоада ДО маскирования PII (нарушение PCI DSS и GDPR!)
        log.info("Incoming banking request URI={} rawPayload={}", request.getRequestURI(), requestPayloadSummary);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // АНТИПАТТЕРН 3: Нестандартный формат ошибки вместо RFC 9457 ProblemDetail
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"error_code\":401,\"msg\":\"Missing token at " + request.getRequestURI()
                    + "\",\"internal_filter\":\"LegacyBankingSecurityFilter\"}"
            );
            return;
        }

        String token = authHeader.substring(7).trim();
        if (token.length() < 10) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error_code\":403,\"msg\":\"Malformed bearer token\"}");
            return;
        }

        // АНТИПАТТЕРН 4: Тяжелая синхронная CPU-обработка и блокировка synchronized в потоке запроса!
        if (requestPayloadSummary != null && !requestPayloadSummary.isBlank()) {
            recordAuditSynchronouslyUnderLock(request.getRequestURI(), token, requestPayloadSummary);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Удерживает глобальный монитор synchronized во время компиляции/прогона регулярных выражений,
     * многократного хеширования PBKDF/SHA-256 и шифрования Cipher.doFinal().
     * Вызывает пиннинг виртуальных потоков и деградацию p99 задержки свыше 50 мс!
     */
    private synchronized void recordAuditSynchronouslyUnderLock(
            String uri,
            String token,
            String rawPayload) {
        try {
            String scrubbed = CARD_PAN_PATTERN.matcher(rawPayload).replaceAll("****-****-****-REDACTED");
            scrubbed = SSN_PATTERN.matcher(scrubbed).replaceAll("***-**-REDACTED");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = rawPayload.getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < 2000; i++) {
                hash = digest.digest(hash);
            }
            String integrityHash = Base64.getEncoder().encodeToString(hash);

            sharedAesCipher.init(Cipher.ENCRYPT_MODE, secretKeySpec);
            byte[] encryptedBytes = sharedAesCipher.doFinal(
                    scrubbed.getBytes(StandardCharsets.UTF_8)
            );
            String cipherText = Base64.getEncoder().encodeToString(encryptedBytes);

            String auditEntry = Instant.now() + "|URI=" + uri + "|HASH=" + integrityHash + "|ENC=" + cipherText;
            synchronousAuditStorage.add(auditEntry);
        } catch (Exception e) {
            throw new RuntimeException("Audit encryption failure", e);
        }
    }

    public List<String> getSynchronousAuditStorage() {
        return synchronousAuditStorage;
    }
}

```

#### 4. Architectural Smells & Systemic Risks
Анализ данного фильтра безопасности выявляет четыре критических нарушения производительности и информационной безопасности. Первым и главным узким местом является синхронное выполнение CPU-емких криптографических операций и регулярных выражений прямо на горячем пути HTTP-запроса: вызов `recordAuditSynchronouslyUnderLock` внутри `doFilterInternal` блокирует рабочий поток (или реактивный event loop Netty) на десятки миллисекунд, полностью разрушая бюджет задержки `<2ms p99`. Более того, модификатор `synchronized` сериализует все параллельные запросы к банковскому шлюзу в единую очередь ожидания за разделяемым экземпляром `sharedAesCipher`, вызывая привязку (пиннинг) виртуальных потоков в JDK 21.
Вторым фатальным дефектом является прямая утечка персональных и карточных данных (PAN/PII) в логи: строка `log.info("... rawPayload={}", requestPayloadSummary)` записывает немаскированный номер банковской карты в текстовый лог до выполнения редактирования, что является грубейшим нарушением стандартов PCI DSS и GDPR. В-третьих, использование режима шифрования `AES/ECB/PKCS5Padding` криптографически небезопасно, так как режим электронной кодовой книги (ECB) не использует вектор инициализации (IV) и порождает идентичные шифротексты для одинаковых блоков данных, позволяя злоумышленнику выявлять шаблоны в журнале аудита. Наконец, ручная сборка JSON-ответов об ошибках с раскрытием внутреннего имени класса `LegacyBankingSecurityFilter` нарушает стандарт RFC 9457 (`ProblemDetail` в Spring Boot 3.x) и раскрывает внутреннюю структуру защиты потенциальному атакующему.

#### 5. Characterization Harness
Тестовый контур проверяет три критических свойства: (1) задержка захвата метаданных на горячем пути не превышает `<2ms` даже при отправке пачки конкурентных запросов; (2) асинхронный воркер гарантированно маскирует PAN-номера карт и шифрует записи через `AES/GCM/NoPadding` без потери данных при штатной остановке (`Graceful Shutdown`); (3) при ошибках аутентификации формируется валидный объект RFC 9457 `ProblemDetail`.

```java
package com.enterprise.security.modern;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

public class ModernBankingSecurityArchitectureTest {

    @Test
    @DisplayName("Захват аудита на горячем пути выполняется быстрее 2 мс, PAN-данные маскируются, а Graceful Shutdown дожидается завершения очереди")
    void shouldCaptureMetadataUnderTwoMillisecondsAndRedactPiiAsynchronously() throws Exception {
        byte[] aesKey = "0123456789ABCDEF0123456789ABCDEF".getBytes(StandardCharsets.UTF_8); // 256-bit key
        AsyncPiiCryptoAuditEngine auditEngine = new AsyncPiiCryptoAuditEngine(aesKey, 1024);

        long startNanos = System.nanoTime();
        boolean accepted = auditEngine.enqueueAuditCapture(
                "/api/v1/transfers",
                "REQ-9001",
                "{\"cardPan\":\"4532-1111-2222-8888\",\"ssn\":\"123-45-6789\",\"amount\":500}"
        );
        long captureMicros = TimeUnit.NANOSECONDS.toMicros(System.nanoTime() - startNanos);

        assertTrue(accepted);
        // Горячий путь занимает микросекунды (< 2000 мкс = 2 мс SLA)
        assertTrue(captureMicros < 2000, "Hot-path capture exceeded 2ms SLA: " + captureMicros + " us");

        // Штатное завершение (Graceful Shutdown) дренирует очередь и дожидается завершения крипто-воркеров
        auditEngine.shutdownGracefully(5, TimeUnit.SECONDS);

        List<EncryptedAuditRecord> records = auditEngine.getCompletedAuditRecords();
        assertEquals(1, records.size());

        EncryptedAuditRecord record = records.getFirst();
        String decryptedPlaintext = auditEngine.decryptForVerification(record);

        assertFalse(decryptedPlaintext.contains("4532-1111-2222-8888"), "PAN leaked into audit storage!");
        assertFalse(decryptedPlaintext.contains("123-45-6789"), "SSN leaked into audit storage!");
        assertTrue(decryptedPlaintext.contains("****-****-****-REDACTED"));
        assertTrue(decryptedPlaintext.contains("***-**-REDACTED"));
    }

    @Test
    @DisplayName("Формирование ответа об ошибке строго соответствует стандарту RFC 9457 ProblemDetail в Spring Boot 3.4")
    void shouldProduceRfc9457CompliantProblemDetailOnAuthFailure() {
        ProblemDetail problem = BankingProblemDetailFactory.createUnauthorizedProblem(
                "/api/v1/transfers", "Bearer token is missing or expired", "TRACE-771"
        );

        assertEquals(401, problem.getStatus());
        assertEquals("Unauthorized Banking API Access", problem.getTitle());
        assertEquals("https://api.bank.enterprise/errors/unauthorized", problem.getType().toString());
        assertEquals("/api/v1/transfers", problem.getInstance().toString());
        assertEquals("TRACE-771", problem.getProperties().get("traceId"));
    }
}

```

#### 6. Refactored Architecture
Отрефакторенная архитектура реализует стратегию **Разделения сборки метаданных и выполнения (Separation of Assembly vs. Execution)**. На горячем пути запроса выполняется только легковесный захват неизменяемого события `RawAuditCaptureEvent` (Java 21 `record`) и неблокирующая постановка в ограниченную очередь `ArrayBlockingQueue` (обеспечивающую обратное давление — back-pressure), что гарантирует соблюдение бюджета задержки `<2ms p99`. Выделенный пул воркеров (`AsyncPiiCryptoAuditEngine`) асинхронно выполняет редактирование PII и аутентифицированное шифрование `AES/GCM/NoPadding` со случайным 96-битным вектором инициализации (IV) и локальным экземпляром `Cipher` без единого блока `synchronized`. Кроме того, внедрен метод `shutdownGracefully` для корректного дренирования очереди аудита при получении сигнала `SIGTERM` от оркестратора Kubernetes, а все ошибки аутентификации стандартизированы через RFC 9457 (`ProblemDetail`).

```java
package com.enterprise.security.modern;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

public record RawAuditCaptureEvent(
        String requestUri,
        String requestId,
        String rawPayload,
        Instant capturedAt
) {}

public record EncryptedAuditRecord(
        String requestId,
        String requestUri,
        String sha256IntegrityHash,
        String base64Iv,
        String base64CipherText,
        Instant processedAt
) {}

public final class BankingProblemDetailFactory {
    private BankingProblemDetailFactory() {}

    public static ProblemDetail createUnauthorizedProblem(String requestUri, String detail, String traceId) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, detail);
        problem.setTitle("Unauthorized Banking API Access");
        problem.setType(URI.create("https://api.bank.enterprise/errors/unauthorized"));
        problem.setInstance(URI.create(requestUri));
        problem.setProperty("traceId", traceId);
        problem.setProperty("timestamp", Instant.now().toString());
        return problem;
    }
}

public class AsyncPiiCryptoAuditEngine {

    private static final Pattern CARD_PAN_PATTERN = Pattern.compile("\\b(?:\\d[ -]*?){13,16}\\b");
    private static final Pattern SSN_PATTERN = Pattern.compile("\\b\\d{3}-\\d{2}-\\d{4}\\b");
    private static final int GCM_IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    private final SecretKeySpec aesKeySpec;
    private final SecureRandom secureRandom = new SecureRandom();
    private final BlockingQueue<RawAuditCaptureEvent> boundedQueue;
    private final ExecutorService cryptoWorkerPool;
    private final List<EncryptedAuditRecord> completedRecords = new CopyOnWriteArrayList<>();
    private final AtomicBoolean acceptingNewEvents = new AtomicBoolean(true);

    public AsyncPiiCryptoAuditEngine(byte[] aesKeyBytes, int queueCapacity) {
        if (aesKeyBytes == null || (aesKeyBytes.length != 16 && aesKeyBytes.length != 32)) {
            throw new IllegalArgumentException("AES key must be 128 or 256 bits");
        }
        this.aesKeySpec = new SecretKeySpec(aesKeyBytes, "AES");
        this.boundedQueue = new ArrayBlockingQueue<>(queueCapacity);

        int workers = Math.max(2, Runtime.getRuntime().availableProcessors() / 2);
        this.cryptoWorkerPool = Executors.newFixedThreadPool(workers, r -> {
            Thread t = new Thread(r, "pii-crypto-audit-worker");
            t.setDaemon(false);
            return t;
        });

        for (int i = 0; i < workers; i++) {
            this.cryptoWorkerPool.submit(this::workerLoop);
        }
    }

    /**
     * Неблокирующий захват метаданных на горячем пути (< 0.1 мс).
     * Сырой пейлоад никогда не пишется в синхронный лог.
     */
    public boolean enqueueAuditCapture(String requestUri, String requestId, String rawPayload) {
        if (!acceptingNewEvents.get()) {
            return false;
        }
        RawAuditCaptureEvent event = new RawAuditCaptureEvent(requestUri, requestId, rawPayload, Instant.now());
        return boundedQueue.offer(event);
    }

    private void workerLoop() {
        while (acceptingNewEvents.get() || !boundedQueue.isEmpty()) {
            try {
                RawAuditCaptureEvent event = boundedQueue.poll(50, TimeUnit.MILLISECONDS);
                if (event != null) {
                    completedRecords.add(scrubAndEncrypt(event));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private EncryptedAuditRecord scrubAndEncrypt(RawAuditCaptureEvent event) {
        try {
            String scrubbed = CARD_PAN_PATTERN.matcher(event.rawPayload()).replaceAll("****-****-****-REDACTED");
            scrubbed = SSN_PATTERN.matcher(scrubbed).replaceAll("***-**-REDACTED");

            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest(scrubbed.getBytes(StandardCharsets.UTF_8));
            String integrityHash = Base64.getEncoder().encodeToString(digest);

            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            // Инициализация собственного экземпляра Cipher без глобального synchronized
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv);
            cipher.init(Cipher.ENCRYPT_MODE, aesKeySpec, gcmSpec);
            byte[] cipherBytes = cipher.doFinal(scrubbed.getBytes(StandardCharsets.UTF_8));

            return new EncryptedAuditRecord(
                    event.requestId(),
                    event.requestUri(),
                    integrityHash,
                    Base64.getEncoder().encodeToString(iv),
                    Base64.getEncoder().encodeToString(cipherBytes),
                    Instant.now()
            );
        } catch (Exception e) {
            throw new IllegalStateException("Failed to scrub and encrypt PII audit event", e);
        }
    }

    public String decryptForVerification(EncryptedAuditRecord record) {
        try {
            byte[] iv = Base64.getDecoder().decode(record.base64Iv());
            byte[] cipherBytes = Base64.getDecoder().decode(record.base64CipherText());
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, aesKeySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(cipherBytes), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed", e);
        }
    }

    public void shutdownGracefully(long timeout, TimeUnit unit) throws InterruptedException {
        acceptingNewEvents.set(false);
        cryptoWorkerPool.shutdown();
        if (!cryptoWorkerPool.awaitTermination(timeout, unit)) {
            cryptoWorkerPool.shutdownNow();
        }
    }

    public List<EncryptedAuditRecord> getCompletedAuditRecords() {
        return List.copyOf(completedRecords);
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Защита данного архитектурного решения опирается на разграничение пулов потоков для I/O-bound и CPU-bound нагрузок, а также на выбор стратегии отказа при переполнении буфера аудита. Хотя входящие HTTP-запросы в Spring Boot 3.4 обслуживаются виртуальными потоками, фоновый пул `cryptoWorkerPool` намеренно спроектирован поверх фиксированного числа платформенных потоков (`Executors.newFixedThreadPool`), соразмерного числу доступных ядер процессора. Виртуальные потоки эффективны только для задач, проводящих время в ожидании ввода-вывода, тогда как прогон регулярных выражений, вычисление SHA-256 и шифрование AES-GCM являются чисто вычислительными задачами (CPU-bound), где создание тысяч виртуальных потоков лишь увеличит накладные расходы планировщика и вытеснение кэшей процессора без прироста пропускной способности.
Второй важный компромисс связан с политикой обратного давления (Back-Pressure) и бюджетами завершения работы (Shutdown Budgets) в Kubernetes. Ограниченная очередь `ArrayBlockingQueue` защищает кучу JVM от `OutOfMemoryError` при резких всплесках трафика. Однако в банковских системах уровня PCI DSS молчаливая потеря записи аудита при возврате `false` из `boundedQueue.offer(event)` недопустима: если очередь аудита заполнена на 100%, фильтр безопасности обязан отклонить входящий HTTP-запрос с кодом `503 Service Unavailable` в формате `ProblemDetail`, реализуя стратегию Fail-Closed. При этом в манифестах Kubernetes время `terminationGracePeriodSeconds` и `spring.lifecycle.timeout-per-shutdown-phase` должны быть согласованы так, чтобы после прекращения приема новых HTTP-запросов воркеры успели полностью дренировать и зашифровать оставшиеся в очереди элементы до принудительного завершения контейнера.

## Архетип 3.4: Антикоррупционный слой (Anti-Corruption Layer, ACL) для интеграции с мейнфреймами и внешними провайдерами
При пошаговой модернизации монолитных систем по паттерну «Душитель» (Strangler Fig) или при подключении современных микросервисов к унаследованным банковским ядрам (Core Banking / ERP / CRM) возникает фундаментальный конфликт моделей данных. Если новый микросервис напрямую импортирует сгенерированные SOAP/RPC-контракты или плоские структуры записей мейнфрейма с десятками криптографических полей (`CUST_STAT_CD_01`, `FLG_ACTIVE_YN`), «грязная» модель данных старой системы мгновенно разрушает единый язык (Ubiquitous Language) и инварианты нового доменного ядра.
В предметно-ориентированном проектировании (DDD) для защиты границ ограниченного контекста (Bounded Context) применяется **Антикоррупционный слой (Anti-Corruption Layer, ACL)**. Технически ACL представляет собой комбинацию паттернов **Фасад (Facade)**, **Адаптер (Adapter)** и **Транслятор (Translator/Mapper)**, размещаемую на границе микросервиса и регистрируемую в контейнере внедрения зависимостей. Эмпирические исследования модифицируемости микросервисных систем подтверждают, что применение паттерна Anti-Corruption Layer обеспечивает статистически значимое снижение коэффициента распространения изменений (Change Impact Factor, CIF) на величину $-0.599$ ($95\%$ доверительный интервал), предотвращая каскадные правки при изменении внешних контрактов. В то же время введение дополнительного слоя трансляции неизбежно добавляет небольшую задержку (Latency overhead) на сериализацию и маппинг, которую необходимо учитывать при проектировании высокочастотных вызовов.

| Паттерн интеграции контекстов DDD | Вектор контроля контракта | Архитектурный механизм | Сценарий применения и жизненный цикл при миграции |
| --- | --- | --- | --- |
| **Conformist (Конформист)** | Полный диктат внешней/унаследованной системы | Прямое использование внешних DTO внутри доменной логики потребителя | Допустимо только для тонких адаптеров без собственной бизнес-логики; разрушительно для ядерных доменов |
| **Anti-Corruption Layer (ACL)** | Защита внутреннего контекста от внешней легаси-модели | Выделенный порт домена + ACL-адаптер + двусторонний транслятор/фасад | Интеграция с мейнфреймами, внешними 3PL/платежными системами и модулями монолита (удаляется после вывода модуля монолита из эксплуатации) |
| **Open Host Service (OHS) + Published Language** | Стандартизация публичного протокола поставщиком | Версионированный OpenAPI 3.1 / Protobuf / канонические интеграционные события в Kafka | Публикация событий нового микросервиса наружу в качестве защищенного контракта для множества потребителей |

### Kata 7: [L3-REF-07] CoreBankingLegacyConnectorACL — Построение антикоррупционного слоя (ACL) для интеграции с мейнфреймом АБС (Core Banking SOAP/RPC)

#### 1. Title & Grade
**[L3-REF-07] CoreBankingLegacyConnectorACL** — Изоляция современного микросервиса кредитного скоринга и выдачи займов от 15-летнего SOAP/COBOL-контракта банковского мейнфрейма через Anti-Corruption Layer (ACL). Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача регулярно дается на собеседованиях уровня Staff/Principal в крупных финтех-экосистемах и цифровых банках (**Stripe Treasury**, **T-Bank / Tinkoff Core**, **Sber / Alfa Core Architecture**). Новый микросервис кредитного конвейера вынужден запрашивать профиль клиента и лимиты овердрафта из унаследованной автоматизированной банковской системы (АБС), возвращающей плоские структуры с шестнадцатеричными кодами ошибок, юлианскими датами (`YYYYDDD`), суммами в центах со знаковыми суффиксами COBOL (`"0000150000+"`) и позиционными флагами.

#### 3. The Legacy Code (150–250 lines)
В приведенном ниже фрагменте разработчик пошел по пути антипаттерна «Конформист» и импортировал сгенерированный из WSDL/COBOL класс `MainframeCustAcctSoapRecord` прямо в доменный сервис принятия кредитных решений, размазав парсинг криптографических кодов по бизнес-правилам и REST-ответу.

```java
package com.enterprise.legacy.bankingacl;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Сгенерированный из унаследованного COBOL Copybook / SOAP контракта DTO мейнфрейма АБС.
 * Содержит криптографические мнемоники столбцов 15-летней давности.
 */
public class MainframeCustAcctSoapRecord {
    public String CUST_ID_CHAR12;
    public String CUST_STAT_CD_01;       // "01"=Active, "02"=Frozen, "09"=Bankrupt, "99"=Deceased
    public String FLG_ACTIVE_YN;         // "Y" или "N"
    public String FLG_SANCTIONS_HIT_01;  // "0" = Чисто, "1" = В списке санкций, " " = Не проверено
    public String BAL_AMT_CENTS_SGN;     // COBOL signed string: "0000250000+" (+2500.00) или "0000045000-" (-450.00)
    public String OVRDRFT_LMT_CD;        // "T0"=0, "T1"=1000, "T2"=5000, "T3"=25000
    public String DT_LAST_KYCD_JULIAN;   // Юлианская дата мейнфрейма в формате YYYYDDD, например "2026100"
    public String ERR_HEX_RET_CD;        // "0000" = OK, "00F1" = Record Locked, "00FA" = Not Found

    public MainframeCustAcctSoapRecord() {}
}

interface LegacyMainframeSoapRpcStub {
    MainframeCustAcctSoapRecord invokeCicsTransactionCac1(String paddedCustomerId12);
}

/**
 * АНТИПАТТЕРН: Современный сервис кредитного конвейера напрямую зависит от MainframeCustAcctSoapRecord.
 * Любое изменение формата поля на мейнфрейме обрушивает бизнес-логику и публичный REST API.
 */
@Service
class CorruptedLoanOriginationService {

    private final LegacyMainframeSoapRpcStub soapRpcStub;

    public CorruptedLoanOriginationService(LegacyMainframeSoapRpcStub soapRpcStub) {
        this.soapRpcStub = soapRpcStub;
    }

    public Map<String, Object> evaluateLoanApplication(
            String customerId,
            BigDecimal requestedLoanAmount,
            LocalDate currentDate) {

        String paddedId = String.format("%-12s", customerId).substring(0, 12);
        MainframeCustAcctSoapRecord mfRec = soapRpcStub.invokeCicsTransactionCac1(paddedId);

        if (!"0000".equals(mfRec.ERR_HEX_RET_CD)) {
            if ("00F1".equals(mfRec.ERR_HEX_RET_CD)) {
                throw new RuntimeException("Mainframe CICS lock error 00F1");
            }
            throw new IllegalArgumentException("Mainframe error hex: " + mfRec.ERR_HEX_RET_CD);
        }

        // Размазывание декодирования COBOL-флагов прямо внутри правил кредитного скоринга
        if (!"Y".equals(mfRec.FLG_ACTIVE_YN) || !"01".equals(mfRec.CUST_STAT_CD_01)) {
            return buildCorruptedResponse(mfRec, "REJECTED_INACTIVE_OR_BLOCKED", BigDecimal.ZERO);
        }

        if ("1".equals(mfRec.FLG_SANCTIONS_HIT_01) || " ".equals(mfRec.FLG_SANCTIONS_HIT_01)) {
            return buildCorruptedResponse(mfRec, "REJECTED_COMPLIANCE", BigDecimal.ZERO);
        }

        // Ручной парсинг юлианской даты YYYYDDD прямо посреди бизнес-метода
        LocalDate lastKycDate = LocalDate.parse(mfRec.DT_LAST_KYCD_JULIAN, DateTimeFormatter.ORDINAL_DATE);
        if (lastKycDate.isBefore(currentDate.minusDays(365))) {
            return buildCorruptedResponse(mfRec, "REJECTED_KYC_EXPIRED", BigDecimal.ZERO);
        }

        // Ручной парсинг знаковой строки баланса в центах
        String rawBal = mfRec.BAL_AMT_CENTS_SGN.trim();
        char sign = rawBal.charAt(rawBal.length() - 1);
        long cents = Long.parseLong(rawBal.substring(0, rawBal.length() - 1));
        BigDecimal balance = BigDecimal.valueOf(sign == '-' ? -cents : cents)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal overdraftLimit = BigDecimal.ZERO;
        if ("T1".equals(mfRec.OVRDRFT_LMT_CD)) {
            overdraftLimit = new BigDecimal("1000.00");
        } else if ("T2".equals(mfRec.OVRDRFT_LMT_CD)) {
            overdraftLimit = new BigDecimal("5000.00");
        } else if ("T3".equals(mfRec.OVRDRFT_LMT_CD)) {
            overdraftLimit = new BigDecimal("25000.00");
        }

        BigDecimal effectiveLiquidity = balance.add(overdraftLimit);
        BigDecimal maxAllowedLoan = effectiveLiquidity.multiply(BigDecimal.valueOf(3));

        if (requestedLoanAmount.compareTo(maxAllowedLoan) <= 0) {
            return buildCorruptedResponse(mfRec, "APPROVED", requestedLoanAmount);
        } else {
            return buildCorruptedResponse(mfRec, "REJECTED_INSUFFICIENT_LIQUIDITY", maxAllowedLoan);
        }
    }

    private Map<String, Object> buildCorruptedResponse(
            MainframeCustAcctSoapRecord mfRec,
            String decision,
            BigDecimal approvedAmount) {
        Map<String, Object> response = new HashMap<>();
        response.put("decision", decision);
        response.put("approvedAmount", approvedAmount);
        // Утечка полей мейнфрейма наружу в публичный ответ микросервиса!
        response.put("CUST_STAT_CD_01", mfRec.CUST_STAT_CD_01);
        response.put("FLG_ACTIVE_YN", mfRec.FLG_ACTIVE_YN);
        response.put("OVRDRFT_LMT_CD", mfRec.OVRDRFT_LMT_CD);
        return response;
    }
}

```

#### 4. Architectural Smells & Systemic Risks
В представленном сервисе кредитного конвейера допущена полная коррупция доменной модели внешним легаси-протоколом. Во-первых, наблюдается разрушение единого языка предметной области (Ubiquitous Language Corruption): вместо ясных доменных понятий «Кредитный профиль клиента», «Статус комплаенс-проверки» и «Доступная ликвидность» алгоритм принятия кредитного решения оперирует низкоуровневыми константами мейнфрейма `"00F1"`, `"T2"`, `"0000250000+"` и `FLG_SANCTIONS_HIT_01`.
Во-вторых, происходит сквозная утечка контракта мейнфрейма во внешнее API нового микросервиса: метод `buildCorruptedResponse` помещает поля `CUST_STAT_CD_01`, `FLG_ACTIVE_YN` и `OVRDRFT_LMT_CD` напрямую в выходную карту ответа. В результате фронтенд-приложения и смежные микросервисы также становятся транзитивно завязанными на схему таблиц 15-летней АБС, что поднимает коэффициент распространения изменений (CIF) до критических значений и делает невозможным последующий вывод мейнфрейма из эксплуатации. В-третьих, выполнение низкоуровневого парсинга знаковых строк и юлианских дат прямо внутри бизнес-сервиса приводит к тому, что любая аномалия кодировки CICS (например, пустая дата `"0000000"`) выбрасывает неинформативные исключения времени выполнения посреди расчета кредитного лимита.

#### 5. Characterization Harness
Тестовый контур проверяет корректность трансляции всех граничных форматов мейнфрейма (положительные и отрицательные знаковые балансы COBOL, юлианские даты `YYYYDDD`, комбинации флагов активности и кодов возврата `00F1`) в чистую доменную модель, а также с помощью ArchUnit блокирует любое проникновение пакета `..legacy.bankingacl..` в доменное и прикладное ядро.

```java
package com.enterprise.bankingacl;

import com.enterprise.legacy.bankingacl.MainframeCustAcctSoapRecord;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.*;

public class CoreBankingAclVerificationTest {

    @Test
    @DisplayName("ACL-транслятор корректно преобразует знаковые балансы COBOL, юлианские даты и коды овердрафта в чистую модель")
    void shouldTranslateCrypticMainframeRecordIntoCleanDomainProfile() {
        MainframeCustAcctSoapRecord soapRecord = new MainframeCustAcctSoapRecord();
        soapRecord.CUST_ID_CHAR12 = "CUST-8841   ";
        soapRecord.ERR_HEX_RET_CD = "0000";
        soapRecord.CUST_STAT_CD_01 = "01";
        soapRecord.FLG_ACTIVE_YN = "Y";
        soapRecord.FLG_SANCTIONS_HIT_01 = "0";
        soapRecord.BAL_AMT_CENTS_SGN = "0000250050+"; // +2500.50
        soapRecord.OVRDRFT_LMT_CD = "T2";             // 5000.00
        soapRecord.DT_LAST_KYCD_JULIAN = "2026100";   // 100-й день 2026 года (10 апреля 2026)

        MainframeToDomainProfileTranslator translator = new MainframeToDomainProfileTranslator();
        CustomerCreditProfile profile = translator.translate(soapRecord);

        assertEquals("CUST-8841", profile.customerId());
        assertEquals(AccountStanding.GOOD_STANDING, profile.standing());
        assertEquals(ComplianceStatus.CLEARED, profile.complianceStatus());
        assertEquals(new BigDecimal("2500.50"), profile.currentBalance());
        assertEquals(new BigDecimal("5000.00"), profile.overdraftLimit());
        assertEquals(LocalDate.of(2026, 4, 10), profile.lastKycVerifiedDate());

        LoanOriginationDomainService domainService = new LoanOriginationDomainService(id -> profile);
        LoanDecision decision = domainService.evaluateLoan(
                "CUST-8841", new BigDecimal("20000.00"), LocalDate.of(2026, 10, 17)
        );

        // Эффективная ликвидность = 2500.50 + 5000.00 = 7500.50; макс. кредит (x3) = 22501.50 >= 20000.00
        assertInstanceOf(LoanDecision.Approved.class, decision);
        assertEquals(new BigDecimal("20000.00"), ((LoanDecision.Approved) decision).approvedAmount());
    }

    @Test
    @DisplayName("ACL корректно распознает отрицательный баланс COBOL и блокирует выдачу при просроченном KYC")
    void shouldHandleNegativeCobolBalanceAndExpiredKyc() {
        MainframeCustAcctSoapRecord soapRecord = new MainframeCustAcctSoapRecord();
        soapRecord.CUST_ID_CHAR12 = "CUST-9002   ";
        soapRecord.ERR_HEX_RET_CD = "0000";
        soapRecord.CUST_STAT_CD_01 = "01";
        soapRecord.FLG_ACTIVE_YN = "Y";
        soapRecord.FLG_SANCTIONS_HIT_01 = "0";
        soapRecord.BAL_AMT_CENTS_SGN = "0000045025-"; // -450.25
        soapRecord.OVRDRFT_LMT_CD = "T1";             // 1000.00
        soapRecord.DT_LAST_KYCD_JULIAN = "2024050";   // Просроченный KYC (> 365 дней)

        MainframeToDomainProfileTranslator translator = new MainframeToDomainProfileTranslator();
        CustomerCreditProfile profile = translator.translate(soapRecord);

        assertEquals(new BigDecimal("-450.25"), profile.currentBalance());

        LoanOriginationDomainService domainService = new LoanOriginationDomainService(id -> profile);
        LoanDecision decision = domainService.evaluateLoan(
                "CUST-9002", new BigDecimal("500.00"), LocalDate.of(2026, 10, 17)
        );

        assertInstanceOf(LoanDecision.Rejected.class, decision);
        assertEquals(RejectionReason.KYC_EXPIRED, ((LoanDecision.Rejected) decision).reason());
    }

    @Test
    @DisplayName("ArchUnit: Доменный сервис кредитования не имеет права импортировать классы легаси-мейнфрейма")
    void domainShouldNeverImportMainframeSoapClasses() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.enterprise.bankingacl");
        noClasses()
                .that().resideInAPackage("..bankingacl..")
                .and().haveSimpleNameNotContaining("Translator")
                .and().haveSimpleNameNotContaining("AclAdapter")
                .and().haveSimpleNameNotContaining("Test")
                .should().dependOnClassesThat().resideInAPackage("..legacy.bankingacl..")
                .check(classes);
    }
}

```

#### 6. Refactored Architecture
В целевой архитектуре доменное ядро (`LoanOriginationDomainService`) работает исключительно с чистыми доменными абстракциями (`CustomerCreditProfile`, `AccountStanding`, `ComplianceStatus`, запечатанный результат `LoanDecision`) через исходящий порт `CustomerCreditProfilePort`. Вся логика форматирования 12-символьных ключей CICS, разбора шестнадцатеричных кодов ошибок, знаковых строк COBOL и юлианских дат полностью локализована внутри `MainframeToDomainProfileTranslator` и антикоррупционного адаптера.

```java
package com.enterprise.bankingacl;

import com.enterprise.legacy.bankingacl.MainframeCustAcctSoapRecord;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

public enum AccountStanding {
    GOOD_STANDING, SUSPENDED, INSOLVENT_OR_CLOSED
}

public enum ComplianceStatus {
    CLEARED, SANCTIONED_OR_UNVERIFIED
}

public enum RejectionReason {
    ACCOUNT_NOT_IN_GOOD_STANDING,
    COMPLIANCE_RESTRICTION,
    KYC_EXPIRED,
    INSUFFICIENT_LIQUIDITY
}

public record CustomerCreditProfile(
        String customerId,
        AccountStanding standing,
        ComplianceStatus complianceStatus,
        BigDecimal currentBalance,
        BigDecimal overdraftLimit,
        LocalDate lastKycVerifiedDate
) {
    public BigDecimal effectiveLiquidity() {
        return currentBalance.add(overdraftLimit);
    }
}

public sealed interface LoanDecision permits LoanDecision.Approved, LoanDecision.Rejected {
    record Approved(String customerId, BigDecimal approvedAmount) implements LoanDecision {}
    record Rejected(String customerId, RejectionReason reason, BigDecimal maxEligibleAmount) implements LoanDecision {}
}

public interface CustomerCreditProfilePort {
    CustomerCreditProfile fetchCreditProfile(String customerId);
}

/**
 * Чистый доменный сервис принятия кредитных решений, полностью защищенный от деталей мейнфрейма.
 */
public class LoanOriginationDomainService {

    private final CustomerCreditProfilePort creditProfilePort;

    public LoanOriginationDomainService(CustomerCreditProfilePort creditProfilePort) {
        this.creditProfilePort = creditProfilePort;
    }

    public LoanDecision evaluateLoan(String customerId, BigDecimal requestedAmount, LocalDate evaluationDate) {
        CustomerCreditProfile profile = creditProfilePort.fetchCreditProfile(customerId);

        if (profile.standing() != AccountStanding.GOOD_STANDING) {
            return new LoanDecision.Rejected(customerId, RejectionReason.ACCOUNT_NOT_IN_GOOD_STANDING, BigDecimal.ZERO);
        }
        if (profile.complianceStatus() != ComplianceStatus.CLEARED) {
            return new LoanDecision.Rejected(customerId, RejectionReason.COMPLIANCE_RESTRICTION, BigDecimal.ZERO);
        }
        if (profile.lastKycVerifiedDate().isBefore(evaluationDate.minusDays(365))) {
            return new LoanDecision.Rejected(customerId, RejectionReason.KYC_EXPIRED, BigDecimal.ZERO);
        }

        BigDecimal maxEligible = profile.effectiveLiquidity()
                .multiply(BigDecimal.valueOf(3))
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        if (requestedAmount.compareTo(maxEligible) <= 0) {
            return new LoanDecision.Approved(customerId, requestedAmount);
        }
        return new LoanDecision.Rejected(customerId, RejectionReason.INSUFFICIENT_LIQUIDITY, maxEligible);
    }
}

/**
 * Транслятор Антикоррупционного Слоя (ACL Translator).
 * Инкапсулирует все правила разбора COBOL/CICS мнемоник и преобразует их в доменные типы.
 */
public class MainframeToDomainProfileTranslator {

    public CustomerCreditProfile translate(MainframeCustAcctSoapRecord raw) {
        Objects.requireNonNull(raw, "Mainframe record cannot be null");

        switch (raw.ERR_HEX_RET_CD) {
            case "0000" -> { /* Успешный ответ CICS */ }
            case "00F1" -> throw new IllegalStateException("Transient mainframe record lock (00F1)");
            case "00FA" -> throw new IllegalArgumentException("Customer record not found on mainframe (00FA)");
            case null, default -> throw new IllegalStateException("Unexpected mainframe hex code: " + raw.ERR_HEX_RET_CD);
        }

        String cleanId = raw.CUST_ID_CHAR12 != null ? raw.CUST_ID_CHAR12.trim() : "";

        AccountStanding standing = ("Y".equals(raw.FLG_ACTIVE_YN) && "01".equals(raw.CUST_STAT_CD_01))
                ? AccountStanding.GOOD_STANDING
                : ("02".equals(raw.CUST_STAT_CD_01) ? AccountStanding.SUSPENDED : AccountStanding.INSOLVENT_OR_CLOSED);

        ComplianceStatus compliance = "0".equals(raw.FLG_SANCTIONS_HIT_01)
                ? ComplianceStatus.CLEARED
                : ComplianceStatus.SANCTIONED_OR_UNVERIFIED;

        BigDecimal balance = parseCobolSignedCents(raw.BAL_AMT_CENTS_SGN);
        BigDecimal overdraft = parseOverdraftTier(raw.OVRDRFT_LMT_CD);
        LocalDate kycDate = parseJulianDate(raw.DT_LAST_KYCD_JULIAN);

        return new CustomerCreditProfile(cleanId, standing, compliance, balance, overdraft, kycDate);
    }

    private BigDecimal parseCobolSignedCents(String cobolField) {
        if (cobolField == null || cobolField.isBlank()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        String trimmed = cobolField.trim();
        char sign = trimmed.charAt(trimmed.length() - 1);
        long cents = Long.parseLong(trimmed.substring(0, trimmed.length() - 1));
        long signedCents = (sign == '-') ? -cents : cents;
        return BigDecimal.valueOf(signedCents, 2);
    }

    private BigDecimal parseOverdraftTier(String tierCode) {
        return switch (tierCode) {
            case "T0", null -> new BigDecimal("0.00");
            case "T1" -> new BigDecimal("1000.00");
            case "T2" -> new BigDecimal("5000.00");
            case "T3" -> new BigDecimal("25000.00");
            default -> throw new IllegalArgumentException("Unknown mainframe overdraft tier: " + tierCode);
        };
    }

    private LocalDate parseJulianDate(String julianYyyyDdd) {
        if (julianYyyyDdd == null || julianYyyyDdd.length() != 7) {
            throw new IllegalArgumentException("Invalid mainframe Julian date: " + julianYyyyDdd);
        }
        return LocalDate.parse(julianYyyyDdd, DateTimeFormatter.ofPattern("yyyyDDD"));
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Защита данного решения на уровне Staff/Principal фокусируется на выборе топологии развертывания ACL (внутрипроцессный модуль против выделенного микросервиса-шлюза) и жизненном цикле антикоррупционного слоя в стратегии Strangler Fig. Антикоррупционный слой может быть реализован как модульный адаптер внутри самого микросервиса кредитования либо как отдельный развертываемый сервис-посредник. Если к одной и той же транзакции мейнфрейма обращаются десять различных микросервисов, вынос ACL в отдельный пограничный сервис позволяет централизованно управлять пулом сессий CICS/MQ и квотами нагрузки на мейнфрейм, однако добавляет дополнительный сетевой прыжок (Latency overhead) и снижает общую доступность из-за синхронной цепочки вызовов (Synchronous Service Chain). Поэтому для критичных по задержке путей предпочтителен внутрипроцессный ACL-адаптер в сочетании с асинхронной выгрузкой изменений мейнфрейма в локальную проекцию чтения (CQRS Read Model). После того как соответствующий модуль унаследованного монолита или мейнфрейма полностью выводится из эксплуатации в рамках паттерна Strangler Fig, антикоррупционный слой безопасно удаляется без малейших изменений в коде `LoanOriginationDomainService`.

### Kata 8: [L3-REF-08] ThirdPartyLogisticsTranslator — Антикоррупционный слой (ACL) и идемпотентный шлюз для полиглотной интеграции с внешними 3PL-провайдерами

#### 1. Title & Grade
**[L3-REF-08] ThirdPartyLogisticsTranslator** — Построение входящего и исходящего антикоррупционного слоя (ACL) для интеграции с внешними логистическими провайдерами (3PL) и защита инвариантов агрегата доставки от дублирующихся и приходящих не по порядку (out-of-order) вебхуков. Целевой грейд: **Staff Software Engineer / Principal Architect (L3)**.

#### 2. Company Context
Задача основана на реальных архитектурных интервью в **Ozon Logistics / Fulfillment**, **Yandex Delivery** и глобальных цепочках поставок. Платформа электронной коммерции интегрирована с десятками внешних курьерских служб (3PL), каждая из которых присылает вебхуки о статусе посылки в собственном формате (битовые маски, XML-коды, плоский JSON) и без гарантий порядка доставки по сети.

#### 3. The Legacy Code (150–250 lines)
В унаследованном коде ниже контроллер вебхуков принимает сырые DTO разных логистических провайдеров, напрямую модифицирует сущность `LegacyShipmentEntity` без оптимистической блокировки (`@Version`) и без проверки монотонности перехода состояний, а затем публикует внутреннюю сущность БД напрямую в Kafka.

```java
package com.enterprise.legacy.logistics;

import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "shipments")
public class LegacyShipmentEntity {

    @Id
    private String shipmentId;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(name = "carrier_code", nullable = false)
    private String carrierCode; // "FAST_EXPRESS" или "GLOBAL_CARGO"

    @Column(name = "external_tracking_num")
    private String externalTrackingNum;

    @Column(name = "internal_status", nullable = false)
    private String internalStatus; // CREATED, PICKED_UP, IN_TRANSIT, DELIVERED, LOST

    @Column(name = "raw_provider_bitmask")
    private Integer rawProviderBitmask;

    @Column(name = "raw_provider_subcode")
    private String rawProviderSubcode;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public LegacyShipmentEntity() {}

    public LegacyShipmentEntity(
            String shipmentId,
            String orderId,
            String carrierCode,
            String externalTrackingNum,
            String internalStatus,
            Instant updatedAt) {
        this.shipmentId = shipmentId;
        this.orderId = orderId;
        this.carrierCode = carrierCode;
        this.externalTrackingNum = externalTrackingNum;
        this.internalStatus = internalStatus;
        this.updatedAt = updatedAt;
    }

    public String getShipmentId() { return shipmentId; }
    public String getOrderId() { return orderId; }
    public String getCarrierCode() { return carrierCode; }
    public String getExternalTrackingNum() { return externalTrackingNum; }
    public String getInternalStatus() { return internalStatus; }
    public void setInternalStatus(String internalStatus) { this.internalStatus = internalStatus; }
    public Integer getRawProviderBitmask() { return rawProviderBitmask; }
    public void setRawProviderBitmask(Integer rawProviderBitmask) { this.rawProviderBitmask = rawProviderBitmask; }
    public String getRawProviderSubcode() { return rawProviderSubcode; }
    public void setRawProviderSubcode(String rawProviderSubcode) { this.rawProviderSubcode = rawProviderSubcode; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

interface LegacyShipmentRepository extends JpaRepository<LegacyShipmentEntity, String> {}

/**
 * Сырой контракт вебхука провайдера №1 (FastExpress) с битовыми масками.
 */
class FastExpressWebhookDto {
    public String shipment_guid;
    public int shp_stat_bitmask; // 1 = Принят, 2 = В пути, 4 = Доставлен, 128 = Утерян
    public long unix_epoch_sec;
}

/**
 * Сырой контракт вебхука провайдера №2 (GlobalCargo) с вложенными кодами терминалов.
 */
class GlobalCargoXmlWebhookDto {
    public String waybillRef;
    public String terminalActionCode; // "TERM_IN", "LINEHAUL_DEP", "HANDOVER_OK", "DAMAGED_LOST"
    public String isoTimestamp;
}

@Service
class LegacyLogisticsWebhookService {

    @Autowired
    private LegacyShipmentRepository shipmentRepository;

    /**
     * АНТИПАТТЕРН 1: Отсутствие антикоррупционного слоя — разбор битовых масок внешнего провайдера
     * и сохранение сырых полей провайдера прямо в доменную таблицу shipments.
     * АНТИПАТТЕРН 2: Отсутствие защиты от Out-of-Order вебхуков и гонок (потерянное обновление).
     * Если вебхук "В пути" (bitmask=2) задержался в сети и пришел ПОСЛЕ вебхука "Доставлен" (bitmask=4),
     * статус доставленного заказа откатится назад в "IN_TRANSIT"!
     */
    @Transactional
    public LegacyShipmentEntity handleFastExpressWebhook(FastExpressWebhookDto dto) {
        LegacyShipmentEntity shipment = shipmentRepository.findById(dto.shipment_guid)
                .orElseThrow(() -> new IllegalArgumentException("Unknown shipment: " + dto.shipment_guid));

        shipment.setRawProviderBitmask(dto.shp_stat_bitmask);
        shipment.setUpdatedAt(Instant.ofEpochSecond(dto.unix_epoch_sec));

        if ((dto.shp_stat_bitmask & 128) != 0) {
            shipment.setInternalStatus("LOST");
        } else if ((dto.shp_stat_bitmask & 4) != 0) {
            shipment.setInternalStatus("DELIVERED");
        } else if ((dto.shp_stat_bitmask & 2) != 0) {
            shipment.setInternalStatus("IN_TRANSIT");
        } else if ((dto.shp_stat_bitmask & 1) != 0) {
            shipment.setInternalStatus("PICKED_UP");
        }

        return shipmentRepository.save(shipment);
    }

    @Transactional
    public LegacyShipmentEntity handleGlobalCargoWebhook(GlobalCargoXmlWebhookDto dto) {
        LegacyShipmentEntity shipment = shipmentRepository.findById(dto.waybillRef)
                .orElseThrow(() -> new IllegalArgumentException("Unknown shipment: " + dto.waybillRef));

        shipment.setRawProviderSubcode(dto.terminalActionCode);
        shipment.setUpdatedAt(Instant.parse(dto.isoTimestamp));

        switch (dto.terminalActionCode) {
            case "TERM_IN":
                shipment.setInternalStatus("PICKED_UP");
                break;
            case "LINEHAUL_DEP":
                shipment.setInternalStatus("IN_TRANSIT");
                break;
            case "HANDOVER_OK":
                shipment.setInternalStatus("DELIVERED");
                break;
            case "DAMAGED_LOST":
                shipment.setInternalStatus("LOST");
                break;
            default:
                throw new IllegalArgumentException("Unknown terminal code: " + dto.terminalActionCode);
        }

        return shipmentRepository.save(shipment);
    }

    public Map<String, Object> buildDownstreamKafkaEvent(LegacyShipmentEntity entity) {
        // АНТИПАТТЕРН 3: Публикация внутренней структуры БД со специфичными для 3PL-провайдеров полями
        return Map.of(
                "shipmentId", entity.getShipmentId(),
                "orderId", entity.getOrderId(),
                "status", entity.getInternalStatus(),
                "rawBitmask", entity.getRawProviderBitmask() != null ? entity.getRawProviderBitmask() : -1,
                "rawSubcode", entity.getRawProviderSubcode() != null ? entity.getRawProviderSubcode() : ""
        );
    }
}

```

#### 4. Architectural Smells & Systemic Risks
Данный сервис обработки логистических вебхуков подвержен трем разрушительным системным эффектам. Первая проблема заключается в регрессии состояния агрегата при доставке вебхуков не по порядку (Out-of-Order Webhook State Regression): внешние 3PL-провайдеры отправляют HTTP-уведомления через распределенные пулы ретраев без гарантии сохранения хронологического порядка. В унаследованном коде задержавшийся в сети вебхук `IN_TRANSIT` безусловно перезаписывает уже установленный терминальный статус `DELIVERED`, что приводит к ложным уведомлениям покупателя и блокировке расчетов с продавцом.
Вторая уязвимость связана с отсутствием оптимистической блокировки (`@Version`): когда внешний провайдер одновременно присылает два вебхука (или дубликат одного события), две параллельные транзакции читают одно и то же состояние `LegacyShipmentEntity` и перезаписывают изменения друг друга, вызывая потерю обновлений (Lost Update Conflict). Третий дефект нарушает принцип открытости-закрытости (Open-Closed Principle) и разрушает изоляцию контекстов: подключение каждого нового логистического партнера вынуждает команду добавлять специфичные для провайдера столбцы (`raw_provider_bitmask`, `raw_provider_subcode`) в центральную таблицу `shipments` и пробрасывать их в выходные события Kafka, превращая внутреннюю схему БД в хрупкий публичный контракт.

#### 5. Characterization Harness
Тестовый контур проверяет работу реестра ACL-трансляторов для обоих форматов провайдеров (`FastExpress` и `GlobalCargo`), естественную идемпотентность и монотонность переходов состояний агрегата `ShipmentAggregate` при поступлении дубликатов и задержавшихся вебхуков (`DELIVERED` не может откатиться в `IN_TRANSIT` или `PICKED_UP`), а также контроль версий оптимистической блокировки.

```java
package com.enterprise.logistics.acl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class ThirdPartyLogisticsAclVerificationTest {

    @Test
    @DisplayName("Агрегат доставки монотонно продвигает статус и игнорирует запаздывающие Out-of-Order вебхуки и дубликаты")
    void shouldEnforceMonotonicStateProgressionAndIgnoreOutOfOrderWebhooks() {
        FastExpressAclTranslator fastTranslator = new FastExpressAclTranslator();
        GlobalCargoAclTranslator cargoTranslator = new GlobalCargoAclTranslator();

        ShipmentAggregate shipment = ShipmentAggregate.createNew("SHP-700", "ORD-555", "FAST_EXPRESS");
        assertEquals(ShipmentLifecycleStage.CREATED, shipment.stage());
        assertEquals(0L, shipment.version());

        // 1. Приходит вебхук о вручении посылки клиенту (bitmask = 4 -> DELIVERED)
        CanonicalCarrierMilestone deliveredEvent = fastTranslator.translate(
                "SHP-700", 4, 1776384000L
        );
        ShipmentTransitionOutcome firstOutcome = shipment.applyMilestone(deliveredEvent);
        assertTrue(firstOutcome.stateChanged());
        assertEquals(ShipmentLifecycleStage.DELIVERED, firstOutcome.updatedAggregate().stage());
        assertEquals(1L, firstOutcome.updatedAggregate().version());

        ShipmentAggregate afterDelivery = firstOutcome.updatedAggregate();

        // 2. Из-за сетевой задержки приходит более ранний вебхук "В пути" (bitmask = 2 -> IN_TRANSIT)
        CanonicalCarrierMilestone delayedInTransitEvent = fastTranslator.translate(
                "SHP-700", 2, 1776380000L
        );
        ShipmentTransitionOutcome outOfOrderOutcome = afterDelivery.applyMilestone(delayedInTransitEvent);

        // Естественная идемпотентность доменной модели: регрессия состояния заблокирована, версия не инкрементирована
        assertFalse(outOfOrderOutcome.stateChanged());
        assertEquals(ShipmentLifecycleStage.DELIVERED, outOfOrderOutcome.updatedAggregate().stage());
        assertEquals(1L, outOfOrderOutcome.updatedAggregate().version());
        assertTrue(outOfOrderOutcome.emittedIntegrationEvent().isEmpty());

        // 3. Проверка транслятора второго провайдера (GlobalCargo)
        CanonicalCarrierMilestone cargoMilestone = cargoTranslator.translate(
                "SHP-701", "LINEHAUL_DEP", "2026-10-17T01:30:00Z"
        );
        assertEquals(ShipmentLifecycleStage.IN_TRANSIT, cargoMilestone.targetStage());
    }
}

```

#### 6. Refactored Architecture
Отрефакторенная архитектура вводит двухсторонний антикоррупционный слой и монотонную машину состояний агрегата. Во входящем контуре изолированные адаптеры `FastExpressAclTranslator` и `GlobalCargoAclTranslator` преобразуют специфичные форматы провайдеров (битовые маски, коды терминалов) в единое каноническое доменное событие `CanonicalCarrierMilestone`. Внутри ядра естественно идемпотентный агрегат `ShipmentAggregate` использует перечисление `ShipmentLifecycleStage`, задающее строгий порядок рангов состояний (`precedenceRank`): любая попытка применить событие с меньшим или равным рангом (дубликат или запоздавший вебхук) обрабатывается как безопасная холостая операция (`no-op`), а поле `version` обеспечивает оптимистическую блокировку при сохранении. В исходящем контуре формируется строго типизированное событие `ShipmentIntegrationEvent`, выступающее в качестве защищенного контракта (Outbound ACL / Published Language) для публикации в Kafka без утечки внутренних деталей провайдеров.

```java
package com.enterprise.logistics.acl;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public enum ShipmentLifecycleStage {
    CREATED(10, false),
    PICKED_UP(20, false),
    IN_TRANSIT(30, false),
    DELIVERED(100, true),
    LOST(100, true);

    private final int precedenceRank;
    private final boolean terminal;

    ShipmentLifecycleStage(int precedenceRank, boolean terminal) {
        this.precedenceRank = precedenceRank;
        this.terminal = terminal;
    }

    public boolean canTransitionTo(ShipmentLifecycleStage candidate) {
        if (this.terminal) {
            return false;
        }
        return candidate.precedenceRank > this.precedenceRank;
    }
}

/**
 * Каноническая доменная модель события от любого 3PL-провайдера после прохождения входящего ACL.
 */
public record CanonicalCarrierMilestone(
        String shipmentId,
        String carrierCode,
        ShipmentLifecycleStage targetStage,
        Instant occurredAt
) {
    public CanonicalCarrierMilestone {
        Objects.requireNonNull(shipmentId);
        Objects.requireNonNull(carrierCode);
        Objects.requireNonNull(targetStage);
        Objects.requireNonNull(occurredAt);
    }
}

/**
 * Защищенное интеграционное событие (Published Language / Outbound ACL) для публикации в Kafka.
 */
public record ShipmentIntegrationEvent(
        String shipmentId,
        String orderId,
        String canonicalStage,
        long aggregateVersion,
        Instant occurredAt
) {}

public record ShipmentTransitionOutcome(
        ShipmentAggregate updatedAggregate,
        boolean stateChanged,
        Optional<ShipmentIntegrationEvent> emittedIntegrationEvent
) {}

/**
 * Доменный агрегат доставки с естественной идемпотентностью и оптимистической версией (@Version).
 */
public record ShipmentAggregate(
        String shipmentId,
        String orderId,
        String carrierCode,
        ShipmentLifecycleStage stage,
        long version,
        Instant lastMilestoneAt
) {
    public static ShipmentAggregate createNew(String shipmentId, String orderId, String carrierCode) {
        return new ShipmentAggregate(
                shipmentId, orderId, carrierCode, ShipmentLifecycleStage.CREATED, 0L, Instant.EPOCH
        );
    }

    public ShipmentTransitionOutcome applyMilestone(CanonicalCarrierMilestone milestone) {
        if (!this.shipmentId.equals(milestone.shipmentId())) {
            throw new IllegalArgumentException("Milestone shipmentId mismatch");
        }

        // Монотонная защита от Out-of-Order и дублирующихся вебхуков
        if (!this.stage.canTransitionTo(milestone.targetStage())) {
            return new ShipmentTransitionOutcome(this, false, Optional.empty());
        }

        long nextVersion = this.version + 1;
        ShipmentAggregate nextAggregate = new ShipmentAggregate(
                this.shipmentId,
                this.orderId,
                this.carrierCode,
                milestone.targetStage(),
                nextVersion,
                milestone.occurredAt()
        );

        ShipmentIntegrationEvent integrationEvent = new ShipmentIntegrationEvent(
                this.shipmentId,
                this.orderId,
                milestone.targetStage().name(),
                nextVersion,
                milestone.occurredAt()
        );

        return new ShipmentTransitionOutcome(nextAggregate, true, Optional.of(integrationEvent));
    }
}

/**
 * Входящий ACL-транслятор для провайдера FastExpress (изолирует битовые маски).
 */
class FastExpressAclTranslator {
    public CanonicalCarrierMilestone translate(String shipmentGuid, int bitmask, long epochSeconds) {
        ShipmentLifecycleStage stage;
        if ((bitmask & 128) != 0) {
            stage = ShipmentLifecycleStage.LOST;
        } else if ((bitmask & 4) != 0) {
            stage = ShipmentLifecycleStage.DELIVERED;
        } else if ((bitmask & 2) != 0) {
            stage = ShipmentLifecycleStage.IN_TRANSIT;
        } else if ((bitmask & 1) != 0) {
            stage = ShipmentLifecycleStage.PICKED_UP;
        } else {
            throw new IllegalArgumentException("Unrecognized FastExpress bitmask: " + bitmask);
        }
        return new CanonicalCarrierMilestone(
                shipmentGuid, "FAST_EXPRESS", stage, Instant.ofEpochSecond(epochSeconds)
        );
    }
}

/**
 * Входящий ACL-транслятор для провайдера GlobalCargo (изолирует XML-коды терминалов).
 */
class GlobalCargoAclTranslator {
    public CanonicalCarrierMilestone translate(String waybillRef, String terminalCode, String isoTimestamp) {
        ShipmentLifecycleStage stage = switch (terminalCode) {
            case "TERM_IN" -> ShipmentLifecycleStage.PICKED_UP;
            case "LINEHAUL_DEP" -> ShipmentLifecycleStage.IN_TRANSIT;
            case "HANDOVER_OK" -> ShipmentLifecycleStage.DELIVERED;
            case "DAMAGED_LOST" -> ShipmentLifecycleStage.LOST;
            case null, default -> throw new IllegalArgumentException("Unknown GlobalCargo code: " + terminalCode);
        };
        return new CanonicalCarrierMilestone(
                waybillRef, "GLOBAL_CARGO", stage, Instant.parse(isoTimestamp)
        );
    }
}

```

#### 7. Staff Bar-Raiser Trade-Off Defense
Защита данного решения на уровне Staff/Principal раскрывает соотношение между естественной идемпотентностью доменной модели и дедупликационными таблицами Inbox, а также стратегию сохранения сырых данных провайдера для расследования инцидентов. Для некоммутативных операций вроде `IncrementShippingCount()` необходима явная таблица дедупликации `ProcessedEventInbox` по уникальному `event_id`. Однако при интеграции с внешними 3PL-провайдерами один и тот же физический переход статуса посылки часто приходит в повторных вебхуках с *разными* идентификаторами запросов и даже от разных промежуточных хабов. Поэтому проектирование доменной логики как монотонной полурешетки состояний (`canTransitionTo` по рангу `precedenceRank`, подобно команде `UpdateOrderStatus(status=SHIPPED)`) обеспечивает естественную идемпотентность на уровне самого бизнес-инварианта даже тогда, когда внешний провайдер генерирует новые идентификаторы сообщений при сетевых ретраях.
Второй практический компромисс касается сохранения диагностических данных. Полное удаление полей `raw_provider_bitmask` и `raw_provider_subcode` из доменной таблицы `shipments` защищает чистоту ядра, но при разборе претензий с логистическим партнером инженерам поддержки необходим исходный ответ провайдера. Архитектор уровня Staff решает эту задачу разделением операционной модели агрегата и журнала сырых телеметрических данных: входящий ACL-адаптер записывает неизменяемый JSON/XML-пейлоад вебхука в отдельную append-only таблицу аудита интеграций или в объектное хранилище S3 по ключу корреляции, сохраняя реляционную таблицу агрегата `shipments` абсолютно чистой от специфики внешних контрактов.

## Сводная матрица оценки кандидатов уровня Staff и Principal (L3 Bar-Raiser Rubric)
При проведении калибровки результатов интервью по всем восьми ката нанимающий комитет (Hiring Committee / Bar-Raiser Panel) оценивает глубину архитектурных решений кандидата по четырем ключевым осям.

| Ось оценки | Сигнал уровня Senior (L2 — Недостаточно для L3) | Сигнал уровня Staff / Principal (L3 — Hire / Strong Hire) |
| --- | --- | --- |
| **1. Изоляция домена и управление границами (Hexagonal & DDD)** | Выносит интерфейсы сервисов, но оставляет JPA-аннотации `@Entity` и Jackson в доменных классах; полагается на устные договоренности вместо автоматических проверок. | Полностью очищает доменное ядро (Java 21 Records, Sealed Classes), разделяет входящие и исходящие порты, внедряет тесты ArchUnit (`layeredArchitecture`, `FreezingArchRule`) и социабельные тесты поверх In-Memory стабов. |
| **2. Распределенная согласованность данных (Outbox & CDC)** | Пытается починить Dual-Write через `try/catch` или включение `enable.idempotence=true` в Kafka; удерживает `FOR UPDATE SKIP LOCKED` открытым на все время сетевого вызова в брокер. | Разделяет захват задачи (`PENDING -> PROCESSING`), сетевой ввод-вывод вне транзакции БД и фиксацию результата; обосновывает выбор между `SKIP LOCKED` и Debezium WAL CDC с учетом нагрузки, `remove-after-insert` и идемпотентности Consumer Inbox. |
| **3. Среда исполнения Java 21 и эксплуатационная надежность (Spring Boot 3.4+)** | Механически включает `spring.threads.virtual.enabled=true` и меняет `javax.*` на `jakarta.*`, не замечая блоков `synchronized` вокруг сетевого I/O и блокирующей криптографии в фильтрах. | Диагностирует и устраняет пиннинг потоков-носителей через замену `synchronized` на `ReentrantLock`, переводит HTTP-слой на `RestClient`, выносит CPU-емкую обработку PII в асинхронный конвейер с обратным давлением (`<2ms p99`) и внедряет RFC 9457 `ProblemDetail`. |
| **4. Эволюционная миграция легаси (ACL & Strangler Fig)** | Копирует поля внешних SOAP/3PL-контрактов в доменные сущности, решая проблемы совместимости каскадными `if/else` внутри бизнес-сервисов. | Строит строгий Anti-Corruption Layer (Фасад + Транслятор + Адаптер), снижая индекс распространения изменений (CIF), и проектирует монотонные идемпотентные машины состояний агрегатов с оптимистической блокировкой. |

## Заключение и архитектурные рекомендации
Синтезированный комплекс из восьми рефакторинг-ката демонстрирует, что ключевым отличием инженера уровня Staff и Principal (L3) является способность управлять системными рисками второго и третьего порядка на стыке предметного моделирования, параллелизма JVM и распределенных систем хранения данных. Изоляция доменного ядра с помощью гексагональной архитектуры и антикоррупционных слоев устраняет каскадную хрупкость при интеграции с унаследованными мейнфреймами и внешними провайдерами, а замена синхронной двойной записи на паттерн Transactional Outbox с короткими транзакциями `SKIP LOCKED` или лог-ориентированным конвейером Debezium CDC в паре с идемпотентным Consumer Inbox гарантирует целостность данных при любых сетевых разделениях и отказах брокера. Наконец, безопасная миграция корпоративных шлюзов на Java 21 LTS и Spring Boot 3.4+ требует обязательной ревизии примитивов синхронизации для предотвращения пиннинга виртуальных потоков и строгого разделения блокирующего ввода-вывода и ресурсоемких криптографических вычислений.

---

Source: https://gemini.google.com/app/9b4efe83d11c48c3
Exported at: 2026-10-17T10:20:25.173Z