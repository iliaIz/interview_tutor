# 04: [Tracer-Bullet] Encapsulate LiveVoiceSessionAggregate and Eliminate Anemic Session Bag

**Parent:** Spec 23 (`spec-23-codebase-deepening-and-seam-consolidation.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** None (can start immediately)  
**Status:** closed  

## What to Build
1. Refactor `LiveVoiceSession` (`backend/src/services/live/LiveVoiceSession.ts`) into a true, deep **Aggregate Root**:
   - Provide minimal public interface: `LiveVoiceSession.start(options)`, `handleClientMessage(raw)`, `terminate(reason, code)`.
   - Encapsulate the 70+ loose mutable fields of `ProxySession` inside private aggregate state.
   - Internalize session authentication (`sessionConfigAuth.ts`) and startup literal construction (`sessionStartupHelper.ts`) directly into configuration resolution and initialization.
   - Internalize turn commit handling (`liveWsTurnCommitHandler.ts`) and chunk guards (`liveClientGuardService.ts`) as private aggregate methods.
2. Delete shallow pass-through files:
   - `backend/src/services/live/liveWsConnectionHandler.ts` (23-line single-function forwarder).
   - `backend/src/services/live/liveWsSessionParams.ts` (23-line deprecated shim).
   - `backend/src/services/live/sessionStartupHelper.ts` (75-line data assembler).
   - `backend/src/services/live/sessionInitFrameMerger.ts` (40-line property copier).
   - `backend/src/services/live/sessionConfigAuth.ts` (22-line auth wrapper).
3. Update `backend/src/services/geminiLiveProxy.ts`:
   - Call `LiveVoiceSession.start(...)` directly on WebSocket connection, deleting the unnecessary `handleLiveClientConnection` intermediary.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/LiveVoiceSession.ts` via `/ws/live` WebSocket connection.
- **Dependencies**: LiteLLM Proxy Live WebSocket endpoint (`ws://host.docker.internal:4000/ws/live`), SQLite DB.
- **Verification Command**: `node backend/tests/test_live_tool_clarification.js && node backend/tests/test_hr_voice_simulator_engine.js` (or cloud runner `remote-verify`).

## Embedded Contract Slice & Invariants
- Hoare Logic {P} C {Q}:
  - {P}: Client connects to `/ws/live`.
  - C: `LiveVoiceSession.start()` authenticates, resolves config, and orchestrates upstream and downstream sockets.
  - {Q}: Session functions identically. 5 shallow pass-through files are deleted. Turn 0 tool lockdown, dual-sided handshake, and two-phase watchdogs remain 100% intact.
- Rule 8 Limit: Modified files $\le 400$ lines.

## Explicit Non-Goals
- Do not alter LiteLLM Proxy configuration or upstream model routing.
- Do not alter `livePromptBuilder.ts` system prompt generation directives.

## Acceptance Criteria
- [ ] 5 shallow helper files deleted from `backend/src/services/live/`.
- [ ] `geminiLiveProxy.ts` calls `LiveVoiceSession.start` directly.
- [ ] Live Voice invariant test suites (`test_live_tool_clarification.js`, `test_hr_voice_simulator_engine.js`) pass with 0 errors.
- [ ] Zero unhandled state mutations outside aggregate methods.
