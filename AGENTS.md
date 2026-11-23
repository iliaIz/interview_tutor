# Architectural Guidelines & Hard Invariants for InterviewPrep AI

> Full architectural specifications, sequence diagrams, and Mermaid state machines: see [docs/architecture.md](docs/architecture.md).

---

## Agent skills

| Topic | Pointer |
| :--- | :--- |
| **Issue Tracker** | See `docs/agents/issue-tracker.md` (GitHub native sub-issues & blockers) |
| **Domain Docs** | See `docs/agents/domain.md` (`GLOSSARY.md`, `docs/adr/`) |

---

## 0. ENVIRONMENT INVARIANTS & DEPLOYMENT POLICY (CRITICAL)
- **STRICT PROHIBITION: NO LOCAL DOCKER BUILDS ON VPS.**
  - NEVER execute `docker build`, `docker compose build`, or `docker compose up --build` on this VPS.
  - The VPS has strictly 1.8 GB RAM. Running compilers (`tsc`, `esbuild`, `docker build`) exhausts memory, starves kernel swap, and causes 10–20 minute server freezes.
  - Local builds are intercepted and blocked by the system guardrail at `/usr/local/bin/docker`.
- **CANONICAL CI/CD WORKFLOW:**
  - All container images are built in cloud runners by GitHub Actions (`.github/workflows/deploy.yml`).
  - NO LOCAL COMPILATION OR TYPECHECKS: Never run `tsc`, `npx tsc`, `npm run build`, or `cargo` locally. All heavy toolchains are blocked by `/usr/local/sbin/blocked-tool`.
  - NO FULL-DISK SCANS: Never run `find /`, `grep -r /`, or scan `/var/lib/docker/overlay2`. File searches are strictly constrained to the project folder (`find src/ ...`, `git ls-files`).
  - Remote verification: Commit and push to a feature branch (`git push -u origin feat/...`) and run `remote-verify`.
  - Deployment: Fast-forward merge to `main` and push (`git push origin main`). GitHub Actions builds, tests, pushes to GHCR, and performs zero-downtime deployment on the VPS via `docker compose pull && docker compose up -d`.

---

## 1. LiteLLM Proxy Invariant (No Direct Provider Calls / No Hardcoded Keys)
- All LLM, Live Audio WebSocket, and TTS interactions MUST route strictly through `LiteLLM_Proxy` (`D:\projects\LiteLLM_Proxy` / `http://litellm-gateway:4000`) running in Docker:
  - HTTP REST endpoints: `${LITELLM_PROXY_URL}` (`http://host.docker.internal:4000/v1` or `http://localhost:4000/v1`).
  - Live Multimodal WebSocket endpoint: `ws://host.docker.internal:4000/ws/live?model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`.
- NEVER hardcode Google API keys (`AQ.*`) or internal upstream model names (`gemini-2.5-flash-native-audio-latest`, etc.) in the application code.
- Always use environment variables:
  - `GEMINI_TEXT_MODEL` (e.g. `gemini-smart`)
  - `GEMINI_LIVE_MODEL` (e.g. `gemini-live` / `gemini-tts-live-v3`)
  - `GEMINI_TTS_MODEL` (e.g. `gemini-tts-v3`)
  - `LITELLM_API_KEY` (virtual key for proxy authorization)
- Dynamic model mapping, API key pool failover, and two-tier Circuit Breaker (Key 429 vs Model 503 Fast-Failover) are handled centrally by `LiteLLM_Proxy`.

---

## 2. Gemini Live Multimodal Invariants & State Machine

### 2.1. First-Turn Tool Lockdown Invariant
- **Turn 0 Directive:** In all system prompts (`socratic_tutoring`, `adaptive_probing`, and `customPromptOverride`), the AI interviewer is strictly forbidden from invoking `submit_interview_evaluation` during Turn 0 greeting.
- **Backend Guard:** The backend WebSocket session tracks `hasCandidateResponded`. If Gemini attempts to call `submit_interview_evaluation` when `hasCandidateResponded === false`, the backend rejects the call with a structured `toolResponse` error, forcing the model to speak the greeting and read the question aloud.

