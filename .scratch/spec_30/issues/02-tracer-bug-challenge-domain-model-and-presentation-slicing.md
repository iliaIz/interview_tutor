# 02: [Tracer-Bullet] Bug Challenge Domain Model & Presentation Slicing

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose the 609-line monolith `BugChallengeCard.tsx` into:
1. Pure algorithm utility: `frontend/src/utils/diff.ts` (`generateUnifiedDiff`).
2. Pure in-process domain hook: `frontend/src/hooks/useBugChallengeInspection.ts` (AST rule evaluation, takeaway heuristics, bookmark state synchronization).
3. Presentation subcomponents under `frontend/src/components/practice/bug_hunt/`:
   - `BugChallengeHeader.tsx` ($\le 150$ lines)
   - `BugIncidentAccordion.tsx` ($\le 180$ lines)
   - `BugSolutionPanel.tsx` ($\le 200$ lines)
4. Collapsed `BugChallengeCard.tsx` ($\le 160$ lines) acting purely as coordinator.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/hooks/useBugChallengeInspection.ts` and `frontend/src/utils/diff.ts`.
- **Dependencies**: In-process React & Zustand store.
- **Verification Command**: `remote-verify` passes frontend production build.

## Embedded Contract Slice & Invariants
- Rule 8 Compliance: All created files strictly $\le 350$ lines, modified files $\le 400$ lines.
- No Regressions: Retain full feature parity for all view modes (`diff`, `fixed`, `test`), takeaways, bookmarking, and notifications.

## Explicit Non-Goals
- Do NOT alter `evaluateAstRules` logic in `frontend/src/utils/astRules.ts`.
- Do NOT change backend bug generator service.
