# Spec 37: Gemini Live Long Session Stability, Vocoder Clamping & Upstream Synchronization

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing specifications: `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`, `docs/architecture/specs/36_GEMINI_LIVE_PRACTICE_PAIR_RESILIENCE.md`, `gemini_live_reference/docs/specs/context/02_SESSION_RESUMPTION_AND_LIFECYCLE.md`, `gemini_live_reference/docs/specs/context/03_NON_BLOCKING_TOOLS_AND_LOCKDOWN.md`, `GLOSSARY.md`.
- **Target Workload & Problem Statement**:
  - In technical screening and practice arenas (e.g. Alfa-Bank `practice_pair`), multimodal voice tutoring sessions frequently extend beyond 15–30 minutes of continuous bidirectional streaming.
  - Empirical verification in session `session_practice_1795466330568_5rlf6v` demonstrated that while the first 8 turns had optimal TTFA latency (136ms–656ms), by minute 20+ the lack of `contextWindowCompression` caused Gemini's KV-cache to accumulate >50,000 audio tokens. This resulted in catastrophic prefill degradation (TTFA: 50.5s, 28.9s, 8.2s) and 19 repeated `DEAD_AIR_WATCHDOG` timeouts.
  - Furthermore, when `DEAD_AIR_WATCHDOG` reclaimed the candidate mic at 25s, it left upstream Google generating in the cloud without cancellation or resync, causing delayed audio chunks to collide with subsequent candidate turns.
  - In addition, the absence of a server-side `LiveDeadAirGuard` allowed trailing vocoder digital silence ($RMS \le 0.005$) to keep turns open indefinitely, and `update_whiteboard` returned `scheduling: "SILENT"` without verbal follow-up, leaving the user with an unexpected mute AI.
- **Operating Envelope**:
  - TTFA SLA under Continuous Dialogue (>30 mins): < 1.0s p50, < 2.5s p95, < 5.0s p99.
  - Active KV-Cache Bound: Audio history automatically sliding-window compressed below 4,000 target tokens.
  - Vocoder Stall Elimination: 100% of trailing silence frames $\ge 2000$ms clamped to clean `turnComplete: true`.
  - Zero Zombie Audio Leaks: 0 delayed upstream audio chunks allowed to arrive after a watchdog recovery event.

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Physically forbidden modifications:
  - DO NOT modify `LiteLLM_Proxy/` internal gateway routing logic or Docker configuration.
  - DO NOT alter SQLite schema or run database migrations (`coding_challenges`, `questions`, `interview_evaluations`).
  - DO NOT modify low-level AudioWorklet ring buffer math in `playoutWorkletCode.ts` or `captureWorkletCode.ts`.
  - DO NOT modify physical DAC audio draining synchronization in `AudioPlayoutManager.ts`.

## 3. Pre-Agreed Verification Seams
- **Primary Backend Seam**:
  - `backend/src/services/live/liveGeminiConfigBuilder.ts`: Setup message payload (`contextWindowCompression`).
  - `backend/src/services/live/LiveDeadAirGuard.ts`: Vocoder digital silence inspection and turn clamping.
  - `backend/src/services/live/liveAudioStreamRouter.ts`: Stream routing with dead-air clamping and upstream resync.
  - `backend/src/services/live/LiveVoiceSession.ts` & `backend/src/services/live/WatchdogManager.ts`: Watchdog timeout upstream cancellation.
  - `backend/src/services/live/liveWorkspaceHandlers.ts`: Whiteboard follow-up verbal continuity.
- **Verification Strategy**: Remote verification suite via GitHub Actions (`remote-verify`).

## 4. Formal Wire & Messaging Contracts

### 4.1. Setup Message Contract (`contextWindowCompression`)
```json
{
  "setup": {
    "model": "models/gemini-live-v3",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 1.0
    },
    "contextWindowCompression": {
      "slidingWindow": {
        "targetTokens": 4000
      }
    },
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "silenceDurationMs": 500
      }
    }
  }
}
```

### 4.2. Vocoder Stall Clamping Contract (`LiveDeadAirGuard`)
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

### 4.3. Upstream Generation Cancellation / Resync Contract
```typescript
interface WatchdogRecoveryPayload {
  type: 'dead_air_recovery';
  reason: 'upstream_timeout';
  timestamp: number;
}
```
Upon dispatching `dead_air_recovery` to the client, the backend MUST send a cancellation/interruption frame to `geminiSocket` or flush in-flight generation:
```json
{
  "clientContent": {
    "turns": [
      {
        "role": "user",
        "parts": [{ "text": "[СИСТЕМНОЕ СОБЫТИЕ: Предыдущий ход отменен по таймауту ожидания. Слушай кандидата.]" }]
      }
    ],
    "turnComplete": true
  }
}
```

### 4.4. Whiteboard Verbal Continuity Contract
```typescript
export interface WhiteboardResultPayload {
  status: 'SUCCESS';
  message: string;
  directive: string;
}
```
`handleUpdateWhiteboard` returns `scheduling: "WHEN_IDLE"` when an `explanation` is provided so that the model articulates the solution verbally after visual rendering.

## 5. Storage & Zero-Downtime Migration Contract
- **Schema Impact**: None (Zero DDL changes).
- **Stateless Compatibility**: Backwards-compatible across all existing WebSocket clients.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Long Session Context Compression
- **Pre-Conditions {P}**: Client initiates live session that runs for $>15$ minutes.
- **Algorithm C**: `buildGeminiLiveSetupMessage` includes `contextWindowCompression: { slidingWindow: { targetTokens: 4000 } }`. Google automatically prunes trailing audio tokens when cumulative window approaches limit.
- **Post-Conditions {Q}**: Active KV-cache token count remains bounded $\le 8000$ tokens; TTFA latency p95 remains $< 2.5$s throughout 30+ minute sessions.

### 6.2. Vocoder Digital Silence Clamping
- **Pre-Conditions {P}**: Upstream Gemini emits active speech, followed by continuous zero-energy frames ($RMS \le 0.005$) without sending `turnComplete`.
- **Algorithm C**: `LiveDeadAirGuard` detects `elapsedSilenceMs >= 2000ms`, suppresses the silence frame, and synthesizes `{ serverContent: { turnComplete: true, deadAirClamped: true } }`.
- **Post-Conditions {Q}**: Client receives clean turn completion, `AudioPlayoutManager` drains physical DAC buffer, and candidate microphone unlocks in $\le 2.45$s without waiting for 25s watchdog.

### 6.3. Upstream Pipeline Resynchronization on Watchdog
- **Pre-Conditions {P}**: Model takes $\ge 25$s to respond; `watchdogs.onTimeout` fires.
- **Algorithm C**: Backend sends `{ type: 'dead_air_recovery' }` to client, marks `session.isAiGenerating = false`, and dispatches cancellation resync to `geminiSocket`.
- **Post-Conditions {Q}**: Client unlocks mic cleanly; any subsequent delayed audio chunks from Google for the timed-out turn are discarded; candidate speech starts on a clean slate.

### 6.4. Whiteboard Verbal Continuity
- **Pre-Conditions {P}**: Upstream Gemini invokes `update_whiteboard` tool with `code` and `explanation`.
- **Algorithm C**: Backend dispatches `whiteboard_update` event to client, and returns `toolResponse` with `scheduling: "WHEN_IDLE"` (or verbal prompt directive).
- **Post-Conditions {Q}**: Interactive whiteboard renders on user screen; Gemini immediately explains the code fragment aloud rather than going completely mute.
