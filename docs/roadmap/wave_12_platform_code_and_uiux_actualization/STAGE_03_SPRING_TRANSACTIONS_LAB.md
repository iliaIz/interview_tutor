# Stage 03: Spring Transactions Lab Actualization

> **Document:** `STAGE_03_SPRING_TRANSACTIONS_LAB.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/03_SPRING_TRANSACTIONS_LAB.md`](../../architecture/specs/03_SPRING_TRANSACTIONS_LAB.md)

---

## 1. Scope & Target Files

- **Backend Services:** `backend/src/services/sandbox/runner/` (Transaction Proxy Engine), `backend/src/services/topics.ts`.
- **Backend Routes:** `backend/src/routes/practice.ts`, `backend/src/routes/topics.ts`.
- **Frontend Components:** `frontend/src/components/practice/` (Transaction simulation view, timeline canvas).

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Heavyweight Testcontainer Dependency:** Running real database containers for simple `@Transactional` propagation checks takes 8+ seconds, disrupting interactive learning.
2. **Ambiguous Self-Invocation Visualization:** When a candidate calls `this.method()`, the UI previously showed a generic error instead of explicitly illustrating that the AOP proxy was bypassed.
3. **Missing Isolation Anomaly Demonstrations:** Lack of step-by-step visual interleaving for Dirty Reads, Non-Repeatable Reads, and Phantom Reads.

---

## 3. Implementation Checklist

### Backend & Engine Actualization
- [ ] Ensure the in-memory proxy runner executes and generates the complete transaction lifecycle event stream in $<50\text{ms}$.
- [ ] Enforce deterministic simulation of HikariCP pool exhaustion under nested transactions ($P \ge T \times (D - 1) + 1$).
- [ ] Verify rollback event generation for checked vs unchecked exceptions across all 16 scenarios.

### Frontend UI/UX Actualization
- [ ] **Multi-Threaded Swimlane Timeline:** Render interactive horizontal tracks for Thread 1 and Thread 2:
  - Connection acquisition markers (`getConnection()`).
  - Active transaction boundaries (`[TX_START]` $\to$ `[TX_COMMIT]`).
  - Explicit visual alert when `this.call()` bypasses proxy interceptor.
- [ ] **Step-by-Step Timeline Scrubber:** Add play/pause and step-forward controls to inspect concurrency states at each millisecond.
- [ ] **Transaction Compass (`Ctrl + /`):** Live radar evaluating Proxy Integrity, Propagation Depth, Rollback Correctness, and Pool Contention.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify transaction scenario integrity
npm --prefix backend run test:practice:resilience

# 2. Verify file hygiene standards
npm run verify-hygiene
```
