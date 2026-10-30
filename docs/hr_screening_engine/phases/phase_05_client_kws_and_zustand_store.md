# Phase 5: Client-Side Zero-Latency KWS & Zustand Store

> **Document:** `docs/hr_screening_engine/phases/phase_05_client_kws_and_zustand_store.md`  
> **Status:** Phase 5 Specification & Execution Gate  
> **Quality Gate G5:** `npm --prefix frontend run build` exit code 0.

---

## 1. Objectives & Scope
1. Implement `frontend/src/audio/ClientKeywordSpotter.ts`:
   - Wraps browser `SpeechRecognition` / `webkitSpeechRecognition` in `interimResults: true` continuous mode.
   - Morphological prefix tree (Trie) and stem matcher in $<10\text{ ms}$.
   - Lights up card optimistically within $<140\text{ ms}$.
   - Auto-restarts on silence boundaries.
2. Implement `frontend/src/store/useHrSimulatorStore.ts`:
   - Isolated Zustand store for HR simulation/drill.
   - Monotonic State Latch: `PENDING -> OPTIMISTIC_HIT -> CONFIRMED_HIT`.
   - Tracks pacing window, WPM, hesitation count, and scorecards.
3. Update `frontend/src/audio/types.ts`:
   - Add HR configurations and callbacks to `VoiceEngineConfig`.

---

## 2. Invariants & Guardrails
- `ClientKeywordSpotter.ts` $\le 260$ lines.
- `useHrSimulatorStore.ts` $\le 280$ lines.
- Does not modify `NativeLiveVoiceEngine.ts` core audio pipeline.
- Graceful degradation: if Web Speech API is unavailable, seamlessly falls back to Tier-2 server transcript deltas.

---

## 3. Verification Commands
```bash
npm --prefix frontend run build
```
