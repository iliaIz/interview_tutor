# 04: [Tracer-Bullet] Backend Practice Challenge Catalog Domain Seam

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Extract a deep domain repository `PracticeChallengeCatalog` to decouple SQLite database queries, status calculation, draft persistence, and Maven scaffolding from Express route handlers:
1. `backend/src/services/practice/PracticeChallengeCatalog.ts` ($\le 300$ lines):
   - Encapsulates `coding_challenges` and `coding_submissions` SQLite `db.prepare` statements.
   - Computes challenge status (`COMPLETED` | `IN_PROGRESS` | `FAILED` | `NOT_STARTED`).
   - Federates Spring Transaction challenges from `practiceTxCatalogService`.
   - Validates draft files count ($\le 15$) and size ($\le 200\text{KB}$).
   - Encapsulates Maven ZIP scaffold building (`buildChallengeZipPackage`).
2. Refactor `backend/src/routes/practice.ts` ($\le 100$ lines) into a lean HTTP adapter delegating to `PracticeChallengeCatalog`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/practice/PracticeChallengeCatalog.ts` and `backend/src/routes/practice.ts`.
- **Dependencies**: Real SQLite database instance (`backend/src/services/db.ts`).
- **Verification Command**: `remote-verify` passes backend TypeScript build and Practice LLD Resilience tests.

## Embedded Contract Slice & Invariants
- Zero DB schema changes: Keep existing tables (`coding_challenges`, `coding_submissions`) completely unchanged.
- Rule 8 Compliance: New service $\le 350$ lines, route $\le 400$ lines (targeting $<100$ lines).

## Explicit Non-Goals
- Do NOT alter `ChallengeEvaluationPipeline.ts` or evaluation grading routes (`handleEvaluationStream`).
