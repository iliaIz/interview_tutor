# Stage 02: Testing & Mutation Arena Actualization

> **Document:** `STAGE_02_MUTATION_TESTING_ARENA.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/02_TESTING_AND_MUTATION_ARENA.md`](../../architecture/specs/02_TESTING_AND_MUTATION_ARENA.md)

---

## 1. Scope & Target Files

- **Backend Services:** `backend/src/services/sandbox/JvmExecutionService.ts`, `TestQualityScanner.ts`, `AstSecurityScanner.ts`, `TreeEditDistanceGuard.ts`.
- **Backend Routes:** `backend/src/routes/practice.ts`, `backend/src/routes/sandbox.ts`.
- **Frontend Components:** `frontend/src/components/practice/` (Testing Arena views, challenge cards), CodeMirror 6 runner bindings.

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Opaque Mutation Failures:** When Pitest mutants survive, the UI currently only shows a raw score percentage without highlighting the exact bytecode operator that mutated.
2. **Potemkin Test Bypass:** Certain test patterns (e.g. empty `@Test` methods) can bypass assertion scanners if not checked at the AST level.
3. **Sandbox Connection Transient Drops:** If `interview-sandbox` restarts or hits swap limits, the backend throws an unhandled connection reset rather than executing an orderly retry.

---

## 3. Implementation Checklist

### Backend & Engine Actualization
- [ ] Refine `TestQualityScanner.ts` to require at least one valid assertion (`assertThat`, `assertEquals`, `assertThrows`, `verify`) per `@Test` method.
- [ ] Optimize the resident JVM execution pipeline to ensure sub-80ms mutation runs on standard katas.
- [ ] Add structured error diagnostics when `interview-sandbox` daemon is unreachable.

### Frontend UI/UX Actualization
- [ ] **Interactive Mutant Diff Inspector:** Clicking on a survived mutant in the scoreboard opens an inline diff drawer displaying:
  - Mutated Line of Code.
  - Applied Operator (e.g. `Conditionals Boundary Mutator: <= changed to <`).
  - Why the candidate's test suite failed to detect the defect.
- [ ] **Testing Compass Radar (`Ctrl + /`):** Implement the 4-axis interactive radar with hover diagnostics explaining Line Coverage vs Mutation Score vs Assertion Density.
- [ ] **JUnit 5 / AssertJ Autocomplete:** Enhance CodeMirror 6 with snippet templates for parameterized tests (`@ParameterizedTest`, `@ValueSource`, `@CsvSource`).

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Execute practice resilience & fault injection test suite
npm --prefix backend run test:practice:resilience

# 2. Verify challenge task codes and resolution
npm --prefix backend run test:practice:task-codes

# 3. Verify file hygiene standards
npm run verify-hygiene
```
