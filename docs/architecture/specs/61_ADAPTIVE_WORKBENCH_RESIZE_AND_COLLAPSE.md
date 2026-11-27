# Spec 61: Adaptive Workbench Grid, Spatial Spec Rail & Mode-Coupled Expandable Whiteboard

> **Governing Glossary:** `Adaptive Workbench Grid`, `Mode-Coupled Dock Memory`, `Spatial Spec Rail`, `Unified Arena IDE Shell` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing Architecture & Specs:** [PRODUCT.md](../../../PRODUCT.md) · [Spec 18](18_WHITEBOARD_IDE_SYNCHRONIZATION_AND_BRANCHING_REVISIONS.md) · [Spec 60](60_PRACTICE_WORKSPACE_UX_REMEDIATION.md)  
> **Domain Classification:** `Single-Tenant` Client Workspace UI · `Internal` · Zero Backend Schema Changes (`<= 350L` new / `<= 400L` modified)

---

## 1. Intent & Workload Envelope
Eliminate three-column spatial starvation inside `PracticeArenaWorkspace` (`Spec | Editor | Co-Pilot`) where `Доска ИИ` is cramped to `~300px` of code width, expanding it crushes `WorkspaceEditor`, and Left Spec collapse lives isolated in a distant top-right `Focus Mode` button:
1. **CSS Grid + Accessible Pointer/Keyboard Resizers (`>= 1024px`):** Replace rigid flex percentage/pixel widths with a single `Adaptive Workbench Grid` (`grid-template-columns`) controlled via `--spec-w` and `--copilot-w` CSS variables (`0` per-pixel React re-renders during drag via `requestAnimationFrame`).
2. **Spatial Left Spec Collapse (`Spatial Spec Rail`):** Unify header `Focus Mode` and an inline Spec panel collapse chevron (`PanelLeftClose` / `Ctrl+B`) onto a single `isSpecCollapsed` state. When collapsed, render a clickable `32px` vertical left rail (`Спецификация`) instead of disappearing completely.
3. **Mode-Coupled Width & Expandable `Доска ИИ` (`Mode-Coupled Dock Memory`):** Maintain separate widths for conversational chat (`Напарник`: `380px` default) vs wide code/diff/architecture boards (`Доска ИИ`: `520px` default, plus 1-click `Широкая доска` expand toggle to `50%` width clamped to `<= 65vw`). Automatically collapse Left Spec when widening `Доска ИИ` would push `WorkspaceEditor` below `420px`.
4. **Whiteboard Dock De-Chroming:** Remove redundant `"Свернуть панель"` footer and duplicate inner `CodeViewer` header chrome when `WhiteboardPanelContent` renders inside `mode="dock"` (and do NOT add redundant collapse arrows to the right pane).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from**:
1. Introducing a separate boolean (`isFocusMode`) alongside `isSpecCollapsed` — both triggers (`ChallengeSpecPanel` chevron + `PracticeArenaHeader` Focus toggle + `Ctrl+B`) MUST mutate the exact same state.
2. Adding an extra side collapse arrow button on the right pane edge (right dock already has Header tab toggle, Dock `×`, and `Stealth` hide — avoid 4th redundant close button).
3. Reverting `PracticeCopilotDock`'s exclusive viewport gating (`useIsDesktopLg()`), modifying `frontend/src/audio/`, `backend/`, SQLite DDL, IntelliJ bridges (`:41789`/`:41790`), or standalone `WhiteboardDrawer` inside `VoiceModal` and `TransactionLabArena`.
4. Using `overflow: hidden` or nested double card headers to fake compact panels, or triggering React state updates on every `pointermove` tick (`must` batch live DOM CSS variable updates in `requestAnimationFrame` and commit state only on `pointerup` / keyboard step).

---

## 3. Pre-Agreed Verification Seams
- **Pure Layout Kernel Seam (`frontend/src/components/practice/arena/workbenchLayoutKernel.ts` + `frontend/tests/workbenchLayoutKernel.test.ts`):**
  - `computeWorkbenchGridTracks(input)`: resolves clamped track widths (`--spec-w`, `--copilot-w`), checks `shouldAutoCollapseSpec` when `editorRemaining < MIN_EDITOR_WIDTH_PX` (`420px`), and outputs exact CSS `grid-template-columns` string.
  - `resolveCopilotTargetWidth(params)`: resolves active dock width by `rightDockTab` (`'tutor'` vs `'whiteboard'`), `isWhiteboardExpanded`, clamped custom widths, and viewport width.
  - `stepSeparatorWidth(currentPx, key, shiftKey, minPx, maxPx)`: deterministic keyboard resize step (`16px` / `48px` with `Shift`, `Home` -> `minPx`, `End` -> `maxPx`).
