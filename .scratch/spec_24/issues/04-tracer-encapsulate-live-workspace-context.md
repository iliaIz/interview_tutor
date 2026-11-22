# 04: [Tracer-Bullet] Encapsulate Live Workspace Context and Collapse Router Options

**Parent:** Spec 24 (`spec-24-architectural-deepening-and-seam-hardening.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
Create `LiveWorkspaceContext` in `backend/src/services/live/LiveWorkspaceContext.ts` ($\le 250$ lines), encapsulating SQLite query prepared statements and challenge resolution across coding challenges, tx challenges, bug hunts, and questions. Encapsulate workspace file diffs (`workspace_active_file_changed`, `workspace_delta_sync`) inside `LiveWorkspaceContext.applyFrame(type, payload)` instead of mutating raw properties on `ProxySession`. Collapse `StreamRouterOptions` in `liveAudioStreamRouter.ts` from 22 parameters to 3 (`session`, `clientSocket`, `upstreamWsUrl`), creating leverage and clean locality.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `backend/src/services/live/LiveWorkspaceContext.ts` & `backend/src/services/live/liveAudioStreamRouter.ts`
- **Verification Command:** `npm --prefix backend run test:telemetry:router && npm --prefix backend run test:live:tool-isolation`
- **Dependencies:** In-memory SQLite prepared statement mock / wire tests.

## Embedded Contract Slice & Invariants
- `LiveWorkspaceContext` contract from Spec 24 Section 4.4.
- Invariant: `StreamRouterOptions` must have $\le 5$ fields.
- Invariant: Zero direct mutation of `session.workspaceManifest` from client frame handlers.

## Explicit Non-Goals
- Altering Gemini Live WebSocket framing protocols in `geminiLiveProxy.ts`.
- Changing database schema or queries in `dbSeedCatalogs.ts`.

## Acceptance Criteria
- [ ] `LiveWorkspaceContext.ts` created with $\le 250$ lines.
- [ ] `StreamRouterOptions` collapsed to minimal fields.
- [ ] `liveWsClientFrameHandler.ts` delegates workspace frame updates to `LiveWorkspaceContext`.
- [ ] `test:telemetry:router` and `test:live:tool-isolation` pass 100%.
