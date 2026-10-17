# Enterprise Java 21 Refactoring and Code Review Interview Katas (2023–2026)

## Architectural Evolution of the Refactoring Interview Round
Between 2023 and 2026, technical screening across high-scale engineering organizations—including Yandex, T-Bank, Ozon, Avito, Amazon, Stripe, and Uber—underwent a structural shift away from isolated algorithmic puzzles toward two-phase Code Review and Legacy Refactoring assessments. As generative AI tooling commoditized boilerplate code generation, hiring committees recognized that a candidate's ability to diagnose architectural smells, establish characterization safety nets, and incrementally modernize production-grade legacy code provides a far higher signal-to-noise ratio than greenfield coding.
In an enterprise Java 21 LTS and Spring Boot 3.4+ environment, technical debt rarely manifests as syntax errors or trivial typos. Instead, production post-mortems and conference analyses from Spring I/O, Devoxx, JPoint, and Joker demonstrate that catastrophic system failures stem from structural anti-patterns. At the Junior (L0) and Middle (L1) tiers, these smells appear as primitive obsession, deeply nested control-flow trees, unclosed I/O resources, and hardwired static dependencies that prevent isolated unit testing. At the Senior (L2) and Staff (L3) tiers, the failure modes become systemic: Spring Data JPA persistence context thrashing via `saveAndFlush()` inside loops, transactional proxy bypass via self-invocation, dual-write race conditions between relational databases and Kafka brokers, and JDK 21 virtual thread carrier pinning caused by blocking operations inside monitor locks.
The empirical metrics captured in enterprise benchmarks underscore why Senior and Staff interviews heavily weight runtime mechanics alongside clean object-oriented design. When migrating legacy services to Java 21 virtual threads (JEP 444), patterns that were benign under pooled platform threads become catastrophic. For instance, a `ThreadLocal.withInitial()` cache that initializes exactly 200 times across a fixed 200-thread platform pool has been benchmarked initializing 443,267 times under virtual threads for the identical workload—a 2,216-fold increase that manifests as severe garbage collection pressure. Similarly, while JDK 24 (JEP 491) later resolved monitor-related carrier pinning inside the JVM, systems running on the enterprise standard Java 21 LTS remain vulnerable to complete carrier pool starvation (defaulting to a maximum of 256 platform threads) whenever blocking I/O occurs inside a `synchronized` block or a `ConcurrentHashMap.computeIfAbsent` lambda. Even within test suites, architectural anti-patterns such as placing `@DirtiesContext` on an abstract base test class destroy Spring TestContext caching and double overall CI build times from 12 minutes to 25 minutes.

### Master Catalog of Curated Refactoring Katas
The following table synthesizes the 16 production-grade refactoring challenges mined from open-source kata repositories, conference post-mortems, and technical interview debriefs, organized across four engineering seniority grades.

| Kata ID | Challenge Title | Target Grade | Enterprise Domain | Primary Architectural Smells | Target Java 21 / Spring Remediation |
| --- | --- | --- | --- | --- | --- |
| **KATA-01** | SLA Incident Escalation & Scoring Engine | Junior (L0) | Cloud Operations / SRE | Cryptic identifiers, asymmetric `if-else` trees, magic numbers | Guard clauses, `enum` state mapping, Java `record` value objects |
| **KATA-02** | Multi-Modal Freight Tariff Calculator | Junior (L0) | Logistics & Last-Mile | Type-code `switch`, unused constructor args, OCP violation | `sealed interface` hierarchy, pattern-matching `switch`[cite: 27, 29] |
| **KATA-03** | Regulatory Tax Formula Error Enricher | Junior (L0) | FinTech Compliance | Exception message substring parsing, duplicated regex logic | Chain of Responsibility, structured `record` matchers |
| **KATA-04** | Compliance Audit Log Ingestion Service | Junior (L0) | InfoSec / Telemetry | Unclosed `FileWriter`/`BufferedReader`, swallowed exceptions | `try-with-resources`, Dependency Injection, structured result |
| **KATA-05** | Perishable Dark-Store Dynamic Pricer | Middle (L1) | Quick-Commerce Retail | Deeply nested conditionals, interleaved state/time mutation | Domain-specific `ValuationPolicy` strategies, clamped transitions |
| **KATA-06** | Corporate Travel Expense Authorizer | Middle (L1) | Enterprise ERP / FinTech | Static singleton calls, untestable DAO coupling, Feature Envy | Constructor DI, Seam extraction, domain collection encapsulation |
| **KATA-07** | Omnichannel Promotional Cart Settlement | Middle (L1) | E-Commerce Checkout | `double` currency math, mixed pricing & receipt rendering | `BigDecimal` Money Value Object, `Offer` evaluation, View separation |
| **KATA-08** | Cloud Compute Usage & SLA Rebate Engine | Middle (L1) | Cloud Infrastructure Billing | Long method, tangled pricing/credit loops, format lock-in | Split Phase refactoring, intermediate `StatementData` record |
| **KATA-09** | Order Batch Archiver & JPA Persistence | Senior (L2) | E-Commerce Core | `saveAndFlush()` in loop, N+1 queries, `@Transactional` self-call | Bulk `findAllById`, dirty checking, separated transaction boundary |
| **KATA-10** | Autonomous Warehouse AGV Dispatch | Senior (L2) | Robotics & Fulfillment | Anemic state arrays, moving with open hatch, primitive flags | Rich Domain Aggregate, enforced state invariants, command routing |
| **KATA-11** | Real-Time Payment Fraud Velocity Scorer | Senior (L2) | FinTech Risk Engine | Procedural array tallies, duplicated frequency loops | Functional `TransactionWindow` value object, Stream collectors |
| **KATA-12** | Omnichannel Notification Fanout Service | Senior (L2) | Customer Engagement | Static sender coupling, `Optional` field/param misuse, blocking loop | SPI transport abstraction, fault-isolated batching, clean nullability |
| **KATA-13** | Ad-Auction RTB Gateway & Carrier Pinning | Staff (L3) | High-Frequency AdTech | Pooled virtual threads, `synchronized` I/O pinning, `computeIfAbsent` trap | Unpooled Virtual Threads, `ReentrantLock`, `Semaphore` admission control |
| **KATA-14** | Multi-Tenant Audit Context Propagator | Staff (L3) | Core Banking Security | `ThreadLocal` leak, 2,216x virtual thread init bloat, mutable state | Immutable `ScopedValue` (JEP 506 semantics), lexical scope binding |
| **KATA-15** | Transactional Outbox Payment Relay | Staff (L3) | Payment Clearinghouse | Dual-write to DB & Kafka, naive polling race across replicas | Transactional Outbox pattern, `SELECT FOR UPDATE SKIP LOCKED` batching |
| **KATA-16** | Cross-Currency Treasury Lock Engine | Staff (L3) | FX Liquidity Settlement | Dynamic lock-order deadlock, boxed `Long` monitor, mutable Map key | Deterministic lock ordering (`Comparable`), private locks, immutable keys |

## Junior (L0) Refactoring & Code Review Katas

### KATA-01: SLA Incident Escalation & Scoring Engine
**Target Grade:** Junior L0
**Domain & Enterprise Context:** Cloud Infrastructure Operations & Incident Response Scoring
**Real-World Interview Origin:** Avito, Ozon, and European FinTech L0/L1 live refactoring rounds, modeled on the state-comparison and score-formatting mechanics of canonical scoreboard katas.
**Core Code Smells & Anti-Patterns:**

1. **Cryptic Variable Naming & Temporary Accumulator Clutter (`s1`, `s2`, `temp`, `r` in `evaluateStatus`):** Obscures domain intent and forces the reader to mentally execute loop iterations to understand simple state formatting.
2. **Asymmetric Nested Conditionals & Loop Unrolling Anti-Pattern (`for (int i = 1; i < 3; i++)`):** Uses a convoluted two-iteration loop with a temporary variable to concatenate string labels when node strike counts are unequal below threshold, duplicating state translation logic.
3. **Primitive Obsession & Redundant State Tracking:** Hardcodes severity integers (`0`, `1`, `2`, `3`, `4`) and maintains a redundant `logCounts` map that duplicates the primitive counters without contributing to domain behavior.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.ops.sla;

import java.util.HashMap;
import java.util.Map;

public class IncidentEscalationTracker {
    private int s1 = 0;
    private int s2 = 0;
    private final String n1;
    private final String n2;
    private final Map<String, Integer> logCounts = new HashMap<>();

    public IncidentEscalationTracker(String n1, String n2) {
        if (n1 == null || n2 == null || n1.trim().isEmpty() || n2.trim().isEmpty()) {
            throw new IllegalArgumentException("Node names must not be null or blank");
        }
        this.n1 = n1;
        this.n2 = n2;
        this.logCounts.put(n1, 0);
        this.logCounts.put(n2, 0);
    }

    public void recordStrike(String nodeName) {
        if (nodeName.equals(this.n1)) {
            this.s1 += 1;
            this.logCounts.put(n1, this.s1);
        } else if (nodeName.equals(this.n2)) {
            this.s2 += 1;
            this.logCounts.put(n2, this.s2);
        } else {
            throw new IllegalArgumentException("Unknown node: " + nodeName);
        }
    }

    public String evaluateStatus() {
        String r = "";
        int temp = 0;
        if (s1 == s2) {
            switch (s1) {
                case 0:
                    r = "Nominal-All";
                    break;
                case 1:
                    r = "Advisory-All";
                    break;
                case 2:
                    r = "Degraded-All";
                    break;
                default:
                    r = "Critical-Parity";
                    break;
            }
        } else if (s1 >= 4 || s2 >= 4) {
            int d = s1 - s2;
            if (d == 1) {
                r = "PreFailover-" + n1;
            } else if (d == -1) {
                r = "PreFailover-" + n2;
            } else if (d >= 2) {
                r = "FailoverTriggered-" + n1;
            } else {
                r = "FailoverTriggered-" + n2;
            }
        } else {
            for (int i = 1; i < 3; i++) {
                if (i == 1) {
                    temp = s1;
                } else {
                    r += ":";
                    temp = s2;
                }
                switch (temp) {
                    case 0:
                        r += "Nominal";
                        break;
                    case 1:
                        r += "Advisory";
                        break;
                    case 2:
                        r += "Degraded";
                        break;
                    case 3:
                        r += "Severe";
                        break;
                }
            }
        }
        return r;
    }

    public int getTotalStrikes() {
        return s1 + s2;
    }

