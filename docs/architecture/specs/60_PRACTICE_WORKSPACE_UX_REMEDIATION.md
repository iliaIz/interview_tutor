# Spec 60: Unified Practice IDE Shell, Stealth Co-Pilot Dock & Truth-in-Telemetry Remediation

> **Governing Glossary:** `Unified Arena IDE Shell`, `Stealth Co-Pilot Mode`, `Truth-in-Telemetry Invariant`, `TutorTransportPort` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing Product & ADRs:** [PRODUCT.md](../../../PRODUCT.md) · [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md) · [ADR 0006](../../adr/0006-evaluation-memory-cascade-and-json-catalogs.md) · [Spec 18](18_WHITEBOARD_IDE_SYNCHRONIZATION_AND_BRANCHING_REVISIONS.md) · [Spec 58](58_TUTOR_ACTIVE_CONTEXT_AND_TRANSPORT_PORT.md)  
> **Domain Classification:** `Single-Tenant` Client Workspace UI · `Internal` · Zero Backend Schema Changes (`<= 350L` new / `<= 400L` modified)

---

## 1. Intent & Workload Envelope
Remediate systemic UX/UI, layout geometry, accessibility, and telemetry integrity defects identified in the baseline dual-agent critique (`.impeccable/critique/2026-11-27T04-19-17Z__mponents-practice-arena-practicearenaworkspace-tsx.md`) across `PracticeArenaWorkspace` and its internal tabs, drawers, modals, and toolbars:
1. **Shell Containment & Chrome Budget:** Collapse/hide global `StudioHeader` and root `pb-24` padding when an active Practice coding challenge is open, reclaiming vertical code area via a single `48px` (`<= 12%` viewport height) `Unified Arena IDE Shell` with `scrollY === 0` on entry across `1440×900`, `1280×800`, and `390×844`.
2. **Unified Right Co-Pilot Dock & Stealth Mode:** Merge `AI-Напарник` (`PracticeTutorDrawer`) and `Доска ИИ` (`WhiteboardDrawer`) inside Practice IDE into a single docked right pane below the `48px` header (mutually exclusive tabs `Напарник | Доска ИИ`, never occluding header or `WorkspaceFooterBar`). Add `Stealth Co-Pilot Mode` so after configuring/launching `AI-Напарник`, the user can visually hide all AI/voice UI while keeping the voice/text session running, restoring it via a compact status button in the `48px` arena bar (zero floating pills over editor/CTA).
3. **Top-Layer Popovers & Native `<dialog>` Modals:** Eliminate `HintTiersDropdown` clipping (`233px` trap inside `overflow-x-auto`), convert all Practice modals (`PracticeEvaluationModal`, `IdeBridgeModal`, `GoldenMasterDiffViewer`, unified `CompassDialogShell`, and workspace reset confirmation) to native `<dialog>.showModal()` with `Esc` and backdrop dismissal.
4. **Truth in Telemetry & React Hook Safety:** Fix Rules of Hooks crash in `PracticeEvaluationModal`, align `isPassed`/confetti and `passCount` math, eliminate false amber AST warnings on clean code (`astRules.ts`), bind `TestingCompassRadar` and `GoldenMasterDiffViewer` to live sandbox/mutation results, fix `110%` weight math, activate elapsed timer and Phase 2 file mounting, fix `isMainEntryPoint` default file focus, and clean `MutationRadarWidget` / `refactoring_challenges.json` copy.
5. **WCAG 2.1 AA Contrast, WAI-ARIA & Mobile Targets:** Recalibrate foreground/accent contrast (`>= 4.5:1`), add WAI-ARIA `tablist`/`tab`/`aria-selected`/`button` semantics, `>= 44×44px` coarse mobile touch targets, and `prefers-reduced-motion` support.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. Gemini Live audio DSP, Web Audio Worklets, or state machines in `frontend/src/audio/` and `backend/src/services/live/`.
2. Local IntelliJ Companion Bridge ports and WebSocket transport contracts (`:41789` in `useIdeBridge.ts` / `IdeBridgeConnection.ts`, `:41790` in `useWhiteboardIdeBridge.ts` / `Spec 18`).
3. SQLite DDL schemas (`coding_challenges`, `coding_submissions`) and backend evaluation pipeline gates (`ChallengeEvaluationPipeline.ts`).
4. Standalone `WhiteboardDrawer` behavior inside `VoiceModal` and `TransactionLabArena` (must remain functional via shared headless/body subcomponent reuse without duplication).
5. `AGENTS.md` CI/CD invariants (no local `tsc`/`docker build` on VPS; new files `<= 350L`, modified `<= 400L`).

