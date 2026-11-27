---
target: PracticeArenaWorkspace
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 4
p1_count: 2
timestamp: 2026-11-27T04-19-17Z
slug: mponents-practice-arena-practicearenaworkspace-tsx
---
Method: dual-agent (A: 2220ca40-20d3-4b33-87a7-586e9660bc46 · B: 05da3d33-2b61-47c4-bccd-4995f9b1d4f2)

### Design Health Score (Nielsen's 10 Heuristics)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Dead 00:00 timer; false amber AST warning on clean code; Evaluation modal claims 2/2 passed alongside FAILED test & confetti; hardcoded 88% radar vs 75% live score; fake 100% match Golden Master Diff |
| 2 | Match System / Real World | 2 | Raw LaTeX `$\rightarrow$`, raw backticks in tutor bubbles, unstyled spec markdown (`@tailwindcss/typography` missing), `"1 брешей"`, `testBoundary()()`, mixed RU/EN copy |
| 3 | User Control and Freedom | 1 | Blocking `window.confirm()` on reset; `PracticeTutorDrawer` & `WhiteboardDrawer` cover header controls; `AmbientVoicePill` blocks footer CTAs on error; `PracticeEvaluationModal` & `IdeBridgeModal` ignore Esc |
| 4 | Consistency and Standards | 1 | 5 Compass sheets have divergent shells/shortcuts (`Ctrl+/` broken on 3/5); duplicate triggers for Compass/Reset/Back/IntelliJ; active `Bot` icon invisible (`#E08E89` on `#E08E89`) |
| 5 | Error Prevention | 1 | Opens on read-only `RateLimiter.java` (`practiceSlice.ts:108`); Rules of Hooks error in `PracticeEvaluationModal.tsx:35-77`; `AnimatePresence` key error in `WhiteboardDrawer.tsx:146`; stale spec tabs across challenges |
| 6 | Recognition Rather Than Recall | 2 | Editable files pushed off-screen (`scrollWidth 1019` in `459/265/162px`) with `no-scrollbar` & no overflow switcher; advertised `Ctrl+/` fails silently on LLD/Testing/Transactions |
| 7 | Flexibility and Efficiency | 2 | `Ctrl+Enter` works for sandbox/mutation, but no `Ctrl+S`, no file quick-picker, broken `Ctrl+/` on 3/5 domains, and missing Esc on modals |
| 8 | Aesthetic and Minimalist Design | 1 | 5 stacked chrome bars (223-261px); initial `scrollY=97` entry bug (`pb-24` + `overflow-x-hidden`); `StudioHeader` overlap at 1440/1280px & `+89px` overflow at 390px; nested scrollbars |
| 9 | Error Recovery | 2 | Pipeline retry/abort works, but `PracticeVoiceHUD` shows "Отключить" when disconnected and `AmbientVoicePill` stays trapped over primary CTAs on mic denial |
| 10 | Help and Documentation | 2 | Hardcoded Strategy/Loom hints appear on unit-test & refactoring katas; truncated smell strings (`"цикломат"`, `"тари"`); `HintTiersDropdown` clipped by `233px` |
| **Total** | | **15/40** | **Poor** |

### Technical Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1/4 | Zero `role="tablist"`/`role="tab"`/`aria-modal`/`aria-label`; critical `button-name` in Compass & IDE; 14-23 WCAG AA contrast failures (2.15:1-4.34:1); 0 `prefers-reduced-motion`; `<24px` buttons |
| 2 | Performance | 3/4 | Fast FCP (376ms), LCP (860ms), CLS 0.0; minor compositing drag from stacked `backdrop-blur-2xl` & perpetual animations |
| 3 | Responsive Design | 1/4 | `StudioHeader` overflows +89px at 390px; 28/28 mobile controls <44px; `HintTiersDropdown` clipped 233px; footer wraps to 95px at 1280px |
| 4 | Theming | 2/4 | Primary pastel tokens (`#E08E89`, `#BA5D57`, `#8B78E6`) fail AA contrast; ad-hoc dark hexes & violet gradients break cohesion |
| 5 | Implementation Integrity | 2/4 | Hooks-order error in `PracticeEvaluationModal`, `AnimatePresence` key error in `WhiteboardDrawer`, 15 true-positive CLI slop hits (14 false positives) |
| **Total** | | **9/20** | **Poor** |

