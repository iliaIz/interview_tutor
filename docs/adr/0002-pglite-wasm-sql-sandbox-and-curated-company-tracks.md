---
status: accepted
verification: pending
date: 2026-11-08
---

# 0002. PGlite WASM SQL Sandbox and Curated Company Tracks Architecture

## Context & Problem Statement
Candidate preparation for top-tier software engineering roles is inherently company-specific. For example, candidates preparing for Raiffeisen DGTL face rigorous expectations around the Product Engineer mindset, strict financial precision, and complex PostgreSQL querying traps (such as the three-valued logic of `NOT IN (SELECT ...)` with `NULL`s, window function ties, and aggregation granularity).

Historically, interview prep platforms either:
1. Create siloed "company sections" with duplicate coding challenges and disjointed progress tracking, or
2. Rely on brittle regex/string matching to check SQL queries, or
3. Attempt to spin up Dockerized PostgreSQL containers per user, which violates the platform's strict VPS memory boundary (strictly 1.8 GB RAM).

We require an architectural design that provides company-tailored preparation (starting with Raiffeisenbank) without data silos or duplicate execution infrastructure, and enables interactive SQL execution with 100% PostgreSQL fidelity at zero server memory cost.

## Decision
1. **Curated Company Pipelines as Projections over Canonical SSOT:**
   - Keep all coding challenges, bug-hunt katas, system design scenarios, and questions strictly in canonical storage (`machine_coding_challenges.json`, `refactoring_challenges.json`, `scenarios/manifests/`, `all_interview_questions.json`).
   - A Company Track is a curated Directed Acyclic Graph (DAG) that references canonical entity IDs, mapping directly to the employer's hiring stages (Cultural Fit / Product Engineer mindset, Live Coding, Code Review, SQL & Databases, System Design).
2. **In-Browser PGlite WASM SQL Execution (Zero VPS Load):**
   - Execute interactive SQL challenges client-side using `@electric-sql/pglite` (WebAssembly build of official PostgreSQL 16) running in a background Web Worker.
   - Zero VPS memory consumption: all database schemas, seed fixtures, and query executions occur in client memory (<30ms cold start, <2ms query execution).
   - Full PostgreSQL dialect support: native execution of CTEs, window functions (`DENSE_RANK()`, `ROW_NUMBER()`), `INTERVAL '30 days'`, `COUNT(*) FILTER (...)`, and `NULLIF(...)`.
3. **Deterministic SQL Result Comparator:**
   - Execute the candidate's query and the reference `expectedQuery` against an identical ephemeral in-memory database instance.
   - Assert column names, column counts, row counts, and tuple values (with order verification when `orderMatters === true`).
   - Present candidates with side-by-side data grids and visual diffs on mismatch.
4. **Dedicated Company Prep Studio (`CompanyPrepStudio.tsx`):**
   - Provide a company dossier view containing engineering culture (Product Engineer 9 competencies), hiring stages, Red/Green flags matrix, and an express 3-4h runbook ("Interview Tomorrow").
   - Compute a real-time Company Readiness Index (CRI) from candidate performance across the linked canonical entities.
5. **Role-Specific Voice Mentor Presets:**
   - Inject company-specific persona prompts into `VoiceModal` / `useLiveVoiceSession` (e.g. `raiffeisen_dgtl_pe`), enabling the Gemini Live AI tutor to grill candidates according to that company's specific cultural bar.

## Verification & Guardrail
- **Type Safety & Contracts:** Shared schema definitions in `@interview-prep/shared` and frontend/backend TypeScript build verification (`npm run build`).
- **File Length Limits:** Adherence to $\le 350$ lines for new components, decomposing studio sub-views into modular files.
- **Client Performance:** WebAssembly cold-start verification $<50$ms in the browser.

## Consequences
- **Positive:**
  - 100% authentic PostgreSQL environment without Docker overhead or VPS memory starvation.
  - Zero duplication of coding challenges, katas, or grading pipelines.
  - Highly engaging, company-tailored candidate experience with realistic interview stages.
- **Trade-offs / Negatives:**
  - Initial load of `@electric-sql/pglite` requires downloading ~3 MB WASM assets (cached client-side).
  - Web Worker communication requires structured serialization of query result sets.

## Considered & Rejected Alternatives
- **Alternative 1: Server-side PostgreSQL containers in Docker:**
  Rejected due to strict VPS memory limits (1.8 GB RAM) and server freeze risks.
- **Alternative 2: SQLite in-memory:**
  Rejected because SQLite lacks key PostgreSQL syntax (`INTERVAL '30 days'`, `COUNT(*) FILTER`, strict `NUMERIC` types), which would teach candidates incorrect SQL dialect behavior for enterprise PostgreSQL interviews.
- **Alternative 3: Regex-based SQL validation:**
  Rejected as an anti-potemkin violation; multiple valid SQL queries can achieve identical relational projections through different syntax constructs.
