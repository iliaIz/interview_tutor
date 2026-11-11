### Description
Enforce mathematical rigor and anti-sycophancy in `backend/src/prompts/systemDesign/systemDesignPrompts.ts` for Back-of-the-Envelope Capacity Estimations and System Design architecture probes.

### Invariants & Requirements
1. **Capacity Math Verification Gate:** Define `CAPACITY_MATH_VERIFICATION_GATE` integrating `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE`.
2. **Ban on Premature Approval:** Forbid praising or confirming intermediate calculations before the full capacity equation (Peak Factor 2-3x, Replication Factor 3x, retention, IOPS, network bandwidth) balances.
3. **Eliminate Sycophancy in ELI5 & Free Chat:**
   - In `mathModeDirectives.eli5`: replace "Будь теплым, поддерживающим наставником" with objective, clear guidance without false nods.
   - In `mathModeDirectives.free_chat`: replace generic flattery with strict verification of every number and coefficient.
   - In `scenarioModeDirectives.eli5` & `free_chat`: eliminate false confirmation of architectural anti-patterns (SPOF, missing idempotency, synchronous bottlenecks).
4. **Rule 8 Compliance:** `systemDesignPrompts.ts` must remain $\le 400$ lines (currently 266 lines).

### Acceptance Criteria
- `CAPACITY_MATH_VERIFICATION_GATE` wired into math trainer and scenario probes.
- Zero false affirmation of intermediate formulas.
- `systemDesignPrompts.ts` $\le 400$ lines.
