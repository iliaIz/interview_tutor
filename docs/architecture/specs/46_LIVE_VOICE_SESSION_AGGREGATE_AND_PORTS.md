# Spec 46: Deep `LiveVoiceSession` Aggregate, `UpstreamTransportPort` & Elimination of Mutable Bag Leakage

> **Governing Glossary:** `LiveSessionAggregate`, `Turn 0 Lockdown`, `Dual-Sided Handshake` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Bidirectional 16kHz/24kHz WS stream

---

## 1. Intent & Workload Envelope
Collapse the shallow shim cluster around `LiveVoiceSession` (`liveWsConnectionHandler.ts` [23L], `liveWsClientFrameHandler.ts` [42L], `sessionStartupHelper.ts` [87L], `liveWsTurnCommitHandler.ts` [116L], plus redundant `LiveSessionAggregate.ts`), encapsulate mutable session/turn state internally (`SessionTurnState`), remove duplicate `terminate()` and legacy fallback `nudgeWatchdog`/`deadAirWatchdog` timers, and introduce an explicit `UpstreamTransportPort` so integration tests run directly against `LiveVoiceSession` without assembling 91-field `ProxySession` mocks.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT weaken Spec 36–42 streaming invariants: Auto-VAD continuous PCM streaming, `ToolAudioMutex`, `LiveDeadAirGuard` 2000ms clamping, `LiveHotHandoffCoordinator` Make-Before-Break `goAway`, `LiveStreamSentinel` passive monitoring, or `WHEN_IDLE` whiteboard speech sync.
- Keep individual source files strictly `<= 350` lines (new) and `<= 400` lines (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `LiveVoiceSession.start(options, upstreamPort?)` with 4 public methods (`handleClientFrame`, `terminate`, `getSnapshot`, plus static `start`) and internal `SessionTurnState`.
- **Dependencies:** `ports & adapters` (`UpstreamTransportPort`: production WS adapter vs headless in-memory socket adapter in `testStreamRouterMock.ts` / `testVadFaultInjection.ts` / `testLiveWsProtocol.ts`).
- **Verification Commands (CI):** `npm run test:vad:fault-injection && npm run test:telemetry:router && npm run test:live:tool-isolation && npm run test:vad:canary`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface UpstreamTransportPort {
  open(url: string, setupFactory: () => unknown): WebSocket;
}

export interface LiveVoiceSessionSnapshot {
  readonly sessionId: string;
  readonly state: LiveSessionState;
  readonly isSetupComplete: boolean;
  readonly hasCandidateResponded: boolean;
  readonly isTerminated: boolean;
}

export class LiveVoiceSession {
  public static start(options: SessionStartupOptions, upstreamPort?: UpstreamTransportPort): Promise<LiveVoiceSession | null>;
  public handleClientFrame(raw: RawData): void;
  public terminate(reason?: string, code?: number, source?: string): void;
  public getSnapshot(): LiveVoiceSessionSnapshot;
}
```
- All shallow handlers (`liveWsConnectionHandler.ts`, `liveWsClientFrameHandler.ts`, `sessionStartupHelper.ts`, `liveWsTurnCommitHandler.ts`, `LiveSessionAggregate.ts`) are folded into `LiveVoiceSession`, `SessionTurnState`, and `DownstreamClientPipe`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Pure in-memory session lifecycle & existing `liveSessionRegistry` replay store; zero DDL modifications.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid authenticated WebSocket `clientSocket` + HTTP `req` (plus optional `earlyQueue` / `UpstreamTransportPort`).
- `{C}` Resolve `LiveSessionBlueprint`, allocate internal `SessionTurnState`, execute turn custody transitions and watchdog resets solely through `SessionTurnState` / `WatchdogManager` / `LiveStreamSentinel`, and execute single-path `terminate()` idempotently.
- `{Q}` `ProxySession` bag never crosses `LiveVoiceSession`'s public interface; single-call `terminate()` disposes `WatchdogManager`, `LiveStreamSentinel`, `LiveHotHandoffCoordinator`, heartbeat, sockets, and flushes valid Russian turn memory identically from any caller; Turn 0 grading lock still blocks premature evaluation calls.
