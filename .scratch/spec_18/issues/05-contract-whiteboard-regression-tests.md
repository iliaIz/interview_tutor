# 05: [Contract] Whiteboard Store, Visual Derivation & Regression Tests

**Archetype:** Contract / Verification  
**Blocked by:** #01, #02, #03, #04  
**Status:** ready-for-agent  

## What to Build
Implement comprehensive automated regression test suite `frontend/tests/whiteboardRevisionStore.test.ts`. Verify that:
1. Non-eviction GC retains pinned and IDE-tracked revisions even after 15 consecutive AI updates.
2. `getVersionVisualRole` formula correctly classifies all 4 permutations (`active_and_synced`, `active_only`, `synced_background`, `neutral`).
3. IDE update mutation updates active tracked revision without duplicating entries.
4. Checkout action updates active tracked target and triggers bridge push.
5. All 24 remote verification steps pass with zero regressions via `remote-verify`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/tests/whiteboardRevisionStore.test.ts`
- **Dependencies**: Vitest runner, Zustand store slice, headless DOM
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Non-Eviction Invariant**: For any revision set with $K$ pinned revisions, total retained revisions $= K + \min(10, \text{unpinnedCount})$.
- **Visual Role Invariant**:
  - `(id === active && id === synced) => 'active_and_synced'`
  - `(id === active && id !== synced) => 'active_only'`
  - `(id !== active && id === synced) => 'synced_background'`
  - `(id !== active && id !== synced) => 'neutral'`
- **Clean Teardown**: Sockets and timers cleanly unref to guarantee test process termination.

## Explicit Non-Goals
- Do NOT run heavy local compilers or test suites on VPS; verify strictly via `remote-verify`.

## Acceptance Criteria
- [ ] Vitest suite `frontend/tests/whiteboardRevisionStore.test.ts` created and passes
- [ ] Non-eviction GC mathematically asserted for $>10$ revisions
- [ ] 3-state visual derivation asserted across all permutation cases
- [ ] `remote-verify` succeeds across all CI steps
