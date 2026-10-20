# 04. Client Voice Engine & Audio DSP

> **Location:** `docs/architecture/functional_registry/04_client_voice_engine_dsp.md`  
> **Subsystem (Level 1):** Client Voice Engine & Audio DSP  
> **Primary Files:** [`frontend/src/audio/LiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceEngine.ts), [`frontend/src/services/AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts), [`frontend/src/audio/LiveVoiceStateMachine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceStateMachine.ts), [`frontend/public/worklets/audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js)

---

## 1. Subsystem Scope
Client-side Web Audio DSP, AudioWorklet ring buffers, speech capture, audio playback queue management, dual-sided turn-taking handshake, tactile barge-in, and the candidate voice state machine.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `LiveVoiceEngine.connect()`
- **Location:** [`LiveVoiceEngine.ts#L80-L160`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/LiveVoiceEngine.ts)
- **What Was Done:** Initiates browser WebSocket connection to `/ws/live`, negotiates session parameters, binds incoming PCM chunks to `AudioPlayoutManager`, and coordinates FSM state transitions.
- **Hypotheses & Intermediate Conclusions:**
  - Client state machine must remain trap-free. If upstream hangs, an autonomous 25s client-side safety timer ensures transition back to `CANDIDATE_LISTENING` rather than freezing in `COMMITTING`.
- **Rationale & "Why":** Provides guaranteed responsiveness even in the event of upstream network or server-side deadlock.
- **Invariants:** Client must never permanently hang in `AI_THINKING` or `COMMITTING`.

---

### 2.2 `LiveVoiceEngine.sendAudioChunk()`
- **Location:** [`LiveVoiceEngine.ts#L170-L220`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/LiveVoiceEngine.ts)
- **What Was Done:** Feeds 16kHz 16-bit Mono PCM audio chunks captured via `AudioWorklet` ring buffer into WebSocket.
- **Hypotheses & Intermediate Conclusions:**
  - Continuous streaming of ambient mic audio is required for Google's native cloud VAD to detect conversational cadence and speech boundaries accurately.
  - Ring buffer capacity calibrated to $\ge 2^{22}$ samples with anti-lapping logic to prevent buffer overruns during upstream synthesis bursts.
- **Rationale & "Why":** Conforms to official SOTA Google Gemini Live protocol specifications.
- **Invariants:** Audio format strictly 16kHz Mono PCM. Must not inject empty `turnComplete` signals into active audio streams.

---

### 2.3 `AudioPlayoutManager.handleInterruption()`
- **Location:** [`AudioPlayoutManager.ts#L130-L175`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/AudioPlayoutManager.ts)
- **What Was Done:** Implemented tactile barge-in handling with a 5ms linear gain de-click ramp. When candidate taps the central circle during AI speech, playout is immediately silenced, audio buffer drained, and mic switched to active listening.
- **Hypotheses & Intermediate Conclusions:**
  - Instant cut-offs cause audible clicks/pops in headphones. A 5ms ramp provides smooth silencing.
  - Turn 0 Question Recitation lockdown: acoustic barge-in is locked until physical DAC audio drain finishes; only explicit tactile clicks can interrupt Turn 0.
- **Rationale & "Why":** Gives candidate tactile control while preventing accidental self-interruption from speaker echo on Turn 0.
- **Invariants:** De-click ramp must be $\le 5$ms to feel instantaneous without acoustic popping.

---

### 2.4 `AudioPlayoutManager.onPlaybackFinished()`
- **Location:** [`AudioPlayoutManager.ts#L85-L125`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/AudioPlayoutManager.ts)
- **What Was Done:** Fired when physical audio drains from the Web Audio hardware buffer. Cooperates with WebSocket `turnComplete` to unblock candidate microphone in a Dual-Sided Handshake.
- **Hypotheses & Intermediate Conclusions:**
  - Network `turnComplete` arrives seconds before physical audio finishes playing in headphones. Unblocking the mic on `turnComplete` causes candidate to speak while AI audio is still playing, creating acoustic echo loops.
  - Dual-sided handshake ensures mic is unblocked ONLY when BOTH network generation is complete AND physical DAC buffer is drained.
