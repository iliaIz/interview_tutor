# 03: [Tracer-Bullet] Consolidate Loopback IDE Companion Service (IdeBridgeConnection)

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** closed (verified in production CI/CD run 45084957707)

## What to Build
Create a deep, headless `IdeBridgeConnection` module in `frontend/src/services/IdeBridgeConnection.ts` that consolidates the 85% duplicated loopback WebSocket transport, 15s heartbeat pings, exponential reconnect backoff, and port multiplexing (:41789 for task arena, :41790 for whiteboard). Refactor `useIdeBridge.ts` and `useWhiteboardIdeBridge.ts` into thin adapters, and replace untyped `window.dispatchEvent('workspace_file_updated')` with a typed observer / callback seam.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/IdeBridgeConnection.ts`
- **Verification Command**: `remote-verify` (running frontend production build & contract tests)

## Embedded Contract Slice & Invariants
- `IdeBridgeConnection` public API:
  - `connect(): void`
  - `disconnect(): void`
  - `sendFileUpdate(path: string, content: string): void`
  - `status: IdeBridgeStatus`
- Replaces untyped `window.CustomEvent` with typed callback `onFileUpdated(path, content)`.

## Explicit Non-Goals
- Do not change IDE companion modal UI layouts in `IdeIntegrationModal.tsx` or `WhiteboardIdeModal.tsx`.
- Do not modify external IntelliJ IDEA plugin protocol contracts.

## Acceptance Criteria
- [ ] `IdeBridgeConnection.ts` encapsulates loopback WS lifecycle and reconnect logic ($\le 350$ lines).
- [ ] `useIdeBridge.ts` and `useWhiteboardIdeBridge.ts` delegate to `IdeBridgeConnection` ($\le 150$ lines each).
- [ ] Frontend builds cleanly with zero TypeScript errors.
