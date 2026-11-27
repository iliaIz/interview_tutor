# 07: [Contract] Spec 60 (T7): Purge Legacy Compass Boilerplate & Final CI / WCAG AA / Critique Gate

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Contract  
**Blocked by:** #216  
**Status:** ready-for-agent

## What to Build
Execute final Contract cleanup after `#216` (`Migrate-Batch`) completes: strip duplicated custom modal overlays, dead CSS utilities, and redundant `useBodyScrollLock` calls from the 5 migrated `*CompassSheet.tsx` sheets and `<dialog>` modals, verify `AGENTS.md` file-hygiene limits across all touched files, run full CI contract/build checks (`remote-verify`), and execute the closing multi-viewport UX/accessibility audit gate.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/components/practice/compass/LldCompassSheet.tsx`
  - `frontend/src/components/practice/compass/TestingCompassSheet.tsx`
  - `frontend/src/components/practice/compass/RefactoringCompassSheet.tsx`
  - `frontend/src/components/practice/compass/ConcurrencyCompassSheet.tsx`
  - `frontend/src/components/practice/compass/TransactionCompassSheet.tsx`
  - `frontend/src/components/practice/compass/CompassDialogShell.tsx`
  - `frontend/src/index.css` & `frontend/tests/practiceWorkspaceState.test.ts`
- **Dependencies:** CI (`remote-verify`) + Headless Chromium (`agent-browser` at `1440×900`, `1280×800`, `390×844`), `axe-core`, `detect.mjs`, `/impeccable critique`.
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- **Zero Duplicate Modal Shells:** After verifying zero external callers depend on legacy modal chrome inside `LldCompassSheet.tsx`, `TestingCompassSheet.tsx`, `RefactoringCompassSheet.tsx`, `ConcurrencyCompassSheet.tsx`, and `TransactionCompassSheet.tsx`, strip legacy wrapper/overlay JSX, redundant window key listeners, and redundant `useBodyScrollLock` calls now handled natively by `<dialog>.showModal()`.
- **File Hygiene (`AGENTS.md` §8):** Confirm zero newly created files exceed `350L` and zero modified files exceed `400L`.
- **Hoare-Logic Closing Gate (Spec 60 §6):**
  - `scrollY === 0`, `documentElement.scrollWidth === clientWidth`, `PracticeArenaHeader` height `48px` at `1440×900`, `1280×800`, `390×844` (including `StudioHeader` on Catalog `390px`).
  - Stealth Mode hides all Co-Pilot panes + `AmbientVoicePill` cleanly without dropping live voice socket.
  - Zero `axe-core` critical/serious issues; `/impeccable critique` re-score `>= 30/40` (vs `15/40` baseline); `json/refactoring_challenges.json` verified `0` truncated/glitched entries.

## Explicit Non-Goals
- Do NOT introduce new visual features or alter Spec 60 contracts during cleanup.
- Do NOT modify `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, SQLite DDL, or IntelliJ ports `:41789`/`:41790`.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] Legacy modal overlays, duplicate `Ctrl+/` listeners, and redundant `useBodyScrollLock` calls purged from all 5 `*CompassSheet.tsx` files with zero TypeScript or runtime errors.
- [ ] `remote-verify` passes cleanly (`test:audio-contracts`, `verify-hygiene`, production `vite build`, all modified files `<= 400L`, all new files `<= 350L`).
- [ ] Multi-viewport Chromium + `axe-core` + `/impeccable critique` verification passes: `0` critical/serious a11y defects, `0px` horizontal overflow, and critique score `>= 30/40`.
