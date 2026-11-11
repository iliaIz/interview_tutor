# 01: [Prefactor] Core Epistemic Foundation & Persona Directives Decomposition

**Parent:** SPEC-19 (#101)  
**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
1. In `backend/src/prompts/core/antiSycophancy.ts`:
   - Formulate and export `EPISTEMIC_BENEVOLENCE_AXIOM` (Truth precedes politeness; nodding along harms the candidate).
   - Formulate and export `EPISTEMIC_TRIAGE_DIRECTIVE` (`[ВЕРНО]` / `[ЧАСТИЧНО ВЕРНО]` / `[ОШИБОЧНО]` triage with explicit templates).
   - Expand `VOICE_ANTI_SYCOPHANCY_DIRECTIVES` to incorporate the banned openers blacklist, the demarcation rule, and the runtime counterexample invariant.
   - Retain 100% backward compatibility for all existing exports (`StrictnessLevel`, `TRIVIA_IMMUNITY_INVARIANT`, `CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES`, `CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE`, `getStrictnessDirectives`, `ANTI_SYCOPHANCY_DIRECTIVES`, `EXAM_ANTI_SYCOPHANCY_DIRECTIVES`, `SOCRATIC_FORWARD_PROBING_DIRECTIVES`).
2. Create `backend/src/prompts/tutor/practiceTutorPersonaDirectives.ts`:
   - Extract domain persona instructions from `practiceTutorPrompts.ts` into a dedicated SRP module ($\le 350$ lines).
   - Support all 6 domains: `isLld`, `isTx`, `isConcurrency`, `isRefactoring`, `isJava21`, and `testing`.
   - Implement the two-tier separation: Psychological Safety (polite, respectful tone) vs. Epistemic Rigor (zero flattery, mandatory boundary demarcation).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/prompts/core/antiSycophancy.ts` & `backend/src/prompts/tutor/practiceTutorPersonaDirectives.ts`.
- **Verification Command**: `remote-verify` & line count checks (`wc -l`).

## Embedded Contract Slice & Invariants
- Rule 8 Compliance: `antiSycophancy.ts` $\le 400$ lines, `practiceTutorPersonaDirectives.ts` $\le 350$ lines.
- Zero breaking changes to existing TypeScript imports.

## Explicit Non-Goals
- Modifying WebSocket transport handlers or database schemas.
- Changing `backend/src/services/live/LiveVoiceSession.ts`.

## Acceptance Criteria
- [ ] `EPISTEMIC_BENEVOLENCE_AXIOM` and `EPISTEMIC_TRIAGE_DIRECTIVE` exported cleanly.
- [ ] `buildPracticeTutorPersonaDirectives` supports all 6 domains and compiles cleanly.
- [ ] Line counts strictly respect Rule 8 limits.
