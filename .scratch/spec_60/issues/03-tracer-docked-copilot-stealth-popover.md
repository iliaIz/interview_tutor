# 03: [Tracer-Bullet] Spec 60 (T3): Docked Co-Pilot Rail (`AI-Напарник | Доска ИИ`), Stealth Mode & Top-Layer Popover

## Parent
Part of Spec 60: [docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md](docs/architecture/specs/60_PRACTICE_WORKSPACE_UX_REMEDIATION.md) · Issue #210

**Archetype:** Tracer-Bullet  
**Blocked by:** #211, #212  
**Status:** ready-for-agent

## What to Build
Unify `AI-Напарник` (`PracticeTutorDrawer`) and `Доска ИИ` (`WhiteboardDrawer`) inside Practice IDE into a single docked right pane below `PracticeArenaHeader`, deliver non-destructive **Stealth Co-Pilot Mode** (`enterStealthMode`/`exitStealthMode`) that visually hides all AI UI without stopping a running dialogue/voice session, and lift `HintTiersDropdown` out of `overflow-x-auto` (`233px` clip) into the top layer.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:**
  - `frontend/src/components/practice/arena/PracticeArenaWorkspace.tsx` + `frontend/src/components/practice/arena/PracticeArenaHeader.tsx`
  - `frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx` + `TutorMessageList.tsx` + `TutorQuickActionChips.tsx` + `PracticeVoiceHUD.tsx` + `AmbientVoicePill.tsx` + `HintTiersDropdown.tsx`
  - `frontend/src/components/WhiteboardDrawer.tsx` (`WhiteboardPanelContent` reuse + `<AnimatePresence>` key fix)
  - `frontend/src/store/usePracticeTutorStore.ts`
- **Dependencies:** `usePracticeTutorStore` tests + Headless Chromium (`agent-browser` at `1440×900`, `1280×800`, `390×844`) (Zero internal domain mocks).
- **Verification Command:** `npm --prefix frontend run test:audio-contracts && npm --prefix frontend run verify-hygiene && npm --prefix frontend run build` (via `remote-verify` on `feat/...`).

## Embedded Contract Slice & Invariants
- **Docked Right Rail Layout:** On `>= lg`, Co-Pilot mounts as `<aside>` flex/grid sibling inside `PracticeArenaWorkspace` *below* the `48px` `PracticeArenaHeader`, resizing `WorkspaceEditor` cleanly without occluding header actions or `WorkspaceFooterBar`. On `< lg`, renders inside `<dialog>` / `navigation-drawer` sheet (`max-h-dvh`, swipe/Esc dismissible).
- **Mutually Exclusive Dock Tabs:** `Напарник | Доска ИИ` switched cleanly via `rightDockTab`; `Доска ИИ` delegates exclusively to `WhiteboardPanelContent` extracted in #211 while keeping standalone `WhiteboardDrawer` intact inside `VoiceModal` & `TransactionLabArena`, resolving `<AnimatePresence>` duplicate key warnings.
- **Stealth Co-Pilot Mode Invariant:**
  - Once `isConnected || isError || messages.length > 1` in `AI-Напарник`, dock header exposes `Скрыть (тихий режим)`.
  - Clicking dispatches `enterStealthMode()`: hides dock visually via non-destructive CSS/state visibility (preserving `inputVal`, message list scroll, and active voice stream — NEVER unmounting `PracticeVoiceProvider` or closing WebSocket) and suppresses `AmbientVoicePill` whenever `isPracticeIdeActive === true`.
  - When `isCopilotStealth && (isConnected || isError)`, `PracticeArenaHeader` displays a compact `48px`-aligned button (`AI в эфире` / `Ошибка связи` with status indicator) to restore via `exitStealthMode('tutor')`. Zero floating pills over CodeMirror or `WorkspaceFooterBar`. In non-IDE arenas (`TransactionLabArena`), `AmbientVoicePill` exposes an explicit dismiss `X` button on error.
- **Drawer & Popover Polish:**
  - `PracticeTutorDrawer`: display resolved `domain` label in header instead of generic `"AI-Напарник (Co-Pilot)"`, and keep `HintTiersDropdown` visible in Practice domains even when `activeContext` is populated.
  - `HintTiersDropdown`: migrate dropdown menu from `overflow-x-auto` to native `popover="auto"` + `position-area: block-end` (fallback viewport-clamped portal) so all 5 hint tiers render unclipped.
  - `TutorMessageList`: render bubbles via `ReactMarkdown` + `remark-gfm`; fix active `<Bot>` icon color (`text-current`).
  - `TutorQuickActionChips`: remove duplicate `Компас (Ctrl+/)` chip.
  - `PracticeVoiceHUD`: hide/correct `"Отключить"` button when disconnected and add `userGender` fallback.

## Explicit Non-Goals
- Do NOT touch `frontend/src/audio/` (AudioWorklets, Gemini Live voice state machine) or `backend/src/services/live/`.
- Do NOT touch IntelliJ bridges `:41789`/`:41790`.
- Do NOT alter `astRules`, `PracticeEvaluationModal`, Compass sheets, or `json/refactoring_challenges.json`.
- New files `<= 350L`; modified files `<= 400L`.

## Acceptance Criteria
- [ ] On `>= lg`, toggling Co-Pilot or `Доска ИИ` never occludes `PracticeArenaHeader` (`48px`) or `WorkspaceFooterBar` CTA buttons.
- [ ] Entering Stealth Mode while voice/text session is active hides all Co-Pilot panes & `AmbientVoicePill` while `isConnected` remains `true`; clicking the `48px` header restore pill reopens the pane with intact `inputVal` and message history.
- [ ] Clicking `Подсказка` renders all 5 hint tiers completely unclipped at `1440×900`, `1280×800`, and `390×844` (works with active context too).
- [ ] Zero React `<AnimatePresence>` key warnings in console; tutor markdown renders cleanly (`ReactMarkdown` + `remark-gfm`).
