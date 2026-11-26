# Spec 55: `LivePromptComposer`, `questionMatrixId` Wiring & Prompt Test Decomposition

> **Governing Glossary:** `LivePromptComposer`, `LiveSessionBlueprint`, `Turn 0 Lockdown` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md), [ADR 0006](../../adr/0006-evaluation-memory-cascade-and-json-catalogs.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Pure prompt synthesis `< 1ms` (`0` sync `fs` inside composer)

---

## 1. Intent & Workload Envelope
Collapse the 53-field inline parameter bag in `livePromptBuilder.ts` (373L) and its 5 single-caller helper modules (`liveMockInterviewPromptBuilder`, `liveSystemDesignPromptBuilder`, `liveTutorSessionPromptBuilder`, `livePromptBuilderConstants`, `liveTutorPromptDirectives`) into a pure, declarative `LivePromptComposer` (`composeLiveSystemPrompt(config, hrContext?)`). Move synchronous HR fixture loading out of import/prompt-build time into `LiveSessionBlueprintBuilder`, wire the dropped `questionMatrixId` parameter from Spec 53 end-to-end, fix BOTH confirmed bugs omitting `LIVE_TOOL_CAPABILITY_DIRECTIVES` (`socratic_tutoring + mentor` branch and `customPromptOverride` branch), enforce `AGENTS.md §2.1` Turn 0 Lockdown across all mock-interview branches, and decompose `verifyPrompts.ts` (739L -> `<= 350L` modules) while adding assertions for previously untested prompt branches.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT remove exported helpers `extractDefaultAnchors` or `buildWeightedRubric` from `liveRubricBuilder.ts` (consumed by `liveEvaluationToolDispatcher.ts` without importing HR/prompt modules).
- Do NOT degrade any existing prompt security or anti-sycophancy invariants checked by `verifyPrompts.ts`, `test_hr_simulator_engine.js`, or `test_hr_acoustic_canary.js`.
- Every newly created or modified file (including split prompt test scripts under `backend/src/scripts/`) stays `<= 350L` (new) / `<= 400L` (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `composeLiveSystemPrompt(config: LivePromptInput, preResolvedHrContext?: PreResolvedHrContext)` in `backend/src/services/live/LivePromptComposer.ts` + `LiveSessionBlueprintBuilder.resolveFromRequest`.
- **Adapters (`local-substitutable`):** Pure in-memory fixture maps passed as `PreResolvedHrContext` in tests; cached fixture repository initialized explicitly by `LiveSessionBlueprintBuilder` / `hrContextResolver` without top-level module `fs.existsSync` side effects during unrelated imports.
- **Verification Command (CI):** `npm run test:prompts && npm run test:hr && npm run test:vad:unit && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface PreResolvedHrContext {
  dossier: CandidateDossier;
  jobContext: JobContext;
  question?: HrQuestion;
  chunk?: HrQuestionChunk;
}

export function composeLiveSystemPrompt(
  config: LiveSessionResolvedConfig | Partial<LivePromptInput>,
  preResolvedHrContext?: PreResolvedHrContext
): string;
```
- **Declarative Mode Table & Envelope Invariants:**
  - `mock_interview` (`socratic_tutoring`, `adaptive_probing`, and `customPromptOverride > 20` chars) MUST unconditionally include **both** `firstTurnLockdownInstruction` (`submit_interview_evaluation` forbidden during Turn 0 greeting per `AGENTS.md §2.1`) **and** role-accurate `LIVE_TOOL_CAPABILITY_DIRECTIVES` (`update_whiteboard` plus declared arena tools).
  - Non-HR envelope (`rubric`, `whiteboardInstruction`, `activeArtifactSection`) is skipped cleanly on `isHrSessionType(sessionType)` so HR sessions do zero wasted work.
  - Dead imports and unread params (`targetSeniority`, 5 unused directive imports, duplicated `candidateDossier`/`jobContext`/`hrQuestion`) are removed.
- **`questionMatrixId` Resolution Contract:** `hrContextResolver.getHrQuestion(questionId, chunkId, matrixId?)` honors `matrixId` (`canonical_question_matrix` default; structured error or explicit named matrix lookup without silently corrupting custom matrices when loaded).

---

## 5. Storage & Zero-Downtime Migration Contract
- Zero SQLite changes.
- Preserve backward-compatible named export `buildSystemPrompt` delegating to `composeLiveSystemPrompt` inside `LivePromptComposer.ts` (or slim `livePromptBuilder.ts` adapter if needed by external scripts) so `LiveSessionBlueprintBuilder` and test scripts migrate without breaking signatures; update `liveEvaluationToolDispatcher.ts` to import `buildWeightedRubric` directly from `./liveRubricBuilder`.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `LiveSessionResolvedConfig` (with optional `questionMatrixId`, `dossierId`, `jobId` from `?awaitInit=1` or URL) + optional pre-loaded `PreResolvedHrContext`.
- `{C}` Dispatch via declarative session-type table (`hr_*` -> `buildHrSystemPrompt`; `practice_pair` / `bug_hunt` -> tutor directives table; `system_design` -> system design prompt; `interview` -> mock envelope with `customPromptOverride`, `socratic_tutoring`, or `adaptive_probing`), guaranteeing Turn 0 Lockdown + `LIVE_TOOL_CAPABILITY_DIRECTIVES` on all interview branches.
- `{Q}` Deterministic prompt string built in `<1ms` with zero hidden `fs` reads inside composer; `verifyPrompts.ts` split `<= 350L` per module passes including assertions for `socratic_tutoring` (`persona: 'mentor'`), `customPromptOverride`, `questionMatrixId`, and `hr_*` session prompts.
