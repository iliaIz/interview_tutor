# 02: [Tracer-Bullet] Deepen LiveWorkspaceContext and Frame Demuxer

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** closed (verified in production CI/CD run 45084957707)

## What to Build
Deepen `LiveWorkspaceContext` to become the authoritative aggregate for live challenge state, active file tracking, and XML grounding in live sessions. Refactor `liveWsClientFrameHandler.ts` to delegate incoming `session_init`, `workspace_active_file_changed`, and `workspace_file_update` events directly to `LiveWorkspaceContext.applyClientFrame(frame)`, eliminating 18+ direct property mutations on the anemic `ProxySession` bag.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/LiveWorkspaceContext.ts` & `backend/src/services/live/liveWsClientFrameHandler.ts`
- **Verification Command**: `remote-verify` (running Live WS protocol and Auto-VAD canary tests)

## Embedded Contract Slice & Invariants
- `LiveWorkspaceContext` encapsulates:
  - `applyClientFrame(frame: ClientWsFrame): boolean`
  - `getActiveFile(): { path: string; content: string } | null`
  - `getManifestXml(): string`
- Collapses `StreamRouterOptions` in `liveAudioStreamRouter.ts` to 3 core parameters (`session`, `clientSocket`, `upstreamWsUrl`).

## Explicit Non-Goals
- Do not modify AudioWorklet DSP (`live-audio-processor.js`).
- Do not alter VAD thresholds in `liveGeminiConfigBuilder.ts`.

## Acceptance Criteria
- [ ] `LiveWorkspaceContext.ts` handles active file diffs and manifest updates ($\le 350$ lines).
- [ ] `liveWsClientFrameHandler.ts` delegates to `LiveWorkspaceContext.applyClientFrame` instead of mutative session field sets.
- [ ] All Auto-VAD and Gemini Live fault-injection tests pass.
