# 01. Backend Live Audio Stream Router

> **Location:** `docs/architecture/functional_registry/01_backend_live_audio_router.md`  
> **Subsystem (Level 1):** Backend Live Audio Stream Router  
> **Primary File:** [`backend/src/services/audio/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/liveAudioStreamRouter.ts)

---

## 1. Subsystem Scope
Handles bidirectional WebSocket bridge between the candidate browser (`/ws/live`) and the upstream LiteLLM Gateway (`ws://litellm-gateway:4000/ws/live`). Manages session initialization, audio streaming frames, turn-taking gating, upstream reconnection, and dead-air protection.

---

## 2. Touch List & Function Hierarchy (Level 2)

> Historical entries `2.1–2.10` archived verbatim in [`01_backend_live_audio_router_archive.md`](./01_backend_live_audio_router_archive.md).

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

---

### 2.17 `SessionConfigurationResolver: Encapsulation of Procedural Query Parsing, Workspace Hydration & session_init Frame Merging (Ticket #9)`
- **Location:** [`backend/src/services/live/SessionConfigurationResolver.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/SessionConfigurationResolver.ts), [`backend/src/services/live/liveSessionConfigTypes.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveSessionConfigTypes.ts), [`backend/src/services/live/sessionConfigAuth.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/sessionConfigAuth.ts), [`backend/src/services/live/sessionInitFrameMerger.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/sessionInitFrameMerger.ts), [`backend/src/services/live/liveWsSessionParams.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsSessionParams.ts)
- **What Was Done:**
  1. **Unified Configuration Factory:** Created `SessionConfigurationResolver.resolve(req, rawInitFrame): Promise<LiveSessionResolvedConfig | null>` encapsulating URL query parsing, authentication, SQLite challenge hydration, vector gap discovery, and prompt defaults.
  2. **Strongly Typed Domain Config:** Extracted `LiveSessionResolvedConfig`, `LiveSessionPromptConfig`, and `LiveSessionConfig` eliminating 45+ loose procedural arguments.
  3. **Atomic Frame Merging:** Factored `sessionInitFrameMerger` to handle two-phase WebSocket handshake merging (`session_init` frame updates to workspace manifests, code snippets, persona, and batch questions).
  4. **Deprecated Procedural Resolver:** Shrunk `liveWsSessionParams.ts` from 308 to 23 lines by delegating directly to `SessionConfigurationResolver.resolve(req)` for zero-regression backwards compatibility until Ticket #10.
  5. **Cognitive Bounding Compliance:** `SessionConfigurationResolver.ts` strictly complies with the 150-line SLA (127 lines).
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Procedural unpacking across loose parameter chains resulted in fragile initialization and duplicate manifest merging logic between connection start and frame handling.
  - *Empirical Finding:* Encapsulating authentication, SQLite context resolution, and `session_init` control frames into a dedicated resolver provides a clean seam for the upcoming `LiveVoiceSession` aggregate (#10).
- **Rationale & "Why":** Ports & Adapters boundary cleanly separates HTTP request transport parsing from the session state machine and aggregate lifecycle.
- **Invariants:**
  - `SessionConfigurationResolver.ts` MUST adhere to Cognitive Bounding <= 150 lines.
  - All Live session startup parameters must be accessed through typed `LiveSessionResolvedConfig`.

---

### 2.19 `Fast-Handoff Protocol Alignment & Unconditional Zero-Audio Interception (Spec 14 / #69, #70, #71)`
- **Location:** [`backend/src/services/live/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts), [`backend/src/services/live/liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts)
- **What Was Done:**
  1. **Unconditional Zero-Audio Recovery Nudge:** In `liveAudioStreamRouter.ts`, removed restrictive conditional gating (`allowSilenceClarification` and `text.length < 5`) for zero-audio turns. If `!isToolCallTurn && audioBytes < 200`, `LiveCannedErrorRecovery.executeRecoveryNudge` fires unconditionally, enforcing SOTA Invariant 2.9 (Acoustic Non-Zero Audio SLA >= 1200 bytes).
  2. **Watchdog Arming on Fast-Handoff:** In `liveWsClientFrameHandler.ts`, when client sends `{ realtimeInput: { audioStreamEnd: true } }`, backend marks `session.hasCandidateResponded = true`, `session.isAiGenerating = true`, records `lastTurnCommitTime = Date.now()`, and explicitly arms turn watchdogs (`armTurnWatchdogs`).
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis 1 (Zero-Audio Subtitle Bug):* When Gemini generated text subtitles but vocoder stalled (audioBytes === 0), `text.length >= 5` bypassed `isZeroAudioTurn`, leaving candidate in awkward silence.
  - *Empirical Finding 1:* Verified. Unconditional interception ensures any turn with text but zero audio is recovered with an active verbal clarification rather than silent text leakage.
  - *Hypothesis 2 (Dialogue Hang After Candidate Speech):* Sending fast-handoff `audioStreamEnd` did not initialize backend generation watchdogs, leaving backend blind to upstream stalls if no `clientContent` was present.
  - *Empirical Finding 2:* Verified. Arming watchdogs on `audioStreamEnd` guarantees server watchdog lifelines (5s nudge, 22s recovery) remain active during fast-handoff turns.
- **Rationale & "Why":** Deep root-cause protocol alignment strictly conforming to Google Gemini Live bidirectional streaming specifications.
- **Invariants:**
  - Every spoken AI response following candidate speech MUST contain >= 1200 bytes audio (Invariant 2.9).
  - Backend generation state and watchdogs MUST be armed upon receiving `audioStreamEnd`.

---

### 2.20 `DownstreamClientPipe: Consolidated Client Ingress Transport & Heartbeat Invariant Router (Spec 28)`
- **Location:** [`backend/src/services/live/DownstreamClientPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/DownstreamClientPipe.ts), [`backend/src/services/live/liveWsClientFrameHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsClientFrameHandler.ts)
- **What Was Done:**
  1. Extracted `DownstreamClientPipe.ts` (325 lines) consolidating client WebSocket ingress, heartbeat routing (ping, pong, sync_ping), memory turn sync (`resume_sync`), barge-in disarming, turn reset, canvas deictic context, and fast-handoff audio chunk forwarding into a single deep module.
  2. Shrunk `liveWsClientFrameHandler.ts` from 296 lines to 42 lines by turning it into a minimal adapter that delegates frame dispatch to `DownstreamClientPipe`.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Splitting client frame parsing and session state mutation across sibling handlers caused cyclic state updates and leaked transport invariants into orchestration layers.
  - *Empirical Finding:* Encapsulating transport protocols in `DownstreamClientPipe` unifies client ingress behind a single `handleFrame` seam, ensuring echo suppression, watchdog arming, and turn resets happen deterministically in one place.
- **Rationale & "Why":** Deep module architecture replacing shallow pass-through glue with a cohesive transport gateway.
- **Invariants:**
  - Downstream client WebSocket traffic must route exclusively through `DownstreamClientPipe`.
  - Cognitive bounding: `DownstreamClientPipe.ts` <= 350 lines; `liveWsClientFrameHandler.ts` <= 100 lines.






---

### 2.21 `DownstreamClientPipe & LiveClientGuardService: Audio Gating during isAiGenerating & Duplicate Commit Shield (Spec 35)`
- **Location:** [`backend/src/services/live/DownstreamClientPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/DownstreamClientPipe.ts), [`backend/src/services/live/liveClientGuardService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveClientGuardService.ts)
- **What Was Done:**
  1. **Duplicate Commit Shield:** In `DownstreamClientPipe.ts`, if `session.isAiGenerating === true` when `audioStreamEnd` arrives, the duplicate frame is logged and dropped (`🛡️ [DUPLICATE_COMMIT_GUARD]`), preventing FSM state corruption and repeated watchdog re-arming.
  2. **Generation Audio Gating:** In `liveClientGuardService.ts:shouldSuppressEchoChunk`, incoming audio chunks arriving while `session.isAiGenerating === true` without explicit `isBargeIn` are suppressed even in `auto` mode. This prevents trailing breath and ambient noise from causing Google Cloud VAD to abort model generation.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Streaming ambient mic audio during model thinking caused Google Gemini Live to cancel response synthesis via `START_OF_ACTIVITY_INTERRUPTS`.
  - *Empirical Finding:* Confirmed by Docker telemetry: candidate speech followed by trailing audio resulted in 0 response turns until 22s watchdog timeout.
- **Rationale & "Why":** Strict channel separation during generation ensures Gemini Live has undisturbed latency to synthesize speech. Explicit tactile or acoustic barge-in continues to bypass suppression as intended.
- **Invariants:**
  - `session.isAiGenerating === true` gates non-barge-in audio chunks from reaching upstream.
  - Cognitive bounding: `DownstreamClientPipe.ts` <= 350 lines; `liveClientGuardService.ts` <= 200 lines.

---

### 2.22 `UpstreamGeminiPipe & LiveToolEngine: Practice Pair Resilience, Zombie Reconnect Elimination & SILENT Tool Scheduling (Spec 36)`
- **Location:** [`backend/src/services/live/UpstreamGeminiPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/UpstreamGeminiPipe.ts), [`backend/src/services/live/LiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveVoiceSession.ts), [`backend/src/services/live/LiveToolEngine.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveToolEngine.ts), [`backend/src/services/live/liveWorkspaceHandlers.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWorkspaceHandlers.ts), [`backend/src/services/live/liveWsTurnCommitHandler.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsTurnCommitHandler.ts)
- **What Was Done:**
  1. **Zombie Reconnect Suppression:** In `UpstreamGeminiPipe.ts`, if `this.isClosed || code === 1000 || code === 1001`, reconnect scheduling is strictly suppressed. In `liveStreamErrorDetector.ts`, codes 1000/1001 are classified as non-retryable. `LiveVoiceSession.terminate()` calls `router.close() -> pipe.close()`, permanently stopping timers and closing the socket.
  2. **Whiteboard SILENT Scheduling:** In `LiveToolEngine.ts` and `liveWorkspaceHandlers.ts`, `update_whiteboard` scheduling mode changed from `WHEN_IDLE` to `SILENT`, eliminating uncoordinated secondary speech turns and conversational chatter after canvas mutations.
  3. **Turn 0 Manifest Deduplication:** In `LiveGreetingReplay.ts`, removed redundant raw file tree concatenation in Turn 0 `clientContent.turns`, preserving token budget in the sliding window.
  4. **Adaptive Watchdog Calibration:** In `liveWsTurnCommitHandler.ts`, extended Phase 2 timeout to 25.0s (Phase 1 nudge to 8.0s) for `practice_pair` / tutor sessions to prevent premature dead-air turn resets while vocoder infers over large multi-turn KV-caches.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Returning `WHEN_IDLE` for UI mutations caused Gemini Live to plan a verbal turn after whiteboard updates, racing with candidate speech and causing TTFA to degrade to 10–17s.
  - *Empirical Finding:* Docker logs confirmed that `update_whiteboard` was immediately followed by a 10.8s TTFA delay, and closing the drawer spawned 3 consecutive 120-second zombie sessions in LiteLLM.
- **Rationale & "Why":** Strict adherence to Google Live Late-2026 protocol specifications (`gemini_live_reference`).
- **Invariants:**
  - Client closures with code 1000/1001 must never trigger upstream reconnect.
  - Whiteboard mutations must execute with `scheduling: "SILENT"`.
  - Cognitive bounding: `LiveVoiceSession.ts` <= 300 lines; `UpstreamGeminiPipe.ts` <= 350 lines; `LiveToolEngine.ts` <= 350 lines.

---

### 2.23 `LiveDeadAirGuard, ToolAudioMutex & SessionResumptionManager: Vocoder Clamping, Tool Audio Gating & Session Resumption (Spec 37)`
- **Location:** [`backend/src/services/live/LiveDeadAirGuard.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveDeadAirGuard.ts), [`backend/src/services/live/ToolAudioMutex.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/ToolAudioMutex.ts), [`backend/src/services/live/SessionResumptionManager.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/SessionResumptionManager.ts), [`backend/src/services/live/liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts), [`backend/src/services/live/DownstreamClientPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/DownstreamClientPipe.ts), [`backend/src/services/live/LiveToolEngine.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveToolEngine.ts), [`backend/src/services/live/liveGeminiConfigBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts)
- **What Was Done:**
  1. **LiveDeadAirGuard Port & Integration:** Ported `LiveDeadAirGuard` from `gemini_live_reference/packages/bff-gateway/src/deadAirGuard.ts`. Inspects incoming PCM RMS on model turn parts. Suppresses trailing digital silence ($RMS \le 0.005$) $>1200$ms. Clamps vocoder stalls $\ge 2000$ms by synthesizing clean `{ serverContent: { turnComplete: true, deadAirClamped: true } }`, disarming turn watchdogs and smoothly transitioning FSM to `CANDIDATE_LISTENING`.
  2. **ToolAudioMutex Port & Integration:** Ported `ToolAudioMutex` from `gemini_live_reference/packages/core/src/tools/ToolAudioMutex.ts`. Acquired on `toolCall`, released on `toolResponse`, cancelled on `toolCallCancellation`. In `DownstreamClientPipe.ts`, outgoing microphone chunks are gated while tools are executing (`shouldGateMicAudio() === true`), preventing Google error `1008 Policy Violation: Operation is not implemented` and turn queue corruption.
  3. **SessionResumptionManager Port & Setup Injection:** Ported `SessionResumptionManager` from `gemini_live_reference/packages/core/src/context/SessionResumptionManager.ts`. In `liveAudioStreamRouter.ts`, intercepts incoming `sessionResumptionUpdate.newHandle` when `resumable === true`. In `liveGeminiConfigBuilder.ts`, injects `setup.sessionResumptionConfig = { handle }` when handle is present, preserving TPU KV-cache across socket drops.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* In 28.5-minute continuous sessions, Gemini's vocoder encountered trailing digital silence stalls and KV-cache prefill delays (TTFA 50.5s) because trailing silence held turns open and mic chunks leaked during tool execution.
  - *Empirical Finding:* Triangulated in session `session_practice_1795466330568_5rlf6v`: 19 watchdog timeouts occurred because Google's vocoder emitted zero-energy frames without closing the turn, while mic chunks were sent during tools without a mutex.
- **Rationale & "Why":** Strict 100% adherence to Google Gemini Live protocol SSOT in `gemini_live_reference` (Invariants 3, 9, 10).
- **Invariants:**
  - Trailing silence frames $\ge 2000$ms must be clamped to `turnComplete: true`.
  - Mic frames must be gated during active tool execution.
  - Cognitive bounding: `liveAudioStreamRouter.ts` <= 350 lines; `LiveDeadAirGuard.ts` <= 350 lines; `ToolAudioMutex.ts` <= 350 lines; `SessionResumptionManager.ts` <= 350 lines.

---

### 2.24 `LiveClientGuardService & DownstreamClientPipe: Cloud VAD Pipeline Restoration (Spec 39)`
- **Location:** [`backend/src/services/live/liveClientGuardService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveClientGuardService.ts), [`backend/src/services/live/DownstreamClientPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/DownstreamClientPipe.ts)
- **What Was Done:**
  1. In `liveClientGuardService.ts`, restored priority of `if (turnMode === 'auto') return false;` before `session.isAiGenerating` checks, guaranteeing uninterrupted audio and trailing silence streaming in Auto-VAD mode.
  2. In `DownstreamClientPipe.ts`, removed premature `session.isAiGenerating = true` and `armTurnWatchdogs` from the `audioStreamEnd` frame handler, ensuring generation state is driven strictly by upstream `serverContent.modelTurn`.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Marking `isAiGenerating = true` on `audioStreamEnd` caused `LiveClientGuardService` to choke all incoming microphone frames, starving Google's server-side Cloud VAD of trailing silence and causing 22s watchdog hangs.
  - *Empirical Finding:* Google Gemini Live does not trigger generation on `audioStreamEnd`; it requires continuous PCM audio with trailing ambient silence.
- **Rationale & "Why":** 100% adherence to Google Gemini 3.8 Live reference architecture (`gemini_live_reference`).
- **Invariants:**
  - In `turnMode === 'auto'`, audio frames must not be choked before model turn begins.
  - `isAiGenerating` must only be set when upstream modelTurn arrives.

---

### 2.25 `Hot Handoff, Passive Sentinel & Multimodal Whiteboard Synchronization (Spec 42 / #155–#158)`
- **Location:** [`UpstreamGeminiPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/UpstreamGeminiPipe.ts), [`LiveHotHandoffCoordinator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveHotHandoffCoordinator.ts), [`LiveStreamSentinel.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveStreamSentinel.ts), [`LiveToolEngine.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveToolEngine.ts), [`liveWorkspaceHandlers.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWorkspaceHandlers.ts), [`liveAudioStreamRouter.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveAudioStreamRouter.ts), [`sessionFsm.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/sessionFsm.ts)
- **What Was Done:**
  1. **GoAway Make-Before-Break Handoff:** `LiveHotHandoffCoordinator` intercepts upstream `goAway`, opens standby Socket B via `UpstreamGeminiPipe.openStandbySocket()`, reuses `session.resumptionHandle` (or falls back to `dispatchReconnectContextReplay` if `key_rotated` / setup rejection occurs), drains active speech cleanly, swaps atomically via `adoptSocket()`, and closes Socket A.
  2. **Reconnect Unblocking:** `UpstreamGeminiPipe.handleSocketClose()` only suppresses reconnect when `this.isClosed` (explicit app/client teardown); unexpected upstream `1000/1001` or `1008` goAway expiry reconnects automatically and forwards `upstream_error` to client if exhausted.
  3. **Passive Auto-VAD StreamSentinel:** `LiveStreamSentinel` observes mic PCM RMS + `ACTIVITY_START`/`END` + `inputTranscription` without mutating or cutting continuous audio, arming Phase-1 (7s) / Phase-2 (16s) post-speech watchdogs strictly after candidate speech cessation and a 10s mid-turn generation guard (0 false alarms when reading code silently).
  4. **Adaptive Multimodal Whiteboard Scheduling:** `handleUpdateWhiteboard` + `LiveToolEngine` use `WHEN_IDLE` with a concise voice directive when `< 24000` bytes (`< 500ms`) were spoken in the current turn (`SILENT` for `clear` or `>= 24000` bytes), emitting `tool_awaiting_speech` and holding `SessionFsm` in `AI_THINKING` under an 8s watchdog until follow-up speech completes. Raw `toolCall` objects are stripped when combined with `serverContent`.
- **Failure Modes & Invariants:**
  - `goAway` must never wait for upstream `1008` drop to rotate WebSockets.
  - `SessionFsm` must allow `AI_THINKING` transitions from `CANDIDATE_LISTENING`, `CANDIDATE_SPEAKING`, and `AI_SPEAKING`.
  - Combined `serverContent + toolCall` frames never leak raw `toolCall` to the browser.

---

### 2.26 `LiveVoiceSession, SessionTurnState, WatchdogManager & UpstreamTransportPort: Lifecycle Consolidation (Spec 46 / #171–#172)`
- **Location:** [`LiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveVoiceSession.ts), [`SessionTurnState.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/SessionTurnState.ts), [`WatchdogManager.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/WatchdogManager.ts), [`DownstreamClientPipe.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/DownstreamClientPipe.ts), [`liveSessionTypes.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveSessionTypes.ts), [`testLiveWsProtocol.ts`](file:///home/djelu/projects/interview_tutor/backend/src/scripts/testLiveWsProtocol.ts)
- **What Was Done:**
  1. Added `UpstreamTransportPort` interface and `WatchdogManager.ensureSessionWatchdogs()`, removing raw `nudgeWatchdog`/`deadAirWatchdog` handle fields from `ProxySession`.
  2. Consolidated `LiveSessionAggregate`, `sessionStartupHelper`, `liveWsConnectionHandler`, `liveWsClientFrameHandler`, and `liveWsTurnCommitHandler` into `LiveVoiceSession`, `DownstreamClientPipe`, and `SessionTurnState`.
  3. Injected `blueprint` / `blueprintBuilder` / `createUpstream` ports into `LiveVoiceSession`, adding direct in-process `testLiveWsProtocol.ts` verification (Turn 0 lockdown + `terminate()` watchdog cancellation) into `npm run test:vad:unit`.
- **Rationale & Invariants:** Single lifecycle owner (`LiveVoiceSession`), zero dangling timer handles outside `WatchdogManager`, and direct in-process test seam over `UpstreamTransportPort`.


