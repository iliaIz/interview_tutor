# Spec 62: Unified Bug Hunt Workbench, Cross-Arena Co-Pilot Dock & Anti-Spoiler Whiteboard

**Status:** Approved & In Implementation  
**Supersedes / Integrates:** [Spec 11](11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md), [Spec 58](58_TUTOR_ACTIVE_CONTEXT_AND_TRANSPORT_PORT.md), [Spec 60](60_PRACTICE_WORKSPACE_UX_REMEDIATION.md), [Spec 61](61_ADAPTIVE_WORKBENCH_RESIZE_AND_COLLAPSE.md)  
**Target Domain:** `BugHuntArena` (`arena: 'incidents'`), `PracticeCopilotDock`, `WhiteboardPanelContent`, `PracticeVoiceProvider`, `practiceTutor` SSE & `LivePromptComposer`  

---

## 1. Intent & Workload Envelope

### Problem Statement (Empirical As-Is Root Causes)
Architectural inspection established seven structural defects in `BugHuntArena` compared to LLD `PracticeArenaWorkspace`:
1. **Split-Brain & Broken Text Channel (`useBugHuntVoiceBridge.ts`):** `handleSendBugText` dropped text hypotheses instead of calling `sendTextMessage` and forced an immediate WebSocket connection to Gemini Live, conflating text Q&A with real-time voice.
2. **Orphaned Co-Pilot & Invisible Whiteboard:** `BugHuntArena.tsx` only rendered `BugHuntVoiceMentor` without mounting `PracticeCopilotDock` or `WhiteboardPanelContent`. Incoming `update_whiteboard` frames saved to `useAppStore.whiteboardState` were invisible, and `BugChallengeCard.onActionNotification` was wired to a no-op `() => {}`.
3. **Dead Deictic Focus Path:** `enableGlobalSelection: true` passed into `useLiveVoiceSession` was unread; only `useVoiceTutorSession` consumed `useSelectionFocusStore`.
4. **Missing Server-Side `incidents` Prompt & Ground-Truth Guard:** `polymorphicPromptBuilder.ts` routed `arena: 'incidents'` into `buildGeneralEnterpriseTutorPrompt`, while `practiceTutor.ts` passed `targetSolutions: []` — disabling `TreeEditDistanceGuard` leak protection and leaving text hints unaware of `bug_challenges.fixed_code`.
5. **Unrestricted Live `update_whiteboard` Spoilers:** `LivePromptComposer.ts` emitted the generic `whiteboardInstruction` even when `tutorMode === 'bug_hunt'`, permitting the Live model to print `fixedCode` via `update_whiteboard` before diagnosis.
6. **Cross-Arena Contamination (`WhiteboardPanelContent`):** Navigation via `ArenaMegaMenu` / `PracticeArenaHeader` left `activePracticeChallenge` and `practiceWorkspaceFiles` non-empty in Zustand, causing `WhiteboardPanelContent` (`hasCode && practiceWorkspaceFiles.length > 0`) to display LLD-only `"Вставить"` and `:41790` IntelliJ controls inside non-LLD arenas.
7. **Dishonest AST Telemetry (`BugChallengeCard.tsx`):** Calling `evaluateAstRules` without `filterActiveAstViolations` produced false green `"чистая реализация"` badges on deliberately buggy snippets.

