# ADR 0003: Hub-and-Spoke Omnipresent AI Copilot & Company Track Enrichment

> **Status:** Accepted  
> **Date:** 2026-11-09  
> **Pillars:** [10 (Company Track & SQL Arena)](../specs/10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md), [11 (Omnipresent AI Copilot)](../specs/11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md)

---

## 1. Context & Problem Statement

Candidate preparation for high-bar fin-tech engineering roles (specifically Raiffeisen DGTL Product Engineer) spans multiple heterogeneous modalities:
1. Behavioral Fit & Culture rounds (STAR, 9 PE competencies, compliance trade-offs).
2. Live Coding & Applied Algorithms (IBAN, SparseVector, Top-N transactions, CAS Rate Limiter).
3. Code Review & Defect Hunting (`TransferService`, AOP bypass, `BlockingQueue` spurious wakeup, HikariCP starvation).
4. Relational Database & SQL Traps (PostgreSQL 16, three-valued logic, window aggregation).
5. System Design (ATM cash dispenser, real-time fraud detection, SBP payment gateway).
6. Take-Home Projects (`cib-interns-test-task` socks warehouse, 25 PR flaw analysis).

Candidates require continuous Socratic mentoring and feedback across **all** of these workspaces without leaving their workflow or manually copy-pasting code, schema, and error logs into external tools.

---

## 2. Decision Drivers

- **Zero Parallel Reimplementation (Rule 8 Invariant):** Eliminating code cloning of chat drawers, streaming transports, stores, and prompt builders across screens.
- **Zero-Copy Context Grounding:** The copilot must automatically ingest active editor code, SQL queries, relational diffs, and company culture markers.
- **Pedagogical Anti-Solution Leak:** The AI must act as a Socratic mentor (guiding towards invariants) rather than a sycophantic solution generator.
- **Zero VPS Resource Overhead:** The 1.8 GB VPS memory constraint prohibits local model hosting or heavy backend worker pools.

---

## 3. Considered Options

### Option 1: Fragmented Copilot per Screen (Rejected)
- Create `CompanyTutorDrawer.tsx`, `SqlTutorDrawer.tsx`, `useCompanyTutorStore.ts`, etc.
- *Reason for Rejection:* Severe code drift, doubled bundle size, duplicated SSE streaming logic, and maintenance overhead violating architectural invariants.

### Option 2: Generic Disconnected Chat Modal (Rejected)
- Float a generic LLM chat window requiring users to manually copy-paste schema DDL and errors.
- *Reason for Rejection:* Frustrating UX, lack of domain grounding, hallucinations, and loss of company-specific evaluation calibration.

### Option 3: Hub-and-Spoke Omnipresent Copilot with Polymorphic Context (Selected)
- Single centralized headless engine (`useTutorStore`, `TutorDrawer`, `/api/practice-tutor/chat`) connected to polymorphic context emitters (`TutorActiveContext`).
- Active screens emit lightweight context slices; the copilot dynamically mounts domain-specific quick-action chips and persona directives.

---

## 4. Consequences & Invariants

### Positive Consequences
- **100% Code Reuse:** A single drawer component and backend streaming pipeline serves Practice, SQL Arena, Company Studio, and Incident Triage.
- **Seamless Context Transitions:** Switching tabs or selecting a challenge immediately updates the copilot's context without resetting the session.
- **Company DNA Calibration:** The copilot speaks the language of a fin-tech Staff/Lead interviewer (TTM, Pain Index, Zero-Downtime, BigDecimal).

### Compliance & Invariants Enforced
- **Rule 8 (`AGENTS.md`):** Zero duplicate copilot widgets.
- **Rule 0 (`AGENTS.md`):** 0 MB additional RAM overhead on VPS (all LLM inference routes through `LiteLLM_Proxy`).
- **File Hygiene Invariant:** All touched or created files stay strictly $\le 350$ lines.
