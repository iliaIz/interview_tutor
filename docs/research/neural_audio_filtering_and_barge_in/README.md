# SOTA Late-2026 Neural Audio Filtering & Barge-In Resilience

> **Location:** `docs/research/neural_audio_filtering_and_barge_in/README.md`  
> **Status:** Research Inquiry Battery Dispatched  
> **Target Standard:** SOTA Late 2026 (Web Audio API, AudioWorklets, ONNX Runtime Web, Gemini 3.8 Live)  
> **Target Subsystem:** Client Audio DSP, Neural Phonetic VAD, Stream Arbitration & Barge-In Floor Control

---

## 1. Executive Summary & Problem Charter

In full-duplex conversational voice tutoring and technical mock interviews, false acoustic barge-in is the single largest point of user friction:
- **Impulsive Acoustic Transients:** Coughing, sneezing, throat clearing, breathing into the microphone, mechanical keyboard clicks, and desk thumps trigger accidental interruptions of the AI while it is speaking.
- **Root Cause Identified:** The current client AudioWorklet uses an **amplitude/energy-only Schmitt trigger (RMS in decibels)**. Any sound louder than ~-35 dB asserts `speechDetected = true` on the very first 100ms chunk, immediately cutting off AI audio playback via `handleBargeInInterruption('acoustic')`.
- **Cloud VAD Contamination:** During the candidate's turn, raw impulsive noises (coughs, sneezes) flow unfiltered into Google Gemini Live, triggering accidental Cloud VAD activity, hallucinated non-speech transcriptions, and premature model generation.

---

## 2. Orthogonal Deep Research Battery

This research battery is organized into four orthogonal, unanchored planes under the Multi-Faceted Research-Driven Architecture (MFRDA) methodology:

| Plane | Document | Core Focus |
|---|---|---|
| **Plane 1** | [`01_edge_neural_noise_suppression_dsp.md`](./01_edge_neural_noise_suppression_dsp.md) | **Edge Neural Noise Suppression:** DeepFilterNet, RNNoise, DTLN in Web Audio Worklets via WASM SIMD. |
| **Plane 2** | [`02_neural_phonetic_vad_and_barge_in.md`](./02_neural_phonetic_vad_and_barge_in.md) | **Neural Phonetic VAD:** Silero VAD v5 / Ten-VAD, paralinguistic transient rejection, minimum voicing duration. |
| **Plane 3** | [`03_gemini_live_stream_arbitration_and_gating.md`](./03_gemini_live_stream_arbitration_and_gating.md) | **Gemini Live Protocol Arbitration:** Continuous vs gated streaming, pre-speech ring buffering, `activityHandling`. |
| **Plane 4** | [`04_conversational_turn_taking_and_pedagogical_ux.md`](./04_conversational_turn_taking_and_pedagogical_ux.md) | **Pedagogical Floor Control & UX:** Backchanneling ("угу", "да") vs intentional interruption, visual feedback. |

---

## 3. Workflow for Completed Reports

1. Copy each research prompt from its respective file (`01_...` to `04_...`).
2. Run in Deep Research / LLM research environment.
3. Save finalized comprehensive reports into `docs/research/neural_audio_filtering_and_barge_in/reports/`.
4. Proceed to architectural synthesis, RFC formulation, and phased implementation in Wave 19.
