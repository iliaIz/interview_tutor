# 01: [Prefactor] Schema Extensibility & Company Catalog Plumbing

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
1. In `backend/src/services/dbSchema.ts`:
   - Add additive table `company_question_mastery` and composite index `idx_cqm_user_company` to `CANONICAL_TABLES_SQL`:
     ```sql
     CREATE TABLE IF NOT EXISTS company_question_mastery (
       user_id TEXT NOT NULL DEFAULT 'default_user',
       company_id TEXT NOT NULL,
       question_id TEXT NOT NULL,
       is_mastered INTEGER DEFAULT 0,
       score INTEGER DEFAULT 0,
       last_evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, company_id, question_id)
     );
     CREATE INDEX IF NOT EXISTS idx_cqm_user_company ON company_question_mastery(user_id, company_id);
     ```
2. In `backend/src/routes/companies.ts`:
   - Extend route to support `/api/companies/:id/readiness` and `/api/companies/:id/questions` stubs.
   - Decouple company profile loading from any hardcoded Raiffeisen assumptions (ensure clean polymorphic company lookups).
   - Retain 100% backward compatibility with `raiffeisen_dgtl` and existing tests.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/dbSchema.ts` & `backend/src/routes/companies.ts`
- **Dependencies**: Real SQLite WAL instance (`better-sqlite3`). Zero mocks.
- **Verification Command**: `npx tsc --noEmit && node -e "const { db } = require('./backend/dist/services/db'); console.log('DB ok');"` (or remote-verify)

## Embedded Contract Slice & Invariants
- Hoare Logic {P} C {Q}:
  - {P}: Database is online, `CANONICAL_TABLES_SQL` executes on startup.
  - C: `CREATE TABLE IF NOT EXISTS company_question_mastery` executes idempotently.
  - {Q}: Table exists with 0 rows; existing tables (`questions`, `coding_challenges`, etc.) untouched.
- Rule 8 Limit: `backend/src/routes/companies.ts` $\le 350$ lines.

## Explicit Non-Goals
- Modifying audio routes or websocket handlers.
- Deleting or altering existing rows in `questions`.
- Modifying frontend components.

## Acceptance Criteria
- [ ] `company_question_mastery` table and index created cleanly on server startup.
- [ ] `GET /api/companies` returns existing company profiles without regression.
- [ ] TypeScript compilation passes with zero type errors.
