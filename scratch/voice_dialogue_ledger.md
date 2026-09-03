# Voice & Dialogue Stack Technical Debt Ledger (SOTA 2026)

**Audit Target Scope:**
1. `frontend/src/components/VoiceModal.tsx`
2. `frontend/src/components/voice/VoiceTutorView.tsx`
3. `frontend/src/services/AudioPlayoutManager.ts`
4. `frontend/public/worklets/audio-capture-processor.js`
5. `backend/src/services/geminiLiveProxy.ts`
6. `backend/src/routes/interviewTurn.ts`

**Audit Date:** 2026-09-03  
**Status:** Completed (100% Resolved)

---

## 📋 Defect Registry

### Category: CRITICAL
- [x] **CRIT-01: Untracked Interruption Timer & Playhead Corruption (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:455-470`
  - *Description:* `handleInterruption()` fires an unmanaged `setTimeout(..., 7)`. If speech restarts or audio chunks arrive before the timeout executes, the callback stops the *new* source node, clears `activeSources`, and resets `playheadCursor = 0`, truncating the beginning of subsequent speech.
  - *Fix Applied:* Implemented tracked `interruptionTimer` and snapshot `sourcesToStop`. Cursor reset is guarded by `activeSources.size === 0`.
  - *Status:* [x] RESOLVED

- [x] **CRIT-02: `MediaStreamSourceNode` Garbage Collection & Resource Leak (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1785, 1887-1913`
  - *Description:* `createMediaStreamSource(stream)` is created as an unreferenced local variable. Browser GC can prematurely collect it mid-session, cutting off candidate audio. Furthermore, `stopMicrophone()` never calls `sourceNode.disconnect()`, leaking the audio source node in memory.
  - *Fix Applied:* Stored persistent reference in `mediaStreamSourceRef`, explicitly invoked `mediaStreamSourceRef.current.disconnect()` in `stopMicrophone()`, and sent `RESET` to AudioWorklet.
  - *Status:* [x] RESOLVED

- [x] **CRIT-03: `isMountedRef` Reset Failure Breaking All Async Turns on Re-open (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:196, 586, 1145, 1281, 1420, 1616, 2183, 2216`
  - *Description:* `isMountedRef.current = false` is executed in the cleanup of `useEffect(..., [isOpen])`. When the user closes and subsequently re-opens the modal, `isMountedRef.current` remains `false`. Consequently, all async operation guards (`/turn`, `/greeting`, `/eval`, STT) drop their responses immediately, breaking subsequent interview turns and evaluations.
  - *Impact:* Total failure of speech recognition and AI dialogue responses on second and subsequent modal opens.
  - *Fix Applied:* Decoupled `isMountedRef` into a true component-level mount hook `useEffect(() => { ... }, [])`, ensured `isMountedRef.current = true` on modal opening in `[isOpen]` effect, and prevented cleanup of `[isOpen]` from invalidating component mount state.
  - *Status:* [x] RESOLVED

- [x] **CRIT-04: Ghost Callbacks from `onPlaybackFinished` After Teardown (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:328, 436, 545`
  - *Description:* When `teardown()` is invoked on modal close, `this.onPlaybackFinished` is not cleared. Stopping audio buffer sources triggers asynchronous browser `source.onended` events, which schedule a `drainTimer` and execute `this.onPlaybackFinished?.()` 600ms after teardown. This causes `VoiceModal` to re-enable recording and add dialogue turns on a destroyed session.
  - *Impact:* Phantom mic activation and React state mutations after modal is closed.
  - *Fix Applied:* Cleared `this.onPlaybackFinished = undefined` and cancelled `drainTimer` inside `teardown()`. Added defensive `if (!this.context || this.context.state === 'closed') return;` guards inside all `source.onended` handlers.
  - *Status:* [x] RESOLVED

---

### Category: HIGH
- [x] **HIGH-01: Uncancelled `drainTimer` in `playDecodedAudioBuffer` (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:275-307`
  - *Description:* `scheduleBufferOnTimeline` clears `this.drainTimer` when starting a new buffer, but `playDecodedAudioBuffer` omits this check.
  - *Fix Applied:* Added `if (this.drainTimer) { clearTimeout(this.drainTimer); this.drainTimer = null; }` at entry to `playDecodedAudioBuffer`.
  - *Status:* [x] RESOLVED

- [x] **HIGH-02: Unhandled In-Flight Async Fetch Operations on Modal Unmount (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:449, 1046, 1182, 1315, 1517, 2087, 2132`
  - *Description:* Async requests do not check if component is mounted or if `isOpen === true`, nor do they utilize `AbortController`.
  - *Fix Applied:* Added `activeAbortControllersRef` and `createManagedAbortSignal()`, guarding state updates and aborting operations on unmount.
  - *Status:* [x] RESOLVED

- [x] **HIGH-03: Client Barge-In Event Not Propagated Upstream to Gemini Live (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:2401-2408`, `VoiceTutorView.tsx:382-395`
  - *Description:* Local audio is silenced, but no signal is sent to backend WebSocket proxy to halt upstream streaming.
  - *Fix Applied:* Implemented `handleClientBargeIn()`, sending upstream `clientContent` barge-in frame over WebSocket.
  - *Status:* [x] RESOLVED

- [x] **HIGH-04: Upstream Tool Call Exception Handling & Raw Leakage (`geminiLiveProxy.ts`)** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:515-545`
  - *Description:* Unhandled error in `handleLiveToolCall` forwarded raw `toolCall` JSON frame to frontend client.
  - *Fix Applied:* Set `isToolCallProcessed = true` unconditionally and wrapped tool execution in try/catch with upstream error `toolResponse`.
  - *Status:* [x] RESOLVED

- [x] **HIGH-05: Fragile Markdown JSON Parsing in `/api/interview/turn` (`interviewTurn.ts`)** [RESOLVED]
  - *Location:* `interviewTurn.ts:287-293`
  - *Description:* `JSON.parse` crashes with 500 error if model returns markdown fences or extraneous text.
  - *Fix Applied:* Implemented 4-stage resilient `parseReasoningJson`.
  - *Status:* [x] RESOLVED

- [x] **HIGH-06: Untracked `reconnectTimer` Causing Background WebSocket Leak (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1067-1071`
  - *Description:* On WS drop with `< 3` resume attempts, `setTimeout(..., 500)` is invoked anonymously without a ref. Closing the modal during this 500ms window causes `connectLiveWebSocket` to run on an unmounted modal, opening an orphaned socket in the background.
  - *Impact:* Orphaned WebSocket connections and audio hardware streaming in background.
  - *Fix Applied:* Stored auto-resumption timer in tracked `reconnectTimerRef`, added explicit `clearTimeout` in `teardownWsAndBuffersOnly()`, and added `isMountedRef.current` guard before reconnecting.
  - *Status:* [x] RESOLVED

- [x] **HIGH-07: Unchecked Asynchronous Ticket Prefetch & Abort Gap in `connectLiveWebSocket` (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:758-775`
  - *Description:* `fetch('/api/auth/ws-ticket')` lacks `createManagedAbortSignal()` and does not check `if (!isMountedRef.current || !isOpen) return;` after awaiting the response. If the modal closes while prefetching the ticket, `new WebSocket(wsUrl)` is instantiated and attached to `wsRef.current` on an unmounted component.
  - *Impact:* Leaked WebSocket connection and background network activity after modal close.
  - *Fix Applied:* Wrapped ticket prefetch with `createManagedAbortSignal()`, and added an immediate unmount/closed check `if (!isMountedRef.current || !isOpen) return;` before calling `new WebSocket(wsUrl)`.
  - *Status:* [x] RESOLVED

- [x] **HIGH-08: Unmanaged Signal and Missing Mount Guard in Fallback Timeout (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:2294-2319`
  - *Description:* The 6.5s fallback watchdog timeout executes `fetch('/api/eval')` directly without `createManagedAbortSignal()` and without checking `isMountedRef.current`, triggering state updates on unmounted components.
  - *Impact:* React unmounted component warning and dangling network requests.
  - *Fix Applied:* Passed `createManagedAbortSignal()` to fallback `/api/eval` fetch and wrapped all state updates (`finalizeEvaluation`, `setIsSubmitting`) with `isMountedRef.current` guards.
  - *Status:* [x] RESOLVED

- [x] **HIGH-09: Lack of Full-Jitter Exponential Backoff on 429/503 in `/api/interview/turn` and `/greeting` (`interviewTurn.ts`)** [RESOLVED]
  - *Location:* `interviewTurn.ts:129-162, 314-350`
  - *Description:* Architectural Invariant 5 (Zero-Phantom-Fallback & Full-Jitter Backoff) mandates Full-Jitter Exponential Backoff retries on rate limits ($T = \text{random}(0, \min(2500, 800 \times 1.8^{\text{attempt}}))$) up to 2 retries. Currently, `/greeting` and `/turn` fail immediately with HTTP 500 on transient 429/503 errors. Additionally, TTS calls use unretried `synthesizeTTSBuffer` instead of `synthesizeTTSWithRetry`.
  - *Impact:* Unnecessary dialogue failures during transient LiteLLM gateway spikes or model switching.
  - *Fix Applied:* Implemented `fetchWithFullJitterRetry` in `interviewTurn.ts` applying the exact Full-Jitter backoff formula up to 2 retries on 429/502/503/504 errors, and switched TTS synthesis in both `/greeting` and `/turn` to `synthesizeTTSWithRetry`.
  - *Status:* [x] RESOLVED

---

### Category: MEDIUM
- [x] **MED-01: Cross-Turn Audio Buffer Contamination in AudioWorklet (`audio-capture-processor.js`)** [RESOLVED]
  - *Location:* `audio-capture-processor.js:21-22, 49, 66, 114-129`
  - *Description:* Up to 1023 un-emitted samples (<64ms) remain in `this.outputBuffer` when speech stops.
  - *Fix Applied:* Implemented `this.port.onmessage` handler for `RESET` and `FLUSH` events.
  - *Status:* [x] RESOLVED

- [x] **MED-02: Oscillator & Gain Node Leaks on Chimes in `AudioPlayoutManager.ts`** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:47-83, 88-121`
  - *Description:* Chime oscillators are not added to `activeSources` or tracked.
  - *Fix Applied:* Added `activeChimes` set tracking both oscillator and gain nodes.
  - *Status:* [x] RESOLVED

- [x] **MED-03: Unsafe Base64 Decoding without Error Trapping (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:259, 316`
  - *Description:* `atob(...)` is called directly without stripping whitespace/newlines or try/catch.
  - *Fix Applied:* Sanitized base64 string via whitespace removal and wrapped decoding in try/catch.
  - *Status:* [x] RESOLVED

- [x] **MED-04: Dead / Redundant Timer Variables in `geminiLiveProxy.ts`** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:71, 203, 223, 472-475, 685-692`
  - *Description:* Redundant `greetingWatchdog` declarations.
  - *Fix Applied:* Removed unused `greetingWatchdog` declarations and dead clearTimeout blocks.
  - *Status:* [x] RESOLVED

- [x] **MED-05: WebSocket `RawData` Buffer Fragmentation Crash Vulnerability (`geminiLiveProxy.ts`)** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:306, 560`
  - *Description:* Node.js `ws` `RawData` can arrive as `Buffer[]` for fragmented or large frames. Calling `Buffer.from(data as ArrayBuffer)` on `Buffer[]` produces corrupted data or throws. Safe `toBuffer` helper with `Buffer.concat` is required.
  - *Impact:* WebSocket parser crashes or audio/turn frame corruption on multi-chunk network packets.
  - *Fix Applied:* Implemented `toRawBuffer(data: RawData)` handling `Buffer`, `Buffer[]` (via `Buffer.concat`), and `ArrayBuffer`, and applied to both `geminiSocket` and `clientSocket` message handlers.
  - *Status:* [x] RESOLVED

- [x] **MED-06: Asynchronous Resumption Sync Gap on Cold Setup (`geminiLiveProxy.ts`)** [RESOLVED]
  - *Location:* `geminiLiveProxy.ts:585-600`
  - *Description:* If `setupComplete` from upstream Gemini Live arrives before the client's `resume_sync` frame (e.g. cold restart race), the model receives an empty history continuation. When `resume_sync` subsequently arrives, the memory is updated but the turns are never replayed to upstream Gemini Live, causing conversational amnesia.
  - *Impact:* Loss of multi-turn dialogue context during auto-resumption after network disconnect.
  - *Fix Applied:* Added check inside `resume_sync` handler: if `session.isSetupComplete` is already active, immediately replay the seeded turns to upstream `geminiSocket` so dialogue history is synchronized without amnesia.
  - *Status:* [x] RESOLVED

- [x] **MED-07: O(N) String Concatenation Jank on Large PCM Audio Buffers (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1381-1386, 2074-2077`
  - *Description:* Single-character loop string concatenation (`binary += String.fromCharCode(bytes[i])`) on 30-60s audio buffers (up to 2 million iterations) causes synchronous UI thread freezing (200-500ms) and heavy garbage collection.
  - *Impact:* Noticeable UI stutter when committing speech responses in manual or cascaded modes.
  - *Fix Applied:* Replaced all byte-by-byte loops with high-performance chunked `uint8ArrayToBase64` helper using 32KB subarrays and `String.fromCharCode.apply`, eliminating UI thread blocking and memory churning.
  - *Status:* [x] RESOLVED

- [x] **MED-08: Incomplete Keyboard Navigation for Voice Hold and Barge-In (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1770-1776`
  - *Description:* The UI tooltips advertise Space for pause/resume and Escape for stopping AI speech. However, `VoiceModal.tsx` only triggers Space when `isSessionPaused === true` (ignoring Space to pause), and lacks an `Escape` key listener for client Barge-in.
  - *Impact:* Broken keyboard shortcut UX and mismatch between UI labels and actual event listeners.
  - *Fix Applied:* Updated keyboard event listener to toggle pause/resume on Spacebar regardless of current hold state, and added Escape key handler triggering `handleClientBargeIn()` when AI is speaking.
  - *Status:* [x] RESOLVED

- [x] **MED-09: Pop/Click Artifacts on Abrupt Playout Mute Toggle (`AudioPlayoutManager.ts`)** [RESOLVED]
  - *Location:* `AudioPlayoutManager.ts:29-36`
  - *Description:* `setMuted()` instantly sets gain from 1.5 to 0.0 with `setValueAtTime`, causing an audible click/pop in headphones if toggled during active playback.
  - *Impact:* Acoustic pop/click in user headphones when toggling mute.
  - *Fix Applied:* Implemented 5ms smooth linear gain ramp `linearRampToValueAtTime(muted ? 0.0 : 1.5, now + 0.005)`.
  - *Status:* [x] RESOLVED

---

### Category: TECH_DEBT
- [x] **TECH-01: Loose Types & `any` Overuse Across Voice Modules** [RESOLVED]
- [x] **TECH-02: Parameter Validation & Guard Defaults in `/api/interview/greeting` & `/turn`** [RESOLVED]
- [x] **TECH-03: Asynchronous Permission Prompt Race Condition in `initMicrophoneHardware` (`VoiceModal.tsx`)** [RESOLVED]
  - *Location:* `VoiceModal.tsx:1854-1875`
  - *Description:* If user closes modal while browser permission prompt is active, `getUserMedia` completes after unmount and creates orphaned tracks and audio nodes. Must verify mount state after `getUserMedia` and `addModule` and stop tracks if closed.
  - *Impact:* Browser microphone recording indicator stays active after modal close.
  - *Fix Applied:* Added defensive checks `if (!isMountedRef.current || !isOpen)` right after `getUserMedia` and after `audioWorklet.addModule`, immediately stopping all stream tracks (`stream.getTracks().forEach(t => t.stop())`) to cleanly release microphone hardware.
  - *Status:* [x] RESOLVED
