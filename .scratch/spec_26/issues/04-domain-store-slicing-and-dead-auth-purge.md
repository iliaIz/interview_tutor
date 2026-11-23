# 04: [Expand/Migrate] Domain Store Slicing & Dead Auth Purge

**Archetype:** Expand-Migrate-Contract
**Blocked by:** None
**Status:** closed - verified in production (commit b6f818d)

## Verification
- Verified by: GitHub Actions Run 45089445074 & 45090110754
- `useAppStore.ts` shrunk from 1,384 to 134 lines.
- Slices: `academySlice.ts` (174 lines), `practiceSlice.ts` (197 lines), `questionsSlice.ts` (343 lines), `uiSlice.ts` (205 lines), `whiteboardSlice.ts` (310 lines).
- 100 lines of dead duplicate auth code removed. All 57 call sites intact.

## What to Build
Decompose the 1,384-line monolithic Zustand store `frontend/src/store/useAppStore.ts` into focused domain slices:
1. `frontend/src/store/slices/practiceSlice.ts`: Workspace files, active file index, phases, evaluation results (~250 lines).
2. `frontend/src/store/slices/academySlice.ts`: Academy studio navigation, steps, courses, modals (~200 lines).
3. `frontend/src/store/slices/whiteboardSlice.ts`: Whiteboard state, code revisions buffer, checkout actions (~150 lines).
4. `frontend/src/store/slices/uiSlice.ts`: Studio tabs, toasts, system health diagnostics, recaps (~150 lines).
Purge dead ghost auth state and actions (`currentUser`, `isAuthChecking`, `loginWithInviteCode`, `logout`) from `useAppStore.ts` (-100 dead lines).
Re-assemble all slices in `useAppStore.ts` (< 200 lines) to ensure all 57 existing call sites continue to work without breaking changes.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/store/useAppStore.ts`.
- **Dependencies**: React & Zustand store runtime.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Invariant: Zero regressions across all 57 existing components calling `useAppStore()`.
- Rule 8 Compliance: Every slice file &le; 300 lines; root `useAppStore.ts` &le; 200 lines.
- Complete removal of dead duplicate auth logic in favor of `useAuthStore.ts`.

## Explicit Non-Goals
- Modifying authentication flow in `useAuthStore.ts`.
- Changing UI component layouts or design tokens.

## Acceptance Criteria
- [ ] `useAppStore.ts` shrinks from 1,384 lines to &le; 200 lines.
- [ ] All slices (`practiceSlice`, `academySlice`, `whiteboardSlice`, `uiSlice`) are &le; 300 lines each.
- [ ] Dead auth fields removed completely.
- [ ] TypeScript compilation (`npx tsc --noEmit`) passes with zero errors.
