# 02: [Tracer-Bullet] Topic Progression & FSRS Blitz Catalog Aggregate

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Extract topic catalog aggregation and FSRS blitz batch slicing from `TopicSelector.tsx`:
1. Create `TopicCatalogEngine` encapsulating unmastered question filtering, fallback slicing, shuffle sorting, and domain statistics calculation.
2. Extract `useTopicCatalog` hook managing search queries, active domains, view modes, and blitz actions.
3. Decompose `TopicSelector.tsx` (793 lines -> <= 160 lines) into:
   - `TopicCatalogToolbar.tsx`
   - `TopicDomainAccordionList.tsx`
   - `TopicCardGrid.tsx`

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/topics/TopicCatalogEngine.ts` and `frontend/src/components/TopicSelector.tsx`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Headless blitz batch generation must produce deterministic <= 10 item slices.
- Rule 8: All files <= 350 lines.

## Explicit Non-Goals
- Do not modify `/api/topics` routes on backend.
