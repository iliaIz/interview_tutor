# Voice & Dialogue Stack Technical Debt Ledger (SOTA 2026 Audit)

**Audit Target Scope:**
1. `frontend/src/components/VoiceModal.tsx` (Client Dialogue State Machine)
2. `frontend/src/components/voice/VoiceTutorView.tsx` (Tutor UI & Ergonomics)
3. `frontend/src/services/AudioPlayoutManager.ts` (Web Audio, PCM Buffering, De-click)
4. `frontend/public/worklets/audio-capture-processor.js` (AudioWorklet, Dynamic VAD)
5. `backend/src/services/geminiLiveProxy.ts` (WebSocket Gateway & Bi-directional Stream)
6. `backend/src/routes/interviewTurn.ts` (REST Turns & TTS Synthesis)

**Audit Date:** 2026-09-03  
**Status:** Completed (All CRITICAL, HIGH, MEDIUM, and TECH_DEBT issues RESOLVED)

---

## 📋 Defect Registry

### Category: CRITICAL
- [x] **CRIT-01: `teardown()` vs `handleInterruption()` Race Condition Leaking Audio Nodes (`AudioPlayoutManager.ts`)**
  - *Location:* `AudioPlayoutManager.ts:523-547, 558-563`
  - *Description:* When `teardown()` is invoked, it calls `handleInterruption()`. `handleInterruption()` empties `activeSources` into `sourcesToStop` and schedules a delayed `setTimeout(..., 7ms)` to stop and disconnect them. However, `teardown()` immediately cancels `interruptionTimer`! Consequently, `sourcesToStop` is never stopped and never disconnected, leaving active AudioBufferSourceNodes dangling in memory.
  - *Impact:* Audio node memory leak and lingering sound buffers on modal close.
  - *Status:* [x] RESOLVED (Added pendingInterruptionSources, Web Audio timeline stop(now + fadeDurationSec), synchronous clearQueue and teardown cleanup)

---

## 📋 Defect Registry

### Category: HIGH
- [x] **HIGH-01: AbortSignal Reuse Failure on Retries in `fetchWithFullJitterRetry` (`interviewTurn.ts`)**
  - *Location:* `interviewTurn.ts:28-61, 168-180, 353-367`
  - *Description:* `fetchWithFullJitterRetry` accepts `options: RequestInit`. The callsites supply `signal: AbortSignal.timeout(45_000)`. If attempt 0 times out or aborts, `options.signal.aborted` remains `true`. On retry attempts 1 and 2, `fetch(url, options)` is executed with an already-aborted signal, causing all retries to fail instantly with `AbortError` without issuing network requests.
  - *Impact:* Full-Jitter retry mechanism completely breaks on transient timeout spikes.
  - *Status:* [x] RESOLVED (Per-attempt fresh AbortSignal.timeout combined with parentSignal via AbortSignal.any)

- [x] **HIGH-02: Missing Request Abort Propagation from Client to LiteLLM / TTS (`interviewTurn.ts`)**
  - *Location:* `interviewTurn.ts:168, 353`
  - *Description:* Client cancellation (`req.signal` or connection close when modal is closed or user interrupts) is not chained into the LiteLLM fetch calls or TTS synthesis. The backend continues burning tokens and compute after the client has disconnected.
  - *Impact:* Token waste and unnecessary backend CPU/network utilization on cancelled turns.
  - *Status:* [x] RESOLVED (Chained req.signal into LiteLLM fetch calls, added pre-TTS abort check returning 499 on cancellation)

- [x] **HIGH-03: Missing Re-entrancy Guard & Unchecked Socket Error Propagation in `geminiLiveProxy.ts`**
  - *Location:* `geminiLiveProxy.ts:715-754`
  - *Description:* In `terminate()`, closing `clientSocket` triggers `geminiSocket.close()`, which in turn triggers `geminiSocket.on('close')`, re-entering `terminate()`. Without an `isTerminated` guard, `terminate` executes multiple times, potentially committing duplicate turn history to session memory. Furthermore, `clientSocket.send` inside `geminiSocket.on('error')` is not wrapped in try/catch, risking uncaught exceptions on closed sockets.
  - *Impact:* Duplicate turns in session memory and potential unhandled exceptions during upstream proxy errors.
  - *Status:* [x] RESOLVED (Added isTerminated guard, wrapped socket closes and clientSocket.send error forwarding in try/catch)

