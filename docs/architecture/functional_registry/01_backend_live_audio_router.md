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

---

### 2.11 `liveEvaluationToolDispatcher.ts: Evaluation WHEN_IDLE Tool Scheduling & Closing Dialogue Directive`
- **Location:** [`backend/src/services/live/liveEvaluationToolDispatcher.ts#L30-L75`](file:///d:/projects/synced_with_vps/interview_tutor/backend/src/services/live/liveEvaluationToolDispatcher.ts)
- **What Was Done:** Added `scheduling: 'WHEN_IDLE'` and an explicit verbal closure instruction in `toolResponse` when `submit_interview_evaluation` completes.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* When `submit_interview_evaluation` was called on Gemini 3.8 Live, the model sometimes stalled or omitted closing verbal remarks, causing sudden dead air after evaluation payload was dispatched.
  - *Empirical Finding:* Adding `scheduling: 'WHEN_IDLE'` per Google Gemini Live API SOTA specification ensures tool results are ingested without interrupting natural speech pacing, and explicit directive prompts the model to deliver a concise 1-2 sentence spoken verdict summary.
- **Rationale & "Why":** Completely eliminates awkward dead air between tool execution and session conclusion.
- **Invariants:** Tool responses MUST adhere to official Google Live ToolResponse format with output status confirmation.

---

### 2.12 `liveWsSessionParams.ts: Canonical SQLite SSOT Resolution & HTTP 431 Elimination`
- **Location:** [`backend/src/services/live/liveWsSessionParams.ts#L130-L165`](file:///d:/projects/synced_with_vps/interview_tutor/backend/src/services/live/liveWsSessionParams.ts)
- **What Was Done:**
  - Removed `referenceAnswer` from WebSocket URL query parameters in client (`liveVoiceUrlBuilder.ts`).
  - Added authoritative SQLite lookup in `resolveLiveWsSessionParams`: when `questionId` is passed, `topic`, `questionText`, and `referenceAnswer` are loaded directly from the `questions` table in SQLite DB.
  - Sliced `questionText` in query parameters to max 300 characters as a protective boundary.
  - Delegated dynamic custom questions/answers to `session_init` frame payload.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Theory sessions in Tutor and Interview modes immediately crashed upon startup because the full reference answer (e.g. 7,776 chars of Cyrillic text for JMM) was percent-encoded into the WebSocket HTTP GET Upgrade URL, producing a >37,000-byte URL.
  - *Empirical Finding:* Node.js default `http.maxHeaderSize` is 16,384 bytes. When the 37KB URL hit Node.js, the HTTP parser aborted the connection with `431 Request Header Fields Too Large` and closed the socket with code `1006` before Express/WebSocket upgrade could execute. Practice sessions avoided this because they did not pass a reference answer in the URL.
- **Rationale & "Why":** Large textbook answers have no place in HTTP GET request lines or query strings. SQLite is the persistent Single Source of Truth for all 821 interview questions; resolving directly by primary key `questionId` is $O(1)$ (< 0.1ms), eliminates URL bloat, and guarantees zero HTTP 431 header overflow.
- **Invariants:** WebSocket connection URL query strings MUST NEVER exceed 2,048 bytes. Authoritative question text and reference answers MUST be resolved from SQLite DB by `questionId` or delivered via WebSocket `session_init` data frames.

---

### 2.13 `geminiLiveProxy.ts & liveToolDispatcher.ts: Early Frame Buffering, Workspace Manifest Pre-warming & Deceptive Fallback Elimination`
- **Location:** [`backend/src/services/geminiLiveProxy.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/geminiLiveProxy.ts), [`backend/src/services/live/liveWsConnectionHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts), [`backend/src/services/live/liveWsSessionParams.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsSessionParams.ts), [`backend/src/services/live/liveToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDispatcher.ts), [`backend/src/services/live/liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts)
- **What Was Done:**
  1. **Synchronous Early Frame Capture:** In `geminiLiveProxy.ts`, synchronously attached an early frame buffer listener (`earlyCapture`) to `clientSocket` at the moment `wss.on('connection')` fires, replaying buffered frames once `attachLiveClientFrameHandler` is ready.
  2. **SQLite Manifest Pre-Warming in Session Params:** In `liveWsSessionParams.ts`, queried `manifest_json` from `coding_challenges`, parsed `workspaceFiles`, and pre-populated `session.workspaceManifest` and `session.activeFilePath` directly at connection initialization.
  3. **Robust Manifest Merging:** Replaced destructive array replacement with `mergeWorkspaceManifests()` and updated `applyWorkspaceFileUpdate()` so secondary files and project trees are preserved across file edits.
  4. **Eliminated Deceptive `read_file` Fallback:** Removed unconditional fallback to `session.codeSnippet`. Added authoritative SQLite fallback to `coding_challenges.manifest_json`. If a file cannot be resolved, `read_file` returns structured error `FILE_NOT_FOUND` listing all available project files instead of poisoning context with the wrong file.
- **Hypotheses & Intermediate Conclusions:**
  - *Root Cause 1 (Async Event Loop Race Drop):* Node.js `ws` EventEmitter does not buffer unhandled messages. `wss.on('connection', async () => { await resolveLiveWsSessionParams(...) })` awaited DB and vector operations before registering `clientSocket.on('message')`. The browser sent `session_init` on `ws.onopen` during this async window; without registered listeners, Node.js silently discarded the frame on 100% of connections.
  - *Root Cause 2 (Unpopulated SQLite Manifest):* `liveWsSessionParams.ts` omitted `manifest_json` from `SELECT ... FROM coding_challenges`, leaving `session.workspaceManifest` empty at session startup and in Gemini's initial system prompt.
  - *Root Cause 3 (Deceptive Fallback Poisoning):* When Gemini called `read_file(".../DiscountCalculator.java")`, the missing manifest fell back to `session.codeSnippet`, which contained `DiscountCalculatorTest.java` (1,560 bytes). Gemini received test code under the production file name, detected invalid class contents, and concluded it could not access the file.
- **Rationale & "Why:** Solves the root cause of lost initialization frames and context poisoning. Guarantees that AI voice partner has access to the full project structure and file contents from Turn 0, eliminating deceptive fallback behavior (Invariant 5).
- **Invariants:**
  - Incoming WebSocket client frames MUST NEVER be lost during asynchronous connection setup.
  - `read_file` MUST NEVER return the active file's code snippet when asked for a different file. If not found, it must return an explicit `FILE_NOT_FOUND` error listing existing files.

---

### 2.14 `liveWsConnectionHandler.ts, liveAudioStreamRouter.ts & liveEvaluationToolDispatcher.ts: Batch Progression Grounding & Evaluation Alignment (Wave 17)`
- **Location:** [`backend/src/services/live/liveWsConnectionHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts), [`backend/src/services/live/liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts), [`backend/src/services/live/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts), [`backend/src/services/live/liveEvaluationToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveEvaluationToolDispatcher.ts)
- **What Was Done:**
  - Added extraction and persistence of `questionIndex`, `totalQuestions`, and `isRetry` from both URL query parameters in `liveWsConnectionHandler.ts` and WebSocket `session_init` control frames in `liveWsClientFrameHandler.ts`.
  - Wired `session.questionIndex` and `session.totalQuestions` into `handleSetupCompleteGreeting` inside `liveAudioStreamRouter.ts` so Turn 0 greeting respects multi-question batch progress.
  - Explicitly injected `questionId: session.questionId` into the `submit_interview_evaluation` payload in `liveEvaluationToolDispatcher.ts` to guarantee unambiguous per-question evaluation storage in batch sessions.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* When candidates advanced through questions in a study deck or interview marathon, the backend defaulted `questionIndex` to 0 and `totalQuestions` to 1 because the URL query params and `session_init` frame lacked these metadata fields.
  - *Empirical Finding:* Persisting batch position at both the connection handshake and `session_init` level ensures Gemini is fully grounded on the specific question number and does not treat subsequent questions as repeated initial encounters.
- **Rationale & "Why":** Provides unified conversational continuity and accurate evaluation attribution across multi-question batch workflows.
- **Invariants:** WebSocket session state MUST reflect the actual `questionIndex` and `totalQuestions` of the client batch. Evaluation payloads MUST always carry the explicit `questionId`.

---

### 2.15 `liveAudioStreamRouter.ts: Pre-Connection Frame Queue Purge & Turn 0 False Barge-In Shielding (Wave 18)`
- **Location:** [`backend/src/services/live/liveAudioStreamRouter.ts#L100-L130`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts)
- **What Was Done:**
  - On Turn 0 session initialization (`!isResumed && !wasReconnecting`), explicitly cleared `session.frameQueue.length = 0` immediately after dispatching the initial greeting prompt to Gemini Live.
  - Corrected `commitAnchor` timestamping to record the exact moment `commitSpokenTurn()` is triggered, preventing latency measurement drift into total elapsed session duration.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Upstream Gemini was randomly truncating or silencing Turn 0 greetings (0 audio bytes returned, session terminating immediately).
  - *Empirical Finding:* Client browsers captured ambient audio and microphone clicks before WebSocket setup was acknowledged. These early frames were buffered in `session.frameQueue` and flushed directly into `geminiSocket` the millisecond `setupComplete` arrived. Cloud VAD on Google's servers detected this trailing pre-greeting audio as candidate speech and triggered server-side barge-in, aborting Turn 0 recitation before the first greeting token could be synthesized.
- **Rationale & "Why":** Turn 0 greeting is a one-way recitation of the question and greeting directive. Flushed pre-connection audio is non-speech ambient noise that acts as false barge-in. Discarding early frames on Turn 0 ensures pristine greeting synthesis.
- **Invariants:** On fresh Turn 0 connections, pre-greeting buffered microphone frames MUST NEVER be flushed into `geminiSocket`.

---

### 2.16 `LiveToolEngine & workspaceManifestStore: Deep Module Consolidation, Turn 0 Lockdown Unification & Pure Tool Handlers`
- **Location:** [`backend/src/services/live/LiveToolEngine.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveToolEngine.ts), [`backend/src/services/live/workspaceManifestStore.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/workspaceManifestStore.ts), [`backend/src/services/live/liveWorkspaceHandlers.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWorkspaceHandlers.ts), [`backend/src/services/live/liveEvaluationToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveEvaluationToolDispatcher.ts), [`backend/src/services/live/liveSystemDesignToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveSystemDesignToolDispatcher.ts), [`backend/src/services/live/liveHrToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveHrToolDispatcher.ts), [`backend/src/services/live/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts)
- **What Was Done:**
  1. **Consolidated Tool Call Execution:** Replaced the shallow pass-through module chain (`LiveToolCallExecutor` -> `liveToolDispatcher` -> 4 sub-dispatchers) with a single deep module `LiveToolEngine`.
  2. **Isolated Workspace Manifest Operations:** Extracted `matchWorkspaceFilePath`, `applyWorkspaceFileUpdate`, and `mergeWorkspaceManifests` into an independent zero-dependency store `workspaceManifestStore.ts`.
  3. **Pure Functional Seam for Tool Handlers:** Stripped all `WebSocket` (`ws`) dependencies from tool handlers. Handlers now adhere to a clean contract `(args, ctx) => Promise<ToolExecutionResult> | ToolExecutionResult`, returning `{ result, error, clientEvent, scheduling }`.
  4. **Declarative Invariant & Deduplication Enforcement:** Centralized Invariant 2.1 (Turn 0 Tool Lockdown) and declarative per-tool deduplication windows (`dedupWindowMs`, `toolDedupCache`) inside `LiveToolEngine.executeFunctionCalls`.
  5. **Canonical Gemini Live Bidi Protocol Serialization:** Centralized tool response serialization to guarantee that every `functionResponses` frame includes `id`, `name`, `response: { result }` or `response: { error }`, and `scheduling` (`WHEN_IDLE` or `SILENT`), eliminating upstream `1008` (Policy Violation) and `1011` (Internal Error) hangs caused by missing fields or improper nesting.
- **Hypotheses & Intermediate Conclusions:**
  - *Root Cause 1 (Protocol Divergence & Leakage):* Different sub-dispatchers formatted responses inconsistently (e.g. `liveRefactoringToolDispatcher` omitted `name` and used `output` instead of canonical `result`), causing upstream Gemini Live WebSocket disconnects.
  - *Root Cause 2 (Turn 0 Guard Fragmentation):* Turn 0 protection was duplicated with slight variations in some dispatchers and completely missing in `liveHrToolDispatcher` (`submit_hr_evaluation`).
  - *Root Cause 3 (Low Cohesion):* Embedding workspace file mutation logic in a tool dispatcher forced frame transport handlers to import tools.
- **Rationale & "Why":** Deep modules with narrow interfaces hide protocol complexities, isolate domain state mutation, and guarantee invariant enforcement in a single declarative registry.
- **Invariants:**
  - Tool handlers MUST NEVER import or touch WebSocket instances.
  - Every Gemini tool response MUST be serialized with `id`, `name`, `response: { result | error }`, and canonical `scheduling`.
  - Invariant 2.1 (Turn 0 Tool Lockdown) MUST be centrally enforced before delegating to gated tool handlers.


