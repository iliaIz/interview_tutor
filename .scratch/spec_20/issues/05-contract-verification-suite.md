### Description
Add comprehensive automated assertions for Spec 20 to `backend/src/scripts/verifyPrompts.ts` and verify all quality gates via `remote-verify`.

### Invariants & Requirements
1. **Automated Assertions in `verifyPrompts.ts`:**
   - Assert `buildSystemPrompt` with `customPromptOverride` contains `EPISTEMIC_BENEVOLENCE_AXIOM` and `MANDATORY TRUTH DEMARCATION`.
   - Assert `buildSystemPrompt` (tutorMode: `bug_hunt`) contains bug hunt triage and does NOT contain "мягко подтверди" or "похвали".
   - Assert `buildSystemPrompt` (tutorMode: `free_chat`) contains free chat truth demarcation and does NOT contain "Всегда поддерживай" without correction.
   - Assert `buildSystemDesignProbePrompt` contains `CAPACITY_MATH_VERIFICATION_GATE`.
   - Assert `buildTriageProbePrompt` contains `HARD STOP НА ДЕСТРУКТИВНЫЕ ДЕЙСТВИЯ`.
   - Assert `buildHrSimulatorSystemPrompt` contains Rule 5 demarcation.
   - Assert `personas.ts` `friendly_sourcer` and `mentor` contain anti-flattery guards.
2. **Rule 8 File Length Invariant:**
   - Assert `liveTutorPromptDirectives.ts` $\le 350$ lines.
   - Assert `systemDesignPrompts.ts`, `triagePrompts.ts`, `hrPromptBuilder.ts`, `personas.ts` $\le 400$ lines.
   - Assert `livePromptBuilder.ts` $< 742$ lines.
   - Assert `interviewTurn.ts` $\le 556$ lines.
3. **CI Execution:**
   - Pass all quality gate steps in GitHub Actions cloud runner via `remote-verify`.

### Acceptance Criteria
- `verifyPrompts.ts` executes with zero assertion failures.
- `remote-verify` passes in CI.