- [x] **HIGH-04: Unawaited `applyKnowledgeDecay` Causing Perpetual `knowledgeUpdate: null` in Live Audio Tooling (`liveToolDispatcher.ts`)**
  - *Location:* `liveToolDispatcher.ts:123-145, 240-305`
  - *Description:* In both `mark_bug_solved` and `submit_interview_evaluation`, `applyKnowledgeDecay` is called with `void applyKnowledgeDecay(...).then(res => decayResult = res)`. Immediately following this, `clientSocket.send` sends `{ knowledgeUpdate: decayResult }`. Since the promise is not awaited, `decayResult` is always `null` at transmission time.
  - *Impact:* Frontend never receives live vector memory/knowledge decay updates in Live Audio and Bug Hunt sessions.
  - *Status:* [x] RESOLVED (Awaited applyKnowledgeDecay in both mark_bug_solved and submit_interview_evaluation so knowledgeUpdate sends valid decay data)

---

### Category: MEDIUM
- [x] **MED-01: Frozen State Machine on WebSocket Upstream Errors in `VoiceModal.tsx`**
  - *Location:* `VoiceModal.tsx:962-964`
  - *Description:* When `data.error` arrives from the WebSocket proxy, `VoiceModal` logs the error message to `dialogueTurns`, but fails to reset `isThinking`, `isThinkingRef.current`, `isAiSpeaking`, or `isAiSpeakingRef.current`. The UI orb remains permanently stuck in a thinking or speaking state and user microphone is never re-enabled.
  - *Impact:* UI state lockup on any upstream gateway error.
  - *Status:* [x] RESOLVED (Reset isThinking, isThinkingRef, thinkingStage, isAiSpeaking, isAiSpeakingRef, isSubmitting, and unlocked isRecording on data.error)

- [x] **MED-02: Missing SpeechRecognition Cleanup on Modal Close & Unhandled End State (`VoiceModal.tsx`)**
  - *Location:* `VoiceModal.tsx:380-431, 726-734`
  - *Description:* `speechRecognitionRef.current` is not stopped during `teardownWsAndBuffersOnly()` or `stopMicrophone()`. If the modal is closed while recording is active, SpeechRecognition can remain running in the background. In addition, `recognition.onend` is unhandled, causing stale references if the browser terminates recognition automatically.
  - *Impact:* Lingering background speech recognition and browser audio indicator retention.
  - *Status:* [x] RESOLVED (Added recognition.onend handler to nullify reference, added explicit speechRecognition.stop cleanup in teardownWsAndBuffersOnly)

- [x] **MED-03: Quantum Boundary Linear Interpolation Distortion in Resampler (`audio-capture-processor.js`)**
  - *Location:* `audio-capture-processor.js:71-90`
  - *Description:* In the resampling loop, `s0` and `s1` clamp to `inputChannel[inputLength - 1]` at the boundary of each 128-sample quantum instead of correctly interpolating across quanta with `this.prevSample`. This causes a step discontinuity every 2.6ms (375 Hz harmonic buzz) when downsampling 48kHz input to 16kHz PCM.
  - *Impact:* Subtle acoustic buzz/distortion in candidate speech sent to Gemini Live and STT.
  - *Status:* [x] RESOLVED (Continuous boundary interpolation using this.prevSample across quanta with zero clamping)

---

### Category: TECH_DEBT
- [x] **TECH-01: Loose Types and `any` Casts in Voice Modules (`interviewTurn.ts`, `VoiceTutorView.tsx`, `VoiceModal.tsx`)**
  - *Location:* `interviewTurn.ts:20, 63`, `VoiceTutorView.tsx:129`, `VoiceModal.tsx:268`
  - *Description:* Overuse of `any` in function signatures and props prevents compiler-level type safety.
  - *Status:* [x] RESOLVED (Added strong typing for sanitizeVoice, TurnReasoningResult, ReactMarkdown code component props, and SpeechRecognition instance interface)
