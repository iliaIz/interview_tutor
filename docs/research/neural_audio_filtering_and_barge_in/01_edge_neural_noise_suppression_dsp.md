# Deep Research Plane 1: Edge Audio DSP & Neural Noise Suppression in Web Audio Worklets (Late 2026 SOTA)

> **File:** `01_edge_neural_noise_suppression_dsp.md`  
> **Target Subsystem:** Client-Side Audio Pipeline & Web Audio Worklet  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/01_edge_neural_noise_suppression_dsp_report.md`  
> **Integration Context:** Google Gemini 3.8 Live PCM Stream (16kHz 16-bit Mono, 32ms–100ms frames)

---

## Deep Research Prompt

```markdown
Role: Principal Web Audio DSP & Real-Time Machine Learning Systems Engineer (State-of-the-Art Late 2026).

Context:
We operate a high-stakes, full-duplex conversational voice tutoring and technical mock interview platform pairing candidates with Google Gemini 3.8 Live over WebSockets. Audio capture executes in browser clients across desktop and mobile devices at 16kHz 16-bit Mono PCM. Currently, loud non-speech impulse transients (sneezing, coughing, throat clearing, breathing into the microphone, mechanical keyboard clicks, and desk thumps) produce amplitude spikes (-15 dB to -22 dB RMS) that cause accidental acoustic barge-in interruptions of the AI tutor and contaminate the upstream cloud model's real-time audio pipeline.
CRITICAL CONSTRAINT: The upstream Gemini 3.8 Live protocol is immutable. We must NEVER break the WebSocket session, violate audio format rules (raw 16kHz 16-bit Mono Little-Endian PCM), or introduce latency exceeding 15ms.

Inquiry & Technical Scope:

1. State-of-the-Art Edge Neural Speech Enhancement in WebAssembly (Late 2026):
   - What are the emergent SOTA paradigms (as of late 2026) for real-time edge neural noise suppression and speech enhancement executing inside Web Audio API AudioWorklets via WebAssembly (WASM SIMD)?
   - Compare leading open-source and commercial production-grade architectures:
     * DeepFilterNet (v2 / v3)
     * RNNoise (including modern modernized retrained checkpoints)
     * DTLN (Dual-Signal Transformation LSTM Network)
     * WebRTC Audio Processing Module (APM) compiled to WASM
     * Modern lightweight ONNX Runtime Web speech enhancement models
   - Provide concrete empirical benchmarks regarding:
     * Inference latency per 32ms frame (512 samples @ 16kHz, matching Google Gemini Live best practices) on commodity laptops and mobile devices (Android Chrome, iOS Safari).
     * CPU thread utilization and zero-allocation memory patterns within the real-time AudioWorklet audio rendering thread (`process()` loop).
     * Objective speech quality metrics (PESQ, STOI, DNSMOS) specifically when isolating human speech from vegetative impulsive sounds (coughs, sneezes, yawns, heavy breathing, plosives).

2. Optimal Web Audio Graph Topology & Browser AEC Interaction:
   - What is the mathematically optimal Web Audio pipeline topology from `navigator.mediaDevices.getUserMedia` through the AudioWorklet to the WebSocket uplink?
   - How should hardware/browser constraints (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`) interact with downstream neural edge suppression? 
   - Does browser native `noiseSuppression` degrade the spectral features needed by downstream neural models, or should native `noiseSuppression` be disabled in favor of dedicated neural enhancement?
   - What circular ring buffer and quantum boundary management patterns guarantee zero sample drops, zero phase distortion, and total acoustic path latency under 15ms?

3. Resampling, Quantum Alignment & Allocation-Free Processing:
   - Web Audio `process()` operates on 128-sample quanta at native hardware rates (usually 44.1kHz or 48kHz). When downsampling to 16kHz Mono PCM for Gemini 3.8 Live:
     * What is the most efficient, phase-linear, click-free downsampling algorithm inside an AudioWorklet without heap allocations?
     * How to cleanly package 512-sample (32ms) or 1600-sample (100ms) chunks across 128-sample render quanta without introducing buffer jitter?
   - How can zero-copy SharedArrayBuffer or transferable ArrayBuffer techniques be safely leveraged across AudioWorklet, Web Worker, and main thread boundaries without violating browser security policies (COOP/COEP)?

4. Failure Modes & Edge Cases:
   - How do neural noise suppression models behave in low SNR environments (whispering candidate, distant microphone)?
   - How to prevent "musical noise" artifacts, spectral gating chirps, or speech clipping on word onsets (leading unvoiced fricatives /s/, /f/, /sh/, /tʃ/)?

Deliverable Requirements:
Provide an exhaustive, evidence-based architectural report with exact mathematical formulas, WASM pipeline schematics, audio processing lifecycle diagrams, empirical latency budgets, and concrete TypeScript/C++ implementation guidelines.
```
