---
name: research-driven-architecture
description: Multi-Faceted Research-Driven Architecture (MFRDA) workflow for technical assessment platforms. Use when planning major architectural refactorings, adding learning tracks, or making system-level design decisions. Enforces empirical codebase verification, zero-anchoring Deep Research inquiries, living documentation, and phased RFC synthesis.
---

# Multi-Faceted Research-Driven Architecture (MFRDA) Skill

This skill governs how the agent approaches macro-level system architecture, taxonomy restructuring, and curricular evolution within the InterviewPrep AI platform.

---

## 1. Core Principles

1. **Zero Premature Planning (No Phantom Roadmaps):**
   - NEVER create implementation phases (`stage_01`, `stage_02`...) or lock in architectural decisions before empirical code verification and Deep Research synthesis are complete.
2. **Zero-Anchoring Mandate (No Closed Choices):**
   - NEVER frame Deep Research prompts around artificial, pre-selected options (e.g., "Should we pick Option A or Option B?").
   - Always formulate open, unconstrained research prompts requiring the discovery of emergent SOTA paradigms as of September 2026.
3. **Empirical Ground-Truth Verification (As-Is Reality First):**
   - Before designing the "To-Be" system, thoroughly verify the "As-Is" state by inspecting real code, database schemas, routing, and runtime behavior. Document verified anomalies and defects explicitly.
4. **Living Documentation & Memory Persistence:**
   - Always persist program charters, audits, research inquiry suites, and decisions logs in `docs/roadmap/wave_XX_...`. Never rely on the ephemeral LLM context window.

---

## 2. Standard 4-Step MFRDA Workflow

### Step 0: Empirical Baseline Verification
- Run code audits using inspection tools (`view_file`, `grep_search`, test execution).
- Identify:
  * Discrepancies between data sources (Split-Brain catalogs).
  * Broken user journeys across routers and state stores.
  * Rigid or closed type systems.
  * Existing hidden capabilities (e.g., in-memory vector engines).
- Document findings in `01_BASELINE_DEFECT_AUDIT.md`.

### Step 1: Multi-Faceted Deep Research Battery
- Author prompts strictly adhering to the [`deep-research-prompt-crafting`](../deep-research-prompt-crafting/SKILL.md) skill:
  * Mandate Zero-Anchoring (never presuppose historical library versions or candidate models from 2022–2024).
  * Frame inquiries strictly around physical constraints, memory contracts, and latency SLAs (First Principles).
  * Fencing protocol invariants (explicitly guard against known fatal errors like WS 1011/1008).
- Decompose system-level uncertainty into orthogonal, unanchored research planes:
  * Plane 1: Macro-Taxonomy / Edge Infrastructure.
  * Plane 2: Machine Learning & Mathematical Models.
  * Plane 3: Protocol & Session State Arbitration.
  * Plane 4: HCI, Domain Ergonomics & UX.
- Document prompts in `02_RESEARCH_INQUIRY_SUITE.md` (or dedicated inquiry directory) for human dispatch.

### Step 2: Report Ingestion & Master Architectural RFC
- Ingest finalized Deep Research reports placed in `docs/roadmap/reports/`.
- Extract verified mathematical formulations, taxonomy structures, and hardware invariants.
- Synthesize findings into an evidence-backed Master RFC.
- Record locked decisions and resolved hypotheses in `03_DECISIONS_AND_HYPOTHESES_LOG.md`.

### Step 3: Progressive Phase Decomposition
- Only AFTER formal RFC approval, generate phased implementation specifications (`stage_01_...md`, `stage_02_...md`).
- Each phase must specify:
  * Strict Definition of Done (DoD).
  * TypeScript / JSON schema contracts.
  * Automated regression verification.

---

## 3. Anti-Patterns to Prevent

- ❌ **The Hallucinated Progression Trap:** Labeling advanced distributed algorithms (e.g., Consistent Hashing, LSM trees, Fencing Tokens) as "Junior L0" without an authentic web-engineering baseline.
- ❌ **The Duplicate Truth Trap:** Storing one version of scenarios in SQLite and another version statically bundled in client-side TypeScript.
- ❌ **The Single-Prompt Fallacy:** Attempting to solve taxonomy, pedagogy, and queuing math in a single generic research query instead of a focused battery.
- ❌ **The Obsolete Version & Anchoring Trap:** Naming legacy candidate libraries or versions (e.g. 2022–2024 packages), which biases the research LLM and hides 2026 SOTA breakthroughs.
- ❌ **Premature Spec Creation:** Writing stage specifications while research is still running.
- ❌ **Prompt/Operational Bloat:** Polluting agent instructions with human-side operational details (browser extensions, clipboard workarounds). The agent expects clean reports in `docs/roadmap/reports/` and focuses strictly on architectural synthesis.
