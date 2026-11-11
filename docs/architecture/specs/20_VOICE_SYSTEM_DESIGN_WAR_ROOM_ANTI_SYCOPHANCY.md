# Spec 20: Epistemic Benevolence & Anti-Sycophancy Triage Architecture (Part 2: Live Voice Sessions, System Design, War Room & HR Screening)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [GLOSSARY.md](../../../GLOSSARY.md), [PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md](../../reports/PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md), [Spec 19](19_EPISTEMIC_BENEVOLENCE_AND_ANTI_SYCOPHANCY_TRIAGE.md), and Architectural Decision Record in `.ai/handoff/architect_response.md`.
- **Domain Intent**: Eradicate AI sycophancy (поддакивание, false affirmation, conversational flattery, premature mathematical validation, and timid safety probing) across real-time Gemini Live WebSocket simulations, System Design capacity estimations, Incident War Room triage, HR screening, and the multi-turn interview router.
- **Operating Envelope**:
  - Gemini Live Audio WebSocket streaming via LiteLLM Proxy: Response latency $\le 800$ ms, oral output strictly bounded to 2–3 sentences (up to 25–35 words per turn), zero character-by-character code recitation.
  - Multi-turn REST/SSE interview probes: 2–3 concise sentences, structured JSON output (`action: "probe" | "evaluate"`), zero sycophantic opening phrases.
  - File Length Invariants (Rule 8): Newly created files $\le 350$ lines, modified files $\le 400$ lines. Monolithic files exceeding 400 lines (`livePromptBuilder.ts` = 742 lines, `interviewTurn.ts` = 556 lines) MUST NOT expand; prompt logic must be decomposed into dedicated SRP modules (`liveTutorPromptDirectives.ts`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. WebSocket transport layers, audio buffer handling, and framing logic in `LiveVoiceSession.ts`, `liveWsConnectionHandler.ts`, and `sessionFsm.ts`.
2. Existing AST analysis rules, sandboxing containers, and PostgreSQL/SQLite database schemas.
3. AudioWorklet DSP pipelines, Web Audio nodes, and gain controls (`AudioPlayoutManager.ts`, `LiveVoiceFrameParser.ts`).
4. TypeBox schemas in `shared/src/schemas/tutorContext.ts` and `shared/src/schemas/companyProfile.ts` (100% backward wire compatibility).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam 1 (Live Prompt Builder & Tutor Directives)**:  
  `backend/src/services/live/livePromptBuilder.ts` & `backend/src/services/live/liveTutorPromptDirectives.ts`
- **Primary Seam 2 (System Design Capacity Calculations & Architecture Probes)**:  
  `backend/src/prompts/systemDesign/systemDesignPrompts.ts`
- **Primary Seam 3 (Incident Commander War Room Triage)**:  
  `backend/src/prompts/triage/triagePrompts.ts`
- **Primary Seam 4 (HR Screening Simulator & Personas Catalog)**:  
  `backend/src/services/live/hrPromptBuilder.ts` & `backend/src/prompts/personas.ts`
- **Primary Seam 5 (Multi-Turn Turn Router)**:  
  `backend/src/routes/interviewTurn.ts`
- **Primary Seam 6 (Automated Prompt Verification Suite)**:  
  `backend/src/scripts/verifyPrompts.ts`
- **Verification Command**:  
  `remote-verify` (Cloud verification via GitHub Actions runner to preserve the 1.8 GB VPS memory boundary) and static line count validation (`wc -l`).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Live Tutor Prompt Directives Module Contract (`liveTutorPromptDirectives.ts`)
```typescript
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';

export interface TutorCustomOverridePromptParams {
  customPromptOverride: string;
  genderRule: string;
  cognitiveEpistemicDirectives: string;
  questionText: string;
  referenceAnswer: string;
}

export interface BugHuntTutorPromptParams {
  isFemale: boolean;
  genderRule: string;
  cognitiveEpistemicDirectives: string;
  taskContextBlock: string;
}

export interface FreeChatTutorPromptParams {
  isFemale: boolean;
  genderRule: string;
  cognitiveEpistemicDirectives: string;
  contextBlock: string;
}

export interface GenericTutorPromptParams {
  modeTitle: string;
  roleDescription: string;
  genderRule: string;
  cognitiveEpistemicDirectives: string;
  contextBlock: string;
  rulesBlock: string;
}

export const TUTOR_ZERO_GRADING_INSTRUCTION: string;

export function buildCognitiveEpistemicDirectives(
  strictnessDirective: string
): string;

export function buildTutorCustomOverridePrompt(
  params: TutorCustomOverridePromptParams
): string;

export function buildBugHuntTutorPrompt(
  params: BugHuntTutorPromptParams
): string;

export function buildFreeChatTutorPrompt(
  params: FreeChatTutorPromptParams
): string;

export function buildGenericTutorPrompt(
  params: GenericTutorPromptParams
): string;
```

### 4.2. Capacity Math Verification Gate Contract (`systemDesignPrompts.ts`)
```typescript
export const CAPACITY_MATH_VERIFICATION_GATE: string;
```

### 4.3. Incident Commander War Room Hard Stop Contract (`triagePrompts.ts`)
```typescript
// Section 3 of OPERATIONAL PROTOCOL in buildTriageProbePrompt
// Mandatory Hard Stop interception on destructive candidate actions
```

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only & in-place prompt enhancement. Zero database migrations, zero schema changes.
- **Backward Compatibility**: 100% preservation of all public function signatures:
  - `buildSystemPrompt(options: BuildSystemPromptOptions): string`
  - `buildSystemDesignProbePrompt(params: SystemDesignProbeParams): string`
  - `buildTriageProbePrompt(params: TriageProbeParams): string`
  - `buildHrSimulatorSystemPrompt(opts: BuildHrSystemPromptOptions): string`
  - `getPersonaPromptDirectives(params: PersonaDirectiveParams): PersonaPromptDirectives`

---

## 6. Behavioral Contracts & Verification Invariants ({P} C {Q})

### 6.1. Non-Bypassable Epistemic Envelope Invariant
- **Pre-Condition {P}**: A caller requests a system prompt for Gemini Live with an arbitrary `customPromptOverride` string.
- **Algorithm C**: `buildSystemPrompt` intercepts the override, injects `genderRule`, mandatory `cognitiveEpistemicDirectives` (containing `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE`), and appends the final epistemic recency lock.
- **Post-Condition {Q}**: The returned prompt string contains `EPISTEMIC_BENEVOLENCE_AXIOM`, `MANDATORY TRUTH DEMARCATION`, and `ZERO FALSE AFFIRMATION` regardless of what user string was provided.

### 6.2. Bug Hunt & Free Chat Demarcation Invariant
- **Pre-Condition {P}**: A user is in a `bug_hunt` or `free_chat` live voice session.
- **Algorithm C**: The system prompt instructs the AI that the candidate's hypotheses must be triaged without sycophantic openers. "Мягко подтверди" and "похвали" are eliminated.
- **Post-Condition {Q}**: If the hypothesis is flawed or secondary, the AI demarcates the boundary in the first sentence and redirects to root cause with an adversary counterexample.

### 6.3. System Design Capacity Math Rigor Invariant
- **Pre-Condition {P}**: A candidate calculates RPS or storage in System Design mode.
- **Algorithm C**: `CAPACITY_MATH_VERIFICATION_GATE` strictly forbids praising or confirming intermediate calculations before the full capacity equation (Peak Factor, 3x replication factor, retention, IOPS) balances.
- **Post-Condition {Q}**: Flawed or incomplete math triggers immediate demarcation without flattery.

### 6.4. Incident War Room Hard Stop Invariant
- **Pre-Condition {P}**: A candidate suggests a destructive action in War Room (e.g. restarting pods under 100k RPS storm, expanding connection pools to an unresponsive database).
- **Algorithm C**: Incident Commander executes an immediate Hard Stop: *"СТОП. В продакшене я блокирую эту команду..."* with explicit physical consequence and demand for safe localization.
- **Post-Condition {Q}**: The AI never politely asks "Are you sure?", but authoritatively halts the destruction.
