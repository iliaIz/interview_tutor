# Stage 00: Core Infrastructure, Security & Auth Actualization

> **Document:** `STAGE_00_CORE_INFRASTRUCTURE_AND_SECURITY.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/00_CORE_INFRASTRUCTURE_AND_SECURITY.md`](../../architecture/specs/00_CORE_INFRASTRUCTURE_AND_SECURITY.md)

---

## 1. Scope & Target Files

- **Backend Services:** `backend/src/server.ts`, `backend/src/services/authService.ts`, `backend/src/services/db.ts`, `backend/src/middleware/auth.ts`.
- **Frontend Components:** `frontend/src/components/auth/`, `frontend/src/components/StudioHeader.tsx`, `frontend/src/components/Toast.tsx`.
- **Infrastructure:** `Caddyfile`, `docker-compose.prod.yml`, `Dockerfile.caddy`.

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Monolithic Error Alerting:** Transient network drops or WebSocket timeouts currently trigger full-screen error overlays, interrupting candidate thought processes.
2. **Hardcoded Gateway Addresses:** Inconsistent URLs across test scripts and services (`http://localhost:4000` vs `http://litellm-gateway:4000`), risking connection drops across environments.
3. **Missing DB Composite Indexes:** Submissions and FSRS queries perform table scans under high record counts without composite indexes on `(user_id, challenge_id)` and `(user_id, due_date)`.

---

## 3. Implementation Checklist

### Backend & Infrastructure Actualization
- [ ] Audit LiteLLM proxy failover: verify that 429 errors from Google API pool switch keys in $<5\text{ms}$ and 503 errors trigger model fallbacks seamlessly.
- [ ] Configure SQLite WAL performance pragmas (`mmap_size = 268435456`, `cache_size = -64000`) and add missing composite indexes.
- [ ] Ensure all WebSocket ticket generation routes enforce the 60-second atomic consumption invariant.

### Frontend UI/UX Actualization
- [ ] **Soft-Luxury Login HUD:** Refactor the invite modal into a high-aesthetic card (`#FFF0F5` background, subtle lavender mesh glow, auto-focusing uppercase invite code input, tactile shake on invalid code).
- [ ] **Ambient Network Status Banner:** Implement a slim, non-blocking top banner showing connection liveness, auto-retrying in the background without unmounting active arenas.
- [ ] **Zero-Flicker Session Restore:** Seamlessly restore user state from `localStorage` upon page refresh without showing unauthenticated login flashes.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Health check & model readiness verification
curl -fsS https://java.djelu.site/api/health

# 2. Verify static file hygiene standards
npm run verify-hygiene

# 3. Authenticated API & invite security tests
npm --prefix backend run test:telemetry:db
```
