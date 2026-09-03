# Voice & Dialogue Stack Technical Debt Ledger (SOTA 2026)

**Audit Target Scope:**
1. `frontend/src/components/VoiceModal.tsx`
2. `frontend/src/components/voice/VoiceTutorView.tsx`
3. `frontend/src/services/AudioPlayoutManager.ts`
4. `frontend/public/worklets/audio-capture-processor.js`
5. `backend/src/services/geminiLiveProxy.ts`
6. `backend/src/routes/interviewTurn.ts`

**Audit Date:** 2026-09-03  
**Status:** In Progress (Iterative Remediation)

---

## 📋 Defect Registry

### Category: CRITICAL
- [x] **CRIT-01: Untracked Interruption Timer & Playhead Corruption (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:455-470`
  - *Description:* `handleInterruption()` fires an unmanaged `setTimeout(..., 7)`. If speech restarts or audio chunks arrive before the timeout executes, the callback stops the *new* source node, clears `activeSources`, and resets `playheadCursor = 0`, truncating the beginning of subsequent speech.
  - *Impact:* Audio clipping, lost dialogue starts on rapid Barge-In.
  - *Fix Applied:* Implemented tracked `interruptionTimer` and snapshot `sourcesToStop` so newly arriving frames aren't prematurely stopped. Cursor reset is guarded by `activeSources.size === 0`.
  - *Status:* [x] RESOLVED

- [x] **CRIT-02: `MediaStreamSourceNode` Garbage Collection & Resource Leak (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1785, 1887-1913`
  - *Description:* `const sourceNode = audioCtx.createMediaStreamSource(stream)` is created as an unreferenced local variable. Browser GC can prematurely collect it mid-session, cutting off candidate audio. Furthermore, `stopMicrophone()` never calls `sourceNode.disconnect()`, leaking the audio source node in memory.
  - *Impact:* Spontaneous mic cutouts on Chrome/WebKit, memory leak on unmount/reconnect.
  - *Fix Applied:* Stored persistent reference in `mediaStreamSourceRef`, explicitly invoked `mediaStreamSourceRef.current.disconnect()` in `stopMicrophone()`, and sent `RESET` to AudioWorklet.
  - *Status:* [x] RESOLVED

---

### Category: HIGH
- [x] **HIGH-01: Uncancelled `drainTimer` in `playDecodedAudioBuffer` (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:275-307`
  - *Description:* `scheduleBufferOnTimeline` clears `this.drainTimer` when starting a new buffer, but `playDecodedAudioBuffer` omits this check. If a decoded audio buffer (TTS greeting or turn reply) starts while a previous drain timer is running, `onPlaybackFinished` triggers prematurely during playback.
  - *Impact:* Race condition in Dual-Sided Handshake; premature microphone activation during AI speech.
  - *Fix Applied:* Added `if (this.drainTimer) { clearTimeout(this.drainTimer); this.drainTimer = null; }` at entry to `playDecodedAudioBuffer`, eliminating premature mic activation.
  - *Status:* [x] RESOLVED

- [x] **HIGH-02: Unhandled In-Flight Async Fetch Operations on Modal Unmount (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:449, 1046, 1182, 1315, 1517, 2087, 2132`
  - *Description:* Async requests (`/api/interview/turn`, `/api/interview/greeting`, `/api/eval`, `/api/stt/transcribe`, `/api/eval/save`) do not check if the component is mounted or if `isOpen === true`, nor do they utilize `AbortController`. Closing the modal or quickly advancing questions leaves dangling promises that update unmounted React state.
  - *Impact:* React state update on unmounted component warnings, network bandwidth waste.
  - *Fix Applied:* Added `activeAbortControllersRef` and `createManagedAbortSignal()` tracking across all async calls, guarded state updates with `isMountedRef.current && isOpen`, and aborted in-flight operations on unmount or teardown.
  - *Status:* [x] RESOLVED

- [x] **HIGH-03: Client Barge-In Event Not Propagated Upstream to Gemini Live (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:2401-2408`, `VoiceTutorView.tsx:382-395`
  - *Description:* When user clicks Stop / Barge-In in `VoiceTutorView` or `VoiceModal`, local audio is silenced, but no signal/turn is sent to the backend WebSocket proxy. The upstream Gemini Live model continues streaming chunks into the ether, causing turn desynchronization.
  - *Impact:* Turn collisions, wasted proxy tokens, latency on candidate's next response.
  - *Fix Applied:* Implemented `handleClientBargeIn()`, silencing local audio, clearing worklet buffers, and immediately dispatching an upstream clientContent barge-in frame over WebSocket to interrupt Gemini Live streaming.
  - *Status:* [x] RESOLVED

- [x] **HIGH-04: Upstream Tool Call Exception Handling & Raw Leakage (`geminiLiveProxy.ts`)** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:515-545`
  - *Description:* If `handleLiveToolCall` throws an unhandled error inside the message handler loop, `isToolCallProcessed` remains `false`, and the raw `toolCall` JSON frame is forwarded directly to the client socket, which expects standard message frames.
  - *Impact:* WebSocket client crashes or unhandled frame protocol violation.
  - *Fix Applied:* Set `isToolCallProcessed = true` unconditionally on functionCalls arrival to prevent raw frame forwarding, and wrapped tool execution in try/catch with upstream error `toolResponse` to prevent Gemini Live deadlocks.
  - *Status:* [x] RESOLVED

- [x] **HIGH-05: Fragile Markdown JSON Parsing in `/api/interview/turn` (`interviewTurn.ts`)** [RESOLVED]
  - *Location:* `interviewTurn.ts:287-293`
  - *Description:* `JSON.parse(clean)` crashes the HTTP request with a 500 error if the model includes preamble or trailing text outside code fences. Lacks regex boundary extraction and safe fallback reasoning response.
  - *Impact:* Turn fails completely with 500 Internal Server Error when LLM output format varies.
  - *Fix Applied:* Implemented 4-stage resilient `parseReasoningJson` (direct parse, markdown fence stripping, regex `{[\s\S]*}` match, and safe structured probe fallback), ensuring zero unhandled 500 crashes.
  - *Status:* [x] RESOLVED

---

### Category: MEDIUM
- [x] **MED-01: Cross-Turn Audio Buffer Contamination in AudioWorklet (`audio-capture-processor.js`)** [RESOLVED]
  - *Location:* `audio-capture-processor.js:21-22, 49, 66, 114-129`
  - *Description:* Up to 1023 un-emitted samples (<64ms) remain in `this.outputBuffer` when speech stops. Because there is no message listener on `this.port`, subsequent turns start with leftover audio from the previous session.
  - *Impact:* Audio clipping/glitching at the start of new user utterances.
  - *Fix Applied:* Implemented `this.port.onmessage` handler for `RESET` and `FLUSH` events, cleanly draining or resetting residual samples and filter state at turn boundaries.
  - *Status:* [x] RESOLVED

- [x] **MED-02: Oscillator & Gain Node Leaks on Chimes in `AudioPlayoutManager.ts`** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:47-83, 88-121`
  - *Description:* Chime oscillators (`playThinkingAuraTone`, `playHoldChime`) are not added to `activeSources` or tracked. If `handleInterruption()` or `teardown()` is invoked while a tone is active, the nodes remain connected and audible.
  - *Impact:* Audio playout cannot be instantly silenced if user interrupts during chime playback.
  - *Fix Applied:* Added `activeChimes` set tracking both oscillator and gain nodes. Cleared and disconnected in `handleInterruption()`, `clearQueue()`, and `teardown()`.
  - *Status:* [x] RESOLVED

- [x] **MED-03: Unsafe Base64 Decoding without Error Trapping (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:259, 316`
  - *Description:* `atob(...)` is called directly without stripping whitespace/newlines or try/catch. Malformed base64 strings throw unhandled `DOMException: InvalidCharacterError` inside the WebSocket message handler.
  - *Impact:* WebSocket message handler terminates abruptly on noisy network frames.
  - *Fix Applied:* Sanitized base64 string via whitespace removal and wrapped all decoding in try/catch with graceful warnings.
  - *Status:* [x] RESOLVED

- [x] **MED-04: Dead / Redundant Timer Variables in `geminiLiveProxy.ts`** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:71, 203, 223, 472-475, 685-692`
  - *Description:* Both closure variable `greetingWatchdog` and `session.greetingWatchdog` remain in the codebase despite greeting watchdog logic being deprecated, causing redundant clear operations and confusing timer states.
  - *Impact:* Code bloat, potential memory confusion.
  - *Fix Applied:* Removed unused `greetingWatchdog` declarations and dead clearTimeout blocks from `ProxySession`, connection setup, modelTurn listener, and `terminate()`.
  - *Status:* [x] RESOLVED

---

### Category: TECH_DEBT
- [x] **TECH-01: Loose Types & `any` Overuse Across Voice Modules** [RESOLVED]
  - *Location:* `VoiceModal.tsx`, `VoiceTutorView.tsx`, `AudioPlayoutManager.ts`, `geminiLiveProxy.ts`
  - *Description:* `drainTimer: any`, `call: { args?: any }`, `wakeLockRef: any` instead of strict TypeScript typing.
  - *Impact:* Reduced compile-time type safety.
  - *Fix Applied:* Replaced loose types with strict types (`ReturnType<typeof setTimeout>`, `WakeLockSentinel | null`, `instanceof Error` checks), achieving 100% strict type conformance across all modules.
  - *Status:* [x] RESOLVED

- [x] **TECH-02: Parameter Validation & Guard Defaults in `/api/interview/greeting` & `/turn`** [RESOLVED]
  - *Location:* `interviewTurn.ts:23-36`
  - *Description:* Validate `voice`, `strategy`, and `sessionType` against allowed enums to prevent invalid TTS or prompt parameters.
  - *Impact:* Prevents bad inputs from propagating to proxy or DB.
  - *Fix Applied:* Implemented `VALID_VOICES` whitelist validation (`sanitizeVoice`) and strict bounds on `userGender`, `sessionType`, and `tutorMode`.
  - *Status:* [x] RESOLVED