### 2.2. Dual-Sided Handshake Invariant (Race Condition Elimination)
- The transition from AI speech to candidate microphone (`isAiSpeaking: false`, `isRecording: true`) is symmetrically unblocked by whichever event finishes LAST:
  1. `AudioPlayoutManager.onPlaybackFinished` (when physical audio finishes draining in headphones).
  2. WebSocket `turnComplete: true` arrival (when network generation concludes).
- If audio drains before `turnComplete` arrives $\rightarrow$ `turnComplete` handler detects empty playout queue and immediately unlocks candidate mic.
- If `turnComplete` arrives before audio drains $\rightarrow$ `onPlaybackFinished` unlocks candidate mic upon physical timeline drain.

### 2.3. Direct UTF-8 WebSocket Decoding
- In Node.js `ws` library, incoming frames from Uvicorn / LiteLLM arrive with `isBinary === true` but contain valid UTF-8 JSON.
- All upstream frames from `geminiSocket` MUST always be decoded as UTF-8 strings and parsed as JSON before routing.

### 2.4. Non-Blocking Hardware Initialization
- `initMicrophoneHardware()` executes in an asynchronous background promise (`void initMicrophoneHardware()`).
- WebSocket connection and AI greeting audio are NEVER blocked by operating system microphone permission prompts.

### 2.5. Single-Sink Audio Routing & Tactile Barge-In
- Mobile (Android/iOS): Routes EXCLUSIVELY to `MediaStreamAudioDestinationNode` + HTML5 Audio element (`STREAM_MUSIC` loudspeaker) to prevent dual-output echo.
- Desktop: Direct Web Audio `context.destination` with low latency.
- Tactile Barge-In: User click on central circle during AI speech triggers `AudioPlayoutManager.handleInterruption()` with a 5ms de-click ramp, immediately silencing audio and switching UI to active recording.

### 2.6. Canonical Gemini Live VAD & Bidirectional Audio Streaming Invariant (SOTA Late 2026)
- **Authoritative Standard SSOT:** Architecture adheres strictly to Google's official Gemini Live protocol (`google-gemini/gemini-live-api-examples` and `@google/genai` SDK).
- **Native Cloud VAD Enabled:** In Auto-VAD mode (`turnMode === 'auto'`), `automaticActivityDetection.disabled` is `false` with `silenceDurationMs` calibrated in the `[500, 1000]`ms range and `prefixPaddingMs: 500`. Gemini Live automatically detects speech boundaries (`voiceActivity: ACTIVITY_START` and `ACTIVITY_END`).
- **Continuous Mic Streaming:** The microphone stream flows continuously as 16kHz 16-bit Mono PCM chunks wrapped in `{ realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }`. Ambient trailing silence is naturally streamed between utterances so server-side VAD can cleanly endpoint turns.
- **Strict Channel Separation (No Interleaving):** Never inject empty `{ clientContent: { turnComplete: true } }` frames into an active audio stream. Per Google specifications, `clientContent` is reserved for text history/seeding, while audio streaming uses `realtimeInput`.
- **Hybrid VAD Fast-Handoff:** When client-side neural Silero VAD detects speech cessation, it signals endpointing via canonical `{ realtimeInput: { audioStreamEnd: true } }`, triggering zero-latency handoff without violating WebSocket contracts.
- **Turn 0 Question Recitation Lockdown:** During question recitation on Turn 0, acoustic barge-in is locked until physical DAC audio drain (`AudioPlayoutManager.onPlaybackFinished()`). Only explicit tactile clicks can interrupt Turn 0.

