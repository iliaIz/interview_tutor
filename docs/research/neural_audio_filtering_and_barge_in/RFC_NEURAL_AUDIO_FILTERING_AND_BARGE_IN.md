# Master Architectural RFC: Neural Audio Filtering, Speculative Ducking & Gemini 3.8 Live Stream Arbitration

> **Document:** `docs/research/neural_audio_filtering_and_barge_in/RFC_NEURAL_AUDIO_FILTERING_AND_BARGE_IN.md`  
> **Status:** Proposed / Synthesized from Deep Research Battery (Planes 1–4)  
> **Target Standard:** SOTA Late-2026 (Web Audio API Level 2, AudioWorklets, WASM SIMD, Gemini 3.8 Live)  
> **Target Subsystem:** Client Audio DSP, Neural Phonetic VAD, Pre-Socket Gating, Floor Control & UX

---

## 1. Problem Statement & Root Cause Synthesis

### The Core Failure Mode
In full-duplex conversational voice tutoring and technical mock interviews, candidate physiological transients (coughing, sneezing, throat clearing, sighing) and mechanical impacts (keyboard clicks, desk thumps) accidentally interrupt the AI tutor while it is explaining concepts and contaminate the upstream cloud model's real-time audio pipeline.

### Root Cause Verified in Codebase
1. **Naive Energy-Only VAD in AudioWorklet:** [`audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js#L118-L127) uses a Schmitt trigger on RMS decibels (`db > dynamicAssertDb`, ~-35 dB). Any sound louder than ambient room noise asserts `speechDetected = true` on the very first 100ms chunk.
2. **Hard Local Interruption:** [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts#L195-L200) evaluates `metrics.speechDetected` during `AI_SPEAKING` and immediately triggers `handleBargeInInterruption('acoustic')`, cutting off playback without evaluating whether the sound was human speech.
3. **Cloud KV-Cache Truncation:** When the cough audio is subsequently forwarded to Google Gemini 3.8 Live, Cloud VAD (`AutomaticActivityDetection`) triggers `interrupted: true`, which physically truncates the model's generated turn in the cloud KV-cache, permanently destroying the AI's unspoken thoughts.

---

## 2. Ingested Architectural Foundations (Cross-Plane Synthesis)

| Plane | Core Finding / Standard | Implementation Mechanism |
|---|---|---|
| **Plane 1: Edge DSP** | Hybrid 2-stage DSP: Fast Transient Clamping ($\tau < 0.15$ms) via Teager-Kaiser Energy Operator (TKEO) + Causal Neural Filtering (`libDF` / `LiteRT.js` WASM SIMD). Zero-allocation inside `AudioWorklet.process()`. | Replace naive Schmitt trigger in AudioWorklet with zero-allocation ring buffer, transient clippers (-26 dBFS ceiling for non-harmonic spikes), and 512-sample (32ms) frame aggregation. |
| **Plane 2: Neural VAD** | Phonetic feature discrimination (F1–F3 formants, pitch periodicity $F_0 \in [85, 300]$Hz vs cough roll-off $4451$Hz). Minimum voicing duration $T_{\text{min\_voice}}^* \in [192, 240]$ms ($N=7$ frames @ 32ms). Speculative Audio Ducking (-12 dB). | Dual-gate state machine: duck AI playback volume to -12 dB (15ms ramp) on initial sound; if speech verified over 224ms $\to$ commit full barge-in; if transient $\to$ instant rollback to 0 dB in 15ms. |
| **Plane 3: Protocol Gateway** | Paradigm B (Client-Gated Neural Streaming) with 240ms Pre-Speech Circular Buffer (40ms quiet anchor + 200ms onset) flushed in 40ms sub-chunks. Trailing hangover $T_{\text{total\_trailing}} = 800$ms (300ms redemption + 500ms comfort noise @ -60 dBFS). | Zero frames sent during candidate pause/cough. Upon verified speech, flush 240ms buffer. Upon candidate stop, stream 800ms trailing silence to let server Cloud VAD (`silenceDurationMs: 500`) naturally commit `ACTIVITY_END`. Strict audio mutex during tools. |
| **Plane 4: Turn-Taking & UX** | Multi-phase dynamic silence timeouts ($T_{\text{pause}} = 350$ms to $5000$ms). Reassurance UX with 5 pastel visual states. Backchannel suppression (<300ms flat $F_0$ without floor seizure). Push-to-Talk and Cough-Mute (`C` key) ergonomic overrides. | Adaptive pause calculator in FSM; State B (Transient Ignored) micro-indicator reassuring candidate; Spacebar Push-to-Talk fallback. |

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
│  1. Minimum-Phase FIR Resampler (48kHz/44.1kHz -> 16kHz Mono Int16)                             │
│  2. TKEO Fast Transient Clipper (Clamps cough/click impulses to -26 dBFS in < 0.15ms)           │
│  3. SPSC Lock-Free Circular Buffer (3,840 samples / 240ms lookback)                             │
└───────────────────────┬─────────────────────────────────────────────────┬───────────────────────┘
                        │ Transferable ArrayBuffers (8-buffer ring pool)  │ SharedArrayBuffer / Atomics
                        ▼                                                 ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ Web Worker: Neural Phonetic VAD Engine        │ │ Speculative Audio Playout Manager             │
│                                               │ │                                               │
│  • Silero VAD v5 / Agora TEN-VAD (WASM SIMD)  │ │  • Normal State: Volume 0 dB (1.0)            │
│  • 32ms frame inference (512 samples @ 16kHz) │ │  • Acoustic Onset: Duck to -12 dB (15ms ramp) │
│  • P(speech) evaluation + F0 Harmonicity      │ │  • Speech Verified (>224ms): Hard Barge-In    │
│  • Cough/Sneeze Rejection (Roll-off > 2.8kHz) │ │  • Transient/Cough (<180ms): Rollback to 0 dB │
└───────────────────────┬───────────────────────┘ └───────────────────────────────────────────────┘
                        │ Speech Confirmed & Gated Chunks
                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Upstream Stream Arbitrator & WebSocket Gateway (Gemini 3.8 Live Bridge)                         │
│                                                                                                 │
│  • SILENT: 0 bytes sent (cough/clicks completely blocked from network)                          │
│  • ONSET: Flush 240ms Pre-Speech Ring Buffer as six 40ms paced sub-chunks                       │
│  • ACTIVE_SPEECH: Stream continuous live 16kHz PCM chunks                                       │
│  • OFFSET: Stream 300ms redemption + 500ms comfort noise (-60 dBFS)                            │
│  • HANDOFF: Google Cloud VAD commits ACTIVITY_END via silenceDurationMs: 500                    │
│  • AUDIO MUTEX: Freeze mic chunks between toolCall and toolResponse (WS 1008 protection)        │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase-Gated Implementation Plan (Wave 19)

### Stage 1: Zero-Allocation AudioWorklet DSP & Transient Clipper
- Update [`audio-capture-processor.js`](file:///home/djelu/projects/interview_tutor/frontend/public/worklets/audio-capture-processor.js):
  * Remove naive RMS dB Schmitt trigger barge-in flag.
  * Implement zero-allocation static memory layout (no heap allocations in `process()`).
  * Implement Teager-Kaiser Energy Operator (TKEO) transient detection to clamp high-energy impulsive spikes (coughs, sneezes, clicks) to $-26\text{ dBFS}$.
  * Maintain continuous 240ms circular lookback buffer (`Int16Array`, 3,840 samples).
  * Package audio into 512-sample (32ms @ 16kHz) transferable ArrayBuffers.

### Stage 2: Neural Phonetic VAD Worker & Speculative Ducking Controller
- Implement headless `NeuralVadWorker`:
  * Stream 512-sample chunks to worker running neural VAD with WASM SIMD.
  * Compute composite neuro-spectral speech probability $P(\text{speech})$ with high roll-off penalty.
- Update [`AudioPlayoutManager.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/services/AudioPlayoutManager.ts):
  * Add `speculativeDuck(targetGain = 0.25, rampMs = 15)`.
  * Add `rollbackDucking(rampMs = 15)`.
  * Add `commitBargeIn(deClickMs = 5)`.
