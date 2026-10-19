# SOTA Late-2026 Neural Audio Filtering & Barge-In Resilience

> **Location:** `docs/research/neural_audio_filtering_and_barge_in/README.md`  
> **Status:** Research Inquiry Battery Dispatched (Audited against Gemini 3.8 Live Docs)  
> **Target Standard:** SOTA Late 2026 (Web Audio API, AudioWorklets, ONNX Runtime Web, Gemini 3.8 Live)  
> **Target Subsystem:** Client Audio DSP, Neural Phonetic VAD, Pre-Socket Gating & Speculative Barge-In Floor Control

---

## 1. Executive Summary & Problem Charter

In full-duplex conversational voice tutoring and technical mock interviews, accidental acoustic barge-in is the single most severe UX defect:
- **Impulsive Acoustic Transients:** Coughing, sneezing, throat clearing, breathing into the microphone, mechanical keyboard clicks, and desk thumps trigger accidental interruptions of the AI tutor while it is explaining concepts.
- **Root Cause Verified in Codebase:** The client AudioWorklet ([audio-capture-processor.js](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js)) uses an **amplitude/energy-only Schmitt trigger (RMS in decibels)**. Any sound louder than ~-35 dB asserts `speechDetected = true` on the very first 100ms chunk. In [NativeLiveVoiceEngine.ts](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts#L195-L200), this immediately cuts off AI audio playback via `handleBargeInInterruption('acoustic')`.
- **Cloud VAD Contamination:** During the candidate's turn (`LISTENING`), raw impulsive noises (coughs, sneezes) flow unfiltered into Google Gemini 3.8 Live, triggering accidental Cloud VAD activity (`ACTIVITY_START`), hallucinated non-speech transcriptions, and premature model generation.

---

## 2. Gemini 3.8 Live Protocol Invariants: What Can vs What MUST NOT Be Changed

Based on strict auditing of official Google reference implementations (`tmp/gemini 3.8 live docs/`):

### 🔴 STRICTLY FORBIDDEN PROTOCOL ANTI-PATTERNS (Will Break the Dialogue):
1. **NEVER send `audioStreamEnd: true` in `realtimeInput` during dialogue (§5.1):**
   - The signal `audioStreamEnd: true` is strictly reserved for physical Mute or session Hangup.
   - Sending it upon local silence/pause destroys the streaming context and triggers **`WebSocket Close 1011 (Failed to close streaming context)`**.
2. **NEVER inject empty `{ clientContent: { turnComplete: true } }` into an active audio stream (§5.2):**
   - Attempting to accelerate turn completion via empty `clientContent` corrupts the KV-cache temporal indices. The model goes deaf and stops responding.
3. **NEVER transmit microphone audio during tool execution (§5.3):**
   - Violating the audio mutex between `toolCall` and `toolResponse` causes **`WebSocket Close 1008 Policy Violation: Operation is not implemented`**.
4. **NEVER alter the audio stream format (§6):**
   - The audio stream MUST remain raw linear 16kHz mono 16-bit Little-Endian PCM in base64. No WAV headers or compressed codecs.

### 🟢 PERMITTED & RECOMMENDED REFACTORING ZONE (Safe & High Impact):
1. **Pre-Socket Client DSP (Web Audio AudioWorklet + WebAssembly):**
   - Replace the naive RMS dB Schmitt trigger in `audio-capture-processor.js` with neural phonetic VAD (**Silero VAD v5**).
   - Human speech has $P(\text{speech}) > 0.85$ across multiple 32ms frames; coughs/sneezes have $P(\text{speech}) < 0.20$.
2. **Speculative Audio Ducking & Temporal Hysteresis ($T_{\text{min\_voice}} \ge 250\text{--}350$ ms):**
   - When a sound occurs during AI speech, soft-attenuate playback by -12 dB. If phonetic speech is confirmed over 250ms $\to$ execute clean barge-in. If transient cough $\to$ restore volume to 0 dB in 15ms. AI speech is never cut off on a sneeze!
3. **Pre-Speech Ring Buffer (200ms) during Candidate Turn:**
   - In `LISTENING` state, gate microphone transmission so ambient noise and coughs never reach Gemini's Cloud VAD. Once candidate phonates verified speech, flush 200ms of buffered audio and stream continuously.
4. **Cloud VAD Setup Calibration (`setup.realtimeInputConfig`):**
   - Maintain `startOfSpeechSensitivity: "START_SENSITIVITY_LOW"`, `silenceDurationMs: 500`, and `turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY"`.

---

## 3. Orthogonal Deep Research Battery

This research battery is organized into four orthogonal, unanchored planes under the Multi-Faceted Research-Driven Architecture (MFRDA) methodology:

| Plane | Document | Core Focus |
|---|---|---|
| **Plane 1** | [`01_edge_neural_noise_suppression_dsp.md`](./01_edge_neural_noise_suppression_dsp.md) | **Edge Neural Noise Suppression:** DeepFilterNet, RNNoise, DTLN in Web Audio Worklets via WASM SIMD (512 samples / 32ms @ 16kHz). |
| **Plane 2** | [`02_neural_phonetic_vad_and_barge_in.md`](./02_neural_phonetic_vad_and_barge_in.md) | **Neural Phonetic VAD:** Silero VAD v5 / Ten-VAD, paralinguistic transient rejection, speculative ducking (-12 dB) and temporal hysteresis. |
| **Plane 3** | [`03_gemini_live_stream_arbitration_and_gating.md`](./03_gemini_live_stream_arbitration_and_gating.md) | **Gemini Live Protocol Arbitration:** Pre-speech ring buffering (200ms), gated vs continuous streaming, Cloud VAD compliance without breaking socket invariants. |
| **Plane 4** | [`04_conversational_turn_taking_and_pedagogical_ux.md`](./04_conversational_turn_taking_and_pedagogical_ux.md) | **Pedagogical Floor Control & UX:** Backchanneling ("угу", "да") vs intentional interruption, visual feedback for ignored coughs/transients. |

---

## 4. Workflow for Completed Reports

1. Copy each research prompt from its respective file (`01_...` to `04_...`).
2. Run in Deep Research / LLM research environment.
3. Save finalized comprehensive reports into `docs/research/neural_audio_filtering_and_barge_in/reports/`.
4. Proceed to architectural synthesis, RFC formulation, and phased implementation in Wave 19.
