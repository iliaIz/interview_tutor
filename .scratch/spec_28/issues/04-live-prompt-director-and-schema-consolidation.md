# 04: [Prefactor] Live Prompt Director & Schema Consolidation

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Consolidate persona prompt construction, tool declarations, and Turn 0 tool lockdown invariants into `LivePromptDirector.ts`.
1. Currently, prompt building is scattered across `livePromptBuilder.ts` (677 lines), `liveToolDeclarations.ts` (365 lines), and `liveTutorPromptDirectives.ts` (279 lines).
2. Deepen into `LivePromptDirector.ts` (&le; 300 lines) providing a unified method `buildDirectives(config: LiveSessionConfig): LivePromptDirectives`.
3. Encapsulate persona instructions (interviewer vs tutor vs socratic), tool declarations, and Turn 0 tool lockdown into one deep module.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/LivePromptDirector.ts` and `livePromptBuilder.ts`.
- **Dependencies**: Gemini Live SDK schemas. Zero external network dependencies.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Turn 0 Directive Invariant: AI interviewer strictly forbidden from calling evaluation tools on greeting.
- Cognitive Bounding (Rule 8): `LivePromptDirector.ts` &le; 300 lines; `livePromptBuilder.ts` &le; 350 lines.

## Explicit Non-Goals
- Changing the system prompt text content or evaluation rubric definitions.
- Modifying `codeEvaluator.ts` or `ChallengeEvaluationPipeline.ts`.

## Acceptance Criteria
- [ ] `LivePromptDirector.ts` created and &le; 300 lines.
- [ ] `livePromptBuilder.ts` shrinks below 350 lines by delegating directive composition.
- [ ] Turn 0 tool lockdown invariant preserved across all modes.
- [ ] Remote verification (`remote-verify`) passes 100% green.
