# 04: [Tracer-Bullet] Mutation Katas (TST-01..TST-42) Starter Test Suites Cleanup (Surviving Mutants Invariant)

**Archetype:** Tracer-Bullet
**Blocked by:** #01
**Status:** ready-for-agent

## What to Build
Remediate the 42 mutation testing katas defined in `backend/src/services/mutationChallenges/*.ts`:
- `primitivesChallenges.ts` (PRIM-01..PRIM-10)
- `reverseTestingChallenges.ts` (REV-01..REV-10)
- `legacyChallenges.ts` (LEG-01..LEG-04)
- `junit5Challenges.ts` (JUNIT-01..JUNIT-05)
- `mockitoChallenges.ts` (MOCK-01..MOCK-05)
- `fsmChallenges.ts` (FSM-01..FSM-04)
- `concurrencyChallenges.ts` (CONC-01..CONC-03)
- `archUnitChallenges.ts` (ARCH-01)

Problem:
Currently, the starter `*Test.java` files already contain comprehensive assertions that kill 100% of configured mutants upon initial evaluation. The candidate can submit without writing tests.

Fix:
For each kata, adjust the starter `*Test.java` workspace file to provide:
1. Valid class declaration, imports, and fixture setup.
2. A basic/smoke test method that passes against the unmutated code, but DOES NOT kill all mutants (e.g. comment out or omit boundary assertions and mutant-killing oracles with clear `// TODO: Add assertions here to detect mutant X` instructions).
3. Ensure that when initial tests run against mutants, at least 1-2 mutants survive (`mutationScore.percentage < requiredScore`).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/mutationChallenges/`
- **Dependencies**: TypeScript compilation (`npx tsc --noEmit`).
- **Verification Command**: `node backend/tests/verify_starter_workspaces_integrity.js --filter=mutation`

## Embedded Contract Slice & Invariants
- Unmutated production code MUST pass the starter test (tests must be GREEN against golden master).
- At least 1 mutant must survive the starter test suite.
- Preserves all mutant definitions in `mutants: [...]`.

## Acceptance Criteria
- [ ] All 42 mutation katas have starter tests that pass on master but leave mutants alive.
- [ ] TypeScript typecheck passes.
- [ ] Passes integrity verifier for mutation katas.
