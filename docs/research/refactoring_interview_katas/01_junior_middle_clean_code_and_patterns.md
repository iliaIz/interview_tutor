# Deep Research Prompt 1: Junior & Middle (L0–L1) Structural Refactoring, Code Smells & Patterns

> **Document:** `docs/research/refactoring_interview_katas/01_junior_middle_clean_code_and_patterns.md`  
> **Target Audience:** Deep Research AI Engine  
> **Grades Covered:** Junior Foundation (L0) & Middle Specialist (L1)  
> **Target Stack:** Java 21 LTS, Spring Boot 3.4+, JUnit 5, AssertJ, Mockito 5  

---

## 🎯 Research Objective

Act as a **Senior Java Technical Interviewer (BigTech L5/L6)**.

Your objective is to conduct deep research to find and synthesize **8 to 10 canonical, real-world interview refactoring challenges** specifically designed for **Junior (L0)** and **Middle (L1)** Java developers.

These challenges must simulate the classic technical screening format: the candidate is handed a messy, poorly structured, but compiling Java class (80–180 lines) and asked to:
1. Explain what is wrong with the code (Code Smells & Violations of Clean Code / SOLID).
2. Write unit tests (if missing) to pin down existing behavior.
3. Refactor the code step-by-step into clean, maintainable, idiomatic Java 21 without breaking public contracts.

---

## 🔍 Specific Focus Archetypes to Search & Discover

### Archetype 1.1: Nested If-Else & Cyclomatic Complexity Hell $\to$ Polymorphism / Strategy
- **Interview Reality:** The infamous 150-line discount / pricing / tax calculation method with 6 levels of nested `if-else` / `switch` statements checking customer tiers, product categories, holiday flags, and promo codes.
- **Code Smells:** High Cyclomatic Complexity ($> 15$), Open-Closed Principle (OCP) violation, DRY violation, shotgun surgery.
- **Target Refactoring:** Extract Method $\to$ Replace Conditional with Polymorphism / Strategy Pattern $\to$ Java 21 Pattern Matching on Sealed Types.
- **Canonical Examples:** `PricingDiscountCalculator`, `InsuranceQuoteEngine`, `ShippingRateService`, `TennisGameRefactoringKata`.

### Archetype 1.2: Primitive Obsession & Data Clumps $\to$ Domain Value Objects & Java 21 Records
- **Interview Reality:** Methods taking 8 raw `String` and `double` arguments (`String pan`, `String currency`, `double amount`, `String userEmail`, `String phone`, `String status`).
- **Code Smells:** Primitive Obsession, lack of invariant validation, mutable leaks, non-type-safe strings for enum states.
- **Target Refactoring:** Introduce Parameter Object $\to$ Domain-Driven Value Objects (`Money(BigDecimal, Currency)`, `Email`, `PhoneNumber`) $\to$ Immutable Java 21 `record` with compact constructors.
- **Canonical Examples:** `UserRegistrationProcessor`, `InvoiceBillingDataClump`, `OrderPlacementValidator`.

### Archetype 1.3: God Class / Spaghetti Orchestrator $\to$ Single Responsibility Principle (SRP)
- **Interview Reality:** A single `OrderService` or `UserManager` that validates input, performs database queries, formats HTML emails, sends SMS, and writes audit logs in one huge 200-line method.
- **Code Smells:** Single Responsibility Principle (SRP) violation, tight coupling, impossible to unit test without firing up real network/DB.
- **Target Refactoring:** Extract Collaborators $\to$ Introduce Interfaces $\to$ Constructor Dependency Injection.
- **Canonical Examples:** `OrderFulfillmentSpaghetti`, `UserAccountLifecycleManager`.

### Archetype 1.4: Untestable Legacy with Hardcoded Dependencies $\to$ Michael Feathers' Seams
- **Interview Reality:** Code calling `new HttpClient()`, `System.currentTimeMillis()`, or static singletons `UserSession.getInstance()` directly inside methods.
- **Code Smells:** Inability to test without hitting external systems, non-deterministic time tests.
- **Target Refactoring:** Michael Feathers' *Subclass and Override Method* or *Overloaded Constructor Seam*, Virtual Clock injection (`java.time.Clock`).
- **Canonical Examples:** `TripServiceKata`, `OverloadedConstructorSeam`, `LegacyPdfReportGenerator`.

---

## 📋 Required Output Structure per Kata

For every discovered kata (aim for 4 Junior + 4 Middle):

1. **Title & Grade:** e.g. `[L1-REF-01] E-Commerce Dynamic Discount Engine (Strategy & OCP)`
2. **Company Context:** (Where this type of question is asked: e.g. Yandex E-commerce, Ozon, Amazon)
3. **The "Dirty" Code (80–180 lines):** Fully compiling Java code with intentional smells.
4. **Code Smells Checklist:** 4–6 specific architectural smells the interviewer expects the candidate to identify in the review phase.
5. **Pin-Down Test Suite:** Comprehensive JUnit 5 tests capturing all edge cases before refactoring.
6. **Refactored Clean Code:** Complete Java 21 LTS reference implementation applying clean patterns.
7. **Interview Follow-Up Questions:** 3 probing questions the interviewer asks to test candidate depth.
