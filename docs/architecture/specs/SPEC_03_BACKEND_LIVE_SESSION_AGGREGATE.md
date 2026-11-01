# Spec: Backend Live Session Aggregate & Watchdog Lifeline Consolidation (SPEC-003)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `LiveSessionAggregate`, `Anemic Data Bag`, `Turn 0 Lockdown`. Supersedes procedural mutations in [`01_backend_live_audio_router.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/functional_registry/01_backend_live_audio_router.md).
- **Operating Envelope**:
  - Connection upgrade to audio stream latency: p95 $\le 120$ ms (SQLite pre-warm + Gemini WebSocket handshake).
  - Watchdog accuracy: Informational nudge at $5.0 \pm 0.1$s; hard dead-air clamp at $22.0 \pm 0.2$s.
  - Concurrency: Up to 50 concurrent real-time audio sessions per Node.js process without event loop lag ($< 25$ ms).
  - Data classification tier: `Internal` (ephemeral interview voice sessions & transcripts).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Frontend audio worklets & hooks**: `frontend/src/audio/*`.
2. **Tool implementation modules**: `backend/src/services/live/LiveToolEngine.ts`, `backend/src/services/live/workspaceManifestStore.ts`, and domain tool handlers.
3. **External proxy configuration**: `LiteLLM_Proxy` docker compose or configuration files.
4. **Database schema definitions**: SQLite `migrations` or table creation scripts.

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Factory entrypoint `LiveVoiceSession.start(clientSocket: WebSocket, req: http.IncomingMessage)` in [`backend/src/services/live/LiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveVoiceSession.ts).
- **Real-Wire Dependencies**: Upstream LiteLLM Proxy WebSocket or live loopback fixture [`backend/tests/test_hr_acoustic_canary.js`](file:///home/djelu/projects/interview_tutor/backend/tests/test_hr_acoustic_canary.js). Zero in-memory mock objects at the session boundary.

## 4. Formal Wire & Messaging Contracts

### 4.1. Clean Factory Interface
```typescript
export interface SessionStartupOptions {
  clientSocket: WebSocket;
  request: http.IncomingMessage;
  earlyQueue?: Buffer[];
  cleanupEarlyCapture?: () => void;
}

export class LiveVoiceSession {
  /**
   * Encapsulates parameter resolution, DB pre-warming, prompt construction,
   * upstream connection establishment, and watchdog initialization.
   */
  public static async start(options: SessionStartupOptions): Promise<LiveVoiceSession>;

  /** Private session state & watchdogs - ZERO public anemic field mutations */
  private readonly id: string;
  private readonly fsm: SessionFsm;
  private readonly watchdogs: WatchdogManager;
  private readonly upstreamRouter: LiveAudioStreamRouter;
  
  /** External control signals */
  public handleClientFrame(raw: WebSocket.RawData): void;
  public terminate(reason: string, code?: number): void;
}
```

### 4.2. Eliminated Procedural Parameter Chains
- Deprecate loose 45-parameter return from `resolveLiveWsSessionParams()`.
- Encapsulate `session_init` JSON decoding, challenge manifest hydration, and question lookups into `SessionConfigurationResolver`.
- Eliminate manual `nudgeWatchdog` and `deadAirWatchdog` mutations across disjoint files. All timeouts are managed via `WatchdogManager` with strict cancellation on turn boundaries.

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive encapsulation with in-place deprecation.
- **File Hygiene**:
  - `LiveVoiceSession.ts`: New deep aggregate $\le 300$ lines.
  - `WatchdogManager.ts`: Dedicated watchdog timer manager $\le 120$ lines.
  - `liveWsConnectionHandler.ts`: Reduced from 298 lines to $\le 60$ lines (delegates directly to `LiveVoiceSession.start`).

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Turn Commitment Handshake
- **Pre-Conditions {P}**:
  - `session.state === 'CANDIDATE_SPEAKING'`
  - Received `{ clientContent: { turnComplete: true } }` or acoustic VAD endpoint signal
- **Algorithm C**:
  1. Atomic transition `fsm.transition('COMMITTING')`.
  2. Cancel `deadAirWatchdog` and start informational `nudgeWatchdog` (5.0s).
  3. Flush trailing candidate audio frames.
  4. Dispatch upstream Gemini `turnComplete` or `audioStreamEnd`.
  5. Transition `fsm.transition('AI_THINKING')`.
- **Post-Conditions {Q}**:
  - `session.state === 'AI_THINKING'`
  - Nudge watchdog active; dead-air watchdog disarmed.
  - Candidate mic input temporarily muted pending AI speech.
- **Orthogonal Invariants**:
  - A session MUST NEVER get stuck in `COMMITTING`. If upstream disconnects or fails to respond within 22.0s, `WatchdogManager` forces transition to `AI_SPEAKING` (canned recovery) or reclaims candidate mic.
