# 01: [Prefactor] Symmetrical Keepalive Ping/Pong Protocol & Extended Inactivity Ceiling

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Parent:** #81  
**Status:** ready-for-agent  

## What to Build
Implement symmetrical keepalive ping/pong frames between frontend and backend to keep long-running voice sessions alive through proxies (Caddy, nginx) and prevent unexpected `1006 Abnormal Closure` timeouts when the candidate pauses or thinks:
1. Frontend `NativeLiveVoiceEngine` listens for incoming `{ type: 'ping', timestamp }` from backend and immediately responds with `{ type: 'pong', timestamp }`.
2. Frontend `NativeLiveVoiceEngine` runs an autonomous 20s heartbeat interval sending `{ type: 'ping', timestamp }` when WebSocket is in `OPEN` state.
3. Backend `liveWsClientFrameHandler.ts` records `session.lastActivityAt = Date.now()` upon receiving `pong` or `ping`.
4. Backend `LiveVoiceSession.ts` inactivity limit is relaxed from 180s (3m) to 900s (15m) for voice interviews, accommodating deliberate engineering thought during interviews.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `backend/src/services/live/liveWsClientFrameHandler.ts`, `backend/src/services/live/LiveVoiceSession.ts`, and `frontend/src/audio/NativeLiveVoiceEngine.ts`.
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
// Frontend Ping Handler
if (parsed.type === 'ping' || parsed.rawParsed?.type === 'ping') {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: 'pong', timestamp: parsed.timestamp || Date.now() }));
  }
  return;
}
```
- Inactivity threshold invariant: `session.lastActivityAt` MUST be refreshed by incoming audio or heartbeat pong.
- Zero premature kill: Sessions with active network transport MUST NOT be severed within 15 minutes of idle mic.

## Explicit Non-Goals
- Modifying `LiteLLM_Proxy/` internal gateway python code.
- Altering the audio PCM encoding format (remains 16kHz Mono PCM).

## Acceptance Criteria
- [ ] Backend updates `lastActivityAt` upon receipt of client `pong` frames.
- [ ] Client automatically replies with `pong` when server emits `ping`.
- [ ] Client emits periodic 20s `ping` keepalives when connected.
- [ ] Inactivity timeout is extended to 900s (15 min).
- [ ] All tests pass via `remote-verify`.
