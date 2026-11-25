# Subsystem 08: Generic HR Voice Simulator Engine

> **Subsystem ID:** `08`  
> **Status:** Production / SOTA Late 2026  
> **Location:** `docs/architecture/functional_registry/08_hr_voice_simulator_engine.md`  
> **Authoritative Specification:** [`docs/hr_screening_engine/master_implementation_plan.md`](../../hr_screening_engine/master_implementation_plan.md) & [`docs/hr_screening_engine/master_implementation_plan_wave21_pedagogical_suite.md`](../../hr_screening_engine/master_implementation_plan_wave21_pedagogical_suite.md)  
> **Quality Gate:** Automated Invariant Suites & Headless Acoustic Canary (`npm run test:hr`)

---

## 1. Architectural Purpose & Scope

The `Generic HR Voice Simulator Engine` provides an adaptive, anti-sycophantic, multi-persona real-time audio screening and micro-drill simulator for the `interview_tutor` platform. It trains candidates on high-stakes soft skills: the canonical 75-second Elevator Pitch, legal justifications (NPD 422-FZ, STD-SFR), compensation framing (310k–330k net), and STAR-method behavioral conflict defense without fluff or defensive tone.

With **Wave 21**, the engine incorporates a complete **Pedagogical Worked-Example Suite** allowing candidates to learn answers from scratch inside the UI: reading canonical answers in Markdown (identical to the Theory track), exploring anchor definitions, studying anti-pattern traps, and seamlessly transitioning into voice drills via 1-click motor bridges.

With **Spec 38**, the engine introduces an **Interactive Voice Tutor Rehearsal Mode (`tutor_rehearsal`)** with persona **`mentor_coach` ("Ольга" — голос из глобального профиля)**:
- **In-flight error correction**: stops candidate immediately upon stop-words or factual distortion to force a re-take.
- **On-demand verbal cues**: supplies facts and legal articles when candidate asks for help.
- **Anchor chunking**: breaks down long questions into 2-3 isolated blocks for focused motor rehearsal.
- **Epistemic boundary**: verbatim precision enforced strictly on laws/docs/metrics/salary, with conversational freedom for transitions and narrative motivation.
- **Zero scorecard popups**: rehearsal mode eliminates numerical grades and modal popups.

With **Spec 40**, the engine adds cold-start beginner scaffolding without disturbing `tutor_rehearsal` or examiner modes:
- **Atomic Micro-Beats & Paraphrase Diversity (`canonicalQuestionMatrix.json`):** All 13 canonical questions decomposed into 30 atomic 8–15 word `microBeats`, each carrying `immutableFacts` and 3 vetted natural Russian `spokenVariants` plus a realistic `hrTriggerPrompt`.
- **Passive Study Audio Warm-Up (`HrStudyAudioBar.tsx` + `GET /api/hr/study-tts`):** Cached global-voice Gemini TTS playback in the Study Deck with variant cycling, speed control (`0.9x/1.0x/1.15x`), and Phrase -> Pause shadowing mode.
- **Guided Zero-Start Voice Mode (`guided_zero_start` / «С нуля (Повтор)»):** 4-rung Fading Scaffolding ladder (`Echo-Catch -> Paraphrase Flip -> Naked Recall -> Snowball Bridge`) with hybrid voice progression (`advance_hr_learning_step` tool) and synced UI controls (`HR_STEP_CONTROL` -> `HR_STEP_STATE`), live AI speech subtitles, toggleable cue card, and local mastery tracking.

With **Spec 41**, `guided_zero_start` decouples cleanly from Spec 38 macro-chunks (`chunks`):
- **Non-Destructive Beat Selection (`HrScopeSelector.tsx`):** Guided mode displays all atomic `microBeats` (5/5 for pitch), lets candidates select any starting beat (`startBeatId`), and explicitly chooses `all_from_beat` vs `single_beat` (focused 3-rung loop without Rung 4 Snowball).
- **Study Per-Beat Single-Focus Bridge:** `HrStudyAudioBar` exposes 1-click *«Вслух (1 блок)»* launching `single_beat` on that beat, while bottom CTA cleanly enters `all_from_beat` from Beat 1 without inheriting stale `chunkId`.
- **Voice Direct Jump & SSOT HUD:** `advance_hr_learning_step` exposes `select_beat(beatIndex)` with compact 1-line route context, and `HR_STEP_STATE` carries canonical `beats` + `beatScope` to `HrGuidedLadderBar`.