---

## 3. Pre-Agreed Verification Seams
- **Pure Domain & State Seam (`frontend/tests/practiceWorkspaceState.test.ts`):**
  - `resolveInitialWorkspaceFileIndex(files)` (`practiceSlice.ts`)
  - `mergePhaseFiles(files, phasedReq)` (`practiceSlice.ts`)
  - `filterActiveAstViolations(items)` (`astRules.ts`)
  - `resolveEvaluationPassStatus(result)` & test denominator formatting (`evaluationReportBuilder.ts`)
  - `usePracticeTutorStore` (`rightDockTab`, `isCopilotStealth`, stealth-preserves-connection invariant)
  - Centralized Compass domain rule & shortcut keymap (`CompassDialogShell`)
- **UI/Browser & Accessibility Verification Seam:**
  - Headless Chromium (`agent-browser`) at `1440×900`, `1280×800`, `390×844`: `axe-core` WCAG 2.1 A/AA (`0` critical/serious violations), `detect.mjs`, `critique` re-run (`>= 30/40`), DOM height/overflow/clip telemetry.
- **Verification Commands (CI):**
  - `npm --prefix frontend run test:audio-contracts` (including `practiceWorkspaceState.test.ts`), `npm --prefix frontend run verify-hygiene`, `npm --prefix frontend run build` (via `remote-verify` on GitHub Actions).

---

## 4. Formal Wire, State & UI Component Contracts

### 4.1 Unified Arena IDE Shell (`App.tsx` + `StudioHeader.tsx` + `PracticeArenaWorkspace.tsx` + `PracticeArenaHeader.tsx`)
```typescript
export interface ArenaShellState {
  isPracticeIdeActive: boolean; // currentStudioTab === 'practice' && activePracticeChallenge !== null
  headerHeightPx: 48;           // Single top bar <= 12% viewport; StudioHeader suppressed
  hasOuterBottomPadding: false; // Removes pb-24 & overflow-x-hidden breaking sticky containment
}
```
- When `isPracticeIdeActive === true`, `App.tsx` omits `StudioHeader` and `pb-24`, resets `window.scrollTo(0, 0)` on IDE entry, and locks root shell to `h-dvh overflow-hidden flex flex-col`. When `StudioHeader` IS shown (Catalog / Landing), its mobile nav wraps/overflows inside a compact drawer with `<= 0px` horizontal spill at `390px`.
- `PracticeArenaHeader` consolidates all top-level navigation and triggers (`<= 4` grouped clusters):
  1. Left: Icon `<ArrowLeft />` + `Каталог` (or `Шаг #N`, zero duplicate literal `"←"`) + compact `Арены ▾` switcher popover + sole Challenge `<h1>` title (`truncate`) + difficulty/category pill (removed from `ChallengeSpecPanel` to reclaim `~92px` vertical chrome and fix `h1 -> h2 -> h3` heading hierarchy).
  2. Center (`< md`): `role="tablist"` mobile switcher (`Спека` | `Код`).
  3. Right: Live `Timer` (`00:00`, ticked by 1s visibility-aware interval), `Focus Mode` (`>= md`), `Компас (Ctrl+/)`, unified `Co-Pilot` dock trigger (`AI-Напарник | Доска ИИ`) / **Stealth Restore Pill**, and `Score` badge (`activePracticeReport`).