### Target Architecture
Unify Bug Hunt into the **2-Column Adaptive Code-Review Workbench** (without shoehorning a 3-column multi-file editor or Java sandbox where none apply):
- **48px Unified Arena IDE Shell (`App.tsx` + `BugHuntHeader.tsx`):** Suppress `StudioHeader`, `pb-24`, and `AmbientVoicePill` when `isBugHuntIdeActive` (`currentStudioTab === 'incidents' && activeTopicBugHunt !== null`), reusing a shared `ArenaSwitcherMenu`.
- **2-Column Adaptive Grid (`BugHuntArena.tsx` + `workbenchLayoutKernel.ts`):** Left column renders the Incident Brief + `BugChallengeCard` (`CodeViewer` with interactive line selection into `useSelectionFocusStore`, honest `filterActiveAstViolations`, collapsible diagnosis notes & explanation accordion); 6px `WorkbenchDragSplitter` divider; Right column mounts the generalized `PracticeCopilotDock` (`Напарник | Доска ИИ`, `Текст | Голос`, `Stealth Co-Pilot Mode`, `Mode-Coupled Dock Memory`: `380px`/`520px` + `Широкая доска` up to `65%` viewport).
- **Zero Parallel Reimplementation (`AGENTS.md` Rule 8):** Delete `useBugHuntVoiceBridge.ts` and `BugHuntVoiceMentor.tsx`. Route Bug Hunt voice through root `PracticeVoiceProvider` (`bugHuntSessionParamsBuilder.ts`, preserving `Код-ревью | Свободный диалог` role switcher and `mark_bug_solved` sync). Route text hypotheses, multi-tier hints, Compass rule grounding, and explicit diagnosis verification through `usePracticeTutorStore` + `TutorTransportPort` + `/api/practice-tutor/*`.
- **Anti-Spoiler Ground-Truth Hydration:** `practiceTutor.ts` hydrates `bug_challenges` (`bug_explanation`, `fixed_code`) server-side from `bugId` without leaking `fixed_code` to the client payload, feeds `fixed_code` into `TreeEditDistanceGuard`, adds `POST /api/practice-tutor/verify-diagnosis` backed by `ToolPersistencePort.updateBugSolved`, and constrains `update_whiteboard` in `LivePromptComposer.ts` for `tutorMode === 'bug_hunt'`.

### Workload & Hygiene Envelope
- **Desktop (`>= 1024px`):** Left Bug Review Pane `>= 420px` (hard drag floor `360px`); Right Co-Pilot Dock `>= 320px`, default `380px` (`Напарник`) / `520px` (`Доска ИИ`), expandable up to `floor(viewport * 0.65)` respecting `MIN_EDITOR_WIDTH_PX` (`420px`) + `SASH_WIDTH_PX` (`6px`).
- **Mobile / Narrow (`< 1024px`):** Responsive vertical stack / full-width pane fallback with `100dvh` containment and zero horizontal page overflow.
- **File Hygiene Ceiling (`AGENTS.md` Rule 8):** Every newly created source file in `frontend/src`, `backend/src`, `shared/src` MUST be `<= 350` lines; every modified file MUST be `<= 400` lines (`scripts/verify_file_hygiene.ts`).

---

## 2. Explicit Non-Goals

1. **No 3-Column Editor / Sandbox:** Bug Hunt MUST NOT mount `WorkspaceEditor`, file trees, `:41789` IntelliJ file sync, or Java sandbox compilation runners; Bugs are code-review / root-cause diagnosis tasks, not multi-file implementation katas.
2. **No Audio DSP / VAD Modifications:** Do NOT modify `AudioWorklet` processors, ring buffers, `NativeLiveVoiceEngine` PCM frame streaming, Silero VAD, or `LiveDeadAirGuard` thresholds.
3. **No Regression to Existing Arenas:** LLD `PracticeArenaWorkspace`, `TransactionLabArena`, and `VoiceModal` retain their existing UX, 3-column workbench, and state semantics.
4. **No Unsolicited Live Deictic `clientContent` Frames:** Line selection in `CodeViewer` updates `useSelectionFocusStore` and enriches REST `TutorActiveContext` (`selectedCodeSnippet`, `cursorLine`), Live `session_init` (`activeCodeArtifact`), or user-initiated actions — never bypassing `DownstreamClientPipe`'s `DEICTIC_PREFIXES` drop guard during live audio.
5. **No Mutation of `evaluateAstRules` Core Signature:** Existing contract assertions (`practiceWorkspaceState.test.ts:113`) depend on `evaluateAstRules` returning `isViolation: false` summary records; Bug Hunt simply filters via `filterActiveAstViolations`.

---

## 3. Pre-Agreed Verification Seams

