# 02: [Tracer-Bullet] Spec 60 (T2): Unified 48px IDE Shell, StudioHeader Mobile Fix, Tab Strip & Phase 2 Hydration

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Tracer-Bullet  
**Blocked by:** #211  
**Status:** ready-for-agent

## What to Build
Eliminate stacked chrome (`223–261px`), scrolled IDE entry (`scrollY > 0`), `StudioHeader` mobile horizontal overflow (`+89px` at `390px`), duplicated Challenge header/badge (`~92px`), crushed off-screen file tabs, frozen timer, read-only default entry (`RateLimiter.java`), and unmounted Phase 2 files across `1440×900`, `1280×800`, and `390×844`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/App.tsx` (`isPracticeIdeActive`, `window.scrollTo(0, 0)`, `h-dvh overflow-hidden`)
  - `frontend/src/components/StudioHeader.tsx` (mobile `390px` containment `scrollWidth <= clientWidth`)
  - `frontend/src/components/practice/arena/PracticeArenaHeader.tsx` + `frontend/src/components/practice/arena/PracticeArenaWorkspace.tsx` + `frontend/src/components/practice/WorkspaceHeaderBar.tsx` + `frontend/src/components/practice/WorkspaceEditor.tsx`
  - `frontend/src/components/practice/ChallengeSpecPanel.tsx` + `frontend/src/store/slices/practiceSlice.ts` + `frontend/src/components/practice/useWorkspaceRunner.ts`
- **Dependencies:** Headless Chromium (`agent-browser` DOM check) + pure contract tests (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- `ArenaShellState`: `isPracticeIdeActive === (currentStudioTab === 'practice' && activePracticeChallenge !== null)`. When true: suppress `StudioHeader` and root `pb-24`/`overflow-x-hidden`, call `window.scrollTo(0, 0)` on IDE entry, lock container to `h-dvh overflow-hidden flex flex-col`.
- `StudioHeader.tsx` (visible on Catalog/Landing): compact mobile wrapping / overflow drawer so `scrollWidth <= clientWidth` at `390×844` (eliminating `+89px` spill).
- `PracticeArenaHeader.tsx` (`height === 48px`, `<= 4` grouped clusters):
  - Left: `<ArrowLeft />` + `Каталог` / `Шаг #N` (zero literal `"←"` prefix) + compact `Арены ▾` switcher popover + sole Challenge `<h1>` (`truncate`) + difficulty/category pill.
  - Center (`< md`): mobile switcher `Спека` | `Код`.
  - Right: live `Timer` (`00:00` ticked by 1s `visibilityState`-aware interval), `Focus Mode` (`>= md`), `Компас (Ctrl+/)`, dock/stealth slot hookpoint, `Score` badge.
- File Selection & Tab Strip (`practiceSlice.ts`, `WorkspaceHeaderBar.tsx`, `WorkspaceEditor.tsx`):
  - `openPracticeChallenge` uses `resolveInitialWorkspaceFileIndex(filesToUse)` unless valid `localDraft.activeWorkspaceFileIndex` is explicitly restored.
  - `setActivePracticePhase(2)` merges `phasedRequirements[0]?.addedFiles` via `mergePhaseFiles` and focuses the first newly added file. Fix `useWorkspaceRunner` missing `setPracticeWorkspaceFiles` dependency and remove unused `updateWorkspaceFileContent`.
  - `WorkspaceHeaderBar` separates file tabs (`.mask-fade-end` + explicit `Файлы (N) ▾` overflow popover switcher) from `В IntelliJ`, autosave status, `Ctrl+S` save feedback, and `Read-Only` indicator (moved out of CodeMirror viewport overlay). Remove duplicate `Compass` and `Reset` buttons from `WorkspaceHeaderBar`.
- `ChallengeSpecPanel.tsx` (owned strictly by T2 for zero conflict with parallel T4):
  - Remove duplicated Challenge title + category/difficulty pill (`PracticeArenaHeader` owns `<h1>`); align headings `h1 -> h2 -> h3` (fix `h2 -> h4` skip).
  - Apply `.spec-markdown`, normalize 4 scoring weights to strictly `100%` (remove hardcoded 5th `10%` line), replace hardcoded Strategy/Loom `defaultHints` with domain/challenge-derived hints, reset `activeTab`/`revealedHints` on `challenge.id` change, and invoke `setActivePracticePhase(2)` on manual `phase2` tab activation.

## Explicit Non-Goals
- Do NOT modify `WorkspaceFooterBar.tsx`, `astRules.ts`, `PracticeEvaluationModal.tsx`, `ReviewProgressConsole.tsx`, `TestingCompassRadar.tsx`, `GoldenMasterDiffViewer.tsx`, `MutationRadarWidget.tsx`, `MutantDiffInspector.tsx`, or `json/refactoring_challenges.json` (parallel Ticket T4).
- Do NOT implement the docked Co-Pilot panel, Stealth Mode UI, or `HintTiersDropdown` popover (downstream Ticket T3).
- Do NOT modify `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, SQLite DDL, or IntelliJ ports `:41789`/`:41790`.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] Entering any challenge yields `window.scrollY === 0`, `PracticeArenaHeader` height `48px`, `StudioHeader` suppressed, and `documentElement.scrollWidth === clientWidth` at `1440×900`, `1280×800`, and `390×844` (including `StudioHeader` on Catalog `390px`).
- [ ] Initial active tab focuses `isMainEntryPoint` (not read-only `RateLimiter.java`); `Read-Only` badge sits outside CodeMirror text overlay; `Файлы (N) ▾` lists all files cleanly.
- [ ] Manual click on Phase 2 tab hydrates `addedFiles` once without duplicating paths; Challenge `<h1>` appears once without heading-level skips or duplicated `←`; 4 spec weights total `100%`.
- [ ] Live timer increments cleanly and pauses when tab is hidden; `npm --prefix frontend run test:audio-contracts` & `verify-hygiene` pass on CI.
