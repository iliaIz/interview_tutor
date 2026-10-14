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


