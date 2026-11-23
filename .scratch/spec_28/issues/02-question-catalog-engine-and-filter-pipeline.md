# 02: [Prefactor] Question Catalog Engine & Filter Pipeline Extraction

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Extract `QuestionCatalogEngine.ts` from `QuestionExplorer.tsx` (currently 872 lines) and `TopicSelector.tsx` (793 lines).
1. Encapsulate search query matching, status filtering (`all`, `uncompleted`, `completed`, `mastered`), and evaluation status computation in `QuestionCatalogEngine.filterQuestions()`.
2. Encapsulate shift-click range selection calculation in `QuestionCatalogEngine.computeRangeSelection()`.
3. Encapsulate voice batch creation in `QuestionCatalogEngine.buildVoiceBatch()`.
4. Slim down `QuestionExplorer.tsx` to &le; 400 lines by delegating all algorithmic query and selection math to `QuestionCatalogEngine`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/QuestionCatalogEngine.ts` and `frontend/src/components/QuestionExplorer.tsx`.
- **Dependencies**: In-memory domain objects. Zero external mocks.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Cognitive Bounding (Rule 8): `QuestionCatalogEngine.ts` &le; 250 lines; `QuestionExplorer.tsx` &le; 400 lines.
- Deterministic 0ms calculation: pure calculations without DOM dependencies.

## Explicit Non-Goals
- Modifying backend `/api/topics/:id/questions` REST endpoint.
- Altering the visual design or animations in `QuestionExplorer.tsx`.

## Acceptance Criteria
- [ ] `QuestionCatalogEngine.ts` created with pure calculation methods.
- [ ] `QuestionExplorer.tsx` imports and uses `QuestionCatalogEngine`, shrinking below 400 lines.
- [ ] Multi-selection and shift-click selection behavior preserved 100%.
- [ ] Remote verification (`remote-verify`) passes 100% green.