### Design Specificity Verdict
- **LLM assessment**: Patchwork of 5 mismatched surfaces (academy header, light arena header, unstyled spec markdown, dark CodeMirror shell with neon gradients, 5 inconsistent Compass modals).
- **Deterministic scan**: 29 CLI findings (`frontend/src/components/practice`: 28, `WhiteboardDrawer.tsx`: 1, `StudioHeader.tsx`: 0) -> 15 true positives (`ai-color-palette`: 8, `bounce-easing`: 4, `side-tab`: 2, `gradient-text`: 1) and 14 `gray-on-color` false positives. Browser `/detect.js` flagged 50 anti-patterns (`low-contrast`: 16, `undersized-ui-text`: 10, `tiny-text`: 9, `clipped-overflow-container`: 4, `text-occlusion`: 1 on `TokenBucketStrategy.java`, etc.).

### Priority Issues
- **[P0] App Shell Scroll Bug (`scrollY=97`), Stacked Chrome (223-261px) & `StudioHeader` Collisions**: Fix root `App.tsx` containment (`pb-24` + `overflow-x-hidden` vs `-4rem`) and switch active workspaces to full-bleed IDE shell mode with responsive nav collapsing.
- **[P0] Clipped `HintTiersDropdown` (233px), Overlapping Fixed Drawers & Blocking `AmbientVoicePill`**: Use native `popover`/Portal for dropdowns, dock `AI-Напарник` & `Доска ИИ` into a unified right rail below header, and dock/dismiss `AmbientVoicePill` errors safely.
- **[P0] Dishonest System Status & Broken React Hook Order**: Fix `PracticeEvaluationModal` hooks & pass criteria, filter `astRules` `isViolation`, bind `TestingCompassRadar` & `GoldenMasterDiffViewer` to live state, normalize weights to 100%.
- **[P0] WCAG AA Contrast Failures (2.15:1-4.34:1), Missing ARIA Semantics & Mobile Touch Targets**: Recalibrate palette tokens, migrate tabs/dialogs/clickable divs to WAI-ARIA + native `<dialog>`/`<button>`, enforce 44px touch targets on coarse pointers.
- **[P1] Wrong Default File (`RateLimiter.java`) & Crushed Tab Strip**: Fix `practiceSlice.ts` `isMainEntryPoint` selection, separate file tabs from telemetry into a dedicated strip with overflow picker, move Read-Only badge out of code viewport.
- **[P1] Redundant Controls & Fragmented 5-Compass Architecture**: Consolidate into one `CompassDialogShell` with global `Ctrl+/` + `Esc` and remove duplicate triggers across headers/footers.
- **[P2] Broken Markdown, Leaked LaTeX/Copy, Dead Timer & Unmounted Phase 2 Files**: Enable typography prose & Markdown in tutor messages, flatten Mutation Radar scroll container, wire 1s visibility-aware timer and Phase 2 file mounting.

### Persona Red Flags
- **Alex (Power User)**: `Ctrl+/` fails on 3/5 domains; opens on read-only file; editable file tabs clipped off-screen; native `window.confirm()` on reset; no `Ctrl+S` or file quick-picker.
- **Jordan (First-Timer)**: Persistent amber warning on clean code; `110%` weights; `2/2 passed` alongside `FAILED` test + confetti; invisible hint dropdown; truncated smell copy.
- **Sam (A11y)**: 0 ARIA tablists/dialogs; critical `button-name` gaps; 2.15:1-4.34:1 contrast failures; clickable `<div>`s; invisible active `Bot` icon; missing `Esc` and `prefers-reduced-motion`.
- **Riley (Stress Tester)**: Hooks-order violation in `PracticeEvaluationModal`; stale spec tabs/drawers when switching challenges; fake matching Golden Master Diff.
- **Casey (Mobile 390px)**: `+89px` `StudioHeader` horizontal collision; 28/28 targets <44px; `Сброс` 30x22px; title crushed to 38px; `AmbientVoicePill` blocks primary CTA.
