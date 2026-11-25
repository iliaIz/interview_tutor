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
| **10** | **Company Targeted Prep & SQL Arena** | [`10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md`](10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md) | PGlite WASM SQL engine, Curated Company Pipeline DAG, Company Readiness Index (CRI), Zero-VPS-Load |
| **11** | **Omnipresent AI Copilot Architecture** | [`11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md`](11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md) | Single headless copilot engine, polymorphic context normalizer, Socratic ladder, anti-solution leak AST guard |
| **12** | **Company Prep Studio Deepening & ArenaNavigator** | [`12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md`](12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md) | Deep Domain Manifest SSOT, ArenaNavigator cross-arena seam, zero vendor leakage in copilot normalizer |
| **13** | **Gemini Live Protocol & Omnipresent Copilot Enrichment** | [`13_GEMINI_LIVE_PROTOCOL_AND_OMNIPRESENT_COPILOT_ENRICHMENT.md`](13_GEMINI_LIVE_PROTOCOL_AND_OMNIPRESENT_COPILOT_ENRICHMENT.md) | Gemini 3.8 Live audioStreamEnd fast-handoff, global VoiceProvider, dynamic HLD context, Studio 1 fix |
| **14** | **Gemini Live Protocol Alignment & Voice Modal Stabilization** | [`14_GEMINI_LIVE_CANONICAL_PROTOCOL_AND_VOICE_MODAL_STABILIZATION.md`](14_GEMINI_LIVE_CANONICAL_PROTOCOL_AND_VOICE_MODAL_STABILIZATION.md) | Canonical Gemini Live audioStreamEnd, Zero-Audio Circuit Breaker, AudioContext warmup, Defensive Header Flexbox & Close button |
| **15** | **Practice Catalog Starter Workspace & TDD Remediation** | [`15_PRACTICE_CATALOG_STARTER_WORKSPACE_AND_TDD_REMEDIATION.md`](15_PRACTICE_CATALOG_STARTER_WORKSPACE_AND_TDD_REMEDIATION.md) | Zero-Stillborn Starter Invariant, 61 kata starter remediation, TDD Red stubs, mutation test cleanup, Raiffeisen starter fix |
| **16** | **Live Voice Modality Separation & Keepalive Resilience** | [`16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md`](16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md) | Strict PCM Audio Gating, Symmetrical Keepalive Ping/Pong, Dual-Sided Verdict Drain, High-Contrast Sticky UI |
| **17** | **Live Voice Acoustic Echo Immunity & Gain Safety** | [`17_LIVE_VOICE_ACOUSTIC_ECHO_IMMUNITY_AND_GAIN_SAFETY.md`](17_LIVE_VOICE_ACOUSTIC_ECHO_IMMUNITY_AND_GAIN_SAFETY.md) | Non-Zero Master Playout Gain Invariant, Speculative Ducking Demolition, Acoustic Filter Calibration (-29 dBFS), Strict Vocoder Temperature (1.0) |
| **18** | **Whiteboard IDE Synchronization & Branching Revisions** | [`18_WHITEBOARD_IDE_SYNCHRONIZATION_AND_BRANCHING_REVISIONS.md`](18_WHITEBOARD_IDE_SYNCHRONIZATION_AND_BRANCHING_REVISIONS.md) | Dedicated loopback port (:41790), unidirectional IDE push, non-eviction GC pinning, 3-state color differentiation, controlled checkout |
| **19** | **Epistemic Benevolence & Anti-Sycophancy (Part 1: Core Foundation & Tutoring)** | [`19_EPISTEMIC_BENEVOLENCE_AND_ANTI_SYCOPHANCY_TRIAGE.md`](19_EPISTEMIC_BENEVOLENCE_AND_ANTI_SYCOPHANCY_TRIAGE.md) | Epistemic Benevolence Axiom, Tri-State Epistemic Classification (`[ВЕРНО]`, `[ЧАСТИЧНО ВЕРНО]`, `[ОШИБОЧНО]`), zero-sycophancy tutor prompts |
| **20** | **Voice, System Design & War Room Anti-Sycophancy (Part 2: Arenas & Voice)** | [`20_VOICE_SYSTEM_DESIGN_WAR_ROOM_ANTI_SYCOPHANCY.md`](20_VOICE_SYSTEM_DESIGN_WAR_ROOM_ANTI_SYCOPHANCY.md) | Live Voice cognitive epistemic directives, Capacity Math Verification Gate, War Room Hard Stop on destructive actions, HR zero flattery |
| **21** | **Evaluators, Code Review & Challenge Gen Anti-Sycophancy (Part 3: Evaluation)** | [`21_EVALUATORS_CODE_REVIEW_AND_CHALLENGE_GEN_ANTI_SYCOPHANCY.md`](21_EVALUATORS_CODE_REVIEW_AND_CHALLENGE_GEN_ANTI_SYCOPHANCY.md) | Zero-Phantom-Deductions math ledger (`score = 100 - sum(deductions)`), Verdict-First code review summary, Ground Truth failure physics in bug challenges |
| **22** | **Alfa Digital & А-Токен Targeted Preparation Hub** | [`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`](22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md) | Zero-silo company projection, 27 physical root-cause questions, 23 Alfa banking katas, CRI readiness radar |
| **36** | **Gemini Live Practice Pair Resilience** | [`36_GEMINI_LIVE_PRACTICE_PAIR_RESILIENCE.md`](36_GEMINI_LIVE_PRACTICE_PAIR_RESILIENCE.md) | Practice Pair resilience, normal closure reconnect suppression, whiteboard SILENT scheduling, VAD pause alignment |
| **37** | **Gemini Live Long Session Stability & Stream Sync** | [`37_GEMINI_LIVE_LONG_SESSION_STABILITY_AND_STREAM_SYNC.md`](37_GEMINI_LIVE_LONG_SESSION_STABILITY_AND_STREAM_SYNC.md) | Context window compression (slidingWindow), LiveDeadAirGuard vocoder clamping (2000ms), upstream watchdog resync, whiteboard verbal continuity |
| **38** | **HR Voice Tutor Rehearsal & Chunking** | [`38_HR_VOICE_TUTOR_REHEARSAL_AND_CHUNKING.md`](38_HR_VOICE_TUTOR_REHEARSAL_AND_CHUNKING.md) | Interactive rehearsal partner (`tutor_rehearsal`), mentor persona (Aoede), in-flight error correction, on-demand verbal cues, anchor chunking |
| **40** | **HR Guided Micro-Chunking & Study TTS** | [`40_HR_GUIDED_MICRO_CHUNKS_AND_AUDIO_STUDY.md`](40_HR_GUIDED_MICRO_CHUNKS_AND_AUDIO_STUDY.md) | 4-rung Fading Scaffolding (`guided_zero_start`), atomic `microBeats`, paraphrase diversity, Study Tab TTS (`GET /api/hr/study-tts`), hybrid voice + button sync |
| **41** | **HR Guided Beat Selection & Focus Scope** | [`41_HR_GUIDED_BEAT_SELECTION_AND_SCOPE.md`](41_HR_GUIDED_BEAT_SELECTION_AND_SCOPE.md) | Non-destructive beat entry point (`startBeatId`), isolated `single_beat` vs `all_from_beat` scope, `chunkId` isolation, Study per-beat launch, SSOT `beats` HUD |

---

## 2. Invariants of Specification Architecture

1. **Cognitive Bounding Limit ($\le 350$ Lines):**  
   Every domain specification must remain under 350 lines to prevent lost-in-the-middle degradation and allow atomic single-call inspection via `view_file`.
2. **Closed-Loop Cohesion:**  
   A domain specification must describe its complete operational loop (e.g. from UI input down to execution engine and storage persistence).
3. **No Phantom Implementations:**  
   Specifications describe existing, empirically verified services and tests. All contracts must be backed by automated test suites.
