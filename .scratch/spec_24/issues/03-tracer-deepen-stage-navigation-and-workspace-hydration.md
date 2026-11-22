# 03: [Tracer-Bullet] Deepen Stage Navigation and Workspace Pre-Hydration

**Parent:** Spec 24 (`spec-24-architectural-deepening-and-seam-hardening.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
Deepen `frontend/src/services/arenaNavigator.ts` into `ArenaWorkspaceCoordinator` with a clean `launch(intent)` interface. Eliminate the leaky `LocalStudioCallbacks` parameter, ensuring navigation to `practice`, `system_design`, `sql_arena`, `take_home`, and `voice_modal` works identically from any caller (Company Studio, Copilot, breadcrumbs, search). Add `openPracticeChallengeById` to `frontend/src/store/useAppStore.ts` (symmetric with `openSystemDesignById`), encapsulating challenge fetching, envelope unwrapping, and draft loading inside the store aggregate. Eliminate fragile string-prefix heuristics (`sql-`, `SD-`) in favor of typed `TargetArena` lookups.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/services/arenaNavigator.ts` & `frontend/src/store/useAppStore.ts`
- **Verification Command:** `npm --prefix frontend run test:audio-contracts` (which runs all headless frontend contract suites)
- **Dependencies:** In-memory store and mock fetch responses.

## Embedded Contract Slice & Invariants
- `ArenaLaunchIntent` and `ArenaWorkspaceCoordinator` contracts from Spec 24 Section 4.3.
- Invariant: Zero `callbacks?: LocalStudioCallbacks` parameter in the public navigation interface.
- Invariant: Practice challenge hydration must unwrap `{ challenge, savedDraft }` without leaking envelope structures.

## Explicit Non-Goals
- Altering visual subtabs in `CompanyPrepStudio.tsx` or `CompanyPipelineTab.tsx`.
- Modifying PGlite WASM execution logic in `SqlArena.tsx`.

## Acceptance Criteria
- [ ] `useAppStore.ts` provides `openPracticeChallengeById(id)`.
- [ ] `arenaNavigator.ts` exports `ArenaWorkspaceCoordinator.launch(intent)`.
- [ ] `CompanyPrepStudio.tsx` calls `ArenaWorkspaceCoordinator.launch(target)` without passing local callback closures.
- [ ] All frontend contract tests pass.
