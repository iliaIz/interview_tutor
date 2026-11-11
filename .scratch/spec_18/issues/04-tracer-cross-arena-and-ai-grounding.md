# 04: [Tracer-Bullet] Cross-Arena Whiteboard Sync & Gemini Live Grounding

**Archetype:** Tracer-Bullet  
**Blocked by:** #02, #03  
**Status:** ready-for-agent  

## What to Build
Connect the Whiteboard IDE sync and context grounding across all three arenas where Whiteboard operates: `PracticeArena`, `TransactionLabArena`, and `VoiceModal`. Ensure `VoiceModal` listens for `workspace_file_updated` and forwards frames to its Live Voice session via `sendCustomFrame`. Ensure backend `handleReadFile` resolves `Whiteboard.java` or `whiteboard` from `session.workspaceManifest` or active whiteboard state. When the user switches versions on the whiteboard canvas, automatically sync the active version to `session.workspaceManifest` so Gemini Live's `read_file` tool sees the exact code visible on screen (WYSIWYG Grounding).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/VoiceModal.tsx` and `backend/src/services/live/liveWorkspaceHandlers.ts`
- **Dependencies**: Live WebSocket gateway, Gemini Live `read_file` tool handler
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **WYSIWYG Grounding Invariant**: Whichever version is selected on the whiteboard canvas is the authoritative content returned by `read_file('Whiteboard.java')`.
- **Zero Audio Pollution**: Whiteboard code updates flow strictly via `{ type: 'workspace_file_update', path: 'Whiteboard.java', content }` into session manifest memory; NEVER injected as raw text turns into 16kHz PCM audio streams.
- **Cross-Arena Availability**:
  - `PracticeArena`: Works alongside Task Code Sync on `:41789` without interference.
  - `TransactionLabArena`: Full whiteboard sync support.
  - `VoiceModal`: Enables IDE coding during oral architectural and mock interviews.

## Explicit Non-Goals
- Do NOT disable Native Cloud VAD or modify audio worklets.
- Do NOT modify database question repositories.

## Acceptance Criteria
- [ ] `VoiceModal` listens for `workspace_file_updated` and sends custom frames to Live Voice session
- [ ] `handleReadFile` resolves `Whiteboard.java` accurately from session manifest
- [ ] Switching active version on whiteboard updates in-memory manifest for `read_file`
- [ ] Concurrent sync in PracticeArena (task on `:41789` + whiteboard on `:41790`) operates without cross-talk
