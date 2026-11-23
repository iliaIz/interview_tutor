# 03: [Prefactor] UpstreamGeminiPipe Live Audio Transport Boundary

**Archetype:** Prefactor
**Blocked by:** None
**Status:** ready-for-agent

## What to Build
Extract upstream WebSocket connection management, Turn 0 frame gating, backoff reconnection, and raw frame decoding out of `backend/src/services/live/liveAudioStreamRouter.ts` into a dedicated `UpstreamGeminiPipe` class. Provide typed turn events (`SETUP_COMPLETE`, `GREETING_READY`, `AUDIO_CHUNK`, `TOOL_CALL`, `TURN_FINISHED`, `ERROR`) to downstream coordinators. Reduce `liveAudioStreamRouter.ts` from 379 lines to &le; 240 lines while preserving its exact public API (`createLiveAudioStreamRouter`).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/UpstreamGeminiPipe.ts` & `backend/src/services/live/liveAudioStreamRouter.ts`.
- **Dependencies**: In-memory / Mock WebSocket pairs (`testStreamRouterMock.ts`, `test_live_tool_silence_isolation.js`).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
export type UpstreamTurnEvent =
  | { type: 'SETUP_COMPLETE' }
  | { type: 'GREETING_READY'; greetingText: string }
  | { type: 'AUDIO_CHUNK'; audioData: Buffer; text?: string }
  | { type: 'TOOL_CALL'; callId: string; toolName: string; args: any }
  | { type: 'TURN_FINISHED'; audioBytes: number; transcript: string; wasBargeIn: boolean }
  | { type: 'INTERRUPTED' }
  | { type: 'ERROR'; errorCode: string; retryable: boolean; message: string };

export interface UpstreamGeminiPipe {
  connect(isInternalReconnect?: boolean): void;
  sendClientInput(input: { audioChunk?: Buffer; audioStreamEnd?: boolean }): void;
  sendToolResponse(responsePayload: any): void;
  subscribe(handler: (event: UpstreamTurnEvent) => void): () => void;
  close(code?: number, reason?: string): void;
}
```

## Explicit Non-Goals
- Modifying client WebSocket protocols or AudioWorklet DSP on the frontend.
- Altering `LiveDeadAirGuard` or `LiveCannedErrorRecovery` business logic.

## Acceptance Criteria
- [ ] `UpstreamGeminiPipe.ts` is &le; 280 lines and encapsulates WebSocket lifecycle, UTF-8 parsing, and backoff jitter.
- [ ] `liveAudioStreamRouter.ts` delegates upstream transport to `UpstreamGeminiPipe` and shrinks to &le; 240 lines.
- [ ] Existing mock streaming and silence isolation tests pass without regressions.
