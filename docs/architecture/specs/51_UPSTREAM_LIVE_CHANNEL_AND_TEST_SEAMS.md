# Spec 51: Deep `UpstreamLiveChannel` & Real-Pipeline VAD Fault Tests

> **Governing Glossary:** `UpstreamLiveChannel`, `SessionTurnState`, `Fast-Handoff VAD` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Bidirectional 16kHz/24kHz WS bridge (`<50ms` relay overhead)

---

## 1. Intent & Workload Envelope
Eliminate the 384L churn hotspot (`liveAudioStreamRouter.ts`, 19 commits) and circular coupling (`UpstreamGeminiPipe` &harr; `LiveHotHandoffCoordinator`) by collapsing upstream connection management, standby Make-Before-Break `goAway` rotation, `LiveDeadAirGuard` clamping, `LiveCannedErrorRecovery`, `LiveTelemetryAccumulator`, and `LiveGreetingReplay` behind a single deep `UpstreamLiveChannel` implementing an expanded `UpstreamTransportPort`. Remove public `session.geminiSocket` mutation from `ProxySession` across `DownstreamClientPipe`, `LiveToolEngine`, `SessionTurnState`, `LiveGreetingReplay`, and `LiveCannedErrorRecovery`. Simultaneously replace 7 inline contradicting mock tests in `testVadFaultInjection.ts` (1,171L) plus re-implemented helper copies in `testTelemetryEngine.ts` and `test_spec37_deadair_mutex_resumption.js` with direct calls against production modules.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT weaken Invariants 2.1–2.9: `ToolAudioMutex` mic gating, `LiveDeadAirGuard` `>1200ms` suppress / `>=2000ms` clamp, `LiveCannedErrorRecovery` `<no speech>` verbal nudge, `WHEN_IDLE`/`SILENT` tool scheduling, or `goAway` Make-Before-Break standby handoff.
- Do NOT alter `LiveSessionBlueprintBuilder` public seam established in Spec 45.
- Every newly created or modified source file under `backend/src/services/live/` remains `<= 350` lines (new) / `<= 400` lines (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `UpstreamLiveChannel` behind `UpstreamTransportPort` (`connect`, `sendUpstream`, `isUpstreamOpen`, `reconnect`, `close`) + `DownstreamClientPipe.handleFrame`.
- **Adapters (`ports & adapters`):** Production `WebSocket` adapter connecting to LiteLLM Gateway; loopback WebSocket (`createSocketPair`) or injected `UpstreamSocketPort` in `testLiveWsProtocol.ts`, `testStreamRouterMock.ts`, and `testVadFaultInjection.ts`.
- **Verification Commands (CI):** `npm run test:vad:unit && npm run test:vad:fault-injection && npm run test:telemetry:engine && npm run test:telemetry:router && npm run test:vad:canary && npm run test:live:tool-isolation && npm run test:hr && node tests/test_spec37_deadair_mutex_resumption.js`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface UpstreamTransportPort {
  connect(): void;
  sendUpstream(payload: string | Buffer): boolean;
  isUpstreamOpen(): boolean;
  reconnect(reason?: string): void;
  close(code?: number, reason?: string): void;
}
```
- **Socket Custody Migration:** `ProxySession.geminiSocket` is removed from public consumers (`DownstreamClientPipe`, `LiveToolEngine`, `SessionTurnState`, `LiveGreetingReplay`, `LiveCannedErrorRecovery`, `LiveVoiceSession`); all callers invoke `session.upstreamTransport.sendUpstream(...)` and `session.upstreamTransport.isUpstreamOpen()`.
- **Contradicting Mock Removal (`testVadFaultInjection.ts`):**
  - Replace Tests 2, 3, 4, 6, 7, 8, 9 inline closures with calls to real `DownstreamClientPipe.handleFrame`, `LiveClientGuardService`, and `SessionTurnState.handleTurnCommit`.
  - Align Test 6 (0-chunk `turnComplete` dispatches `[КАНДИДАТ ПЕРЕДАЛ СЛОВО...]` recovery or honors real `SessionTurnState` guard) and Test 7 (`chunksCount > 0` clears `STALE_GUARD` per real `LiveClientGuardService.evaluateTurnCompleteGuard`).
  - Point `testTelemetryEngine.ts` at real `LiveTelemetryAccumulator` and `test_spec37_deadair_mutex_resumption.js` at real `LiveDeadAirGuard` / `ToolAudioMutex` / `SessionResumptionManager` exports in `dist/`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Pure transport / session lifecycle refactor; zero SQLite schema changes. `createLiveAudioStreamRouter` can stay as an internal factory or thin delegate inside `UpstreamLiveChannel.ts` during Expand-Migrate-Contract until removed when all imports switch to `UpstreamLiveChannel`.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `LiveSessionBlueprint` + internal `ProxySession` + `UpstreamTransportPort` connected to client socket.
- `{C}` Buffer standby frames cleanly during `goAway` Make-Before-Break swap, clamp digital silence `>= 2000ms`, strip `toolCall` leaks alongside `serverContent`, and route every outbound control/tool/audio frame via `UpstreamTransportPort.sendUpstream`.
- `{Q}` Zero split-brain writes bypass `UpstreamLiveChannel` during socket swap; `close()` terminates active & standby sockets idempotently with zero zombie reconnects after `this.isClosed = true`; all 14 fault-injection tests assert real production code paths rather than diverging inline mocks.
