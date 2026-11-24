# Spec 38: HR Voice Tutor Rehearsal, Chunking & In-Flight Error Correction

> **Spec ID:** `38`  
> **Status:** Approved / Authoritative SSOT  
> **Location:** `docs/architecture/specs/38_HR_VOICE_TUTOR_REHEARSAL_AND_CHUNKING.md`  
> **Target Standard:** SOTA Late 2026 / Zero-Flattery Deliberate Voice Practice  
> **Parent Specification:** [`08_HR_VOICE_SIMULATOR_ENGINE.md`](../functional_registry/08_hr_voice_simulator_engine.md)

---

## 1. Intent & Workload Envelope

### 1.1. Context & Business Intent
The current HR screening engine provides two polar modalities: passive visual reading ([`HrQuestionStudyDeck.tsx`](../../frontend/src/components/practice/hr/HrQuestionStudyDeck.tsx)) and high-stakes examination (`rapid_fire_micro_drill` with strict anti-sycophantic penalties and post-factum grading). Candidates learning answers from scratch face an overwhelming cognitive load gap.

Spec 38 introduces a dedicated **Interactive Rehearsal Partner Mode (`tutor_rehearsal`)** with persona **`mentor_coach` ("Ольга" — Aoede voice)**. Unlike passive listeners or post-factum examiners, the tutor acts as an active in-flight sparring coach:
1. **In-Flight Interception:** Detects colloquialisms, stop-words ("сидела дома", "пет-проект", "фриланс"), or factual distortions (understating tenure, wrong legal articles) in real time. Rather than waiting for the round to fail, the tutor interrupts post-pause, explains the failure, provides the canonical phrasing, and demands immediate repetition.
2. **On-Demand Verbal Cues:** When the candidate explicitly asks for help (*"подскажи"*, *"какая статья"*, *"что дальше"*), the tutor provides a concise 1-2 sentence fact and prompts the candidate to resume.
3. **Chunking vs. Full Answer Support:** Supports rehearsing a question end-to-end or breaking it down into 2-3 logical anchor clusters (chunks) for isolated motor mastery.
4. **Epistemic Invariant (Fact Precision vs. Phrasing Freedom):** Strict verbatim compliance is enforced ONLY on legal articles (ст. 2 и 14 ФЗ № 422-ФЗ, ст. 65 ТК РФ), document names (СТД-СФР, КНД 1122035), metrics (7+ лет, 15+ млн, 2 200 RPS k6) and salary (310k-330k net). Conversational transitions, narrative phrasing, and personal motivation can be freely expressed.
5. **No End-of-Session Scorecard:** The rehearsal mode eliminates numerical grades and modal evaluation popups, focusing 100% on verbal drills.

### 1.2. Operating Envelope
- **Latency SLA:** In-flight correction turn response $\le 650$ ms via Gemini Live Aoede voice stream.
- **Tenancy & Concurrency:** Real-time bi-directional 16kHz PCM audio stream routed through `LiteLLM_Proxy`.
- **Session Types:** `hr_tutor` / `tutor_rehearsal`.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

1. **NO UI Hint Buttons or Pause Timers:** No synthetic on-screen buttons ("💡 Подскажи") or automatic whisper triggers on silence. Candidate asks for help verbally.
2. **NO Modification to Existing Examiner Personas:** `friendly_sourcer`, `bank_compliance_officer`, and `behavioral_conflict_hunter` remain strictly evaluation-focused and unchanged.
3. **NO Modification to General Sandbox or LLD Engines:** Changes strictly bounded to `hrSimulator.ts`, `hrPromptBuilder.ts`, `hrContextResolver.ts`, and `frontend/src/components/practice/hr/`.
4. **NO Numerical Scorecard Popup in Rehearsal Mode:** In `tutor_rehearsal`, `emit_hr_round_evaluation` is suppressed; session remains interactive without modal interrupts.

---

## 3. Pre-Agreed Verification Seams

- **Primary Seam 1 (Backend Prompt & Mode Resolution):** `backend/src/services/live/hrPromptBuilder.ts` and `hrContextResolver.ts`.
- **Primary Seam 2 (Shared TypeBox Contracts):** `shared/src/schemas/hrSimulator.ts`.
- **Primary Seam 3 (Frontend State & UI Orchestration):** `frontend/src/store/useHrSimulatorStore.ts` and `frontend/src/components/practice/hr/HrScreeningArena.tsx`.
- **Verification Commands:**
  - Automated canary test: `backend/tests/test_hr_simulator_engine.js` & `backend/tests/test_hr_acoustic_canary.js`.
  - Cloud runner verification: `remote-verify`.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Shared TypeBox Schema Updates (`shared/src/schemas/hrSimulator.ts`)