    public int getStrikeDifferential() {
        return Math.abs(s1 - s2);
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.ops.sla;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.assertEquals;

class IncidentEscalationTrackerTest {

    @ParameterizedTest
    @CsvSource({
        "0, 0, Nominal-All",
        "1, 1, Advisory-All",
        "2, 2, Degraded-All",
        "3, 3, Critical-Parity",
        "4, 4, Critical-Parity",
        "1, 0, Advisory:Nominal",
        "2, 3, Degraded:Severe",
        "4, 3, PreFailover-Primary",
        "3, 4, PreFailover-Replica",
        "5, 3, FailoverTriggered-Primary",
        "2, 4, FailoverTriggered-Replica"
    })
    void preservesAllEscalationStateTransitions(int primaryStrikes, int replicaStrikes, String expected) {
        IncidentEscalationTracker tracker = new IncidentEscalationTracker("Primary", "Replica");
        for (int i = 0; i < primaryStrikes; i++) tracker.recordStrike("Primary");
        for (int i = 0; i < replicaStrikes; i++) tracker.recordStrike("Replica");
        assertEquals(expected, tracker.evaluateStatus());
        assertEquals(primaryStrikes + replicaStrikes, tracker.getTotalStrikes());
        assertEquals(Math.abs(primaryStrikes - replicaStrikes), tracker.getStrikeDifferential());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
Remediation begins by unrolling the artificial two-iteration `for` loop in `evaluateStatus()` and removing the mutable `temp` accumulator, replacing the duplicated switch statements with a deterministic `LEVEL_LABELS` lookup array. Next, the deeply nested `if-else` branches are decomposed using guard clauses that route execution to three intention-revealing domain methods (`formatParityStatus()`, `formatFailoverStatus()`, and `formatStandardStatus()`) representing the three mutually exclusive SLA regimes. Finally, cryptic field names (`s1`, `s2`, `n1`, `n2`) are renamed to express domain roles (`primaryStrikes`, `replicaStrikes`, `primaryNode`, `replicaNode`), and the dead `logCounts` `HashMap` is excised while preserving all public method contracts.
**Target Clean Reference Solution:**

```java
package com.enterprise.ops.sla;

public class IncidentEscalationTracker {
    private static final int FAILOVER_THRESHOLD = 4;
    private static final String[] LEVEL_LABELS = {"Nominal", "Advisory", "Degraded", "Severe"};

    private final String primaryNode;
    private final String replicaNode;
    private int primaryStrikes;
    private int replicaStrikes;

    public IncidentEscalationTracker(String primaryNode, String replicaNode) {
        if (primaryNode == null || replicaNode == null || primaryNode.isBlank() || replicaNode.isBlank()) {
            throw new IllegalArgumentException("Node names must not be null or blank");
        }
        this.primaryNode = primaryNode;
        this.replicaNode = replicaNode;
    }

    public void recordStrike(String nodeName) {
        if (primaryNode.equals(nodeName)) {
            primaryStrikes++;
        } else if (replicaNode.equals(nodeName)) {
            replicaStrikes++;
        } else {
            throw new IllegalArgumentException("Unknown node: " + nodeName);
        }
    }

    public String evaluateStatus() {
        if (isParity()) {
            return formatParityStatus();
        }
        if (isFailoverThresholdReached()) {
            return formatFailoverStatus();
        }
        return formatStandardStatus();
    }

    private boolean isParity() {
        return primaryStrikes == replicaStrikes;
    }

    private boolean isFailoverThresholdReached() {
        return primaryStrikes >= FAILOVER_THRESHOLD || replicaStrikes >= FAILOVER_THRESHOLD;
    }

    private String formatParityStatus() {
        return switch (primaryStrikes) {
            case 0 -> "Nominal-All";
            case 1 -> "Advisory-All";
            case 2 -> "Degraded-All";
            default -> "Critical-Parity";
        };
    }

    private String formatFailoverStatus() {
        int delta = primaryStrikes - replicaStrikes;
        String affectedNode = delta > 0 ? primaryNode : replicaNode;
        return Math.abs(delta) == 1
                ? "PreFailover-" + affectedNode
                : "FailoverTriggered-" + affectedNode;
    }

    private String formatStandardStatus() {
        return LEVEL_LABELS[primaryStrikes] + ":" + LEVEL_LABELS[replicaStrikes];
    }

    public int getTotalStrikes() {
        return primaryStrikes + replicaStrikes;
    }

    public int getStrikeDifferential() {
        return Math.abs(primaryStrikes - replicaStrikes);
    }
}

```
**Senior AI Review Checkpoint:**
The evaluation rubric verifies that the candidate completely removed the two-iteration `for (int i = 1; i < 3; i++)` loop and its mutable `temp` variable. The grader further confirms that the three domain states—parity, failover threshold, and standard unequal comparison—are separated via guard clauses using Java switch expressions without mutable string concatenation, and that the unused `HashMap` field has been eliminated while preserving the exact public API contract.

### KATA-02: Multi-Modal Freight Tariff Calculator
**Target Grade:** Junior L0
**Domain & Enterprise Context:** Logistics & Last-Mile Cross-Border Freight Billing
**Real-World Interview Origin:** Yandex Delivery, Amazon Transportation Services, and Wildberries L0/L1 screening rounds, testing polymorphism and algebraic data types inspired by classic type-switch katas.
**Core Code Smells & Anti-Patterns:**

1. **Type-Code Switch Explosion (`calculateTariff` and `estimateTransitHours`):** Switches repeatedly on `ShipmentMode` across multiple methods, violating the Open-Closed Principle whenever a new transport mode is introduced.
2. **Telescoping / Polluted Constructor State:** Passes mode-specific parameters (`customsAxleCount`, `batteryColdWeatherFactor`, `isPressurizedHold`) into a single monolithic class where fields are silently ignored depending on the enum type.
3. **Magic Constants & Duplicated Clamping Logic:** Hardcodes base rates and floor/ceiling bounds directly inside switch branches without domain encapsulation.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.logistics.tariff;

public class FreightTariffCalculator {
    public enum ShipmentMode {
        STANDARD_GROUND,
        HEAVY_RAIL_FREIGHT,
        CRYOGENIC_AIR_EXPRESS
    }

    private final ShipmentMode mode;
    private final double weightKg;
    private final int customsAxleCount;
    private final double batteryColdWeatherFactor;
    private final boolean isPressurizedHold;

    public FreightTariffCalculator(
            ShipmentMode mode,
            double weightKg,
            int customsAxleCount,
            double batteryColdWeatherFactor,
            boolean isPressurizedHold) {
        if (mode == null) {
            throw new IllegalArgumentException("ShipmentMode is required");
        }
        if (weightKg < 0) {
            throw new IllegalArgumentException("Weight cannot be negative");
        }
        this.mode = mode;
        this.weightKg = weightKg;
        this.customsAxleCount = customsAxleCount;
        this.batteryColdWeatherFactor = batteryColdWeatherFactor;
        this.isPressurizedHold = isPressurizedHold;
    }

    public double calculateTariff() {
        switch (mode) {
            case STANDARD_GROUND:
                return getBaseRate() + (weightKg * 1.25);
            case HEAVY_RAIL_FREIGHT:
                return Math.max(50.0, getBaseRate() + (weightKg * 0.85) - (getAxleSurchargeDiscount() * customsAxleCount));
            case CRYOGENIC_AIR_EXPRESS:
                if (isPressurizedHold) {
                    return 500.0 + (weightKg * 4.50);
                }
                return Math.min(2500.0, getBaseRate() * batteryColdWeatherFactor + (weightKg * 3.10));
            default:
                throw new IllegalStateException("Unsupported mode");
        }
    }

    public int estimateTransitHours(int distanceKm) {
        if (distanceKm < 0) {
            throw new IllegalArgumentException("Distance cannot be negative");
        }
        switch (mode) {
            case STANDARD_GROUND:
                return Math.max(12, distanceKm / 60);
            case HEAVY_RAIL_FREIGHT:
                return (distanceKm / 45) + (customsAxleCount * 2);
            case CRYOGENIC_AIR_EXPRESS:
                return isPressurizedHold ? Math.max(4, distanceKm / 600) : Math.max(6, distanceKm / 450);
            default:
                throw new IllegalStateException("Unsupported mode");
        }
    }

    private double getBaseRate() {
        return 120.0;
    }

    private double getAxleSurchargeDiscount() {
        return 9.5;
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.logistics.tariff;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static com.enterprise.logistics.tariff.FreightTariffCalculator.ShipmentMode.*;

class FreightTariffCalculatorTest {

    @Test
    void calculatesGroundTariffAndTransit() {
        var calc = new FreightTariffCalculator(STANDARD_GROUND, 100.0, 0, 0.0, false);
        assertEquals(245.0, calc.calculateTariff(), 0.001);
        assertEquals(15, calc.estimateTransitHours(900));
    }

    @Test
    void calculatesRailTariffWithFloorAndAxleDiscount() {
        var calc = new FreightTariffCalculator(HEAVY_RAIL_FREIGHT, 20.0, 12, 0.0, false);
        assertEquals(50.0, calc.calculateTariff(), 0.001);
        assertEquals(44, calc.estimateTransitHours(900));
    }

    @Test
    void calculatesCryogenicAirPressurizedAndUnpressurized() {
        var pressurized = new FreightTariffCalculator(CRYOGENIC_AIR_EXPRESS, 100.0, 0, 2.0, true);
        assertEquals(950.0, pressurized.calculateTariff(), 0.001);
        assertEquals(4, pressurized.estimateTransitHours(1800));

        var unpressurized = new FreightTariffCalculator(CRYOGENIC_AIR_EXPRESS, 100.0, 0, 2.5, false);
        assertEquals(610.0, unpressurized.calculateTariff(), 0.001);
        assertEquals(6, unpressurized.estimateTransitHours(1800));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
The refactoring replaces the type-code switch explosion with a Java 21 `sealed interface ShipmentSpec` implemented by three cohesive `record` types: `StandardGround`, `HeavyRailFreight`, and `CryogenicAirExpress`. By co-locating `calculateTariff()` and `estimateTransitHours(int)` inside each record implementation, invalid field combinations—such as supplying axle counts for air cargo—become unrepresentable in the domain model. To guarantee zero regression for existing callers, the legacy five-argument constructor is retained as an adapter that translates the `ShipmentMode` enum into the corresponding polymorphic `ShipmentSpec` instance.
**Target Clean Reference Solution:**

```java
package com.enterprise.logistics.tariff;

import java.util.Objects;

public class FreightTariffCalculator {
    private static final double BASE_RATE = 120.0;
    private static final double AXLE_DISCOUNT_FACTOR = 9.5;

    public enum ShipmentMode {
        STANDARD_GROUND, HEAVY_RAIL_FREIGHT, CRYOGENIC_AIR_EXPRESS
    }

    public sealed interface ShipmentSpec {
        double calculateTariff();
        int estimateTransitHours(int distanceKm);
    }

    public record StandardGround(double weightKg) implements ShipmentSpec {
        public StandardGround {
            if (weightKg < 0) throw new IllegalArgumentException("Weight cannot be negative");
        }
        @Override
        public double calculateTariff() {
            return BASE_RATE + (weightKg * 1.25);
        }
        @Override
        public int estimateTransitHours(int distanceKm) {
            return Math.max(12, distanceKm / 60);
        }
    }

    public record HeavyRailFreight(double weightKg, int customsAxleCount) implements ShipmentSpec {
        public HeavyRailFreight {
            if (weightKg < 0) throw new IllegalArgumentException("Weight cannot be negative");
        }
        @Override
        public double calculateTariff() {
            double raw = BASE_RATE + (weightKg * 0.85) - (AXLE_DISCOUNT_FACTOR * customsAxleCount);
            return Math.max(50.0, raw);
        }
        @Override
        public int estimateTransitHours(int distanceKm) {
            return (distanceKm / 45) + (customsAxleCount * 2);
        }
    }

    public record CryogenicAirExpress(double weightKg, double batteryColdWeatherFactor, boolean isPressurizedHold)
            implements ShipmentSpec {
        public CryogenicAirExpress {
            if (weightKg < 0) throw new IllegalArgumentException("Weight cannot be negative");
        }
        @Override
        public double calculateTariff() {
            if (isPressurizedHold) {
                return 500.0 + (weightKg * 4.50);
            }
            return Math.min(2500.0, BASE_RATE * batteryColdWeatherFactor + (weightKg * 3.10));
        }
        @Override
        public int estimateTransitHours(int distanceKm) {
            return isPressurizedHold ? Math.max(4, distanceKm / 600) : Math.max(6, distanceKm / 450);
        }
    }

    private final ShipmentSpec spec;

    public FreightTariffCalculator(ShipmentSpec spec) {
        this.spec = Objects.requireNonNull(spec);
    }

    public FreightTariffCalculator(
            ShipmentMode mode, double weightKg, int customsAxleCount,
            double batteryColdWeatherFactor, boolean isPressurizedHold) {
        this(switch (Objects.requireNonNull(mode, "ShipmentMode is required")) {
            case STANDARD_GROUND -> new StandardGround(weightKg);
            case HEAVY_RAIL_FREIGHT -> new HeavyRailFreight(weightKg, customsAxleCount);
            case CRYOGENIC_AIR_EXPRESS -> new CryogenicAirExpress(weightKg, batteryColdWeatherFactor, isPressurizedHold);
        });
    }

    public double calculateTariff() {
        return spec.calculateTariff();
    }

    public int estimateTransitHours(int distanceKm) {
        if (distanceKm < 0) {
            throw new IllegalArgumentException("Distance cannot be negative");
        }
        return spec.estimateTransitHours(distanceKm);
    }
}

```
**Senior AI Review Checkpoint:**
The reviewer verifies that the parallel `switch` statements in `calculateTariff()` and `estimateTransitHours()` have been eliminated via polymorphic `sealed interface` dispatch. Each `record` implementation must retain only the state attributes applicable to its transport mode, while the legacy constructor must continue to pass all baseline characterization tests without modification.

### KATA-03: Regulatory Tax Formula Error Enricher
**Target Grade:** Junior L0
**Domain & Enterprise Context:** FinTech Automated Tax Filing & Spreadsheet Formula Parser Diagnostics
**Real-World Interview Origin:** T-Bank, Stripe, and European RegTech L0/L1 interviews, adapted from exception-clarification refactoring scenarios.
**Core Code Smells & Anti-Patterns:**

1. **Brittle String Indexing & Duplicated Parsing (`indexOf`, `substring`):** Repeatedly parses exception message brackets and tokens using manual index arithmetic across conditional branches.
2. **Long Method & Mixed Responsibilities (`translateDiagnostic`):** Combines exception hierarchy inspection, substring token extraction, and user-facing message formatting in a single procedural method.
3. **Closed to Extension:** Adding a new diagnostic rule (such as merged cell detection or circular tax reference) requires editing deeply nested `if-else` conditions.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.fintech.tax;

import java.util.List;

public class TaxFormulaDiagnosticEnricher {

    public static class ProprietaryParserException extends RuntimeException {
        private final String formulaId;
        private final List<String> cellRefs;

        public ProprietaryParserException(String message, String formulaId, List<String> cellRefs) {
            super(message);
            this.formulaId = formulaId;
            this.cellRefs = cellRefs;
        }
        public String getFormulaId() { return formulaId; }
        public List<String> getCellRefs() { return cellRefs; }
    }

    public String translateDiagnostic(RuntimeException ex) {
        if (ex == null) {
            return "Unhandled tax engine failure: No diagnostic details";
        }
        String msg = ex.getMessage();
        if (ex instanceof ProprietaryParserException) {
            ProprietaryParserException ppe = (ProprietaryParserException) ex;
            if (msg != null && msg.startsWith("ERR_DIV_ZERO:")) {
                int start = msg.indexOf("[");
                int end = msg.indexOf("]");
                String denominator = (start != -1 && end != -1 && end > start)
                        ? msg.substring(start + 1, end) : "UNKNOWN";
                return "Tax calculation halted in [" + ppe.getFormulaId()
                        + "]: Division by zero at cell " + denominator
                        + " affecting " + String.join(", ", ppe.getCellRefs());
            } else if (msg != null && msg.startsWith("ERR_UNBOUND_LOOKUP:")) {
                int start = msg.indexOf("[");
                int end = msg.indexOf("]");
                String table = (start != -1 && end != -1 && end > start)
                        ? msg.substring(start + 1, end) : "UNKNOWN";
                return "Tax calculation halted in [" + ppe.getFormulaId()
                        + "]: Missing tax rate table '" + table
                        + "' referenced by " + String.join(", ", ppe.getCellRefs());
            } else if (msg != null && msg.startsWith("ERR_MERGED_RANGE:")) {
                return "Tax calculation halted in [" + ppe.getFormulaId()
                        + "]: Disallowed merged cells detected across "
                        + String.join(", ", ppe.getCellRefs());
            }
        }
        if (msg != null && msg.contains("SYNTAX_TOKEN_MISMATCH[")) {
            int start = msg.indexOf("[");
            int end = msg.indexOf("]");
            String token = (start != -1 && end != -1 && end > start)
                    ? msg.substring(start + 1, end) : "UNKNOWN";
            return "Malformed tax expression: Unexpected token '" + token + "' in user upload.";
        }
        return "Unhandled tax engine failure: " + (msg != null ? msg : "No diagnostic details");
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.fintech.tax;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.fintech.tax.TaxFormulaDiagnosticEnricher.ProprietaryParserException;

class TaxFormulaDiagnosticEnricherTest {
    private final TaxFormulaDiagnosticEnricher enricher = new TaxFormulaDiagnosticEnricher();

    @Test
    void enrichesProprietaryParserExceptionsAccurately() {
        var divZero = new ProprietaryParserException("ERR_DIV_ZERO:[B14]", "VAT_NET_01", List.of("C14", "D14"));
        assertEquals("Tax calculation halted in [VAT_NET_01]: Division by zero at cell B14 affecting C14, D14",
                enricher.translateDiagnostic(divZero));

        var lookup = new ProprietaryParserException("ERR_UNBOUND_LOOKUP:[EU_RATES_2026]", "VAT_EU", List.of("A2"));
        assertEquals("Tax calculation halted in [VAT_EU]: Missing tax rate table 'EU_RATES_2026' referenced by A2",
                enricher.translateDiagnostic(lookup));

        var merged = new ProprietaryParserException("ERR_MERGED_RANGE:", "INCOME_SCHED", List.of("F1", "F2"));
        assertEquals("Tax calculation halted in [INCOME_SCHED]: Disallowed merged cells detected across F1, F2",
                enricher.translateDiagnostic(merged));
    }

    @Test
    void enrichesGenericSyntaxAndFallbackExceptions() {
        var syntax = new IllegalArgumentException("Fatal SYNTAX_TOKEN_MISMATCH[;;]");
        assertEquals("Malformed tax expression: Unexpected token ';;' in user upload.",
                enricher.translateDiagnostic(syntax));

        var unknown = new RuntimeException("Socket timeout");
        assertEquals("Unhandled tax engine failure: Socket timeout",
                enricher.translateDiagnostic(unknown));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To eliminate duplicated string manipulation, the bracket-extraction arithmetic (`indexOf('[')` and `indexOf(']')`) is consolidated into a single fault-tolerant helper method `extractBracketToken(String)`. The nested `if-else` chain inside `translateDiagnostic` is refactored using Java 21 pattern matching for `instanceof` (`ex instanceof ProprietaryParserException ppe`) paired with a declarative `PrefixRule` registry. Each rule binds an error prefix to a formatting strategy, allowing engineers to register new spreadsheet diagnostic messages in a single line without touching control flow.
**Target Clean Reference Solution:**

```java
package com.enterprise.fintech.tax;

import java.util.List;
import java.util.Optional;

public class TaxFormulaDiagnosticEnricher {

    public static class ProprietaryParserException extends RuntimeException {
        private final String formulaId;
        private final List<String> cellRefs;

        public ProprietaryParserException(String message, String formulaId, List<String> cellRefs) {
            super(message);
            this.formulaId = formulaId;
            this.cellRefs = cellRefs;
        }
        public String getFormulaId() { return formulaId; }
        public List<String> getCellRefs() { return cellRefs; }
    }

    private record PrefixRule(String prefix, TriFormatter formatter) {}

    @FunctionalInterface
    private interface TriFormatter {
        String format(String formulaId, String bracketToken, String joinedCells);
    }

    private static final List<PrefixRule> PARSER_RULES = List.of(
        new PrefixRule("ERR_DIV_ZERO:", (id, token, cells) ->
            "Tax calculation halted in [%s]: Division by zero at cell %s affecting %s".formatted(id, token, cells)),
        new PrefixRule("ERR_UNBOUND_LOOKUP:", (id, token, cells) ->
            "Tax calculation halted in [%s]: Missing tax rate table '%s' referenced by %s".formatted(id, token, cells)),
        new PrefixRule("ERR_MERGED_RANGE:", (id, token, cells) ->
            "Tax calculation halted in [%s]: Disallowed merged cells detected across %s".formatted(id, cells))
    );

    public String translateDiagnostic(RuntimeException ex) {
        if (ex == null || ex.getMessage() == null) {
            return "Unhandled tax engine failure: No diagnostic details";
        }
        String msg = ex.getMessage();
        if (ex instanceof ProprietaryParserException ppe) {
            Optional<String> enriched = matchProprietaryRule(ppe, msg);
            if (enriched.isPresent()) {
                return enriched.get();
            }
        }
        if (msg.contains("SYNTAX_TOKEN_MISMATCH[")) {
            return "Malformed tax expression: Unexpected token '%s' in user upload."
                    .formatted(extractBracketToken(msg));
        }
        return "Unhandled tax engine failure: " + msg;
    }

    private Optional<String> matchProprietaryRule(ProprietaryParserException ppe, String msg) {
        String token = extractBracketToken(msg);
        String cells = String.join(", ", ppe.getCellRefs());
        return PARSER_RULES.stream()
                .filter(rule -> msg.startsWith(rule.prefix()))
                .findFirst()
                .map(rule -> rule.formatter().format(ppe.getFormulaId(), token, cells));
    }

    private String extractBracketToken(String message) {
        int start = message.indexOf('[');
        int end = message.indexOf(']');
        return (start != -1 && end > start) ? message.substring(start + 1, end) : "UNKNOWN";
    }
}

```
**Senior AI Review Checkpoint:**
The assessment rubric checks that all three duplicated `indexOf("[")` / `substring` blocks have been replaced by a single helper method. It also verifies that the candidate applied Java 21 `instanceof` pattern matching instead of explicit casting, kept the `translateDiagnostic(RuntimeException)` method signature intact, and structured the proprietary error rules so new spreadsheet failure codes can be added declaratively.

### KATA-04: Compliance Audit Log Ingestion Service
**Target Grade:** Junior L0
**Domain & Enterprise Context:** InfoSec Compliance Event Filtering & Persistent Audit Sink
**Real-World Interview Origin:** Sber, VK, and BigTech Junior/Middle screening exercises focused on I/O resource management, exception handling, and testability.
**Core Code Smells & Anti-Patterns:**

1. **Resource Leak (`FileWriter` without `try-with-resources`):** If `writer.write()` throws an `IOException`, the underlying OS file descriptor is never closed, leading to file handle exhaustion in production.
2. **Swallowed Exceptions & `System.out.println` Pollution:** Catches generic `Exception` and `IOException` silently while writing to standard output via `System.out.println`, masking compliance audit failures.
3. **Interleaved Parsing, Validation, and Disk I/O:** Mixes pipe-delimited string parsing, integer conversion, domain filtering, and file persistence inside a single procedural method.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.infosec.audit;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class ComplianceAuditIngestor {
    private Path auditFilePath = Path.of("compliance_audit.log");

    public void setAuditFilePath(Path auditFilePath) {
        this.auditFilePath = auditFilePath;
    }

    public Path getAuditFilePath() {
        return this.auditFilePath;
    }

    public int ingestRawEvents(String[] rawPayloads) {
        if (rawPayloads == null) {
            return 0;
        }
        int count = 0;
        List<String> formattedBatch = new ArrayList<>();
        for (int i = 0; i < rawPayloads.length; i++) {
            String raw = rawPayloads[i];
            if (raw == null || raw.trim().isEmpty()) {
                continue;
            }
            try {
                String[] parts = raw.split("\\|");
                String actor = parts[0].trim();
                int severity = Integer.parseInt(parts[1].trim());
                String action = parts[2].trim();
                if (actor.contains("@") && severity >= 3) {
                    String record = "HIGH_RISK|" + severity + "|" + actor.toLowerCase() + "|" + action;
                    formattedBatch.add(record);
                    System.out.println("Audited: " + record);
                    count++;
                } else if (severity >= 1) {
                    String record = "STANDARD|" + severity + "|" + actor + "|" + action;
                    formattedBatch.add(record);
                    count++;
                }
            } catch (Exception e) {
                // ignore malformed input
            }
        }
        try {
            FileWriter writer = new FileWriter(auditFilePath.toFile(), true);
            for (String line : formattedBatch) {
                writer.write(line + "\n");
            }
            writer.close();
        } catch (IOException e) {
            // ignore write error
        }
        return count;
    }

    public List<String> readPersistedLogs() throws IOException {
        return Files.readAllLines(auditFilePath);
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.infosec.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ComplianceAuditIngestorTest {

    @Test
    void filtersFormatsAndPersistsValidAuditRecords(@TempDir Path tempDir) throws IOException {
        Path logFile = tempDir.resolve("test_audit.log");
        ComplianceAuditIngestor ingestor = new ComplianceAuditIngestor();
        ingestor.setAuditFilePath(logFile);

        String[] payloads = {
            "Admin@Corp.com | 4 | EXPORT_PII",
            "service-account | 2 | ROTATE_KEY",
            "malformed_payload_without_pipes",
            "guest@corp.com | not_a_number | LOGIN",
            "low_sev_user | 0 | PING",
            ""
        };

        int processed = ingestor.ingestRawEvents(payloads);
        assertEquals(2, processed);
        assertEquals(List.of(
            "HIGH_RISK|4|admin@corp.com|EXPORT_PII",
            "STANDARD|2|service-account|ROTATE_KEY"
        ), ingestor.readPersistedLogs());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
The refactoring separates pure domain parsing and formatting from physical file I/O by introducing an immutable `AuditEntry` record equipped with a deterministic `parse(String)` factory method. Rather than relying on `ArrayIndexOutOfBoundsException` to reject malformed lines, `AuditEntry.parse` checks token array bounds explicitly and catches only `NumberFormatException`. Direct `System.out.println` calls are removed, and the unclosed `FileWriter` is replaced with `Files.newBufferedWriter` inside a `try-with-resources` block that guarantees file descriptor closure and surfaces disk failures via `UncheckedIOException`.
**Target Clean Reference Solution:**

```java
package com.enterprise.infosec.audit;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class ComplianceAuditIngestor {
    private static final int HIGH_RISK_THRESHOLD = 3;
    private static final int MIN_AUDIT_SEVERITY = 1;

    private Path auditFilePath = Path.of("compliance_audit.log");

    public record AuditEntry(String actor, int severity, String action) {
        public static Optional<AuditEntry> parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return Optional.empty();
            }
            String[] parts = raw.split("\\|");
            if (parts.length < 3) {
                return Optional.empty();
            }
            try {
                String actor = parts[0].trim();
                int severity = Integer.parseInt(parts[1].trim());
                String action = parts[2].trim();
                return severity >= MIN_AUDIT_SEVERITY
                        ? Optional.of(new AuditEntry(actor, severity, action))
                        : Optional.empty();
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
        }

        public String formatRecord() {
            if (actor.contains("@") && severity >= HIGH_RISK_THRESHOLD) {
                return "HIGH_RISK|%d|%s|%s".formatted(severity, actor.toLowerCase(), action);
            }
            return "STANDARD|%d|%s|%s".formatted(severity, actor, action);
        }
    }

    public void setAuditFilePath(Path auditFilePath) {
        this.auditFilePath = Objects.requireNonNull(auditFilePath);
    }

    public Path getAuditFilePath() {
        return this.auditFilePath;
    }

    public int ingestRawEvents(String[] rawPayloads) {
        if (rawPayloads == null || rawPayloads.length == 0) {
            return 0;
        }
        List<String> formattedRecords = Arrays.stream(rawPayloads)
                .map(AuditEntry::parse)
                .flatMap(Optional::stream)
                .map(AuditEntry::formatRecord)
                .toList();

        persistBatch(formattedRecords);
        return formattedRecords.size();
    }

    private void persistBatch(List<String> records) {
        try (BufferedWriter writer = Files.newBufferedWriter(
                auditFilePath, StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
            for (String record : records) {
                writer.write(record);
                writer.newLine();
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to persist compliance audit batch", e);
        }
    }

    public List<String> readPersistedLogs() throws IOException {
        return Files.readAllLines(auditFilePath);
    }
}

```
**Senior AI Review Checkpoint:**
The reviewer verifies that the raw `FileWriter` has been replaced by a `try-with-resources` construct and that swallowed `IOException` and `Exception` blocks have been eliminated. The candidate must also demonstrate clean separation between pure in-memory parsing (`AuditEntry`) and disk I/O (`persistBatch`), alongside the removal of `System.out.println`.

## Middle (L1) Refactoring & Code Review Katas

### KATA-05: Perishable Dark-Store Dynamic Pricer
**Target Grade:** Middle L1
**Domain & Enterprise Context:** Quick-Commerce Dark-Store Inventory & Expiry-Driven Dynamic Valuation
**Real-World Interview Origin:** Ozon Express, Yandex Lavka, and Amazon Fresh L1 interviews, serving as an enterprise adaptation of classic time-decay and quality-mutation katas.
**Core Code Smells & Anti-Patterns:**

1. **Deeply Nested Negative Conditionals (`recalculateDailyIndex`):** Branches on inverted category names (`!sku.category.equals("VINTAGE_WINE") && !sku.category.equals("FLASH_PROMO_VOUCHER")`), creating an impenetrable arrow anti-pattern.
2. **Interleaved Time Decay and Valuation Mutation:** Decrements `daysUntilExpiry` in the middle of the valuation method, forcing post-expiry adjustments to repeat the same upper and lower clamping checks (`0` to `100`) found in the pre-expiry block.
3. **Closed to New SKU Rules:** Introducing a new `"ULTRA_FRESH_DAIRY"` category (which decays twice as fast as standard groceries) into the existing conditional tangle risks breaking existing category invariants.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.qcommerce.pricing;

import java.util.List;

public class DarkStoreValuationEngine {

    public static class InventorySku {
        public String category;
        public int daysUntilExpiry;
        public int valueIndex;

        public InventorySku(String category, int daysUntilExpiry, int valueIndex) {
            this.category = category;
            this.daysUntilExpiry = daysUntilExpiry;
            this.valueIndex = valueIndex;
        }
    }

    private final List<InventorySku> skus;

    public DarkStoreValuationEngine(List<InventorySku> skus) {
        this.skus = skus;
    }

    public List<InventorySku> getSkus() {
        return skus;
    }

    public void recalculateDailyIndex() {
        for (int i = 0; i < skus.size(); i++) {
            InventorySku sku = skus.get(i);
            if (!sku.category.equals("VINTAGE_WINE")
                    && !sku.category.equals("FLASH_PROMO_VOUCHER")) {
                if (sku.valueIndex > 0) {
                    if (!sku.category.equals("BULLION_RESERVE")) {
                        sku.valueIndex = sku.valueIndex - 1;
                    }
                }
            } else {
                if (sku.valueIndex < 100) {
                    sku.valueIndex = sku.valueIndex + 1;
                    if (sku.category.equals("FLASH_PROMO_VOUCHER")) {
                        if (sku.daysUntilExpiry < 11) {
                            if (sku.valueIndex < 100) {
                                sku.valueIndex = sku.valueIndex + 1;
                            }
                        }
                        if (sku.daysUntilExpiry < 6) {
                            if (sku.valueIndex < 100) {
                                sku.valueIndex = sku.valueIndex + 1;
                            }
                        }
                    }
                }
            }

            if (!sku.category.equals("BULLION_RESERVE")) {
                sku.daysUntilExpiry = sku.daysUntilExpiry - 1;
            }

            if (sku.daysUntilExpiry < 0) {
                if (!sku.category.equals("VINTAGE_WINE")) {
                    if (!sku.category.equals("FLASH_PROMO_VOUCHER")) {
                        if (sku.valueIndex > 0) {
                            if (!sku.category.equals("BULLION_RESERVE")) {
                                sku.valueIndex = sku.valueIndex - 1;
                            }
                        }
                    } else {
                        sku.valueIndex = 0;
                    }
                } else {
                    if (sku.valueIndex < 100) {
                        sku.valueIndex = sku.valueIndex + 1;
                    }
                }
            }
        }
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.qcommerce.pricing;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.qcommerce.pricing.DarkStoreValuationEngine.InventorySku;

class DarkStoreValuationEngineTest {

    @ParameterizedTest
    @CsvSource({
        "STANDARD_GROCERY, 10, 20, 9, 19",
        "STANDARD_GROCERY, 0, 20, -1, 18",
        "STANDARD_GROCERY, 5, 0, 4, 0",
        "VINTAGE_WINE, 10, 40, 9, 41",
        "VINTAGE_WINE, 0, 40, -1, 42",
        "VINTAGE_WINE, 5, 100, 4, 100",
        "BULLION_RESERVE, 0, 80, 0, 80",
        "FLASH_PROMO_VOUCHER, 15, 20, 14, 21",
        "FLASH_PROMO_VOUCHER, 10, 20, 9, 22",
        "FLASH_PROMO_VOUCHER, 5, 20, 4, 23",
        "FLASH_PROMO_VOUCHER, 0, 20, -1, 0"
    })
    void preservesAllLegacyValuationTransitions(
            String category, int initialDays, int initialIndex, int expectedDays, int expectedIndex) {
        var sku = new InventorySku(category, initialDays, initialIndex);
        new DarkStoreValuationEngine(List.of(sku)).recalculateDailyIndex();
        assertEquals(expectedDays, sku.daysUntilExpiry);
        assertEquals(expectedIndex, sku.valueIndex);
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
After establishing full branch coverage via parameterized pin-down tests, the tangled conditional loop is replaced with the Strategy pattern implemented through a `sealed interface ValuationPolicy`. Each SKU category (`BullionPolicy`, `VintageWinePolicy`, `FlashPromoPolicy`, and `StandardDecayPolicy`) encapsulates its own daily expiry transition and valuation delta in a cohesive unit. Boundary enforcement between `0` and `100` is centralized inside the interface's `adjustValue` default method using Java 21's `Math.clamp`, allowing new categories like `"ULTRA_FRESH_DAIRY"` (`new StandardDecayPolicy(2)`) to be added in one line without modifying existing policies.
**Target Clean Reference Solution:**

```java
package com.enterprise.qcommerce.pricing;

import java.util.List;

public class DarkStoreValuationEngine {
    private static final int MAX_INDEX = 100;
    private static final int MIN_INDEX = 0;

    public static class InventorySku {
        public String category;
        public int daysUntilExpiry;
        public int valueIndex;

        public InventorySku(String category, int daysUntilExpiry, int valueIndex) {
            this.category = category;
            this.daysUntilExpiry = daysUntilExpiry;
            this.valueIndex = valueIndex;
        }
    }

    private sealed interface ValuationPolicy {
        void update(InventorySku sku);

        default void adjustValue(InventorySku sku, int delta) {
            sku.valueIndex = Math.clamp(sku.valueIndex + delta, MIN_INDEX, MAX_INDEX);
        }
    }

    private record BullionPolicy() implements ValuationPolicy {
        @Override
        public void update(InventorySku sku) {
            // Reserve bullion never expires or decays in valuation
        }
    }

    private record VintageWinePolicy() implements ValuationPolicy {
        @Override
        public void update(InventorySku sku) {
            sku.daysUntilExpiry--;
            int appreciation = sku.daysUntilExpiry < 0 ? 2 : 1;
            adjustValue(sku, appreciation);
        }
    }

    private record FlashPromoPolicy() implements ValuationPolicy {
        @Override
        public void update(InventorySku sku) {
            int boost = 1;
            if (sku.daysUntilExpiry < 11) boost++;
            if (sku.daysUntilExpiry < 6) boost++;
            sku.daysUntilExpiry--;
            if (sku.daysUntilExpiry < 0) {
                sku.valueIndex = MIN_INDEX;
            } else {
                adjustValue(sku, boost);
            }
        }
    }

    private record StandardDecayPolicy(int baseDecayRate) implements ValuationPolicy {
        @Override
        public void update(InventorySku sku) {
            sku.daysUntilExpiry--;
            int decay = sku.daysUntilExpiry < 0 ? baseDecayRate * 2 : baseDecayRate;
            adjustValue(sku, -decay);
        }
    }

    private final List<InventorySku> skus;

    public DarkStoreValuationEngine(List<InventorySku> skus) {
        this.skus = skus;
    }

    public List<InventorySku> getSkus() {
        return skus;
    }

    public void recalculateDailyIndex() {
        for (InventorySku sku : skus) {
            resolvePolicy(sku.category).update(sku);
        }
    }

    private ValuationPolicy resolvePolicy(String category) {
        return switch (category) {
            case "BULLION_RESERVE" -> new BullionPolicy();
            case "VINTAGE_WINE" -> new VintageWinePolicy();
            case "FLASH_PROMO_VOUCHER" -> new FlashPromoPolicy();
            case "ULTRA_FRESH_DAIRY" -> new StandardDecayPolicy(2);
            default -> new StandardDecayPolicy(1);
        };
    }
}

```
**Senior AI Review Checkpoint:**
The grading rubric confirms that the candidate untangled the pre-expiry and post-expiry conditional blocks into cohesive per-category `ValuationPolicy` strategies. It also checks that index clamping (`[0, 100]`) is centralized via `Math.clamp` rather than repeated across nested `if` checks, and that the public fields of `InventorySku` remain untouched to respect legacy contract constraints.

### KATA-06: Corporate Travel Expense Authorizer
**Target Grade:** Middle L1
**Domain & Enterprise Context:** Enterprise ERP Expense Reimbursement & Approver Graph Verification
**Real-World Interview Origin:** Avito, Booking.com, and T-Bank L1 live refactoring sessions, directly testing the dependency-breaking Seam techniques popularized by Sandro Mancuso and Michael Feathers.
**Core Code Smells & Anti-Patterns:**

1. **Hardwired Static & Singleton Dependencies (`SecurityContextHolder.getInstance()`, `ExpenseLedgerDao.findClaimsByEmployee()`):** Prevents unit testing without initializing an external SSO session and database connection.
2. **Feature Envy (`for (Employee delegate : targetEmployee.getApproverDelegates())`):** The service manually iterates through `Employee` internals to determine whether the logged-in auditor is an authorized delegate instead of delegating that domain query to the `Employee` entity.
3. **Defensive Clutter & Inverted Guard Flow:** Initializes a mutable `ArrayList` before checking whether the user is even authenticated, burying the `UnauthorizedAuditorException` inside a trailing `else` clause.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.erp.expense;

import java.util.ArrayList;
import java.util.List;

public class ExpenseAuthorizationService {

    public record ExpenseClaim(String claimId, long amountCents) {}

    public static class UnauthorizedAuditorException extends RuntimeException {}

    public static class Employee {
        private final String employeeId;
        private final List<Employee> approverDelegates = new ArrayList<>();
        private final List<ExpenseClaim> claims = new ArrayList<>();

        public Employee(String employeeId) {
            this.employeeId = employeeId;
        }
        public String getEmployeeId() {
            return employeeId;
        }
        public void addDelegate(Employee delegate) {
            approverDelegates.add(delegate);
        }
        public void addClaim(ExpenseClaim claim) {
            claims.add(claim);
        }
        public List<Employee> getApproverDelegates() {
            return approverDelegates;
        }
        public List<ExpenseClaim> getClaims() {
            return claims;
        }
    }

    public static class SecurityContextHolder {
        private static final SecurityContextHolder INSTANCE = new SecurityContextHolder();
        public static SecurityContextHolder getInstance() {
            return INSTANCE;
        }
        public Employee getLoggedAuditor() {
            throw new UnsupportedOperationException("Static SSO session unavailable in unit test!");
        }
    }

    public static class ExpenseLedgerDao {
        public static List<ExpenseClaim> findClaimsByEmployee(Employee employee) {
            throw new UnsupportedOperationException("Static JDBC connection unavailable in unit test!");
        }
    }

    public List<ExpenseClaim> getReviewableClaims(Employee targetEmployee) {
        List<ExpenseClaim> claimList = new ArrayList<>();
        Employee loggedAuditor = SecurityContextHolder.getInstance().getLoggedAuditor();
        boolean isDelegate = false;
        if (loggedAuditor != null) {
            for (Employee delegate : targetEmployee.getApproverDelegates()) {
                if (delegate.equals(loggedAuditor)) {
                    isDelegate = true;
                    break;
                }
            }
            if (isDelegate) {
                claimList = ExpenseLedgerDao.findClaimsByEmployee(targetEmployee);
            }
            return claimList;
        } else {
            throw new UnauthorizedAuditorException();
        }
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.erp.expense;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import com.enterprise.erp.expense.ExpenseAuthorizationService.*;

class ExpenseAuthorizationServiceTest {

    @Test
    void throwsWhenAuditorIsUnauthenticated() {
        var service = new ExpenseAuthorizationService(() -> null, emp -> List.of());
        var target = new Employee("EMP-100");
        assertThrows(UnauthorizedAuditorException.class, () -> service.getReviewableClaims(target));
    }

    @Test
    void returnsEmptyListWhenAuditorIsNotAuthorizedDelegate() {
        var auditor = new Employee("AUD-1");
        var otherDelegate = new Employee("AUD-2");
        var target = new Employee("EMP-100");
        target.addDelegate(otherDelegate);

        var service = new ExpenseAuthorizationService(() -> auditor, emp -> List.of(new ExpenseClaim("C1", 5000)));
        assertTrue(service.getReviewableClaims(target).isEmpty());
    }

    @Test
    void returnsClaimsWhenAuditorIsAuthorizedDelegate() {
        var auditor = new Employee("AUD-1");
        var target = new Employee("EMP-100");
        target.addDelegate(auditor);
        var expected = List.of(new ExpenseClaim("C1", 5000));

        var service = new ExpenseAuthorizationService(() -> auditor, emp -> expected);
        assertEquals(expected, service.getReviewableClaims(target));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
Following Michael Feathers' legacy seam methodology, the hardwired static calls to `SecurityContextHolder` and `ExpenseLedgerDao` are extracted behind functional Collaborator interfaces (`AuditorSessionProvider` and `ExpenseClaimRepository`) injected via a new constructor, while preserving the default no-argument constructor so legacy callers remain unbroken. Next, Feature Envy is resolved by moving the delegate membership check into `Employee.isAuthorizedDelegate(Employee)`, and the authentication check is hoisted to the top of `getReviewableClaims` as a guard clause.
**Target Clean Reference Solution:**

```java
package com.enterprise.erp.expense;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class ExpenseAuthorizationService {

    public record ExpenseClaim(String claimId, long amountCents) {}

    public static class UnauthorizedAuditorException extends RuntimeException {}

    @FunctionalInterface
    public interface AuditorSessionProvider {
        Employee getLoggedAuditor();
    }

    @FunctionalInterface
    public interface ExpenseClaimRepository {
        List<ExpenseClaim> findClaimsByEmployee(Employee employee);
    }

    public static class Employee {
        private final String employeeId;
        private final List<Employee> approverDelegates = new ArrayList<>();
        private final List<ExpenseClaim> claims = new ArrayList<>();

        public Employee(String employeeId) {
            this.employeeId = Objects.requireNonNull(employeeId);
        }
        public String getEmployeeId() {
            return employeeId;
        }
        public void addDelegate(Employee delegate) {
            approverDelegates.add(Objects.requireNonNull(delegate));
        }
        public void addClaim(ExpenseClaim claim) {
            claims.add(Objects.requireNonNull(claim));
        }
        public List<Employee> getApproverDelegates() {
            return Collections.unmodifiableList(approverDelegates);
        }
        public List<ExpenseClaim> getClaims() {
            return Collections.unmodifiableList(claims);
        }

        public boolean isAuthorizedDelegate(Employee candidate) {
            return approverDelegates.contains(candidate);
        }
    }

    public static class SecurityContextHolder {
        private static final SecurityContextHolder INSTANCE = new SecurityContextHolder();
        public static SecurityContextHolder getInstance() {
            return INSTANCE;
        }
        public Employee getLoggedAuditor() {
            throw new UnsupportedOperationException("Static SSO session unavailable in unit test!");
        }
    }

    public static class ExpenseLedgerDao {
        public static List<ExpenseClaim> findClaimsByEmployee(Employee employee) {
            throw new UnsupportedOperationException("Static JDBC connection unavailable in unit test!");
        }
    }

    private final AuditorSessionProvider sessionProvider;
    private final ExpenseClaimRepository claimRepository;

    public ExpenseAuthorizationService() {
        this(() -> SecurityContextHolder.getInstance().getLoggedAuditor(),
             ExpenseLedgerDao::findClaimsByEmployee);
    }

    public ExpenseAuthorizationService(
            AuditorSessionProvider sessionProvider,
            ExpenseClaimRepository claimRepository) {
        this.sessionProvider = Objects.requireNonNull(sessionProvider);
        this.claimRepository = Objects.requireNonNull(claimRepository);
    }

    public List<ExpenseClaim> getReviewableClaims(Employee targetEmployee) {
        Employee loggedAuditor = sessionProvider.getLoggedAuditor();
        if (loggedAuditor == null) {
            throw new UnauthorizedAuditorException();
        }
        return targetEmployee.isAuthorizedDelegate(loggedAuditor)
                ? claimRepository.findClaimsByEmployee(targetEmployee)
                : List.of();
    }
}

```
**Senior AI Review Checkpoint:**
The evaluation rubric verifies that the candidate broke both static dependencies (`SecurityContextHolder` and `ExpenseLedgerDao`) using seams or constructor injection while keeping the default no-argument constructor operational. It also checks that the Feature Envy loop was moved into `Employee.isAuthorizedDelegate(Employee)` and that `List.of()` replaced the premature mutable `ArrayList` allocation.

### KATA-07: Omnichannel Promotional Cart Settlement Engine
**Target Grade:** Middle L1
**Domain & Enterprise Context:** E-Commerce Checkout, Multi-Item Bundle Discounts, and Dual Receipt Rendering
**Real-World Interview Origin:** Wildberries, Yandex Market, and European retail tech interviews, synthesizing e-shop basket code review challenges and promotional receipt katas.
**Core Code Smells & Anti-Patterns:**

1. **Binary Floating-Point Currency Arithmetic (`double`):** Uses `double` for monetary prices and percentage discounts, causing IEEE 754 rounding drift on multi-item receipts.
2. **Feature Envy & Monolithic Discount Switch (`settleAndPrintTextReceipt`):** The checkout engine reaches into `Product` and `Offer` internals to compute 3-for-2 deals, N-for-X-price packs, and percentage discounts inside one procedural loop.
3. **Coupled Calculation and Presentation:** Mixes discount calculation directly with plain-text receipt string building, making it impossible to add HTML receipt rendering or multi-SKU bundle discounts without duplicating pricing logic.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.ecommerce.checkout;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class PromotionalCartSettlement {

    public enum OfferType { THREE_FOR_TWO, PERCENT_OFF, FIVE_FOR_AMOUNT }

    public record Product(String sku, double unitPrice) {}
    public record Offer(OfferType type, double argument) {}
    public record CartItem(Product product, int quantity) {}

    public String settleAndPrintTextReceipt(List<CartItem> items, Map<String, Offer> catalogOffers) {
        double total = 0.0;
        Map<Product, Integer> aggregated = new LinkedHashMap<>();
        for (CartItem item : items) {
            aggregated.put(item.product(), aggregated.getOrDefault(item.product(), 0) + item.quantity());
        }

        StringBuilder receipt = new StringBuilder("RECEIPT\n");
        for (CartItem item : items) {
            double linePrice = item.product().unitPrice() * item.quantity();
            total += linePrice;
            receipt.append(String.format(Locale.US, "%s x%d: %.2f\n",
                    item.product().sku(), item.quantity(), linePrice));
        }

        for (Map.Entry<Product, Integer> entry : aggregated.entrySet()) {
            Product p = entry.getKey();
            int qty = entry.getValue();
            if (catalogOffers.containsKey(p.sku())) {
                Offer offer = catalogOffers.get(p.sku());
                double discount = 0.0;
                String desc = "";
                if (offer.type() == OfferType.THREE_FOR_TWO && qty >= 3) {
                    int freeItems = qty / 3;
                    discount = freeItems * p.unitPrice();
                    desc = "3-for-2 (" + p.sku() + ")";
                } else if (offer.type() == OfferType.PERCENT_OFF) {
                    discount = qty * p.unitPrice() * (offer.argument() / 100.0);
                    desc = (int) offer.argument() + "% off (" + p.sku() + ")";
                } else if (offer.type() == OfferType.FIVE_FOR_AMOUNT && qty >= 5) {
                    int packs = qty / 5;
                    int remainder = qty % 5;
                    double discountedTotal = (packs * offer.argument()) + (remainder * p.unitPrice());
                    discount = (qty * p.unitPrice()) - discountedTotal;
                    desc = "5-for-" + String.format(Locale.US, "%.2f", offer.argument()) + " (" + p.sku() + ")";
                }
                if (discount > 0.0) {
                    total -= discount;
                    receipt.append(String.format(Locale.US, "DISCOUNT %s: -%.2f\n", desc, discount));
                }
            }
        }
        receipt.append(String.format(Locale.US, "TOTAL: %.2f", total));
        return receipt.toString();
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.ecommerce.checkout;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.ecommerce.checkout.PromotionalCartSettlement.*;

class PromotionalCartSettlementTest {

    @Test
    void calculatesDiscountsAndFormatsReceiptDeterministically() {
        Product brush = new Product("BRUSH", 0.99);
        Product apples = new Product("APPLES", 1.99);
        Product paste = new Product("PASTE", 1.79);

        List<CartItem> cart = List.of(
            new CartItem(brush, 3),
            new CartItem(apples, 2),
            new CartItem(paste, 6)
        );
        Map<String, Offer> offers = Map.of(
            "BRUSH", new Offer(OfferType.THREE_FOR_TWO, 0),
            "APPLES", new Offer(OfferType.PERCENT_OFF, 20.0),
            "PASTE", new Offer(OfferType.FIVE_FOR_AMOUNT, 7.49)
        );

        String expected = """
                RECEIPT
                BRUSH x3: 2.97
                APPLES x2: 3.98
                PASTE x6: 10.74
                DISCOUNT 3-for-2 (BRUSH): -0.99
                DISCOUNT 20% off (APPLES): -0.80
                DISCOUNT 5-for-7.49 (PASTE): -1.46
                TOTAL: 14.44""";

        assertEquals(expected, new PromotionalCartSettlement().settleAndPrintTextReceipt(cart, offers));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To eliminate binary floating-point inaccuracy, all monetary calculations are migrated from `double` to `BigDecimal` with explicit `RoundingMode.HALF_UP` scale enforcement. Feature Envy is resolved by moving discount evaluation directly into `Offer.evaluate(Product, int)`, which returns an `Optional<DiscountLine>` record. Finally, cart settlement calculation (`settleCart`) is decoupled from presentation via an intermediate `SettledReceipt` value object so plain-text and HTML receipt formatters can share identical financial totals without code duplication.
**Target Clean Reference Solution:**

```java
package com.enterprise.ecommerce.checkout;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public class PromotionalCartSettlement {

    public enum OfferType { THREE_FOR_TWO, PERCENT_OFF, FIVE_FOR_AMOUNT }

    public record Product(String sku, double unitPrice) {
        public BigDecimal decimalPrice() {
            return BigDecimal.valueOf(unitPrice).setScale(2, RoundingMode.HALF_UP);
        }
    }

    public record Offer(OfferType type, double argument) {
        public Optional<DiscountLine> evaluate(Product product, int qty) {
            BigDecimal unit = product.decimalPrice();
            BigDecimal totalRaw = unit.multiply(BigDecimal.valueOf(qty));
            return switch (type) {
                case THREE_FOR_TWO -> qty >= 3
                        ? Optional.of(new DiscountLine("3-for-2 (" + product.sku() + ")",
                          unit.multiply(BigDecimal.valueOf(qty / 3))))
                        : Optional.empty();
                case PERCENT_OFF -> {
                    BigDecimal factor = BigDecimal.valueOf(argument)
                            .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
                    BigDecimal disc = totalRaw.multiply(factor).setScale(2, RoundingMode.HALF_UP);
                    yield disc.compareTo(BigDecimal.ZERO) > 0
                            ? Optional.of(new DiscountLine((int) argument + "% off (" + product.sku() + ")", disc))
                            : Optional.empty();
                }
                case FIVE_FOR_AMOUNT -> {
                    if (qty < 5) yield Optional.empty();
                    BigDecimal packPrice = BigDecimal.valueOf(argument).setScale(2, RoundingMode.HALF_UP);
                    BigDecimal discounted = packPrice.multiply(BigDecimal.valueOf(qty / 5))
                            .add(unit.multiply(BigDecimal.valueOf(qty % 5)));
                    yield Optional.of(new DiscountLine(
                            String.format(Locale.US, "5-for-%.2f (%s)", argument, product.sku()),
                            totalRaw.subtract(discounted)));
                }
            };
        }
    }

    public record CartItem(Product product, int quantity) {
        public BigDecimal lineTotal() {
            return product.decimalPrice().multiply(BigDecimal.valueOf(quantity));
        }
    }

    public record DiscountLine(String description, BigDecimal amount) {}
    public record SettledReceipt(List<CartItem> items, List<DiscountLine> discounts, BigDecimal netTotal) {}

    public SettledReceipt settleCart(List<CartItem> items, Map<String, Offer> catalogOffers) {
        Map<Product, Integer> aggregated = new LinkedHashMap<>();
        BigDecimal gross = BigDecimal.ZERO;
        for (CartItem item : items) {
            aggregated.merge(item.product(), item.quantity(), Integer::sum);
            gross = gross.add(item.lineTotal());
        }
        List<DiscountLine> discounts = new ArrayList<>();
        BigDecimal totalDiscount = BigDecimal.ZERO;
        for (var entry : aggregated.entrySet()) {
            Offer offer = catalogOffers.get(entry.getKey().sku());
            if (offer != null) {
                Optional<DiscountLine> disc = offer.evaluate(entry.getKey(), entry.getValue());
                if (disc.isPresent()) {
                    discounts.add(disc.get());
                    totalDiscount = totalDiscount.add(disc.get().amount());
                }
            }
        }
        return new SettledReceipt(items, discounts, gross.subtract(totalDiscount));
    }

    public String settleAndPrintTextReceipt(List<CartItem> items, Map<String, Offer> catalogOffers) {
        SettledReceipt settled = settleCart(items, catalogOffers);
        StringBuilder sb = new StringBuilder("RECEIPT\n");
        for (CartItem item : settled.items()) {
            sb.append(String.format(Locale.US, "%s x%d: %.2f\n",
                    item.product().sku(), item.quantity(), item.lineTotal()));
        }
        for (DiscountLine d : settled.discounts()) {
            sb.append(String.format(Locale.US, "DISCOUNT %s: -%.2f\n", d.description(), d.amount()));
        }
        sb.append(String.format(Locale.US, "TOTAL: %.2f", settled.netTotal()));
        return sb.toString();
    }
}

```
**Senior AI Review Checkpoint:**
The reviewer verifies that floating-point `double` accumulation has been replaced with `BigDecimal` scaled arithmetic (`RoundingMode.HALF_UP`). The rubric also requires that the settlement calculation produces an immutable `SettledReceipt` domain model completely decoupled from string formatting so that HTML receipt rendering or bundle offers can be added cleanly.

### KATA-08: Cloud Compute Usage & SLA Rebate Statement Engine
**Target Grade:** Middle L1
**Domain & Enterprise Context:** Cloud Infrastructure Tenant Metering, Tiered Compute Pricing, and Plain-Text/HTML Invoice Generation
**Real-World Interview Origin:** Yandex Cloud, AWS, and Stripe Billing L1 interviews, serving as a cloud-infrastructure adaptation of Martin Fowler's classic statement-generation refactoring architecture.
**Core Code Smells & Anti-Patterns:**

1. **Tangled Calculation and Formatting Loop (`generateStatement`):** Computes workload costs, accumulates SLA rebate credits, formats currency strings, and builds plain-text output inside a single monolithic loop.
2. **Switch-on-Workload-Category Duplication:** Adding an HTML statement generator or a new `"AI_TENSOR_CLUSTER"` compute tier requires copying the loop or modifying fragile switch blocks.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.cloud.billing;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class CloudUsageStatementGenerator {

    public record WorkloadSpec(String name, String tier) {}
    public record UsageRecord(String workloadId, int vcpuHours) {}
    public record TenantInvoice(String tenantName, List<UsageRecord> usage) {}

    public String generateStatement(TenantInvoice invoice, Map<String, WorkloadSpec> catalog) {
        int totalAmountCents = 0;
        int slaRebateCredits = 0;
        StringBuilder result = new StringBuilder("Cloud Usage Statement for " + invoice.tenantName() + "\n");
        NumberFormat currency = NumberFormat.getCurrencyInstance(Locale.US);

        for (UsageRecord rec : invoice.usage()) {
            WorkloadSpec spec = catalog.get(rec.workloadId());
            if (spec == null) {
                throw new IllegalArgumentException("Unregistered workloadId: " + rec.workloadId());
            }
            int thisAmount = 0;
            switch (spec.tier()) {
                case "BATCH_COMPUTE":
                    thisAmount = 40000;
                    if (rec.vcpuHours() > 30) {
                        thisAmount += 1000 * (rec.vcpuHours() - 30);
                    }
                    break;
                case "LOW_LATENCY_EDGE":
                    thisAmount = 30000;
                    if (rec.vcpuHours() > 20) {
                        thisAmount += 10000 + 500 * (rec.vcpuHours() - 20);
                    }
                    thisAmount += 300 * rec.vcpuHours();
                    break;
                default:
                    throw new IllegalArgumentException("Unknown tier: " + spec.tier());
            }

            slaRebateCredits += Math.max(rec.vcpuHours() - 30, 0);
            if ("LOW_LATENCY_EDGE".equals(spec.tier())) {
                slaRebateCredits += rec.vcpuHours() / 5;
            }

            result.append(String.format("  %s: %s (%d vCPU-hrs)\n",
                    spec.name(), currency.format(thisAmount / 100.0), rec.vcpuHours()));
            totalAmountCents += thisAmount;
        }

        result.append(String.format("Total owed is %s\n", currency.format(totalAmountCents / 100.0)));
        result.append(String.format("Earned %d SLA rebate credits\n", slaRebateCredits));
        return result.toString();
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.cloud.billing;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.cloud.billing.CloudUsageStatementGenerator.*;

class CloudUsageStatementGeneratorTest {

    @Test
    void rendersExactUsageStatementAndRebateCredits() {
        var catalog = Map.of(
            "k8s-prod", new WorkloadSpec("Prod K8s Workers", "BATCH_COMPUTE"),
            "cdn-eu", new WorkloadSpec("EU Edge Router", "LOW_LATENCY_EDGE"),
            "etl-nightly", new WorkloadSpec("Nightly Spark Job", "BATCH_COMPUTE")
        );
        var invoice = new TenantInvoice("FinCorp Global", List.of(
            new UsageRecord("k8s-prod", 55),
            new UsageRecord("cdn-eu", 35),
            new UsageRecord("etl-nightly", 20)
        ));

        String expected = """
                Cloud Usage Statement for FinCorp Global
                  Prod K8s Workers: $650.00 (55 vCPU-hrs)
                  EU Edge Router: $580.00 (35 vCPU-hrs)
                  Nightly Spark Job: $400.00 (20 vCPU-hrs)
                Total owed is $1,630.00
                Earned 37 SLA rebate credits
                """;

        assertEquals(expected, new CloudUsageStatementGenerator().generateStatement(invoice, catalog));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
Applying Martin Fowler's *Split Phase* and *Replace Conditional with Polymorphism* refactorings, the statement generator is divided into two distinct phases. The first phase (`buildStatementData`) maps each `UsageRecord` through a polymorphic `TierPricing` sealed interface hierarchy (`BatchComputePricing` and `LowLatencyEdgePricing`) to produce an immutable `StatementData` intermediate record containing enriched line items and aggregated totals. The second phase (`renderPlainText` or `renderHtml`) consumes `StatementData` purely as a view presenter without performing any financial arithmetic.
**Target Clean Reference Solution:**

```java
package com.enterprise.cloud.billing;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class CloudUsageStatementGenerator {

    public record WorkloadSpec(String name, String tier) {}
    public record UsageRecord(String workloadId, int vcpuHours) {}
    public record TenantInvoice(String tenantName, List<UsageRecord> usage) {}

    public record EnrichedLine(String workloadName, int vcpuHours, int amountCents, int rebateCredits) {}
    public record StatementData(String tenantName, List<EnrichedLine> lines, int totalAmountCents, int totalCredits) {}

    private sealed interface TierPricing {
        int calculateAmountCents(int hours);
        default int calculateCredits(int hours) {
            return Math.max(hours - 30, 0);
        }

        static TierPricing forTier(String tier) {
            return switch (tier) {
                case "BATCH_COMPUTE" -> new BatchComputePricing();
                case "LOW_LATENCY_EDGE" -> new LowLatencyEdgePricing();
                default -> throw new IllegalArgumentException("Unknown tier: " + tier);
            };
        }
    }

    private record BatchComputePricing() implements TierPricing {
        @Override
        public int calculateAmountCents(int hours) {
            return 40000 + (hours > 30 ? 1000 * (hours - 30) : 0);
        }
    }

    private record LowLatencyEdgePricing() implements TierPricing {
        @Override
        public int calculateAmountCents(int hours) {
            int base = 30000 + (300 * hours);
            return hours > 20 ? base + 10000 + 500 * (hours - 20) : base;
        }
        @Override
        public int calculateCredits(int hours) {
            return TierPricing.super.calculateCredits(hours) + (hours / 5);
        }
    }

    public String generateStatement(TenantInvoice invoice, Map<String, WorkloadSpec> catalog) {
        return renderPlainText(buildStatementData(invoice, catalog));
    }

    public StatementData buildStatementData(TenantInvoice invoice, Map<String, WorkloadSpec> catalog) {
        List<EnrichedLine> lines = invoice.usage().stream().map(rec -> {
            WorkloadSpec spec = catalog.get(rec.workloadId());
            if (spec == null) {
                throw new IllegalArgumentException("Unregistered workloadId: " + rec.workloadId());
            }
            TierPricing pricing = TierPricing.forTier(spec.tier());
            return new EnrichedLine(
                    spec.name(),
                    rec.vcpuHours(),
                    pricing.calculateAmountCents(rec.vcpuHours()),
                    pricing.calculateCredits(rec.vcpuHours()));
        }).toList();

        int totalAmount = lines.stream().mapToInt(EnrichedLine::amountCents).sum();
        int totalCredits = lines.stream().mapToInt(EnrichedLine::rebateCredits).sum();
        return new StatementData(invoice.tenantName(), lines, totalAmount, totalCredits);
    }

    private String renderPlainText(StatementData data) {
        NumberFormat currency = NumberFormat.getCurrencyInstance(Locale.US);
        StringBuilder sb = new StringBuilder("Cloud Usage Statement for " + data.tenantName() + "\n");
        for (EnrichedLine line : data.lines()) {
            sb.append(String.format("  %s: %s (%d vCPU-hrs)\n",
                    line.workloadName(), currency.format(line.amountCents() / 100.0), line.vcpuHours()));
        }
        sb.append(String.format("Total owed is %s\n", currency.format(data.totalAmountCents() / 100.0)));
        sb.append(String.format("Earned %d SLA rebate credits\n", data.totalCredits()));
        return sb.toString();
    }
}

```
**Senior AI Review Checkpoint:**
The reviewer verifies that the candidate applied Martin Fowler's *Split Phase* refactoring to separate domain calculation (`StatementData`) from string rendering (`renderPlainText`). Additionally, tier-specific pricing and SLA credit formulas must be encapsulated inside polymorphic `TierPricing` records rather than scattered across switch statements and mutable loop accumulators.

## Senior (L2) Refactoring & Code Review Katas

### KATA-09: Order Batch Archiver & JPA Persistence Service
**Target Grade:** Senior L2
**Domain & Enterprise Context:** E-Commerce Order Archiving & High-Volume Spring Data JPA Persistence
**Real-World Interview Origin:** Ozon, T-Bank, and European e-commerce L2 backend interviews, directly testing the Spring Data JPA performance and correctness pitfalls highlighted at Spring I/O and Devoxx.
**Core Code Smells & Anti-Patterns:**

1. **N+1 Entity Lookup & `saveAndFlush()` in a Loop (`archiveCompletedOrders`):** Queries each order individually by ID (`findById(id)`) and invokes `saveAndFlush()` on every iteration, forcing Hibernate to dirty-check the entire persistence context $O(N^2)$ times and defeating JDBC statement batching.
2. **Spring Proxy Self-Invocation Bypass (`this.archiveCompletedOrders(validIds)`):** Calling a `@Transactional` method from a non-transactional entry method (`runNightlyArchiveJob`) within the same class bypasses the Spring AOP proxy, executing the entire batch outside a transaction boundary.
3. **Unchecked `Optional.get()` Without Guard:** Calls `orderRepository.findById(id).get()` directly, throwing `NoSuchElementException` if an ID in the batch does not exist.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.ecommerce.jpa;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class OrderBatchArchiverService {

    public static class OrderEntity {
        private final Long id;
        private String status;
        private final List<String> lineItems;

        public OrderEntity(Long id, String status, List<String> lineItems) {
            this.id = id;
            this.status = status;
            this.lineItems = lineItems;
        }
        public Long getId() { return id; }
        public String getStatus() { return status; }
        public void markArchived() { this.status = "ARCHIVED"; }
        public List<String> getLineItems() { return lineItems; }
    }

    public interface OrderRepository {
        Optional<OrderEntity> findById(Long id);
        List<OrderEntity> findAllByIdWithLineItems(Collection<Long> ids);
        void saveAndFlush(OrderEntity entity);
        int getFlushCount();
        int getSelectQueryCount();
    }

    private final OrderRepository orderRepository;

    public OrderBatchArchiverService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public int runNightlyArchiveJob(List<Long> candidateIds) {
        List<Long> validIds = new ArrayList<>();
        for (Long id : candidateIds) {
            if (id != null && id > 0) {
                validIds.add(id);
            }
        }
        // Self-invocation bypasses Spring @Transactional proxy in production
        return this.archiveCompletedOrders(validIds);
    }

    // @Transactional
    public int archiveCompletedOrders(List<Long> orderIds) {
        int archivedCount = 0;
        for (Long id : orderIds) {
            OrderEntity order = orderRepository.findById(id).get();
            if ("SETTLED".equals(order.getStatus()) && !order.getLineItems().isEmpty()) {
                order.markArchived();
                orderRepository.saveAndFlush(order);
                archivedCount++;
            }
        }
        return archivedCount;
    }

    public static class InMemoryInstrumentedOrderRepository implements OrderRepository {
        private final Map<Long, OrderEntity> store = new LinkedHashMap<>();
        private int flushCount = 0;
        private int selectQueryCount = 0;

        public void seed(OrderEntity entity) { store.put(entity.getId(), entity); }
        @Override
        public Optional<OrderEntity> findById(Long id) {
            selectQueryCount++;
            return Optional.ofNullable(store.get(id));
        }
        @Override
        public List<OrderEntity> findAllByIdWithLineItems(Collection<Long> ids) {
            selectQueryCount++;
            return ids.stream().map(store::get).filter(java.util.Objects::nonNull).toList();
        }
        @Override
        public void saveAndFlush(OrderEntity entity) {
            flushCount++;
            store.put(entity.getId(), entity);
        }
        @Override public int getFlushCount() { return flushCount; }
        @Override public int getSelectQueryCount() { return selectQueryCount; }
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.ecommerce.jpa;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.ecommerce.jpa.OrderBatchArchiverService.*;

class OrderBatchArchiverServiceTest {

    @Test
    void archivesOnlySettledOrdersWithLineItemsAndEliminatesQueryAndFlushThrashing() {
        var repo = new InMemoryInstrumentedOrderRepository();
        repo.seed(new OrderEntity(1L, "SETTLED", List.of("SKU-1")));
        repo.seed(new OrderEntity(2L, "PENDING", List.of("SKU-2")));
        repo.seed(new OrderEntity(3L, "SETTLED", List.of("SKU-3", "SKU-4")));

        var service = new OrderBatchArchiverService(repo);
        int archived = service.runNightlyArchiveJob(List.of(1L, 2L, 3L, -5L));

        assertEquals(2, archived);
        assertEquals("ARCHIVED", repo.findById(1L).orElseThrow().getStatus());
        assertEquals("PENDING", repo.findById(2L).orElseThrow().getStatus());
        assertEquals("ARCHIVED", repo.findById(3L).orElseThrow().getStatus());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To eliminate the N+1 select cascade and persistence-context flush thrashing documented by Thorben Janssen at Spring I/O, the iterative `findById(id)` calls are replaced with a single bulk query `findAllByIdWithLineItems(orderIds)` that eagerly fetches the required associations in one database round-trip. Inside the transaction boundary, `saveAndFlush(order)` is removed entirely so that JPA dirty checking flushes all mutated `OrderEntity` instances once at transaction commit. Finally, the `@Transactional` self-invocation bug in `runNightlyArchiveJob` is resolved by introducing an explicit `TransactionalBoundary` collaborator (modeling Spring's `TransactionTemplate` or an external transactional delegate).
**Target Clean Reference Solution:**

```java
package com.enterprise.ecommerce.jpa;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

public class OrderBatchArchiverService {

    public static class OrderEntity {
        private final Long id;
        private String status;
        private final List<String> lineItems;

        public OrderEntity(Long id, String status, List<String> lineItems) {
            this.id = id;
            this.status = status;
            this.lineItems = lineItems;
        }
        public Long getId() { return id; }
        public String getStatus() { return status; }
        public void markArchived() { this.status = "ARCHIVED"; }
        public List<String> getLineItems() { return lineItems; }

        public boolean archiveIfEligible() {
            if ("SETTLED".equals(status) && !lineItems.isEmpty()) {
                this.status = "ARCHIVED";
                return true;
            }
            return false;
        }
    }

    public interface OrderRepository {
        Optional<OrderEntity> findById(Long id);
        List<OrderEntity> findAllByIdWithLineItems(Collection<Long> ids);
        void saveAndFlush(OrderEntity entity);
        int getFlushCount();
        int getSelectQueryCount();
    }

    @FunctionalInterface
    public interface TransactionalBoundary {
        <T> T executeInTransaction(Supplier<T> action);
    }

    private final OrderRepository orderRepository;
    private final TransactionalBoundary transactionalBoundary;

    public OrderBatchArchiverService(OrderRepository orderRepository) {
        this(orderRepository, Supplier::get);
    }

    public OrderBatchArchiverService(
            OrderRepository orderRepository,
            TransactionalBoundary transactionalBoundary) {
        this.orderRepository = Objects.requireNonNull(orderRepository);
        this.transactionalBoundary = Objects.requireNonNull(transactionalBoundary);
    }

    public int runNightlyArchiveJob(List<Long> candidateIds) {
        List<Long> validIds = candidateIds.stream()
                .filter(id -> id != null && id > 0)
                .toList();
        if (validIds.isEmpty()) {
            return 0;
        }
        return transactionalBoundary.executeInTransaction(() -> archiveCompletedOrders(validIds));
    }

    public int archiveCompletedOrders(List<Long> orderIds) {
        List<OrderEntity> orders = orderRepository.findAllByIdWithLineItems(orderIds);
        int archivedCount = 0;
        for (OrderEntity order : orders) {
            if (order.archiveIfEligible()) {
                archivedCount++;
            }
        }
        return archivedCount;
    }

    public static class InMemoryInstrumentedOrderRepository implements OrderRepository {
        private final Map<Long, OrderEntity> store = new LinkedHashMap<>();
        private int flushCount = 0;
        private int selectQueryCount = 0;

        public void seed(OrderEntity entity) { store.put(entity.getId(), entity); }
        @Override
        public Optional<OrderEntity> findById(Long id) {
            selectQueryCount++;
            return Optional.ofNullable(store.get(id));
        }
        @Override
        public List<OrderEntity> findAllByIdWithLineItems(Collection<Long> ids) {
            selectQueryCount++;
            return ids.stream().map(store::get).filter(Objects::nonNull).toList();
        }
        @Override
        public void saveAndFlush(OrderEntity entity) {
            flushCount++;
            store.put(entity.getId(), entity);
        }
        @Override public int getFlushCount() { return flushCount; }
        @Override public int getSelectQueryCount() { return selectQueryCount; }
    }
}

```
**Senior AI Review Checkpoint:**
The automated sandbox asserts that `orderRepository.getFlushCount()` equals `0` and `orderRepository.getSelectQueryCount()` equals `1` for the entire batch execution, proving that the candidate eliminated both `saveAndFlush()` in a loop and the N+1 `findById()` anti-pattern. The reviewer also checks that the candidate addressed the `@Transactional` self-invocation bypass by routing execution through an explicit transactional boundary.

### KATA-10: Autonomous Warehouse AGV Dispatch Controller
**Target Grade:** Senior L2
**Domain & Enterprise Context:** Warehouse Robotics, Multi-Unit Dispatching, and Safety State Invariants
**Real-World Interview Origin:** Yandex Robotics, Uber, and Amazon Fulfillment L2 interviews, inspired by the state-encapsulation and safety-invariant principles of multi-lift scheduling katas.
**Core Code Smells & Anti-Patterns:**

1. **Anemic Domain Model & Parallel State Arrays (`unitZones`, `hatchOpen`, `unitDirections`):** Stores robot state across disconnected arrays indexed by integer position rather than encapsulating behavior inside a rich `AgvUnit` domain aggregate.
2. **Duplicated Safety & Movement Logic:** Both `dispatchCall` and `stepInternalTargets` manually check `hatchOpen[i]`, mutate `unitZones[i]`, and format telemetry strings across parallel array indices.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.robotics.agv;

import java.util.ArrayList;
import java.util.List;

public class WarehouseAgvController {
    public final String[] unitIds;
    public final int[] unitZones;
    public final boolean[] hatchOpen;
    public final String[] unitDirections;
    public final List<Integer>[] internalTargets;
    private final List<String> telemetryLog = new ArrayList<>();

    @SuppressWarnings("unchecked")
    public WarehouseAgvController(String[] unitIds, int[] initialZones) {
        this.unitIds = unitIds;
        this.unitZones = initialZones;
        this.hatchOpen = new boolean[unitIds.length];
        this.unitDirections = new String[unitIds.length];
        this.internalTargets = new List[unitIds.length];
        for (int i = 0; i < unitIds.length; i++) {
            this.unitDirections[i] = "IDLE";
            this.internalTargets[i] = new ArrayList<>();
        }
    }

    public void requestZoneDropoff(int unitIndex, int targetZone) {
        if (!internalTargets[unitIndex].contains(targetZone)) {
            internalTargets[unitIndex].add(targetZone);
        }
    }

    public String dispatchCall(int callZone, String desiredDirection) {
        int bestIdx = -1;
        int minDistance = Integer.MAX_VALUE;
        for (int i = 0; i < unitIds.length; i++) {
            if (unitDirections[i].equals("IDLE") || unitDirections[i].equals(desiredDirection)) {
                int dist = Math.abs(unitZones[i] - callZone);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestIdx = i;
                }
            }
        }
        if (bestIdx != -1) {
            unitDirections[bestIdx] = desiredDirection;
            if (hatchOpen[bestIdx]) {
                hatchOpen[bestIdx] = false;
            }
            unitZones[bestIdx] = callZone;
            hatchOpen[bestIdx] = true;
            internalTargets[bestIdx].remove(Integer.valueOf(callZone));
            String event = unitIds[bestIdx] + "@Z" + callZone + ":" + desiredDirection + ":HATCH_OPEN:DING";
            telemetryLog.add(event);
            return unitIds[bestIdx];
        }
        return "NONE";
    }

    public void stepInternalTargets() {
        for (int i = 0; i < unitIds.length; i++) {
            if (!internalTargets[i].isEmpty()) {
                if (hatchOpen[i]) {
                    hatchOpen[i] = false;
                }
                int nextZone = internalTargets[i].remove(0);
                unitDirections[i] = nextZone >= unitZones[i] ? "NORTH" : "SOUTH";
                unitZones[i] = nextZone;
                hatchOpen[i] = true;
                telemetryLog.add(unitIds[i] + "@Z" + nextZone + ": fulfilled_dropoff");
            }
        }
    }

    public List<String> getTelemetryLog() {
        return telemetryLog;
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.robotics.agv;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class WarehouseAgvControllerTest {

    @Test
    void dispatchesNearestCompatibleAgvAndFulfillsDropoffsWithClosedHatchInvariant() {
        var controller = new WarehouseAgvController(new String[]{"AGV-A", "AGV-B"}, new int[]{0, 3});
        controller.requestZoneDropoff(0, 2);

        String assigned = controller.dispatchCall(2, "NORTH");
        assertEquals("AGV-B", assigned);
        assertTrue(controller.hatchOpen[1]);
        assertEquals(2, controller.unitZones[1]);

        controller.stepInternalTargets();
        assertEquals(2, controller.unitZones[0]);
        assertTrue(controller.hatchOpen[0]);
        assertEquals(List.of(
            "AGV-B@Z2:NORTH:HATCH_OPEN:DING",
            "AGV-A@Z2: fulfilled_dropoff"
        ), controller.getTelemetryLog());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To cure the anemic array design and enforce physical safety invariants, a rich domain entity `AgvUnit` is extracted to encapsulate each robot's zone, loading hatch state, travel direction, and dropoff queue. `AgvUnit` enforces the domain rule that a robot can only move between zones after `closeHatchBeforeTransit()` has secured the loading hatch, and centralizes the auditory `"DING"` signal emission when answering a floor/zone call. To preserve full backward compatibility with legacy callers that inspect the public arrays directly, `syncLegacyArrays(AgvUnit)` projects the aggregate's state after each transition.
**Target Clean Reference Solution:**

```java
package com.enterprise.robotics.agv;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public class WarehouseAgvController {

    public static class AgvUnit {
        private final int index;
        private final String id;
        private int currentZone;
        private boolean hatchOpen;
        private String direction = "IDLE";
        private final List<Integer> targetZones;

        public AgvUnit(int index, String id, int initialZone, List<Integer> backingTargets) {
            this.index = index;
            this.id = id;
            this.currentZone = initialZone;
            this.targetZones = backingTargets;
        }

        public boolean canAcceptCall(String desiredDirection) {
            return "IDLE".equals(direction) || direction.equals(desiredDirection);
        }

        public int distanceTo(int zone) {
            return Math.abs(currentZone - zone);
        }

        public void queueDropoff(int targetZone) {
            if (!targetZones.contains(targetZone)) {
                targetZones.add(targetZone);
            }
        }

        public String fulfillCall(int callZone, String desiredDirection) {
            closeHatchBeforeTransit();
            this.direction = desiredDirection;
            this.currentZone = callZone;
            this.hatchOpen = true;
            this.targetZones.remove(Integer.valueOf(callZone));
            return id + "@Z" + callZone + ":" + desiredDirection + ":HATCH_OPEN:DING";
        }

        public Optional<String> stepNextDropoff() {
            if (targetZones.isEmpty()) {
                return Optional.empty();
            }
            closeHatchBeforeTransit();
            int nextZone = targetZones.removeFirst();
            this.direction = nextZone >= currentZone ? "NORTH" : "SOUTH";
            this.currentZone = nextZone;
            this.hatchOpen = true;
            return Optional.of(id + "@Z" + nextZone + ": fulfilled_dropoff");
        }

        private void closeHatchBeforeTransit() {
            if (hatchOpen) {
                hatchOpen = false;
            }
        }
    }

    public final String[] unitIds;
    public final int[] unitZones;
    public final boolean[] hatchOpen;
    public final String[] unitDirections;
    public final List<Integer>[] internalTargets;
    private final List<AgvUnit> fleet = new ArrayList<>();
    private final List<String> telemetryLog = new ArrayList<>();

    @SuppressWarnings("unchecked")
    public WarehouseAgvController(String[] unitIds, int[] initialZones) {
        this.unitIds = unitIds;
        this.unitZones = initialZones;
        this.hatchOpen = new boolean[unitIds.length];
        this.unitDirections = new String[unitIds.length];
        this.internalTargets = new List[unitIds.length];
        for (int i = 0; i < unitIds.length; i++) {
            this.unitDirections[i] = "IDLE";
            this.internalTargets[i] = new ArrayList<>();
            this.fleet.add(new AgvUnit(i, unitIds[i], initialZones[i], this.internalTargets[i]));
        }
    }

    public void requestZoneDropoff(int unitIndex, int targetZone) {
        fleet.get(unitIndex).queueDropoff(targetZone);
    }

    public String dispatchCall(int callZone, String desiredDirection) {
        Optional<AgvUnit> candidate = fleet.stream()
                .filter(unit -> unit.canAcceptCall(desiredDirection))
                .min(Comparator.comparingInt(unit -> unit.distanceTo(callZone)));

        if (candidate.isPresent()) {
            AgvUnit unit = candidate.get();
            telemetryLog.add(unit.fulfillCall(callZone, desiredDirection));
            syncLegacyArrays(unit);
            return unit.id;
        }
        return "NONE";
    }

    public void stepInternalTargets() {
        for (AgvUnit unit : fleet) {
            unit.stepNextDropoff().ifPresent(event -> {
                telemetryLog.add(event);
                syncLegacyArrays(unit);
            });
        }
    }

    private void syncLegacyArrays(AgvUnit unit) {
        unitZones[unit.index] = unit.currentZone;
        hatchOpen[unit.index] = unit.hatchOpen;
        unitDirections[unit.index] = unit.direction;
    }

    public List<String> getTelemetryLog() {
        return List.copyOf(telemetryLog);
    }
}

```
**Senior AI Review Checkpoint:**
The grading rubric verifies that the parallel state arrays are now governed by a rich `AgvUnit` domain aggregate that encapsulates the `closeHatchBeforeTransit()` safety invariant. It also checks that the manual minimum-distance loop in `dispatchCall` has been replaced by a declarative `Stream.min(Comparator.comparingInt(...))` pipeline and that Java 21's sequenced collection method `removeFirst()` is utilized.

### KATA-11: Real-Time Payment Fraud Velocity Scorer
**Target Grade:** Senior L2
**Domain & Enterprise Context:** FinTech Payment Card Anti-Fraud & Velocity Pattern Matching
**Real-World Interview Origin:** T-Bank, Stripe, and Adyen L2 interviews, adapting combinatorial tuple-scoring mechanics into a high-signal financial risk engine.
**Core Code Smells & Anti-Patterns:**

1. **Procedural Frequency Array Tallying (`int[] counts = new int[9]`):** Repeatedly instantiates raw integer frequency arrays with off-by-one index shifts (`counts[c1 - 1]++`) across every scoring method.
2. **Obfuscated Reverse-Index Arithmetic (`counts[9 - at - 1] >= 2`):** Uses error-prone manual index inversion instead of declarative sorting and grouping collectors.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.fintech.fraud;

import java.util.Arrays;

public class FraudVelocityScorer {

    public static int scoreSingleMerchantBurst(int c1, int c2, int c3, int c4, int c5, int targetCategory) {
        int sum = 0;
        if (c1 == targetCategory) sum += c1;
        if (c2 == targetCategory) sum += c2;
        if (c3 == targetCategory) sum += c3;
        if (c4 == targetCategory) sum += c4;
        if (c5 == targetCategory) sum += c5;
        return sum;
    }

    public static int scoreIdenticalMccSpike(int... codes) {
        int[] counts = new int[9];
        for (int code : codes) {
            counts[code - 1]++;
        }
        for (int i = 0; i != 9; i++) {
            if (counts[i] == 5) {
                return 100;
            }
        }
        return 0;
    }

    public static int scoreHighValuePair(int c1, int c2, int c3, int c4, int c5) {
        int[] counts = new int[9];
        counts[c1 - 1]++;
        counts[c2 - 1]++;
        counts[c3 - 1]++;
        counts[c4 - 1]++;
        counts[c5 - 1]++;
        for (int at = 0; at != 9; at++) {
            if (counts[9 - at - 1] >= 2) {
                return (9 - at) * 2;
            }
        }
        return 0;
    }

    public static int scoreDualMerchantSplit(int c1, int c2, int c3, int c4, int c5) {
        int[] counts = new int[9];
        counts[c1 - 1]++;
        counts[c2 - 1]++;
        counts[c3 - 1]++;
        counts[c4 - 1]++;
        counts[c5 - 1]++;
        int n = 0;
        int score = 0;
        for (int i = 0; i < 9; i += 1) {
            if (counts[9 - i - 1] >= 2) {
                n++;
                score += (9 - i);
            }
        }
        if (n == 2) {
            return score * 2;
        }
        return 0;
    }

    public static int scoreSequentialEscalation(int c1, int c2, int c3, int c4, int c5) {
        int[] sorted = {c1, c2, c3, c4, c5};
        Arrays.sort(sorted);
        if (sorted[0] == 1 && sorted[1] == 2 && sorted[2] == 3 && sorted[3] == 4 && sorted[4] == 5) {
            return 45;
        }
        return 0;
    }

    public static int scoreSplitStructuringWindow(int c1, int c2, int c3, int c4, int c5) {
        int[] tallies = new int[9];
        tallies[c1 - 1]++;
        tallies[c2 - 1]++;
        tallies[c3 - 1]++;
        tallies[c4 - 1]++;
        tallies[c5 - 1]++;
        boolean hasTwo = false;
        int twoVal = 0;
        boolean hasThree = false;
        int threeVal = 0;
        for (int i = 0; i != 9; i++) {
            if (tallies[i] == 2) {
                hasTwo = true;
                twoVal = i + 1;
            }
            if (tallies[i] == 3) {
                hasThree = true;
                threeVal = i + 1;
            }
        }
        if (hasTwo && hasThree) {
            return twoVal * 2 + threeVal * 3;
        }
        return 0;
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.fintech.fraud;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class FraudVelocityScorerTest {

    @Test
    void preservesAllVelocityScoringRules() {
        assertEquals(12, FraudVelocityScorer.scoreSingleMerchantBurst(4, 4, 2, 4, 1, 4));
        assertEquals(100, FraudVelocityScorer.scoreIdenticalMccSpike(7, 7, 7, 7, 7));
        assertEquals(0, FraudVelocityScorer.scoreIdenticalMccSpike(7, 7, 7, 7, 6));
        assertEquals(16, FraudVelocityScorer.scoreHighValuePair(3, 8, 8, 5, 5));
        assertEquals(26, FraudVelocityScorer.scoreDualMerchantSplit(8, 8, 5, 5, 5));
        assertEquals(45, FraudVelocityScorer.scoreSequentialEscalation(5, 3, 1, 4, 2));
        assertEquals(0, FraudVelocityScorer.scoreSequentialEscalation(2, 3, 4, 5, 6));
        assertEquals(28, FraudVelocityScorer.scoreSplitStructuringWindow(6, 6, 6, 5, 5));
        assertEquals(0, FraudVelocityScorer.scoreSplitStructuringWindow(6, 6, 6, 6, 6));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
The refactoring introduces an immutable Value Object `TransactionWindow` that wraps the 5-event sequence and precomputes a frequency map via `Collectors.groupingBy(Function.identity(), Collectors.counting())`. By exposing domain query helpers such as `codesWithMinCount(long)` (sorted in descending order) and `sumAll()`, every static velocity rule is reduced to a concise, intention-revealing expression freed from `int[9]` array indexing and off-by-one arithmetic.
**Target Clean Reference Solution:**

```java
package com.enterprise.fintech.fraud;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class FraudVelocityScorer {

    public record TransactionWindow(List<Integer> codes, Map<Integer, Long> frequencies) {
        public static TransactionWindow of(int... rawCodes) {
            List<Integer> list = IntStream.of(rawCodes).boxed().toList();
            Map<Integer, Long> freq = list.stream()
                    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
            return new TransactionWindow(list, freq);
        }

        public List<Integer> codesWithMinCount(long minCount) {
            return frequencies.entrySet().stream()
                    .filter(e -> e.getValue() >= minCount)
                    .map(Map.Entry::getKey)
                    .sorted(Comparator.reverseOrder())
                    .toList();
        }

        public int sumAll() {
            return codes.stream().mapToInt(Integer::intValue).sum();
        }
    }

    public static int scoreSingleMerchantBurst(int c1, int c2, int c3, int c4, int c5, int targetCategory) {
        return IntStream.of(c1, c2, c3, c4, c5)
                .filter(code -> code == targetCategory)
                .sum();
    }

    public static int scoreIdenticalMccSpike(int... codes) {
        return TransactionWindow.of(codes).frequencies().containsValue(5L) ? 100 : 0;
    }

    public static int scoreHighValuePair(int c1, int c2, int c3, int c4, int c5) {
        return TransactionWindow.of(c1, c2, c3, c4, c5).codesWithMinCount(2).stream()
                .findFirst()
                .map(maxCode -> maxCode * 2)
                .orElse(0);
    }

    public static int scoreDualMerchantSplit(int c1, int c2, int c3, int c4, int c5) {
        List<Integer> pairs = TransactionWindow.of(c1, c2, c3, c4, c5).codesWithMinCount(2);
        return pairs.size() == 2 ? (pairs.get(0) + pairs.get(1)) * 2 : 0;
    }

    public static int scoreSequentialEscalation(int c1, int c2, int c3, int c4, int c5) {
        List<Integer> sorted = IntStream.of(c1, c2, c3, c4, c5).sorted().boxed().toList();
        return sorted.equals(List.of(1, 2, 3, 4, 5)) ? 45 : 0;
    }

    public static int scoreSplitStructuringWindow(int c1, int c2, int c3, int c4, int c5) {
        TransactionWindow window = TransactionWindow.of(c1, c2, c3, c4, c5);
        return (window.frequencies().containsValue(2L) && window.frequencies().containsValue(3L))
                ? window.sumAll()
                : 0;
    }
}

```
**Senior AI Review Checkpoint:**
The grading rubric verifies that all four duplicated `new int[9]` frequency tally blocks and manual `counts[9 - i - 1]` index inversions have been removed. It also checks whether the candidate recognized the domain invariant in `scoreSplitStructuringWindow`: once frequencies `2L` and `3L` are confirmed in a 5-event window, the weighted sum `twoVal * 2 + threeVal * 3` is mathematically identical to `window.sumAll()`.

### KATA-12: Omnichannel Notification Fanout Service
**Target Grade:** Senior L2
**Domain & Enterprise Context:** Customer Engagement Platform, Multi-Channel Dispatching, and Fault Isolation
**Real-World Interview Origin:** Avito, Uber, and Devoxx Java best-practices sessions, testing Senior-level decoupling, `Optional` anti-patterns, and delivery fault isolation.
**Core Code Smells & Anti-Patterns:**

1. **Misuse of `Optional` as Fields and Method Parameters:** Declares `Optional<String>` as class fields inside `Subscriber` and as a method parameter in `broadcastCampaign(String, Optional<String>)`, violating modern Java API design rules that restrict `Optional` to return types.
2. **Tight Coupling to Static Transport (`LegacySmtpGateway.sendStatic`):** Invokes a static network transport directly inside the fanout loop without an abstraction seam, making isolated unit testing and transport swapping impossible.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.engagement.notify;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class OmnichannelNotificationService {

    public static class Subscriber {
        private final String id;
        private final Optional<String> email;
        private final Optional<String> phone;

        public Subscriber(String id, Optional<String> email, Optional<String> phone) {
            this.id = id;
            this.email = email;
            this.phone = phone;
        }
        public String getId() { return id; }
        public Optional<String> getEmail() { return email; }
        public Optional<String> getPhone() { return phone; }
    }

    public static class LegacySmtpGateway {
        private static final List<String> SENT_OUTBOX = new ArrayList<>();
        public static void sendStatic(String address, String body) {
            if (address.startsWith("bounce@")) {
                throw new RuntimeException("SMTP 550 Mailbox unavailable: " + address);
            }
            SENT_OUTBOX.add("EMAIL:" + address + ":" + body);
        }
        public static List<String> getSentOutbox() { return SENT_OUTBOX; }
        public static void clear() { SENT_OUTBOX.clear(); }
    }

    private final List<Subscriber> subscribers;

    public OmnichannelNotificationService(List<Subscriber> subscribers) {
        this.subscribers = subscribers;
    }

    public int broadcastCampaign(String message, Optional<String> urgentPrefix) {
        int delivered = 0;
        for (Subscriber sub : subscribers) {
            String payload = message;
            if (urgentPrefix != null && urgentPrefix.isPresent()) {
                payload = "[" + urgentPrefix.get() + "] " + message;
            }
            if (sub.getEmail() != null && sub.getEmail().isPresent()) {
                try {
                    LegacySmtpGateway.sendStatic(sub.getEmail().get(), payload);
                    delivered++;
                } catch (RuntimeException ex) {
                    // In legacy mode, rethrow only if no phone fallback exists
                    if (sub.getPhone() == null || sub.getPhone().isEmpty()) {
                        throw ex;
                    }
                }
            }
        }
        return delivered;
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.engagement.notify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import com.enterprise.engagement.notify.OmnichannelNotificationService.*;

class OmnichannelNotificationServiceTest {

    @BeforeEach
    void resetOutbox() {
        LegacySmtpGateway.clear();
    }

    @Test
    void broadcastsWithUrgentPrefixAndHandlesFallbackBehavior() {
        var subs = List.of(
            new Subscriber("U1", Optional.of("alice@corp.com"), Optional.empty()),
            new Subscriber("U2", Optional.of("bounce@corp.com"), Optional.of("+49151000")),
            new Subscriber("U3", Optional.of("bob@corp.com"), Optional.empty())
        );
        var service = new OmnichannelNotificationService(subs);
        int count = service.broadcastCampaign("System Upgrade", Optional.of("URGENT"));

        assertEquals(2, count);
        assertEquals(List.of(
            "EMAIL:alice@corp.com:[URGENT] System Upgrade",
            "EMAIL:bob@corp.com:[URGENT] System Upgrade"
        ), LegacySmtpGateway.getSentOutbox());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
Following Stephen Colebourne's Devoxx best-practices guidance on nullability and `Optional`, the internal fields of `Subscriber` are converted to nullable `String` references while preserving `Optional<String>` solely on the getter return types (`Optional.ofNullable(email)`). An overloaded `broadcastCampaign(String, String)` method eliminates the need to pass `Optional` as an argument while retaining the legacy signature as a delegating adapter. Finally, the hardwired `LegacySmtpGateway.sendStatic` call is decoupled behind an injectable `EmailTransport` functional interface.
**Target Clean Reference Solution:**

```java
package com.enterprise.engagement.notify;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class OmnichannelNotificationService {

    public static class Subscriber {
        private final String id;
        private final String email;
        private final String phone;

        public Subscriber(String id, String email, String phone) {
            this.id = Objects.requireNonNull(id);
            this.email = email;
            this.phone = phone;
        }

        public Subscriber(String id, Optional<String> email, Optional<String> phone) {
            this(id,
                 email != null ? email.orElse(null) : null,
                 phone != null ? phone.orElse(null) : null);
        }

        public String getId() { return id; }
        public Optional<String> getEmail() { return Optional.ofNullable(email); }
        public Optional<String> getPhone() { return Optional.ofNullable(phone); }
        public boolean hasPhoneFallback() { return phone != null && !phone.isBlank(); }
    }

    @FunctionalInterface
    public interface EmailTransport {
        void send(String address, String body);
    }

    public static class LegacySmtpGateway {
        private static final List<String> SENT_OUTBOX = new ArrayList<>();
        public static void sendStatic(String address, String body) {
            if (address.startsWith("bounce@")) {
                throw new RuntimeException("SMTP 550 Mailbox unavailable: " + address);
            }
            SENT_OUTBOX.add("EMAIL:" + address + ":" + body);
        }
        public static List<String> getSentOutbox() { return SENT_OUTBOX; }
        public static void clear() { SENT_OUTBOX.clear(); }
    }

    private final List<Subscriber> subscribers;
    private final EmailTransport emailTransport;

    public OmnichannelNotificationService(List<Subscriber> subscribers) {
        this(subscribers, LegacySmtpGateway::sendStatic);
    }

    public OmnichannelNotificationService(List<Subscriber> subscribers, EmailTransport emailTransport) {
        this.subscribers = List.copyOf(subscribers);
        this.emailTransport = Objects.requireNonNull(emailTransport);
    }

    public int broadcastCampaign(String message, Optional<String> urgentPrefix) {
        String prefix = (urgentPrefix != null) ? urgentPrefix.orElse(null) : null;
        return broadcastCampaign(message, prefix);
    }

    public int broadcastCampaign(String message, String urgentPrefix) {
        String formattedPayload = formatPayload(message, urgentPrefix);
        int delivered = 0;
        for (Subscriber sub : subscribers) {
            if (tryDeliverEmail(sub, formattedPayload)) {
                delivered++;
            }
        }
        return delivered;
    }

    private boolean tryDeliverEmail(Subscriber sub, String payload) {
        Optional<String> emailOpt = sub.getEmail();
        if (emailOpt.isEmpty()) {
            return false;
        }
        try {
            emailTransport.send(emailOpt.get(), payload);
            return true;
        } catch (RuntimeException ex) {
            if (!sub.hasPhoneFallback()) {
                throw ex;
            }
            return false;
        }
    }

    private String formatPayload(String message, String urgentPrefix) {
        return (urgentPrefix != null && !urgentPrefix.isBlank())
                ? "[" + urgentPrefix + "] " + message
                : message;
    }
}

```
**Senior AI Review Checkpoint:**
The grading rubric verifies that `Optional<String>` fields have been eliminated from `Subscriber` in favor of plain `String` fields with `Optional.ofNullable` return getters. It also confirms that `LegacySmtpGateway.sendStatic` is abstracted behind an injectable `EmailTransport` collaborator and that payload formatting is hoisted out of the subscriber loop.

## Staff / Principal (L3) Refactoring & Code Review Katas
At the Staff and Principal (L3) engineering tier, technical interviews transition from single-threaded object design to concurrency mechanics, distributed systems consistency, and JVM runtime internals. In these rounds, candidates must diagnose how code-level synchronization and context-sharing primitives interact with the underlying JVM virtual thread scheduler and database lock manager across JDK 21 LTS and JDK 24+.
Diagnosing virtual thread bottlenecks in a Staff-level interview requires separating four independent architectural constraints: task scheduling cost, carrier thread pinning, lock contention serialization, and finite downstream capacity. Even when carrier pinning is eliminated—either by migrating from `synchronized` to `ReentrantLock` in JDK 21 or by upgrading to JDK 24 where JEP 491 allows virtual threads to unmount inside monitors—holding a lock around slow network I/O still serializes contending virtual threads and creates a lock convoy. Furthermore, removing the servlet thread-pool ceiling shifts the concurrency bottleneck directly onto downstream database pools and HTTP sockets, requiring explicit `Semaphore` admission control.

### KATA-13: Real-Time Ad-Auction Bidding Gateway & Carrier Pinning Remediation
**Target Grade:** Staff L3
**Domain & Enterprise Context:** High-Frequency AdTech Real-Time Bidding (RTB) & Virtual Thread Execution
**Real-World Interview Origin:** Yandex Ads, Amazon Advertising, and BigTech L3 concurrency deep-dives, testing JEP 444 virtual thread pitfalls, carrier pinning, and downstream resource bounding.
**Core Code Smells & Anti-Patterns:**

1. **Pooling Virtual Threads (`Executors.newFixedThreadPool(2, Thread.ofVirtual().factory())`):** Violates JEP 444 by pooling virtual threads in a fixed-size pool, artificially serializing concurrent tasks instead of using `Executors.newVirtualThreadPerTaskExecutor()`.
2. **Carrier Thread Pinning via `synchronized` & Blocking `computeIfAbsent`:** Performs blocking network calls inside a `synchronized` block and inside `ConcurrentHashMap.computeIfAbsent`, pinning the underlying OS carrier thread in JDK 21 and serializing all unrelated publishers.
3. **Missing Downstream Admission Control:** Fires unbounded concurrent requests against the downstream DSP socket pool without a `Semaphore` permit boundary.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.adtech.rtb;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class AdAuctionBiddingGateway {

    public record BidRequest(String auctionId, String publisherId, int baseBidCents) {}
    public record BidResponse(String auctionId, int finalBidCents, boolean wasVirtualThread) {}

    @FunctionalInterface
    public interface DownstreamPricingClient {
        int fetchPublisherFloorCents(String publisherId);
    }

    private final DownstreamPricingClient pricingClient;
    private final Map<String, Integer> floorCache = new ConcurrentHashMap<>();
    private final Object monitorLock = new Object();

    public AdAuctionBiddingGateway(DownstreamPricingClient pricingClient) {
        this.pricingClient = pricingClient;
    }

    public List<BidResponse> executeAuctionBatch(List<BidRequest> requests) throws Exception {
        // Anti-pattern 1: Pooling virtual threads into a scarce fixed pool
        ExecutorService executor = Executors.newFixedThreadPool(2, Thread.ofVirtual().factory());
        try {
            List<Callable<BidResponse>> tasks = requests.stream()
                    .map(req -> (Callable<BidResponse>) () -> evaluateSingleBid(req))
                    .toList();
            List<Future<BidResponse>> futures = executor.invokeAll(tasks);
            return futures.stream().map(f -> {
                try {
                    return f.get();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }).toList();
        } finally {
            executor.shutdown();
        }
    }

    private BidResponse evaluateSingleBid(BidRequest req) {
        // Anti-pattern 2: Blocking I/O inside synchronized and computeIfAbsent pins JDK 21 carrier thread
        int floorCents;
        synchronized (monitorLock) {
            floorCents = floorCache.computeIfAbsent(req.publisherId(),
                    pubId -> pricingClient.fetchPublisherFloorCents(pubId));
        }
        int finalBid = Math.max(req.baseBidCents(), floorCents);
        return new BidResponse(req.auctionId(), finalBid, Thread.currentThread().isVirtual());
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.adtech.rtb;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import com.enterprise.adtech.rtb.AdAuctionBiddingGateway.*;

class AdAuctionBiddingGatewayTest {

    @Test
    void executesBidsOnVirtualThreadsAndDeduplicatesFloorLookupsSafely() throws Exception {
        AtomicInteger downstreamCalls = new AtomicInteger(0);
        DownstreamPricingClient client = pubId -> {
            downstreamCalls.incrementAndGet();
            return pubId.equals("PUB-PREMIUM") ? 250 : 100;
        };

        var gateway = new AdAuctionBiddingGateway(client);
        var requests = List.of(
            new BidRequest("AUC-1", "PUB-PREMIUM", 180),
            new BidRequest("AUC-2", "PUB-PREMIUM", 300),
            new BidRequest("AUC-3", "PUB-STANDARD", 90)
        );

        List<BidResponse> responses = gateway.executeAuctionBatch(requests);
        assertEquals(3, responses.size());
        assertEquals(250, responses.get(0).finalBidCents());
        assertEquals(300, responses.get(1).finalBidCents());
        assertEquals(100, responses.get(2).finalBidCents());
        assertTrue(responses.stream().allMatch(BidResponse::wasVirtualThread));
        assertEquals(2, downstreamCalls.get());
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
First, the fixed virtual-thread pool is replaced with `Executors.newVirtualThreadPerTaskExecutor()` managed via a `try-with-resources` block, adhering to JEP 444's mandate never to pool virtual threads. Second, both the global `synchronized (monitorLock)` block and the blocking `floorCache.computeIfAbsent` call—which holds a bucket monitor lock in `ConcurrentHashMap` and pins carrier threads in JDK 21—are replaced with a fast optimistic `floorCache.get(publisherId)` check followed by per-publisher `ReentrantLock` acquisition. Because `ReentrantLock.lock()` parks virtual threads through `java.util.concurrent.locks.LockSupport` rather than a bytecode `monitorenter`, waiting virtual threads cleanly unmount from their carrier threads. Finally, a `Semaphore` bounds concurrent calls to `pricingClient` so unpooled virtual threads cannot exhaust downstream sockets.
**Target Clean Reference Solution:**

```java
package com.enterprise.adtech.rtb;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.locks.ReentrantLock;

public class AdAuctionBiddingGateway {
    private static final int DEFAULT_MAX_DOWNSTREAM_CONCURRENCY = 16;

    public record BidRequest(String auctionId, String publisherId, int baseBidCents) {}
    public record BidResponse(String auctionId, int finalBidCents, boolean wasVirtualThread) {}

    @FunctionalInterface
    public interface DownstreamPricingClient {
        int fetchPublisherFloorCents(String publisherId);
    }

    private final DownstreamPricingClient pricingClient;
    private final Semaphore downstreamPermits;
    private final Map<String, Integer> floorCache = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> keyLocks = new ConcurrentHashMap<>();

    public AdAuctionBiddingGateway(DownstreamPricingClient pricingClient) {
        this(pricingClient, DEFAULT_MAX_DOWNSTREAM_CONCURRENCY);
    }

    public AdAuctionBiddingGateway(DownstreamPricingClient pricingClient, int maxDownstreamConcurrency) {
        this.pricingClient = Objects.requireNonNull(pricingClient);
        this.downstreamPermits = new Semaphore(maxDownstreamConcurrency);
    }

    public List<BidResponse> executeAuctionBatch(List<BidRequest> requests) throws InterruptedException {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Callable<BidResponse>> tasks = requests.stream()
                    .map(req -> (Callable<BidResponse>) () -> evaluateSingleBid(req))
                    .toList();
            List<Future<BidResponse>> futures = executor.invokeAll(tasks);
            return futures.stream().map(this::unwrapFuture).toList();
        }
    }

    private BidResponse evaluateSingleBid(BidRequest req) {
        int floorCents = resolveFloorPriceNonPinning(req.publisherId());
        int finalBid = Math.max(req.baseBidCents(), floorCents);
        return new BidResponse(req.auctionId(), finalBid, Thread.currentThread().isVirtual());
    }

    private int resolveFloorPriceNonPinning(String publisherId) {
        Integer cached = floorCache.get(publisherId);
        if (cached != null) {
            return cached;
        }
        ReentrantLock keyLock = keyLocks.computeIfAbsent(publisherId, k -> new ReentrantLock());
        keyLock.lock();
        try {
            Integer recheck = floorCache.get(publisherId);
            if (recheck != null) {
                return recheck;
            }
            int fetched = fetchWithAdmissionControl(publisherId);
            floorCache.put(publisherId, fetched);
            return fetched;
        } finally {
            keyLock.unlock();
        }
    }

    private int fetchWithAdmissionControl(String publisherId) {
        try {
            downstreamPermits.acquire();
            try {
                return pricingClient.fetchPublisherFloorCents(publisherId);
            } finally {
                downstreamPermits.release();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted waiting for downstream permit", e);
        }
    }

    private BidResponse unwrapFuture(Future<BidResponse> future) {
        try {
            return future.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Auction task interrupted", e);
        } catch (ExecutionException e) {
            throw new RuntimeException("Auction task failed", e.getCause());
        }
    }
}

```
**Senior AI Review Checkpoint:**
The Staff-level rubric verifies that `Executors.newVirtualThreadPerTaskExecutor()` is used inside a `try-with-resources` block rather than pooling virtual threads. It also confirms that both `synchronized` and blocking `computeIfAbsent` calls were replaced with `ReentrantLock` double-checked locking (with `unlock()` in `finally`) and that a `Semaphore` guards downstream I/O admission with proper `Thread.currentThread().interrupt()` restoration.

### KATA-14: Multi-Tenant Identity Context Propagator: ThreadLocal to ScopedValue Migration
**Target Grade:** Staff L3
**Domain & Enterprise Context:** Core Banking Multi-Tenant Security Context & Audit Attribution
**Real-World Interview Origin:** T-Bank, Stripe, and BigTech L3 platform architecture interviews, testing the hazards of mutable `ThreadLocal` context leaking and memory bloat under virtual threads versus immutable lexical scoping.
**Core Code Smells & Anti-Patterns:**

1. **`ThreadLocal` Context Leak on Exception (`executeInTenantScope`):** Calls `CURRENT_CONTEXT.set(ctx)` without a `try / finally { CURRENT_CONTEXT.remove(); }` discipline; when `work.call()` throws an exception, the tenant identity remains bound to the thread, leaking privileges across pooled threads.
2. **Broken Nested Scope Restoration:** Overwrites `CURRENT_CONTEXT` during nested calls and unconditionally calls `remove()` on exit, destroying the outer scope's context.
3. **Mutable Shared Context State (`setTenantId`, `setElevatedRole`):** Allows downstream methods to mutate the bound security context in place without lexical boundaries.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.banking.context;

import java.util.NoSuchElementException;
import java.util.concurrent.Callable;

public class TenantIdentityPropagator {

    public static class TenantSecurityContext {
        private String tenantId;
        private String principal;
        private boolean elevatedRole;

        public TenantSecurityContext(String tenantId, String principal, boolean elevatedRole) {
            this.tenantId = tenantId;
            this.principal = principal;
            this.elevatedRole = elevatedRole;
        }
        public String getTenantId() { return tenantId; }
        public void setTenantId(String tenantId) { this.tenantId = tenantId; }
        public String getPrincipal() { return principal; }
        public boolean isElevatedRole() { return elevatedRole; }
        public void setElevatedRole(boolean elevatedRole) { this.elevatedRole = elevatedRole; }
    }

    private static final ThreadLocal<TenantSecurityContext> CURRENT_CONTEXT = new ThreadLocal<>();

    public static <T> T executeInTenantScope(
            String tenantId, String principal, boolean elevated, Callable<T> work) throws Exception {
        TenantSecurityContext ctx = new TenantSecurityContext(tenantId, principal, elevated);
        CURRENT_CONTEXT.set(ctx);
        // Bug 1: If work.call() throws, CURRENT_CONTEXT is never cleared!
        // Bug 2: If nested executeInTenantScope runs, outer context is overwritten and destroyed!
        T result = work.call();
        CURRENT_CONTEXT.remove();
        return result;
    }

    public static TenantSecurityContext currentContext() {
        TenantSecurityContext ctx = CURRENT_CONTEXT.get();
        if (ctx == null) {
            throw new NoSuchElementException("No active tenant security context bound to current scope");
        }
        return ctx;
    }

    public static boolean isBound() {
        return CURRENT_CONTEXT.get() != null;
    }

    public static String formatAuditStamp(String operation) {
        TenantSecurityContext ctx = currentContext();
        return String.format("TENANT=%s|USER=%s|ELEVATED=%s|OP=%s",
                ctx.getTenantId(), ctx.getPrincipal(), ctx.isElevatedRole(), operation);
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.banking.context;

import org.junit.jupiter.api.Test;
import java.util.NoSuchElementException;
import static org.junit.jupiter.api.Assertions.*;

class TenantIdentityPropagatorTest {

    @Test
    void bindsAndAutomaticallyCleansUpContextEvenOnExceptionAndSupportsNestedShadowing() throws Exception {
        String audit = TenantIdentityPropagator.executeInTenantScope("TENANT-A", "alice", false, () -> {
            String outerBefore = TenantIdentityPropagator.formatAuditStamp("READ_LEDGER");
            String inner = TenantIdentityPropagator.executeInTenantScope("TENANT-A", "alice", true, () ->
                    TenantIdentityPropagator.formatAuditStamp("WIRE_OVERRIDE"));
            String outerAfter = TenantIdentityPropagator.formatAuditStamp("VERIFY");
            return outerBefore + " -> " + inner + " -> " + outerAfter;
        });

        assertTrue(audit.contains("ELEVATED=false|OP=READ_LEDGER"));
        assertTrue(audit.contains("ELEVATED=true|OP=WIRE_OVERRIDE"));
        assertTrue(audit.contains("ELEVATED=false|OP=VERIFY"));
        assertFalse(TenantIdentityPropagator.isBound());

        assertThrows(IllegalStateException.class, () ->
                TenantIdentityPropagator.executeInTenantScope("TENANT-B", "mallory", true, () -> {
                    throw new IllegalStateException("Simulated downstream failure");
                }));

        // Must never leak TENANT-B after exception!
        assertFalse(TenantIdentityPropagator.isBound());
        assertThrows(NoSuchElementException.class, TenantIdentityPropagator::currentContext);
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To enforce the immutable, lexically bounded guarantees of Java's `ScopedValue` (JEP 506) on standard Java 21 LTS without requiring `--enable-preview` flags, `TenantSecurityContext` is transformed into a deeply immutable `final` class with all mutators removed. Inside `executeInTenantScope`, the previous binding is captured on the call stack before binding the new context, and a `finally` block deterministically restores the parent binding (or removes the thread-local entry when exiting the root scope), guaranteeing zero context leaks on exceptions and exact lexical restoration across nested scopes.
**Target Clean Reference Solution:**

```java
package com.enterprise.banking.context;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.concurrent.Callable;

public class TenantIdentityPropagator {

    public static final class TenantSecurityContext {
        private final String tenantId;
        private final String principal;
        private final boolean elevatedRole;

        public TenantSecurityContext(String tenantId, String principal, boolean elevatedRole) {
            this.tenantId = Objects.requireNonNull(tenantId);
            this.principal = Objects.requireNonNull(principal);
            this.elevatedRole = elevatedRole;
        }
        public String getTenantId() { return tenantId; }
        public String getPrincipal() { return principal; }
        public boolean isElevatedRole() { return elevatedRole; }
    }

    private static final ThreadLocal<TenantSecurityContext> LEXICAL_SCOPE = new ThreadLocal<>();

    public static <T> T executeInTenantScope(
            String tenantId, String principal, boolean elevated, Callable<T> work) throws Exception {
        Objects.requireNonNull(work);
        TenantSecurityContext previous = LEXICAL_SCOPE.get();
        TenantSecurityContext next = new TenantSecurityContext(tenantId, principal, elevated);
        LEXICAL_SCOPE.set(next);
        try {
            return work.call();
        } finally {
            if (previous != null) {
                LEXICAL_SCOPE.set(previous);
            } else {
                LEXICAL_SCOPE.remove();
            }
        }
    }

    public static TenantSecurityContext currentContext() {
        TenantSecurityContext ctx = LEXICAL_SCOPE.get();
        if (ctx == null) {
            throw new NoSuchElementException("No active tenant security context bound to current scope");
        }
        return ctx;
    }

    public static boolean isBound() {
        return LEXICAL_SCOPE.get() != null;
    }

    public static String formatAuditStamp(String operation) {
        TenantSecurityContext ctx = currentContext();
        return "TENANT=%s|USER=%s|ELEVATED=%s|OP=%s".formatted(
                ctx.getTenantId(), ctx.getPrincipal(), ctx.isElevatedRole(), operation);
    }
}

```
**Senior AI Review Checkpoint:**
The evaluation rubric checks that `TenantSecurityContext` is strictly immutable (`final` fields, no setters). It also verifies that `executeInTenantScope` captures the prior binding on the lexical call stack and restores or removes it inside a `finally` block so that neither thrown exceptions nor nested re-bindings leak or corrupt tenant identity.

### KATA-15: Distributed Payment Ledger & Transactional Outbox Relay
**Target Grade:** Staff L3
**Domain & Enterprise Context:** FinTech Payment Clearinghouse, Atomic Event Publishing, and Concurrent Outbox Polling
**Real-World Interview Origin:** Uber, T-Bank, Ozon, and Spring I/O 2026 Event-Driven Architecture sessions (Victor Rentea), testing the Dual-Write anti-pattern and concurrent outbox draining with `SKIP LOCKED`.
**Core Code Smells & Anti-Patterns:**

1. **Dual-Write Anti-Pattern (`recordPayment`):** Inserts the ledger entry into the database and synchronously publishes to the message broker inside the same method; if the broker is unreachable or if the database transaction rolls back after the network call succeeds, the system suffers lost payments or phantom downstream events.
2. **Unbounded Non-Locked Outbox Polling (`drainOutboxRelay`):** Fetches all unpublished rows via `fetchAllUnpublishedNaive()` outside a transaction without batch limits or row-level skip locking (`SELECT ... FOR UPDATE SKIP LOCKED`), causing concurrent service replicas to double-publish events and hold unbounded locks.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.fintech.outbox;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class PaymentLedgerOutboxService {

    public record LedgerEntry(String paymentId, long amountCents) {}
    public record OutboxEvent(String eventId, String paymentId, String payload, Instant publishedAt) {
        public OutboxEvent markPublished(Instant now) {
            return new OutboxEvent(eventId, paymentId, payload, now);
        }
    }

    public interface LedgerOutboxStore {
        void executeInTransaction(Runnable action);
        void insertLedger(LedgerEntry entry);
        void insertOutbox(OutboxEvent event);
        List<OutboxEvent> fetchAllUnpublishedNaive();
        List<OutboxEvent> claimUnpublishedBatchSkipLocked(int batchSize);
        void updateOutboxPublished(String eventId, Instant publishedAt);
    }

    @FunctionalInterface
    public interface MessageBrokerClient {
        void publish(String eventId, String payload);
    }

    private final LedgerOutboxStore store;
    private final MessageBrokerClient broker;

    public PaymentLedgerOutboxService(LedgerOutboxStore store, MessageBrokerClient broker) {
        this.store = store;
        this.broker = broker;
    }

    public void recordPayment(String paymentId, long amountCents) {
        store.executeInTransaction(() -> {
            store.insertLedger(new LedgerEntry(paymentId, amountCents));
            // Dual-write anti-pattern: synchronous network call to Kafka inside DB transaction!
            broker.publish("EVT-" + paymentId, paymentId + ":" + amountCents);
        });
    }

    public int drainOutboxRelay(int maxBatchSize) {
        List<OutboxEvent> unpublished = store.fetchAllUnpublishedNaive();
        int count = 0;
        for (OutboxEvent evt : unpublished) {
            broker.publish(evt.eventId(), evt.payload());
            store.updateOutboxPublished(evt.eventId(), Instant.now());
            count++;
        }
        return count;
    }

    public static class InMemorySkipLockedStore implements LedgerOutboxStore {
        private final List<LedgerEntry> ledger = new ArrayList<>();
        private final Map<String, OutboxEvent> outbox = new LinkedHashMap<>();

        @Override
        public void executeInTransaction(Runnable action) {
            List<LedgerEntry> ledgerSnapshot = new ArrayList<>(ledger);
            Map<String, OutboxEvent> outboxSnapshot = new LinkedHashMap<>(outbox);
            try {
                action.run();
            } catch (RuntimeException ex) {
                ledger.clear();
                ledger.addAll(ledgerSnapshot);
                outbox.clear();
                outbox.putAll(outboxSnapshot);
                throw ex;
            }
        }
        @Override public void insertLedger(LedgerEntry entry) { ledger.add(entry); }
        @Override public void insertOutbox(OutboxEvent event) { outbox.put(event.eventId(), event); }
        @Override
        public List<OutboxEvent> fetchAllUnpublishedNaive() {
            return outbox.values().stream().filter(e -> e.publishedAt() == null).toList();
        }
        @Override
        public List<OutboxEvent> claimUnpublishedBatchSkipLocked(int batchSize) {
            return outbox.values().stream()
                    .filter(e -> e.publishedAt() == null)
                    .limit(batchSize)
                    .toList();
        }
        @Override
        public void updateOutboxPublished(String eventId, Instant publishedAt) {
            OutboxEvent existing = outbox.get(eventId);
            if (existing != null) outbox.put(eventId, existing.markPublished(publishedAt));
        }
        public List<LedgerEntry> getLedger() { return ledger; }
        public Map<String, OutboxEvent> getOutbox() { return outbox; }
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.fintech.outbox;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;
import com.enterprise.fintech.outbox.PaymentLedgerOutboxService.*;

class PaymentLedgerOutboxServiceTest {

    @Test
    void persistsPaymentAndOutboxAtomicallyWhenBrokerIsDownAndDrainsSafelyLater() {
        var store = new InMemorySkipLockedStore();
        AtomicBoolean brokerOffline = new AtomicBoolean(true);
        List<String> publishedEvents = new ArrayList<>();

        MessageBrokerClient broker = (id, payload) -> {
            if (brokerOffline.get()) throw new RuntimeException("Kafka Broker Unreachable");
            publishedEvents.add(id + "=" + payload);
        };

        var service = new PaymentLedgerOutboxService(store, broker);
        // Recording payment must succeed atomically in DB without calling broker directly
        service.recordPayment("PAY-101", 50000L);
        service.recordPayment("PAY-102", 75000L);
        assertEquals(2, store.getLedger().size());
        assertEquals(2, store.getOutbox().size());

        // Relay tick while broker is offline rolls back cleanly so next tick retries
        assertThrows(RuntimeException.class, () -> service.drainOutboxRelay(1));
        assertTrue(publishedEvents.isEmpty());

        // Broker recovers; bounded batch size 1 drains one event per tick
        brokerOffline.set(false);
        assertEquals(1, service.drainOutboxRelay(1));
        assertEquals(1, service.drainOutboxRelay(1));
        assertEquals(0, service.drainOutboxRelay(1));
        assertEquals(List.of("EVT-PAY-101=PAY-101:50000", "EVT-PAY-102=PAY-102:75000"), publishedEvents);
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To eliminate the dual-write vulnerability, `recordPayment` is refactored to persist both the `LedgerEntry` and an unpublished `OutboxEvent` inside the same local database transaction without invoking the message broker over the network. Next, `drainOutboxRelay` is wrapped inside `store.executeInTransaction` and switched from `fetchAllUnpublishedNaive()` to `claimUnpublishedBatchSkipLocked(maxBatchSize)` (representing `SELECT ... FOR UPDATE SKIP LOCKED`), ensuring that multiple service instances can drain bounded batches concurrently and that any broker failure rolls back the batch lock cleanly for retry on the next tick.
**Target Clean Reference Solution:**

```java
package com.enterprise.fintech.outbox;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

public class PaymentLedgerOutboxService {

    public record LedgerEntry(String paymentId, long amountCents) {}
    public record OutboxEvent(String eventId, String paymentId, String payload, Instant publishedAt) {
        public OutboxEvent markPublished(Instant now) {
            return new OutboxEvent(eventId, paymentId, payload, now);
        }
    }

    public interface LedgerOutboxStore {
        void executeInTransaction(Runnable action);
        void insertLedger(LedgerEntry entry);
        void insertOutbox(OutboxEvent event);
        List<OutboxEvent> fetchAllUnpublishedNaive();
        List<OutboxEvent> claimUnpublishedBatchSkipLocked(int batchSize);
        void updateOutboxPublished(String eventId, Instant publishedAt);
    }

    @FunctionalInterface
    public interface MessageBrokerClient {
        void publish(String eventId, String payload);
    }

    private final LedgerOutboxStore store;
    private final MessageBrokerClient broker;

    public PaymentLedgerOutboxService(LedgerOutboxStore store, MessageBrokerClient broker) {
        this.store = Objects.requireNonNull(store);
        this.broker = Objects.requireNonNull(broker);
    }

    public void recordPayment(String paymentId, long amountCents) {
        store.executeInTransaction(() -> {
            store.insertLedger(new LedgerEntry(paymentId, amountCents));
            OutboxEvent outboxEvent = new OutboxEvent(
                    "EVT-" + paymentId,
                    paymentId,
                    paymentId + ":" + amountCents,
                    null);
            store.insertOutbox(outboxEvent);
        });
    }

    public int drainOutboxRelay(int maxBatchSize) {
        if (maxBatchSize <= 0) {
            throw new IllegalArgumentException("Batch size must be positive");
        }
        AtomicInteger drainedCount = new AtomicInteger();
        store.executeInTransaction(() -> {
            List<OutboxEvent> claimedBatch = store.claimUnpublishedBatchSkipLocked(maxBatchSize);
            Instant now = Instant.now();
            for (OutboxEvent evt : claimedBatch) {
                broker.publish(evt.eventId(), evt.payload());
                store.updateOutboxPublished(evt.eventId(), now);
                drainedCount.incrementAndGet();
            }
        });
        return drainedCount.get();
    }

    public static class InMemorySkipLockedStore implements LedgerOutboxStore {
        private final List<LedgerEntry> ledger = new ArrayList<>();
        private final Map<String, OutboxEvent> outbox = new LinkedHashMap<>();

        @Override
        public void executeInTransaction(Runnable action) {
            List<LedgerEntry> ledgerSnapshot = new ArrayList<>(ledger);
            Map<String, OutboxEvent> outboxSnapshot = new LinkedHashMap<>(outbox);
            try {
                action.run();
            } catch (RuntimeException ex) {
                ledger.clear();
                ledger.addAll(ledgerSnapshot);
                outbox.clear();
                outbox.putAll(outboxSnapshot);
                throw ex;
            }
        }
        @Override public void insertLedger(LedgerEntry entry) { ledger.add(entry); }
        @Override public void insertOutbox(OutboxEvent event) { outbox.put(event.eventId(), event); }
        @Override
        public List<OutboxEvent> fetchAllUnpublishedNaive() {
            return outbox.values().stream().filter(e -> e.publishedAt() == null).toList();
        }
        @Override
        public List<OutboxEvent> claimUnpublishedBatchSkipLocked(int batchSize) {
            return outbox.values().stream()
                    .filter(e -> e.publishedAt() == null)
                    .limit(batchSize)
                    .toList();
        }
        @Override
        public void updateOutboxPublished(String eventId, Instant publishedAt) {
            OutboxEvent existing = outbox.get(eventId);
            if (existing != null) outbox.put(eventId, existing.markPublished(publishedAt));
        }
        public List<LedgerEntry> getLedger() { return ledger; }
        public Map<String, OutboxEvent> getOutbox() { return outbox; }
    }
}

```
**Senior AI Review Checkpoint:**
The Staff-level rubric verifies that `recordPayment` no longer calls `broker.publish` directly and instead writes an `OutboxEvent` inside the local transaction. It also confirms that `drainOutboxRelay` executes inside `store.executeInTransaction` and invokes `claimUnpublishedBatchSkipLocked(maxBatchSize)` so that broker outages trigger a clean transaction rollback and batch sizes are respected.

### KATA-16: Cross-Currency Liquidity Settlement & Lock-Ordering Engine
**Target Grade:** Staff L3
**Domain & Enterprise Context:** High-Frequency FX Treasury Settlement, Deadlock Prevention, and Hash-Key Immutability
**Real-World Interview Origin:** Yandex, T-Bank, Stripe, and Joker concurrency deep-dive interviews, testing dynamic lock-ordering deadlocks, shared boxed-primitive monitor contention, and mutable `HashMap` key corruption.
**Core Code Smells & Anti-Patterns:**

1. **Dynamic Lock-Order Deadlock (`transferLiquidity`):** Acquires locks in the caller-supplied parameter order (`synchronized (from)` then `synchronized (to)`); when Thread A transfers `EUR -> USD` and Thread B simultaneously transfers `USD -> EUR`, both threads deadlock permanently.
2. **Synchronizing on Boxed Primitives (`synchronized (from.getPoolRegionId())`):** Locks on a boxed `Long` reference that is shared JVM-wide via `LongCache` for values in `[-128, 127]`, causing accidental cross-subsystem lock contention.
3. **Mutable `Map` Key Corruption (`LiquidityBucketKey`):** Includes mutable `sequenceVersion` in `equals()` and `hashCode()` and mutates `bucketKey.incrementVersion()` after inserting into `settledVolumeByBucket`, orphaning the hash bucket so subsequent lookups return `0L`.
**Original "Dirty" Legacy Code:**

```java
package com.enterprise.fintech.treasury;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

public class CrossCurrencySettlementEngine {

    public static class LiquidityAccount {
        private final String accountId;
        private final Long poolRegionId;
        private long balanceCents;

        public LiquidityAccount(String accountId, Long poolRegionId, long initialBalanceCents) {
            this.accountId = accountId;
            this.poolRegionId = poolRegionId;
            this.balanceCents = initialBalanceCents;
        }
        public String getAccountId() { return accountId; }
        public Long getPoolRegionId() { return poolRegionId; }
        public long getBalanceCents() { return balanceCents; }
        public void debit(long amount) { this.balanceCents -= amount; }
        public void credit(long amount) { this.balanceCents += amount; }
    }

    public static class LiquidityBucketKey {
        private final String currencyPair;
        private int sequenceVersion;

        public LiquidityBucketKey(String currencyPair, int sequenceVersion) {
            this.currencyPair = currencyPair;
            this.sequenceVersion = sequenceVersion;
        }
        public void incrementVersion() { this.sequenceVersion++; }
        public int getSequenceVersion() { return sequenceVersion; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof LiquidityBucketKey that)) return false;
            return sequenceVersion == that.sequenceVersion && Objects.equals(currencyPair, that.currencyPair);
        }
        @Override
        public int hashCode() {
            return Objects.hash(currencyPair, sequenceVersion);
        }
    }

    private final Map<LiquidityBucketKey, Long> settledVolumeByBucket = new ConcurrentHashMap<>();

    public boolean transferLiquidity(
            LiquidityAccount from, LiquidityAccount to, long amountCents, LiquidityBucketKey bucketKey) {
        if (amountCents <= 0 || from.getAccountId().equals(to.getAccountId())) {
            return false;
        }
        // Smell 1 & 2: Dynamic lock order deadlock + locking on shared boxed Long / external object
        synchronized (from) {
            synchronized (to) {
                synchronized (from.getPoolRegionId()) {
                    if (from.getBalanceCents() < amountCents) {
                        return false;
                    }
                    from.debit(amountCents);
                    to.credit(amountCents);
                    long currentVol = settledVolumeByBucket.getOrDefault(bucketKey, 0L);
                    settledVolumeByBucket.put(bucketKey, currentVol + amountCents);
                    // Smell 3: Mutating key after insertion corrupts Map hash bucket lookup!
                    bucketKey.incrementVersion();
                    return true;
                }
            }
        }
    }

    public long getSettledVolume(LiquidityBucketKey bucketKey) {
        return settledVolumeByBucket.getOrDefault(bucketKey, 0L);
    }
}

```
**Characterization / Safety-Net Tests:**

```java
package com.enterprise.fintech.treasury;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.enterprise.fintech.treasury.CrossCurrencySettlementEngine.*;

class CrossCurrencySettlementEngineTest {

    @Test
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void executesBidirectionalTransfersWithoutDeadlockAndPreservesMapKeyLookup() throws Exception {
        var engine = new CrossCurrencySettlementEngine();
        var eurPool = new LiquidityAccount("ACCT-EUR-01", 1L, 1_000_000L);
        var usdPool = new LiquidityAccount("ACCT-USD-02", 1L, 1_000_000L);
        var key = new LiquidityBucketKey("EUR/USD", 1);

        int iterations = 200;
        CountDownLatch startLatch = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var f1 = executor.submit(() -> {
                startLatch.await();
                for (int i = 0; i < iterations; i++) {
                    engine.transferLiquidity(eurPool, usdPool, 100L, key);
                }
                return null;
            });
            var f2 = executor.submit(() -> {
                startLatch.await();
                for (int i = 0; i < iterations; i++) {
                    engine.transferLiquidity(usdPool, eurPool, 100L, key);
                }
                return null;
            });
            startLatch.countDown();
            f1.get();
            f2.get();
        }

        assertEquals(1_000_000L, eurPool.getBalanceCents());
        assertEquals(1_000_000L, usdPool.getBalanceCents());
        assertEquals(200L * 2 * 100L, engine.getSettledVolume(key));
    }
}

```
**Refactoring Strategy & Design Patterns Applied:**
To eliminate cyclic lock-order deadlocks and JDK 21 virtual thread monitor pinning, each `LiquidityAccount` is equipped with a private `final ReentrantLock`, and `transferLiquidity` establishes a strict global lock hierarchy by sorting the two accounts lexicographically by `accountId` before locking `firstLock` and `secondLock`. The dangerous `synchronized (from.getPoolRegionId())` block on the cached boxed `Long` is completely removed. Finally, `LiquidityBucketKey.equals()` and `hashCode()` are anchored exclusively to the immutable `currencyPair` string, while `sequenceVersion` is managed via `AtomicInteger` so version increments never corrupt the `ConcurrentHashMap` bucket hash.
**Target Clean Reference Solution:**

```java
package com.enterprise.fintech.treasury;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

public class CrossCurrencySettlementEngine {

    public static class LiquidityAccount {
        private final String accountId;
        private final Long poolRegionId;
        private final ReentrantLock lock = new ReentrantLock();
        private long balanceCents;

        public LiquidityAccount(String accountId, Long poolRegionId, long initialBalanceCents) {
            this.accountId = Objects.requireNonNull(accountId);
            this.poolRegionId = Objects.requireNonNull(poolRegionId);
            this.balanceCents = initialBalanceCents;
        }
        public String getAccountId() { return accountId; }
        public Long getPoolRegionId() { return poolRegionId; }
        public long getBalanceCents() {
            lock.lock();
            try {
                return balanceCents;
            } finally {
                lock.unlock();
            }
        }
        public void debit(long amount) { this.balanceCents -= amount; }
        public void credit(long amount) { this.balanceCents += amount; }
    }

    public static class LiquidityBucketKey {
        private final String currencyPair;
        private final AtomicInteger sequenceVersion;

        public LiquidityBucketKey(String currencyPair, int sequenceVersion) {
            this.currencyPair = Objects.requireNonNull(currencyPair);
            this.sequenceVersion = new AtomicInteger(sequenceVersion);
        }
        public void incrementVersion() { this.sequenceVersion.incrementAndGet(); }
        public int getSequenceVersion() { return sequenceVersion.get(); }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof LiquidityBucketKey that)) return false;
            return Objects.equals(currencyPair, that.currencyPair);
        }
        @Override
        public int hashCode() {
            return Objects.hashCode(currencyPair);
        }
    }

    private final Map<LiquidityBucketKey, Long> settledVolumeByBucket = new ConcurrentHashMap<>();

    public boolean transferLiquidity(
            LiquidityAccount from, LiquidityAccount to, long amountCents, LiquidityBucketKey bucketKey) {
        if (amountCents <= 0 || from.getAccountId().equals(to.getAccountId())) {
            return false;
        }
        LiquidityAccount firstLock = from.getAccountId().compareTo(to.getAccountId()) < 0 ? from : to;
        LiquidityAccount secondLock = firstLock == from ? to : from;

        firstLock.lock.lock();
        try {
            secondLock.lock.lock();
            try {
                if (from.balanceCents < amountCents) {
                    return false;
                }
                from.debit(amountCents);
                to.credit(amountCents);
                settledVolumeByBucket.merge(bucketKey, amountCents, Long::sum);
                bucketKey.incrementVersion();
                return true;
            } finally {
                secondLock.lock.unlock();
            }
        } finally {
            firstLock.lock.unlock();
        }
    }

    public long getSettledVolume(LiquidityBucketKey bucketKey) {
        return settledVolumeByBucket.getOrDefault(bucketKey, 0L);
    }
}

```
**Senior AI Review Checkpoint:**
The Staff-level rubric verifies that the candidate enforced a deterministic lock acquisition order (`from.getAccountId().compareTo(to.getAccountId())`) using private `ReentrantLock` instances with `try / finally` unlocking. It also confirms that locking on the boxed `Long` `poolRegionId` was removed and that `LiquidityBucketKey.equals()` and `hashCode()` depend strictly on the immutable `currencyPair` field so `ConcurrentHashMap` lookups succeed after version increments.

## Automated Evaluation Architecture for In-Memory JVM Sandboxes
Operationalizing these 16 refactoring challenges inside an automated Monaco Multi-File IDE and In-Memory JVM Sandbox requires a three-gate evaluation pipeline that translates subjective code review rubrics into deterministic verification checks. During the first gate—Contract and Pin-Down Invariant Verification—the sandbox compiles the candidate's refactored source files against both the candidate-authored Characterization Test suite and a hidden platform test suite, ensuring that all baseline domain behaviors and public API signatures remain unbroken.
During the second gate—AST and Bytecode Structural Analysis—the platform inspects the compiled class files to verify that targeted architectural smells have been removed rather than merely reformatted. Specifically, the bytecode verifier asserts the absence of `monitorenter` instructions around blocking I/O in `KATA-13` and `KATA-16`, the elimination of raw `FileWriter` instantiations outside `try-with-resources` in `KATA-04`, the removal of `Optional` field declarations in `KATA-12`, and the replacement of `double` currency accumulators with `BigDecimal` in `KATA-07`.
In the final gate—Runtime Instrumentation and Telemetry Verification—the sandbox executes the refactored code against lightweight instrumented collaborators such as `InMemoryInstrumentedOrderRepository` (`KATA-09`) and `InMemorySkipLockedStore` (`KATA-15`), alongside JDK Flight Recorder (`jdk.VirtualThreadPinned`) and thread-dump deadlock monitors. By asserting exact runtime invariants—such as `getFlushCount() == 0`, `getSelectQueryCount() == 1`, zero `ThreadLocal` context retention after simulated exceptions, and zero carrier-pinned events—the platform grades candidates on empirical production readiness across all four engineering seniority tiers.

---

Source: https://gemini.google.com/app/34138fcae0e75a2e
Exported at: 2026-10-17T10:20:10.132Z