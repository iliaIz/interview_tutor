# Phase 5: Verification Canary Matrix, CI/CD Deployment & SSOT Actualization
## Comprehensive Testing & Cloud-Runner Deployment

> **Phase:** 5 of 5  
> **Status:** Draft / Specification  
> **Target Subsystem:** CI/CD Workflow (`.github/workflows/deploy.yml`), Functional Registry  
> **Dependencies:** Phases 1–4  

---

## 1. Context & Verification Objectives

Before deploying to production VPS, all layers must pass automated gates:
1. `npm run test` on backend & frontend.
2. File length invariants assertion ($\le 350$ lines for new files, $\le 400$ lines for modified files).
3. Cloud build and zero-downtime deployment via GitHub Actions (Rule 0: strictly NO local builds on VPS).

---

## 2. Technical Specification

### 2.1. Branch Verification in `.github/workflows/deploy.yml`
Ensure the active feature branch (`feat/wave-20-hands-free-voice-navigation` or `feat/wave-21-sota-two-phase-sse-streaming`) is listed under `on.push.branches`:
```yaml
on:
  push:
    branches:
      - main
      - feat/wave-20-hands-free-voice-navigation
      - feat/wave-21-sota-two-phase-sse-streaming
```

### 2.2. Functional Registry Logging (Rule 10)
Document all architectural decisions and intermediate findings in:
`docs/architecture/functional_registry/03_litellm_proxy_gateway.md` and
`docs/architecture/functional_registry/04_sse_streaming_bug_hunt.md`.

---

## 3. Verification Gate (Gate 5)

1. End-to-end integration test against production VPS `/api/tutor/bug-challenge/stream`.
2. Inspect `docker logs litellm-gateway` and `docker logs interview-backend-api` to ensure clean SSE lifecycle.
3. Confirm zero TypeScript errors across the repository (`npx tsc --noEmit`).
