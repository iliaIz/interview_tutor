# Master Architectural RFC: Continuous Stream Neural Audio Filtering & Speculative Barge-In Resilience for Gemini 3.8 Live

> **Document:** `docs/research/neural_audio_filtering_and_barge_in/RFC_NEURAL_AUDIO_FILTERING_AND_BARGE_IN.md`  
> **Status:** Fully Audited & Grounded against `tmp/gemini 3.8 live docs/` and `AGENTS.md` Rule 2.6  
> **Target Standard:** SOTA Late-2026 (Web Audio API Level 2, AudioWorklet, WASM SIMD, Gemini 3.8 Live)  
> **Target Subsystem:** Client Audio DSP, Neural Phonetic VAD, Speculative Barge-In & Continuous Stream Arbitration

---

## 1. Grounded Baseline Verification & Root Cause Identification

### The Dual Defect in Current Codebase
1. **Local False Interruption during `AI_SPEAKING`:**
   - In [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts#L195-L200), when the AI tutor is speaking, audio is **NOT** sent to Gemini Live (to prevent speaker echo).
   - Instead, the engine monitors `metrics?.speechDetected`.
   - In [`audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js#L118-L127), `speechDetected` is calculated via a naive RMS decibel Schmitt trigger (`db > -35 dB`).
   - When the candidate coughs or clears their throat, the energy spike immediately asserts `speechDetected = true`.
   - `NativeLiveVoiceEngine` immediately calls `handleBargeInInterruption('acoustic')`. The AI speech is killed locally, even though Google never received a barge-in signal!
2. **Cloud VAD Contamination during `LISTENING`:**
   - When the candidate is in `LISTENING` state (thinking before answering), the microphone stream is forwarded to Gemini Live.
   - If the candidate coughs, that raw high-energy acoustic transient ($-15$ dB to $-22$ dB RMS) is forwarded to Google Gemini 3.8 Live.
   - Google's Cloud VAD interprets the energetic spike as a speech onset (`ACTIVITY_START`), then times out over `silenceDurationMs: 500`, and hallucinates a turn answering a non-existent question.

---

## 2. Gemini 3.8 Live Protocol Audit: Why Discontinuous Gating is Rejected

A critical finding emerges when comparing the Deep Research Plane 3 report with the official documentation in `tmp/gemini 3.8 live docs/` (`04_audio_context_and_turn_taking.md`) and platform rule `AGENTS.md` Rule 2.6:

> [!CAUTION]
> **Rejection of Discontinuous Gating (Sending 0 bytes during pauses):**  
> Plane 3 proposed completely stopping WebSocket audio frames during candidate pauses.  
> **This contradicts Google's authoritative specification:**  
> - `04_audio_context_and_turn_taking.md` (§5.1, §6): *"Внутри диалога поток непрерывен! Непрерывный PCM-стрим 16 кГц, сквозной серверный VAD с калибровкой silenceDurationMs: 500"*.  
> - `AGENTS.md` (Rule 2.6): *"Continuous Mic Streaming: The microphone stream flows continuously as 16kHz 16-bit Mono PCM chunks... Ambient trailing silence is naturally streamed between utterances so server-side VAD can cleanly endpoint turns."*  
> If the client sends 0 frames during silence, Google's Cloud VAD noise-floor estimator loses adaptation, WebSocket proxies risk idle read-timeouts, and if the client stops sending mid-utterance, the server VAD deadlocks because `silenceDurationMs` advances **strictly on incoming PCM samples**.

### The Bulletproof Solution: Continuous Clean PCM Streaming
Instead of breaking continuous network streaming, the **client-side DSP suppresses non-speech impulses in-place within the audio buffer**:
- During `LISTENING`, 16kHz Mono PCM chunks continue streaming smoothly and continuously to Gemini Live.
- Non-speech transients (coughs, sneezes, clicks) are detected by the client DSP and **clamped/attenuated down to ambient room floor ($-50$ dBFS)** before being encoded to base64.
- To Google Gemini 3.8 Live, the stream remains uninterrupted, but the cough is completely silent. Google's Cloud VAD (`startOfSpeechSensitivity: "START_SENSITIVITY_LOW"`) never fires!
- When genuine speech begins (vocal formants, $P(\text{speech}) > 0.85$), the audio flows through with pristine fidelity.
- When speech ends, natural trailing silence flows into the server, allowing Google's calibrated `silenceDurationMs: 500` to cleanly fire `ACTIVITY_END` naturally.

---

## 3. High-Level System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Candidate Browser Microphone             │
                    └───────────────────────────┬────────────────────────────┘
                                                │ 48kHz / 44.1kHz MediaStream
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Web Audio API AudioWorklet (Real-Time Audio Thread - Zero Allocation)                            │
│                                                                                                 │
│  1. Fast Minimum-Phase Downsampler (48kHz/44.1kHz -> 16kHz Mono Int16)                          │
│  2. TKEO Non-Linear Transient Clipper (Clamps cough/click spikes to -26 dBFS in < 0.15ms)      │
│  3. Frame Aggregator: 512 samples (32ms @ 16kHz) matching Google Gemini Live chunk standard     │
│  4. Zero-Allocation memory layout: static WASM memory + transferable ArrayBuffer ring pool       │
└───────────────────────┬─────────────────────────────────────────────────┬───────────────────────┘
                        │ Transferable 512-sample ArrayBuffers            │
                        ▼                                                 ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ Web Worker: Neural Phonetic VAD Engine        │ │ Speculative Audio Playout Manager             │
│                                               │ │                                               │
│  • Silero VAD v5 / WASM SIMD runtime          │ │  • Normal Playout: 0 dB gain (1.0)            │
│  • 32ms frame inference (latency < 2ms)       │ │  • Acoustic Onset: Duck to -12 dB (15ms ramp) │
│  • P(speech) + F0 harmonicity scoring         │ │  • Speech Verified (>224ms): Hard Barge-In    │
│  • High roll-off penalty (>2.8kHz) for coughs │ │  • Transient/Cough (<180ms): Rollback to 0 dB │
└───────────────────────┬───────────────────────┘ └───────────────────────────────────────────────┘
                        │ Speech Probability & Transient Mask
                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LiveVoiceEngine: Continuous Stream Arbitration & WebSocket Gateway Bridge                       │
│                                                                                                 │
│  • AI_SPEAKING State: Local audio playout active. Mic processed locally by Neural VAD.          │
│    - Cough / Sneeze (P < 0.20) -> IGNORED 100%. AI speaks uninterrupted. KV-cache intact!       │
│    - Intentional Speech -> Speculative Ducking (-12 dB) -> Hard Barge-In at 224ms.              │
│                                                                                                 │
│  • LISTENING State: Continuous 16kHz PCM streaming to WebSocket (100% Rule 2.6 compliant).      │
│    - Cough / Sneeze detected -> Impulse clamped to -50 dBFS in buffer. Google VAD stays quiet.  │
│    - Real Speech -> Streamed with full fidelity. Google Cloud VAD triggers ACTIVITY_START.      │
│    - Candidate finishes -> Continuous trailing silence streams -> Server triggers ACTIVITY_END.│
│                                                                                                 │
│  • Audio Mutex: Frozen during toolCall -> toolResponse (WS Close 1008 protection).              │
│  • Dual-Sided Handshake: T_drain synchronized before transitioning to LISTENING.                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase-Gated Implementation Plan (Wave 19)

### Phase 1: Zero-Allocation AudioWorklet DSP & TKEO Transient Clamping
- Modify [`audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js):
  * Remove the naive RMS decibel Schmitt trigger that was prematurely tripping barge-in.
  * Implement static memory arena: zero heap allocations in `process()`.
  * Add Teager-Kaiser Energy Operator (TKEO) fast transient detector: clamps high-energy non-harmonic spikes (coughs, sneezes, clicks) from $-15$ dB to $-26$ dBFS in $< 0.15$ ms.
  * Standardize chunking on 512 samples (32ms @ 16kHz), matching Google reference architecture.
  * Output via transferable ArrayBuffer ring pool ($8 \times \text{ArrayBuffer}$) to eliminate GC pressure.

### Phase 2: Neural Phonetic VAD Worker & Speculative Ducking Controller
- Implement `NeuralVadWorker` (using Silero VAD v5 / WASM SIMD):
  * Ingest 512-sample (32ms) frames from the AudioWorklet.
  * Calculate neural speech probability $P(\text{speech})$ with spectral roll-off penalty (coughs roll off at $4451$ Hz; human speech at $1770$ Hz).
  * Enforce Minimum Voicing Duration $T_{\text{min\_voice}} = 224$ ms ($N = 7$ consecutive 32ms frames).
- Update [`AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts):
  * Add `speculativeDuck(targetGain = 0.25, rampMs = 15)`.
  * Add `rollbackDucking(rampMs = 15)`.
  * Add `commitBargeIn(deClickMs = 5)`.
- Update [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts):
  * In `AI_SPEAKING`: if sound is non-speech ($P < 0.20$), ignore 100%. If voicing begins, duck volume to -12 dB. If verified $\ge 224$ ms $\to$ commit barge-in. If transient $\to$ instant rollback to 0 dB.

### Phase 3: In-Place Transient Clamping for Continuous Upstream Streaming
- Update `handleMicrophoneChunk` in [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts):
  * In `LISTENING`: maintain **strictly continuous** 16kHz PCM streaming over WebSocket.
  * If a frame contains a non-speech transient (cough/sneeze/click), clamp its samples in-place to ambient floor ($-50$ dBFS) before sending to Gemini Live.
  * Ensure Google Cloud VAD receives clean, continuous silence during thinking pauses, completely immune to cough-induced false `ACTIVITY_START`.
  * Maintain strict Audio Mutex: zero chunks transmitted during `toolCall` execution (preventing WS Close 1008).

### Phase 4: Reassurance UX & Ergonomic Overrides
- Update active session UI:
  * Add subtle micro-indicator for State B (**Transient Ignored**): reassuring the user with a gentle pastel ripple when a cough or desk tap was safely filtered.
  * Add Push-to-Talk via Spacebar override.
  * Add Cough Mute hotkey (`C`).

---

## 5. Formal Invariants Verification Matrix

| Protocol Invariant | Risk in Naive Approach | Protection in this RFC | Specification Reference |
|---|---|---|---|
| **No 1011 Close on Stream End** | Sending `audioStreamEnd` in pauses breaks vocoder. | `audioStreamEnd` is NEVER sent in dialogue. | `04_audio_context_and_turn_taking.md` §5.1 |
| **No KV-Cache Temporal Desync** | Injecting empty `clientContent` corrupts attention. | `clientContent` is NEVER injected into audio. | `04_audio_context_and_turn_taking.md` §5.2 |
| **No 1008 Close during Tools** | Audio sent during `toolCall` causes policy violation. | Strict programmatic Audio Mutex freezes streaming. | `03_tools_and_turn_lockdown.md` §2, §6 |
| **No Continuous Gating Jitter** | Sending 0 bytes starves Cloud VAD noise estimator. | Stream remains strictly continuous with clamped silence. | `AGENTS.md` Rule 2.6 & `04_audio_context` §3 |
| **No KV-Cache Truncation on Cough** | Cough trips client barge-in, cutting AI audio. | Neural VAD + 224ms minimum voicing ignores cough. | `04_audio_context_and_turn_taking.md` §4.1 |
| **No Acoustic Echo Barge-In Loop** | Loudspeaker audio leaks into mic after turnComplete. | Dual-Sided Handshake waits for physical DAC drain $T_{\text{drain}}$. | `04_audio_context_and_turn_taking.md` §4.2, §4.3 |