```typescript
// 1. Extend Session Modes
export const HrSessionModeSchema = Type.Union([
  Type.Literal('full_screening_simulation'),
  Type.Literal('rapid_fire_micro_drill'),
  Type.Literal('tutor_rehearsal')
]);

// 2. Extend Personas
export const HrPersonaIdSchema = Type.Union([
  Type.Literal('friendly_sourcer'),
  Type.Literal('bank_compliance_officer'),
  Type.Literal('behavioral_conflict_hunter'),
  Type.Literal('mentor_coach')
]);

// 3. Question Chunk Definition
export const HrQuestionChunkSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  anchorIds: Type.Array(Type.String()),
  targetDurationSec: Type.Object({
    minSec: Type.Integer({ default: 20 }),
    maxSec: Type.Integer({ default: 35 })
  })
});
export type HrQuestionChunk = Static<typeof HrQuestionChunkSchema>;

// 4. Attach Chunks to Question Rubric Item
export const HrQuestionRubricItemSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  canonicalQuestion: Type.String(),
  referenceAnswer: Type.String(),
  targetDurationSec: Type.Object({
    minSec: Type.Integer({ default: 60 }),
    maxSec: Type.Integer({ default: 80 }),
    hardCapSec: Type.Integer({ default: 90 })
  }),
  requiredAnchors: Type.Array(HrAnchorCardSchema),
  forbiddenPatterns: Type.Array(Type.String()),
  chunks: Type.Optional(Type.Array(HrQuestionChunkSchema)),
  phase: Type.Optional(HrSimulationPhaseSchema)
});
```

### 4.2. WebSocket Initiation Message Contract

```typescript
{
  sessionType: 'hr_tutor',
  hrMode: 'tutor_rehearsal',
  hrPersonaId: 'mentor_coach',
  dossierId: 'canonical_senior_java',
  jobId: 'fintech_highload_expansion',
  questionId: 'hr_q0_elevator_pitch',
  chunkId?: 'chunk_1_btlab' // optional: when rehearsing specific chunk
}
```

---

## 5. Storage & Zero-Downtime Migration Contract

- **Additive-Only Fixture Enhancement:**
  - `backend/src/data/hr/fixtures/canonicalQuestionMatrix.json` is updated with `chunks` for all canonical questions (2–3 chunks per question).
  - Existing clients without chunk awareness default to full question mode (`chunkId: undefined`).
  - Zero database DDL or state migration required (stateless WebSocket session initialization).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Rehearsal Session Initialization
- **Pre-Conditions {P}:**
  - Valid `dossierId` and `questionId` supplied in connect payload.
  - `hrMode === 'tutor_rehearsal'` and `hrPersonaId === 'mentor_coach'`.
- **Algorithm C:**
  - Resolver selects `Aoede` voice (Russian female, warm yet authoritative timbre).
  - If `chunkId` is provided, filter `requiredAnchors` to only those in the chunk; prompt focuses strictly on that chunk's duration and deliverables.
  - System prompt injects `TUTOR_REHEARSAL_DIRECTIVES`:
    1. Turn 0 greeting announces question or specific chunk.
    2. Strict listening while speech is factual.
    3. In-flight stop on forbidden phrases, factual distortion, or self-deprecation.
    4. Direct, crisp answer on verbal help requests (*"подскажи..."*).
    5. Zero sycophancy; demand verbal re-take of weak phrases.
- **Post-Conditions {Q}:**
  - Bi-directional stream established. Model recites opening instruction without evaluation tool invocation.

### 6.2. In-Flight Error Correction Loop
- **Pre-Conditions {P}:**
  - Candidate speaks an utterance containing a phrase from `forbiddenPatterns` or violating `CandidateDossier` ground truth, followed by a natural conversational pause ($> 600$ ms).
- **Algorithm C:**
  - Gemini Live synthesizes an immediate corrective intervention:
    1. "Стоп." + identification of the exact error.
    2. Explicit explanation of why it is unacceptable in a Senior screening.
    3. The canonical phrasing based on the dossier.
    4. Imperative instruction to repeat: "Повтори эту фразу прямо сейчас!".
- **Post-Conditions {Q}:**
  - Playout manager streams correction to DAC. Mic opens for candidate's second attempt.

### 6.3. Verbal Help Request Handling
- **Pre-Conditions {P}:**
  - Candidate says: "подскажи...", "какая статья...", "что дальше?", "забыла цифру...".
- **Algorithm C:**
  - Model supplies the required fact/article/metric in 1-2 concise sentences.
  - Model appends: "Повтори теперь своими словами".
- **Post-Conditions {Q}:**
  - Candidate hears precise fact without shaming or penalty.
