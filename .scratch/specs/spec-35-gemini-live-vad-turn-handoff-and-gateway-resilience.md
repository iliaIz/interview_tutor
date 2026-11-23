# Spec 35: Gemini 3.8 Live Auto-VAD Voice Turn Handoff, State Machine Idempotency & Gateway Resilience

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md), and [gemini_live_reference](../../../gemini_live_reference/AGENTS.md).
- **Operating Envelope**:
  - Voice Turn Commit Latency: $\le 20$ms handoff from client Silero VAD speech cessation to upstream `{ realtimeInput: { audioStreamEnd: true } }`.
  - Zero-Audio Interleaving Guarantee: 0 audio frames streamed upstream between `audioStreamEnd` and model turn completion (unless acoustic barge-in RMS $\ge -29$ dBFS $\times 7$ frames).
  - Gateway Resilience: 0 false-positive 60s key bans on WebSocket error 1008 client inactivity.
  - Cognitive Bounding SLA: All modified files $\le 400$ lines, all new files $\le 350$ lines (Rule 8 strictly enforced).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/prompts/` (Prompt invariant, anti-sycophancy, and cognitive epistemic directives remain untouched).
2. Database schemas and SQLite migration files (All database structures are frozen).
3. `frontend/src/components/` UI presenters except as directly consumers of state.
4. Core Web Audio Worklet DSP algorithms in `frontend/src/audio/MicrophoneCapture.ts` and `AudioPlayoutManager.ts`.

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **Frontend Voice FSM** | `frontend/src/audio/LiveVoiceStateMachine.ts` | Pure state machine | `COMMITTING` public state is `'CONNECTING'` (not `'LISTENING'`), trap-free recovery on `DEAD_AIR_RECOVERED` / `BARGE_IN_TRIGGERED` |
| **Mic Chunk Dispatcher** | `frontend/src/audio/liveMicChunkDispatcher.ts` | Headless audio dispatcher | Freeze chunk streaming & trailing silence commit during `COMMITTING` and `AI_THINKING` |
| **Voice Engine Lifecycle** | `frontend/src/audio/NativeLiveVoiceEngine.ts` | Headless orchestrator | Silent/reconnected `setupComplete` resets `isTurn0Lockdown = false` and unlocks mic; idempotent `commitSpokenTurn()` |
| **Backend Downstream Pipe** | `backend/src/services/live/DownstreamClientPipe.ts` & `liveClientGuardService.ts` | WebSocket downstream pipe | Discard duplicate `audioStreamEnd` during `isAiGenerating`; suppress non-barge-in audio chunks during generation |
| **LiteLLM Gateway** | `LiteLLM_Proxy/gateway/app/routers/live.py` | FastAPI Live WS router | Exclude `1008 Session closed due to client inactivity` from Circuit Breaker key cooldown |

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Fast-Handoff Stream Separation Contract
```typescript
// Client-to-Backend / Backend-to-Upstream Fast Handoff Frame
{
  "realtimeInput": {
    "audioStreamEnd": true
  }
}
```
- Invariant 1: No audio PCM chunks (`realtimeInput.audio`) may be transmitted concurrently or sequentially after `audioStreamEnd` until `serverContent.modelTurn` begins or an explicit `bargeIn: true` is emitted.
- Invariant 2: Backend `DownstreamClientPipe` drops duplicate `audioStreamEnd` frames arriving within 1000ms while `session.isAiGenerating === true`.

### 4.2. Silent Reconnection Handshake Contract
```typescript
// Backend-to-Client setupComplete on Hot Reconnect
{
  "type": "setupComplete",
  "hasInitialUserMessage": false,
  "reconnected": true,
  "silent": true
}
```
- When `reconnected: true` or `silent: true`, client `NativeLiveVoiceEngine` MUST immediately transition FSM to `CANDIDATE_LISTENING` and unlock candidate microphone without waiting for audio playout drain.

### 4.3. LiteLLM Proxy Circuit Breaker Error Discrimination Contract
- Error code `1008` (Policy Violation):
  - IF error string contains `quota`, `resource_exhausted`, or `rate limit` $\rightarrow$ set key cooldown (60s).
  - IF error string contains `inactivity`, `idle`, or normal policy closure $\rightarrow$ DO NOT set key cooldown; treat as standard disconnect.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only / Backward-Compatible (No DB changes).
- **Zero-Downtime**: Seamless client reconnects without API key pool starvation.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Turn Commit Transition
- **Pre-Conditions {P}**:
  - `fsm.currentState === 'CANDIDATE_LISTENING'` (or `CANDIDATE_SPEAKING` / `CANDIDATE_HOLD`).
  - Candidate vocalized for $\ge 4$ frames and trailing silence $\ge 25$ frames ($\approx 500$ms).
- **Algorithm C**:
  - `fsm.transition({ type: 'COMMIT_TRIGGERED' })`.
  - State becomes `COMMITTING`. `getPublicState()` returns `'CONNECTING'`.
  - Send `{ realtimeInput: { audioStreamEnd: true } }`.
  - In `liveMicChunkDispatcher`: while state is not `'LISTENING'`, all audio chunk streaming and silence counters are frozen.
- **Post-Conditions {Q}**:
  - Upstream receives a single `audioStreamEnd`.
  - Upstream vocoder/generation is NOT interrupted by trailing mic bleed.
  - FSM transitions cleanly to `AI_SPEAKING` on first audio frame or `CANDIDATE_LISTENING` on watchdog recovery.

### 6.2. Silent Hot Reconnect
- **Pre-Conditions {P}**:
  - Upstream socket reconnected after network drop; backend sends `{ type: 'setupComplete', reconnected: true, silent: true }`.
- **Algorithm C**:
  - Client checks `reconnected === true || silent === true`.
  - Forces `isTurn0Lockdown = false`.
  - Dispatches `fsm.transition({ type: 'SETUP_COMPLETE', isTurn0: false })`.
  - Invokes `unlockCandidateTurn()`.
- **Post-Conditions {Q}**:
  - Candidate mic is immediately unlocked (`state === 'LISTENING'`).
  - Session does not hang in `AI_RECITING_QUESTION`.
