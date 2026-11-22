# 01: [Tracer-Bullet] Seal Frontend Voice Hook Seam and Eliminate Leaked Playout Manager

**Parent:** Spec 24 (`spec-24-architectural-deepening-and-seam-hardening.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
Seal the frontend voice hook interface by removing the leaked `playoutManagerRef` and `(engineRef.current as any)` typecast. Consolidate tactile barge-in, manual turn commit, and button toggles into a single authoritative `handleInteraction()` method. Update `SystemDesignArena.tsx` and `PracticeVoiceContext.tsx` to call `handleInteraction()` directly, eliminating the active bug where tactile barge-in silences Web Audio without notifying Gemini Live upstream. Remove the dead `playoutManager` argument from `liveMicChunkDispatcher.ts`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/audio/useLiveVoiceSession.ts` & `frontend/tests/liveAudioSessionContracts.test.ts`
- **Verification Command:** `npm --prefix frontend run test:audio-contracts`
- **Dependencies:** Web Audio & Playout Contract fixtures (zero network mocks).

## Embedded Contract Slice & Invariants
- `UseLiveVoiceSessionReturn` contract from Spec 24 Section 4.1.
- Invariant: Zero `playoutManagerRef` property on the returned hook object.
- Invariant: Tactile click during AI speech must trigger both local audio drain and upstream cancellation frame.

## Explicit Non-Goals
- Modifying `AudioPlayoutManager.ts` DSP ring buffer internals.
- Changing visual layout in `VoiceModalHeader.tsx` or `SystemDesignArena.tsx`.

## Acceptance Criteria
- [ ] `(engineRef.current as any)?.playoutManager` removed from `useLiveVoiceSession.ts`.
- [ ] `SystemDesignArena.tsx` calls `handleInteraction()` on tactile barge-in.
- [ ] `PracticeVoiceContext.tsx` delegates `handleCentralButtonClick` to `handleInteraction()`.
- [ ] Dead `playoutManager` parameter removed from `liveMicChunkDispatcher.ts`.
- [ ] `npm --prefix frontend run test:audio-contracts` passes 100%.