---

## 2. Functions & Components Catalog

### 2.1. Shared Schemas & TypeBox Contracts (`shared/src/schemas/hrSimulator.ts`)
- **`CandidateDossierSchema`:** Strictly validates candidate background, career tracks, compliance, financials, and showcase metrics.
- **`JobContextSchema`:** Parameterizes vacancy domain, culture red flags, and required tech keywords.
- **`HrAnchorCardSchema`:** Governs interactive HUD anchor cards with categories (`metrics`, `architecture`, `legal`, `compensation`, `motivation`) and morphological match stems.
- **`HrScorecardSchema`:** Enforces 4-axis anti-sycophancy scoring metrics ($0.30S + 0.25L + 0.25P + 0.20D \ge 85$).
- **`HrQuestionRubricItemSchema`:** Full metadata for all 12 canonical questions, including timing SLA, forbidden patterns, and required anchors.

### 2.2. Backend Services & Dispatchers (`backend/src/services/live/` & `backend/src/routes/`)
- **`hrRouter.ts`:** Exposes `GET /api/hr/questions` and `GET /api/hr/dossier` for zero-redundancy fixture streaming.
- **`hrContextResolver.ts`:** Type-safe runtime resolver with caching and multi-candidate directory resolution across dev, dist, Docker, and ts-node.
- **`hrPromptBuilder.ts`:** Dynamically synthesizes persona directives, ground-truth candidate facts, anti-sycophancy rules, and Turn 0 tool lockdowns.
- **`liveHrToolDispatcher.ts`:** Executes non-blocking Gemini Live tool calls: `advance_hr_phase`, `submit_hr_evaluation`, and `emit_hr_round_evaluation`.
- **`HrSimulationOrchestrator.ts`:** Deterministic FSM managing simulation phases, candidate speech lifecycle, 75s pacing warning, and 90s hard cutoff.

### 2.3. Frontend Client-Side KWS, Store & Pedagogical Suite
- **`ClientKeywordSpotter.ts`:** Browser-native Web Speech API interim recognizer matching prefix Tries in $<140$ms (Fast-Path Tier 1).
- **`useHrSimulatorStore.ts`:** Central store implementing Monotonic State Latch (`PENDING -> OPTIMISTIC_HIT -> CONFIRMED_HIT`), rolling WPM counter, hesitation counter, scorecard state, and pedagogical catalog state (`questionsList`, `selectedQuestionId`, `activeTab: 'study' | 'voice'`).
- **`HrQuestionStudyDeck.tsx`:** Worked-example component providing visual theory modeling, canonical answer reading with Markdown/GFM, required anchor analysis, anti-pattern comparison table, and 1-click voice bridge.
- **`HrQuestionSelector.tsx`:** Filterable catalog of all 12 questions categorized by interview phase with duration chips and anchor counts.
- **`HrVoiceHUD.tsx`, `HrAnchorCardsGrid.tsx`, `HrPacingTimerBar.tsx`, `HrScorecardModal.tsx`, `HrScreeningArena.tsx`:** Full 100dvh luxury pastel UI adhering to the platform's visual invariants.

---

## 3. Empirical Hypotheses & Verified Findings

