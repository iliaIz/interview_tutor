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

### Live Session & Transport
- **LiveSessionAggregate:** An encapsulated domain entity managing the lifecycle of a real-time multimodal session (watchdog timers, upstream Gemini WebSocket, downstream client WebSocket, state machine).
- **Anemic Data Bag:** An anti-pattern where an object exposes 50+ mutable public fields without encapsulation or invariant protection (e.g., legacy `ProxySession`).
- **Turn 0 Lockdown:** Architectural invariant preventing AI evaluators from submitting grading verdicts before the candidate has spoken during the greeting phase.
