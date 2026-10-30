# Phase 4: Backend Tool Dispatcher & Deterministic FSM Orchestrator

> **Document:** `docs/hr_screening_engine/phases/phase_04_backend_tool_dispatcher_and_fsm.md`  
> **Status:** Phase 4 Specification & Execution Gate  
> **Quality Gate G4:** `npm --prefix backend run build` and `npm run test:live:tool-isolation` exit code 0.

---

## 1. Objectives & Scope
1. Implement `backend/src/services/live/liveHrToolDispatcher.ts`:
   - Handles `advance_hr_phase`, `submit_hr_evaluation`, and `emit_hr_round_evaluation`.
   - Sends downstream WebSocket events: `hr_phase_transition`, `hr_scorecard_ready`.
2. Implement `backend/src/services/live/HrSimulationOrchestrator.ts`:
   - FSM for Topology A (Phases 0-7) and Topology B (Rapid-Fire Micro-Drill).
   - Manages Two-Phase Watchdog: 75s warning, 90s cut-off.
   - Handles client quick-retry (`HR_DRILL_RETRY`).
3. Update `backend/src/services/live/liveToolDeclarations.ts`:
   - Declare HR tool schemas when `isHrSessionType(sessionType)`.
4. Update `backend/src/services/live/liveToolDispatcher.ts`:
   - Route HR tool calls to `liveHrToolDispatcher.ts`.
5. Update `backend/src/services/live/liveAudioStreamRouter.ts`:
   - Forward `serverContent.inputTranscription` as `hr_user_transcript_delta`.

---

## 2. Invariants & Guardrails
- `liveHrToolDispatcher.ts` $\le 250$ lines.
- `HrSimulationOrchestrator.ts` $\le 300$ lines.
- `liveToolDispatcher.ts` lines remain under 400 lines (delegating to modular handler).
- Zero interference with `interview`, `tutor`, and `system_design` tools.

---

## 3. Verification Commands
```bash
npm --prefix backend run build
npm --prefix backend run test:live:tool-isolation
```
