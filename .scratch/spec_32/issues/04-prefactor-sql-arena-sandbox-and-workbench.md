# Issue 04: [Prefactor] SQL Arena Headless Engine & Modular Workbench

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/sql/SqlArena.tsx` (379 lines):
1. Extract `frontend/src/components/sql/hooks/useSqlArena.ts` (< 160 lines): PGlite execution lifecycle, catalog loading, tab auto-switching heuristic (`diff`/`result`), Copilot store synchronization.
2. Extract `frontend/src/components/sql/components/SqlChallengeDetailCard.tsx` (< 80 lines): challenge description, interview trap, instructions.
3. Extract `frontend/src/components/sql/components/SqlWorkbenchPanel.tsx` (< 100 lines): CodeMirror editor, execution toolbar, reset, Copilot trigger.
4. Reduce `SqlArena.tsx` to $\le 120$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/sql/hooks/useSqlArena.ts` & `SqlArena.tsx`.
- **Dependencies**: PGlite execution engine & CodeMirror buffer.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `SqlArena.tsx` shrinks from 379 to $\le 120$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] PGlite query evaluation and tab routing verified.
- [ ] Remote verification builds 100% green.