### 2.7. Live Dead-Air Clamping & Vocoder Stall Invariant (SOTA Late 2026)
- **Root Cause Prevention:** Gemini Live upstream vocoder stalls (where text tokens finish but upstream streams continuous digital silence frames holding the turn open) MUST be clamped at the backend router level via `LiveDeadAirGuard`.
- **Clamp Contract:** Silence after active speech $> 1200$ms is suppressed; $\ge 2000$ms continuous silence triggers turn clamping with synthesized `turnComplete: true` and `{ deadAirClamped: true }`.
- **Anti-Lapping Ring Buffer:** Client-side AudioWorklet ring buffer MUST use an anti-lapping capacity check (`size - occupancy - 1`) and $\ge 2^{22}$ samples ($\approx 174$s) to guarantee zero sample loss during high-speed upstream model synthesis bursts.

### 2.8. Trap-Free FSM, Two-Phase Watchdog & Clean Upstream Interruption Invariant (SOTA Late 2026)
- **Trap-Free FSM Invariant:** `LiveVoiceStateMachine` MUST never get stuck in `COMMITTING` or `AI_THINKING`. Both states MUST transition cleanly to `CANDIDATE_LISTENING` upon:
  1. `DEAD_AIR_RECOVERED` (dispatched on server watchdog or client safety timer).
  2. `BARGE_IN_TRIGGERED` (tactile button click during waiting).
  3. `PLAYOUT_FINISHED` (zero-audio turn completion).
- **Two-Phase Watchdog Invariant:** The gateway watchdog operates in two phases:
  1. Informational nudge at 5.0s (standard) / 8.0s (thinking) dispatching `{ type: 'thinking_delay' }` without disturbing upstream session.
  2. Generation timeout at 22.0s (standard) / 25.0s (thinking) dispatching clean `{ type: 'dead_air_recovery' }` to client and reclaiming microphone (clean state reset without illegal schema injections).
- **Client Autonomous Safety Fallback:** `LiveVoiceEngine` maintains an autonomous 25s safety timer in case both upstream and gateway hang.

### 2.9. Non-Speech Interception & Zero-Audio Prevention Invariant (SOTA Late 2026)
- **Non-Speech Token Sanitization:** Raw acoustic tokens from Gemini (`<no speech>`, `<no speech>{pause}`, `[no speech]`, `<pause>`) MUST NEVER leak into candidate transcripts or subtitles.
- **Active Conversational Recovery:** If upstream Gemini emits `<no speech>` or synthesizes $< 200$ audio bytes after candidate speech, `LiveCannedErrorRecovery` intercepts the turn and sends an active conversational nudge: `"[КАНДИДАТ ЗАВЕРШИЛ ОТВЕТ, НО ЗВУК БЫЛ ТИХИМ / НЕРАЗБОРЧИВЫМ]: Среагируй естественно голосом на русском языке (1 короткая фраза): 'Я тебя не расслышала, повтори, пожалуйста, ответ.' или продолжи тему вопроса."`. The candidate hears a real verbal clarification instead of awkward silence.
- **Acoustic Non-Zero Audio SLA ($\ge 1200$ bytes):** Every spoken response following candidate speech MUST contain $\ge 1200$ bytes ($\ge 250$ms) of audio and $\ge 10$ characters. CI/CD pre-flight canary (`runAcousticVadMatrix.ts --suite=canary`) strictly asserts this conjunction and aborts deployment on any regression.

---

## 3. UI/UX Standard, Health & Resilience Invariants
- **Target Audience & Aesthetic:** Soft luxury pastel aesthetics (`#FFF0F5`, lavender, rose, gentle mesh glow auras).
- **Audio Session Flow:** 3-Stage flow (Lobby -> Active Session -> Verdict with 1-click retry).
- **Health Monitoring:** `/api/health` validates liveness AND checks the presence of all 4 required models (`GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_EMBEDDING_MODEL`) in the LiteLLM registry with latency metrics.
- **Turbo-Prefetching:** Speculative background prefetching is controlled by an explicit toggle in the Lobby (default: off).
- **AbortSignal & Cancellation:** Closing modal or clicking "Прервать" propagates `AbortController.abort()` to LiteLLM Proxy.

---