| Seam | Target Components / Modules | Verification Suite |
| :--- | :--- | :--- |
| **S1: Shared Context & Incidents Normalizer** | `shared/src/schemas/tutorContext.ts`, `tutorIncidentsNormalizer.ts`, `tutorBarrel.ts` | `backend/tests/test_polymorphic_tutor_normalizers.js` |
| **S2: 2-Column Layout Kernel & Store Hygiene** | `workbenchLayoutKernel.ts` (`computeTwoColumnWorkbenchTracks`), `usePracticeTutorStore.ts` + `tutorStoreHelpers.ts`, `ArenaSwitcherMenu.tsx` | `frontend/tests/workbenchLayoutKernel.test.ts`, `tutorTransportStore.test.ts`, `verify_file_hygiene.ts` |
| **S3: Backend Incidents Prompt, Ground-Truth Guard & Diagnosis Verify** | `bugHuntPromptBuilder.ts`, `polymorphicPromptBuilder.ts`, `practiceTutor.ts`, `LivePromptComposer.ts` | `backend/tests/test_practice_tutor_routes.js`, `test_polymorphic_prompt_builder.js`, `verifyPromptLiveAssertions.ts` |
| **S4: Unified Voice & Capability-Gated Dock/Whiteboard** | `PracticeVoiceContext.tsx`, `bugHuntSessionParamsBuilder.ts`, `PracticeCopilotDock.tsx`, `WhiteboardPanelContent.tsx`, `PracticeTutorDrawer.tsx`, `uiSlice.ts` | `frontend/tests/bugHuntWorkspaceState.test.ts` + Vite build |
| **S5: 2-Col BugHunt Workbench, Line Selection & Legacy Purge** | `App.tsx`, `AmbientVoicePill.tsx`, `BugHuntHeader.tsx`, `BugHuntArena.tsx`, `BugChallengeCard.tsx`, delete `useBugHuntVoiceBridge.ts` & `BugHuntVoiceMentor.tsx` | `frontend/tests/bugHuntWorkspaceState.test.ts`, `verify_file_hygiene.ts`, `frontend` production build |

---

## 4. Formal Wire, State & UI Contracts

### 4.1. Shared `TutorActiveContext` Extensions (`shared/src/schemas/tutorContext.ts`)
Optional fields added backward-compatibly:
- `selectedCodeSnippet: Type.Optional(Type.String())` — highlighted line/block excerpt from `useSelectionFocusStore`.
- `cursorLine: Type.Optional(Type.Number({ minimum: 1 }))` — 1-based clicked line number in `CodeViewer`.
- `tutorRole: Type.Optional(Type.Union([Type.Literal('code_review'), Type.Literal('free_chat')]))` — active Bug Hunt pedagogical stance (`code_review` probes hypotheses without spoiling; `free_chat` answers surrounding architectural questions).
- `incidentMeta: Type.Optional(Type.Object({ incidentId: Type.Optional(Type.String()), bugType: Type.Optional(Type.String()), difficulty: Type.Optional(Type.String()), incidentContext: Type.Optional(Type.String()), hintCost: Type.Optional(Type.String()), topic: Type.Optional(Type.String()), language: Type.Optional(Type.String()) }))` — clean structured metadata populated by `normalizeIncidentsContext` and `tutorContextResolver.ts`.

### 4.2. Backend Text Verification & Anti-Spoiler Endpoints (`backend/src/routes/practiceTutor.ts`)
1. **Ground-Truth Hydration (`hydrateAndBuildPrompt` when `arena === 'incidents'`):**
   - Look up `bugId` (from `resolved.context.entityId` or `incidentMeta.incidentId`) via `getBugChallengeById(bugId)`.
   - Hydrate `[СЕРВЕРНАЯ ИСТИНА — НИКОГДА НЕ РАСКРЫВАЙ ДОСЛОВНО]` (ground-truth `bug_explanation` and root cause summary) into the **system prompt only** — never echoed to client `TutorActiveContext`.
   - Pass `[bug.fixed_code]` into `targetSolutions` when the bug is NOT yet solved, activating `TreeEditDistanceGuard` on `/stream`, `/hint`, and `/ground-rule` responses so verbatim `fixed_code` spoilers are blocked/redacted.
