# Master Phase-Gate Execution Plan: Generic HR Voice Simulator Engine

> **Document:** `docs/hr_screening_engine/phases/00_phase_gate_master.md`  
> **Target Branch:** `feat/wave-20-hr-voice-screening-engine`  
> **Status:** Active Execution Backbone (SOTA Late 2026)  
> **Architecture Plan Reference:** [`docs/hr_screening_engine/master_implementation_plan.md`](../master_implementation_plan.md)  
> **Deployment Policy:** Cloud GitHub Actions CI/CD via `deploy.yml`. Strict NO VPS Docker builds.

---

## 1. Phase-Gate Architecture Overview

The implementation is executed as a series of 7 strictly gated, atomic phases. Each phase requires passing its verification gate before advancing to the next, guaranteeing zero regressions and complete test coverage.

```mermaid
graph TD
    Gate1["Gate 1: Data Contracts & Schemas<br/>(shared/src/schemas/hrSimulator.ts)"] --> Gate2["Gate 2: Canonical Fixtures & Ground Truth<br/>(backend/src/data/hr/fixtures/)"]
    Gate2 --> Gate3["Gate 3: Backend Session & Prompts<br/>(hrPromptBuilder.ts, personas.ts)"]
    Gate3 --> Gate4["Gate 4: Backend Tools & FSM Orchestrator<br/>(liveHrToolDispatcher.ts, HrSimulationOrchestrator.ts)"]
    Gate4 --> Gate5["Gate 5: Client Zero-Latency KWS & Store<br/>(ClientKeywordSpotter.ts, useHrSimulatorStore.ts)"]
    Gate5 --> Gate6["Gate 6: Frontend Reactive HUD & Arena<br/>(HrScreeningArena.tsx, HrVoiceHUD.tsx)"]
    Gate6 --> Gate7["Gate 7: Automated Test Suite & CI/CD<br/>(Canary tests, git push & CI check)"]
```

---

## 2. Gate Verification Table

| Gate | Phase Name | Primary Files Created / Modified | Quality Gate Criteria & Commands |
| :---: | :--- | :--- | :--- |
| **G1** | **Contracts & Schemas** | `shared/src/schemas/hrSimulator.ts`<br/>`shared/src/schemas/voiceEvents.ts`<br/>`shared/src/index.ts` | `npm --prefix shared run build`<br/>Strict TypeBox compliance, clean exports. |
| **G2** | **Ground Truth Fixtures** | `backend/src/data/hr/fixtures/canonicalCandidateDossier.json`<br/>`backend/src/data/hr/fixtures/canonicalQuestionMatrix.json`<br/>`backend/src/data/hr/fixtures/defaultJobContexts.json`<br/>`backend/src/services/live/hrContextResolver.ts` | Node.js JSON validation against TypeBox schema.<br/>Zero hardcoded names in engine code. |
| **G3** | **Backend Prompts & Session** | `backend/src/services/live/hrPromptBuilder.ts`<br/>`backend/src/prompts/personas.ts`<br/>`backend/src/services/live/liveWsSessionParams.ts`<br/>`backend/src/services/live/livePromptBuilder.ts` | `npm --prefix backend run build`<br/>Prompt invariants pass (`npm run test:prompts`). |
| **G4** | **Backend Tools & FSM** | `backend/src/services/live/liveHrToolDispatcher.ts`<br/>`backend/src/services/live/HrSimulationOrchestrator.ts`<br/>`backend/src/services/live/liveToolDeclarations.ts`<br/>`backend/src/services/live/liveToolDispatcher.ts`<br/>`backend/src/services/live/liveAudioStreamRouter.ts` | `npm --prefix backend run build`<br/>Tool isolation tests pass (`npm run test:live:tool-isolation`). |
| **G5** | **Client KWS & Zustand Store** | `frontend/src/audio/ClientKeywordSpotter.ts`<br/>`frontend/src/store/useHrSimulatorStore.ts`<br/>`frontend/src/audio/types.ts` | `npm --prefix frontend run build`<br/>Monotonic state latch verified, $<10$ms Trie match. |
| **G6** | **Frontend UI & Visual HUD** | `frontend/src/components/practice/hr/HrAnchorCardsGrid.tsx`<br/>`frontend/src/components/practice/hr/HrPacingTimerBar.tsx`<br/>`frontend/src/components/practice/hr/HrTelemetryDashboard.tsx`<br/>`frontend/src/components/practice/hr/HrScorecardModal.tsx`<br/>`frontend/src/components/practice/hr/HrVoiceHUD.tsx`<br/>`frontend/src/components/practice/hr/HrScreeningArena.tsx` | `npm --prefix frontend run build`<br/>Audio playout contract tests pass (`npm run test:audio-contracts`). |
| **G7** | **E2E Canary & CI/CD** | `backend/src/tests/hr/hrSimulator.spec.ts`<br/>`backend/src/tests/hr/acousticHrScreeningCanary.ts`<br/>`.github/workflows/deploy.yml` | `npm test` in backend & frontend.<br/>`git push origin feat/wave-20-hr-voice-screening-engine`.<br/>GitHub Actions quality-gate green. |

---

## 3. Strict Invariant Verification Checklist

- [ ] **Rule 0 (VPS Invariant):** Zero `docker build` on local machine/VPS. Everything runs via cloud GitHub Actions.
- [ ] **Rule 8 (File Hygiene):** Newly created source files $\le 350$ lines. Modified existing files $\le 400$ lines.
- [ ] **Rule 1 (LiteLLM Proxy):** All Live audio streaming routes through `${LITELLM_PROXY_URL}`.
- [ ] **Rule 10 (Functional Registry):** Record all changes and rationale in `docs/architecture/functional_registry/`.
- [ ] **Zero Regressions:** `interview`, `tutor`, and `system_design` test suites pass without regression.
