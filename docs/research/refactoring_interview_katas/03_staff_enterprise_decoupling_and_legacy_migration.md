# Deep Research Prompt 3: Staff & Principal (L3) Enterprise Decoupling, Hexagonal Architecture & Legacy Migration

> **Document:** `docs/research/refactoring_interview_katas/03_staff_enterprise_decoupling_and_legacy_migration.md`  
> **Target Audience:** Deep Research AI Engine  
> **Grades Covered:** Staff Software Engineer, Principal Architect & Tech Lead (L3)  
> **Target Stack:** Java 21 LTS, Spring Boot 3.4+, Jakarta EE, DDD, Hexagonal Architecture, Kafka EOS  

---

## 🎯 Research Objective

Act as a **Director of Engineering & Enterprise Architecture Staffing Bar-Raiser (L7/L8)**.

Your objective is to conduct deep research to find and synthesize **6 to 8 elite, high-complexity architectural refactoring interview challenges** designed for **Staff and Principal (L3)** engineers.

At this level, interviews assess whether a candidate can take a **legacy enterprise subsystem with tangled boundaries, monolithic database coupling, and outdated frameworks**, and safely refactor it into a decoupled, domain-driven, and highly maintainable architecture without breaking mission-critical SLAs.

---

## 🔍 Specific Focus Archetypes to Search & Discover

### Archetype 3.1: Monolith Decoupling $\to$ Hexagonal Architecture (Ports & Adapters)
- **Interview Reality:** A core business service directly coupled to Spring Web (`HttpServletRequest`, annotations on domain entities), JPA database entities with Jackson annotations, and direct calls to raw SQL / AWS S3 SDK.
- **Code Smells:** Leakage of infrastructure details into the core domain; impossible to swap persistence or transport without modifying business rules; high coupling between presentation, persistence, and logic.
- **Target Refactoring:** Isolate Domain Core (pure Java 21 POJOs/Records, zero Spring/JPA dependencies) $\to$ Inbound Ports (Use Cases / Commands) $\to$ Outbound Ports (Repositories, Notification Gateways) $\to$ Adapters (Spring Web Controller, Spring Data JPA Adapter).
- **Canonical Examples:** `OrderProcessingHexagonalDecoupling`, `CustomerSubscriptionPortsAndAdapters`.

### Archetype 3.2: Dual-Write Inconsistency $\to$ Transactional Outbox & Event-Driven Decoupling
- **Interview Reality:** A legacy billing or shipping service that updates a database row and then directly publishes a message to Kafka / RabbitMQ inside the same method:
  `userRepository.save(user); kafkaTemplate.send("user-events", event);`
- **Failure Mechanism:** Network partition or application crash right after database commit leaves Kafka without the event; or Kafka failure causes database rollback of an otherwise valid transaction (Dual-Write Anti-pattern).
- **Target Refactoring:** Introduce Transactional Outbox Pattern $\to$ Write event to local outbox table atomically within DB transaction $\to$ Separate background CDC / Polling publisher (Debezium / Scheduled Publisher) with idempotency keys.
- **Canonical Examples:** `DualWritePaymentNotifierRefactoring`, `OrderPlacementOutboxMigration`.

### Archetype 3.3: Legacy Enterprise Migration (Spring Boot 2.7 $\to$ 3.4+ / Jakarta EE & Modern HTTP)
- **Interview Reality:** An enterprise gateway written in Java 8 / Spring Boot 2.x utilizing `javax.persistence.*`, deprecated `RestTemplate` with Apache HttpClient 4, raw XML parsing, and legacy reflection hacks.
- **Failure Mechanism:** Inability to run on Java 21 LTS; vulnerabilities in deprecated libraries; lack of virtual thread compliance.
- **Target Refactoring:** Namespace migration to `jakarta.*` $\to$ Modernizing HTTP layer to Spring 6 `RestClient` with `HttpComponentsClientHttpRequestFactory` $\to$ Replacing reflection with Java 21 Records and Pattern Matching $\to$ Spring Boot 3.4+ configuration properties with validation.
- **Canonical Examples:** `LegacySpring2EnterpriseGatewayMigration`, `LegacyBankingSecurityMigration`.

### Archetype 3.4: Anti-Corruption Layer (ACL) for Legacy Mainframe / Third-Party Integration
- **Interview Reality:** Modern microservice directly importing ugly, convoluted DTOs and SOAP/RPC contracts from a 15-year-old legacy core banking system, polluting the modern domain model with dozens of cryptic fields (`CUST_STAT_CD_01`, `FLG_ACTIVE_YN`).
- **Code Smells:** Domain model corruption, brittle cascading changes when legacy API changes.
- **Target Refactoring:** Implement Anti-Corruption Layer (ACL) with dedicated Translators / Mappers $\to$ Pure modern domain abstractions isolated from external RPC structures.
- **Canonical Examples:** `CoreBankingLegacyConnectorACL`, `ThirdPartyLogisticsTranslator`.

---

## 📋 Required Output Structure per Kata

For every discovered kata:

1. **Title & Grade:** e.g. `[L3-REF-02] Transactional Outbox Migration for High-Load Billing Service`
2. **Company Context:** (Where this type of question is asked: Ozon Core Architecture, Yandex Infrastructure, Stripe Core)
3. **The Legacy Code (150–250 lines):** Compiling multi-class snippet demonstrating architectural coupling.
4. **Architectural Smells & Systemic Risks:** Analysis of failure modes (data inconsistency, blast radius, maintenance velocity).
5. **Characterization Harness:** Test suite asserting functional correctness across network partitions and crash simulations.
6. **Refactored Architecture:** Clean, modular Java 21 implementation adhering to Hexagonal / Outbox / DDD principles.
7. **Staff Bar-Raiser Trade-Off Defense:** Discussion of operational trade-offs (eventual consistency, CDC polling latency, schema evolution).
