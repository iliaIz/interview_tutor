# 02: [Tracer-Bullet] Deepen ChallengeEvaluationPipeline Verdict Synthesis and Collapse practiceSseAdapter

**Parent:** Spec 23 (`spec-23-codebase-deepening-and-seam-consolidation.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
1. Deepen `ChallengeEvaluationPipeline.evaluate` (`backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`):
   - When Gate 1 (JVM Unit Tests) fails, yield a terminal event containing a fully formed `NormalizedEvaluationVerdict` (`compilationStatus: { isCompilable: false, syntaxErrors: [...] }`, `scoreBreakdown: { overallScore: 0, summaryReview: ... }`).
   - When Gate 2 (AST Invariants) fails, yield a terminal event containing a fully formed `NormalizedEvaluationVerdict` (`scoreBreakdown: { overallScore: 30, summaryReview: ... }`, `astViolations`).
   - Stop requiring the HTTP adapter to fabricate domain scores or synthetic `complete` SSE events.
2. Collapse `practiceSseAdapter.ts` (`backend/src/routes/practiceSseAdapter.ts`):
   - Strip out ~180 lines of score fabrication, fallback object construction, and redundant label matching.
   - Shrink the adapter to a focused ~60-line streaming bridge that maps pipeline events directly to SSE `res.write` (or returns JSON in `isJsonMode`).
3. Internalize SQLite persistence calls from `evaluationPipelinePersistence.ts` cleanly.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/sandbox/ChallengeEvaluationPipeline.ts` & `backend/src/routes/practiceSseAdapter.ts`.
- **Dependencies**: Real SQLite WAL DB (`data/interview.db`), Java sandbox runner.
- **Verification Command**: `node backend/tests/test_practice_evaluate_sse.js` (or cloud runner `remote-verify`).

## Embedded Contract Slice & Invariants
- Hoare Logic {P} C {Q}:
  - {P}: Candidate code fails Gate 1 or Gate 2.
  - C: Pipeline yields terminal FAILED event with pre-synthesized `NormalizedEvaluationVerdict`. `practiceSseAdapter` writes it directly to SSE / JSON response.
  - {Q}: Client receives identical score (0 for Gate 1 fail, 30 for Gate 2 fail) and detailed review without HTTP adapter intervention.
- Rule 8 Limit: `practiceSseAdapter.ts` $\le 100$ lines, `ChallengeEvaluationPipeline.ts` $\le 300$ lines.

## Explicit Non-Goals
- Do not alter `RefactoringAstVerifier.ts` or AST rule definitions.
- Do not alter `JvmExecutionService.ts` or Docker sandbox container flags.

## Acceptance Criteria
- [ ] `ChallengeEvaluationPipeline` yields complete verdicts on all early-exit paths.
- [ ] `practiceSseAdapter.ts` shrinks from 266 lines to $\le 100$ lines.
- [ ] SSE test suite `backend/tests/test_practice_evaluate_sse.js` passes with 100% green assertions.
- [ ] JSON mode and SSE mode both return valid, compliant evaluation structures.
