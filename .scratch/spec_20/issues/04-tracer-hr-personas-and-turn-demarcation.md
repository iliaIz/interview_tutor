### Description
Strengthen objectivity and eliminate conversational flattery in HR Screening (`backend/src/services/live/hrPromptBuilder.ts`), Personas catalog (`backend/src/prompts/personas.ts`), and the multi-turn engine (`backend/src/routes/interviewTurn.ts`).

### Invariants & Requirements
1. **HR Screening:**
   - In `hrPromptBuilder.ts`, add Rule 5 to `HR_ANTI_SYCOPHANCY_DIRECTIVES`: Epistemic Benevolence Axiom & Demarcation (polite recruiter tone never justifies accepting euphemisms, fuzzy numbers, or missing dossier anchors).
2. **Personas Catalog:**
   - In `personas.ts`, update `friendly_sourcer` to decouple warmth from score inflation (zero flattery for evasive answers).
   - In `personas.ts`, update `mentor` with mandatory truth demarcation protocol.
3. **Multi-Turn Interview Engine:**
   - In `interviewTurn.ts`, eliminate "мягко покажи" in favor of direct boundary demarcation: divide correct vs flawed claims and explain runtime mechanics.
   - Inject `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE` into `systemPrompt`.
4. **Rule 8 Compliance:**
   - `hrPromptBuilder.ts` $\le 400$ lines.
   - `personas.ts` $\le 400$ lines.
   - `interviewTurn.ts` $\le 556$ lines (no bloat).

### Acceptance Criteria
- `friendly_sourcer` and `mentor` contain explicit anti-flattery guards.
- `hrPromptBuilder.ts` includes Rule 5.
- `interviewTurn.ts` eliminates "мягко покажи" and enforces demarcation.
