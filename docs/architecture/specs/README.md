# Master Domain Specifications Index (SSOT Router)

> **Location:** `docs/architecture/specs/`  
> **Status:** Authoritative Single Source of Truth (SSOT) Architecture  
> **Target Standard:** SOTA Late September 2026  
> **Parent Architecture:** [docs/architecture.md](file:///d:/projects/interview_projects/spring/docs/architecture.md)

---

## 1. Domain Specification Registry (Hub-and-Spoke Topology)

> 🧭 **Быстрая навигация по функциям и разделам UI:** См. [Функциональную Карту Проекта (`docs/architecture/FUNCTIONAL_MAP.md`)](file:///d:/projects/interview_projects/spring/docs/architecture/FUNCTIONAL_MAP.md) для мгновенного поиска: в какой студии/вкладке живет нужный функционал, какими компонентами и бэкенд-эндпоинтами он реализован.

All subsystems in InterviewPrep AI are governed by dedicated, single-responsibility domain specifications ($\le 350$ lines each). Before proposing or executing changes in any area of the codebase, engineers and AI agents MUST read the corresponding domain specification:

| # | Domain / Pillar | Authoritative Specification File | Core Responsibility & Enforced Invariants |
| :-: | :--- | :--- | :--- |
| **00** | **Core Infrastructure & Security** | [`00_CORE_INFRASTRUCTURE_AND_SECURITY.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/00_CORE_INFRASTRUCTURE_AND_SECURITY.md) | LiteLLM gateway, 4 virtual models, Circuit Breaker, SQLite WAL, Zero-Trust WS tickets |
| **01** | **Oral Mock Interview & Voice** | [`01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md) | Real-time multimodal voice, Headless `LiveVoiceEngine`, subcomponent decomposition |
| **—** | **Auto-VAD Low-Level Protocol** | [`AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md) | DSP 16k/24k PCM, Dual-Sided Handshake truth table, EchoGuard, generationComplete |
| **02** | **Testing & Mutation Arena** | [`02_TESTING_AND_MUTATION_ARENA.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/02_TESTING_AND_MUTATION_ARENA.md) | Pitest bytecode mutation, 42 katas, Testing Compass, anti-potemkin test guards |
| **03** | **Spring Transactions Lab** | [`03_SPRING_TRANSACTIONS_LAB.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/03_SPRING_TRANSACTIONS_LAB.md) | In-memory proxy engine (<50ms), propagation rules, checked exception rollback trap |
| **04** | **System Design Arena** | [`04_SYSTEM_DESIGN_ARENA.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/04_SYSTEM_DESIGN_ARENA.md) | Cytoscape canvas graph model, L1 capacity math formulas, 31 scenarios, SPOF detection |
| **05** | **Production Incident Triage** | [`05_PRODUCTION_INCIDENT_TRIAGE.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/05_PRODUCTION_INCIDENT_TRIAGE.md) | Tarjan SCC deadlock cycle detector (<1ms), thread dump parsing, MTTM/MTTR metrics |
| **06** | **Machine Coding & LLD** | [`06_MACHINE_CODING_AND_LLD.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/06_MACHINE_CODING_AND_LLD.md) | AST rules: `enforce-clock-injection`, `no-double-in-money`, deadlock-free lock order |
| **07** | **Guided Academy Studio** | [`07_GUIDED_ACADEMY_AND_FSRS5.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/07_GUIDED_ACADEMY_AND_FSRS5.md) | FSRS-5 17-weight memory model, 8-track curricular DAG (177 nodes), NBA scheduler |
| **08** | **StudyDeck & Audio Podcasts** | [`08_STUDYDECK_AND_AUDIO_PODCASTS.md`](file:///d:/projects/interview_projects/spring/docs/architecture/specs/08_STUDYDECK_AND_AUDIO_PODCASTS.md) | Two-host dialogue generation, Gemini TTS multi-voice synthesis, lock-screen MediaSession |
| **09** | **Design Patterns Practice Arena** | [`09_DESIGN_PATTERNS_PRACTICE_ARENA.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/specs/09_DESIGN_PATTERNS_PRACTICE_ARENA.md) | SOTA 2026 GoF revision, Anti-pattern refactoring, AST structural invariants, Overengineering Sentinel |

---

## 2. Invariants of Specification Architecture

1. **Cognitive Bounding Limit ($\le 350$ Lines):**  
   Every domain specification must remain under 350 lines to prevent lost-in-the-middle degradation and allow atomic single-call inspection via `view_file`.
2. **Closed-Loop Cohesion:**  
   A domain specification must describe its complete operational loop (e.g. from UI input down to execution engine and storage persistence).
3. **No Phantom Implementations:**  
   Specifications describe existing, empirically verified services and tests. All contracts must be backed by automated test suites.
