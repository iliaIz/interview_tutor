## Parent
Part of #128

## Archetype
Tracer-Bullet

## Pre-Agreed Verification Seam
- **Primary Seam**: `backend/src/services/live/UpstreamGeminiPipe.ts`, `backend/src/services/live/LiveVoiceSession.ts`, `backend/src/services/live/liveAudioStreamRouter.ts`.
- **Verification Command**: `remote-verify`

## What to Build
Eliminate zombie hot reconnects on normal client closures (`code=1000 Normal Closure`, `code=1001 Going Away`). Ensure `LiveVoiceSession.terminate()` calls `router.close() -> pipe.close()`, which sets `isClosed = true` and clears any pending reconnect timers. In `UpstreamGeminiPipe.ts`, if `code === 1000 || code === 1001 || this.isClosed || isNonRetryable`, do not schedule reconnect attempts.

## Embedded Contract Slice & Invariants
```typescript
if (this.isClosed || code === 1000 || code === 1001) {
  return;
}
```

## Explicit Non-Goals
- Do not modify LiteLLM Proxy python code.
- Do not alter SQLite databases.

## Acceptance Criteria
- [ ] Closing client socket with code 1000 results in immediate upstream socket closure with zero reconnect timers.
- [ ] No zombie sessions spawned in LiteLLM Gateway after user disconnect.
