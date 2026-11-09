# 02: [Tracer-Bullet] Speculative Ducking Demolition & Echo Rejection Calibration

**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** ready-for-agent  

## What to Build
Dismantle the naive speculative ducking check (`rmsDb > -38`) in `frontend/src/audio/liveMicChunkDispatcher.ts` and `frontend/src/services/audioDuckingController.ts`. When AI speaks through laptop/phone speakers, acoustic bleed reaches $-35$ to $-28$ dBFS at the mic. Align acoustic speech gating during `AI_SPEAKING` with `gemini_live_reference/AcousticFilter.ts`:
1. Remove `speculativeDuck` calls that attenuate AI volume on room noise or speaker feedback.
2. Calibrate acoustic barge-in threshold to $RMS \ge 0.035$ ($\approx -29$ dBFS) with minimum phonation duration $\ge 180$ ms ($\ge 6$ consecutive 32ms frames).
3. Transient noise spikes (`isTransientSpike: true` or $<180$ms) are rejected without modifying playout volume.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/audio/liveMicChunkDispatcher.ts`, `frontend/src/audio/NativeLiveVoiceEngine.ts`
- **Verification Command:** `node --loader ts-node/esm frontend/tests/liveVoiceEngine.test.ts` (and remote CI `remote-verify`)

## Embedded Contract Slice & Invariants
- **Invariant:** AI voice playing through speakers must never duck itself or trigger false acoustic barge-in.
- **Phonation Threshold:** Minimum $-29$ dBFS and $\ge 180$ ms sustained non-transient energy required to trigger local acoustic barge-in.

## Explicit Non-Goals
- Do not disable tactile barge-in (central button or Spacebar).
- Do not disable Google Native Cloud VAD endpointing during `LISTENING`.

## Acceptance Criteria
- [ ] Speculative ducking during `AI_SPEAKING` is removed; AI audio does not stutter or drop volume.
- [ ] Acoustic barge-in is immune to speaker bleed below $-29$ dBFS.
- [ ] Desk knocks and transient clicks are safely ignored without altering master gain.
