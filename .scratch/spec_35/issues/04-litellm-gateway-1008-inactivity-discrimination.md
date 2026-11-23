# Issue 04: [Tracer-Bullet] LiteLLM Gateway Inactivity Code 1008 Discrimination & Key Cooldown Shield

Part of #123
**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
In `LiteLLM_Proxy/gateway/app/routers/live.py`, refine error code 1008 handling to distinguish between real quota exhaustion and normal WebSocket client inactivity disconnects (`Session closed due to client inactivity`). Never put keys on 60s cooldown for inactivity closures.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `/home/djelu/projects/LiteLLM_Proxy/gateway/app/routers/live.py`
- **Dependencies**: Python FastAPI Live WS router
- **Verification Command**: Direct inspect and service reload

## Embedded Contract Slice & Invariants
- Code `1008` only sets `is_quota_error = True` if `error_detail` contains `quota`, `resource_exhausted`, `exceeded`, or `rate limit`.
- Disconnects due to client inactivity close cleanly with telemetry logging without modifying Circuit Breaker cooldowns.

## Explicit Non-Goals
Forbidden to modify LiteLLM core routing or database models.

## Acceptance Criteria
- [ ] Inactivity disconnect does not trigger `circuit_breaker.set_key_cooldown`
- [ ] Real quota errors (429 / resource_exhausted) still trigger Circuit Breaker cooldown