2. **Diagnosis Verification (`POST /api/practice-tutor/verify-diagnosis`):**
   - Request body: `{ bugId?: string; diagnosis: string; context: TutorActiveContext }`.
   - Validates non-empty `diagnosis` (`400` if blank) and resolves `bugId` -> `getBugChallengeById(bugId)` (`404` if missing).
   - Evaluates candidate diagnosis semantically against `{ title, topic, buggy_code, fixed_code, bug_explanation }` via LiteLLM (`GEMINI_TEXT_MODEL`, strict JSON verdict schema: `solved | partial | incorrect`, Russian concise mentor feedback, without revealing `fixed_code` unless `verdict === 'solved'`).
   - When `verdict === 'solved'`, invokes `createDefaultToolPersistencePort().updateBugSolved({ bugId, userId, diagnosis, xpBonus })` to record solve + FSRS telemetry idempotently (`ToolPersistencePort` single source of truth).
   - Response `200`: `{ verdict: 'solved' | 'partial' | 'incorrect', isCorrect: boolean, feedback: string, revealedExplanation?: string, fsrsRecorded: boolean }`.
3. **Live `update_whiteboard` Anti-Spoiler Directive (`LivePromptComposer.ts`):**
   - When `tutorMode === 'bug_hunt'`, `whiteboardInstruction` switches to **Diagrams & Anti-Pattern Mode**: permits Mermaid sequence/state diagrams, broken call-stack traces, and highlighted symptom snippets (`/* СИМПТОМ: ... */`), while **strictly forbidding** outputting the working fixed implementation (`fixedCode`) on `update_whiteboard` prior to solving / `mark_bug_solved`.

### 4.3. Frontend State, Capabilities & Navigation Contracts
- **Store Cleanup & Bug Signal (`uiSlice.ts`):**
  - `activeBugHuntChallenge: BugChallenge | null` (mirrors currently open `BugChallengeCard` challenge inside `BugHuntArena` so root `PracticeVoiceProvider` reads exact ground context without React prop-drilling hacks).
  - `bugHuntSolvedSignal: { bugId: string; timestamp: number } | null` and `notifyBugHuntSolved(bugId)` so Voice `mark_bug_solved` tool calls or REST `verify-diagnosis` smoothly update the open `BugChallengeCard` accordion/solved badge without hard reloads.
- **2-Column Layout Kernel (`workbenchLayoutKernel.ts`):**
  - Pure function `computeTwoColumnWorkbenchTracks({ viewportWidthPx, isCopilotStealth, rightDockTab, tutorWidthPx, whiteboardWidthPx, isWhiteboardExpanded })`:
    - Reuses `WORKBENCH_BOUNDS` (`MIN_EDITOR_WIDTH_PX: 420`, `SASH_WIDTH_PX: 6`, `DEFAULT_TUTOR_WIDTH_PX: 380`, `DEFAULT_WHITEBOARD_WIDTH_PX: 520`, `MAX_COPILOT_VIEWPORT_RATIO: 0.65`) and `computeExpandedWhiteboardWidth`.
    - When `isCopilotStealth === true`, returns `{ gridTemplateColumns: 'minmax(0, 1fr)', primaryWidthPx: viewportWidthPx, dockWidthPx: 0, effectiveDockWidthPx: 0 }`.
    - Otherwise returns `gridTemplateColumns: 'minmax(${HARD_MIN_EDITOR_WIDTH_PX}px, 1fr) ${SASH_WIDTH_PX}px ${effectiveDockWidthPx}px'` clamped to keep left code pane `>= MIN_EDITOR_WIDTH_PX` (`420px`) on desktop.
- **Capability-Gated `PracticeCopilotDock` & `WhiteboardPanelContent`:**
  - `PracticeCopilotDock` accepts `capabilities?: PracticeCopilotCapabilities` (defaulting to full LLD Practice flags so `PracticeArenaWorkspace` call sites require zero behavioral change):
    - `canInsertToEditor`: `boolean` (`true` in `practice`, `false` in `incidents`)
    - `showIdeBridge`: `boolean` (`true` in `practice`, `false` in `incidents`)
    - `showPersonasAndHints`: `boolean` (`true` in both `practice` and `incidents`; `false` in `companies`/`sql_arena`)
    - `showBugRoleSwitcher`: `boolean` (`true` in `incidents`)
    - `selectedCodeSnippet?: string | null` & `cursorLine?: number | null` (chip shown above input footer with clear button)
    - `onVerifyDiagnosis?: (diagnosis: string) => Promise<void>` & `isVerifyingDiagnosis?: boolean`
  - `WhiteboardPanelContent` checks `canInsertToEditor` (not solely `practiceWorkspaceFiles.length > 0`) before rendering `"Вставить"`, and checks `showIdeBridge` before rendering `"В IntelliJ"`.
