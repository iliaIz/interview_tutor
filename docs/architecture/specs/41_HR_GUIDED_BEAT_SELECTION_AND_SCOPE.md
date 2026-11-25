# Spec 41: HR Guided Beat Selection, Single-Beat Focus Scope & Chunk Isolation

> **Spec ID:** `41`  
> **Status:** Approved / Authoritative SSOT  
> **Location:** `docs/architecture/specs/41_HR_GUIDED_BEAT_SELECTION_AND_SCOPE.md`  
> **Target Standard:** SOTA Late 2026 / Whole-Part-Whole Non-Destructive Focus Scaffolding  
> **Parent Specification:** [`08_HR_VOICE_SIMULATOR_ENGINE.md`](../functional_registry/08_hr_voice_simulator_engine.md) & [`Spec 40`](40_HR_GUIDED_MICRO_CHUNKS_AND_AUDIO_STUDY.md)

---

## 1. Intent & Workload Envelope

### 1.1. Context & Glossary
- **Target Glossary & ADRs:** [`GLOSSARY.md`](../../../GLOSSARY.md) (`Turn 0 Lockdown`, `Socratic Scaffold Ladder`), [`Spec 40`](40_HR_GUIDED_MICRO_CHUNKS_AND_AUDIO_STUDY.md) (`guided_zero_start`, `HrMicroBeat`, `HR_STEP_CONTROL` / `HR_STEP_STATE`).
- **Root-Cause Findings Fixed:**
  1. Spec 40 conflated Spec 38 macro-chunks (`chunks`, 20–35s blocks for `tutor_rehearsal`) with Spec 40 atomic micro-beats (`microBeats`, 8–15 word units for `guided_zero_start`), causing silent filtering (e.g., 5 pitch micro-beats collapsed to 2 when a stale `selectedChunkId` remained set while the launch CTA displayed `5`).
  2. Users could not select which specific micro-beat to start or practice in isolation from either the Voice Lobby or individual beat cards in the Study Deck.
  3. `advance_hr_learning_step` lacked `select_beat` + `beatIndex`, and `HR_STEP_STATE` lacked the session `beats` roster for SSOT HUD badge/label synchronization.
- **Architectural Design (Option A + Study Deep-Link):**
  1. **Isolation of `chunks` vs `microBeats`:** `guided_zero_start` completely ignores `chunkId` and resolves **all** question `microBeats` cleanly. `selectedChunkId` applies strictly to `tutor_rehearsal` and `rapid_fire_micro_drill`.
  2. **Lobby Micro-Beat Selector + Explicit Scope (`all_from_beat` vs `single_beat`):**
     - `all_from_beat`: Renders all `N` beats; user selects any beat as the starting entry point (`startBeatId` -> initial `beatIndex`) while retaining full route navigation and Rung 4 Snowball Bridge.
     - `single_beat`: Scopes the session strictly to `[selectedBeat]`, hides Rung 4 Snowball Bridge, and cycles through Rungs `1 -> 2 -> 3` with fresh paraphrase variants and mastery persistence.
  3. **Study Deck Per-Beat Voice Launch:** Every beat card in `HrStudyAudioBar` includes a direct action opening `guided_zero_start` scoped to `single_beat` on that beat; the question-level Study CTA launches `all_from_beat` from Beat 1 cleanly.

### 1.2. Operating Envelope
- Zero new REST endpoints or database tables; operates purely over existing WS session init, `HR_STEP_CONTROL`/`HR_STEP_STATE` frames, and TypeBox shared contracts.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

1. **`manual` Turn Mode:** Zero changes to Push-to-Talk buffering or `LiveMicChunkDispatcher`.
2. **Existing Examiner & Rehearsal Chunking:** `tutor_rehearsal`, `rapid_fire_micro_drill`, and `full_screening_simulation` retain `chunks` selection and evaluation behavior unchanged.
3. **Database Schema & Non-HR Arenas:** No changes to SQLite DDL, Study TTS HTTP contract (`GET /api/hr/study-tts`), or non-HR arenas.
4. **File-Hygiene SLA (`AGENTS.md` §8):** New files `<= 350` lines; modified files `<= 400` lines.

---

## 3. Pre-Agreed Verification Seams

- **Seam 1 (Shared TypeBox & WS Event Contracts):** `shared/src/schemas/hrSimulator.ts` and `shared/src/schemas/voiceEvents.ts`.
  - Verification: `npm --prefix shared run build`.
