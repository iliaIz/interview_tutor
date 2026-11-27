# 01: [Prefactor] Pure Workspace State Seams, WCAG AA Tokens & Shared Primitives

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent

## What to Build
Extract pure, unit-testable domain helpers, store dock/stealth state fields, reusable accessible primitives (`NativeModalDialog`, `WhiteboardPanelContent`), and calibrated WCAG 2.1 AA CSS/editor tokens ahead of UI wiring—keeping 100% of existing behavior and tests green.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/store/slices/practiceSlice.ts` (`resolveInitialWorkspaceFileIndex`, `mergePhaseFiles`)
  - `frontend/src/utils/astRules.ts` (`filterActiveAstViolations`)
  - `frontend/src/components/practice/evaluationReportBuilder.ts` (`resolveEvaluationPassStatus`)
  - `frontend/src/store/usePracticeTutorStore.ts` (`rightDockTab`, `isCopilotStealth`, `setRightDockTab`, `enterStealthMode`, `exitStealthMode`)
  - `frontend/tests/practiceWorkspaceState.test.ts`
- **Dependencies:** Pure TypeScript module state + Node `--test` / `tsx` (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on feature branch `feat/...`).

## Embedded Contract Slice & Invariants
- `resolveInitialWorkspaceFileIndex(files: FileNode[]): number`: returns index of `isMainEntryPoint`, else first `!readOnly` file, else `0`.
- `mergePhaseFiles(existing: FileNode[], added: FileNode[]): FileNode[]`: appends non-duplicate paths without mutating `existing`.
- `resolveEvaluationPassStatus(result)`: returns `true` strictly iff `isCompilable && failCount === 0 && !hasCarrierThreadPinning && !hasRaceConditions && score >= 70`.
- `usePracticeTutorStore`: `CopilotDockTab = 'tutor' | 'whiteboard'`; `enterStealthMode()` sets `{ isOpen: false, isCopilotStealth: true }` preserving voice connection/messages; `exitStealthMode(tab?)` restores `{ isCopilotStealth: false, isOpen: true }`.
- `NativeModalDialog` (`<= 350L`): native `<dialog>.showModal()`, `closedby="any"` + pointerdown/pointerup outside-backdrop click fallback, `overscroll-behavior: contain`, `aria-labelledby`, `Esc`.
- `WhiteboardPanelContent` (`<= 350L`): extracted headless/body component from `frontend/src/components/WhiteboardDrawer.tsx` so standalone `VoiceModal` and `TransactionLabArena` keep working unchanged.
- Palette tokens (`frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/components/practice/editorTheme.ts`): `accentRoseText: '#9B3B36'`, solid CTA fill `#B5433E`, dark comment/gutter `#8A99B0`, `.spec-markdown` prose classes.

## Explicit Non-Goals
- Do NOT wire layout changes into `App.tsx`, `PracticeArenaWorkspace.tsx`, `ChallengeSpecPanel.tsx`, or modals yet (reserved for Tickets 02–06).
- Do NOT touch `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, SQLite DDL, or IntelliJ WebSocket bridges (`:41789`/`:41790`).
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] `frontend/tests/practiceWorkspaceState.test.ts` covers `resolveInitialWorkspaceFileIndex`, `mergePhaseFiles`, `filterActiveAstViolations`, `resolveEvaluationPassStatus`, and `usePracticeTutorStore` Stealth transitions with 100% pass rate.
- [ ] `WhiteboardDrawer.tsx` consumes `WhiteboardPanelContent` with zero functional regressions in standalone callers (`VoiceModal`, `TransactionLabArena`).
- [ ] `NativeModalDialog` implements native `<dialog>.showModal()` with `Esc` and outside pointerdown/up dismissal.
- [ ] No visual regressions or broken imports; all existing tests and CI build remain green.
