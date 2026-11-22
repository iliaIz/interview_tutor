# 02: [Tracer-Bullet] Curated Senior Theory Deck & Oral Grill Seam

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** closed  

## What to Build
1. In `json/alfa_interview_questions.json` (or additive entries in `all_interview_questions.json`):
   - Ingest 27 Senior-level physical root-cause questions across 9 modules:
     - Module 01 (JVM & Memory): Stack frames, Metaspace vs Off-heap zero-copy `sendfile`, G1 vs ZGC Colored Pointers & Load Barriers, `HashMap` treeify/bit-spread resize, CPU cache lines in `ArrayList` vs `LinkedList`.
     - Module 02 (Concurrency): JMM `happens-before`, memory barriers, HotSpot lock evolution (biased/thin/fat), CAS, `LongAdder` vs `AtomicLong`, ThreadPool sizing formulas.
     - Module 03 (Spring): CGLIB vs JDK Proxy, self-invocation bypass, `@Transactional` + `ThreadLocal` + `TransactionSynchronizationManager`, Propagation levels, WebFlux Netty EventLoop.
     - Module 04 (PostgreSQL): MVCC `t_xmin`/`t_xmax`, Dead Tuples, VACUUM wraparound, SSI write skew, B-Tree leaf pages, Zero-Downtime Liquibase/Flyway migrations.
     - Module 05 (Kafka): Append-only segment layout, Page Cache zero-copy `sendfile`, EOS 2PC (`PID`, transactional coordinator, `read_committed`), Cooperative Sticky rebalancing protocol.
     - Module 06 (Distributed Systems): Transactional Outbox (Polling vs Debezium CDC), SAGA choreography vs orchestration, Resilience4j Circuit Breaker / Bulkhead.
     - Module 07 (DevOps/K8s): Pod lifecycle, Liveness probe DB anti-pattern, Graceful Shutdown preStop hooks, MDC async tracing, cgroups v1/v2 JVM RAM limits.
     - Module 08 (A-Token & Banking): Waves Enterprise blockchain (NOT Hyperledger!), CryptoPro GOST KS2, Misys Equation ABS SOAP integration, Double-Spending & Hardcap protection.
     - Module 09 (Interview Strategy): 2-stage hiring funnel, red flags, reverse interviewing questions.
2. In `backend/src/routes/companies.ts`:
   - Implement `GET /api/companies/alfa_digital/questions` returning the 27 curated questions with depth probe, root cause physics, and candidate red flags.
   - Implement `POST /api/companies/alfa_digital/questions/:id/mastery` to record candidate mastery in `company_question_mastery`.
3. In `backend/src/services/dbSeedCatalogs.ts`:
   - Add routine `seedAlfaQuestions(db)` to idempotently upsert the 27 questions with prefix `ALFA-Q-*`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `GET /api/companies/alfa_digital/questions` & `POST /api/companies/alfa_digital/questions/:id/mastery`
- **Dependencies**: Real SQLite WAL instance (`better-sqlite3`). Zero mocks.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Questions schema conformance: `id`, `global_id`, `num`, `topic`, `question`, `answer`, `source_pages`.
- Epistemic Anti-Sycophancy: Each question answer must include concrete physical invariants and candidate red flags.
- Zero mutation of existing 821 question records.

## Explicit Non-Goals
- Modifying `AudioPlayoutManager.ts` or WebRTC audio DSP.
- Mutating existing legacy question records.

## Acceptance Criteria
- [x] `GET /api/companies/alfa_digital/questions` returns exactly 27 curated questions.
- [x] `POST /api/companies/alfa_digital/questions/:id/mastery` updates `company_question_mastery` idempotently.
- [x] Existing questions and routes remain 100% operational.
