# 04: [Tracer-Bullet] Spec 60 (T4): Truth-in-Telemetry, 5th Mutation Gate, Hooks Safety & 32-Task Refactoring JSON

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Tracer-Bullet  
**Blocked by:** #211  
**Status:** ready-for-agent

## What to Build
Eliminate dishonest/misleading UI telemetry, Rules of Hooks crash in `PracticeEvaluationModal`, blocking `window.confirm()` on Reset, missing 5th `mutation` gate card in `ReviewProgressConsole`, fabricated `88%`/`100%` Compass/Diff placeholders, broken copy (`$\rightarrow$`, `✓✓`, `1 брешей`, double `()`), and all **61 truncated/duplicated `smellsChecklist` items + 2 Unicode glitches** across all **32 challenges** in `json/refactoring_challenges.json`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/utils/astRules.ts` + `frontend/src/components/practice/WorkspaceFooterBar.tsx`
  - `frontend/src/components/practice/PracticeEvaluationModal.tsx` + `ReviewProgressConsole.tsx`
  - `frontend/src/components/practice/compass/TestingCompassRadar.tsx` + `frontend/src/components/practice/GoldenMasterDiffViewer.tsx`
  - `frontend/src/components/practice/MutationRadarWidget.tsx` + `frontend/src/components/practice/MutantDiffInspector.tsx`
  - `json/refactoring_challenges.json` (audit & repair all 32 refactoring challenges)
- **Dependencies:** Pure store state + catalog JSON validation + headless browser check (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- **Clean AST Status & Reset Confirm (`astRules.ts`, `WorkspaceFooterBar.tsx`):**
  - Clean Java returns `[]` from `filterActiveAstViolations(evaluateAstRules(...))`; `WorkspaceFooterBar` renders calm green `"0 нарушений AST"`, never amber `<AlertTriangle />`.
  - Replace `window.confirm()` on Reset with `NativeModalDialog` (`<dialog>.showModal()`, `Esc`, backdrop close).
- **Hooks Safety & 5-Gate Telemetry (`PracticeEvaluationModal.tsx`, `ReviewProgressConsole.tsx`):**
  - Hoist all `useMemo` and `useEffect` hooks above early `if (!isOpen || !report) return null`.
  - Wrap `PracticeEvaluationModal` in `NativeModalDialog` (`Esc`, outside close, `aria-labelledby`).
  - Use `resolveEvaluationPassStatus` (`isCompilable && failCount === 0 && !hasCarrierThreadPinning && !hasRaceConditions && score >= 70`), render `passCount / (passCount + failCount)`, and trigger confetti strictly when `isPassed === true`.
  - Add the missing **5th `mutation` gate card** to `ReviewProgressConsole.tsx` matching `useEvaluationPipeline`'s `stepperState.mutation`.
- **Live Testing/Golden Master Telemetry (`TestingCompassRadar.tsx`, `GoldenMasterDiffViewer.tsx`):**
  - Read live `latestMutationResult` and `latestSandboxResult` from `useAppStore`; display explicit unexecuted prompt before first run (never hardcoded `88%` or fake matching diff lines).
  - Wrap `GoldenMasterDiffViewer` in `NativeModalDialog` (`Esc`) and render responsive `grid-cols-1 md:grid-cols-2` panes on mobile (`390px`).
- **Mutation Copy & Flat Scroll (`MutationRadarWidget.tsx`, `MutantDiffInspector.tsx`):**
  - Replace `$\rightarrow$` with `→`, remove duplicate `✓`, fix Russian pluralization (`1 брешь` / `2–4 бреши` / `5+ брешей`), strip duplicate `()` around `killedBy` in **both** `MutationRadarWidget.tsx` and `MutantDiffInspector.tsx`, and flatten nested `max-h` scroll containers.
- **Full Catalog Repair (`refactoring_challenges.json`):**
  - Audit & repair all **32 challenges** (`L0-REF-01` .. `L3-REF-*`): restore complete Russian sentences for all **61** truncated/duplicated `smellsChecklist` items (including `"цикломат"`, `"тари"`, duplicate `"Cryptic Naming & Long Parameter List"`) and fix **2** corrupted Devanagari/encoding sequences (including `"ग्राहकского профиля"` in `L1-REF-02`).

## Explicit Non-Goals
- Must stay 100% file-disjoint with parallel Ticket T2: do NOT modify `App.tsx`, `StudioHeader.tsx`, `PracticeArenaHeader.tsx`, `PracticeArenaWorkspace.tsx`, `WorkspaceHeaderBar.tsx`, `ChallengeSpecPanel.tsx`, `practiceSlice.ts`, or `useWorkspaceRunner.ts`.
- Do NOT modify `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, SQLite DDL, or IntelliJ ports `:41789`/`:41790`.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] Opening & closing `PracticeEvaluationModal` across failed/passed reports triggers zero React Rules-of-Hooks console errors; `failCount > 0` suppresses confetti & pass badge and displays accurate `passCount / totalTests`.
- [ ] `ReviewProgressConsole` displays all **5** pipeline stages including `mutation`; clean workspace renders zero amber AST triangles; Reset uses `<dialog>`.
- [ ] Zero raw `$\rightarrow$`, zero `✓✓`, zero `()()` in `MutationRadarWidget` / `MutantDiffInspector`, accurate Russian pluralization, and pre-run prompt in `TestingCompassRadar` / `GoldenMasterDiffViewer`.
- [ ] Automated JSON scan of `refactoring_challenges.json` confirms `0` truncated/duplicate `smellsChecklist` items and `0` non-Cyrillic/Latin encoding glitches across all 32 tasks.
