# Master Phase-Gate Execution Plan: Generic HR Voice Simulator Engine

> **Document:** `docs/hr_screening_engine/phases/00_phase_gate_master.md`  
> **Target Branch:** `feat/wave-20-hr-voice-screening-engine`  
> **Status:** Active Execution Backbone (SOTA Late 2026)  
> **Architecture Plan Reference:** [`docs/hr_screening_engine/master_implementation_plan.md`](../master_implementation_plan.md) & [`docs/hr_screening_engine/master_implementation_plan_wave21_pedagogical_suite.md`](../master_implementation_plan_wave21_pedagogical_suite.md)  
> **Deployment Policy:** Cloud GitHub Actions CI/CD via `deploy.yml`. Strict NO VPS Docker builds.

---

## 1. Phase-Gate Architecture Overview

The implementation is executed as a series of strictly gated, atomic phases. Each phase requires passing its verification gate before advancing to the next, guaranteeing zero regressions and complete test coverage.

### Wave 20: Core Multimodal Voice Engine & Real-Time HUD (Gates 1–7)
```mermaid
graph TD
    Gate1["Gate 1: Data Contracts & Schemas<br/>(shared/src/schemas/hrSimulator.ts)"] --> Gate2["Gate 2: Canonical Fixtures & Ground Truth<br/>(backend/src/data/hr/fixtures/)"]
    Gate2 --> Gate3["Gate 3: Backend Session & Prompts<br/>(hrPromptBuilder.ts, personas.ts)"]
    Gate3 --> Gate4["Gate 4: Backend Tools & FSM Orchestrator<br/>(liveHrToolDispatcher.ts, HrSimulationOrchestrator.ts)"]
    Gate4 --> Gate5["Gate 5: Client Zero-Latency KWS & Store<br/>(ClientKeywordSpotter.ts, useHrSimulatorStore.ts)"]
    Gate5 --> Gate6["Gate 6: Frontend Reactive HUD & Arena<br/>(HrScreeningArena.tsx, HrVoiceHUD.tsx)"]
    Gate6 --> Gate7["Gate 7: Automated Test Suite & CI/CD<br/>(Canary tests, git push & CI check)"]
```

### Wave 21: Pedagogical Suite, Question Matrix Catalog & Worked Examples (Gates 8–13)
```mermaid
graph TD
    Gate7 --> Gate8["Gate 8: REST API Routes & Fixture Streaming<br/>(backend/src/routes/hr.ts, GET /api/hr/questions)"]
    Gate8 --> Gate9["Gate 9: Zustand Store Catalog & Multi-Mode State<br/>(useHrSimulatorStore.ts, fetchQuestions, activeTab)"]
    Gate9 --> Gate10["Gate 10: Worked-Example Study Deck Component<br/>(HrQuestionStudyDeck.tsx, Triad, Traps & Law)"]
    Gate10 --> Gate11["Gate 11: Question Matrix Catalog Navigation<br/>(HrQuestionSelector.tsx, Phase Grouping & Badges)"]
    Gate11 --> Gate12["Gate 12: Arena Multi-Mode Hub & Luxury UX<br/>(HrScreeningArena.tsx, Segmented Control, 1-Click Bridge)"]
    Gate12 --> Gate13["Gate 13: End-to-End Verification & CI/CD<br/>(Automated tests, git push, GitHub Actions Green)"]
```

---

## 2. Gate Verification Table