- **Browser & Visual Verification Seam:**
  - Headless Chromium (`agent-browser`) across `1440×900`, `1280×800`, `1024×768`, and `390×844` (`< 1024px` preserves native `<dialog>` Co-Pilot sheet cleanly): verify Left Spec chevron collapse -> `32px` vertical rail restore -> Focus Mode sync, `Доска ИИ` expand -> auto-collapse Spec + >= 50% readable diff width -> switch to `Напарник` restoring compact chat width, and drag/keyboard resize on `role="separator"`.
- **Verification Commands (CI):**
  - `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build`.

---

## 4. Formal Component, Grid & Store Contracts

### 4.1 Layout Constants & Pure Kernel (`workbenchLayoutKernel.ts`, `<= 350L`)
```typescript
export const WORKBENCH_BOUNDS = {
  MIN_SPEC_WIDTH_PX: 260,
  DEFAULT_SPEC_WIDTH_PX: 390,
  MAX_SPEC_WIDTH_PX: 540,
  SPEC_RAIL_PX: 32,
  MIN_EDITOR_WIDTH_PX: 420,      // Auto-collapse Spec threshold when Dock widens
  HARD_MIN_EDITOR_WIDTH_PX: 360, // Hard drag floor so CodeMirror never breaks
  MIN_COPILOT_WIDTH_PX: 320,
  DEFAULT_TUTOR_WIDTH_PX: 380,
  MAX_TUTOR_WIDTH_PX: 560,
  DEFAULT_WHITEBOARD_WIDTH_PX: 520,
  MAX_COPILOT_VIEWPORT_RATIO: 0.65,
  SASH_WIDTH_PX: 6
} as const;

export interface WorkbenchGridInput {
  viewportWidth: number;
  isSpecCollapsed: boolean;
  isDockVisible: boolean;
  rightDockTab: 'tutor' | 'whiteboard';
  isWhiteboardExpanded: boolean;
  specWidthPx: number;
  tutorWidthPx: number;
  whiteboardWidthPx: number;
}
```
- **Track Formula (`>= 1024px`):**
  - Spec track = `isSpecCollapsed ? 32px : clamp(specWidthPx, 260, 540)` + optional `6px` drag sash when expanded.
  - Co-Pilot track = `0px` when hidden; otherwise `resolveCopilotTargetWidth(...)` + `6px` left drag sash.
  - Center Editor track = `minmax(360px, 1fr)`.
  - If user activates `Доска ИИ` expand OR drags Co-Pilot wide enough that `viewportWidth - specWidthPx - copilotWidthPx < 420`, Spec **automatically collapses** (`SPEC_RAIL_PX`) with reversible click on the left rail or `Ctrl+B` (manual re-expand of Spec proportionally trims `copilotWidthPx` down to stay `>= 360px` Editor).

### 4.2 Unified Collapse & Dock Width Store Extensions (`usePracticeTutorStore.ts`)
```typescript
export interface WorkbenchDockStateSlice {
  isSpecCollapsed: boolean;
  isWhiteboardExpanded: boolean;
  specWidthPx: number;
  tutorWidthPx: number;
  whiteboardWidthPx: number;
  setSpecCollapsed: (collapsed?: boolean) => void;
  toggleWhiteboardExpanded: (expanded?: boolean) => void;
  setPanelWidth: (panel: 'spec' | 'tutor' | 'whiteboard', px: number) => void;
}
```
- Selecting `rightDockTab === 'whiteboard'` keeps `isWhiteboardExpanded` independent of `'tutor'`; switching back to `'tutor'` immediately renders narrow `tutorWidthPx` (`380px` default), eliminating wide overly-stretched chat bubbles.

