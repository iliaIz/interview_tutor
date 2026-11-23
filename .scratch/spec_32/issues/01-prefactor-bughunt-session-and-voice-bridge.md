# Issue 01: [Prefactor] Bug Hunt Session & Voice Bridge Controller

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/incidents/BugHuntArena.tsx` (399 lines, 1 line from Rule 8 breach):
1. Extract `frontend/src/components/incidents/bughunt/useBugHuntSession.ts` (< 200 lines): kata fetching, variation generation, history pointer navigation, solved count tracking, Academy breadcrumb progress synchronization.
2. Extract `frontend/src/components/incidents/bughunt/useBugHuntVoiceBridge.ts` (< 150 lines): encapsulates `useLiveVoiceSession`, bridge prompt synthesis, revisited challenges set, and collapses the 15-prop drilled interface to `BugHuntVoiceMentor` into a cohesive `BugHuntVoiceMentorController`.
3. Extract `frontend/src/components/incidents/bughunt/BugHuntLoaderCard.tsx` (< 70 lines): interval loops for loader steps, trivia cycling, and elapsed seconds.
4. Reduce `BugHuntArena.tsx` to $\le 130$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/incidents/BugHuntArena.tsx` & `bughunt/useBugHuntSession.ts`.
- **Dependencies**: In-process React hooks, zero DOM mocks.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `BugHuntArena.tsx` line count is $\le 130$ lines (Rule 8 compliant).
- [ ] `BugHuntVoiceMentor` props drilled reduced from 15 props to 1 controller.
- [ ] All new files $\le 350$ lines.
- [ ] Remote verification builds 100% green.
