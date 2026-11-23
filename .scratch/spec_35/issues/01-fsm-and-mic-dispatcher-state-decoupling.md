# Issue 01: [Tracer-Bullet] Frontend FSM & Mic Dispatcher State Decoupling

Part of #123
**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decouple `COMMITTING` from `'LISTENING'` in `LiveVoiceStateMachine`. When candidate speech cessation triggers `commitSpokenTurn()`, `COMMITTING` must expose `'CONNECTING'` as its public state. In `liveMicChunkDispatcher`, freeze all outgoing audio chunk streaming and silence counters while in `COMMITTING` or `AI_THINKING`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/audio/LiveVoiceStateMachine.ts` & `frontend/src/audio/liveMicChunkDispatcher.ts`
- **Dependencies**: Pure unit verification seam
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- `fsm.getPublicState()` returns `'CONNECTING'` when internal state is `'COMMITTING'`.
- In `dispatchChunk`: if `state !== 'LISTENING'`, drop audio transmission and reset counters to 0.

## Explicit Non-Goals
Forbidden to modify audio worklet DSP, backend services, or UI components.

## Acceptance Criteria
- [ ] `LiveVoiceStateMachine`: `COMMITTING` public state is `'CONNECTING'`
- [ ] `liveMicChunkDispatcher`: No `realtimeInput.audio` chunks streamed while `state !== 'LISTENING'`
- [ ] `liveMicChunkDispatcher`: Silence counters cannot re-trigger `onCommitSpokenTurn` while committing
