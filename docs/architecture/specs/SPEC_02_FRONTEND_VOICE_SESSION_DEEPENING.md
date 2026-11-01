# Spec: Frontend Voice Session Deepening & Dead Clones Deletion (SPEC-002)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `Dual-Sided Handshake`, `Tactile Barge-In`, `Anti-Lapping Ring Buffer`. Supersedes ad-hoc state transitions in [`04_client_voice_engine_dsp.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/functional_registry/04_client_voice_engine_dsp.md).
- **Operating Envelope**:
  - Playout interruption latency: p99 $\le 15$ ms (tactile button click to physical DAC silence).
  - Web Audio sample rate: 16,000 Hz Mono PCM (mic capture), 24,000 Hz Mono PCM (incoming AI speech).
  - Tenancy isolation: Single-user interactive browser audio session.
  - Client resource footprint: Zero heap growth across 60-minute continuous sessions; AudioWorklet buffer cap $\le 2^{22}$ samples ($\approx 174$s).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Backend streaming router & endpoints**: `backend/src/services/live/liveAudioStreamRouter.ts`, `backend/src/services/live/LiveToolEngine.ts`, and `backend/src/routes/*`.
2. **Database schemas & ORM**: `backend/src/db.ts` and SQLite schema files.
3. **Downstream UI layout & styling**: CSS classes and visual JSX structures in `VoiceModal.tsx`, `BugHuntVoiceMentor.tsx`, and `HrScreeningArena.tsx` (only hook call interfaces and handler bindings may be touched).
4. **Third-party audio codecs**: No installation of new NPM packages or WASM binaries.

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Headless client contract at [`frontend/src/audio/NativeLiveVoiceEngine.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/NativeLiveVoiceEngine.ts) and [`frontend/src/audio/useLiveVoiceSession.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/useLiveVoiceSession.ts).
- **Real-Wire Dependencies**: Headless Web Audio API & WebSocket mock harness in [`frontend/tests/liveVoiceEngine.test.ts`](file:///home/djelu/projects/interview_tutor/frontend/tests/liveVoiceEngine.test.ts) (real timing clock, real Float32Array conversion, simulated DAC buffer drainage). Zero internal domain mocks.
- **Verification Environment Invariant (Strict Rule 0)**:
  - **Local VPS**: ONLY fast static typechecking (`export PATH="/home/djelu/.local/node/bin:$PATH" && cd frontend && npx tsc --noEmit`). Running `vitest`, `jest`, `npm test`, or `npm run build` locally on VPS is strictly prohibited and hardware-blocked.
  - **GitHub Actions CI/CD**: All Web Audio contract tests and production build verification run exclusively in cloud runners via `remote-verify`.

## 4. Formal Wire & Messaging Contracts

### 4.1. Minimal Public Hook Interface (8-Property Seam)
```typescript
export type VoiceEngineState =
  | 'IDLE'
  | 'CONNECTING'
  | 'AI_SPEAKING'
  | 'LISTENING'
  | 'COMMITTING'
  | 'AI_THINKING'
  | 'ERROR';

export interface LiveAudioMetrics {
  rmsDb: number;
  vadActive: boolean;
  rttMs: number | null;
  audioChunksCount: number;
}

export interface UseLiveVoiceSessionReturn {
  // 1. Single discrete source of truth
  state: VoiceEngineState;
  // 2. Audio & network telemetry
  metrics: LiveAudioMetrics;
  // 3. Status prompt for UI rendering
  statusMessage: string;
  // 4. Dialogue turns history
  dialogueTurns: DialogueTurnItem[];
  // 5. Active evaluation scorecard (if emitted)
  activeScorecard: HrScorecard | VoiceEvaluationResult | null;
  // 6. Primary session lifecycle controls
  connect: (params: LiveAudioSessionParams) => Promise<void>;
  disconnect: () => void;
  // 7. Physical mic capture toggle (replaces toggleMute/toggleMic duplicates)
  toggleMic: () => void;
  // 8. Tactile interaction (barge-in if AI speaking; turn commit if candidate speaking)
  handleInteraction: () => void;
}
```

### 4.2. Eliminated Leaky Sinks
- `engineRef: React.MutableRefObject<ILiveVoiceEngine | null>` $\rightarrow$ **REMOVED**.
- `playoutManagerRef: React.MutableRefObject<AudioPlayoutManager | null>` $\rightarrow$ **REMOVED** (encapsulated as a private member inside `NativeLiveVoiceEngine`).
- `disconnectSession` $\rightarrow$ **REMOVED** (merged into `disconnect`).
- `toggleMute` $\rightarrow$ **REMOVED** (merged into `toggleMic`).
- `handleBargeIn` / `finishManualTurn` $\rightarrow$ **REMOVED** (merged into `handleInteraction`).

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Atomic client-side replacement.
- **Physical Deletions**:
  ```bash
  rm frontend/src/audio/LiveVoiceEngine.ts
  rm frontend/src/audio/SileroVadDetector.ts
  rm frontend/src/audio/AcousticBargeInGuard.ts
  ```
- **Type Consolidation**: Purge duplicate `ILiveVoiceEngine` definitions in `frontend/src/audio/types.ts`.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Tactile Barge-In Interruption
- **Pre-Conditions {P}**:
  - `session.state === 'AI_SPEAKING'`
  - Audio playout buffer queue occupancy $> 0$ samples
- **Algorithm C**:
  1. Invoke private `this.playoutManager.handleInterruption()`.
  2. Apply 5ms linear gain de-click ramp to 0.0.
  3. Discard all pending chunks in the playout queue.
  4. Dispatch `{ clientContent: { interruption: true } }` upstream.
  5. Symmetrically transition `state` to `'LISTENING'`.
- **Post-Conditions {Q}**:
  - `session.state === 'LISTENING'`
  - Audio playout buffer occupancy $== 0$
  - Microphone audio capture stream is actively pumping 16kHz frames
- **Orthogonal Invariants**:
  - Physical audio DAC output must drop below $-60$ dB within $\le 15$ ms.
  - Zero echo frames may leak back into the outgoing mic stream.
