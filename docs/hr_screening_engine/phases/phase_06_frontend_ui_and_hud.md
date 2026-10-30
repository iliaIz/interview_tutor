# Phase 6: Frontend Reactive Visual HUD & Arena Components

> **Document:** `docs/hr_screening_engine/phases/phase_06_frontend_ui_and_hud.md`  
> **Status:** Phase 6 Specification & Execution Gate  
> **Quality Gate G6:** `npm --prefix frontend run build` exit code 0 and `npm run test:audio-contracts`.

---

## 1. Objectives & Scope
1. Implement modular UI components in `frontend/src/components/practice/hr/`:
   - `HrAnchorCardsGrid.tsx`: Grid of 3–6 interactive keyword cards with emerald glow on hit.
   - `HrPacingTimerBar.tsx`: Segmented 60–80s timer bar (Green $\to$ Amber $\to$ Red).
   - `HrTelemetryDashboard.tsx`: WPM, hesitation count, filler word badges.
   - `HrScorecardModal.tsx`: 4-axis scorecard modal with 1-click retry.
   - `HrVoiceHUD.tsx`: Integrated HUD combining tactile circle and cards grid.
   - `HrScreeningArena.tsx`: Full-screen 100dvh arena with mode selector and persona drawer.

---

## 2. Invariants & Guardrails
- Soft luxury pastel aesthetics (`#FFF0F5`, rose glow, lavender mesh).
- All files $\le 300$ lines.
- 100dvh viewport compliance (`h-[calc(100dvh-4rem)]`).
- Single-sink audio routing and tactile barge-in preserved.

---

## 3. Verification Commands
```bash
npm --prefix frontend run build
npm --prefix frontend run test:audio-contracts
```
