# Spec 40: HR Guided Micro-Chunking (`С нуля`), Paraphrase Diversity & Passive Study TTS

> **Spec ID:** `40`  
> **Status:** Approved / Authoritative SSOT  
> **Location:** `docs/architecture/specs/40_HR_GUIDED_MICRO_CHUNKS_AND_AUDIO_STUDY.md`  
> **Target Standard:** SOTA Late 2026 / Cognitive Scaffolding & Variable Retrieval Practice  
> **Parent Specification:** [`08_HR_VOICE_SIMULATOR_ENGINE.md`](../functional_registry/08_hr_voice_simulator_engine.md) & [`Spec 38`](38_HR_VOICE_TUTOR_REHEARSAL_AND_CHUNKING.md)

---

## 1. Intent & Workload Envelope

### 1.1. Context & Glossary
- **Target Glossary & ADRs:** [`GLOSSARY.md`](../../../GLOSSARY.md) (`Dual-Sided Handshake`, `Turn 0 Lockdown`, `Socratic Scaffold Ladder`, `Fast-Handoff VAD`), `Spec 38` (`tutor_rehearsal`, `mentor_coach`, epistemic boundary).
- **Problem Statement:** Candidates learning canonical answers from a complete zero state (`с полного нуля`) experience high cognitive load in both existing modalities:
  1. Visual Study Deck (`HrQuestionStudyDeck`) requires silent reading without auditory shadowing or multi-phrasing ear training.
  2. Existing voice modes (`tutor_rehearsal`, `rapid_fire_micro_drill`, `full_screening_simulation`) expect full-question or 20–35s chunk production immediately rather than guided atomic 8–15 word micro-beats with fading scaffolding.
- **Architectural Goal:** Introduce two complementary, non-invasive capabilities without altering existing examiner modes or `manual` Push-to-Talk behavior:
  1. **Passive Study Audio Mode (Study Tab):** Micro-beat breakdown inside `HrQuestionStudyDeck` with global-voice Gemini TTS synthesis (`/api/hr/study-tts`), speed selection (`0.9x / 1.0x / 1.15x`), phrasing variant cycling, and optional *Phrase → Pause* shadowing timer.
  2. **New Voice Arena Option (`guided_zero_start` — «С нуля (Повтор)»):** Dedicated 4th mode selector alongside `Репетиция`, `Микро-дрилл (75с)`, and `Полный скрининг`. Executes a **4-Rung Fading Scaffolding Ladder** over atomic 8–15 word `microBeats`:
     - **Rung 1 (`echo_catch`):** AI speaks one natural varied phrasing keeping `immutableFacts` intact; candidate echoes.
     - **Rung 2 (`paraphrase_flip`):** AI requests candidate's own natural paraphrase preserving exact facts/citations (zero verbatim parroting).
     - **Rung 3 (`naked_recall`):** Visual cue card auto-fades (`cueVisible = false`); AI poses a realistic HR trigger question (`hrTriggerPrompt`).
     - **Rung 4 (`snowball_bridge`):** When `beatIndex >= 1`, candidate stitches current and previous beats into a fluent 20–35s narrative block before advancing.
  - **Hybrid Voice + Button Progression:** Transitions trigger either verbally via non-blocking Gemini Live tool `advance_hr_learning_step` (when candidate asks *"дальше"*, *"другой вариант"*, *"повторю"* or AI detects mastery) **OR** deterministically via UI buttons synced over WebSocket (`hr_step_control` -> `hr_step_state`).

