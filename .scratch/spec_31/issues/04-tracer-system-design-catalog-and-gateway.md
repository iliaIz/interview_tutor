# Issue 04: [Tracer-Bullet] Decouple System Design Scenario Catalog & Probe Gateway

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose `backend/src/routes/systemDesign.ts` (333 lines) into two deep modules:
1. `backend/src/services/SystemDesignCatalog.ts` (< 120 lines):
   - Encapsulates queries against `system_design_manifests` SQLite table.
   - Filtering by category, search text, and target level.
   - Scenario resolution via `resolveScenarioManifest` and `resolveCanonicalId`.
2. `backend/src/services/SystemDesignProbeGateway.ts` (< 180 lines):
   - Encapsulates LiteLLM streaming connection, header resolution, fallback URLs (`host.docker.internal:4000` -> `localhost:4000`), and SSE streaming back to Express `Response`.
   - Sanitizes and builds probe prompt directives via `buildSystemDesignProbePrompt` and `wrapUntrustedContext`.

`backend/src/routes/systemDesign.ts` is collapsed to a $\le 80$ line HTTP router.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/SystemDesignCatalog.ts` & `backend/src/services/SystemDesignProbeGateway.ts`.
- **Dependencies**: Real SQLite `db` fixture & LiteLLM Proxy.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
Rule 1 LiteLLM Proxy Invariant:
- Endpoint resolution must route through `${LITELLM_PROXY_URL}` with Docker host fallback.
- Never hardcode Google API keys or upstream model names.

## Explicit Non-Goals
- Do NOT touch `systemDesignPrompts.ts` or evaluation rubrics.
- Do NOT alter SQLite table schemas.

## Acceptance Criteria
- [ ] `SystemDesignCatalog.ts` and `SystemDesignProbeGateway.ts` strictly conform to Rule 8 ($\le 350$ lines each).
- [ ] `backend/src/routes/systemDesign.ts` is $\le 80$ lines.
- [ ] Rule 1 Gateway Invariant is preserved.
- [ ] Remote verification passes 100% green.
