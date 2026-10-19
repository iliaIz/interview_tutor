# Deep Research Plane 1: Edge Audio DSP & Neural Noise Suppression in Web Audio Worklets (Late 2026 SOTA)

> **File:** `01_edge_neural_noise_suppression_dsp.md`  
> **Target Subsystem:** Client-Side Audio Pipeline & Web Audio Worklet  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/01_edge_neural_noise_suppression_dsp_report.md`

---

## Deep Research Prompt

```markdown
Role: Principal Web Audio DSP & Real-Time Machine Learning Engineer (State-of-the-Art Late 2026).

Context:
We operate a high-stakes, full-duplex conversational voice tutoring and technical mock interview platform (pairing candidates with Google Gemini 3.8 Live over WebSockets). Audio capture runs in browser clients across desktop and mobile devices at 16kHz 16-bit Mono PCM. Currently, loud non-speech impulse transients (sneezing, coughing, throat clearing, breathing into the microphone, mechanical keyboard clicks, and desk thumps) produce amplitude spikes (-15 dB to -22 dB RMS) that cause accidental acoustic barge-in interruptions of the AI and contaminate the upstream cloud model's real-time audio pipeline.

Inquiry & Technical Scope:

1. State-of-the-Art Edge Neural Speech Enhancement in WebAssembly (Late 2026):
   - What are the emergent SOTA paradigms (as of late 2026) for real-time edge neural noise suppression and speech enhancement executing inside Web Audio API AudioWorklets via WebAssembly (WASM SIMD)?
   - Compare leading open-source and commercial production-grade architectures:
     * DeepFilterNet (v2 / v3)
     * RNNoise (including modern modernized retrained checkpoints)
     * DTLN (Dual-Signal Transformation LSTM Network)
     * WebRTC Audio Processing Module (APM) in WASM
     * Modern lightweight ONNX Runtime Web speech enhancement models
   - Provide concrete empirical benchmarks regarding:
     * Inference latency per 10ms–32ms frame on commodity laptops and mobile devices (Android Chrome, iOS Safari).
     * CPU thread utilization and memory allocation patterns within the real-time AudioWorklet audio rendering thread.
     * Objective speech quality metrics (PESQ, STOI, DNSMOS) specifically when isolating human speech from vegetative impulsive sounds (coughs, sneezes, yawns, heavy breathing, plosives).

2. Optimal Web Audio Graph Topology:
   - What is the mathematically optimal Web Audio pipeline topology from `navigator.mediaDevices.getUserMedia` through the AudioWorklet to the WebSocket uplink?
   - How should hardware constraints (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`) interact with downstream neural edge suppression? Does browser hardware preprocessing harm or assist downstream neural enhancement?
   - What ring buffer and quantum boundary management patterns guarantee zero sample drops, zero phase distortion, and total acoustic path latency under 15ms?

3. Resampling & Format Invariants:
   - When host hardware operates at 44.1kHz or 48kHz, what is the most efficient, phase-linear, click-free downsampling approach to 16kHz Mono PCM within an AudioWorklet?
   - How can zero-copy SharedArrayBuffer or transferable ArrayBuffer techniques be safely leveraged across AudioWorklet, Web Worker, and main thread boundaries without violating browser security policies (Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy)?

4. Failure Modes & Edge Cases:
   - How do neural noise suppression models behave during low SNR environments (whispering candidate, distant microphone)?
   - How to prevent "musical noise" artifacts or speech clipping on word onsets (leading unvoiced fricatives /s/, /f/, /sh/)?

Deliverable Requirements:
Provide an exhaustive, evidence-based architectural report with exact mathematical formulas, WASM pipeline schematics, audio processing lifecycle diagrams, empirical latency budgets, and concrete TypeScript/C++ implementation guidelines.
```
