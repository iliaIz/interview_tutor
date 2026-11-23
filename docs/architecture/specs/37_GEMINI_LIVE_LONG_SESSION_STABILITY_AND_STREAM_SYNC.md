# Spec 37: Gemini Live Long Session Stability, Vocoder Clamping & Session Resumption

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing specifications: `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`, `docs/architecture/specs/36_GEMINI_LIVE_PRACTICE_PAIR_RESILIENCE.md`, `gemini_live_reference/docs/specs/context/02_SESSION_RESUMPTION_AND_LIFECYCLE.md`, `gemini_live_reference/docs/specs/context/03_NON_BLOCKING_TOOLS_AND_LOCKDOWN.md`, `gemini_live_reference/packages/bff-gateway/src/deadAirGuard.ts`, `GLOSSARY.md`.
- **Target Workload & Problem Statement**:
  - In technical screening and practice arenas (e.g. Alfa-Bank `practice_pair`), multimodal voice tutoring sessions frequently extend beyond 15–30 minutes of continuous bidirectional streaming.
  - Empirical verification in session `session_practice_1795466330568_5rlf6v` demonstrated that while the first 8 turns had optimal TTFA latency (136ms–656ms), by minute 20+ the absence of native Session Resumption and vocoder digital silence clamping caused severe degradation: TTFA delays of 50.5s, 28.9s, and 8.2s, with 19 repeated `DEAD_AIR_WATCHDOG` timeouts.
  - Root cause analysis against the authoritative reference (`gemini_live_reference`) identified three physical protocol gaps:
    1. **Missing `LiveDeadAirGuard` on Audio Router:** The Gemini 3.8 Live vocoder frequently emits trailing digital silence frames ($RMS \le 0.005$) holding the turn open without sending `turnComplete: true`. Without `LiveDeadAirGuard`, the router does not clamp silence at 2000ms, trapping client playout until the 25s watchdog fires.
    2. **Missing `ToolAudioMutex` during Tool Executions:** During tool execution (`update_whiteboard`, `read_file`), microphone chunks are not gated, causing concurrent audio streaming into an active tool call and corrupting Google's turn state.
    3. **Missing Native Session Resumption (`sessionResumptionConfig.handle`):** The session ran for 28.5 minutes on a single un-resumed connection without tracking `sessionResumptionUpdate.newHandle` or supporting seamless socket recreation, accumulating massive KV-cache attention debt.
- **Operating Envelope**:
  - TTFA SLA under Continuous Dialogue (>30 mins): < 1.0s p50, < 2.5s p95, < 5.0s p99.
  - Vocoder Stall Elimination: 100% of trailing digital silence frames $\ge 2000$ms clamped to clean `turnComplete: true`.
  - Tool Audio Mutex: 100% of microphone frames gated during active tool execution (zero error 1008).
  - Native Session Resumption: 100% of `sessionResumptionUpdate` handles cached; reconnections pass `sessionResumptionConfig.handle`.

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Physically forbidden modifications:
  - DO NOT modify `LiteLLM_Proxy/` internal gateway routing logic or Docker configuration.
  - DO NOT alter SQLite schema or run database migrations (`coding_challenges`, `questions`, `interview_evaluations`).
  - DO NOT alter `update_whiteboard` scheduling mode: per reference `03_NON_BLOCKING_TOOLS_AND_LOCKDOWN.md`, UI mutations MUST remain `scheduling: "SILENT"`.
  - DO NOT inject synthetic `clientContent` frames on watchdog timeout (violates Rule 2.6 and causes turn collisions).
  - DO NOT modify low-level AudioWorklet ring buffer math in `playoutWorkletCode.ts` or `captureWorkletCode.ts`.

## 3. Pre-Agreed Verification Seams
- **Primary Backend Seams**:
  - `backend/src/services/live/LiveDeadAirGuard.ts`: Exact port of `gemini_live_reference/packages/bff-gateway/src/deadAirGuard.ts`.
  - `backend/src/services/live/liveAudioStreamRouter.ts`: Integration of `LiveDeadAirGuard` on incoming PCM stream.
  - `backend/src/services/live/ToolAudioMutex.ts`: Exact port of `gemini_live_reference/packages/core/src/tools/ToolAudioMutex.ts`.
  - `backend/src/services/live/DownstreamClientPipe.ts`: Mic gating via `ToolAudioMutex.shouldGateMicAudio()`.
  - `backend/src/services/live/SessionResumptionManager.ts`: Port of `gemini_live_reference/packages/core/src/context/SessionResumptionManager.ts`.
  - `backend/src/services/live/liveGeminiConfigBuilder.ts`: Setup frame builder injecting `sessionResumptionConfig.handle`.
