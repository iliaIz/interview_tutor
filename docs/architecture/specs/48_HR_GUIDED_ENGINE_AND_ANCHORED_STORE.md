# Spec 48: Pure `GuidedHrSessionEngine`, Dossier Parameterization & Anchored HR Store

> **Governing Glossary:** `Design Pattern Kata` (style invariants), `Engine vs. Payload Isolation` ([08_hr_voice_simulator_engine.md](../functional_registry/08_hr_voice_simulator_engine.md))  
> **Governing ADRs:** All existing HR Spec 38 / 40 / 41 invariants (`single_beat`, `all_from_beat`, Zero Scorecard in Tutor/Guided, Monotonic State Latch)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · `<= 400L` File Hygiene Safety

---

## 1. Intent & Workload Envelope
Separate pure HR guided FSM + single-source rung directive formatting (`formatRungPromptDirective`, `ensureSessionGuidedState`) out of WS side-effects in `hrGuidedStepper.ts` (`369L -> <= 230L`), eliminating 3-way duplicated rung directives (`hrGuidedStepper`, `liveHrToolDispatcher`, `LiveGreetingReplay`); parameterize hardcoded personal/company literals in `hrPromptBuilder.ts` and `personas.ts` from injected `CandidateDossier`; delete dead `HrSimulationOrchestrator.ts` (0 production callers) while wiring real turn metrics into `liveHrToolDispatcher` scorecards; and extract `hrAnchorResolver.ts` to keep `useHrSimulatorStore.ts` well below the 400-line hygiene ceiling (`397L -> <= 250L`) while fixing the `resetForRetry` `single_beat` anchor-filter parity bug.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- **UI Deletion Test Exception:** Never delete conditional rendering or accessibility markup in `HrScreeningArena.tsx`, `HrScopeSelector.tsx`, `HrGuidedLadderBar.tsx`, `HrStudyAudioBar.tsx`, or `HrVoiceHUD.tsx`.
- Preserve 100% of verified facts in `json/hr/candidateDossier.json` and `canonicalQuestionMatrix.json`.

---

## 3. Pre-Agreed Verification Seams
- **Backend Seam:** Pure `hrGuidedStepper` (`resolveGuidedSessionBeats`, `applyGuidedStepAction`, `formatRungPromptDirective`, `ensureSessionGuidedState`) + `buildHrSimulatorSystemPrompt` + `liveHrToolDispatcher` tested in `backend/tests/test_hr_simulator_engine.js`.
- **Frontend Seam:** Pure `hrAnchorResolver.ts` + `useHrSimulatorStore` actions tested cleanly without DOM mounts.
- **Verification Commands (CI):** `npm run test:prompts && npm run test:hr && npm run test:audio-contracts`.

---

## 4. Formal Wire & Messaging Contracts
```ts
// Pure SSOT Directive Builder (replaces 3 duplicated builders)
export function formatRungPromptDirective(
  payload: HrStepStatePayload,
  triggerSource: 'greeting' | 'ai_tool' | 'client_button',
  action?: HrStepControlAction
): string;

export function ensureSessionGuidedState(
  session: { hrGuidedState?: HrGuidedSessionState | null; questionId?: string; startBeatId?: string; beatScope?: HrBeatScope }
): { question: HrQuestionRubricItem | undefined; beats: HrMicroBeat[]; state: HrGuidedSessionState } | null;

// Frontend Pure Resolver Seam
export function resolveAnchorsForSession(
  question: HrQuestionRubricItem,
  opts: { mode: HrSessionMode; chunkId?: string | null; startBeatId?: string | null; beatScope?: HrBeatScope }
): HrAnchorCard[];
```
- `hrContextResolver.ts` validates each loaded rubric item in `canonicalQuestionMatrix.json` using TypeBox `Value.Check(HrQuestionRubricItemSchema, q)`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Zero SQL/filesystem storage migrations; preserves `hrMasteryStorage` `localStorage` key schema cleanly.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- **Engine vs. Payload & Schema Validation:**
  - `{P}` Arbitrary `CandidateDossier` & `JobContext` + `HrQuestionRubricItem`.
  - `{C}` Render prompts using dossier fields (`fullName`, `targetSalaryNet`, `compliance.receiptsLegalJustification`, `careerTracks[0].companyAlias`) and validate questions with TypeBox on load.
  - `{Q}` Swapping dossier in tests changes prompt output with zero engine edits; invalid rubric JSON fails fast on load.
- **Retry Parity & Hygiene:**
  - `{P}` `useHrSimulatorStore` in `guided_zero_start` + `single_beat` on Beat #2.
  - `{C}` Invoke `resetForRetry()`.
  - `{Q}` `anchorCards` matches the exact subset of anchors belonging to Beat #2 (identical to `initializeSession`); `useHrSimulatorStore.ts <= 260` lines and `hrGuidedStepper.ts <= 240` lines.
