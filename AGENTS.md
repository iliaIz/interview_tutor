# Architectural Guidelines & Hard Invariants for InterviewPrep AI

> Full architectural specifications, sequence diagrams, and Mermaid state machines: see [docs/architecture.md](docs/architecture.md).

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
