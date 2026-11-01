# Spec: Live Voice FSM & Realtime Protocol Hardening (SPEC-06)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `Live Voice Session Aggregate`, `Auto-VAD`, `Dual-Sided Handshake Invariant`, `Tactile Barge-In`, `Trap-Free FSM`. Harmonizes [`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - Turn transition latency: p50 $\le 20$ms, p99 $\le 60$ms between audio packet receipt and FSM state transition.
  - Barge-in acoustic suppression: $\le 15$ms ramp ducking and instant upstream cancellation.
  - Concurrency: Zero race conditions or unhandled state resurrection under high packet jitter or immediate socket drop.
  - Data classification tier: `Internal` (Realtime PCM audio chunks, candidate voice transcripts).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Frontend audio worklet DSP processor**: `frontend/public/audio/live-audio-processor.js`.
2. **Sandbox execution engine**: `backend/src/services/sandbox/*` (governed by SPEC-07).
3. **HTTP REST authentication**: `backend/src/routes/*` (governed by SPEC-05).
4. **Local Docker builds**: No Docker builds or heavy test runs on VPS (Rule 0).

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Headless session FSM and client frame router seams:
  - `backend/src/services/live/sessionFsm.ts`
  - `backend/src/services/live/liveAudioStreamRouter.ts`
  - `backend/src/services/live/liveWsClientFrameHandler.ts`
  - `frontend/src/audio/NativeLiveVoiceEngine.ts`
  - `frontend/src/hooks/useLiveAudioSession.ts`
- **Real-Wire Dependencies**: Real WebSocket connection loopback in headless test runner (`tests/liveVoiceEngine.test.ts`). Zero internal mocks for `SessionFsm`.
- **Environment Invariant (Strict Rule 0)**:
  - Local VPS: ONLY fast static typechecking (`export PATH="/home/djelu/.local/node/bin:$PATH" && cd backend && npx tsc --noEmit`).
  - Cloud CI/CD: Automated acoustic loopback tests, Auto-VAD canary, and WebSocket fault-injection in GitHub Actions cloud runner via `remote-verify`.

## 4. Formal Wire & Messaging Contracts

### 4.1. Headless Session FSM Transition Matrix
```typescript
export type SessionState =
  | 'INIT'
  | 'CANDIDATE_LISTENING'
  | 'CANDIDATE_SPEAKING'
  | 'COMMITTING'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'TERMINATED';

export const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  INIT: ['AI_SPEAKING', 'CANDIDATE_LISTENING', 'COMMITTING', 'TERMINATED'],
  CANDIDATE_LISTENING: ['CANDIDATE_SPEAKING', 'COMMITTING', 'AI_SPEAKING', 'TERMINATED'],
  CANDIDATE_SPEAKING: ['COMMITTING', 'CANDIDATE_LISTENING', 'AI_SPEAKING', 'TERMINATED'],
  COMMITTING: ['AI_THINKING', 'AI_SPEAKING', 'CANDIDATE_LISTENING', 'TERMINATED'],
  AI_THINKING: ['AI_SPEAKING', 'CANDIDATE_LISTENING', 'TERMINATED'],
  AI_SPEAKING: ['CANDIDATE_LISTENING', 'CANDIDATE_SPEAKING', 'TERMINATED'],
  TERMINATED: [] // STRICT INVARIANT: ZERO TRANSITIONS OUT OF TERMINATED
};
```

### 4.2. Upstream Tactile Barge-In Wire Frame
```json
{
  "realtimeInput": {
    "interruption": true
  }
}
```

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Pure in-memory state machine and protocol handler refinement. Zero database schema migrations or persistence dependencies.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Terminal State Immutability
- **Pre-Conditions {P}**:
  - `SessionFsm._state === 'TERMINATED'`.
- **Algorithm C**:
  1. Any call to `sessionFsm.transition(to)` executes `if (this._state === 'TERMINATED') return false;`.
  2. Under NO circumstances does `this._state` mutate once set to `'TERMINATED'`.
- **Post-Conditions {Q}**:
  - `sessionFsm.state` remains `'TERMINATED'`. Delayed frames arriving from client or upstream are completely dropped.

### 6.2. Auto-VAD Direct Endpointing Transition
- **Pre-Conditions {P}**:
  - `sessionFsm._state === 'CANDIDATE_SPEAKING'`.
  - Upstream Gemini Live begins streaming audio chunks (`modelTurn.parts[].inlineData`).
- **Algorithm C**:
  1. Router transitions FSM: `session.fsm.transition('AI_SPEAKING')`.
  2. Transition is validated as legal by `VALID_TRANSITIONS['CANDIDATE_SPEAKING']`.
  3. No error or warning is logged; state machine updates cleanly to `AI_SPEAKING`.
- **Post-Conditions {Q}**:
  - `sessionFsm.state === 'AI_SPEAKING'`. Candidate microphone locked; playout queue streaming.

### 6.3. Upstream Tactile Barge-In Forwarding
- **Pre-Conditions {P}**:
  - Candidate triggers tactile click while AI is speaking (`sessionFsm._state === 'AI_SPEAKING'`).
  - Client WebSocket sends `{ type: 'barge_in' }` frame.
- **Algorithm C**:
  1. `handleIncomingFrame` identifies `isBargeIn === true`.
  2. Disarm watchdogs: `session.watchdogs?.disarmAll()`.
  3. Reset playout queues and local state.
  4. Forward interruption signal to upstream socket:
     ```typescript
     if (session.geminiSocket?.readyState === WebSocket.OPEN) {
       session.geminiSocket.send(JSON.stringify({ realtimeInput: { interruption: true } }));
     }
     ```
  5. Transition FSM: `session.fsm.transition('CANDIDATE_LISTENING')`.
- **Post-Conditions {Q}**:
  - Upstream model instantly aborts audio synthesis. Playout silenced; mic immediately unblocked.

### 6.4. Compatibility Adapter Method Delegation
- **Pre-Conditions {P}**:
  - Client component invokes `sendTextMessage(text)`, `sendCanvasDelta(delta)`, or `sendCustomFrame(frame)` via `useLiveAudioSession`.
- **Algorithm C**:
  1. Validate underlying engine instance `engineRef.current`.
  2. Forward call directly to `engineRef.current.sendTextMessage(...)` or `engineRef.current.sendCustomFrame(...)`.
  3. If engine disconnected $\rightarrow$ no-op without crashing.
- **Post-Conditions {Q}**:
  - User messages and Mermaid canvas synchronization frames reach the live session aggregate without silent data loss.
