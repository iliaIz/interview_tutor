# Issue 04: [Prefactor] Practice Arena Workspace & Header Toolbar Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/practice/PracticeArena.tsx` (343 lines):
1. Extract `frontend/src/components/practice/arena/PracticeArenaHeader.tsx` (< 120 lines):
   - Academy breadcrumbs, catalog back button, mobile spec/code tab switch, focus mode, review score badge.
2. Extract `frontend/src/components/practice/arena/usePracticeFindingBridge.ts` (< 50 lines):
   - Regex file location parser and workspace file switching.
3. Extract `frontend/src/components/practice/arena/PracticeArenaWorkspace.tsx` (< 130 lines):
   - Split pane layout with `ChallengeSpecPanel` and `WorkspaceEditor`.
4. Reduce `PracticeArena.tsx` to $\le 90$ lines as a clean top-level arena router.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `PracticeArena.tsx`.
- **Dependencies**: React layout & challenge workspace.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `PracticeArena.tsx` shrinks from 343 to $\le 90$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
