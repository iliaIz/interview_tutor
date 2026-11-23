# 03: [Prefactor] Downstream Client Frame Pipe & Invariant Router

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Consolidate client frame parsing, ping/pong heartbeats, barge-in dispatches, and audio stream routing into `DownstreamClientPipe.ts`.
1. Currently, client incoming WebSocket frames are split between `liveWsClientFrameHandler.ts` (296 lines) and `liveAudioStreamRouter.ts` (285 lines).
2. Create `DownstreamClientPipe.ts` (&le; 300 lines) encapsulating incoming client frame validation, ping/pong response, sync_pong response, barge-in triggering, workspace context updates, and forwarding clean PCM audio packets into `LiveSessionAggregate`.
3. Eliminate cyclic state mutations and ensure strict compliance with ADR 0004 and the Auto-VAD Live Audio Specification.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/DownstreamClientPipe.ts` and `liveWsClientFrameHandler.ts`.
- **Dependencies**: Node.js `ws`, `LiveSessionAggregate`, `LiveClientGuardService`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Protocol SLA: Zero 1007 close codes on barge-in.
- Cognitive Bounding (Rule 8): `DownstreamClientPipe.ts` &le; 300 lines; `liveWsClientFrameHandler.ts` &le; 200 lines.

## Explicit Non-Goals
- Changing upstream WebSocket format to LiteLLM / Google Gemini.
- Modifying client-side AudioWorklet processor.

## Acceptance Criteria
- [ ] `DownstreamClientPipe.ts` encapsulates frame parsing, heartbeats, and barge-in.
- [ ] Both `liveWsClientFrameHandler.ts` and `liveAudioStreamRouter.ts` delegate cleanly without cyclic mutations.
- [ ] Remote verification (`remote-verify`) passes 100% green.
