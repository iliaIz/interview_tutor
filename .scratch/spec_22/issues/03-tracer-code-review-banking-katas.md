# 03: [Tracer-Bullet] Code Review & Bug Hunt Banking Katas (CR-01 .. CR-06)

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** closed  

## What to Build
1. In `json/refactoring_challenges.json`:
   - Ingest 6 enterprise code review banking cards:
     - `cr-alfa-01`: PaymentController (8+ critical bugs: static HashMap leak, `double` money precision loss, external HTTP RPC inside `@Transactional` holding HikariCP connection, raw Map, Kafka send before commit, `System.out.println`, `Date` mutable API, self-invocation).
     - `cr-alfa-02`: Transaction Retry Loop (`@Retryable` inside `@Transactional`, HikariCP starvation, premature message push before commit).
     - `cr-alfa-03`: DB Write + HTTP POST (Dual Write distributed atomicity violation, Transactional Outbox pattern).
     - `cr-alfa-04`: String intern() & synchronized (String Pool in Heap, cross-thread deadlocks, striped locking alternative).
     - `cr-alfa-05`: Hibernate Relationships (N+1 query problem, EAGER anti-pattern, `@EntityGraph`, JOIN FETCH, cartesian product).
     - `cr-alfa-06`: try-catch-finally Behavior (JVM exception table `ExceptionTable`, return statement overwriting, swallowed exceptions).
2. In `backend/src/services/dbSeedCatalogs.ts`:
   - Ensure `syncAll(refactorChallenges)` seeds the 6 Alfa katas into `bug_challenges` and `coding_challenges` with badge `🅰️ Alfa Code Review` and category `code_review`.
3. In `frontend/src/services/arenaNavigator.ts`:
   - Verify that clicking any `cr-alfa-*` task from Alfa Digital pipeline launches cleanly into `BugHuntArena` via `store.openTopicBugHunt(target.entityId)`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `json/refactoring_challenges.json` & `backend/src/services/dbSeedCatalogs.ts`
- **Dependencies**: Real SQLite database (`data/interview.db`).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Each kata must adhere to `RefactoringManifestSchema` / `BugChallengeSchema` with: `codeSnippet`, `bugExplanation`, `fixedCode`, `hints`, `keyTakeaways`.
- Strict Rule 8: File length limits respected.

## Explicit Non-Goals
- Modifying `BugHuntArena.tsx` rendering engine or AST parser.
- Modifying unrelated katas.

## Acceptance Criteria
- [x] All 6 CR cards (`cr-alfa-01` .. `cr-alfa-06`) ingested into JSON catalog and seeded into database.
- [x] Ground Truth failure physics and fixes validated against senior banking standards.
- [x] Direct navigation to each CR card from `launchArenaTask` opens without error.