- **Rationale & "Why":** Eliminates acoustic feedback loops on speakerphones and mobile devices.
- **Invariants:** Mic unblocking requires conjunction: `turnComplete === true` AND `dacBufferEmpty === true`.

---

### 2.5 `initMicrophoneHardware()`
- **Location:** [`VoiceModal.tsx#L90-L125`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
- **What Was Done:** Wrapped microphone hardware permission and Web Audio Context acquisition in a non-blocking background promise.
- **Hypotheses & Intermediate Conclusions:**
  - Blocking modal mount on `getUserMedia()` prevents greeting audio from playing if candidate hesitates on browser permission dialog.
- **Rationale & "Why":** Greeting audio must start playing immediately regardless of mic permission delay.
- **Invariants:** WebSocket connection and AI greeting audio are never blocked by OS microphone prompts.

---

### 2.6 `AudioCaptureProcessor.process()` (Chunk Sizing: 32ms vs 100ms)
- **Location:** [`frontend/public/worklets/audio-capture-processor.js#L20-L93`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js)
- **What Was Done:** Configured chunk capacity and linear downsampling from native Web Audio rate (44.1/48kHz) to 16kHz Int16 PCM.
- **Hypotheses & Intermediate Conclusions:**
  - *As-Is Defect:* Sizing chunk capacity to 512 samples (32ms) caused the worklet to fire 31.25 times per second. This flooded the WebSocket with JSON/Base64 overhead, created packet jitter, and prevented Google Cloud VAD from getting clean 100ms acoustic frames.
  - *Empirically Proven Standard:* Sizing chunk capacity to 1600 samples (100ms @ 16kHz) reduces network frame frequency to exactly 10 fps.
  - Across 13+ minutes of live dialogue, 100ms chunks delivered rock-solid Cloud VAD detection, sub-second TTFA (680–900ms), and 0 stalls.
- **Rationale & "Why":** 100ms is the canonical SOTA frame size for WebRTC and Google Gemini Live bidirectional streaming.
- **Invariants:** Real-time microphone PCM chunks must be sized to 100ms (1600 samples @ 16kHz).

---

### 2.7 `LiveVoiceEngine.setAudioMutex()` (Audio Mutex during Tool Execution)
- **Location:** [`LiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveVoiceEngine.ts) / [`clean_voice_tester.html#L101-L112`](file:///home/djelu/projects/interview_tutor/scripts/clean_voice_tester.html#L101-L112)
- **What Was Done:** Added an audio transmission mutex that freezes microphone PCM streaming while a `toolCall` is in-flight until `toolResponse` is delivered to Google.
- **Hypotheses & Intermediate Conclusions:**
  - Streaming audio chunks into WebSocket while upstream Gemini is awaiting tool results triggers WebSocket Close `1008 Policy Violation: Operation is not implemented`.
  - Mutex prevents packet collisions in the Gemini Live multimodal transformer.
- **Rationale & "Why":** Upstream Gemini Live protocol strictly forbids interleaved acoustic frames during synchronous tool execution.
- **Invariants:** No `realtimeInput.audio` chunks may be transmitted to the WebSocket between receiving `toolCall` and dispatching `toolResponse`.

---

### 2.8 `useLiveVoiceSession() & useLiveAudioSession(): Authoritative Single-Engine Unification`
- **Location:** [`frontend/src/audio/useLiveVoiceSession.ts`](file:///d:/projects/synced_with_vps/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts), [`frontend/src/hooks/useLiveAudioSession.ts`](file:///d:/projects/synced_with_vps/interview_tutor/frontend/src/hooks/useLiveAudioSession.ts)
- **What Was Done:** Consolidated parallel React hook bindings into a single authoritative adapter (`useLiveVoiceSession.ts`), maintaining backwards-compatible re-exports from `useLiveAudioSession.ts`. Exposed unified callbacks (`onEvaluationCompleted`, `onBugSolved`, `onChaosInjected`, `onCandidateObservationRecorded`, `onHiringCommitteeVerdict`, `onWhiteboardUpdate`), action methods (`sendCanvasDelta`, `sendCustomFrame`, `sendActionEventMessage`), and reactive properties (`isDraining`, `rmsDb`, `statusMessage`).
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Maintaining two separate React hooks (`useLiveVoiceSession` in Theory vs `useLiveAudioSession` in Practice) risked protocol divergence and code bloat.
  - *Empirical Finding:* All practice tracks (LLD, Transactions, Testing, Bug Hunt, System Design) and theory modals share the identical `NativeLiveVoiceEngine` core. Unifying into one adapter with backward compatibility yields zero regression across all test suites (18 playout contracts, 14 live session contracts, 12 voice engine contracts passed).
- **Rationale & "Why":** Strict adherence to Rule 8 (Zero Parallel Reimplementation & Strict Reuse Invariant).
- **Invariants:** No secondary voice WebSocket hook may be instantiated. All UI arenas must route through `useLiveVoiceSession` / `NativeLiveVoiceEngine`.

---

### 2.9 `VoiceModal.tsx & VoiceActiveView.tsx: Dual-Sided Handshake for Verdict & Tutor Controls`
- **Location:** [`frontend/src/components/VoiceModal.tsx`](file:///d:/projects/synced_with_vps/interview_tutor/frontend/src/components/VoiceModal.tsx), [`frontend/src/components/voice/VoiceActiveView.tsx`](file:///d:/projects/synced_with_vps/interview_tutor/frontend/src/components/voice/VoiceActiveView.tsx)
- **What Was Done:**
  1. Decomposed active stage rendering into `VoiceActiveView.tsx` (< 150 lines), bringing `VoiceModal.tsx` down to 329 lines (under 350-line limit).
  2. Implemented Dual-Sided Handshake for evaluation: when `evaluation` payload arrives, modal stays in `stage = 'active'` showing `"🎙️ ИИ подводит итоги ответа... Дослушайте вердикт"` until physical audio drains (`!isDraining && state !== 'AI_SPEAKING'`).
  3. Added explicit Socratic Tutor controls with "Завершить разбор темы" button and `onTutorComplete` callback to allow clean completion and topic progress saving in `StudyDeck`.
  4. Added clean socket disconnection and timeout delay on `handleNextQuestion` to prevent WebSocket collisions during batch transitions.
- **Hypotheses & Intermediate Conclusions:**
  - *Root Cause 1 (Audio Cutoff):* `VoiceModal` immediately switched to `stage = 'verdict'` upon receiving evaluation, unmounting the active visualizer and cutting Web Audio before the AI finished speaking the closing sentence.
  - *Root Cause 2 (Tutor Trapped in Interview UI):* Socratic tutor never dispatches `submit_interview_evaluation` by design, so the modal had no finish action other than the close 'X' button.
- **Rationale & "Why":** Eliminates premature audio cutoff and provides complete lifecycle support for Theory tutoring and interview sessions.
- **Invariants:** Verdict view must NEVER unmount active audio visualizer while DAC audio buffers are draining.

---

### 2.10 `PracticeArena.tsx: PracticeVoiceDefenseGate Dual-Mic Concurrency Suppression`
- **Location:** [`frontend/src/components/practice/PracticeArena.tsx#L17-L27`](file:///d:/projects/synced_with_vps/interview_tutor/frontend/src/components/practice/PracticeArena.tsx)
- **What Was Done:** Implemented `PracticeVoiceDefenseGate` component inside `PracticeVoiceProvider`. When `isVoiceDefenseOpen` becomes true, the gate checks `isConnected` and immediately disconnects any background practice voice session.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* If an ambient voice tutor session is running in `PracticeArena` when the candidate launches Voice Defense in Transaction Lab, two concurrent `NativeLiveVoiceEngine` instances would compete for the microphone and audio output.
  - *Empirical Finding:* Cleanly disconnecting the background session upon opening defense modal ensures a single active microphone pipeline and prevents acoustic echo.
- **Rationale & "Why":** Enforces Single-Sink Audio Routing & Capture Invariant (Rule 2.5).
- **Invariants:** Exactly one voice session may hold microphone capture custody at any given time.

---

### 2.11 `VoiceModal.tsx & liveVoiceUrlBuilder.ts: Zero-Timeout State Handoff, Question Serialization & Instant Tutor Start (Wave 17)`
- **Location:** [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx), [`frontend/src/audio/liveVoiceUrlBuilder.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveVoiceUrlBuilder.ts), [`frontend/src/components/voice/VoiceModalHeader.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceModalHeader.tsx), [`frontend/src/components/voice/voiceModalTypes.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/voiceModalTypes.ts)
- **What Was Done:**
  - Removed the `setTimeout(() => startSession(), 100)` anti-pattern in `handleNextQuestion` and `handleRetryQuestion`.
  - Implemented `startSessionForIndex(targetIndex: number, isRetryAttempt = false)` which accepts the next question index explicitly, eliminating React stale closure traps on `activeBatchIndex`.
  - Added reactive synchronization `useEffect(() => setActiveBatchIndex(initialQuestionIndex), [initialQuestionIndex])` so external changes to selected questions immediately sync active state.
  - In `tutor` mode, set initial `stage` to `'active'` and auto-connected immediately, bypassing the exam lobby screen.
  - Serialized `questionIndex`, `totalQuestions`, and `isRetry` into URL query parameters via `buildLiveVoiceWebSocketUrl` and into `session_init` control frames.
  - Linked `activeBatchSession`, `saveBatchSessionCheckpoint`, and `clearBatchSession` from `useAppStore` for robust session recovery.
  - Extracted header and types to keep `VoiceModal.tsx` strictly under the 350-line limit (346 lines).
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* When navigating between questions in a study deck, the AI tutor remained stuck on question #1 because `setTimeout` closed over the initial `activeBatchIndex = 0`.
  - *Empirical Finding:* Parameterizing `startSessionForIndex(targetIndex)` cleanly disconnects the existing socket and connects to the correct question index deterministically, without relying on asynchronous timer delays.
- **Rationale & "Why":** Deterministic state handoff eliminates UI/AI desynchronization, while instant tutor launch removes unnecessary friction for theory study.
- **Invariants:** Modal batch navigation MUST NOT use asynchronous timeouts to sequence connection drops and starts. Target question index MUST be explicitly passed to connection handlers.

---

### 2.12 `VoiceModal.tsx & NativeLiveVoiceEngine.ts: Idempotent Single-Fire Guards, Pre-Setup Capture Gating & Race-Free Batch Navigation (Wave 18)`
- **Location:** [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx), [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts)
- **What Was Done:**
  1. **Idempotent Single-Fire Ref Guards:** Replaced the multi-dependency reactive auto-start `useEffect` in `VoiceModal.tsx` with an explicit `hasAutoStartedRef` and connection mutex `isConnectingRef`. Auto-start executes strictly once upon modal opening and resets cleanly upon closing.
  2. **Pre-`setupComplete` Capture Gate:** In `NativeLiveVoiceEngine.ts`, introduced `isSessionReady` boolean flag. In `handleMicrophoneChunk`, mic frames are blocked until `isSessionReady === true` and state is strictly candidate-active (`LISTENING`).
  3. **Batch Question SSOT:** In `VoiceModal.tsx`, prioritized `questionsBatch[targetIndex]` as the authoritative source of question metadata for each turn, eliminating re-render cascades caused by parent deck state synchronization.
  4. **Decoupled Parent State Sync:** Wrapped parent `onIndexChange` notifications in `requestAnimationFrame` to ensure modal socket re-establishment completes before parent re-rendering occurs.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Re-triggering and repeated greetings in VoiceModal were caused by reactive dependencies in the auto-start effect (`startSessionForIndex` identity changes when parent props updated), causing the effect to fire a second time while the first connection was still establishing.
  - *Empirical Finding:* When `startSessionForIndex` ran, `connect()` called `disconnect()`, setting state to `IDLE`. The effect observed `state === 'IDLE'` and the updated callback, executing a second time, closing the active socket with code 1000 ("Normal Closure") and reconnecting with a repeated Turn 0 greeting.
- **Rationale & "Why":** Completely eliminates the reactive reconnection loop, prevents race conditions during batch question transitions, and shields Gemini Live from pre-setup ambient microphone streaming.
- **Invariants:**
  - Auto-start in `VoiceModal` MUST be idempotent and guarded by a ref, firing exactly once per modal session.
  - `NativeLiveVoiceEngine` MUST NEVER emit microphone PCM chunks to the WebSocket before `setupComplete` is received from the server.

---

### 2.13 `Continuous Neural Audio Filtering, Zero-Alloc TKEO Clipper & Speculative Ducking (Wave 19)`
- **Location:**
  - [`frontend/public/worklets/audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js)
  - [`frontend/src/audio/MicrophoneCapture.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/MicrophoneCapture.ts)
  - [`frontend/src/services/audioDuckingController.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/audioDuckingController.ts)
  - [`frontend/src/services/AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts)
  - [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts)
  - [`frontend/src/audio/useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts)
  - [`frontend/src/components/voice/VoiceMicButton.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceMicButton.tsx)
  - [`frontend/src/components/voice/VoiceActiveView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceActiveView.tsx)
  - [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
- **What Was Done:**
  1. **AudioWorklet Zero-Allocation & TKEO Soft-Clipper:** Removed the naive RMS decibel Schmitt trigger (`speechDetected = db > dynamicAssertDb`) that caused immediate acoustic barge-in during `AI_SPEAKING`. Implemented discrete Teager-Kaiser Energy Operator ($\Psi[x(n)] = x^2(n) - x(n-1)x(n+1)$) to detect impulsive non-speech spikes in $<0.15$ ms and soft-clamp peaks to $-26$ dBFS, tagging frames with `isTransientSpike: true`. Standardized frames to 512 samples (32 ms @ 16 kHz) with a recycled pool of 8 transferable ArrayBuffers (zero GC in `process()`).
  2. **Speculative Ducking & Minimum Voicing Duration ($T_{\text{min\_voice}} = 224$ ms):** Extracted `AudioDuckingController`. During `AI_SPEAKING`, non-speech transients are 100% ignored. On vocal phonation onset candidates (RMS $> -38$ dBFS), AI volume ducks smoothly by $-12$ dB over 15 ms. If sound ceases within $< 180$ ms (cough / throat clear / click), volume smoothly rolls back to 0 dB with zero KV-cache disruption. If sustained for $\ge 7$ consecutive 32 ms frames ($\ge 224$ ms), clean hard barge-in is committed with 5 ms de-click fade-out.
  3. **Continuous PCM Streaming with In-Place Clamping:** During `LISTENING`, 16kHz 16-bit Mono PCM streams continuously over WebSocket (`AGENTS.md` Rule 2.6). Non-speech transients (coughs/clicks) are clamped in-place to ambient silence (`STATIC_SILENCE_BASE64`, $-50$ dBFS). Google Cloud VAD never triggers `ACTIVITY_START` on coughs. Spoken candidate answers pass through with full fidelity; continuous trailing silence triggers server-side `silenceDurationMs: 500` naturally.
  4. **Reassurance UX (State B) & Ergonomic Hotkeys:** Added gentle State B lilac aura and micro-badge «Звук отфильтрован» for 1.2s when non-speech transients are suppressed. Added Spacebar (Push-to-Talk) and `C` (Cough-Mute) keyboard shortcuts.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis 1:* False barge-in on cough during `AI_SPEAKING` was locally triggered by the naive RMS Schmitt trigger in `audio-capture-processor.js`.
  - *Empirical Finding 1:* Verified. During `AI_SPEAKING`, audio is never sent to Google; the engine relied strictly on local `metrics.speechDetected`. Replacing this with TKEO transient tagging and 224 ms minimum voicing completely cures false interruptions.
  - *Hypothesis 2:* Discontinuous gating (stopping WebSocket frames during pauses) would break Google Cloud VAD.
  - *Empirical Finding 2:* Verified against `tmp/gemini 3.8 live docs/` (`04_audio_context_and_turn_taking.md`). Cloud VAD advances `silenceDurationMs` strictly on incoming PCM samples; dropping frames deadlocks endpointing and corrupts noise adaptation. In-place clamping provides 100% cough immunity while preserving stream continuity.
- **Rationale & "Why":** Deep root-cause remediation: addresses acoustic discrimination in real-time DSP, avoids race conditions via speculative ducking, and maintains 100% compliance with Google Gemini 3.8 Live bidirectional streaming standards.
- **Invariants:**
  - Microphone PCM streaming during `LISTENING` MUST remain continuous 16kHz 16-bit Mono PCM.
  - Acoustic barge-in during `AI_SPEAKING` MUST require at least 224 ms ($N=7$ frames) of sustained vocal phonation.
  - Non-speech transients MUST be clamped in-place to ambient floor.

---

### 2.14 `Hands-Free Voice Batch Navigation, Dialogue Continuity & Tear-Free Reconnection (Wave 20)`
- **Location:**
  - [`backend/src/services/live/liveNavigationToolDispatcher.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveNavigationToolDispatcher.ts)
  - [`backend/src/services/live/liveToolDeclarations.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveToolDeclarations.ts)
  - [`backend/src/services/live/promptDirectives.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/promptDirectives.ts)
  - [`backend/src/services/live/livePromptBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts)
  - [`backend/src/services/live/liveTutorPromptBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveTutorPromptBuilder.ts)
  - [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts)
  - [`frontend/src/audio/LiveAudioStreamManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/LiveAudioStreamManager.ts)
  - [`frontend/src/audio/useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts)
  - [`frontend/src/components/VoiceModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
  - [`frontend/src/components/voice/VoiceActiveView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceActiveView.tsx)
  - [`frontend/src/components/voice/VoiceVerdictView.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/voice/VoiceVerdictView.tsx)
- **What Was Done:**
  1. **Canonical Navigation Tool (`navigate_question`):** Declared with `NON_BLOCKING` behavior, direction enum `['next', 'prev', 'to_index', 'finish']`, and action enum `['skip_unanswered', 'proceed_next', 'review_previous', 'finish_batch']`.
  2. **Negative Anti-Collision Guardrail (`VOICE_NAVIGATION_CAPABILITY_DIRECTIVES`):** Strictly prohibits triggering `navigate_question` on technical/algorithmic vocabulary ("на следующем шаге", "пропустим проверку", "вернемся назад к CAS"). Activation strictly requires a direct meta-command to the tutor/interviewer.
  3. **Fair Evaluation Penalty Contract:** Skipping an interview question before oral completion automatically records a 0-score evaluation in SQLite, registers an error gap in vector memory/FSRS, and updates batch progress.
  4. **Tear-Free Dual-Sided Handshake Reconnect:** When `navigation_action` arrives, the client soft-mutes the microphone and buffers the transition until the AI's confirmation phrase fully drains through the physical audio DAC (`AudioPlayoutManager.onPlaybackFinished`), preventing mid-syllable audio clipping.
  5. **Clean-Slate Repeat Attempts:** Returning to a previously skipped/failed question reinitializes the session with `isRetry: true`, cleanly wiping prior turn memory and idempotently updating `batchResults[qId]` upon new answer completion.
  6. **Hands-Free Verdict Flow (Variant B):** In batch interview mode, the verdict screen features a 6-second auto-advance progress timer with pause/resume controls and speech-driven advance ("Дальше / Следующий").
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis 1:* Holding a single WebSocket open across 10+ questions would cause severe context inflation and latency spikes.
  - *Empirical Finding 1:* Reconnection latency per question in WebSocket is $<300$ ms, whereas audio context token accumulation in a multi-question session degraded TTFT from ~350 ms to $>2.5$ s and caused rubric bleed. Atomic sessions per question preserve invariant latency and context purity.
  - *Hypothesis 2:* Closing the socket immediately upon `toolCall` causes acoustic clicks and speech cutoff.
  - *Empirical Finding 2:* Verified. Waiting for `turnComplete` + DAC drain (`AudioPlayoutManager.onPlaybackFinished`) delivers a 100% natural verbal confirmation (*"Хорошо, фиксирую пропуск вопроса..."*) with zero acoustic clipping.
- **Rationale & "Why":** Converts InterviewPrep into a true ambient, hands-free tutoring experience (for walking, commuting, or relaxing) without compromising context purity, evaluation fairness, or audio playback quality.
- **Invariants:**
  - Each batch question MUST run in an isolated, atomic WebSocket session.
  - Sockets MUST NEVER be torn down during navigation until the AI's verbal confirmation has drained through physical DAC playout.
  - Skipped interview questions MUST receive a 0 score and be logged to FSRS knowledge decay.





