# Stage 05: Production Incident Triage & SRE Studio Actualization

> **Document:** `STAGE_05_INCIDENT_TRIAGE_SRE.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/05_PRODUCTION_INCIDENT_TRIAGE.md`](../../architecture/specs/05_PRODUCTION_INCIDENT_TRIAGE.md)

---

## 1. Scope & Target Files

- **Backend Routes & Analyzers:** `backend/src/routes/triage.ts`, Tarjan SCC deadlock detector, thread dump parser.
- **Frontend Components:** `frontend/src/components/incidents/IncidentTriageStudio.tsx`, `BugHuntArena.tsx`, thread visualizers.
- **Scenario Manifests:** `scenarios/incident_triage/` (22 production incidents).

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Slow Thread Dump Parsing:** Parsing 50,000-line thread dumps via inefficient regex on the main thread causes UI freezes during live incident triage.
2. **Missing Dual-Phase Workflow:** The UI previously blurred the boundary between emergency mitigation (traffic shedding) and root-cause analysis, leading to unrealistic candidate grading.
3. **Impenetrable Raw Text Dumps:** Candidates forced to read raw ASCII dumps rather than structured graphical views of lock ownership graphs.

---

## 3. Implementation Checklist

### Backend & Engine Actualization
- [ ] Optimize Tarjan SCC algorithm to guarantee sub-millisecond cycle extraction on 5,000+ thread dumps.
- [ ] Implement fast streaming parser for JVM thread dumps (HotSpot / OpenJDK / GraalVM formats).
- [ ] Verify scoring rubrics for all 22 production incidents (MTTM vs MTTR weights).

### Frontend UI/UX Actualization
- [ ] **Dual-Phase Incident HUD:** Prominent emergency timer displaying Phase 1 (MTTM: Stop Customer Bleeding) transitioning to Phase 2 (MTTR: Root Cause Postmortem).
- [ ] **Interactive Thread Tree Visualizer:** Collapsible tree grouping threads by thread pool with color-coded badges (`BLOCKED` in Crimson, `WAITING` in Amber, `TIMED_WAITING` in Slate, `RUNNABLE` in Emerald).
- [ ] **One-Click Deadlock Isolator:** Quick toggle highlighting only threads participating in circular lock dependencies.
- [ ] **Triage Compass (`Ctrl + /`):** Live 4-axis radar measuring MTTM Velocity, Blast Radius Containment, Cycle Resolution, and RCA Depth.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify triage scenario integrity and scoring
npm --prefix backend run build

# 2. Verify file hygiene standards
npm run verify-hygiene
```