### 1.2. Operating Envelope
- **Study TTS Endpoint (`GET /api/hr/study-tts`):** Cache hit p95 `< 25ms`, uncached Gemini TTS p95 `< 2500ms`; bounded in-memory LRU cache (`max = 120` WAV buffers); strictly authenticated via `requireAuth`; `Single-Tenant / User-Scoped` (`credentials: 'include'`).
- **Live Voice Guided Session:** Real-time 16kHz/24kHz PCM duplex over existing `NativeLiveVoiceEngine` + `LiteLLM_Proxy`; zero parallel WebSocket engines; respects global `turnMode` (`manual` & `auto`), `liveModel`, `voice`, `vadPauseMs`, `userGender`.
- **Data Classification:** `Internal` (canonical public/fixture rehearsal data + user local mastery progress in `localStorage`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

Agents implementing Spec 40 are **strictly forbidden** from altering:
1. **`manual` Turn Mode Mechanics:** `LiveMicChunkDispatcher.ts`, `LiveVoiceStateMachine.ts` manual commit flow, and `liveWsTurnCommitHandler.ts` manual buffering MUST remain untouched.
2. **Existing HR Modes:** Behavior of `tutor_rehearsal`, `rapid_fire_micro_drill`, and `full_screening_simulation` prompts and scoring rules MUST remain unchanged (scorecards still emitted in drill/full screening and suppressed in `hr_tutor`).
3. **Core Voice Singletons:** No cloning of `NativeLiveVoiceEngine.ts`, `AudioPlayoutManager.ts`, or `useLiveVoiceSession.ts`; extensions happen only via typed callbacks/events.
4. **Non-HR Arenas & DB Schema:** Zero changes to SQLite schema migrations (`schema.sql`), LLD/Sandbox Java runners, or Company/Knowledge Tutor prompts.
5. **File-Hygiene Bounds:** Every newly created source file MUST stay `<= 350` lines and every modified source file MUST stay `<= 400` lines (`scripts/verify_file_hygiene.ts`). Note `HrScreeningArena.tsx` (currently 368L), `useHrSimulatorStore.ts` (346L), and `liveToolDeclarations.ts` (365L) MUST be decomposed/kept modular rather than bloated.

---

## 3. Pre-Agreed Verification Seams

- **Seam 1 (Shared Wire & Schema Contracts):** `shared/src/schemas/hrSimulator.ts` and `shared/src/schemas/voiceEvents.ts`.
  - Verification: `npm --prefix shared run build` (TypeBox compilation).
- **Seam 2 (Backend Prompt, Stepper FSM, Tool & Fixtures):** `backend/src/services/live/hrGuidedStepper.ts`, `hrPromptBuilder.ts`, `liveHrToolDispatcher.ts`, `liveToolDeclarations.ts`, `backend/src/data/hr/fixtures/canonicalQuestionMatrix.json`.
  - Verification: `backend/tests/test_hr_simulator_engine.js` & `npm run test:prompts`.
- **Seam 3 (Backend REST Study TTS Route):** `backend/src/routes/hr.ts`.
  - Verification: `backend/tests/test_hr_routes.js` & `backend/tests/test_hr_acoustic_canary.js` (`npm run test:hr`).
- **Seam 4 (Frontend State, Frame Parser & Modular UI):** `frontend/src/store/useHrSimulatorStore.ts`, `frontend/src/audio/LiveVoiceFrameParser.ts`, `HrStudyAudioBar.tsx`, `HrGuidedLadderBar.tsx`, `HrLiveSubtitleCard.tsx`.
  - Verification: `frontend npm run test:audio-contracts`, `frontend npm run build`, `verify-hygiene`, and full GitHub Actions CI (`remote-verify`). Zero internal domain mocks for deterministic logic; live TTS calls mocked only at transport boundary in offline unit tests.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Shared TypeBox Schema Extensions (`shared/src/schemas/hrSimulator.ts`)
```typescript
export const HrSessionModeSchema = Type.Union([
  Type.Literal('full_screening_simulation'),
  Type.Literal('rapid_fire_micro_drill'),
  Type.Literal('tutor_rehearsal'),
  Type.Literal('guided_zero_start')
]);

export const HrLearningRungSchema = Type.Union([
  Type.Literal(1), // echo_catch
  Type.Literal(2), // paraphrase_flip
  Type.Literal(3), // naked_recall
  Type.Literal(4)  // snowball_bridge
]);
export type HrLearningRung = Static<typeof HrLearningRungSchema>;

export const HrMicroBeatSchema = Type.Object({
  id: Type.String(),
  chunkId: Type.String(),
  title: Type.String(),
  anchorIds: Type.Array(Type.String()),
  immutableFacts: Type.Array(Type.String(), { minItems: 1 }),
  spokenVariants: Type.Array(Type.String(), { minItems: 2 }),
  hrTriggerPrompt: Type.String(),
  cueHints: Type.Array(Type.String())
});
export type HrMicroBeat = Static<typeof HrMicroBeatSchema>;

// Optional field on HrQuestionRubricItemSchema (Additive-Only)
// microBeats: Type.Optional(Type.Array(HrMicroBeatSchema))
```

### 4.2. WebSocket Events (`shared/src/schemas/voiceEvents.ts`)
- Extend `HR_VOICE_EVENTS`:
  - `HR_STEP_CONTROL: 'hr_step_control'` (**Client -> Gateway**)
  - `HR_STEP_STATE: 'hr_step_state'` (**Gateway -> Client**)
```typescript
export type HrStepControlAction =
  | 'next_rung'
  | 'next_variant'
  | 'next_beat'
  | 'prev_beat'
  | 'repeat_beat'
  | 'select_beat'
  | 'toggle_cue';

export interface HrStepControlPayload {
  action: HrStepControlAction;
  beatIndex?: number;
  cueVisible?: boolean;
}

export interface HrStepStatePayload {
  questionId: string;
  beatId: string;
  beatIndex: number;
  totalBeats: number;
  beatTitle: string;
  chunkId: string;
  rung: 1 | 2 | 3 | 4;
  variantIndex: number;
  variantCount: number;
  activeVariantText: string;
  immutableFacts: string[];
  cueHints: string[];
  hrTriggerPrompt: string;
  cueVisible: boolean;
  masteredBeatIds: string[];
  source: 'session_init' | 'ai_tool' | 'client_button';
  reason?: string;
}
```

### 4.3. Non-Blocking Gemini Live Tool (`advance_hr_learning_step`)
Exposed **only** when `sessionType === 'hr_tutor'` and `hrMode === 'guided_zero_start'` (`isGatedOnTurn0: true`):
```typescript
{
  name: 'advance_hr_learning_step',
  behavior: 'NON_BLOCKING',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['next_rung', 'next_beat', 'next_variant', 'repeat_beat', 'toggle_cue'] },
      masteredCurrentBeat: { type: 'BOOLEAN' },
      reason: { type: 'STRING' }
    },
    required: ['action']
  }
}
```

### 4.4. Study Audio HTTP REST Endpoint (`GET /api/hr/study-tts`)
- **Query Params:** `questionId: string`, `beatId: string`, `variantIdx: integer >= 0`, `voice?: string` (sanitized via `sanitizeVoiceName`).
- **Response (`200 OK`):** `Content-Type: audio/wav`, `Cache-Control: private, max-age=86400`, binary WAV buffer via `synthesizeTTSWithRetry`.
- **Errors:** `400 Bad Request` (missing/invalid indices), `404 Not Found` (unknown question/beat), `503 Service Unavailable` (upstream TTS gateway failure).

---

## 5. Storage & Zero-Downtime Migration Contract

- **Rollout Strategy:** `Additive-Only`.
- **Fixtures:** All 13 canonical questions (`hr_q0_elevator_pitch` .. `hr_q12_candidate_questions`) in `canonicalQuestionMatrix.json` receive atomic `microBeats` (2–5 beats/question, `2+` diverse Russian `spokenVariants` + explicit `immutableFacts` + `hrTriggerPrompt`). Legacy callers reading `requiredAnchors` or `chunks` work identically without breaking changes.
- **Database DDL:** Zero SQLite schema changes. Client mastery state (`masteredBeatIds` per `questionId`) persists in browser `localStorage` (`hr_guided_mastery_v1`) via pure helper functions.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Guided Session Initialization (`guided_zero_start`)
- **Pre-Conditions `{P}`:** `sessionType === 'hr_tutor'`, `hrMode === 'guided_zero_start'`, `questionId` resolves to valid item with `microBeats.length >= 1` (scoped to `chunkId` if selected).
- **Algorithm `C`:** `sessionStartupHelper` initializes `session.hrMode`, `session.chunkId`, and deterministic `session.hrGuidedState = createInitialGuidedState(question, chunkId)`. On upstream `setupComplete`, `LiveGreetingReplay`:
  1. Emits `HR_STEP_STATE` (`source: 'session_init'`) to `clientSocket`.
  2. Sends Turn 0 prompt introducing Beat 0, Rung 1 (`echo_catch`), reciting `spokenVariants[0]` naturally while forbidding premature tool calls.
- **Post-Conditions `{Q}`:** HUD displays Beat `1 / N`, Rung `1`, `cueVisible = true`, immutable fact pills, and live AI greeting audio plays.

### 6.2. Voice-Triggered or Button-Triggered Progression
- **Pre-Conditions `{P}`:** `session.isSetupComplete === true` and `session.hrGuidedState` exists; for AI tool trigger, `session.hasCandidateResponded === true`.
- **Algorithm `C`:** Pure reducer `applyGuidedStepAction(state, beats, action, opts)`:
  - `next_rung`: `rung 1 -> 2 -> 3`; from `3`, if `beatIndex >= 1` moves to `rung 4` (`snowball_bridge`), else marks `beat` mastered and advances `(beatIndex + 1, rung = 1)` (or loops cleanly on final beat); from `4`, marks `beat` mastered and advances `(beatIndex + 1, rung = 1)`.
  - Automatically sets `cueVisible = false` when entering Rung 3 unless explicitly pinned open; rotates `variantIndex = (variantIndex + 1) % spokenVariants.length` on `next_variant`, `repeat_beat`, or `rung 1 -> 2` so AI never parrots the same wording twice.
  - Tool path returns next beat/variant + `immutableFacts` inside `toolResponse.result.directive` + dispatches `HR_STEP_STATE`. Button path (`DownstreamClientPipe` handling `HR_STEP_CONTROL`) applies the same reducer, dispatches `HR_STEP_STATE`, and—if `action !== 'toggle_cue'`—sends a concise `[УПРАВЛЕНИЕ ШАГОМ]` instruction to Gemini Live with `turnComplete: true` (`deadAirGuard?.reset()`, `armTurnWatchdogs`).
- **Post-Conditions `{Q}`:** UI and Gemini Live remain strictly synchronized on exact beat/rung/variant; `toggle_cue` mutates `cueVisible` silently without disrupting speech.
- **Orthogonal Invariants:**
  1. **Non-Parroting + Immutable Fact Lock:** System & tool directives forbid repeating identical connective wording twice consecutively while locking legal citations, docs (`СТД-СФР`, `КНД 1122035`, `ФЗ № 422-ФЗ`, `ст. 65 ТК РФ`), metrics, and salary (`310k–330k`).
  2. **Graceful TTS Unavailability:** Study Tab TTS errors display localized status and never crash Study Deck or block switching to Live Voice.
  3. **Manual Mode Preservation:** No `audioStreamEnd` or auto-VAD changes leak into `manual` Push-to-Talk turns.
