# Platform Domain Glossary (Ubiquitous Language)

> Authoritative definitions for InterviewPrep AI fullstack technical assessment platform.

---

### Voice & Multimodal Audio
- **Dual-Sided Handshake:** A deterministic concurrency barrier between AI speech playout drain and Gemini Live WebSocket `turnComplete: true`. The candidate microphone is unblocked by whichever event completes last.
- **Tactile Barge-In:** An explicit user interaction (click on central HUD button or press of hotkey) that instantly aborts active audio playback with a 5ms de-click ramp and shifts the voice engine into recording mode.
- **Acoustic Barge-In:** Cloud server-side voice activity detection by Gemini Live that automatically endpoints candidate speech without client-side heuristics.
- **Anti-Lapping Ring Buffer:** A power-of-two circular audio buffer with strict occupancy head/tail tracking (`size - occupancy - 1`) used inside the AudioWorklet to prevent audio frame overruns during high-speed synthesis bursts.
- **Non-Speech Token Sanitization:** Filtering out raw acoustic prompt leakages (`<no speech>`, `<pause>`, `[no speech]`) from UI subtitles and transcripts.

### Assessment & Code Sandboxing
- **Evaluation Gate:** A sequential, deterministic verification stage that candidate code must pass before grading (JVM Unit Tests -> AST Invariants -> Mutation Gate -> AI Judge).
- **Mutation Testing Gate (PITest):** Bytecode-level fault injection testing that verifies candidate test suites actually kill synthetic mutants (preventing 100% test pass rates on tautological tests).
- **Time Virtualization Invariant:** Prohibition of `System.currentTimeMillis()`, `Instant.now()`, or `LocalDate.now()` in business logic, mandating constructor injection of `java.time.Clock`.
- **Financial Precision Invariant:** Strict mandate of `java.math.BigDecimal` with explicit scale and `HALF_EVEN` rounding in financial domains, blocking `double` and `float`.

### Software Design & Pattern Architecture

### Design Pattern Kata
A structured programming exercise focused on eliminating an architectural code smell or anti-pattern by applying an idiomatic design pattern (GoF classic or modern language-native replacement).
- **Avoid**: Toy kata, theoretical quiz, boilerplate challenge
- **Durable Owner**: `practice-service` (persisted in challenges catalog)
- **Invariants**: Must start with a compiling baseline containing verified architectural smells; public behavioral contracts verified by unit tests must remain green across refactoring; must specify deterministic structural AST verification constraints.

### Anti-Pattern Refactoring Seam
A bounded coupling point in existing codebase logic (such as procedural branch cascades, tight vendor SDK coupling, or mutable global state) targeted for polymorphic decoupling without breaking public contracts.
- **Avoid**: Greenfield rewrite, patch, quick fix
- **Durable Owner**: `practice-service` (persisted in kata manifest)
- **Invariants**: Must preserve external method signatures and return types; must eliminate targeted smell without introducing cascading contract breaks.

### Structural AST Invariant
A deterministic compile-time syntax rule asserting that candidate code adheres to a specific architectural shape (such as delegation over inheritance, sealed type matching, or port-adapter boundary) rather than mimicking behavior via procedural shortcuts.
- **Avoid**: Heuristic lint, regex check, manual code inspection
- **Durable Owner**: `sandbox-execution-service` (evaluated in Gate 2)
- **Invariants**: Pure in-memory AST verification (<5ms execution); zero network calls; failure halts evaluation before LLM judging.

### Overengineering Sentinel
An evaluation check and Socratic AI prompt penalizing unnecessary pattern complexity where simpler language features provide superior readability and performance.
- **Avoid**: Dogmatic pattern enforcement, pattern zealotry
- **Durable Owner**: `ai-tutor-service` (prompt directives and rubric scorecards)
- **Invariants**: Must reward language-native primitives (lambdas, records, pattern matching) over multi-class GoF hierarchies when functional requirements do not justify polymorphism.

### Live Session & Transport
- **Fast-Handoff VAD:** A hybrid speech boundary signaling mechanism (`{ realtimeInput: { audioStreamEnd: true } }`) dispatched upon candidate speech cessation to eliminate Gemini Live silence accumulation stalls without corrupting WebSocket frames.
- **LiveSessionAggregate:** An encapsulated domain entity managing the lifecycle of a real-time multimodal session (watchdog timers, upstream Gemini WebSocket, downstream client WebSocket, state machine).
- **Anemic Data Bag:** An anti-pattern where an object exposes 50+ mutable public fields without encapsulation or invariant protection (e.g., legacy `ProxySession`).
- **Turn 0 Lockdown:** Architectural invariant preventing AI evaluators from submitting grading verdicts before the candidate has spoken during the greeting phase.

### Company Preparation & Relational Data Engines
- **Arena Pre-Hydration Envelope:** A typed normalization layer in `arenaNavigator.ts` unwrapping backend manifest envelopes (`{ challenge, savedDraft }`) before passing them to arena stores, preventing blank workspaces.
- **Curated Company Practice Track:** A company-specific view in the Practice Catalog filtering challenges by hiring pipeline relevance (`raiffeisen_code_review`, `machine_coding`).
- **Omnipresent Arena Copilot Provider:** Root-level lifecycle encapsulation (`PracticeVoiceProvider` at application root) guaranteeing zero "Voice Temporarily Unavailable" crashes across all six pipeline stages.
- **Curated Company Pipeline:** A company-specific Directed Acyclic Graph (DAG) projection over canonical assessment entities (Questions, Katas, Bug Hunts, System Design, Voice Mock) mapping directly to the company's hiring pipeline stages.
- **PGlite WASM SQL Sandbox:** An in-browser WebAssembly instance of PostgreSQL 16 (`@electric-sql/pglite`) executing SQL challenges client-side with 0 MB server RAM overhead and 100% PostgreSQL SQL dialect fidelity.
- **Company Readiness Index (CRI):** A telemetry-backed weighted score ($CRI \in [0\%, 100\%]$) computing candidate readiness for a specific employer's technical bar across cultural fit, live coding, code review, SQL, and system design.
- **Product Engineer Archetype:** An engineering mindset valuing end-to-end ownership (from product problem definition, metrics like TTM and Pain Index, through shift-left automated testing, to production monitoring and incident response) rather than siloed backend code implementation.
- **Omnipresent AI Copilot:** A unified, cross-arena headless pair-programming engine (`useTutorStore`, `TutorDrawer`) that dynamically ingests active workspace context (code, SQL, compiler output, company DNA) without code duplication.
- **Take-Home Project Lab:** An interactive post-mortem simulator evaluating real candidate pull requests against enterprise production standards, identifying concurrency race conditions and atomic SQL anti-patterns.
- **Socratic Scaffold Ladder:** A pedagogical prompt progression (Tier 1 Nudge -> Tier 2 Architecture Scaffold -> Tier 3 Invariant Deep Dive) preventing premature solution leakage while maximizing candidate cognitive development.
