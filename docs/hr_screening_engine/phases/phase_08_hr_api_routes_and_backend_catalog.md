# Phase 8: HR REST API Routes & Fixture Streaming

> **Gate 8 File:** `docs/hr_screening_engine/phases/phase_08_hr_api_routes_and_backend_catalog.md`  
> **Status:** Execution Ready  

## Objective
Expose clean, typed REST endpoints to deliver `canonicalQuestionMatrix.json` and `canonicalCandidateDossier.json` to the frontend without hardcoded duplicates.

## Tasks
1. Create `backend/src/routes/hr.ts` with `GET /api/hr/questions` and `GET /api/hr/dossier`.
2. Register `/api/hr` router in `backend/src/server.ts`.
3. Add regression verification test `backend/tests/test_hr_routes.js`.

## Verification Gate
- `node backend/tests/test_hr_routes.js` exits 0.
- `GET /api/hr/questions` returns 12 rubric items matching `HrQuestionRubricItemSchema`.