### 4.2 Unified Right Co-Pilot Dock & Stealth Mode (`usePracticeTutorStore.ts`)
```typescript
export type CopilotDockTab = 'tutor' | 'whiteboard';

export interface CopilotDockStateSlice {
  isOpen: boolean;              // Right dock expanded
  rightDockTab: CopilotDockTab; // 'tutor' | 'whiteboard'
  isCopilotStealth: boolean;    // True = visually hide dock + AmbientVoicePill while session stays connected
  setRightDockTab: (tab: CopilotDockTab) => void;
  enterStealthMode: () => void; // Sets isOpen: false, isCopilotStealth: true
  exitStealthMode: (tab?: CopilotDockTab) => void; // Sets isCopilotStealth: false, isOpen: true
}
```
- **Docked Layout Contract:** On `>= lg`, the right dock mounts as an `<aside>` flex/grid sibling inside `PracticeArenaWorkspace` *below* `PracticeArenaHeader`, resizing `WorkspaceEditor` cleanly without covering header buttons or `WorkspaceFooterBar`. On `< lg`, it mounts via `<dialog>` / `navigation-drawer` sheet (`max-h-dvh`, swipe/Esc dismissible).
- **Shared Whiteboard Body Reuse:** Extract `WhiteboardPanelContent` from `WhiteboardDrawer.tsx` so both standalone `WhiteboardDrawer` (used in `VoiceModal` / `TransactionLabArena`) and the Practice Co-Pilot Dock render one single code artifact timeline/checkout implementation (zero duplication).
- **Stealth Co-Pilot Contract:**
  - Once `isConnected || isError || messages.length > 1` in `AI-Напарник`, the dock header exposes `Скрыть (тихий режим)`.
  - Clicking it dispatches `enterStealthMode()`, hiding visual panels via non-destructive CSS/state visibility (preserving `inputVal`, message scroll, and active voice stream) and suppressing `AmbientVoicePill` whenever `isPracticeIdeActive === true`.
  - When `isCopilotStealth && (isConnected || isError)`, `PracticeArenaHeader` renders a single compact `48px`-aligned button (`AI в эфире` / `Ошибка связи` with pulse/color state dot + click to restore `exitStealthMode('tutor')`). Zero floating overlays sit over CodeMirror or `WorkspaceFooterBar`. In non-IDE arenas (`TransactionLabArena`), `AmbientVoicePill` exposes an explicit dismiss `X` button on error.
  - Fix `PracticeTutorDrawer` domain header title (display resolved `domain` label instead of generic `"AI-Напарник (Co-Pilot)"`), keep `HintTiersDropdown` visible for Practice domains even when `activeContext` is populated, remove duplicate `Компас (Ctrl+/)` chip from `TutorQuickActionChips.tsx`, fix `PracticeVoiceHUD` disconnected `"Отключить"` button + `userGender` fallback, and resolve `<AnimatePresence>` duplicate key warnings in `WhiteboardDrawer.tsx`.

### 4.3 Default File, Tab Strip & Phase 2 Hydration (`practiceSlice.ts` + `WorkspaceHeaderBar.tsx`)
```typescript
export function resolveInitialWorkspaceFileIndex(files: FileNode[]): number {
  const mainIdx = files.findIndex((f) => f.isMainEntryPoint);
  if (mainIdx >= 0) return mainIdx;
  const editableIdx = files.findIndex((f) => !f.readOnly);
  return editableIdx >= 0 ? editableIdx : 0;
}

export function mergePhaseFiles(existing: FileNode[], added: FileNode[]): FileNode[] {
  const existingPaths = new Set(existing.map((f) => f.path));
  const newEntries = added.filter((f) => !existingPaths.has(f.path)).map((f) => ({ ...f }));
  return [...existing, ...newEntries];
}
```
- `openPracticeChallenge` only preserves `localDraft.activeWorkspaceFileIndex` if explicitly saved and valid; otherwise uses `resolveInitialWorkspaceFileIndex(filesToUse)`.
- `setActivePracticePhase(2)` merges `phasedRequirements[0]?.addedFiles` via `mergePhaseFiles` and focuses the first newly added file.
- `WorkspaceHeaderBar` isolates file tabs (`role="tablist"`, `.mask-fade-end`, explicit `Файлы (N) ▾` overflow popover switcher) from `В IntelliJ`, autosave status, and `Read-Only` indicator (moved out of CodeMirror text overlay into the tab strip/header). Remove duplicate `Compass` and `Reset` buttons from `WorkspaceHeaderBar` (kept once in `PracticeArenaHeader` and `WorkspaceFooterBar` with native `<dialog>` reset confirmation).

