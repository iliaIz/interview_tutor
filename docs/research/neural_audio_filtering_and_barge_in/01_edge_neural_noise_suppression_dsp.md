# Deep Research Plane 1: Edge Audio DSP & Neural Noise Suppression in Web Audio Worklets (Late 2026 SOTA)

> **File:** `01_edge_neural_noise_suppression_dsp.md`  
> **Target Subsystem:** Client-Side Audio Pipeline & Web Audio Worklet  
> **Output Destination for Report:** `docs/research/neural_audio_filtering_and_barge_in/reports/01_edge_neural_noise_suppression_dsp_report.md`  
> **Integration Context:** Google Gemini 3.8 Live PCM Stream (16kHz 16-bit Mono, 32ms frames / 512 samples)

---

## Deep Research Prompt

```markdown
Role: Principal Web Audio DSP & Real-Time Edge Machine Learning Systems Engineer (State-of-the-Art Late 2026).

Context:
We operate a high-stakes, full-duplex conversational voice tutoring and technical mock interview platform pairing candidates with Google Gemini 3.8 Live over WebSockets. Audio capture executes in browser clients across desktop and mobile devices at 16kHz 16-bit Mono PCM. Currently, loud non-speech impulse transients (sneezing, coughing, throat clearing, breathing into the microphone, mechanical keyboard clicks, and desk thumps) produce amplitude spikes (-15 dB to -22 dB RMS) that cause accidental acoustic barge-in interruptions of the AI tutor and contaminate the upstream cloud model's real-time audio pipeline.
CRITICAL CONSTRAINT: The upstream Gemini 3.8 Live protocol is immutable. We must NEVER break the WebSocket session, violate audio format rules (raw 16kHz 16-bit Mono Little-Endian PCM), or introduce end-to-end DSP latency exceeding 15ms.

RESEARCH METHODOLOGY MANDATE (ZERO-ANCHORING):
Do NOT restrict your inquiry to historical or legacy 2022–2024 models (such as early RNNoise, DTLN, or initial DeepFilterNet releases). You are tasked with discovering and surveying the true State of the Art as of late 2026. If newer architectures (e.g., State-Space Models / Mamba for audio DSP, neural deep filtering networks, lightweight distilled diffusion/transformer frontends, or hardware-accelerated WebGPU/WASM-SIMD speech enhancers) have emerged as the industry standard, you must identify, benchmark, and evaluate them.

Inquiry & Technical Scope:

1. State-of-the-Art Edge Neural Speech Enhancement Paradigms (Late 2026 Frontier):
   - What are the emergent SOTA architectures and production-grade open-source models for real-time speech enhancement executable directly inside web browsers as of late 2026?
   - Conduct an unanchored comparative evaluation of the leading paradigms:
     * Next-generation spectral filtering / deep filtering architectures.
     * State-space models (SSMs) and linear-complexity recurrent/convolutional hybrids adapted for sub-10ms streaming audio.
     * Modernized WebAssembly SIMD and WebGPU-accelerated speech enhancement engines.
     * The latest production-grade WebRTC APM implementations and neural modules.
   - For each leading architecture, provide empirical benchmarks:
     * Inference latency per 32ms frame (512 samples @ 16kHz) across standard client hardware (commodity laptop CPU, Android mid-range, Apple Silicon/iOS Safari).
     * Steady-state memory footprint and WebAssembly heap allocation behavior.
     * Objective speech quality metrics: PESQ, STOI, and DNSMOS (overall, speech, and background noise quality) under heavy impulsive noise (coughs, sneezes, chair squeaks, typing).

2. Real-Time Web Audio Thread Architecture & Memory Contracts:
   - In modern browsers, AudioWorklet `process()` executes on a high-priority, real-time audio rendering thread where garbage collection pauses causes audible glitches and sample dropouts:
     * How do production-grade edge audio ML systems achieve strict ZERO-ALLOCATION execution inside `process()`?
     * Should neural inference run directly in the AudioWorklet (via WASM SIMD), or should audio chunks be transferred via SharedArrayBuffer / ring buffers to a dedicated Web Worker (or WebGPU context) to protect the audio thread?
     * What are the trade-offs in end-to-end acoustic path latency and scheduling jitter between in-worklet execution vs worker-offloaded inference?

3. Interaction with Hardware / Browser Native Preprocessing:
   - How should browser native constraints (`echoCancellation`, `noiseSuppression`, `autoGainControl` in `getUserMedia`) be configured when pairing with a downstream edge neural model?
     * Does browser-native noise suppression distort phase or strip spectral cues needed by downstream neural networks?
     * What is the industry best practice: disable browser `noiseSuppression` and rely entirely on the neural model, or cascade them?
     * How to guarantee acoustic echo cancellation (AEC) integrity so AI tutor speech emitted through speakers does not leak into the mic?

4. Resampling, Quantum Alignment & Format Invariants:
   - Web Audio natively renders in 128-sample quanta at host hardware rates (44.1kHz or 48kHz). Gemini 3.8 Live requires linear 16kHz Mono 16-bit PCM.
   - What is the most efficient, click-free, allocation-free downsampling and frame-aggregation pattern to convert 128-sample native quanta into 512-sample (32ms) frames with zero phase distortion?

Deliverable Requirements:
Provide an exhaustive, evidence-based architectural report containing exact mathematical formulations, WASM/WebGPU pipeline schematics, audio graph topologies, empirical latency budgets, and concrete TypeScript / WebAssembly implementation guidance.
```
