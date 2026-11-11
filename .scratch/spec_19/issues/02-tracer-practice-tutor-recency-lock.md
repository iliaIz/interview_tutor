# 02: [Tracer-Bullet] Practice Tutor Copilot Recency Lock & Context Integrity

**Parent:** SPEC-19 (#101)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #102  
**Status:** ready-for-agent  

## What to Build
1. In `backend/src/prompts/practiceTutorPrompts.ts`:
   - Import and wire `buildPracticeTutorPersonaDirectives` from `./tutor/practiceTutorPersonaDirectives`.
   - Preserve all existing context interpolations without data loss:
     - Surviving mutants (`survivingMutants`)
     - Active compass rule checklist (`activeCompassRuleId`)
     - Active interactive whiteboard snippet (`activeWhiteboardSnippet`)
     - Workspace file manifest (`workspaceManifest`)
     - Academy Bridge context (`academyBridgeContext`)
     - Compressed earlier turns summary (`earlierTurnsSummary`)
     - Dynamic role summary by domain (`roleSummary`)
   - Replace the sycophancy-inducing `ОБЩИЕ ПРАВИЛА ОТВЕТА` with the canonical **Epistemic Recency Lock**:
     - Explicit ban on false nods and conversational flattery.
     - Mandatory first-sentence demarcation of partial ideas.
     - Direct denial with counterexample for invalid premises.
   - Decomposing the persona directives drops the file size from ~375 lines to ~230 lines (strictly complying with Rule 8 $\le 400$ lines).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/prompts/practiceTutorPrompts.ts`
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `buildPracticeTutorSystemPrompt` compiles cleanly and produces valid system prompts across all 6 domains.
- [ ] All context interpolations (mutants, compass, whiteboard, academy) render verbatim when present.
- [ ] Epistemic Recency Lock is present at the bottom of the prompt.
- [ ] File length $\le 400$ lines.