- **Voice Unification & Text Safety (`PracticeVoiceContext.tsx` & `PracticeCopilotDock.tsx`):**
  - Selecting `Текст` in `BugHuntArena` NEVER dials a WebSocket; messages go through `usePracticeTutorStore.sendMessage` (`SSE` + active context including `selectedCodeSnippet`, `cursorLine`, `tutorRole`, `incidentMeta`).
  - Selecting `Голос` launches `PracticeVoiceProvider.launchBugHuntSession(challenge, tutorRole)` via `buildBugHuntSessionParams`, binding `onBugSolved -> notifyBugHuntSolved`, preserving role switcher (`Код-ревью` | `Свободный диалог`), and writing incoming `update_whiteboard` frames directly into `useAppStore.setWhiteboardState` (automatically visible in `Доска ИИ`).

---

## 5. Storage & Zero-Downtime Migration

- **Database:** Zero schema migrations. Reads `bug_challenges` and persists solve status/FSRS through the existing `getBugChallengeById` and `createDefaultToolPersistencePort().updateBugSolved` paths (`backend/src/db/toolPersistencePort.ts`).
- **Client Persistence (`localStorage`):** Zero key changes or invalidations. Existing `workbenchDockSlice` storage keys (`tutorWidthPx`, `whiteboardWidthPx`, `isWhiteboardExpanded`) work across both `PracticeArenaWorkspace` and `BugHuntArena`.
- **Navigation Resilience:** Leaving `BugHuntArena` resets `activeBugHuntChallenge = null` and clears stale `codeRevisions` (`clearCodeRevisions()`); entering `BugHuntArena` calls `usePracticeTutorStore.initChallengeContext(incidentsContext)` so stale LLD chat threads never bleed across arenas.

---

## 6. Hoare-Logic Contracts (`{P} C {Q}`)

1. **Text Hypothesis Isolation & Ground-Truth Anti-Spoiler:**
   `{ P: arena === 'incidents' ∧ modality === 'text' ∧ ¬solved(bugId) }`  
   `C: sendMessage(hypothesis) / fetchHint(tier) via POST /api/practice-tutor/*`  
   `{ Q: ws.readyState !== OPEN ∧ systemPrompt ∋ bug_explanation ∧ TreeEditDistanceGuard(targetSolutions=[fixed_code]) active ∧ no verbatim fixed_code emitted }`

2. **Live `update_whiteboard` Anti-Spoiler:**
   `{ P: tutorMode === 'bug_hunt' ∧ ¬solved(bugId) ∧ liveSessionActive }`  
   `C: Gemini Live invokes update_whiteboard(code, language)`  
   `{ Q: useAppStore.whiteboardState updates ∧ rendered in WhiteboardPanelContent('Доска ИИ') ∧ canInsertToEditor === false ∧ showIdeBridge === false }`

3. **2-Column Workbench Bounded Resize & Stealth Recovery:**
   `{ P: viewportWidthPx >= 1024 ∧ isBugHuntIdeActive }`  
   `C: Drag WorkbenchDragSplitter ∨ toggle Stealth Co-Pilot ∨ toggle 'Широкая доска'`  
   `{ Q: primaryWidthPx >= 360 ∧ (isCopilotStealth ⇒ effectiveDockWidthPx === 0) ∧ (rightDockTab switch preserves independent Mode-Coupled Dock Memory) }`

4. **Legacy Bridge Elimination & AST Honesty:**
   `{ P: BugHuntArena mounted with buggy challenge }`  
   `C: Build frontend bundle ∧ render BugChallengeCard`  
   `{ Q: useBugHuntVoiceBridge ∉ graph ∧ BugHuntVoiceMentor ∉ graph ∧ AST badge counts strictly filterActiveAstViolations(evaluateAstRules(...)) }`
