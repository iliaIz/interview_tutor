# 04: [Tracer-Bullet] VAD Timing Calibration (800ms) & Company Prep Stage 1 Launch Guard

**Archetype:** Tracer-Bullet  
**Blocked by:** #02  
**Parent:** #81  
**Status:** ready-for-agent  

## What to Build
Align VAD pause timing in Company Prep Studio Stage 1 with the canonical 800ms calibration proven in VAD Lab Step 6:
1. In `frontend/src/components/companies/CompanyPrepStudio.tsx`, pass explicit `vadPauseMs={800}` and `sessionType="interview"` to `<VoiceModal>`.
2. In `backend/src/services/live/SessionConfigurationResolver.ts`, ensure that if `vadPauseMs` is omitted or invalid, it defaults to `800` (canonical Cloud VAD standard) rather than the legacy `1800` ms.
3. Clean up the Stage 1 system prompt override in `CompanyPrepStudio.tsx` to ensure concise turn pacing and avoid contradictory finalize directives.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/components/companies/CompanyPrepStudio.tsx` and `backend/src/services/live/SessionConfigurationResolver.ts`.
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
- Canonical VAD standard: `vadPauseMs: 800` (synchronized with Silero VAD fast-handoff and Google Cloud VAD).
- Elimination of the 1800ms pause lag during spoken exchanges.

## Explicit Non-Goals
- Modifying other company prep tracks (Tinkoff, Yandex, etc.).
- Changing SQL arena or WASM challenge targets.

## Acceptance Criteria
- [ ] Company Prep Studio Stage 1 initializes voice session with `vadPauseMs: 800`.
- [ ] Backend fallback defaults `vadPauseMs` to `800` if not specified.
- [ ] Speech endpointing occurs with clean ~800ms cadence without awkward lag.
- [ ] All tests pass via `remote-verify`.
