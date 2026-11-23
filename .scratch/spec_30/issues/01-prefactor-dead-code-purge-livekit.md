# 01: [Prefactor] Purge Abandoned LiveKit Audio Session Prototype

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Purge the 550-line abandoned `frontend/src/hooks/useLiveKitAudioSession.ts` prototype file.
Verify that zero imports or bindings remain in the frontend application.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: Workspace filesystem & TypeScript compiler.
- **Dependencies**: None.
- **Verification Command**: `git grep "useLiveKitAudioSession"` returns 0 results; `remote-verify` passes frontend build.

## Embedded Contract Slice & Invariants
- Invariant: Zero parallel reimplementation (Rule 8 in `AGENTS.md`). Live streaming is governed solely by `LiveVoiceEngine`.
- Deletion Test: Deleting `useLiveKitAudioSession.ts` produces zero regression or missing dependencies.

## Explicit Non-Goals
- Do NOT touch `backend/src/routes/voice.ts` or LiveKit server token generation if configured for other tooling.
- Do NOT modify `LiveVoiceEngine.ts` or any active voice pipelines.
