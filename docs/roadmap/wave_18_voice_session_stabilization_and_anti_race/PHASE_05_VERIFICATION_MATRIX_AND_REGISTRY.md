# Phase 5: Verification Matrix, Multi-Turn Replay & Functional Registry Update

> **Document:** `PHASE_05_VERIFICATION_MATRIX_AND_REGISTRY.md`  
> **Status:** Pending Execution  
> **Target Subsystem:** Test Automation, CI/CD Quality-Gate & Architectural Registry  
> **Cognitive Limit:** <= 180 lines  

---

## 1. Scope & Verification Strategy

Phase 5 validates the complete conjunction of Voice Session Stability, Turn 0 Recitation Protection, and Zero-Race Batch Progression across both headless test harnesses and the remote CI/CD pipeline.

---

## 2. Test Execution Matrix

### 2.1. Headless Acoustic Multi-Turn Replay
Run simulated headless client against the live backend socket:
```bash
docker exec interview-backend-api node -e "/* Multi-turn assertion script */"
```
Assertions:
1. `setupComplete` received within 2.0s.
2. Turn 0 greeting audio contains $\ge 1200$ bytes and $\ge 10$ characters of text.
3. Zero pre-connection microphone chunks leaked to Gemini Live.
4. Turns 1, 2, 3 complete with natural candidate speech handoffs and sub-second TTFA without client disconnects.

### 2.2. Pre-Flight Canary Suite
Ensure all 4 canary scenarios pass in CI/CD without regressions:
- Canary 1: Multi-turn dialogue (2 turns)
- Canary 2: Acoustic barge-in interruption
- Canary 3: Extended thinking CoT shield
- Canary 4: Code handover in practice pair mode

---

## 3. Mandatory Functional Registry Consultation & SSOT Update (Rule 10)

Upon successful verification, update:
1. `docs/architecture/functional_registry/01_backend_live_audio_router.md`:
   - Document §2.15: Pre-Connection Frame Queue Purge and Turn 0 Barge-In Shielding.
2. `docs/architecture/functional_registry/04_client_voice_engine_dsp.md`:
   - Document §2.12: Idempotent Single-Fire Ref Guards, Pre-Setup Capture Gating, and Race-Free Navigation.

---

## 4. Exit Gates & Definition of Done (DoD)

- [ ] All 5 Phase Gates passed.
- [ ] No local docker builds on VPS (Rule 0).
- [ ] Git commits cleanly created on branch `feat/wave-16-refactoring-arena-voice-review`.
- [ ] Remote CI/CD quality-gate and deployment passes with status `success`.
