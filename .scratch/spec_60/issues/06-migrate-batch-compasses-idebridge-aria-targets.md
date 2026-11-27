# 06: [Migrate-Batch] Spec 60 (T6): Compasses, IdeBridge, WAI-ARIA Tablists, `.cm-content` Label & 44px Targets

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Migrate-Batch  
**Blocked by:** #212, #215, #214  
**Status:** ready-for-agent

## What to Build
Switch all Compass callers (`PracticeCompassSheet`, `TransactionLabArena`) and `IdeBridgeModal` onto the unified `CompassDialogShell` / `NativeModalDialog` (`#211`, `#214`), eliminate native `alert()` in `useIdeBridge.ts`, add WAI-ARIA `tablist`/`tab`/`aria-selected` semantics, replace clickable `<div>` elements with `<button type="button">`, fix CodeMirror `.cm-content` `aria-input-field-name`, and enforce WCAG 2.5.8 target floor (`>= 24×24px` desktop, `>= 44×44px` on `@media (pointer: coarse)`) plus `@media (prefers-reduced-motion: reduce)`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/components/practice/compass/PracticeCompassSheet.tsx` + `frontend/src/components/practice/TransactionLabArena.tsx` (switch to `CompassDialogShell`)
  - `frontend/src/components/practice/compass/{Lld,Testing,Refactoring,Concurrency,Transaction}CompassSheet.tsx` (explicit close `aria-label` & unified `Esc`/props)
  - `frontend/src/components/practice/IdeBridgeModal.tsx` + `frontend/src/components/practice/useIdeBridge.ts`
  - `frontend/src/components/header/HealthStatusBadge.tsx`, `frontend/src/components/practice/SandboxTestConsole.tsx`, `frontend/src/components/practice/MutationRadarWidget.tsx`, `frontend/src/components/refactoring/RefactoringSmellChecklistPanel.tsx`
  - `frontend/src/components/practice/WorkspaceEditor.tsx`, `frontend/src/components/WhiteboardDrawer.tsx`, `frontend/src/index.css`
- **Dependencies:** Headless Chromium (`agent-browser`) + `axe-core` WCAG 2.1 A/AA sweep across `1440×900`, `1280×800`, and `390×844` (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- **Compass Migration:** Route `PracticeCompassSheet` and `TransactionLabArena` through `CompassDialogShell` (#214) so `Ctrl+/` and `Esc` function consistently across all 5 domains (`lld`, `testing`, `refactoring`, `concurrency`, `transaction`), and ensure every close `X` button across the 5 domain sheets carries an explicit accessible `aria-label`.
- **IDE Bridge Modal & Toast Notification (`IdeBridgeModal.tsx`, `useIdeBridge.ts`):**
  - Replace blocking native `alert()` on ZIP download failure in `useIdeBridge.ts` with `useAppStore.getState().showToast({ type: 'error', ... })`.
  - Migrate `IdeBridgeModal.tsx` onto `NativeModalDialog` (`<dialog>.showModal()`, `Esc`, `aria-labelledby`), add `aria-label` on close `X` (`critical: button-name`), use `#B5433E` fill + `#FFFFFF` text (`>= 4.5:1`) on ZIP CTA, and replace low-contrast `#64748b` over dark terminal background (`3.97:1`) with WCAG AA contrast (`#8A99B0` / `#94A3B8` >= 4.5:1).
- **WAI-ARIA Tablists & Semantic Buttons:**
  - Convert interactive tab bars (`PracticeArenaHeader` mobile switcher, `WorkspaceHeaderBar` file tabs, `ChallengeSpecPanel` phase tabs, Co-Pilot dock tabs, Compass tabs) to `role="tablist"`, `role="tab"`, `aria-selected`, and `role="tabpanel"`.
  - Replace clickable `<div>` elements in `HealthStatusBadge.tsx`, `SandboxTestConsole.tsx`, `MutationRadarWidget.tsx`, and `RefactoringSmellChecklistPanel.tsx` with native `<button type="button">`.
  - Add `EditorView.contentAttributes.of({ 'aria-label': ... })` inside `WorkspaceEditor.tsx` so `.cm-content` resolves all `serious: aria-input-field-name` `axe-core` errors.
- **Interactive Target Floor & Motion Safety:**
  - Increase hit targets of undersized buttons (`SandboxTestConsole` close `X`, `WhiteboardDrawer` collapse button `"Свернуть панель ➔"`) to `>= 24×24px` desktop (`pointer-events` / padding), and enforce `min-width: 44px; min-height: 44px` inside `@media (pointer: coarse)` across mobile tabs/buttons/icon controls.
  - Add `@media (prefers-reduced-motion: reduce)` CSS suppression in `frontend/src/index.css`.

## Explicit Non-Goals
- Do NOT delete legacy wrapper boilerplate from the 5 `*CompassSheet.tsx` files yet (reserved for clean final sweep in Contract Ticket T7).
- Do NOT alter IntelliJ Companion WebSocket ports `:41789`/`:41790` inside `IdeBridgeConnection.ts` / `useIdeBridge.ts` or `useWhiteboardIdeBridge.ts`.
- Do NOT touch `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, or SQLite DDL.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] `Ctrl+/` and `Esc` work across all 5 Compass domains; `"Обсудить с AI-напарником"` works on all 5 domains; zero `alert()` calls remain in `useIdeBridge.ts`.
- [ ] `axe-core` sweep across all primary workspace states + IdeBridge + Compasses reports `0` critical/serious violations (zero `button-name`, zero `aria-input-field-name`, zero clickable `<div>`s, zero WCAG AA contrast failures).
- [ ] On `390×844` (`pointer: coarse`), all interactive buttons/tabs measure `>= 44×44px` hit box; on desktop, `SandboxTestConsole` & `WhiteboardDrawer` controls meet `>= 24×24px`.
