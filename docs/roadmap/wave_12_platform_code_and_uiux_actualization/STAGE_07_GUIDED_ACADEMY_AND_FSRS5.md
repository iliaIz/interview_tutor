# Stage 07: Guided Academy Studio & FSRS-5 Actualization

> **Document:** `STAGE_07_GUIDED_ACADEMY_AND_FSRS5.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/07_GUIDED_ACADEMY_AND_FSRS5.md`](../../architecture/specs/07_GUIDED_ACADEMY_AND_FSRS5.md)

---

## 1. Scope & Target Files

- **Backend Services & Routes:** `backend/src/services/fsrsEngine.ts`, `backend/src/services/progressService.ts`, `backend/src/routes/roadmaps.ts`.
- **Frontend Components:** `frontend/src/components/academy/AcademyStudio.tsx`, `MemoryRadarDrawer.tsx`, `DailySmartReviewBanner.tsx`.
- **Curricular Datasets:** `json/guided_roadmaps.json` (8 tracks, 177 steps).

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Dual ID ↔ Slug Aliasing Desynchronization:** Completing a kata under its numeric ID (`id: "1"`) previously left the corresponding roadmap step incomplete if mapped by slug (`slug: "kata_..."`), creating a broken ladder ("дырявая лестница").
2. **Cognitive Fatigue:** Lack of intelligent modality rotation forcing candidates into long, monotonous blocks of theory or coding.
3. **Imprecise SM-2 Scheduling:** Naive review intervals failing to model exponential memory decay accurately.

---

## 3. Implementation Checklist

### Backend & FSRS-5 Engine Actualization
- [ ] Enforce the 17-parameter FSRS-5 mathematical model in `fsrsEngine.ts` (retrievability $R(t, S)$, stability $S$, difficulty $D$).
- [ ] Implement Next-Best-Action (NBA) scheduler prioritizing due items ($R < 0.90$) with cognitive interleaving.
- [ ] Symmetrically populate both ID and Slug in `user_entity_progress` queries.

### Frontend UI/UX Actualization
- [ ] **Interactive Curricular DAG:** Visual roadmap rendering 8 tracks with locked/unlocked state badges and retrievability health colors (Green $\ge 90\%$, Yellow $70-89\%$, Red $<70\%$).
- [ ] **Cross-Arena Breadcrumb Envelope:** Floating header badge displaying current roadmap step, allowing instant return after completing an arena challenge.
- [ ] **FSRS-5 Memory Radar Drawer:** Multi-domain radar visualizing cognitive stability across Java Core, Spring Boot, System Design, and SRE.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify FSRS-5 memory decay transitions and roadmap queries
npm --prefix backend run test:telemetry:db

# 2. Verify file hygiene standards
npm run verify-hygiene
```
