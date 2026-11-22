# 05: [Tracer-Bullet] In-Browser PGlite SQL & PostgreSQL Arena (SQL-01 .. SQL-07)

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** closed  

## What to Build
1. In `json/sql_challenges.json`:
   - Ingest 5 analytical SQL challenges for in-browser PGlite WASM execution:
     - `sql-alfa-01`: Joint purchases (Customers who bought Laptop AND Monitor in March 2024; `INTERSECT` vs `HAVING COUNT(DISTINCT)`).
     - `sql-alfa-02`: Average Age & Fan-Out Trap (Average age of Smartwatch customers with 1:M join fan-out avoidance using `EXISTS`).
     - `sql-alfa-03`: Credit Funnel Suite (4-step funnel conversion, maximum drop-off step using `LAG()`, Anti-Join with `NOT EXISTS`).
     - `sql-alfa-04`: Top-3 Cashback Categories (`DENSE_RANK()` vs `LIMIT 3` banking anti-pattern; reuse/adapt `sql-raiff-04`).
     - `sql-alfa-05`: Window Functions by City (5th purchase by city using `ROW_NUMBER() OVER (PARTITION BY town)`).
   - Ingest 2 Forensics / Locking challenges (mapped to SRE Triage / Forensics format):
     - `sql-alfa-06`: Diagnostic of `EXPLAIN ANALYZE` (Seq Scan, external merge Disk, composite B-Tree indexing).
     - `sql-alfa-07`: Transaction Isolation & Double-Spending (`Read Committed` Lost Update, `SELECT FOR UPDATE` vs atomic conditional `UPDATE`).
2. Provide DDL schema, seed data, and reference `expectedQuery` for each PGlite challenge.
3. In `frontend/src/services/arenaNavigator.ts`:
   - Verify `launchArenaTask` for `targetArena: 'sql_arena'` with `sql-alfa-*` sets active challenge and opens `SqlArena.tsx` without error.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `json/sql_challenges.json` & `SqlArena.tsx` (PGlite Web Worker)
- **Dependencies**: Client-side `@electric-sql/pglite` in WebAssembly (0 MB VPS memory).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- 100% PostgreSQL 16 dialect fidelity in WebAssembly.
- Deterministic query result comparison (columns, row counts, values, ordering).

## Explicit Non-Goals
- Modifying `SqlArena.tsx` PGlite worker architecture.
- Running Docker containers with PostgreSQL on the VPS host.

## Acceptance Criteria
- [x] All 5 PGlite challenges execute and validate query results in in-browser WASM engine.
- [x] Forensics cards for SQL-06 and SQL-07 integrated with detailed plan and locking explanations.
- [x] Navigation from Alfa Digital pipeline launches `SqlArena` with target challenge pre-selected.
