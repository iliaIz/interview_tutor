# Deep Research Prompt 2: Senior (L2) Concurrency, JMM, Project Loom & Transactional Refactoring

> **Document:** `docs/research/refactoring_interview_katas/02_senior_concurrency_loom_transactions.md`  
> **Target Audience:** Deep Research AI Engine  
> **Grades Covered:** Senior Java Software Engineer & Tech Lead (L2)  
> **Target Stack:** Java 21 LTS, Virtual Threads (Project Loom), Spring Boot 3.4+, JMM, PostgreSQL 16, HikariCP  

---

## 🎯 Research Objective

Act as a **Principal Concurrency & Reliability Architect (BigTech L6 Staff / Bar-Raiser)**.

Your objective is to conduct deep research to find and synthesize **8 to 10 canonical, high-signal interview refactoring challenges** specifically designed for **Senior (L2)** Java engineers.

At the Senior level, interviewers do not ask trivial questions about `Thread.sleep()`. Instead, candidates are presented with a compiling, realistic service (100–220 lines) that looks plausible on the surface, but exhibits **severe performance bottlenecks, deadlocks, race conditions under high concurrency, or transactional hazards under production load**.

The candidate must:
1. Conduct a deep concurrency & transactional audit (explain why this code fails at 50k RPS or under Virtual Threads).
2. Refactor the code to guarantee thread-safety, non-blocking high throughput, and data consistency under Java 21 LTS.

---

## 🔍 Specific Focus Archetypes to Search & Discover

### Archetype 2.1: Virtual Thread Carrier Pinning & Monitor Contention
- **Interview Reality:** Legacy code migrated to Java 21 Virtual Threads that uses heavy `synchronized(this)` blocks enclosing blocking I/O calls (database queries, HTTP calls, gRPC).
- **Failure Mechanism:** The underlying OS Carrier Thread is pinned to the virtual thread, exhausting the `ForkJoinPool` carrier pool and causing system-wide thread starvation and 10x latency spikes.
- **Target Refactoring:** Replace `synchronized` with `ReentrantLock` / `StampedLock`, or extract I/O operations outside synchronized monitors $\to$ Lock-free atomic patterns.
- **Canonical Examples:** `ConcurrentPaymentGatewayClient`, `TokenBucketRateLimiterPinning`, `SessionCacheSynchronizedBottleneck`.

### Archetype 2.2: Double-Spending, Race Conditions & Compound Check-Then-Act
- **Interview Reality:** An in-memory ledger or account service using `if (balance >= amount) { balance -= amount; }` or non-atomic operations across multiple `ConcurrentHashMap` keys.
- **Failure Mechanism:** Lost updates and balance corruption under concurrent threads; false illusion of thread-safety because `ConcurrentHashMap` was used, but individual operations were not composed atomically.
- **Target Refactoring:** Atomic compound operations via `compute()`, `LongAdder` / `Striped64`, CAS loops with `AtomicReference`, or explicit ordered locking.
- **Canonical Examples:** `MultiAccountTransferLedger`, `TicketReservationSystem`, `InventoryAllocationManager`.

### Archetype 2.3: Lock-Ordering Inversion & Distributed / Local Deadlocks
- **Interview Reality:** A transfer service that locks two accounts: `synchronized(accountA) { synchronized(accountB) { ... } }`.
- **Failure Mechanism:** Cyclic deadlock when Thread 1 transfers $A \to B$ while Thread 2 simultaneously transfers $B \to A$.
- **Target Refactoring:** Global lock ordering by unique identifier (`Comparable` ID ordering: `min(id1, id2)` then `max(id1, id2)`), or `tryLock(timeout)` with exponential backoff and jitter.
- **Canonical Examples:** `DeadlockFreeTransferService`, `DiningPhilosophersEnterpriseResourceLock`.

### Archetype 2.4: Spring Transactional Boundary & HikariCP Pool Starvation
- **Interview Reality:** A 150-line `@Transactional` method that fetches data from DB, calls 3 slow external third-party HTTP APIs (taking 2–4 seconds), processes business logic, and writes back to DB.
- **Failure Mechanism:** Holding database connections during idle HTTP I/O (Idle-in-Transaction), causing total HikariCP connection pool exhaustion and HTTP 504 gateway timeouts for all users.
- **Target Refactoring:** Shrink `@Transactional` boundary to strictly the persistence phase $\to$ Use `TransactionTemplate` or separate transactional write services $\to$ Decouple third-party I/O from database transactions.
- **Canonical Examples:** `OrderCheckoutWithExternalPaymentAndEmail`, `AuditBatchJobConnectionExhaustion`.

### Archetype 2.5: ThreadLocal Leakage in Virtual Threads & Scoped Values
- **Interview Reality:** Storing large user sessions or security contexts in `ThreadLocal` in an application running with millions of Virtual Threads, or failing to clean up `ThreadLocal` leading to cross-request data leaks.
- **Failure Mechanism:** Memory bloat (millions of Virtual Threads each retaining `ThreadLocal` map entries) and security breaches when virtual threads reuse carriers.
- **Target Refactoring:** Migrate to Java 21 `ScopedValue` (`ScopedValue.where(...).run(...)`), ensuring immutable, bounded-lifetime context propagation.
- **Canonical Examples:** `SecurityContextThreadLocalLeak`, `RequestContextPropagationKata`.

---

## 📋 Required Output Structure per Kata

For every discovered kata:

1. **Title & Grade:** e.g. `[L2-REF-03] Deadlock-Free Multi-Account Ledger (Ordered Locking & CAS)`
2. **Company Context:** (Where this type of question is asked: T-Bank FinTech, Stripe, Yandex Pay, Revolut)
3. **The "Dirty" Code (100–220 lines):** Plausible, compiling Java 21 code with realistic concurrency/transactional flaws.
4. **Concurrency Audit Findings:** 3–5 exact hazards (e.g. Carrier Pinning at line 45, Race Condition at line 78, HikariCP starvation at line 102).
5. **Stress Test / Concurrency Provocation Suite:** JUnit 5 test using `CountDownLatch`, `CyclicBarrier`, or Virtual Threads that reliably reproduces the bug under load.
6. **Refactored Clean Solution:** Thread-safe, non-blocking Java 21 LTS reference implementation.
7. **Bar-Raiser Follow-Up Questions:** 3 deep questions on JMM (happens-before, acquire/release semantics) and Loom internals.