### 4.4 Top-Layer Popovers, Native `<dialog>` & Unified `CompassDialogShell`
- `HintTiersDropdown`: migrate dropdown menu out of `overflow-x-auto` to native `popover="auto"` + `position-area: block-end` (fallback `CreatePortal` / viewport clamp).
- `PracticeEvaluationModal`, `IdeBridgeModal`, `GoldenMasterDiffViewer`, Reset Confirm, and `CompassDialogShell`: use native `<dialog>` + `showModal()`, `overscroll-behavior: contain`, `closedby="any"` (with outside pointerdown/up fallback), `aria-labelledby`, `Esc` close, and accessible `aria-label` on close `X` buttons (`IdeBridgeModal` and all Compass sheets). Replace native `alert()` in `useIdeBridge.ts` ZIP error handling with `showToast()`.
- Consolidate `LldCompassSheet`, `TestingCompassSheet`, `RefactoringCompassSheet`, `ConcurrencyCompassSheet`, `TransactionCompassSheet` behind one `CompassDialogShell` with centralized `Ctrl+/` toggle in `PracticeArenaWorkspace`, unified `"Обсудить с AI-напарником"` grounding action across all 5 domains, and elimination of nested-card framing, AI-slop glow gradients, and bounce easings.

### 4.5 Truth-in-Telemetry, Copy & WCAG 2.1 AA Tokens
- `astRules.ts` (`evaluateAstRules`): return `[]` when zero rules trigger (or export `filterActiveAstViolations` used by `WorkspaceFooterBar` so clean code renders calm green `"0 нарушений AST"`, never amber `<AlertTriangle />`).
- `PracticeEvaluationModal.tsx` & `ReviewProgressConsole.tsx`: hoist `useMemo` and `useEffect` above early `return null`; compute `isPassed = isCompilable && failCount === 0 && !hasCarrierThreadPinning && !hasRaceConditions && score >= 70`; render `passCount / (passCount + failCount)`; trigger confetti strictly when `isPassed`. Expose all **5** review gates (including `mutation`) in `ReviewProgressConsole.tsx` so headless progress matches UI telemetry.
- `TestingCompassRadar.tsx`, `GoldenMasterDiffViewer.tsx` & `useWorkspaceRunner.ts`: read live `latestMutationResult` / `latestSandboxResult` from `useAppStore`; display explicit unexecuted prompt before first run instead of hardcoded `88%` or mirrored baseline lines; render responsive `grid-cols-1 md:grid-cols-2` diffs; include `setPracticeWorkspaceFiles` in `useWorkspaceRunner` dependencies and remove unused `updateWorkspaceFileContent`.
- `ChallengeSpecPanel.tsx` & `TutorMessageList.tsx`: add `.spec-markdown` prose styles in `index.css`, render tutor bubbles via `ReactMarkdown` + `remark-gfm`, drop duplicated title/badge (`PracticeArenaHeader` owns `<h1>`) and align headings (`h1 -> h2 -> h3`), normalize 4 scoring weights to strictly `100%` (remove hardcoded 5th `10%` line), replace generic `defaultHints` with domain/challenge-derived hints, reset `activeTab`/`revealedHints` on `challenge.id` change, and mount phase files on manual `activeTab === 'phase2'` switch.
- `MutationRadarWidget.tsx` & `MutantDiffInspector.tsx`: replace `$\rightarrow$`, remove duplicate `✓`, fix Russian pluralization (`1 брешь` / `2–4 бреши` / `5+ брешей`), strip duplicate `()` around `killedBy` in both components, and flatten nested `max-h` scrollbars.
- `tailwind.config.js`, `editorTheme.ts` & Interactive Controls: calibrate `accentRoseText` (`#9B3B36`), solid CTA fill (`#B5433E` including `IdeBridgeModal` ZIP button), dark comment/gutter (`#8A99B0`) and IDE log contrast, and active `<Bot>` icon (`text-current`); replace clickable `<div>`s with `<button type="button">`; configure `EditorView.contentAttributes.of({ 'aria-label': ... })` on CodeMirror `.cm-content` (`aria-input-field-name`); enforce `>= 24×24px` (`44×44px` on `@media (pointer: coarse)`) hit targets on `SandboxTestConsole` close and `WhiteboardDrawer` collapse controls; honor `@media (prefers-reduced-motion: reduce)`.

