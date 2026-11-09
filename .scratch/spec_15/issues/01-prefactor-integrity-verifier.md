# 01: [Prefactor] Zero-Stillborn Starter Workspace Integrity Verifier Test Harness

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
A dedicated Node.js test harness `backend/tests/verify_starter_workspaces_integrity.js` that scans all challenge manifests across JSON catalogs (`json/machine_coding_challenges.json`, `json/refactoring_challenges.json`), in-memory catalogs (`backend/src/services/additionalChallenges.ts`, `backend/src/services/challengeSeedData.ts`), and mutation curricula (`backend/src/services/mutationChallenges/*.ts`).

The script verifies:
1. **Zero Pre-Solved Machine Coding:** Student-editable workspace files in `machine_coding` challenges MUST NOT contain completed algorithmic logic; they must contain `UnsupportedOperationException("Not implemented yet")` or empty TODO stubs.
2. **Surviving Mutants Invariant:** Starter tests in `testing_mutation` katas MUST NOT kill 100% of target mutants out-of-the-box. At least one mutant must survive without user intervention.
3. **Bug Preservation Invariant:** Starter code in code review challenges MUST contain the documented historical bugs.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/tests/verify_starter_workspaces_integrity.js`
- **Dependencies**: Node.js runtime, catalog source files. Zero external services.
- **Verification Command**: `node backend/tests/verify_starter_workspaces_integrity.js`

## Embedded Contract Slice & Invariants
- Exit code must be 1 if defects are found; 0 if all audited challenges pass.
- Output concise report of audited vs failing challenges.
- Invariant: Fast execution (< 500ms).

## Explicit Non-Goals
- Modifying sandbox runners, WebSockets, or live frontend code.

## Acceptance Criteria
- [ ] Test harness successfully parses all 132 challenge definitions.
- [ ] Correctly identifies the remaining defective challenges before remediation.
- [ ] Passes cleanly once subsequent remediation tickets complete.
