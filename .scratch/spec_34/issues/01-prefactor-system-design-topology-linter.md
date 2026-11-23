# Issue 01: [Prefactor] System Design AST Topology Linter Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/system_design/simulation/ArchitectureTopologyLinter.ts` (374 lines):
1. Extract `frontend/src/components/system_design/simulation/linter/ArchitectureTopologyGraph.ts` (< 180 lines):
   - Adjacency list indexing
   - Tarjan articulation point and bridge DFS
   - 3-color directed DFS for synchronous cycle detection
   - Node instance and edge synchronicity helper predicates
2. Extract `frontend/src/components/system_design/simulation/linter/TopologyRule.ts` & `builtInRules.ts` (< 180 lines):
   - Decoupled rule definitions: `SpofRule`, `SyncRpcCycleRule`, `DirectDbIngressRule`, `UnbufferedAnalyticalWriteRule`, `CircuitBreakerRule`.
3. Reduce `ArchitectureTopologyLinter.ts` to $\le 60$ lines as a thin facade.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `ArchitectureTopologyGraph.ts` & `ArchitectureTopologyLinter.ts`.
- **Dependencies**: Pure in-memory graph structures.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `ArchitectureTopologyLinter.ts` shrinks from 374 to $\le 60$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
