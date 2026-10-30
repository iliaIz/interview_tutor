# Phase 3: Backend Session Resolver & Modular Prompt Generator

> **Document:** `docs/hr_screening_engine/phases/phase_03_backend_session_resolver_and_prompt_builder.md`  
> **Status:** Phase 3 Specification & Execution Gate  
> **Quality Gate G3:** `npm --prefix backend run build` and `npm run test:prompts` exit code 0.

---

## 1. Objectives & Scope
1. Update `backend/src/services/live/liveWsSessionParams.ts`:
   - Extend `sessionType` union with `'hr_simulation' | 'hr_micro_drill'`.
   - Parse `dossierId`, `jobId`, `personaId`, and `targetQuestionId`.
   - Resolve HR context via `hrContextResolver.ts`.
2. Implement `backend/src/services/live/hrPromptBuilder.ts`:
   - Builds system prompt with dynamic Ground Truth injection from `CandidateDossier`.
   - Enforces `HR_ANTI_SYCOPHANCY_DIRECTIVES` (zero flattery, euphemism interception, defensiveness flag).
   - Injects Turn 0 question recitation instructions and pacing constraints.
3. Update `backend/src/prompts/personas.ts`:
   - Add cases for `friendly_sourcer`, `bank_compliance_officer`, `behavioral_conflict_hunter`.
4. Delegate cleanly in `backend/src/services/live/livePromptBuilder.ts` when `isHrSessionType(sessionType)`.

---

## 2. Invariants & Guardrails
- `hrPromptBuilder.ts` $\le 300$ lines.
- `personas.ts` modifications $\le 40$ lines.
- `livePromptBuilder.ts` changes $\le 15$ lines.
- Existing prompt tests (`npm run test:prompts`) pass without errors.

---

## 3. Verification Commands
```bash
npm --prefix backend run build
npm --prefix backend run test:prompts
```
