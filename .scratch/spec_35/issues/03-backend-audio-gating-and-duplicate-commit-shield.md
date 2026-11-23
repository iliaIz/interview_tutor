# Issue 03: [Tracer-Bullet] Backend Downstream Pipe Audio Gating during `isAiGenerating` & Duplicate Commit Shield

Part of #123
**Archetype:** Tracer-Bullet
**Blocked by:** #01
**Status:** ready-for-agent

## What to Build
Update backend `DownstreamClientPipe` and `liveClientGuardService` to:
1. Debounce and drop duplicate `audioStreamEnd` frames if `session.isAiGenerating === true`.
2. Gate mic audio chunks during `session.isAiGenerating === true` in Auto-VAD mode, so ambient silence/breath does NOT stream upstream and cause Google Gemini to abort generation (unless explicit `isBargeIn` is flagged).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/DownstreamClientPipe.ts` & `backend/src/services/live/liveClientGuardService.ts`
- **Dependencies**: WebSocket downstream pipe seam
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- `DownstreamClientPipe.handleFrame`: if `parsed.realtimeInput?.audioStreamEnd` arrives while `session.isAiGenerating === true`, drop with warning.
- `liveClientGuardService.shouldSuppressEchoChunk`: if `session.isAiGenerating === true` and NOT `isBargeIn`, suppress chunk even in `auto` mode to prevent aborting active generation.

## Explicit Non-Goals
Forbidden to modify prompt builders, tool engines, or database schemas.

## Acceptance Criteria
- [ ] Duplicate `audioStreamEnd` frames are dropped cleanly
- [ ] Non-barge-in audio frames during `isAiGenerating` are suppressed from reaching upstream Google Live
- [ ] File sizes $\le 350$ lines maintained (Rule 8)
