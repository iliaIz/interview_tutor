# Phase 3: Continuous Stream & In-Place Transient Clamping

> **Document:** `docs/roadmap/wave_19_neural_audio_filtering_and_speculative_barge_in/PHASE_03_CONTINUOUS_STREAM_IN_PLACE_TRANSIENT_SUPPRESSION.md`  
> **Status:** Draft / Pending Approval  
> **Target Standard:** Canonical Gemini 3.8 Live Bidirectional Streaming Protocol (`tmp/gemini 3.8 live docs/`)  
> **Target Subsystem:** `frontend/src/audio/NativeLiveVoiceEngine.ts`  

---

## 1. Objectives & Rationale

In the baseline implementation, while the candidate is in `LISTENING` state (thinking before speaking), raw audio chunks are sent unfiltered to the Gemini 3.8 Live gateway. A sudden cough, throat clear, or desk bump ($ -15 $ dBFS) trips Google's server-side Cloud VAD (`ACTIVITY_START`), causing the model to interpret non-speech as a question and respond with hallucinations.

While naive proposals suggested "discontinuous gating" (sending 0 bytes during pauses), this is strictly prohibited by Google's protocol specification:
- `04_audio_context_and_turn_taking.md` (§5.1, §6): *"Внутри диалога поток непрерывен! Непрерывный PCM-стрим 16 кГц, сквозной серверный VAD с калибровкой silenceDurationMs: 500"*.
- `AGENTS.md` Rule 2.6: Continuous mic streaming is mandatory so server-side VAD can maintain background noise adaptation and advance `silenceDurationMs`.

Phase 3 implements **In-Place Transient Clamping within a strictly continuous 16kHz PCM stream**, alongside a strict Audio Mutex during tool execution.

---

## 2. Technical Specification & Implementation Details

### 2.1. In-Place Clamping Architecture
Instead of breaking the WebSocket stream, non-speech transients are suppressed directly within the outgoing PCM buffer:

```
               Outgoing 16kHz 512-sample PCM Buffer
                                │
                                ▼
               ┌─────────────────────────────────┐
               │  Neural VAD + TKEO Evaluation   │
               └────────────────┬────────────────┘
                                │
             Is Transient / Non-Speech (P < 0.20)?
             ┌──────────────────┴──────────────────┐
             │ YES                                 │ NO
             ▼                                     ▼
 ┌───────────────────────────┐         ┌───────────────────────────┐
 │ In-Place Clamping:        │         │ Pristine Pass-Through:    │
 │ Attenuate samples down to │         │ Full-fidelity human       │
 │ -50 dBFS (ambient floor)  │         │ speech audio preserved    │
 └───────────┬───────────────┘         └───────────┬───────────────┘
             │                                     │
             └──────────────────┬──────────────────┘
                                ▼
         Base64 Serialization & Continuous WebSocket Send
         { realtimeInput: { audio: { data, mimeType: ... } } }
```

1. **Ambient Continuity:** Normal room background noise continues to stream, keeping Google's noise estimator calibrated and WebSocket keepalive active.
2. **Cough Attenuation:** High-energy non-speech impulses are clamped to $-50$ dBFS (ambient silence) before serialization. To Gemini 3.8 Live, the candidate simply remained silent.
3. **Turn Completion:** When the candidate finishes speaking, continuous trailing silence flows to the server, enabling Google's calibrated `silenceDurationMs: 500` to cleanly fire `ACTIVITY_END` without client-side race conditions.

### 2.2. Strict Tool Execution Audio Mutex
Per `03_tools_and_turn_lockdown.md` (§2, §6):
- When Gemini Live emits a `toolCall` (e.g. `submit_interview_evaluation`), the server expects an atomic `toolResponse` turn.
- Injecting audio frames during this window causes an upstream protocol desynchronization and WebSocket 1008 policy closure.
- **Implementation:** An atomic boolean `isToolCallPending` is set to `true` upon receiving `toolCall` and reset only when `toolResponse` has been completely dispatched. While `isToolCallPending === true`, `handleMicrophoneChunk` drops chunks silently.

---

## 3. Files Modified / Created

| File | Modification | Line Limit Target |
|---|---|---|
| `frontend/src/audio/NativeLiveVoiceEngine.ts` | Continuous 16kHz PCM streaming, in-place non-speech clamping, tool execution mutex. | $< 380$ lines |

---

## 4. Phase Gate 3 Verification & Acceptance Criteria

- [ ] **Gate 3.1 (Stream Continuity):** In `LISTENING` state, 16kHz PCM chunks stream at a steady cadence ($32$ ms intervals) with zero frame drops or paused intervals.
- [ ] **Gate 3.2 (Zero False `ACTIVITY_START`):** Replaying 10 recorded coughs/clicks while in `LISTENING` results in 0 `ACTIVITY_START` events from Google Cloud VAD; AI remains quiet.
- [ ] **Gate 3.3 (Natural Speech Endpointing):** Spoken candidate answers trigger `ACTIVITY_START` on first syllable, followed by clean `ACTIVITY_END` exactly $\sim 500$ ms after speech ceases.
- [ ] **Gate 3.4 (Tool Mutex Protection):** Zero audio frames are transmitted over WebSocket between `toolCall` receipt and `toolResponse` dispatch.
