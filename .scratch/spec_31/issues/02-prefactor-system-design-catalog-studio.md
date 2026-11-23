# Issue 02: [Prefactor] Decompose System Design Catalog Studio & Level Decoupling

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose the 707-line monolithic `frontend/src/components/system_design/SystemDesignCatalog.tsx`:
1. Extract `frontend/src/components/system_design/utils/scenarioLevel.ts` (< 70 lines) containing `getScenarioRung` and `getLevelBadge`.
2. Extract `frontend/src/components/system_design/hooks/useScenarioCatalogFilters.ts` (< 120 lines) containing URL search params sync, text search, category, and level filtering.
3. Extract `frontend/src/components/system_design/components/SystemDesignScenarioCard.tsx` (< 200 lines) rendering scenario cards with badges, icons, capacity math trigger, and action buttons.
4. Reduce `SystemDesignCatalog.tsx` to $\le 180$ lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/system_design/SystemDesignCatalog.tsx`.
- **Dependencies**: Pure React hooks & URLSearchParams.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
export type ScenarioRung = 'L3' | 'L4' | 'L5_L7';
export type LevelFilter = 'all' | ScenarioRung;
export function getScenarioRung(s: any): ScenarioRung;
export function getLevelBadge(s: any): { label: string; bg: string };
```

## Explicit Non-Goals
- Do NOT alter `SystemDesignArena.tsx` or `ArchitectureCanvas.tsx`.
- Do NOT alter backend SQLite schemas or API endpoints.

## Acceptance Criteria
- [ ] `SystemDesignCatalog.tsx` reduced from 707 to $\le 180$ lines.
- [ ] All extracted files comply with Rule 8 ($\le 350$ lines).
- [ ] Level filtering and deep link URL param synchronization work identically.
- [ ] Remote verification builds 100% green.
