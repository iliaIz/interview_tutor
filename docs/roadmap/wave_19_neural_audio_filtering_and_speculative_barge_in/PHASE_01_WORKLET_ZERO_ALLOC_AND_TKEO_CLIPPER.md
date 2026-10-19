# Phase 1: Zero-Allocation AudioWorklet DSP & TKEO Transient Clamping

> **Document:** `docs/roadmap/wave_19_neural_audio_filtering_and_speculative_barge_in/PHASE_01_WORKLET_ZERO_ALLOC_AND_TKEO_CLIPPER.md`  
> **Status:** Draft / Pending Approval  
> **Target Standard:** Web Audio API Level 2 AudioWorklet Real-Time Thread Standard (Zero-GC)  
> **Target Subsystem:** `frontend/public/worklets/audio-capture-processor.js`  

---

## 1. Objectives & Rationale

In the current implementation of `audio-capture-processor.js`:
1. `speechDetected` is calculated via an arbitrary RMS decibel Schmitt trigger (`db > dynamicAssertDb`, line 118). Because this metric is unaware of vocal formants or pitch harmonics, any cough or energetic non-speech transient asserts `speechDetected = true`, immediately triggering an acoustic false barge-in in `NativeLiveVoiceEngine.ts`.
2. Audio frame packaging creates new typed array allocations and message objects dynamically, risking periodic Garbage Collection (GC) pauses on the real-time audio thread.
3. Frame size is not cleanly aligned to the SOTA Gemini Live 32 ms standard (512 samples @ 16 kHz).

Phase 1 refactors `audio-capture-processor.js` to eliminate the naive Schmitt trigger, enforce a zero-allocation circular buffer design, implement a Teager-Kaiser Energy Operator (TKEO) transient detector/clipper, and standardize frames on 512 samples.

---

## 2. Technical Specification & Implementation Details

### 2.1. Teager-Kaiser Energy Operator (TKEO) Transient Clipper
The discrete TKEO calculates instantaneous energy from 3 consecutive audio samples:
$$\Psi[x(n)] = x^2(n) - x(n-1) \cdot x(n+1)$$

- **Transient Characteristic:** Non-speech impulses (coughs, sneezes, clicks) produce massive instantaneous $\Psi[x(n)]$ spikes with wideband high-frequency dispersion ($> 2.8$ kHz) within $< 0.15$ ms.
- **In-Worklet Soft Clamping:** When TKEO exceeds the transient threshold ($\Psi > \Psi_{\text{transient}}$):
  $$x_{\text{clamped}}(n) = \text{sign}(x(n)) \cdot \min(|x(n)|, A_{\text{clamp}})$$
  where $A_{\text{clamp}} = 10^{-26/20} \approx 0.050$ ($-26$ dBFS).
- This prevents downstream vocoder overload and tags the frame with `isTransient: true`.

```
                Raw Input Sample x(n)
                         │
                         ▼
             ┌─────────────────────────┐
             │  TKEO Energy Detector   │
             │  Ψ = x²(n) - x(n-1)x(n+1)
             └───────────┬─────────────┘
                         │
              Ψ > Ψ_thresh?
             ┌───────────┴───────────┐
             │ YES                   │ NO
             ▼                       ▼
   ┌───────────────────┐    ┌───────────────────┐
   │ Soft Clamp to     │    │ Linear Pass       │
   │ -26 dBFS & Flag   │    │ (Pristine Speech) │
   └─────────┬─────────┘    └─────────┬─────────┘
             │                        │
             └───────────┬────────────┘
                         ▼
             16kHz 512-Sample Ring Buffer
```

### 2.2. Zero-Allocation Memory Arena
To avoid GC jitters on the audio rendering thread:
- **Pre-allocated Ring Pool:** An array of $8 \times \text{ArrayBuffer}$ instances (each 1024 bytes = 512 samples $\times$ 2 bytes for Int16) is allocated during Worklet construction.
- **Transferable Posting:** Chunks are dispatched via `postMessage({ type: 'audio-chunk', buffer }, [buffer])` transferring ownership without copying or heap allocation. The main thread returns consumed buffers back to the Worklet pool.
- **Static Downsampler State:** Pre-allocated biquad state variables and FIR coefficients for $48\,\text{kHz} \to 16\,\text{kHz}$ conversion.

### 2.3. Frame Standardization: 512 Samples (32 ms @ 16 kHz)
- All chunks sent to the main thread and downstream VAD worker are strictly sized to 512 samples (32 ms @ 16 kHz).
- Matches the frame window required by Silero VAD v5 and Google Gemini Live real-time audio chunking.

---

## 3. Files Modified / Created

| File | Modification | Line Limit Target |
|---|---|---|
| `frontend/public/worklets/audio-capture-processor.js` | Refactor to zero-allocation, remove Schmitt trigger, add TKEO clipper, 512-sample pool. | $< 300$ lines |
| `frontend/src/audio/AudioWorkletRingPool.ts` | (New) Main-thread recycling helper for transferable ArrayBuffers. | $< 150$ lines |

---

## 4. Phase Gate 1 Verification & Acceptance Criteria

- [ ] **Gate 1.1 (Zero Allocations):** Running Chrome DevTools Memory / Performance recording shows exactly 0 heap allocations per second inside `AudioWorkletProcessor.process()`.
- [ ] **Gate 1.2 (512-Sample Frame Alignment):** All dispatched buffers have length $1024$ bytes ($512$ Int16 samples @ 16 kHz).
- [ ] **Gate 1.3 (TKEO Transient Clamping):** A simulated synthetic $-12$ dBFS cough pulse is clamped to $\le -26$ dBFS within $0.15$ ms and tagged with `isTransient: true`.
- [ ] **Gate 1.4 (Pristine Speech Audio):** Normal speech signals (sinusoids at $220$ Hz, $440$ Hz, $1000$ Hz) pass through unattenuated ($0$ dB gain loss, $\text{THD} < 0.05\%$).
