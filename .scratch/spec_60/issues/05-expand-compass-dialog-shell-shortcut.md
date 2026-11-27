# 05: [Expand] Spec 60 (T5): Clean Dual-Mode `CompassDialogShell` & Unified `Ctrl+/` Shortcut Registry

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Expand  
**Blocked by:** #211, #213  
**Status:** ready-for-agent

## What to Build
Create the unified, declarative `CompassDialogShell` (`<= 350L`) on top of `NativeModalDialog` (`<dialog>.showModal()`) and centralize the `Ctrl+/` keyboard registry inside `PracticeArenaWorkspace` **alongside** legacy `*CompassSheet.tsx` files (strict Expand phase: existing callers stay intact until Ticket T6 migrates them). Eliminate the nested-card framing, AI-slop gradients, and `bounce` easings (`15` true-positive CLI findings) inside the unified shell.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/components/practice/compass/CompassDialogShell.tsx` (new, `<= 350L`)
  - `frontend/src/components/practice/arena/PracticeArenaWorkspace.tsx` (centralized `Ctrl+/` toggle handler)
  - `frontend/tests/practiceWorkspaceState.test.ts` (Compass domain registry & shortcut mapping tests)
- **Dependencies:** Pure domain registry tests + Headless Chromium / `detect.mjs` (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- **5-Domain Registry:** Maps `lld`, `testing`, `refactoring`, `concurrency`, and `transaction` cleanly via a single declarative configuration (`title`, `accentToken`, `bodyRenderer`, `copilotGroundingPrompt`).
- **Unified Native Modal Shell:** Built on `NativeModalDialog` (`<dialog>.showModal()`, `overscroll-behavior: contain`, `closedby="any"`, `aria-labelledby`, explicit close `<button aria-label="Закрыть шпаргалку">`, `Esc` dismissal).
- **Unified AI-Напарник Grounding:** Exposes `"Обсудить с AI-напарником"` CTA uniformly across all 5 domains (including Transactions, where it was previously missing), pre-filling or focusing the active dock (`exitStealthMode('tutor')`).
- **Centralized `Ctrl+/` Registry:** `PracticeArenaWorkspace` owns a single keydown listener for `Ctrl+/` (preventing dead/broken shortcuts on LLD, Testing, and Transactions); old duplicate window key listeners stay isolated cleanly until removed in T6/T7.
- **Anti-Slop Structural Design:** Flat editorial surface hierarchy (`1–2` tiers max, zero nested inner cards with triple borders, zero `ai-color-palette` neon purple gradients, zero `bounce` easings, full `@media (prefers-reduced-motion: reduce)` respect).

## Explicit Non-Goals
- Do NOT remove or rewrite legacy modal wrappers in `LldCompassSheet.tsx`, `TestingCompassSheet.tsx`, `RefactoringCompassSheet.tsx`, `ConcurrencyCompassSheet.tsx`, `TransactionCompassSheet.tsx`, `PracticeCompassSheet.tsx`, or `TransactionLabArena.tsx` yet (Batch migration belongs to T6; deletion belongs to T7).
- Do NOT touch `frontend/src/audio/`, `backend/src/services/live/`, `backend/src/services/sandbox/`, SQLite DDL, or IntelliJ ports `:41789`/`:41790`.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] `CompassDialogShell.tsx` (`<= 350L`) supports all 5 domains with native `<dialog>.showModal()`, `Esc`, `aria-label` close button, and `"Обсудить с AI-напарником"` CTA.
- [ ] `frontend/tests/practiceWorkspaceState.test.ts` verifies domain registry coverage (5/5 domains) and grounding prompt generation.
- [ ] Zero `ai-color-palette`, `gradient-text`, `bounce-easing`, or `nested-cards` findings inside `CompassDialogShell.tsx`.
- [ ] Existing Practice & Transaction UIs remain 100% unbroken prior to T6 switchover.
