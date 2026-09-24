# Stage 04: Interactive System Design Arena Actualization

> **Document:** `STAGE_04_SYSTEM_DESIGN_ARENA.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/04_SYSTEM_DESIGN_ARENA.md`](../../architecture/specs/04_SYSTEM_DESIGN_ARENA.md)

---

## 1. Scope & Target Files

- **Backend Routes & Services:** `backend/src/routes/systemDesign.ts`, `backend/src/services/scenarioLoader.ts`.
- **Frontend Core & Workers:** `frontend/src/workers/desSimulator.worker.ts`.
- **Frontend Components:** `frontend/src/components/system_design/SystemDesignArena.tsx`, `MultiScaleCanvasHub.tsx`, component palette.

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Main-Thread Simulation Stutter:** Running packet flow simulations on the main React thread causes frame drops ($<30\text{ FPS}$) during canvas panning on large architectures.
2. **Scattered Capacity Math:** Back-of-the-envelope calculations (QPS, storage, memory) duplicated across ad-hoc formulas without centralized validation.
3. **Cluttered Wire Routing:** Edges in Cytoscape overlap nodes without intelligent curved routing or port snapping.

---

## 3. Implementation Checklist

### Backend & Engine Actualization
- [ ] Centralize L1 capacity estimation math into a single pure utility adhering to the specification formulas.
- [ ] Offload all Discrete Event Packet Simulation (DES) calculations strictly to `desSimulator.worker.ts`.
- [ ] Verify scenario schema loading for all 31 distributed system challenges.

### Frontend UI/UX Actualization
- [ ] **Modern Cytoscape Canvas:** Implement port snapping (input/output ports on nodes), auto-curved orthogonal edge routing, and smooth 120 FPS pinch-to-zoom.
- [ ] **Heuristic SPOF Highlight:** Dynamically compute graph biconnected components; render a pulsing amber aura around any node whose failure partitions the system.
- [ ] **Real-Time Math Coach Drawer:** Provide an interactive calculator displaying QPS, Daily Storage, and 80/20 RAM cache requirements with live $\pm 25\%$ validation badges.
- [ ] **System Design Compass (`Ctrl + /`):** Interactive radar evaluating Reliability, Scalability, Cost Efficiency, Latency, and Security.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify scenario loader and system design API endpoints
npm --prefix backend run build

# 2. Verify file hygiene standards
npm run verify-hygiene
```
