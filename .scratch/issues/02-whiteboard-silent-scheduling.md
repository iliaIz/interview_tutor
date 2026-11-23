## Parent
Part of #128

## Archetype
Tracer-Bullet

## Pre-Agreed Verification Seam
- **Primary Seam**: `backend/src/services/live/LiveToolEngine.ts`, `backend/src/services/live/liveWorkspaceHandlers.ts`, `backend/src/services/live/LiveGreetingReplay.ts`.
- **Verification Command**: `remote-verify`

## What to Build
Change `update_whiteboard` scheduling mode from `WHEN_IDLE` to `SILENT` in `LiveToolEngine.ts` and `handleUpdateWhiteboard` in `liveWorkspaceHandlers.ts`. In `LiveGreetingReplay.ts`, prevent duplicate workspace project trees in Turn 0 `clientContent.turns`.

## Embedded Contract Slice & Invariants
```typescript
{
  name: 'update_whiteboard',
  handler: handleUpdateWhiteboard,
  scheduling: 'SILENT',
  ...
}
```

## Explicit Non-Goals
- Do not remove whiteboard visual updates to client WebSocket.
- Do not modify client-side whiteboard store.

## Acceptance Criteria
- [ ] `update_whiteboard` tool returns `scheduling: 'SILENT'` in toolResponse to Gemini Live.
- [ ] Gemini does not plan or execute unsolicited spoken chatter turns after whiteboard mutation.