| Hypothesis | Expected Outcome | Empirical Observation | Conclusion |
| :--- | :--- | :--- | :--- |
| **H1: Dual-Path Hybrid KWS** | Client interim speech triggers UI card $<150$ms without waiting for upstream Gemini Live turn completion. | Web Speech interim events trigger in 40–110ms; server transcript deltas reconcile in 600–900ms. | Validated. Zero-latency tactile responsiveness achieved with zero server load. |
| **H2: Anti-Sycophancy Directives** | Strict prompt rules prevent model from false compliments if candidate uses casual slang ("pet-project", "сидел дома"). | Model rigorously intercepts colloquialisms, flags red flags, and deducts lexical density points. | Validated. Radical Candor established. |
| **H3: Worked-Example Scaffolding (Wave 21)** | Reading the canonical answer and traps table prior to speaking eliminates cognitive speech freeze. | Candidate possesses clear mental model of required anchors and legal citations before starting the voice timer. | Validated. Pedagogical scaffolding eliminates blind test friction. |
| **H4: Zero Regressions** | Adding HR session modes and pedagogical components does not affect existing `interview`, `tutor`, or `system_design` modes. | All existing unit tests, prompt tests, tool isolation tests, and playout contracts continue passing 100%. | Validated. Zero regressions across all tracks. |
| **H5: In-Flight Rehearsal & Chunking (Spec 38)** | Immediate in-flight correction stops bad habits at the syllable level; chunking reduces cognitive load. | Candidate practices isolated 20-30s blocks without scorecard friction, mastering legal citations and metrics. | Validated. Deliberate practice loop established. |
| **H6: 4-Rung Fading Scaffolding & Paraphrase Diversity (Spec 40)** | Splitting answers into 8–15 word micro-beats across Echo -> Paraphrase -> Naked Recall -> Snowball eliminates zero-start freeze while varying phrasing prevents rote parroting. | 30 vetted micro-beats (3 variants each) across all 13 questions + Study TTS + hybrid `advance_hr_learning_step` / button WS sync verified in CI invariants. | Validated. Guided cold-start ladder & passive audio warm-up operational. |
| **H7: Whole-Part-Whole Beat Entry & Chunk Isolation (Spec 41)** | Decoupling `guided_zero_start` from `chunks` via `startBeatId` + `beatScope` eliminates silent 5->2 cropping and allows instant single-beat focus from lobby or Study Deck. | Suite 8 verifies 5/5 beat resolution despite stale `chunkId`, `single_beat` 3-rung cycling, and `select_beat(beatIndex)` tool sync. | Validated. Beat map, single-beat Study launch & SSOT HUD active. |

---

## 4. Key Invariants & Architectural Guardrails

1. **Rule 0 (No VPS Docker Builds):** All container images built strictly via GitHub Actions (`deploy.yml`).
2. **Rule 8 (Cognitive Bounding):** All source files strictly $\le 350$ lines for new files and $\le 400$ lines for modified files.
3. **Turn 0 Tool Lockdown:** Model is strictly forbidden from calling evaluation tools during initial greeting and question recitation.
4. **Engine vs. Payload Isolation:** No hardcoded personal names or company names in engine code; all data injected via TypeBox-validated fixtures.
5. **Monotonic State Latch:** Anchor cards never revert backwards (`CONFIRMED_HIT` cannot revert to `OPTIMISTIC_HIT` or `PENDING`).
6. **Verbatim Law/Doc Precision vs. Conversational Freedom (Spec 38):** Verbatim precision is mandatory for articles (422-ФЗ, ст. 65 ТК РФ), document forms (СТД-СФР, КНД 1122035), metrics (7+ лет, 15+ млн, 2 200 RPS) and salary (310k-330k net). Structural transitions and motivation can be freely expressed.
7. **Scorecard Suppression in Rehearsal (Spec 38):** Mode `tutor_rehearsal` strictly suppresses numerical scorecard tools and evaluation modals.
8. **Global Auto-VAD, Engine & Voice SSOT Compliance:** `HrScreeningArena`, `HrVoiceHUD`, and `hrPromptBuilder.ts` respect the active global `turnMode`, `liveModel`, `voice`, `vadPauseMs`, `enableSilenceClarification`, and `userGender` via `resolveLiveSessionConfig()`, with no hardcoded `(Aoede)` or forced manual/auto override.
9. **Hybrid Guided Sync & Non-Parroting Boundary (Spec 40):** `guided_zero_start` also suppresses scorecards, never hardcodes wording parroting on connective glue while locking `immutableFacts` verbatim, keeps `advance_hr_learning_step` gated on Turn 0, and treats `toggle_cue` silently without interrupting Gemini Live.
10. **Chunk vs Micro-Beat Decoupling (Spec 41):** `resolveGuidedSessionBeats()` ignores `chunkId` in `guided_zero_start`, gating Rung 4 strictly on `beats.length >= 2 && masteredBeatIds.length >= 1`, and broadcasting server SSOT `beats` in `HR_STEP_STATE`.