### 4.3 Accessible Drag Splitter (`WorkbenchDragSplitter.tsx`, `<= 150L`) & Spatial Controls
- `WorkbenchDragSplitter`: `role="separator"`, `aria-orientation="vertical"`, `tabIndex={0}`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`, `touch-action: none`. On `pointerdown`, captures pointer (`setPointerCapture`), updates `--spec-w` / `--copilot-w` CSS custom properties via `requestAnimationFrame` on container ref, and commits `setPanelWidth(...)` once on `pointerup` or `Escape` cancel. Keyboard `ArrowLeft`/`ArrowRight` (16px, 48px with `Shift`), `Home`, `End` update immediately.
- **Left Spec Collapse (`ChallengeSpecPanel.tsx` + `PracticeArenaWorkspace.tsx`):**
  - Inline chevron button (`PanelLeftClose`) inside `ChallengeSpecPanel` top strip (`aria-label="Свернуть панель спецификации (Ctrl+B)"`, `aria-expanded={!isSpecCollapsed}`).
  - When `isSpecCollapsed === true` on `>= md`: renders a vertical `32px` rail button on the left edge (`writing-mode: vertical-rl` rotated `180deg` or crisp vertical `PanelLeftOpen` + `"Спецификация"`) that restores `setSpecCollapsed(false)`.
  - `PracticeArenaHeader` `"Focus Mode"` toggles the exact same `setSpecCollapsed()` state (`aria-pressed={isSpecCollapsed}`).
- **Right Whiteboard Header (`PracticeCopilotDock.tsx` + `WhiteboardPanelContent.tsx` + `CodeViewer.tsx`):**
  - When `rightDockTab === 'whiteboard'` on desktop `>= lg`, Dock header exposes `Maximize2` / `Minimize2` (`"Широкая доска"` / `"Обычная ширина"`, `aria-pressed={isWhiteboardExpanded}`).
  - In `WhiteboardPanelContent` `mode="dock"`: omit duplicate bottom `"Свернуть панель"` footer bar (close `×` lives once in Dock header) and pass `compactHeader={mode === 'dock'}` to `CodeViewer` / `CodeArtifactTimeline` to collapse redundant macOS dots chrome into a compact toolbar strip.

---

## 5. Storage & Zero-Downtime Migration Contract
- **SQLite DDL:** Zero schema changes.
- **Client Persistence (`localStorage` optional UI prefs):** Guard `localStorage` access with `typeof window !== 'undefined'` for Node SSR/contract test safety; fall back cleanly to `WORKBENCH_BOUNDS` defaults on missing/corrupt values.
- **Backwards Compatibility:** `< 1024px` viewports keep Spec/Code mobile tabs and `<NativeModalDialog>` Co-Pilot sheet completely untouched; standalone `WhiteboardDrawer` (`VoiceModal`, `TransactionLabArena`) keeps `mode="drawer"` unchanged.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1 Unified Spatial Spec Rail & Focus Mode Symmetry
- `{P}` Active desktop Practice IDE workspace (`>= md`), `isSpecCollapsed === false`.
- `{C}` User clicks left panel inline collapse arrow (`PanelLeftClose`) OR `PracticeArenaHeader` `Focus Mode` OR presses `Ctrl+B`.
- `{Q}` `isSpecCollapsed` transitions to `true`; Spec pane collapses cleanly to `32px` vertical left rail; `Focus Mode` header button displays active state; clicking left rail restores Spec to stored `specWidthPx` (`390px` default).

### 6.2 Mode-Coupled Width & Auto-Collapse Whiteboard Expansion
- `{P}` Desktop Practice IDE at `1280×800` or `1440×900` with `Spec` (`390px`), `Editor`, and `Доска ИИ` (`520px`) open.
- `{C}` User clicks `"Широкая доска"` (`toggleWhiteboardExpanded(true)`).
- `{Q}` `Доска ИИ` expands to `max(520px, 50% viewport)` (clamped `<= 65%`); because remaining Editor width would fall below `420px`, Left Spec auto-collapses into its `32px` vertical left rail so `WorkspaceEditor` retains `>= 420px`; switching tab back to `Напарник` restores `tutorWidthPx` (`~380px`).

### 6.3 Smooth Drag Splitter & Keyboard Resize Invariant
- `{P}` Desktop Practice IDE (`>= lg`) with expanded Left Spec or Right Co-Pilot dock.
- `{C}` User drags `WorkbenchDragSplitter` via pointer or presses `ArrowLeft`/`ArrowRight` on focused separator.
- `{Q}` Live column sizing tracks pointer smoothly via CSS custom property inside clamped `[minPx, maxPx]` without React drag-loop jitter or `WorkspaceEditor` shrinking below `360px`, persisting final width once on `pointerup` / keypress.
