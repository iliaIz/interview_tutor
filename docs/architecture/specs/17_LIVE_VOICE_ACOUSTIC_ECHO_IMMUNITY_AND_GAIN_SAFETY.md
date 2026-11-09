# Spec 17: Live Voice Acoustic Echo Immunity, Master Gain Safety & Strict Vocoder Temperature

> **Parent Specification:** [`docs/architecture/specs/01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md`](01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md), [`16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md`](16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md), [`AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)  
> **Status:** Approved for Implementation (SOTA Late 2026)  
> **Traceability:** Aligned with `~/projects/gemini_live_reference/` & Google Gemini 3.8 Live Canonical Protocol  

---

## 1. Intent & Workload Envelope

- **Context & Glossary:**  
  Governed by `GLOSSARY.md` (Dual-Sided Handshake, Anti-Lapping Ring Buffer, Acoustic Barge-In, Cloud VAD Fast-Handoff). Resolves a critical acoustic bug where the AI voice becomes completely silent or muffled during live dialogue, while knocking on the microphone or making a loud noise abruptly un-mutes the AI mid-sentence. Enforces strict vocoder temperature calibration ($T = 1.0$) to prevent autoregressive acoustic space collapse into digital silence.
- **Operating Envelope:**  
  - Target Playout Latency: $\le 80$ ms (1920-sample pre-roll watermark at 24kHz).
  - Physical Master Playout Gain: Nominally constant at $1.5$ (or $1.0$); strictly prohibited from remaining at $0.0$ after interruptions.
  - Autoregressive Vocoder Temperature: Strictly $1.0$ across backend configuration and client session parameters.
  - Acoustic Barge-In Phonation Threshold: Energy floor $RMS \ge 0.035$ ($\approx -29$ dBFS) with minimum sustained duration $\ge 180$ ms; zero sensitivity to speaker echo below $-29$ dBFS.
  - Tenancy & Data Classification: Ephemeral / Internal Session Memory.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementation agent is **strictly forbidden from modifying**:
1. `LiteLLM_Proxy/` source code and Docker container configurations.
2. `public/worklets/gemini-audio-processor.js` (Hermite spline resampler and raised-cosine flush are already canonical).
3. Backend database schema, SQLite migrations, or Question Catalog files (`all_interview_questions.json`, `company_profiles.json`).
4. Other platform practice arenas (PGlite SQL Arena, Cytoscape System Design Arena, Monaco Code Editor).
5. Disabling Google Native Cloud VAD (`automaticActivityDetection.disabled = false` must remain enabled).

---

## 3. Pre-Agreed Verification Seams

- **Web Audio Playout Seam:** `frontend/src/services/AudioPlayoutManager.ts` and `frontend/src/services/audioDuckingController.ts`.
- **Microphone Frame Dispatcher Seam:** `frontend/src/audio/liveMicChunkDispatcher.ts` and `frontend/src/audio/NativeLiveVoiceEngine.ts`.
- **Session Configuration & Protocol Seam:** `frontend/src/audio/liveVoiceUrlBuilder.ts`, `backend/src/services/live/liveGeminiConfigBuilder.ts`, and `frontend/src/components/VoiceModal.tsx`.
- **Headless Contract & CI Test Seams:** `frontend/tests/audioPlayoutContracts.test.ts` and `frontend/tests/liveVoiceEngine.test.ts`. Zero internal domain mocks; verified remotely via `remote-verify`.

---

## 4. Formal Wire & Messaging Contracts

### 4.1 Master Playout Gain Safety Contract (Zero-Trap Invariant)
In `AudioPlayoutManager.ts`:
- Pop-free interruption de-ramping is handled **inside the AudioWorklet ring buffer** (`workletNode.port.postMessage({ type: 'flush' })` with 5ms raised-cosine de-ramp).
- `handleInterruption()` MUST NOT ramp `masterGain.gain` to $0.0$ and leave it un-restored.
- Whenever new PCM chunks arrive in `enqueuePcmChunk(base64)` or when `startNewTurn()` executes, `masterGain.gain` MUST be asserted to its nominal base gain ($1.5$), unless the user has explicitly toggled `isMuted = true`.

```typescript
// CANONICAL AudioPlayoutManager.handleInterruption()
public handleInterruption(): void {
  // Pop-free flush is executed natively inside the AudioWorklet via raised-cosine de-ramp
  this.clearQueue();
  // Ensure masterGain remains at nominal level for subsequent speech turns
  if (this.masterGain && this.context && this.context.state !== 'closed' && !this.isMuted) {
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues?.(now);
    this.masterGain.gain.setValueAtTime?.(1.5, now);
  }
}
```

### 4.2 De-Ducking & Echo Rejection Contract
In `liveMicChunkDispatcher.ts`:
- **Eliminate Naive Ducking on $-38$ dBFS:** The AI voice emerging from physical laptop/phone speakers reaches $-35$ to $-28$ dBFS at the microphone. Testing against `rmsDb > -38` causes the AI to constantly duck itself and trigger false self-interruption after 224ms.
- **Align with Canonical Reference (`gemini_live_reference`):**
  - Speculative ducking during `AI_SPEAKING` is completely dismantled. The AI voice does not stutter or attenuate due to ambient room noise or speaker bleed.
  - Acoustic barge-in during `AI_SPEAKING` is gated strictly by confirmed sustained speech:
    - Minimum vocal energy: $RMS \ge 0.035$ ($\approx -29$ dBFS).
    - Minimum sustained phonation: $\ge 180$ ms (6 consecutive frames at 32ms) of non-transient audio.
    - Transients ($<180$ms or `isTransientSpike: true`) are completely ignored without triggering ducking or interruptions.
    - Native server-driven barge-in (`serverContent: { interrupted: true }`) and tactile barge-in remain primary authoritative controls.

### 4.3 Strict Autoregressive Vocoder Temperature Invariant ($T = 1.0$)
In Gemini 3.8 Live, autoregressive latent acoustic token modeling requires `temperature: 1.0`. Lower temperatures ($<0.7$) cause the latent acoustic space to collapse into digital silence loops lasting 14–50 seconds.
- **Backend Enactment:** In `backend/src/services/live/liveGeminiConfigBuilder.ts`:
  ```typescript
  const effectiveTemperature = typeof opts.temperature === 'number' && opts.temperature >= 0.7
    ? opts.temperature
    : 1.0;
  ```
- **Frontend Serialization:** In `frontend/src/audio/liveVoiceUrlBuilder.ts`:
  ```typescript
  params.set('temperature', String(cfg.temperature ?? 1.0));
  ```
- **Session Defaults:** In `frontend/src/components/VoiceModal.tsx` and `CompanyPrepStudio.tsx`, temperature is explicitly pinned to `1.0`.

---

## 5. Storage & Zero-Downtime Migration Contract

- **Migration Strategy:** Additive-only client-side audio DSP and session configuration.
- **Database Schema Diff:** Zero database changes; purely ephemeral Web Audio node graphs and WebSocket session handshake parameters.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### Contract 1: Non-Zero Playout Gain Invariant
- **Pre-Conditions {P}:** Interruption occurs (tactile button click, keyboard Spacebar, or server `interrupted: true`).
- **Algorithm C:** `playoutManager.handleInterruption()` dispatches `{ type: 'flush' }` to AudioWorklet. Worklet applies 5ms raised-cosine fade-out to existing ring-buffer samples and empties queue. `masterGain.gain` remains at nominal $1.5$ (or restores immediately).
- **Post-Conditions {Q}:** Subsequent audio chunks enqueued for the next turn play with full nominal volume ($1.5$); zero permanent muting occurs.

### Contract 2: Acoustic Echo Immunity Invariant
- **Pre-Conditions {P}:** State is `AI_SPEAKING`. AI voice sounds from laptop loudspeakers and bleeds into candidate microphone at $-35$ to $-30$ dBFS without candidate speech.
- **Algorithm C:** `liveMicChunkDispatcher.ts` evaluates incoming microphone frames. Because echo $< -29$ dBFS and no speculative ducking is active, `consecutiveVoicingFrames` does not accumulate false barge-in; `playoutManager.speculativeDuck` is never invoked.
- **Post-Conditions {Q}:** AI speaks uninterrupted without stuttering, volume drops, or self-inflicted cut-offs.

### Contract 3: Knock & Transient Resilience Invariant
- **Pre-Conditions {P}:** Candidate knocks on desk, taps microphone, or coughs during `AI_SPEAKING` (`isTransientSpike === true` or duration $<180$ ms).
- **Algorithm C:** TKEO non-linear energy operator detects impulsive non-speech spike. Filter tags chunk as transient and rejects acoustic barge-in.
- **Post-Conditions {Q}:** AI speech continues playing normally without audio tearing, gain shifts, or false turn interruption.

### Contract 4: Strict Vocoder Temperature Calibration
- **Pre-Conditions {P}:** Session connects from any UI modal, Company Prep stage, or VAD Lab test.
- **Algorithm C:** Both client URL builder and backend Gemini session resolver enforce `generationConfig.temperature = 1.0`.
- **Post-Conditions {Q}:** Upstream Gemini Live vocoder synthesizes rich, continuous, natural speech tokens without acoustic collapse into zero-energy frames.
