# Issue 02: [Tracer-Bullet] Frontend Silent Hot Reconnect & Turn 0 Lockdown Recovery

Part of #123
**Archetype:** Tracer-Bullet
**Blocked by:** #01
**Status:** ready-for-agent

## What to Build
Update `NativeLiveVoiceEngine` to cleanly handle silent/reconnected `setupComplete` frames from backend. When `reconnected: true` or `silent: true`, immediately force `isTurn0Lockdown = false` and invoke `unlockCandidateTurn()` to unlock candidate microphone without waiting for non-existent audio playback. Add idempotent guard to `commitSpokenTurn()`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/audio/NativeLiveVoiceEngine.ts`
- **Dependencies**: Headless engine seam
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- `commitSpokenTurn()` only executes if `this.fsm.isCandidateTurnActive() === true` and state is NOT already `COMMITTING` or `AI_THINKING`.
- On `setupComplete` with `reconnected: true` or `silent: true`: `isTurn0Lockdown = false`, `fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: false })`, `unlockCandidateTurn()`.

## Explicit Non-Goals
Forbidden to modify prompt builders, database schemas, or Web Audio DSP.

## Acceptance Criteria
- [ ] Silent reconnect immediately unlocks candidate mic
- [ ] `commitSpokenTurn()` is strictly idempotent
- [ ] File size $\le 400$ lines maintained (Rule 8)