- Update [`NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts):
  * Replace immediate `handleBargeInInterruption('acoustic')` with the 3-stage speculative barge-in state machine.
  * Enforce $T_{\text{min\_voice}} = 224\text{ ms}$ ($N=7$ frames) before committing barge-in.

### Stage 3: Upstream Client-Gated Stream Arbitrator (Gemini 3.8 Live Synergy)
- Implement `LiveStreamArbitrator`:
  * Manage 240ms Pre-Speech Ring Buffer flushing (six 40ms sub-chunks paced by 3ms).
  * Enforce Gated Streaming: zero frames sent during silent candidate listening.
  * Implement 800ms trailing hangover (300ms redemption + 500ms comfort noise @ -60 dBFS) to advance server `silenceDurationMs: 500` deterministically.
  * Strictly preserve Audio Mutex during `toolCall` execution.
- Calibrate WebSocket `setup.realtimeInputConfig`:
  * `automaticActivityDetection`: `disabled: false`, `startOfSpeechSensitivity: "START_SENSITIVITY_LOW"`, `prefixPaddingMs: 200`, `endOfSpeechSensitivity: "END_SENSITIVITY_LOW"`, `silenceDurationMs: 500`.
  * `turnCoverage`: `"TURN_INCLUDES_ONLY_ACTIVITY"`.
  * `activityHandling`: `"START_OF_ACTIVITY_INTERRUPTS"`.

### Stage 4: Dynamic Floor Control, Reassurance UX & Ergonomics
- Implement Reassurance UX state indicators in the active session UI:
  * State A (Passive Ambient)
  * State B (Transient Ignored — subtle micro-indicator reassuring user that cough was safely filtered)
  * State C (Candidate Speaking — live acoustic aura)
  * State D (Speculative Yielding — ducking active)
  * State E (AI Thinking / Extended Deliberation)
- Add ergonomic controls: Spacebar Push-to-Talk and `C` hotkey for instant Cough Mute.
- Adaptive silence timeout $T_{\text{pause}}$ scaling across interview tracks (Verification: 400ms, Concurrency/LLD: 800ms, System Design: 1100ms, Coding: 1400ms).

---

## 5. Non-Functional Requirements & Verification Gates

1. **Acoustic Rejection Gate:** 100% of recorded coughs, sneezes, and mechanical keyboard clicks must NOT interrupt AI speech or trigger Cloud VAD.
2. **Speech Responsiveness Gate:** Intentional speech interruption must feel instantaneous to the candidate (ducking commences in $\le 32$ms, full barge-in committed in $\le 224$ms).
3. **Zero Audio Glitch Gate:** Zero heap allocations inside `AudioWorklet.process()`; 0 buffer underruns over a 45-minute continuous interview.
4. **Protocol Compliance Gate:** Zero WebSocket Close 1011 errors, zero Close 1008 errors, zero KV-cache desynchronization during tool execution.
