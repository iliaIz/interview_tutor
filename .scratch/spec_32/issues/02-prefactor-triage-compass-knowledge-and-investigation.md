# Issue 02: [Prefactor] Triage Compass Forensic Knowledge & Investigation Engine

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/triage/compass/TriageCompassSheet.tsx` (396 lines) and `IncidentTriageStudio.tsx` (360 lines):
1. Extract `frontend/src/components/triage/compass/triageRules.ts` (< 150 lines): static domain data (`TRIAGE_RULES`, `CompassSection` interface).
2. Extract `frontend/src/components/triage/compass/TriageRuleDetail.tsx` (< 90 lines): renders metrics table, code snippets, and checklist.
3. Extract `frontend/src/components/triage/hooks/useIncidentInvestigation.ts` (< 150 lines): stopwatch, debounced dual-tier autosave (localStorage + SQLite), Tarjan SCC thread dump digest calculation.
4. Reduce `TriageCompassSheet.tsx` to $\le 130$ lines and `IncidentTriageStudio.tsx` to $\le 140$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/triage/compass/triageRules.ts` & `IncidentTriageStudio.tsx`.
- **Dependencies**: In-process React hooks & static domain models.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `TriageCompassSheet.tsx` $\le 130$ lines (down from 396 lines).
- [ ] `IncidentTriageStudio.tsx` $\le 140$ lines (down from 360 lines).
- [ ] Rule 8 strictly satisfied across all files.
- [ ] Remote verification builds 100% green.