- **Seam 2 (Backend Stepper, Tool, Prompt & Greeting Replay):** `hrGuidedStepper.ts`, `liveToolDeclarations.ts`, `liveHrToolDispatcher.ts`, `hrPromptBuilder.ts`, `LiveGreetingReplay.ts`.
  - Verification: `npm --prefix backend run test:hr` (`test_hr_simulator_engine.js`).
- **Seam 3 (Frontend WS Resolution, Store & Decomposed UI):** `liveVoiceUrlBuilder.ts`, `voiceConfigResolver.ts`, `useHrSimulatorStore.ts`, `HrScopeSelector.tsx`, `HrStudyAudioBar.tsx`, `HrGuidedLadderBar.tsx`, `HrVoiceHUD.tsx`.
  - Verification: `npm --prefix frontend run test:audio-contracts`, `npm --prefix frontend run build`, and full CI (`remote-verify`).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Shared Schemas (`shared/src/schemas/hrSimulator.ts`)
```typescript
export const HrBeatScopeSchema = Type.Union([
  Type.Literal('all_from_beat'),
  Type.Literal('single_beat')
]);
export type HrBeatScope = Static<typeof HrBeatScopeSchema>;
```

### 4.2. WebSocket Session Init & Step Payloads (`shared/src/schemas/voiceEvents.ts`)
- **Initiation Query & `session_init` Additions:**
  - `startBeatId?: string` — optional target micro-beat ID to start on (`all_from_beat`) or isolate (`single_beat`).
  - `beatScope?: 'all_from_beat' | 'single_beat'` — defaults to `'all_from_beat'`.
- **`HrStepStatePayload` Additions (Gateway -> Client SSOT):**
  - `beatScope: HrBeatScope`
  - `beats: Array<{ id: string; title: string }>` — ordered roster of active session beats matching `totalBeats` and `beatIndex`.

### 4.3. Tool Schema Update (`advance_hr_learning_step`)
- `action.enum` expanded with `'prev_beat'` and `'select_beat'`.
- Optional `beatIndex?: number` (0-based index into `beats` matching the requested beat topic/number).

---

## 5. Storage & Zero-Downtime Migration Contract

- **Rollout Strategy:** `Additive-Only`. Missing `startBeatId` / `beatScope` defaults to `{ beatIndex: 0, beatScope: 'all_from_beat' }`. No fixture or SQLite DDL migrations required.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Guided Session Beat Resolution
- **Pre-Conditions `{P}`:** `sessionType === 'hr_tutor'` and `hrMode === 'guided_zero_start'`, with optional `startBeatId`, `beatScope`, and possibly non-empty stale `chunkId`.
- **Algorithm `C`:** `resolveGuidedSessionBeats(question, { startBeatId, beatScope })` ALWAYS sources from full `question.microBeats` (never filters by `chunkId`):
  - If `beatScope === 'single_beat'` and `startBeatId` matches a beat -> returns `[beat]` (`beatIndex = 0`, `totalBeats = 1`, `beatScope = 'single_beat'`).
  - Otherwise -> returns full `[...beats]` (`totalBeats = beats.length`), initializing `beatIndex` to the index matching `startBeatId` (or `0` if absent).
  - `LiveGreetingReplay` Turn 0 emits `HR_STEP_STATE` (`session_init`) with `beats` and `beatScope`, and greets starting on `beats[initialState.beatIndex]`.
- **Post-Conditions `{Q}`:** If `hr_q0` has 5 beats and `all_from_beat` is selected (even with stale `chunkId` in store), `totalBeats === 5` and HUD pill count equals 5 with exact ID/title parity.

### 6.2. Adaptive Stepping & Snowball Eligibility
- **Pre-Conditions `{P}`:** Valid `HrGuidedSessionState` synced with `beats` and `beatScope`.
- **Algorithm `C`:**
  - Transition out of Rung `3` enters Rung `4` (`snowball_bridge`) iff `beats.length >= 2 && state.masteredBeatIds.length >= 1`.
  - In `single_beat` (`beats.length === 1`), advancing from Rung `3` marks the beat mastered and cycles back to `rung = 1` with rotated `variantIndex`.
  - Voice `select_beat(beatIndex)` updates `beatIndex` (clamped `[0, beats.length - 1]`), sets `rung = 1`, `variantIndex = 0`, `cueVisible = true`.
- **Orthogonal Invariants:** Prompt context embeds active beat variants verbatim + a compact 1-line title outline of session beats without inflating context with unrelated phrasing variants.
