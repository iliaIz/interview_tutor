# Phase 5: Contract Tests, Canary Matrix & Functional Registry
## SOTA Late-2026 Verification & SSOT Compliance

> **Document:** `docs/roadmap/wave_20_hands_free_voice_batch_navigation_and_continuity/PHASE_05_CONTRACT_TESTS_CANARY_MATRIX_AND_REGISTRY.md`  
> **Status:** Draft / Pending User Approval  
> **Target Subsystem:** Test Suites (`backend/src/tests/`, `frontend/tests/`), Functional Registry (`docs/architecture/functional_registry/`)  

---

## 1. Automated Verification Strategy

To guarantee that hands-free navigation never regresses dialogue stability or evaluation accuracy, Wave 20 introduces automated contract assertions across the stack:

### A. Backend Navigation Tool Contract Tests

1. **Tool Invariant & Schema Validation:**
   - Assert `navigate_question` is present in `getLiveToolDeclarations()` for all batch modes.
   - Assert schema requires `direction` and `action` with strict enum bounds.
2. **Interview Skip Penalty Contract:**
   - Assert that invoking `navigate_question(direction='next', action='skip_unanswered')` creates a 0-point evaluation record in DB, records FSRS decay gap, and dispatches `{ type: 'evaluation' }` to client.
3. **Boundary Constraint Contracts:**
   - Assert `direction='prev'` at index 0 returns `BLOCKED_AT_START` to Gemini.
   - Assert `direction='next'` at last index maps to `finish_batch`.
4. **Prompt Invariant Assurance:**
   - Run `npx tsx backend/src/scripts/verifyPrompts.ts` asserting negative anti-collision directives are embedded in all interview/tutor prompts.

### B. Frontend Audio Playout & FSM Contracts

1. **Tear-Free Reconnect Contract:**
   - Simulate incoming `navigation_action`.
   - Assert `AudioPlayoutManager.isPlaying()` holds disconnection until physical buffer drains.
   - Assert mic is muted during transition.
2. **State & Index Sync Contract:**
   - Assert `VoiceModal` updates `activeBatchIndex` and fires parent `onIndexChange`.
   - Assert repeated attempts cleanly override previously failed scores upon new evaluation.

---

## 2. Functional Registry Updates (Rule 10 SSOT)

Update `docs/architecture/functional_registry/04_client_voice_engine_dsp.md` with section **2.14: Voice-Driven Hands-Free Batch Navigation & Dialogue Continuity Protocol**:
- Rationale & "Why": Eliminating UI click requirements for mobile, commuting, and ambient tutoring.
- What Was Done: Tool declaration, negative prompt gating, playout-drained reconnect FSM.
- Invariants Enforced: Context purity via atomic micro-sessions, zero-audio-tear dual-sided handshake, fair skip scoring.

---

## 3. Gate 5 Verification Criteria

- [ ] All backend and frontend unit/contract tests pass with 100% green status.
- [ ] TypeScript check (`npx tsc --noEmit`) passes cleanly in all submodules (backend, frontend, shared).
- [ ] Functional Registry and Domain Specs updated per Rule 9 and Rule 10.
- [ ] Push to `feat/wave-20-hands-free-voice-navigation` passes GitHub Actions CI/CD with zero docker build violations on VPS (Rule 0).
