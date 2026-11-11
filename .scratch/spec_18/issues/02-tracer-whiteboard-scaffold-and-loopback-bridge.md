# 02: [Tracer-Bullet] Whiteboard Scaffold Generator & Loopback Bridge (:41790)

**Archetype:** Tracer-Bullet  
**Blocked by:** #01  
**Status:** ready-for-agent  

## What to Build
Implement the backend standalone project generator `tutor-whiteboard.zip` and the frontend headless hook `useWhiteboardIdeBridge`. The bridge runs on a dedicated loopback port (`ws://127.0.0.1:41790`) isolated from the task code bridge. The user downloads a minimal Java 21 project containing `Whiteboard.java` and `bridge.mjs`. When edited in IntelliJ, saves push updates to `useAppStore.updateIdeTrackedContent()` and dispatch `workspace_file_updated`. Mount `WhiteboardIdeModal` for 1-click download and setup.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/whiteboardScaffoldGenerator.ts` and `frontend/src/hooks/useWhiteboardIdeBridge.ts`
- **Dependencies**: Node.js loopback WebSocket on port `41790`, Express router
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Port Invariant**: Dedicated port `41790` strictly separated from Task Bridge on `41789`. Zero collision during concurrent runs.
- **Archive Contents (`/api/whiteboard/export-zip`)**:
  - `pom.xml`: Java 21 LTS Maven configuration for IDE syntax validation
  - `src/main/java/Whiteboard.java`: Clean starter scratchpad
  - `bridge.mjs`: Node.js loopback server on `:41790` with SHA-256 EchoGuard
  - `wsServer.mjs`: RFC 6455 server
  - `run-bridge.sh` / `run-bridge.cmd`: OS launchers
- **Hook Protocol**:
  - Automatically connects to `ws://127.0.0.1:41790`
  - On `FILE_UPDATED` (origin: 'ide'): updates `updateIdeTrackedContent()` and fires `workspace_file_updated` with `path: 'Whiteboard.java'`
  - Exposes `checkoutCode(content: string): void` to push code to disk

## Explicit Non-Goals
- Do NOT touch existing task export `/api/practice/:id/export-zip`.
- Do NOT modify audio worklets.

## Acceptance Criteria
- [ ] `GET /api/whiteboard/export-zip` generates valid zip with Java 21 `pom.xml`, `Whiteboard.java`, and `bridge.mjs` (:41790)
- [ ] `useWhiteboardIdeBridge` connects to port `41790` with auto-reconnect and heartbeat
- [ ] `WhiteboardIdeModal` displays connection status, instructions, and download button
- [ ] Saving `Whiteboard.java` updates store in $\le 60$ms
