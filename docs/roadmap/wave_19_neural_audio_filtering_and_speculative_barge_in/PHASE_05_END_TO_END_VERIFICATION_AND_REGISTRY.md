# Phase 5: End-to-End Verification Matrix & Functional Registry

> **Document:** `docs/roadmap/wave_19_neural_audio_filtering_and_speculative_barge_in/PHASE_05_END_TO_END_VERIFICATION_AND_REGISTRY.md`  
> **Status:** Draft / Pending Approval  
> **Target Standard:** Rule 2.9 Acoustic SLA ($\ge 1200$ bytes non-zero audio) & Rule 10 Functional Registry Compliance  
> **Target Subsystems:** Test Harness, Acoustic Fixtures & Architecture SSOT  

---

## 1. Objectives & Rationale

Wave 19 touches real-time audio threads, WebSocket protocols, neural inference, and UI state machines. To guarantee zero regressions:
1. All changes must be verified against an automated headless acoustic test matrix simulating realistic candidate acoustic conditions (coughs, sneezes, clicks, desk bumps, quiet and loud speech).
2. Per **`AGENTS.md` Rule 10**, all architectural modifications, intermediate hypotheses, empirical findings, and upstream invariants must be formally recorded in `docs/architecture/functional_registry/`.

---

## 2. Technical Specification & Implementation Details

### 2.1. Acoustic Replay Verification Matrix (`runAcousticVadMatrix.ts`)
The test suite plays calibrated audio fixtures into the voice pipeline across all states:

```
+---------------------------------------------------------------------------------------------------------+
| WAVE 19 ACOUSTIC VERIFICATION MATRIX                                                                    |
+---+----------------------+--------------------+----------------------------------+----------------------+
| # | Acoustic Fixture     | State Machine Mode | Expected Pipeline Behavior       | Assertion Criteria   |
+---+----------------------+--------------------+----------------------------------+----------------------+
| 1 | cough_single.pcm     | AI_SPEAKING        | Neural VAD filters transient;    | 0 barge-ins;         |
|   | (-15 dBFS peak)      | (Tutor talking)    | Playout continues uninterrupted. | AI audio completes.  |
+---+----------------------+--------------------+----------------------------------+----------------------+
| 2 | throat_clear.pcm     | AI_SPEAKING        | Transient ignored or speculatively| Ducking recovers in  |
|   | (-20 dBFS peak)      | (Tutor talking)    | ducked and instantly rolled back.| <180ms to 0 dB.      |
+---+----------------------+--------------------+----------------------------------+----------------------+
| 3 | speech_russian.pcm   | AI_SPEAKING        | Speculative ducking at 32ms;     | Hard barge-in at     |
|   | ("Подождите...")     | (Tutor talking)    | Hard barge-in committed at 224ms.| 224ms; AI silenced.  |
+---+----------------------+--------------------+----------------------------------+----------------------+
| 4 | cough_single.pcm     | LISTENING          | Continuous PCM frames stream;    | 0 ACTIVITY_START     |
|   | (-15 dBFS peak)      | (Candidate pause)  | Cough clamped in-place to -50dBFS| events from Cloud VAD|
+---+----------------------+--------------------+----------------------------------+----------------------+
| 5 | speech_russian.pcm   | LISTENING          | Full-fidelity PCM streamed;      | ACTIVITY_START fired;|
|   | ("Мой ответ...")     | (Candidate answer) | Cloud VAD triggers turn start.   | ACTIVITY_END at 500ms|
+---+----------------------+--------------------+----------------------------------+----------------------+
| 6 | toolCall Turn        | TOOL_EXECUTION     | Audio Mutex freezes streaming;   | 0 bytes sent during  |
|   | (Evaluation submit)  |                    | Unblocks after toolResponse.     | tool turn; 0 1008 err|
+---+----------------------+--------------------+----------------------------------+----------------------+
```

### 2.2. Rule 10 Functional Registry Documentation
Update `docs/architecture/functional_registry/` with permanent SSOT records:
1. `audio_capture_processor.md`: Document zero-allocation ring buffer, removal of Schmitt trigger, TKEO impulse clamping formula.
2. `audio_playout_manager.md`: Document speculative ducking state transitions, gain ramping constants, and de-click fade-outs.
3. `native_live_voice_engine.md`: Document continuous 16kHz PCM streaming invariants, in-place non-speech clamping, and tool execution audio mutex.

---

## 3. Files Modified / Created

| File | Modification | Line Limit Target |
|---|---|---|
| `scripts/runAcousticVadMatrix.ts` | Add Wave 19 acoustic fixtures and test assertions. | $< 350$ lines |
| `docs/architecture/functional_registry/INDEX.md` | Register Wave 19 architectural changes. | $< 300$ lines |
| `docs/architecture/functional_registry/subsystems/audio_capture_processor.md` | (New) Detailed functional registry entry. | $< 250$ lines |
| `docs/architecture/functional_registry/subsystems/speculative_ducking_and_vad.md` | (New) Detailed functional registry entry. | $< 250$ lines |

---

## 4. Phase Gate 5 Verification & Acceptance Criteria

- [ ] **Gate 5.1 (Canary Matrix 100% Pass):** `npm run test:acoustic-vad -- --suite=canary` passes all 6 scenarios with zero failures.
- [ ] **Gate 5.2 (Zero Audio SLA Compliance):** Spoken turns verify Rule 2.9 ($\ge 1200$ bytes audio, $\ge 10$ characters).
- [ ] **Gate 5.3 (Functional Registry Audit):** All entries in `docs/architecture/functional_registry/` are complete with hypotheses, rationale, and invariants.
- [ ] **Gate 5.4 (Clean CI/CD Deployment):** GitHub Actions canary build passes, ready for zero-downtime deployment.
