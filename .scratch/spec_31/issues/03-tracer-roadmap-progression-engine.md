# Issue 03: [Tracer-Bullet] Backend Guided Roadmap Progression & Senior Radar Engine

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Extract domain progression logic from `backend/src/routes/roadmaps.ts` (339 lines) into a deep module `backend/src/services/RoadmapProgressionEngine.ts` (< 250 lines):
1. `getAllRoadmaps(userId)`: Resolves manual progress and reactive entity progress.
2. `getRoadmapById(roadmapId, userId)`: Resolves step completion and computes 4-pillar Senior Readiness Radar scores.
3. `getNextBestStep(userId, requestedCourseId)`: Computes active course, remaining uncompleted steps, and cognitive interleaving across arenas.
4. `updateStepProgress(userId, roadmapId, completedStep, isCompleted)`: Enforces monotonic current_step advancement.
5. `recordTransactionSubmission` and `getTransactionSubmissions`: Manages `spring_transaction_submissions`.

`backend/src/routes/roadmaps.ts` is collapsed to a $\le 80$ line Express HTTP adapter.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/RoadmapProgressionEngine.ts` & `backend/tests/test_roadmap_progress_regression.js`.
- **Dependencies**: Real SQLite `db` fixture. Zero internal mocks.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
Monotonic step advancement invariant:
```sql
INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
  completed_steps_json = excluded.completed_steps_json,
  current_step = CASE
    WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
    ELSE roadmap_progress.current_step
  END,
  updated_at = CURRENT_TIMESTAMP
```

## Explicit Non-Goals
- Do NOT change the SQLite database schema.
- Do NOT change HTTP route URLs or JSON payload shapes.

## Acceptance Criteria
- [ ] `RoadmapProgressionEngine.ts` encapsulates all SQL and domain algorithms.
- [ ] `backend/src/routes/roadmaps.ts` line count is $\le 80$ lines.
- [ ] `backend/tests/test_roadmap_progress_regression.js` passes cleanly.
- [ ] Remote verification passes 100% green.
