# Deep Research Reports: Neural Audio Filtering & Barge-In Resilience

> **Location:** `docs/research/neural_audio_filtering_and_barge_in/reports/`  
> **Master Synthesis RFC:** [`../RFC_NEURAL_AUDIO_FILTERING_AND_BARGE_IN.md`](../RFC_NEURAL_AUDIO_FILTERING_AND_BARGE_IN.md)  
> **Target Standard:** SOTA Late-2026 (Web Audio API, AudioWorklets, WebAssembly SIMD, Gemini 3.8 Live)

---

## Ingested Research Reports

| Plane | Report File | Key Subject | Size |
|---|---|---|---|
| **Plane 1 (DSP)** | [`Архитектура-браузерного-DSP-конвейера-и-нейросетевого-подавления-импульсных-поме.md`](./Архитектура-браузерного-DSP-конвейера-и-нейросетевого-подавления-импульсных-поме.md) | Edge DSP, TKEO transient clamping, DeepFilterNet3 / LiteRT WASM SIMD, zero-allocation AudioWorklet contracts. | 104 KB |
| **Plane 2 (VAD)** | [`Архитектура-подавления-ложных-прерываний-и-спекулятивного-управления-речевой-оче.md`](./Архитектура-подавления-ложных-прерываний-и-спекулятивного-управления-речевой-оче.md) | Acoustic/phonetic discrimination (F1–F3 vs cough), Silero v5 / TEN-VAD benchmarks, $T_{\text{min\_voice}} = 224$ms, Speculative Ducking (-12 dB). | 93 KB |
| **Plane 3 (Protocol)** | [`Architectural-Specification-Neural-Client-Gated-Audio-Streaming-and-Cloud-VAD-Sy.md`](./Architectural-Specification-Neural-Client-Gated-Audio-Streaming-and-Cloud-VAD-Sy.md) | Paradigm B (Client-gated neural streaming), 240ms Pre-Speech Ring Buffer, 800ms trailing silence, `silenceDurationMs: 500` Cloud VAD synergy. | 59 KB |
| **Plane 4 (HCI/UX)** | [`Инженерный-отчет-по-человеческому-фактору-и-разговорному-UX-управление-очереднос.md`](./Инженерный-отчет-по-человеческому-фактору-и-разговорному-UX-управление-очереднос.md) | Turn-taking dynamics, cognitive load pauses, backchanneling vs floor seizure, 5-state reassurance visual UX, Push-to-Talk & Cough-Mute shortcuts. | 91 KB |
