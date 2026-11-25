# 01 Archive: Backend Live Audio Router (Historical Entries 2.1–2.10)

> **Parent Registry:** [`01_backend_live_audio_router.md`](./01_backend_live_audio_router.md)  
> **Scope:** Verbatim historical entries 2.1–2.10 archived to keep `01_backend_live_audio_router.md` $\le 350$ lines per `INDEX.md`.

---

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
- **Location:** [`backend/src/services/live/liveToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDispatcher.ts) / [`clean_voice_tester.html#L225-L250`](file:///home/djelu/projects/interview_tutor/frontend/public/clean_voice_tester.html#L225-L250)
- **What Was Done:** Added discriminated `scheduling` parameter (`"SILENT"` vs `"WHEN_IDLE"`) and Turn 0 Fail-Closed Gate for terminal evaluation tools. Migrated `update_whiteboard` from `"SILENT"` to `"WHEN_IDLE"`.
- **Hypotheses & Intermediate Conclusions:**
  - *UI Tools (`update_whiteboard`):* Originally set to `scheduling: "SILENT"` to suppress parasitic meta-commentary (*«Я вывела пример на доску справа...»*). However, empirical testing revealed this silenced Gemini Live completely: whenever candidate asked *"покажи на коде и расскажи"*, the model updated the board but generated zero audio tokens (`ttfaMs: null`), leaving candidate in silence.
  - *Resolution:* Switched to `scheduling: "WHEN_IDLE"` with an explicit directive: *"Сразу голосом объясни суть фрагмента. Не произноси сервисных фраз вроде 'я вывела код на доску' — сразу обсуждай логику"*. Fixed root cause in prompt (`livePromptBuilder.ts`) by removing the meta-phrase example.
  - *Data/File Tools (`read_file`):* Must use `scheduling: "WHEN_IDLE"` so Gemini resumes speaking and explains the file content to candidate.
  - *Turn 0 Lockdown:* If Gemini hallucinates `submit_interview_evaluation` before candidate responds (`turnIndex === 0`), dispatch rejects it with `{ error: "PRECONDITION_FAILED", scheduling: "SILENT" }`.
- **Rationale & "Why":** Solves the root cause (instruction tuning) instead of symptom patching with protocol-level silencing (`SILENT`). Adheres strictly to Gemini Live Tool specification (Module 03 §3 & §8).
- **Invariants:** Conversational UI tools must use `WHEN_IDLE` to allow uninterrupted dialogue flow; meta-commentary is suppressed via prompt directives; terminal tools must never execute on Turn 0.

---

### 2.8 Practice Mode Clean Voice Architecture (Wave 14 / Level 6 Alignment)
- **Location:** [`LiveGreetingReplay.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveGreetingReplay.ts), [`liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts), [`liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts), [`liveToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDispatcher.ts), [`livePairPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts)
- **What Was Done:**
  1. **Hot Reconnect History Continuity:** On upstream reconnect (`wasReconnecting === true`), seeded the last 4 conversation turns from `liveSessionRegistry` with `turnComplete: false` and a system resumption notification explicitly forbidding Turn 0 re-greeting.
  2. **Jittered Exponential Backoff:** Replaced fixed `(attempt - 1) * 400ms` with jittered exponential backoff ($1200\text{ms} - 3500\text{ms}$) in `liveAudioStreamRouter.ts`, preventing upstream LiteLLM pool key soft-throttling.
  3. **Zero Channel Pollution:** In `liveWsClientFrameHandler.ts`, intercepted `workspace_file_update` and `workspace_active_file_changed` to update in-memory manifest without forwarding to Gemini audio socket; early-dropped `screen_context_sync` and `isDeicticFrame`.
  4. **On-Demand `read_file` Resolution:** In `liveToolDispatcher.ts`, normalized paths and resolved file contents across active file, secondary files, and project tree with `scheduling: 'WHEN_IDLE'`.
  5. **Mandatory Vocal Commentary:** In `livePairPrompts.ts`, mandated verbal explanation when invoking tools (`update_whiteboard` or `read_file`), eliminating silent generation.
- **Hypotheses & Intermediate Conclusions:**
  - *Root Cause 1 (Freeze after 2 turns):* Telemetry and editor sync frames streamed into the active 16kHz PCM audio socket every 1.5s multiplied cross-attention tokens ($1.6\text{s} \rightarrow 14.6\text{s} \rightarrow 48.9\text{s}$), triggering `1011 Quota Exceeded` on Gemini Live.
  - *Root Cause 2 (Amnesic Re-introduction):* Hot reconnect previously sent no conversation history to the fresh upstream socket, causing the model to treat the next turn as Turn 0 and recite greeting again.
  - *Root Cause 3 (Silent Code Display):* Without an explicit prompt directive requiring verbal explanation upon tool invocation, Gemini Live generated only tool call frames with 0 speech tokens.
- **Rationale & "Why":** Solves root causes at protocol level adhering to SOTA Late 2026 Level 6 benchmarks.

---

### 2.9 IntelliJ IDEA Companion Bridge Code Sync & Bidirectional File Resolution
- **Location:** [`useIdeBridge.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useIdeBridge.ts), [`PracticeVoiceContext.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx), [`WhiteboardDrawer.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/WhiteboardDrawer.tsx), [`liveToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDispatcher.ts), [`liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts), [`livePairPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts)
- **What Was Done:**
  1. **Frontend IDE Event Forwarding:** In `useIdeBridge.ts`, dispatched `workspace_file_updated` custom event upon receiving `FILE_UPDATED` from `bridge.mjs`. Wired listener in `PracticeVoiceContext.tsx` to forward changes directly to `syncEditorCode(content, path, language, true)`, transmitting `workspace_file_update` to the backend live audio socket.
  2. **Bidirectional Path Normalization:** Implemented `matchWorkspaceFilePath(candidatePath, targetPath)` supporting exact matches, suffix matches, and base names, resolving differences between IntelliJ Maven paths (e.g. `src/main/java/Solution.java`) and flat web workspace paths (`Solution.java`).
  3. **Atomic Workspace Manifest Synchronization:** Implemented `applyWorkspaceFileUpdate(session, rawPath, content)` in `liveToolDispatcher.ts` to update `session.workspaceManifest.files`, `secondaryFiles`, `activeFile`, and `projectTree` atomically.
  4. **Dynamic On-Demand Prompt Directives:** In `livePairPrompts.ts`, explicitly designated `<user_code_snippet>` as starting stub and mandated that the model call `read_file(filePath)` when candidate mentions editing code in their IDE or asks for feedback on their implementation.
- **Hypotheses & Intermediate Conclusions:**
  - *Root Cause 1 (Frontend Event Loss):* `useIdeBridge.ts` dispatched a legacy dead `CustomEvent('gemini_live_code_frame')` instead of updating the live audio socket via `syncEditorCode`, causing backend session manifest to remain stale.
  - *Root Cause 2 (Path Prefix Mismatch):* IntelliJ IDEA sends full repository paths (`src/main/java/...`), preventing matches against flat filenames in `session.workspaceManifest.files`.
  - *Root Cause 3 (Static Prompt Context):* Gemini Live relied on initial session context unless instructed that code changes dynamically in IDE and mandated to invoke `read_file`.
- **Rationale & "Why":** Guarantees zero code drift between candidate's local IntelliJ IDEA editor and the AI tutor, maintaining clean channel separation without injecting large text payloads into 16kHz PCM audio streaming frames.
- **Invariants:**
  - Files edited in IntelliJ IDEA must be reflected in backend session workspace manifest and retrievable via `read_file`.
  - Path matching must resolve Maven package structures to web editor files bidirectionally.

---

### 2.10 `liveWsClientFrameHandler.ts: Telemetry Frame Interception & Upstream Isolation`
- **Location:** [`backend/src/services/live/liveWsClientFrameHandler.ts#L45-L95`](file:///d:/projects/synced_with_vps/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts)
- **What Was Done:** Intercepted custom client telemetry frames (`sandbox_result_update`, `mutation_result_update`, `tx_evaluation_update`) at the proxy frame handler level. Telemetry is saved in-memory on `session` (`latestSandboxSummary`, `latestMutationSummary`, `latestTxSummary`) and prevented from passing through to `geminiSocket.send()`.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Forwarding raw custom client telemetry JSON frames to Google Gemini Live WebSocket risks unexpected closure with status 1008/1011 (policy violation/unsupported schema).
  - *Empirical Finding:* By intercepting and consuming telemetry in the gateway memory, the proxy isolates Google's live audio WebSocket contract from arbitrary client application events while keeping the latest test metrics accessible for system prompts.
- **Rationale & "Why":** Upstream WebSocket protocol purity must be preserved at all times without leaking application-level telemetry payloads into Google's binary/Bidi stream.
- **Invariants:** Upstream Gemini WebSocket must NEVER receive raw JSON frames with unmapped `type` attributes.
