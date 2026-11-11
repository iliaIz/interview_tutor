### Description
Extract tutor prompt templates, grading bans, and epistemic envelope builders from `backend/src/services/live/livePromptBuilder.ts` into a new SRP module `backend/src/services/live/liveTutorPromptDirectives.ts` ($\le 350$ lines).

### Invariants & Requirements
1. **Rule 8 Compliance:** `liveTutorPromptDirectives.ts` $\le 350$ lines.
2. **Decomposition:** Extract `TUTOR_ZERO_GRADING_INSTRUCTION`, `buildCognitiveEpistemicDirectives`, `buildTutorCustomOverridePrompt`, `buildBugHuntTutorPrompt`, `buildFreeChatTutorPrompt`, and generic tutor mode helpers.
3. **Non-Bypassable Epistemic Envelope:** Wire `cognitiveEpistemicDirectives` (containing `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE`) into all branches, including `customPromptOverride` (tutor & interview).
4. **Eliminate Sycophancy:** In `bug_hunt` replace "мягко подтверди" / "похвали" with hypothesis triage; in `free_chat` replace "Всегда поддерживай" with epistemic truth demarcation.
5. **Preserve Contracts:** Reduce `livePromptBuilder.ts` line count without breaking `buildSystemPrompt` signature.

### Acceptance Criteria
- `liveTutorPromptDirectives.ts` created and passes typecheck.
- `livePromptBuilder.ts` line count reduced.
- All branches of `livePromptBuilder.ts` contain `EPISTEMIC_BENEVOLENCE_AXIOM`.
