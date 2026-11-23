# Issue 04: [Prefactor] Practice Catalog Filter Engine

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/practice/PracticeCatalog.tsx` (364 lines):
1. Extract `frontend/src/components/practice/hooks/usePracticeCatalogFilter.ts` (< 160 lines):
   - Fetching `/api/practice/challenges`
   - Multi-axis category, archetype, status, and text search filter memo
   - Selection synchronization when filters change
   - Grade collapse state and toggler
2. Reduce `PracticeCatalog.tsx` to $\le 150$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `usePracticeCatalogFilter.ts` & `PracticeCatalog.tsx`.
- **Dependencies**: React hooks & catalog types.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `PracticeCatalog.tsx` shrinks from 364 to $\le 150$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
