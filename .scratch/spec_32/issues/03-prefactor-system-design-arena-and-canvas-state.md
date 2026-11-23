# Issue 03: [Prefactor] System Design Arena Churn Decoupling & Canvas Engine

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/system_design/SystemDesignArena.tsx` (391 lines, 22 commits) and `ArchitectureCanvas.tsx` (391 lines):
1. Extract `frontend/src/components/system_design/hooks/useSystemDesignStaffChat.ts` (< 120 lines): Staff AI probe conversation history, streaming, and prompt directives.
2. Extract `frontend/src/components/system_design/arena/SystemDesignModalCoordinator.tsx` (< 90 lines): renders VerdictModal, EvaluationModal, CompassSheet, and VoiceModal.
3. Extract `frontend/src/components/system_design/canvas/useArchitectureCanvasState.ts` (< 160 lines): ReactFlow nodes/edges state, DES telemetry merging, Chaos target enrichment, and DND screen-to-flow coordinate conversion.
4. Reduce `SystemDesignArena.tsx` to $\le 140$ lines and `ArchitectureCanvas.tsx` to $\le 150$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `SystemDesignArena.tsx` & `ArchitectureCanvas.tsx`.
- **Dependencies**: ReactFlow & discrete-event simulation models.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `SystemDesignArena.tsx` shrinks from 391 to $\le 140$ lines.
- [ ] `ArchitectureCanvas.tsx` shrinks from 391 to $\le 150$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