---

## 5. Storage & Zero-Downtime Migration Contract
- **SQLite DDL:** Zero schema changes.
- **Catalog Data Repair (`json/refactoring_challenges.json`):** Audit & repair all **32** refactoring challenges: restore complete Russian sentences for all **61** truncated/duplicated `smellsChecklist` items (e.g., `L0-REF-01` `"цикломат"`, `"тари"`, duplicate `"Cryptic Naming & Long Parameter List"`) and fix **2** Devanagari/encoding Unicode glitches (e.g., `ग्राहकского профиля` in `L1-REF-02`).
- **Client Store Compatibility:** `usePracticeTutorStore` adds `rightDockTab = 'tutor'` and `isCopilotStealth = false` in memory; `practiceSlice` keeps `openPracticeChallenge` / `localDraft` payload formats 100% backwards-compatible.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1 IDE Shell Entry & Responsive Containment
- `{P}` User opens any challenge in `PracticeCatalog` at `1440×900`, `1280×800`, or `390×844`.
- `{C}` `App.tsx` renders `Unified Arena IDE Shell` (`h-dvh overflow-hidden`, `StudioHeader` hidden, `PracticeArenaHeader` height `48px`).
- `{Q}` `window.scrollY === 0`, `documentElement.scrollWidth === clientWidth`, `headerRect.height === 48`, all interactive buttons meet target-size floor (`>= 24×24px` desktop, `>= 44×44px` mobile coarse).

### 6.2 Co-Pilot Dock, Popover Escape & Stealth Mode
- `{P}` Active Practice challenge with running `AI-Напарник` text/voice session (`isConnected === true`).
- `{C}` User clicks `Скрыть (тихий режим)` -> `enterStealthMode()`, then later clicks Stealth Restore Pill in `PracticeArenaHeader`.
- `{Q}` During stealth mode, right dock & `AmbientVoicePill` do not render, `PracticeVoiceProvider` keeps `isConnected === true` with zero socket drops, `WorkspaceFooterBar` & `CodeMirror` are 100% unobstructed; clicking Restore reopens the dock preserving full message/voice history. Clicking `Подсказка` renders all 5 tiers unclipped in the top layer.

### 6.3 Truth-in-Telemetry & Hook Safety
- `{P}` Workspace contains valid clean Java code, OR evaluation completes with `failCount > 0`.
- `{C}` `evaluateAstRules` runs on edits; `PracticeEvaluationModal` opens on completion; `TestingCompassRadar` / `GoldenMasterDiffViewer` render.
- `{Q}` Clean code displays zero warning triangles; `PracticeEvaluationModal` executes hooks unconditionally above guard returns with zero React errors; `failCount > 0` blocks confetti and pass banner; pre-run Radar/Golden Master explicitly indicate unexecuted state.

### 6.4 Default File Focus & Unified Compass Shortcut
- `{P}` Challenge manifest contains read-only interface at index `0` and `isMainEntryPoint: true` at index `2`, plus `phasedRequirements`.
- `{C}` User opens challenge, presses `Ctrl+/`, presses `Esc`, and activates Phase 2.
- `{Q}` Editor focuses index `2` initially; `Ctrl+/` toggles unified `CompassDialogShell` across all 5 domains; `Esc` closes dialog cleanly; Phase 2 appends `addedFiles` once without duplicating paths.
