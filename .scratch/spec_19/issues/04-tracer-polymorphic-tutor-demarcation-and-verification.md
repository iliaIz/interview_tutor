# 04: [Tracer-Bullet] Polymorphic Cross-Arena Socratic Copilot Demarcation & Verification Suite

**Parent:** SPEC-19 (#101)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #102, #103, #104  
**Status:** ready-for-agent  

## What to Build
1. In `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`:
   - Define `POLYMORPHIC_EPISTEMIC_FOOTER` enforcing the Epistemic Benevolence standard and mandatory boundary demarcation.
   - Integrate `POLYMORPHIC_EPISTEMIC_FOOTER` into `buildSqlArenaTutorPrompt`, `buildCompanyStudioTutorPrompt`, and `buildGeneralEnterpriseTutorPrompt`.
   - Preserve all existing dynamic context bindings: PgLite table diff summaries (`diffSummary`), DDL/Seed schema, candidate SQL queries, runtime errors, company culture metrics, red/green flags, and take-home context.
2. Verification:
   - Ensure `backend/tests/test_polymorphic_prompt_builder.js` (or prompt verification scripts) pass with the updated prompts.
   - Run `remote-verify` across all 24 CI steps to guarantee zero regressions.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `POLYMORPHIC_EPISTEMIC_FOOTER` is embedded in all 3 polymorphic arena modes.
- [ ] Dynamic context bindings (PgLite diffs, DDL, metrics) remain intact.
- [ ] `remote-verify` passes all 24 CI steps.
