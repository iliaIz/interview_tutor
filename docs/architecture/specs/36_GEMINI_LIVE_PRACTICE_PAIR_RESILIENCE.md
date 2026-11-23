# Spec 36: Gemini Live Practice Pair Resilience & Zombie Reconnect Elimination

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing specifications: `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`, `docs/architecture/specs/16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md`, `gemini_live_reference/docs/specs/context/03_NON_BLOCKING_TOOLS_AND_LOCKDOWN.md`, `GLOSSARY.md`.
- **Target Workload & Problem Statement**:
  - In company-targeted technical screening and practice arenas (e.g. Alfa-Bank / `practice_pair`), multimodal tutoring sessions involve continuous bidirectional audio streaming alongside dynamic tool executions (`update_whiteboard`, `read_file`).
  - Previously, `update_whiteboard` returned `scheduling: "WHEN_IDLE"`, prompting Google Gemini Live to schedule an uncoordinated secondary verbal turn, colliding with candidate speech and corrupting session turn-taking.
  - Furthermore, in multi-turn tool sessions, vocoder synthesis TTFA naturally scales as token KV-cache grows (exceeding 10–17s), colliding with the standard 22.0s `DEAD_AIR_WATCHDOG`, which abruptly severed turns and locked the session in desynchronization.
  - When candidates closed drawers normally (`code=1000 Normal Closure`), `UpstreamGeminiPipe` mistakenly scheduled hot reconnects, spawning 3 consecutive 120-second zombie sessions in LiteLLM Gateway.
  - `PracticeVoiceContext` defaulted to `vadPauseMs: 1800` (vs 800ms in `CompanyPrepStudio`), creating an unnecessary 1.8s dead-air gap.
- **Operating Envelope**:
  - Turn Commit to Speech TTFA SLA: < 2.5s p50, < 8.0s p95, < 22.0s p99.
  - Zero Zombie Connections: 100% of client closures with code 1000/1001 must terminate upstream immediately with 0 reconnect retries.
  - Tool Voice Chatter Elimination: 0 unsolicited verbal utterances after `update_whiteboard`.

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Physically forbidden modifications:
  - DO NOT modify `LiteLLM_Proxy/` internal gateway routing logic.
  - DO NOT alter SQLite schema or run database migrations (`coding_challenges`, `questions`, `interview_evaluations`).
  - DO NOT alter core Web Audio Worklet ring buffer math (`playoutWorkletCode.ts`, `captureWorkletCode.ts`).
  - DO NOT modify audio playback DAC draining logic in `AudioPlayoutManager.ts`.

## 3. Pre-Agreed Verification Seams
- **Primary Backend Seam**: `backend/src/services/live/UpstreamGeminiPipe.ts`, `backend/src/services/live/LiveVoiceSession.ts`, `backend/src/services/live/LiveToolEngine.ts`, `backend/src/services/live/liveWorkspaceHandlers.ts`.
- **Primary Frontend Seam**: `frontend/src/components/practice/tutor/PracticeVoiceContext.tsx`, `frontend/src/audio/liveMicChunkDispatcher.ts`.
- **Verification Strategy**: Remote verification suite via GitHub Actions (`remote-verify`).

## 4. Formal Wire & Messaging Contracts

### 4.1. Tool Response Wire Contract (`update_whiteboard`)
```json
{
  "toolResponse": {
    "functionResponses": [
      {
        "id": "call_12304271403678179259",
        "name": "update_whiteboard",
        "response": {
          "result": {
            "status": "SUCCESS",
            "message": "Интерактивная доска обновлена на экране кандидата."
          }
        },
        "scheduling": "SILENT"
      }
    ]
  }
}
```

### 4.2. Upstream Termination Contract
```typescript
interface TerminationContract {
  code: number; // e.g. 1000 (Normal Closure), 1001 (Going Away)
  source: 'ClientSocket' | 'Application' | 'KeepaliveTimeout' | 'UpstreamPipeClose';
  allowReconnect: boolean; // MUST be false when code === 1000 || code === 1001 || isTerminated === true
}
```

### 4.3. Watchdog Calibration Contract
```typescript
interface WatchdogThresholds {
  isThinkingOrToolHeavy: boolean; // true if liveModel.includes('thinking') || tutorMode === 'practice_pair' || hasActiveTools
  phase1NudgeMs: number; // 5000ms standard, 8000ms tool-heavy
  phase2TimeoutMs: number; // 22000ms standard, 25000ms tool-heavy
}
```

## 5. Storage & Zero-Downtime Migration Contract
- **Schema Impact**: None (Zero DDL changes).
- **Stateless Compatibility**: Backwards-compatible across all existing WebSocket clients.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Whiteboard Tool Scheduling
- **Pre-Conditions {P}**: Upstream Gemini emits `toolCall` for `update_whiteboard`.
- **Algorithm C**: Execute DOM/client update payload, return `toolResponse` with `scheduling: "SILENT"`.
- **Post-Conditions {Q}**: Client receives `whiteboard_update` event; Gemini records updated board context in TPU attention memory WITHOUT generating speech tokens.

### 6.2. Upstream Reconnect Suppression
- **Pre-Conditions {P}**: Client WebSocket emits `close` event with `code === 1000` (or `1001`).
- **Algorithm C**: `LiveVoiceSession.terminate()` calls `router.close()`, which calls `pipe.close()`. In `UpstreamGeminiPipe`, `isClosed = true`, active reconnect timers are cleared (`clearTimeout`), and `handleSocketClose` checks `if (code === 1000 || code === 1001 || this.isClosed) return;`.
- **Post-Conditions {Q}**: No reconnect is scheduled. 0 zombie sockets created in `litellm-gateway`.

### 6.3. Practice Arena VAD Pause Alignment
- **Pre-Conditions {P}**: User opens AI-Напарник in `PracticeArena`.
- **Algorithm C**: `PracticeVoiceContext` initializes session with `vadPauseMs = 800` (unless explicitly overridden in config).
- **Post-Conditions {Q}**: Client and server VAD parameters align at 800ms, matching Google Live native bounds [500, 1000]ms.
