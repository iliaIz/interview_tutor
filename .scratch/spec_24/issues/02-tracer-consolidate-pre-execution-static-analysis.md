# 02: [Tracer-Bullet] Consolidate Pre-Execution Static Analysis Engine

**Parent:** Spec 24 (`spec-24-architectural-deepening-and-seam-hardening.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
Create `JavaStaticAnalysisEngine` in `backend/src/services/sandbox/JavaStaticAnalysisEngine.ts` ($\le 250$ lines) consolidating `AstSecurityScanner`, `RefactoringAstVerifier`, and `TestQualityScanner` behind a single synchronous `verify(files, policy)` method. Rewire `ChallengeEvaluationPipeline.ts` to execute static analysis deterministically, ensuring that test quality anti-patterns (such as `Thread.sleep` or missing assertions) are never skipped even when challenges define no mutants. Eliminate the defect where test quality errors were masked as mutant survival failures. Eliminate redundant security scanning in `JvmExecutionService` and `JvmMutationEngine`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `backend/src/services/sandbox/JavaStaticAnalysisEngine.ts` & `backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`
- **Verification Command:** `npm --prefix backend run test:practice:ast-verifier && npm --prefix backend run test:practice:scanner`
- **Dependencies:** In-memory AST test fixtures (zero container / network dependencies).

## Embedded Contract Slice & Invariants
- `StaticAnalysisPolicy` and `StaticAnalysisVerdict` contracts from Spec 24 Section 4.2.
- Invariant: `TestQualityScanner` must run on all submissions with test files, regardless of whether `manifest.mutants` is defined.
- Invariant: Zero duplicate `AstSecurityScanner.scan` executions across the pipeline.

## Explicit Non-Goals
- Modifying bytecode-level PIT mutation runner logic in `JvmMutationEngine.ts`.
- Altering AST constraint rule definitions in `RefactoringAstVerifier.ts`.

## Acceptance Criteria
- [ ] `JavaStaticAnalysisEngine.ts` created with $\le 250$ lines.
- [ ] `ChallengeEvaluationPipeline.ts` invokes `JavaStaticAnalysisEngine.verify()`.
- [ ] Test quality violations return descriptive errors directly in the pipeline event payload.
- [ ] `test:practice:ast-verifier` and `test:practice:scanner` pass 100%.
