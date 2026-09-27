# Wave 13: Client-Authoritative Voice Architecture & Silero VAD v5 (SOTA Late 2026)

> **Document:** `docs/roadmap/wave_13_client_authoritative_voice_and_silero_vad/00_MASTER_PLAN.md`  
> **Status:** APPROVED FOR STAGED IMPLEMENTATION  
> **Target Standard:** SOTA Late September 2026  
> **Authoritative Protocol SSOT:** [`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](../../architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)  
> **Architectural Rules:** [`AGENTS.md`](../../../AGENTS.md)

---

## 1. Executive Summary

This wave addresses the root cause of recurring Auto-VAD fragility (swallowed AI words, speaker bleed self-interruption, turn handoff deadlocks).

### Root Cause: Split-Brain Custody
Previous iterations allowed both Google Gemini Live cloud VAD (`automaticActivityDetection.disabled: false`) and browser VAD (`AudioCaptureProcessor` + `LiveVoiceEngine` `silenceTimer`) to simultaneously control turn custody, while Node.js gateway guards (`STALE_GUARD`, `ZERO_CHUNK_GUARD`, `ECHO_GUARD`) acted as a third competing censor.

### SOTA Late 2026 Target: Client-Authoritative Duplex
1. **Cloud VAD Disabled:** `automaticActivityDetection.disabled = true` in `liveGeminiConfigBuilder.ts`. Cloud AI never self-interrupts due to speaker echo.
2. **Client SSOT:** Turn boundaries are determined exclusively by client-side **Silero VAD v5** running via WebAssembly (`onnxruntime-web`), delivering sub-millisecond inference and 99.8% phoneme accuracy.
3. **Clean Gateway:** All speculative guards (`STALE_GUARD`, `ZERO_CHUNK_GUARD`, `FLOOD_GUARD`) are removed from `liveClientGuardService.ts`. The gateway becomes a high-throughput transparent session router.
4. **Formal State Machine:** Transitions are governed by `LiveVoiceStateMachine.ts`, eliminating invalid states by construction.
5. **Physical Reality CI Tests:** Headless tests include synthetic room acoustics (-12 dB speaker bleed, 25ms delay) and network jitter fuzzing.

---

## 2. Stage Breakdown & Deliverables

| Stage | Focus Area | Deliverables | Cognitive Boundary |
| :--- | :--- | :--- | :--- |
| **Stage 01** | Protocol SSOT & Agent Directives | Update `AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`, `AGENTS.md` (Rule 2.6), and `SKILL.md` | Doc integrity |
| **Stage 02** | Client Silero VAD v5 WASM | Add `onnxruntime-web`, download `silero_vad.onnx`, create `SileroVadDetector.ts`, update `MicrophoneCapture.ts` | $\le 250$ lines |
| **Stage 03** | Frontend Formal Statechart | Create `LiveVoiceStateMachine.ts`, refactor `LiveVoiceEngine.ts` | $\le 200$ / $\le 400$ lines |
| **Stage 04** | Backend Gateway Cleansing | Set `automaticActivityDetection.disabled = true`, remove `STALE/ZERO_CHUNK/FLOOD` guards | $\le 150$ lines |
| **Stage 05** | Acoustic Bleed Fuzzing in CI | Create `acousticBleedEcho.scenario.ts`, `speechPauseResumption.scenario.ts`, FSM unit tests | $\le 200$ lines each |
| **Stage 06** | Canary Replay & Production Deploy | Execute headless pre-flight canary, push to Git, verify CI/CD deploy on VPS | DoD verification |

---

## 3. Definition of Done (DoD)

1. Cloud `automaticActivityDetection.disabled = true` verified in production WebSocket logs.
2. `SileroVadDetector` running on client with verified speech probability metrics.
3. 0 dropped words during AI question recitation in presence of -12dB speaker bleed.
4. 0 turn handoff deadlocks during natural speech pauses (1.2s - 2.5s).
5. All new files $\le 350$ lines, all modified files $\le 400$ lines.
6. CI pipeline green and deployed to `https://java.djelu.site`.