## 4. Deterministic Time & Financial Invariants in Machine Coding (Java 21)
- **Time Virtualization Invariant:**
  - In all LLD & Machine Coding challenges, business services MUST NEVER call `System.currentTimeMillis()`, `Instant.now()`, or `LocalDate.now()` directly.
  - Time MUST be constructor-injected via `java.time.Clock`. Unit tests MUST use `Clock.fixed(instant, zone)` or `Clock.offset` to test arbitrary sliding time windows deterministically in 0ms without `Thread.sleep()`.
  - Enforced statically via AST rule `enforce-clock-injection`.
- **Financial Precision Invariant:**
  - All monetary amounts, balances, and exchange rates MUST use `java.math.BigDecimal` with explicit scale and `RoundingMode.HALF_EVEN` (Banker's rounding).
  - Use of `double` or `float` in financial domains is strictly blocked via AST rule `no-double-in-money`.
- **Deadlock-Free Transfer Invariant:**
  - In double-entry ledgers and multi-account transfers, lock acquisition MUST follow strict global ID ordering: `lock(min(id1, id2)) -> lock(max(id1, id2))`.

---

## 5. Zero-Phantom-Fallback & Full-Jitter Backoff Invariant
- **No Fabricated Fallbacks:** Under no circumstances does the backend return hardcoded static challenges disguised as dynamic AI generation.
- **Full Jitter Backoff:** Upstream rate limits (429/503) trigger Full-Jitter Exponential Backoff ($T = \text{random}(0, \min(2500, 800 \times 1.8^{\text{attempt}}))$) up to 2 retries.
- **Actionable Recovery Cards:** Persistent failures return structured HTTP 503 payloads rendering `TaskRecoveryCard` with live countdown, auto-retry pause, inline health diagnostics, and direct access to the 70-kata catalog.

---

## 6. Multi-Modal Reference-Counted Scroll Lock & 100dvh Invariant
- **Reference-Counted Scroll Lock:** `useBodyScrollLock` tracks `activeLocksCount`. Nested modals or drawers (e.g. Memory Radar over Bug Hunt Modal) never prematurely unlock `document.body` when child components unmount.
- **100dvh Viewport Standard:** All full-screen arenas and modals use `100dvh` (`h-[calc(100dvh-4rem)]`) to prevent viewport jumping when mobile virtual keyboards activate.
- **120 FPS Virtualization:** Catalogs of 800+ items use CSS `content-visibility: auto` with `contain-intrinsic-size: 0 90px`.

---

## 7. Multi-Faceted Research-Driven Architecture (MFRDA) Invariant
- **Zero Premature Planning:** Never generate speculative execution roadmaps or "locked" phase files before empirical baseline fact-checking and external Deep Research verification.
- **Unconstrained Inquiry (Zero Anchoring):** Never restrict Deep Research prompts to pre-selected arbitrary choices (e.g., "Option A vs Option B"). Always mandate the discovery of emergent SOTA paradigms as of late 2026. Prompts must strictly adhere to the [deep-research-prompt-crafting](.agents/skills/deep-research-prompt-crafting/SKILL.md) skill, avoiding obsolete version anchoring and specifying capabilities via first-principles constraints.
- **Empirical Codebase Verification First:** Before proposing any architectural refactoring, verify the As-Is state directly in the code (DB schemas, routing, types, scripts) to prevent hallucinated assumptions.
- **Living Documentation & SSOT:** All high-level plans, verified defects, research prompts, and decisions MUST be persistently maintained in `docs/roadmap/wave_05_system_and_ai_evolution/`.

---

## 8. File-Hygiene & Cognitive Bounding Invariant (SOTA Late 2026)
- **Strict File Length Limits:**
  - Newly created source files MUST NOT exceed **350 lines**.
  - Any file undergoing modification that exceeds **400 lines** MUST be proactively decomposed into single-responsibility subcomponents or modules before adding new logic.
- **Single Responsibility Principle (SRP):**
  - Presentation (React UI / JSX) must be strictly decoupled from low-level infrastructure (Web Audio DSP, WebSockets, REST APIs).
  - Business logic and state machines must reside in headless TypeScript classes or custom hooks, not inside component render functions.
- **Zero Parallel Reimplementation (Strict Reuse Invariant):**
  - Creating parallel implementations of existing subsystems (e.g. creating a secondary voice WebSocket handler instead of importing `LiveVoiceEngine`) is strictly forbidden.
  - If an existing subsystem does not support a desired use case, the agent MUST extend the core headless abstraction rather than cloning it.

---

## 9. Domain Specifications Hierarchy & Protocol SSOTs
- **Modular SSOT Navigation (Hub-and-Spoke):**
  - All subsystems in the platform are governed by authoritative domain specifications in [`docs/architecture/specs/`](docs/architecture/specs/README.md).
  - Before modifying or adding code in any specific domain (e.g. Transactions, Sandbox, System Design, SRE Triage, LLD, or Spaced Repetition), the agent MUST read and adhere to its corresponding domain specification.
- **Voice & Auto-VAD Protocol Mandate:**
  - Before proposing or writing any code related to Voice, AudioWorklet, VAD, or Gemini Live streaming, the agent MUST read and strictly adhere to:
    `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`
  - The Dual-Sided Handshake, EchoGuard drop conditions, and Turn 0 tool gating are immutable invariants defined in that document.

---

## 10. Mandatory Functional Registry Consultation & Decision Logging (SOTA Late 2026)
- **Pre-Flight Functional Consultation:**
  - Before modifying, refactoring, or debugging ANY function or handler (especially in Voice, WebSocket, LiteLLM Proxy, Audio DSP, or Verification pipelines), the agent MUST consult `docs/architecture/functional_registry/INDEX.md` and read the corresponding subsystem document.
  - The agent MUST verify what was already attempted on this function, what intermediate conclusions were reached, why previous architectural decisions were made, and what upstream failure modes were verified.
  - Blindly modifying functions without checking their historical rationale and invariants is strictly forbidden.
- **Mandatory Decision Recording & SSOT Maintenance:**
  - Whenever any function is touched or modified, the agent MUST document the change in `docs/architecture/functional_registry/`.
  - Every entry MUST capture:
    1. **What Was Done:** Exact architectural and code modifications.
    2. **Hypotheses & Intermediate Conclusions:** What was expected vs. what was empirically observed.
    3. **Rationale & "Why":** Deep root-cause justification avoiding superficial symptom-patching.
    4. **Failure Modes & Invariants:** Specific upstream API errors (e.g. 1011 Quota), timing races, or acoustic constraints discovered.
  - Historical rationale must NEVER be deleted; only appended or explicitly refuted with empirical log/metric evidence.



<!-- ================================================================= -->
<!-- STRICT ARCHITECTURAL INVARIANT: ZERO-TRUST LOCAL EXECUTION        -->
<!-- ================================================================= -->
## ⚠️ STRICT ENVIRONMENT INVARIANT: NO LOCAL BUILDS, TESTS OR FULL-DISK SCANS (SOTA 2026)
- **Local compilation, bundlers, test suites, and full-disk scans are strictly prohibited on this node.**
  - This node has strictly 1.8 GB RAM running 24 active Docker containers. Running `cargo build`, `npm run build`, `mvn`, `gradle`, `docker build`, `pytest`, `tsc`, or `npx tsc` causes immediate OOM crashes.
  - Running recursive searches from root (`find /`, `grep -r /`, `du /`) reads millions of `overlay2` files, exhausts kernel VFS memory, and locks `[kswapd0]` into 100% CPU lockup. All searches must stay inside the local project folder.
  - All heavy toolchains are intercepted by `/usr/local/sbin/blocked-tool` (exit code 126).
- **CANONICAL CI/CD WORKFLOW:**
  1. Make your code changes cleanly.
  2. Switch to a feature/ai branch: `git checkout -b feat/your-feature`
  3. Commit and push: `git add . && git commit -m "..." && git push -u origin feat/your-feature`
  4. Trigger remote verification via GitHub Actions: `remote-verify`
  5. Inspect the concise remote logs returned by `remote-verify` to diagnose errors.
<!-- ================================================================= -->

