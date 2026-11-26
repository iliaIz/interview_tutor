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
- **LiveSessionAggregate:** An encapsulated domain entity managing the lifecycle of a real-time multimodal session (watchdog timers, upstream transport port, downstream client socket, state machine, turn custody).
- **SessionTurnState:** Package-private mutable turn-custody collaborator hidden inside `LiveVoiceSession` so internal streaming mechanics never leak as a public data bag.
- **LiveSessionBlueprint:** An immutable pre-flight session artifact containing resolved configuration, system directives, tool schemas, upstream setup builder, and Turn 0 greeting builder assembled before upstream connection opens.
- **ChallengeSubmissionRepository:** Persistence owner for coding challenge manifests, canonical challenge identity resolution, and versioned evaluation verdict storage.
- **Anemic Data Bag:** An anti-pattern where an object exposes dozens of mutable public fields without encapsulation or invariant protection (banned in public interfaces).
- **Turn 0 Lockdown:** Architectural invariant preventing AI evaluators from submitting grading verdicts before the candidate has spoken during the greeting phase.
- **LlmGatewayClient:** Single backend outbound AI inference port unifying chat text and structured completions, pre-first-token tutor streaming, speech audio synthesis, and text embeddings over an injectable outbound transport adapter.
  - *Avoid*: Ad-hoc network client wrappers, per-route retry loops, duplicated host fallback helpers
  - *Durable Owner*: `backend-ai-gateway` (stateless outbound inference relay delegating key rotation to the proxy gateway)
  - *Invariants*: All inference traffic traverses one port with caller cancellation propagation and local container failover; transient throttling retries on streams run strictly before emitting the first token byte; non-critical embedding lookups use zero retries and fall back deterministically.
- **UpstreamLiveChannel:** Single stateful owner of the backend live audio upstream socket satisfying the upstream transport port and encapsulating proactive rotation handoffs, silence clamping, non-speech recovery, and turn telemetry sealing.
  - *Avoid*: Public socket mutations on shared session bags, circular router and handoff collaborators
  - *Durable Owner*: `LiveVoiceSession` (per-session live audio channel custody)
  - *Invariants*: All upstream frame writes pass strictly through the upstream transport port; raw upstream connections never escape the channel; rotation swaps standby connections atomically without dropping active turns or replaying speech.
- **Slim Live Handshake Barrier:** Deterministic two-phase live session startup invariant where the connection request carries compact routing and calibration scalars while rich scenario, compliance, and whiteboard context arrive once in the opening initialization control frame behind a bounded readiness wait.
  - *Avoid*: Oversized multi-kilobyte connection requests, duplicated request and frame fields, blind startup queue races
  - *Durable Owner*: `LiveVoiceSession` and client live transport supervision
  - *Invariants*: Connection requests remain compact below header overflow bounds; session startup awaits the opening initialization control frame deterministically when flagged before assembling the upstream model configuration.
- **AudioBackendPort:** Minimal hardware abstraction seam isolating client real-time audio playout queue, gain safety, and physical buffer drain lifecycle from concrete browser audio worklets and mobile single-sink speakers.
  - *Avoid*: White-box internal worklet inspection in tests, dead speaker-mute or ducking shims
  - *Durable Owner*: `frontend-audio-playout`
  - *Invariants*: Dual-sided playout completion fires once per drained turn; tactile barge-in flushes worklet ring buffers while keeping nominal playout gain intact; microphone muting stays independent of AI voice playout.
- **TopologySimulationKernel:** Pure in-memory System Design queueing simulation and topology linting engine exposing continuous tick metrics, discrete-event scenario evaluation, and structural fault analysis behind a side-effect-free interface shared by thin background hosts.
  - *Avoid*: Duplicated queueing math across worker scripts, parallel standalone graph analyzers
  - *Durable Owner*: `frontend-system-design-kernel`
  - *Invariants*: Cache miss propagation always honors the evaluated cache hit ratio; background hosts hold zero domain math and act strictly as message relays; both simulation modes and topology linting run deterministically without worker mocks.
- **QuestionEvaluationService:** Deep conceptual Q&A grading and outcome persistence coordinator decoupling `LlmGatewayClient` text judging from atomic `QuestionEvaluationRepository` persistence, FSRS-5 scheduling, deficit decay, and error-gap recording under normalized multi-tenant `userId`.
  - *Avoid*: Duplicated 3-step memory cascades across HTTP routes and voice tools, `'anonymous'` vs `'default_user'` tenant mismatches
  - *Durable Owner*: `backend-evaluation-pipeline`
  - *Invariants*: Evaluation persistence, FSRS update, deficit decay, and gap creation always share one canonical `userId`; voice tool handlers invoke persistence without pulling in HTTP text-judging prompts.
- **LivePromptComposer:** Pure declarative live voice system-prompt builder taking pre-resolved session configuration and optional `PreResolvedHrContext`, eliminating synchronous disk I/O at composition time.
  - *Avoid*: 50-field untyped parameter bags, single-caller prompt pass-throughs, silent tool-directive omissions in mock branches
  - *Durable Owner*: `LiveSessionBlueprintBuilder`
  - *Invariants*: All mock-interview branches (including `socratic_tutoring` and `customPromptOverride`) emit both Turn 0 Lockdown and `LIVE_TOOL_CAPABILITY_DIRECTIVES`; composer runs zero filesystem reads.
- **CatalogSeeder & DatabaseBootstrap:** Explicit SQLite lifecycle initializer and single-transaction catalog seeder validating externalized JSON coding/mutation challenges against shared `CodingChallengeSchema` with disjoint `TST` / `DP` / `LLD` task-code partitioning.
  - *Avoid*: Import-time auth deletions inside index helpers, looping task-code updates that overwrite `DP-xx` with `LLD-xx`, huge inline TS seed blobs pinned in V8 heap
  - *Durable Owner*: `backend-catalog-persistence`
  - *Invariants*: Repeated catalog seeding preserves `DP-01..DP-N`, `TST-01..TST-N`, and contiguous `LLD-01..LLD-N` idempotently; `:memory:` test DBs initialize cleanly without disk side effects.
- **TutorTransportPort:** Injectable client-side AI Copilot transport abstraction unifying `streamChat`, `fetchHint`, and `groundRule` onto one canonical `TutorActiveContext` envelope with `AbortSignal` propagation and live persona forwarding.
  - *Avoid*: Dual legacy vs polymorphic request builders, hardcoded `'middle_scaffold', 2` hint parameters, uncancellable hint/grounding requests
  - *Durable Owner*: `usePracticeTutorStore`
  - *Invariants*: All 5 arenas emit and consume `TutorActiveContext`; all 5 compass rule catalogs resolve identically on frontend and backend with AST leak guarding.
- **useVoiceConfigStore:** Single consolidated Zustand store and versioned storage adapter unifying runtime voice config and persisted client preferences while eliminating `CustomEvent` buses and module-global caches.
  - *Avoid*: Render-phase `localStorage`/event side effects inside React `setState` updaters, 10 fragmented `localStorage` keys
  - *Durable Owner*: `frontend-voice-config`
  - *Invariants*: Legacy v1 keys migrate once deterministically on hydration; browser storage access stays guarded for headless Node contract tests.

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
