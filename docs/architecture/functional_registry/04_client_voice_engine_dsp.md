# 04. Client Voice Engine & Audio DSP

> **Location:** `docs/architecture/functional_registry/04_client_voice_engine_dsp.md`  
> **Subsystem (Level 1):** Client Voice Engine & Audio DSP  
> **Primary Files:** [`frontend/src/utils/audio/LiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/LiveVoiceEngine.ts), [`frontend/src/utils/audio/AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/AudioPlayoutManager.ts), [`frontend/src/utils/audio/LiveVoiceStateMachine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/utils/audio/LiveVoiceStateMachine.ts)

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
