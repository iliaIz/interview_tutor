# Stage 06: Machine Coding & Low-Level Design (LLD) Actualization

> **Document:** `STAGE_06_MACHINE_CODING_AND_LLD.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/06_MACHINE_CODING_AND_LLD.md`](../../architecture/specs/06_MACHINE_CODING_AND_LLD.md)

---

## 1. Scope & Target Files

- **Backend Services:** `backend/src/services/astAuditService.ts`, `backend/src/services/astAnalyzer.ts`, `backend/src/services/challengeSeedData.ts`.
- **Backend Routes:** `backend/src/routes/practice.ts`.
- **Frontend Components:** `frontend/src/components/practice/PracticeArena.tsx`, `CodeViewer.tsx`, CodeMirror 6 Java extensions.

---

## 2. Root Causes & Technical Debt to Eliminate

1. **AST False Positives on Java 21:** AST rules written for Java 17 occasionally flag valid Java 21 record patterns and pattern matching switches as syntax anomalies.
2. **Single-File Editor Limitations:** Complex LLD challenges (e.g. In-Memory Message Broker with 8 classes) previously forced candidates to work within a flat layout without multi-tab navigation.
3. **Flaky Time Tests:** Candidates using `System.currentTimeMillis()` face flaky tests due to variable runner execution speeds.

---

## 3. Implementation Checklist

### Backend & AST Actualization
- [ ] Upgrade `astAuditService.ts` to support full Java 21 LTS syntax grammar.
- [ ] Enforce the 4 core AST rules:
  - `enforce-clock-injection`: Constructor injection of `java.time.Clock`.
  - `no-double-in-money`: Mandatory `BigDecimal` with `RoundingMode.HALF_EVEN`.
  - `deadlock-free-locking`: Sorted ID lock acquisition for multi-account transfers.
  - `virtual-thread-pinning`: Rejection of `synchronized` over blocking I/O.
- [ ] Validate all 35 challenges across the 3 industrial tracks (BigTech, FinTech, Concurrency).

### Frontend UI/UX Actualization
- [ ] **Multi-Tab IDE Layout:** Full multi-file editor with tab strip, keyboard switching (`Ctrl + Tab`), file tree, and unsaved changes dots.
- [ ] **Inline AST Squiggles:** CodeMirror 6 integration rendering red wavy underlines on invariant violations with tooltip diagnostics explaining the architectural requirement.
- [ ] **5-Factor Evaluation Scorecard:** Visual modal plotting Correctness (40%), Concurrency (20%), Architecture (20%), Time Testability (10%), and Java 21 Idioms (10%).

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify challenge task codes and resolution
npm --prefix backend run test:practice:task-codes

# 2. Verify file hygiene standards
npm run verify-hygiene
```
