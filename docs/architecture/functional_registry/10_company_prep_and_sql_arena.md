# Subsystem 10: Targeted Company Preparation Hub & In-Browser SQL Arena

> **Location:** `docs/architecture/functional_registry/10_company_prep_and_sql_arena.md`  
> **Parent Index:** [`INDEX.md`](./INDEX.md)  
> **Governing Specification:** [`10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md`](../specs/10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md)  
> **Status:** Active (Empirically Verified SOTA Late 2026)

---

## 1. Architectural Purpose & Boundaries

This subsystem introduces company-targeted technical assessment pipelines (starting with Raiffeisenbank / Raiffeisen DGTL) without creating parallel silos, duplicate coding engines, or server memory bloat.

### Critical Invariants Enforced:
1. **Canonical SSOT Projections:** All coding katas, system design scenarios, questions, and code review challenges reside in canonical datasets. Company tracks sequence these as curated DAG pipelines.
2. **Zero-VPS-Load In-Browser PostgreSQL 16:** Interactive SQL queries execute via `@electric-sql/pglite` (WebAssembly build of official PostgreSQL 16) directly in candidate browsers (<30ms cold start, 0 MB server RAM load), strictly protecting the 1.8 GB VPS.
3. **Deterministic SQL Result Comparator:** Compares ground-truth rows against candidate results, handling Three-Valued Logic NULLs, floating point precision ($10^{-4}$ epsilon), column mismatches, and `orderMatters` assertions.
4. **Company Readiness Index (CRI):** Telemetry-backed readiness metric aggregating weighted completions across all pipeline stages.

---

## 2. Catalog of Touched Functions & Subsystems

### 2.1. `executeSqlChallenge(challenge, candidateQuery, options)`
- **File:** `frontend/src/services/sql/pgliteExecutionEngine.ts`
- **What Was Done:** Instantiates an ephemeral in-memory PostgreSQL 16 WebAssembly instance, applies schema DDL and seed data with intentional NULLs, executes the ground-truth expected query and candidate query, and evaluates relational diffs.
- **Hypothesis & Conclusion:** 
  - *Hypothesis:* WebAssembly Postgres will provide full PostgreSQL syntax support (`NOT EXISTS`, `INTERVAL '30 days'`, `DENSE_RANK`, `COUNT(*) FILTER`, `NULLIF`) without consuming server resources.
  - *Empirical Observation:* PGlite executes relational queries in 1–5 ms with zero server memory footprint, cleanly distinguishing three-valued logic outcomes.
- **Rationale & Why:** Dockerized Postgres per user violates VPS memory constraints; SQLite lacks PostgreSQL dialect features. PGlite in WASM solves the root cause.
- **Failure Modes & Invariants:** Ephemeral instances are strictly closed in a `finally` block to prevent browser memory leaks; query execution is bounded by an 8,000 ms timeout.

### 2.2. `evaluateSqlResultDiff(expectedRows, actualRows, orderMatters)`
- **File:** `frontend/src/services/sql/tableDiffEvaluator.ts`
- **What Was Done:** Implements multiset and ordered relational tuple comparison. Detects column count/name mismatches, row count deltas, missing rows, unexpected rows, and sort order violations.
- **Hypothesis & Conclusion:** Prevents string-matching and regex false-positives by comparing actual relational projections.
- **Rationale & Why:** Multiple queries (e.g. CTE vs subquery vs LEFT JOIN ... WHERE IS NULL) can produce identical sets; evaluating relational results ensures pedagogical fairness.

### 2.3. `CompanyPrepStudio`
- **File:** `frontend/src/components/companies/CompanyPrepStudio.tsx`
- **What Was Done:** Decomposed studio hub implementing the 4-tab workflow: Pipeline (5-stage hiring progression), Dossier (Product Engineer paradigm, Red/Green flags), Runbook (4-min pitch, checklist), and embedded SQL Arena.
- **Failure Modes & Invariants:** Adheres strictly to the $\le 350$ lines file hygiene limit by decomposing into `CompanyPipelineTab`, `CompanyDossierTab`, `CompanyRunbookTab`, and `SqlArenaHeader`.

### 2.4. `raiffeisen_dgtl_pe` Voice Persona
- **File:** `backend/src/prompts/personas.ts`
- **What Was Done:** Added the `raiffeisen_dgtl_pe` persona directive to Gemini Live prompting, calibrating questions on STAR, TTM/Pain Index, `BigDecimal` invariants, and deterministic DB lock ordering (`min -> max`).