| Gate | Phase Name | Primary Files Created / Modified | Quality Gate Criteria & Verification |
| :---: | :--- | :--- | :--- |
| **G1** | **Contracts & Schemas** | `shared/src/schemas/hrSimulator.ts`<br/>`shared/src/schemas/voiceEvents.ts`<br/>`shared/src/index.ts` | TypeBox compilation passes, zero circular dependencies. |
| **G2** | **Ground Truth Fixtures** | `backend/src/data/hr/fixtures/canonicalCandidateDossier.json`<br/>`backend/src/data/hr/fixtures/canonicalQuestionMatrix.json`<br/>`backend/src/data/hr/fixtures/defaultJobContexts.json`<br/>`backend/src/services/live/hrContextResolver.ts` | JSON fixtures validate 100% against schemas; zero hardcoded names in engine logic. |
| **G3** | **Backend Prompts & Session** | `backend/src/services/live/hrPromptBuilder.ts`<br/>`backend/src/prompts/personas.ts`<br/>`backend/src/services/live/liveWsSessionParams.ts` | Prompt builder invariants pass; anti-sycophancy rules strictly rendered. |
| **G4** | **Backend Tools & FSM** | `backend/src/services/live/liveHrToolDispatcher.ts`<br/>`backend/src/services/live/HrSimulationOrchestrator.ts` | Tools isolated, FSM transitions clean with watchdog safety fallback. |
| **G5** | **Client KWS & Zustand Store** | `frontend/src/audio/ClientKeywordSpotter.ts`<br/>`frontend/src/store/useHrSimulatorStore.ts` | Monotonic state latch verified (`PENDING -> OPTIMISTIC -> CONFIRMED`), Trie match $<10$ms. |
| **G6** | **Frontend UI & Visual HUD** | `frontend/src/components/practice/hr/HrAnchorCardsGrid.tsx`<br/>`frontend/src/components/practice/hr/HrPacingTimerBar.tsx`<br/>`frontend/src/components/practice/hr/HrTelemetryDashboard.tsx`<br/>`frontend/src/components/practice/hr/HrScorecardModal.tsx`<br/>`frontend/src/components/practice/hr/HrVoiceHUD.tsx`<br/>`frontend/src/components/practice/hr/HrScreeningArena.tsx` | Reactive HUD renders 4-axis scores, WPM, and pacing cleanly. |
| **G7** | **Acoustic Canary & Engine CI** | `backend/tests/test_hr_simulator_engine.js`<br/>`backend/tests/test_hr_acoustic_canary.js`<br/>`.github/workflows/deploy.yml` | All canary and acoustic tests pass, pushed and deployed cleanly via CI/CD. |
| **G8** | **HR REST API & Fixture Streaming** | `backend/src/routes/hr.ts`<br/>`backend/src/server.ts`<br/>`backend/tests/test_hr_routes.js` | `GET /api/hr/questions` and `GET /api/hr/dossier` return typed JSON payloads. Test exits with code 0. |
| **G9** | **Zustand Catalog & Selection State** | `frontend/src/store/useHrSimulatorStore.ts` | Store handles `questionsList`, `selectedQuestionId`, `activeTab: 'study' \| 'voice'`, and auto-initialization. |
| **G10** | **Worked-Example Study Deck** | `frontend/src/components/practice/hr/HrQuestionStudyDeck.tsx` | Renders canonical answer in Markdown, Triad breakdown, Required Anchors, and Anti-Pattern vs Senior Formula table. |
| **G11** | **Question Matrix Selector** | `frontend/src/components/practice/hr/HrQuestionSelector.tsx` | 12 questions categorized by phase with target duration chips and anchor counts. |
| **G12** | **Arena Multi-Mode Hub & Luxury UX** | `frontend/src/components/practice/hr/HrScreeningArena.tsx` | Seamless segmented switcher (`📘 Эталон и разбор` vs `🎙️ Голосовая арена`), 1-click bridge, luxury pastel aesthetics. |
| **G13** | **E2E Verification & CI/CD** | `backend/tests/test_hr_routes.js`<br/>GitHub Actions Workflow | All tests pass, git commit, push to `feat/wave-20-hr-voice-screening-engine`, CI/CD build green. |

---

## 3. Strict Invariant Verification Checklist

- [x] **Rule 0 (VPS Invariant):** Zero `docker build` on VPS. Cloud GitHub Actions runner builds images.
- [x] **Rule 8 (File Hygiene):** Newly created source files $\le 350$ lines. Modified existing files $\le 400$ lines.
- [x] **Rule 1 (LiteLLM Proxy):** All Live audio streaming routes through `${LITELLM_PROXY_URL}`.
- [x] **Rule 10 (Functional Registry):** Record all changes and rationale in `docs/architecture/functional_registry/`.
- [x] **Zero Regressions:** Existing interview, tutor, and theory modules remain untouched and operational.
