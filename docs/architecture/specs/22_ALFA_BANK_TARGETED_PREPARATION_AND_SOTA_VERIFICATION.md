# Alfa Digital & А-Токен Targeted Preparation Hub (Pillar 22 SSOT)

> **Document:** `22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`  
> **Status:** Authoritative Single Source of Truth (SSOT)  
> **Target Standard:** SOTA Late 2026  
> **Parent Master Architecture:** [docs/architecture.md](file:///home/djelu/projects/interview_tutor/docs/architecture.md)

---

## 1. Intent & Workload Envelope

- **Context & Glossary:**  
  Governed by [GLOSSARY.md](file:///home/djelu/projects/interview_tutor/GLOSSARY.md), [ADR 0002](file:///home/djelu/projects/interview_tutor/docs/adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [Spec 10](10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md), and [Spec 12](12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md).
- **Domain Mission:**  
  Bridge the qualitative gap between the legacy 821-question encyclopedic catalog and modern banking interview standards (Alfa Digital, Middle+/Senior Java, and the «А-Токен» CFA platform). Provide a zero-silo, curated vertical preparation track that projects 27 high-yield architectural questions and 23 practical cases across existing native assessment engines (Practice Arena, Bug Hunt, SQL Arena, System Design, SRE Triage, and Voice Modal).
- **Operating Envelope:**  
  - Target Latency: p50 < 15ms, p95 < 45ms, p99 < 120ms for REST endpoints; in-browser PGlite query execution < 5ms.
  - Projected QPS: 10–50 QPS local / VPS control-plane load; 0 CPU worker thrashing on the 1.8 GB RAM VPS.
  - Tenancy Isolation: `isolated-multi-tenant` (partitioned by `user_id`), default `user_id = 'default_user'`.
  - Data Classification Tier: `Internal` (Assessment Progress, Epistemic Evaluations, Telemetry).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementation agent is **strictly and physically forbidden** from modifying the following components:
1. **Audio DSP & WebSocket Protocol Stacks:**  
   `frontend/src/services/AudioPlayoutManager.ts`, `frontend/src/services/LiveVoiceEngine.ts`, and `backend/src/routes/voice.ts`. The Dual-Sided Handshake, EchoGuard (-29 dBFS filter), and Auto-VAD protocols are immutable per Specs 16 and 17.
2. **Destructive Mutation of Existing Questions:**  
   No rows in the `questions` table (IDs `CORE-*`, `CONC-*`, `SPRING-*`, etc.) may be deleted, truncated, or have their IDs re-keyed. All new Alfa-Bank questions are additive.
3. **Sandbox Resident Daemon IPC Protocol:**  
   `ResidentSandboxDaemon.java` and its loopback IPC protocol remain untouched. New coding challenges must compile and run against the existing runner harness.
4. **PGlite WebAssembly Core:**  
   `frontend/src/components/sql/SqlArena.tsx` Web Worker execution core is immutable. SQL challenges must run purely through standard schema/fixture injection.
5. **VPS Deployment Infrastructure & Guardrails:**  
   `.github/workflows/deploy.yml`, `/usr/local/bin/docker`, and system guardrails are strictly out of scope. Zero local builds or Docker builds on host.

---

## 3. Pre-Agreed Verification Seams

- **Primary Seams:**
  1. **Company Catalog Provider Seam:** `backend/src/routes/companies.ts`  
     Endpoint `GET /api/companies/alfa_digital` returning validated `CompanyProfile` conforming to TypeBox `CompanyProfileSchema`.
  2. **Readiness Ledger Seam:** `backend/src/routes/companies.ts` (`GET /api/companies/:id/readiness`)  
     Calculates deterministic readiness metric across 5 dimensions: Theory (27 questions), Code Review (6 katas), Live Coding (5 challenges), SQL (7 tasks), and System Design / SRE (5 scenarios).
  3. **Multi-Arena Dispatcher Seam:** `frontend/src/services/arenaNavigator.ts`  
     `launchArenaTask()` routing to `practice`, `incidents`, `sql_arena`, `system_design`, `voice_modal` with company context injection.
  4. **Idempotent Ingestion Seam:** `backend/src/services/dbSeedCatalogs.ts`  
     Seeding routines for `company_profiles.json`, `sql_challenges.json`, `machine_coding_challenges.json`, and `refactoring_challenges.json`.
- **Real-Wire Dependencies (Zero Domain Mocks):**
  - Ephemeral SQLite database via `better-sqlite3` (`data/interview.db`) operating in WAL mode.
  - In-browser PGlite WASM PostgreSQL 16 engine for SQL challenge test suite.
  - Zero internal domain mocks; all queries and assertions run against actual database tables and schemas.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Synchronous REST Contract (OpenAPI 3.1 YAML)

```yaml
openapi: 3.1.0
info:
  title: Alfa Digital Targeted Preparation API
  version: 1.0.0
paths:
  /api/companies/alfa_digital:
    get:
      summary: Retrieve Alfa Digital company profile and pipeline DAG
      responses:
        '200':
          description: Validated Alfa Digital Company Profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CompanyProfile'

  /api/companies/alfa_digital/readiness:
    get:
      summary: Get candidate readiness index for Alfa Digital interview
      parameters:
        - name: user_id
          in: query
          required: false
          schema:
            type: string
            default: default_user
      responses:
        '200':
          description: Real-time aggregated readiness index
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CompanyReadinessIndex'

  /api/companies/alfa_digital/questions:
    get:
      summary: Get 27 curated Alfa Senior questions with physical invariants
      responses:
        '200':
          description: Curated high-yield question deck
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/CuratedQuestion'
```

### 4.2. Asynchronous Event / Outbox Progress Envelope

```typescript
export interface CompanyProgressEventEnvelope {
  eventId: string;
  timestamp: number;
  userId: string;
  companyId: 'alfa_digital';
  domain: 'theory' | 'code_review' | 'live_coding' | 'sql' | 'system_design';
  targetEntityId: string;
  score: number;
  isPassed: boolean;
  metadata?: {
    timeSpentSeconds?: number;
    attemptNumber?: number;
    flawsIdentifiedCount?: number;
  };
}
```

---

## 5. Storage & Zero-Downtime Migration Contract

### 5.1. Rollout Strategy: Additive-Only

All schema changes are strictly **Additive-Only**. Existing tables (`questions`, `coding_challenges`, `bug_challenges`, `system_design_manifests`, `sql_challenges`) remain fully backwards-compatible.

### 5.2. Lock-Safety & Pragmas
All migrations run inside single SQLite transactions with:
```sql
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### 5.3. Schema Diff (DDL)

```sql
-- 1. Table for tracking per-company curated question mastery
CREATE TABLE IF NOT EXISTS company_question_mastery (
  user_id TEXT NOT NULL DEFAULT 'default_user',
  company_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  is_mastered INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  last_evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, company_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_cqm_user_company 
ON company_question_mastery(user_id, company_id);
```

### 5.4. Seed Manifests Ingestion
- `json/company_profiles.json`: Ingest full `alfa_digital` profile entry with Stage 1 (Screening) & Stage 2 (Tech & System Design).
- `json/sql_challenges.json`: Add `sql-alfa-01` .. `sql-alfa-05` (with DDL/DML fixtures for PGlite).
- `json/refactoring_challenges.json`: Add `cr-alfa-01` .. `cr-alfa-06` (Code Review katas).
- `json/machine_coding_challenges.json`: Add `lc-alfa-01` (SegmentedMap), `lc-alfa-02` (Stream API BigDecimal), `lc-alfa-04` (Immutable Records), `lc-alfa-05` (Jakarta Validation). (`lc-alfa-03` aliases canonical `lld-key-value-cache-ttl`).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### Contract 1: `GET /api/companies/alfa_digital` (Profile Delivery)
- **Pre-Conditions {P}:** Profile `alfa_digital` exists in `company_profiles.json` and passes `Value.Check(CompanyProfileSchema, profile) === true`.
- **Algorithm C:** Read cached profile in memory; if miss, read `company_profiles.json` and validate against schema. Return HTTP 200.
- **Post-Conditions {Q}:** Response contains 2 complete stages, 9 Alfa competencies, 4 STAR scenarios, and express runbook. Zero DB writes.

### Contract 2: `GET /api/companies/alfa_digital/readiness` (CRI Computation)
- **Pre-Conditions {P}:** Valid `user_id`.
- **Algorithm C:**  
  1. Query `company_question_mastery` for completed questions out of 27.  
  2. Query `coding_submissions` for completed Live Coding challenges (`lc-alfa-01..05`).  
  3. Query `bug_challenges` / `coding_submissions` for completed Code Review katas (`cr-alfa-01..06`).  
  4. Query `coding_submissions` for SQL challenges (`sql-alfa-01..05`).  
  5. Query `system_design_submissions` & `triage_submissions` for SD scenarios (`SD-01..05`).  
  6. Compute weighted percentage: $\text{CRI} = (0.25 \times \text{Theory}) + (0.20 \times \text{CR}) + (0.20 \times \text{LC}) + (0.15 \times \text{SQL}) + (0.20 \times \text{SD})$.
- **Post-Conditions {Q}:** Response delivers exact counts and percentages per dimension. Overall score is bounded in $[0, 100]$.

### Contract 3: `launchArenaTask` Dispatch (Zero Silo Projection)
- **Pre-Conditions {P}:** Valid canonical `targetArena` and `targetEntityId`.
- **Algorithm C:** `launchArenaTask` resolves entity via existing store mechanisms without bundle reload. Injects `activeCompanyContext = 'alfa_digital'` into `usePracticeTutorStore` for polymorphic AI copilot grounding. Transitions UI view.
- **Post-Conditions {Q}:** Target arena initializes in $<50$ms. AI tutor prompts are conditioned on Alfa Digital Senior engineering standards and epistemic anti-sycophancy.

---

## 7. Orthogonal Invariants

1. **Zero Parallel Reimplementation (Rule 8):** No new test execution sandboxes or parallel voice engines may be created. Every task runs in its existing canonical arena.
2. **Deterministic PGlite Result Assertion:** SQL challenges in the browser assert exact column tuples, row counts, and ordering without server roundtrips.
3. **Epistemic Anti-Sycophancy (Spec 19-21):** The AI tutor and code reviewers evaluate candidate solutions according to physical root causes (e.g. flagging `double` in money as an immediate defect, refusing to accept `Collections.synchronizedMap` as an answer to segment locking).