- **Verification Strategy**: Remote verification suite via GitHub Actions (`remote-verify`).

## 4. Formal Wire & Messaging Contracts

### 4.1. Vocoder Stall Clamping Contract (`LiveDeadAirGuard`)
From `gemini_live_reference/packages/bff-gateway/src/deadAirGuard.ts`:
```typescript
export interface DeadAirInspectionResult {
  suppressFrame: boolean;
  synthesizeTurnComplete: boolean;
}

export class LiveDeadAirGuard {
  // Suppresses digital silence (>1200ms) and clamps turn at >=2000ms
  public inspectAudioFrame(isZeroEnergy: boolean): DeadAirInspectionResult;
  public reset(): void;
}
```
When `inspection.synthesizeTurnComplete` is true, router dispatches:
```json
{
  "serverContent": {
    "turnComplete": true,
    "deadAirClamped": true
  }
}
```

### 4.2. Tool Audio Mutex Wire Contract
From `gemini_live_reference/packages/core/src/tools/ToolAudioMutex.ts`:
```typescript
export class ToolAudioMutex {
  public acquire(toolCallId: string): void;
  public release(toolCallId: string): void;
  public cancel(ids: string[]): void;
  public shouldGateMicAudio(): boolean;
  public reset(): void;
}
```

### 4.3. Session Resumption Wire Contract
From `gemini_live_reference/packages/core/src/protocol/frameDecoder.ts`:
```json
{
  "setup": {
    "model": "models/gemini-live-v3",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 1.0
    },
    "sessionResumptionConfig": {
      "handle": "active_cryptographic_handle_token"
    }
  }
}
```
Incoming handle tracking:
```typescript
// Incoming from upstream Google:
if (parsed.sessionResumptionUpdate?.resumable && parsed.sessionResumptionUpdate?.newHandle) {
  session.resumptionHandle = parsed.sessionResumptionUpdate.newHandle;
}
```

## 5. Storage & Zero-Downtime Migration Contract
- **Schema Impact**: None (Zero DDL changes).
- **Stateless Compatibility**: Backwards-compatible across all existing WebSocket clients.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Vocoder Digital Silence Clamping
- **Pre-Conditions {P}**: Upstream Gemini emits active speech, followed by continuous zero-energy frames ($RMS \le 0.005$) without sending `turnComplete`.
- **Algorithm C**: `LiveDeadAirGuard` detects `elapsedSilenceMs >= 2000ms`, suppresses the silence frame, and synthesizes `{ serverContent: { turnComplete: true, deadAirClamped: true } }`.
- **Post-Conditions {Q}**: Client receives clean turn completion, `AudioPlayoutManager` drains physical DAC buffer, and candidate microphone unlocks in $\le 2.0$s without waiting for 25s watchdog.

### 6.2. Tool Audio Mutex Gating
- **Pre-Conditions {P}**: Upstream Gemini emits `toolCall`; candidate mic continues streaming ambient sound.
- **Algorithm C**: `ToolAudioMutex.acquire(callId)` marks mutex active. `DownstreamClientPipe` checks `shouldGateMicAudio()` and suppresses outgoing `realtimeInput.audio` chunks until all tool calls receive `toolResponse` via `release(callId)`.
- **Post-Conditions {Q}**: Upstream Google never receives interleaved mic audio while awaiting tool execution; 0 occurrences of error `1008 Policy Violation`.

### 6.3. Native Session Resumption Tracking
- **Pre-Conditions {P}**: Upstream Gemini emits `sessionResumptionUpdate` with `resumable === true`.
- **Algorithm C**: `SessionResumptionManager.update(update)` persists `newHandle`. Upon any socket reconnection or hot handoff, `liveGeminiConfigBuilder` populates `setup.sessionResumptionConfig: { handle }`.
- **Post-Conditions {Q}**: Google restores active KV-cache and latent acoustic embeddings seamlessly; TTFA latency remains bounded < 1.0s p50 across long dialogues.
