# Master Deep Research Protocol: Mining Real-World Java Refactoring Interview Katas (SOTA Late 2026)

> **Document:** `docs/research/refactoring_interview_katas/00_master_source_mining_protocol.md`  
> **Role:** Research Prompt & Source Mining Protocol  
> **Audience:** Deep Research Engine (Gemini Pro Deep Research, Perplexity Deep Research, ChatGPT Pro Deep Research)  
> **Target Platform:** Java 21 LTS, Spring Boot 3.4+, JUnit 5, In-Memory JVM Sandbox, Monaco Multi-File IDE  

---

## 🎯 Deep Research Objective

You are a **Principal Systems Architect, BigTech Staffing Bar-Raiser, and Technical Interview Lead (L6/L7 Staff)** at top-tier engineering organizations (Yandex, T-Bank, Ozon, Avito, Amazon, Stripe, Uber).

Your task is to conduct an **unconstrained, exhaustive deep research inquiry** to discover, curate, and catalog the **most frequent, high-signal, and battle-tested Java Refactoring & Code Review interview challenges** used in technical screening and on-site engineering rounds between 2023 and 2026.

---

## 🔍 Investigation Vectors & Source Targets

You must systematically search, crawl, and mine:

1. **GitHub Open Source Repositories:**
   - Emily Bache's canonical refactoring katas (`emilybache/*`, e.g. GildedRose, Tennis, Parrot, SupermarketReceipt, Yatzy, Racing-Car-Katas, Lift-Kata).
   - Enterprise interview leaks and collections (e.g. `kdn251/interviews`, `DopplerHQ/awesome-interview-questions`, `iluwatar/java-design-patterns`).
   - Michael Feathers' Working Effectively with Legacy Code reference implementations.
   - Martin Fowler's Refactoring catalog (2nd Edition, modern Java implementations).
2. **Technical Community Debriefs & Interview Leaks (2023–2026):**
   - Habr interview reviews and task breakdowns for Yandex (Яндекс), T-Bank (Тинькофф), Ozon, Avito, Sber, VK, Wildberries.
   - LeetCode Discuss / Blind / Glassdoor / Reddit (`r/java`, `r/cscareerquestions`) post-mortems of "Refactoring / Code Review" interview rounds.
   - Devoxx, JPoint, Joker, and Spring I/O conference talks on refactoring anti-patterns and code smells.
3. **Enterprise Production Post-Mortems & Anti-Pattern Collections:**
   - Real-world failures where bad architectural code led to memory leaks, connection exhaustion, deadlocks, or massive tech debt.

---

## 📐 Strict Technical Constraints & Inclusion Criteria

To be accepted into our platform, every discovered task MUST satisfy:

1. **Compilable & Realistic Code:**
   - Code must be written in **Java 17 or Java 21 LTS**.
   - Must be between **80 and 250 lines** of realistic business logic (NOT artificial 10-line toys, and NOT unwieldy 2000-line monoliths).
   - Code must represent realistic enterprise domains: E-commerce, FinTech/Billing, Logistics/Delivery, Booking/Reservations, Notification Dispatching, Auth/RBAC, IoT/Metrics.
2. **Authentic Code Smells (No Trivial Syntax Typos):**
   - Strictly prohibit trivial syntax bugs, missing semicolons, or typos.
   - Bugs and smells must be architectural: God Class, Primitive Obsession, Nested `if-else` / `switch` explosion, Feature Envy, Hidden Static State, Carrier Pinning in Loom, Missing Transactional Boundaries, Hardcoded I/O Dependencies.
3. **Dual-Phase Assessment Potential:**
   - **Phase 1 (Code Review):** Candidate verbally analyzes the code, articulates smells, and prioritizes remediation.
   - **Phase 2 (Refactoring):** Candidate introduces Characterization / Pin-down unit tests, then safely refactors the code into idiomatic Java 21 without breaking external contracts.

---

## 📋 Required Output Format per Discovered Kata

For every discovered or reconstructed interview challenge, provide a structured report:

```markdown
### [KATA-ID]: [Kata Title]
- **Target Grade:** [Junior L0 / Middle L1 / Senior L2 / Staff L3]
- **Domain & Enterprise Context:** [e.g. FinTech Double-Entry Ledger, E-Commerce Promo Pricing]
- **Real-World Interview Origin:** [Which companies use this or similar tasks: Yandex, T-Bank, Amazon, etc.]
- **Core Code Smells & Anti-Patterns:**
  1. [Code smell 1 with line/method reference]
  2. [Code smell 2 with consequence]
- **Original "Dirty" Legacy Code:** (Complete compilable Java class)
- **Characterization / Safety-Net Tests:** (JUnit 5 test suite preserving baseline invariants)
- **Refactoring Strategy & Design Patterns Applied:** (e.g. Strategy, State, Value Objects, Records)
- **Target Clean Reference Solution:** (Complete refactored Java 21 class)
- **Senior AI Review Checkpoint:** (Exact rubric criteria for grading the candidate's refactoring)
```

---

## 🚀 Execution Instructions for Research Engine

- Mine at least **16 to 24 diverse, production-grade refactoring challenges** across all 4 seniority levels.
- Prioritize tasks with high signal-to-noise ratio that test fundamental software engineering rather than obscure trivia.
- Ensure all source links, repository citations, and interview debrief references are documented.
