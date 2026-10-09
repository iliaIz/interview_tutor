# 01. Backend Live Audio Stream Router

> **Location:** `docs/architecture/functional_registry/01_backend_live_audio_router.md`  
> **Subsystem (Level 1):** Backend Live Audio Stream Router  
> **Primary File:** [`backend/src/services/audio/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/liveAudioStreamRouter.ts)

---

## 1. Subsystem Scope
Handles bidirectional WebSocket bridge between the candidate browser (`/ws/live`) and the upstream LiteLLM Gateway (`ws://litellm-gateway:4000/ws/live`). Manages session initialization, audio streaming frames, turn-taking gating, upstream reconnection, and dead-air protection.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `handleGeminiDisconnect()`
- **Location:** [`liveAudioStreamRouter.ts#L420-L500`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/liveAudioStreamRouter.ts)
- **What Was Done:** Implemented Upstream Hot Reconnect (3 attempts with exponential backoff) without dropping the client browser WebSocket. Preserves candidate session context and resends setup frame.
- **Hypotheses & Intermediate Conclusions:** 
  - *Hypothesis:* Transient TCP drops or GFE keep-alive timeouts should seamlessly recover without disrupting user flow.
  - *Empirical Finding:* While Hot Reconnect works as intended for transient drops, if LiteLLM drops due to **Quota Exhaustion (1011)** across all pool keys, Hot Reconnect cycles through exhausted keys, accumulating up to 28,500ms delay before a cooldown expires.
- **Rationale & "Why":** Essential to insulate candidate from network jitter; however, upstream quota exhaustion must be distinguished from network drops.
- **Invariants:** Must never trigger browser disconnect on first upstream transient drop. Must reset reconnect counter upon successful `turnComplete`.

---

### 2.2 `routeUpstreamFrame()`
- **Location:** [`liveAudioStreamRouter.ts#L250-L380`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/liveAudioStreamRouter.ts)
- **What Was Done:** Decodes incoming frames from upstream `geminiSocket` (handling both text and binary UTF-8 buffers from Uvicorn), parses Google `BidiGenerateContent` payloads, tracks `turnComplete`, and forwards audio/text to client.
- **Hypotheses & Intermediate Conclusions:**
  - Uvicorn/LiteLLM forwards Google frames as binary WebSocket frames (`isBinary: true`), even though content is JSON text.
  - Added explicit `Buffer.toString('utf-8')` decoding before `JSON.parse` to eliminate frame dropping.
- **Rationale & "Why":** Direct UTF-8 decoding is mandatory for Node.js `ws` client interoperability with Python proxy gateways.
- **Invariants:** Must never drop incoming binary JSON frames. Must sanitize acoustic leakage tokens (`<no speech>`) before emitting to client.

---

### 2.3 `routeCandidateAudioChunk()`
- **Location:** [`liveAudioStreamRouter.ts#L180-L245`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/liveAudioStreamRouter.ts)
- **What Was Done:** Validates and forwards 16kHz Mono PCM chunks from candidate mic. Enforces Turn 0 acoustic gating (ignoring ambient mic audio while greeting DAC drain finishes + 450ms reverb). Wraps chunks strictly into `{ realtimeInput: { audio: { data, mimeType } } }`.
- **Hypotheses & Intermediate Conclusions:**
  - Mixing `clientContent` with `realtimeInput` causes protocol desynchronization in Gemini Live. Continuous PCM in `realtimeInput.audio` ensures clean native VAD endpointing.
- **Rationale & "Why":** Prevents speaker echo on mobile loudspeakers during greeting and adheres strictly to Google's SOTA Gemini Live bidirectional streaming contract.
- **Invariants:** No mic packets sent upstream during Turn 0 greeting recitation unless explicit tactile barge-in occurred.

---

### 2.4 `LiveDeadAirGuard.checkSilence()`
- **Location:** [`backend/src/services/audio/LiveDeadAirGuard.ts#L45-L95`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/LiveDeadAirGuard.ts)
- **What Was Done:** Implemented digital silence detection on incoming upstream audio stream. Suppresses silence chunks $> 1200$ms; clamps turn at $\ge 2000$ms continuous silence with synthetic `turnComplete: true`.
- **Hypotheses & Intermediate Conclusions:**
  - Gemini upstream vocoders occasionally stall after finishing spoken words, continuously streaming zeroes for 10–20s without sending `turnComplete`. Clamping at 2000ms reclaims the microphone without hanging the FSM.
- **Rationale & "Why":** Prevents candidate lock-out caused by upstream vocoder stalls.
- **Invariants:** Clamping must only activate AFTER active speech tokens have been generated; initial waiting before speech is governed by gateway watchdog, not dead-air guard.

---

### 2.5 `LiveCannedErrorRecovery.intercept()`
- **Location:** [`backend/src/services/audio/LiveCannedErrorRecovery.ts#L30-L75`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/LiveCannedErrorRecovery.ts)
- **What Was Done:** Intercepts `<no speech>`, `<pause>`, or empty audio responses ($< 200$ bytes) emitted by Gemini following candidate turn. Injects an active Russian verbal prompt to ask candidate to repeat.
- **Hypotheses & Intermediate Conclusions:**
  - Ambient noise or quiet speech can cause Gemini to output `<no speech>` and drop the turn. An active conversational recovery eliminates awkward dead-air.
- **Rationale & "Why":** Maintains interview momentum and human-like tutoring behavior under acoustic edge cases.
- **Invariants:** Must never speak over valid candidate responses; only triggers when upstream produces non-speech tokens or empty turns.

---

### 2.6 `LiveClientGuardService.shouldSuppressEchoChunk()`
- **Location:** [`backend/src/services/live/liveClientGuardService.ts#L100-L130`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveClientGuardService.ts)
- **What Was Done:** Added suppression of mic frames during AI playout and generation to prevent speaker bleed.
- **Hypotheses & Intermediate Conclusions:**
  - *Empirical Defect Discovered:* In real conversations, candidates begin answering immediately as the AI finishes speaking. Because `aiPlayoutEstimatedEndEpoch` contains estimated buffer duration and acoustic tail (+450ms), the guard dropped the first 300–800ms of the candidate's speech (eating phonemes like "В Concurr...").
  - With the beginning of speech missing, Gemini's acoustic transformer failed to recognize speech onset and stalled without responding.
  - *Empirically Proven Solution:* Native Cloud VAD handles continuous audio without drop gating. Testing with 0 dropped frames resulted in 100% reliable turn-taking across 13+ minutes of multi-turn dialogue.
- **Rationale & "Why":** Never truncate candidate speech boundaries. Hardware AEC (Echo Cancellation) in WebRTC handles acoustic bleed; artificial software dropping causes fatal phoneme loss.
- **Invariants:** Candidate microphone frames must never be silently discarded at utterance onset.

---

### 2.7 `LiveToolDispatcher.dispatch()` (Tool Scheduling & Turn 0 Lockdown)
- **Location:** [`backend/src/services/live/liveToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDispatcher.ts) / [`clean_voice_tester.html#L233-L272`](file:///home/djelu/projects/interview_tutor/scripts/clean_voice_tester.html#L233-L272)
- **What Was Done:** Added discriminated `scheduling` parameter (`"SILENT"` vs `"WHEN_IDLE"`) and Turn 0 Fail-Closed Gate for terminal evaluation tools.
- **Hypotheses & Intermediate Conclusions:**
  - *UI Tools (`update_whiteboard`):* Must use `scheduling: "SILENT"` to prevent parasitic AI commentary (*«Я обновила доску»*).
  - *Data/File Tools (`read_file`):* Must use `scheduling: "WHEN_IDLE"` so Gemini resumes speaking and explains the file content to candidate. The previous bug where `read_file` returned `SILENT` caused model speech to freeze.
  - *Turn 0 Lockdown:* If Gemini hallucinates `submit_interview_evaluation` before candidate responds (`turnIndex === 0`), dispatch rejects it with `{ error: "PRECONDITION_FAILED", scheduling: "SILENT" }`.
- **Rationale & "Why":** Adheres strictly to Gemini Live Tool specification (Module 03 §3 & §8).
- **Invariants:** Visual mutations must be `SILENT`; content fetching must be `WHEN_IDLE`; terminal tools must never execute on Turn 0.


