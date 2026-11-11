# 03: [Tracer-Bullet] Live Pair Audio Anti-Sycophancy: Elimination of False Praise and Voice Triage

**Parent:** SPEC-19 (#101)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #102  
**Status:** ready-for-agent  

## What to Build
1. In `backend/src/prompts/live/livePairPersonaInstructions.ts`:
   - Enhance the `Беспристрастность` directive in each persona to mandate the Tri-State demarcation of candidate answers.
   - Retain all 6 domains (`lld`, `transactions`, `concurrency`, `refactoring`, `java21`, `testing`).
   - In `refactoring`, strictly preserve the invocation instruction for the `report_identified_smell(smellId, justification)` tool call.
2. In `backend/src/prompts/live/livePairPrompts.ts`:
   - Eliminate the destructive directive `3. Когда кандидат предлагает верную идею — похвали и предложи применить её в коде` in `seniorReviewSection`. Replace it with `ТРИАЖ ГИПОТЕЗ КАНДИДАТА (БЕЗ ПУСТОЙ ПОХВАЛЫ)`.
   - Update role definition in section 1 to collegiate, honest peer where true care = telling technical truth.
   - In section 2 (`MULTIMODAL SYMBIOSIS`), inject the audio demarcation rule while respecting the strict Gemini Live audio constraints (2-3 sentences, $\le 30$–35 words per turn, no code reading aloud).
   - Strictly preserve all greetings, domain role headers, project tree manifest for `read_file`, and Academy Bridge context.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/prompts/live/livePairPrompts.ts` & `backend/src/prompts/live/livePairPersonaInstructions.ts`
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] Direct prompt command `похвали` is completely removed.
- [ ] All 6 domains and smell reporting tool instructions in `livePairPersonaInstructions.ts` preserved.
- [ ] Gemini Live audio brevity invariant ($\le 35$ words) maintained.
- [ ] File lengths $\le 400$ lines.
