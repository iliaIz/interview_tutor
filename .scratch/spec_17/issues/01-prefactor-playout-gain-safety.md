# 01: [Prefactor] Master Playout Gain Safety in AudioPlayoutManager

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Eliminate the permanent muting trap in `frontend/src/services/AudioPlayoutManager.ts`. In `handleInterruption()`, remove `masterGain.gain.linearRampToValueAtTime(0.0, now + 0.005)`. De-ramping audio samples pop-free is already handled by the AudioWorklet ring buffer (`gemini-audio-processor.js`) upon receiving `{ type: 'flush' }`. Ensure that `masterGain.gain` is preserved at its nominal level ($1.5$) during and after interruptions, and whenever new PCM chunks arrive in `enqueuePcmChunk(base64)` (unless the candidate explicitly enabled Mute).

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/services/AudioPlayoutManager.ts`
- **Verification Command:** `node --loader ts-node/esm frontend/tests/audioPlayoutContracts.test.ts` (and remote CI `remote-verify`)

## Embedded Contract Slice & Invariants
```typescript
public handleInterruption(): void {
  this.clearQueue();
  if (this.masterGain && this.context && this.context.state !== 'closed' && !this.isMuted) {
    const now = this.context.currentTime;
    try {
      this.masterGain.gain.cancelScheduledValues?.(now);
      this.masterGain.gain.setValueAtTime?.(1.5, now);
    } catch {}
  }
}
```
- **Invariant:** Master playout gain must never remain locked at $0.0$. Subsequent audio chunks must play at full nominal volume ($1.5$) without requiring manual un-ducking or microphone tapping.

## Explicit Non-Goals
- Do not modify `gemini-audio-processor.js`.
- Do not remove candidate mute controls (`setMuted`).

## Acceptance Criteria
- [ ] `handleInterruption()` dispatches flush to AudioWorklet without setting `masterGain` to 0.0.
- [ ] `enqueuePcmChunk()` ensures `masterGain` is restored to 1.5 if not muted.
- [ ] All existing playout contract assertions remain 100% green.
