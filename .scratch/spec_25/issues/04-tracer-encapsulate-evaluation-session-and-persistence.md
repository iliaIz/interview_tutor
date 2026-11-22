# 04: [Tracer-Bullet] Encapsulate Evaluation Session and Consolidate Persistence

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** closed (verified in production CI/CD run 45084957707)

## What to Build
Consolidate the 5-Gate evaluation flow and persistence in `backend/src/services/sandbox/ChallengeEvaluationSession.ts`. Eliminate shallow `evaluationPipelinePersistence.ts` by pulling manifest loading and atomic SQLite upserts directly into the session aggregate. Replace 3 separate manual `persistRecord` calls in `ChallengeEvaluationPipeline.ts` with an encapsulated lifecycle and expose a clean `getTerminalVerdict()` method for `practiceSseAdapter.ts`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/sandbox/ChallengeEvaluationSession.ts`
- **Verification Command**: `remote-verify` (running LLD resilience, catalog integrity, and AST verifier tests)

## Embedded Contract Slice & Invariants
- Gate 1 (JVM), Gate 2 (AST & Static Analysis via `JavaStaticAnalysisEngine`), Gate 3 (PITest Mutation), Gate 4 (AI Evaluator), Gate 5 (Atomic Persistence).
- Any early failure or final pass formats canonical `TerminalEvaluationVerdict` and atomically upserts `coding_submissions`.
- Eliminates shallow `evaluationPipelinePersistence.ts` (satisfies Deletion Test).

## Explicit Non-Goals
- Do not alter PITest mutant definitions in `fsmChallenges.ts` or `junit5Challenges.ts`.
- Do not alter database schema of `coding_submissions`.

## Acceptance Criteria
- [ ] `ChallengeEvaluationSession.ts` orchestrates gates and owns atomic persistence ($\le 350$ lines).
- [ ] Shallow `evaluationPipelinePersistence.ts` is eliminated or converted to a thin alias.
- [ ] All practice LLD tests and AST verification suites pass in remote verification.
