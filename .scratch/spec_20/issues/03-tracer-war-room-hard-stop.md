### Description
Enforce categorical Hard Stop on destructive candidate actions and integrate epistemic triage in Incident Commander War Room (`backend/src/prompts/triage/triagePrompts.ts`).

### Invariants & Requirements
1. **Categorical Hard Stop:** In `buildTriageProbePrompt`, replace tentative asking ("А вы уверены?") with an authoritative Hard Stop:
   - When candidate proposes dangerous actions (restarting pods under 100k RPS storm, expanding connection pool to dead DB, disabling circuit breakers, killing worker threads): immediately halt with *"СТОП. В продакшене я блокирую эту команду..."*, name physical infrastructure consequence, and demand safe diagnostic localization.
2. **Epistemic SSOT Integration:** Import and wire `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE` from `../core/antiSycophancy`.
3. **Rule 8 Compliance:** `triagePrompts.ts` must remain $\le 400$ lines (currently 200 lines).

### Acceptance Criteria
- Section 3 of Operational Protocol in `triagePrompts.ts` enforces Hard Stop.
- `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE` are present in returned prompt.
- `triagePrompts.ts` $\le 400$ lines.
