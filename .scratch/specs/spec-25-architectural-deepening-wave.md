# SPEC-25: Core Architectural Deepening & Boundary Consolidation

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligns with [GLOSSARY.md](../../GLOSSARY.md) (`LiveSessionAggregate`, `Anemic Data Bag`, `Fast-Handoff VAD`, `Evaluation Gate`, `Overengineering Sentinel`) and governing ADRs:
  - [0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md) (Multi-Gate Deterministic Verification)
  - [0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md](../../docs/adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md)
  - [0003-omnipresent-ai-copilot-and-company-track-enrichment.md](../../docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md) (Hub-and-Spoke Omnipresent Copilot)
  - [0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md](../../docs/adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md) (Gemini 3.8 Live Protocol)
  - Enforces Core Architectural Invariant 1 (LiteLLM Proxy Centralization) and Invariant 5 (Zero-Phantom-Fallback & Full-Jitter Backoff).
- **Operating Envelope**:
  - LLM Completion p95 latency: < 3500ms; transient 429/503 retry jitter window: 0..2500ms.
  - WebSocket Live Audio Frame latency: < 20ms demuxing overhead; memory occupancy: zero leak per session.
  - IDE Bridge Loopback latency: < 15ms per bidirectional file sync over local ports (:41789 / :41790).
  - Code Evaluation 5-Gate latency: JVM gate < 4000ms; AST gate < 5ms; PITest < 6000ms; atomic persistence < 10ms.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from:
- Modifying Web Audio DSP worklets (`frontend/public/audio/live-audio-processor.js`, `AudioPlayoutManager.ts`).
- Rewriting the core Gemini Live native state machine (`LiveVoiceStateMachine.ts`, `SessionFsm.ts`).
- Modifying the Java 21 Sandbox container harness (`backend/src/services/sandbox/JvmExecutionService.ts`, `backend/src/scripts/buildSandbox.js`).
- Touching SQL schemas or migrations (`backend/src/services/dbSchema.ts`, `coding_challenges`, `questions`).
- Running any local compilers or test runners on the 1.8GB VPS host (Local Build & Test Invariant).

---

## 3. Pre-Agreed Verification Seams
- **Track A (LLM Seam)**: `backend/src/services/LlmExecutionEngine.ts` tested through `executeJson<T>()` with mock/real LiteLLM endpoints.
- **Track B (Live Workspace Seam)**: `backend/src/services/live/LiveWorkspaceContext.ts` tested via `applyClientFrame(frame)` and `toGeminiSetupConfig()` in memory.
- **Track C (IDE Companion Seam)**: `frontend/src/services/IdeBridgeConnection.ts` tested via loopback connection state and typed observer callbacks.
- **Track D (Sandbox Evaluation Seam)**: `backend/src/services/sandbox/ChallengeEvaluationSession.ts` tested through `runGates()` and `getTerminalVerdict()`.
- **Remote CI Verification**: Executed in GitHub Actions cloud runner via `remote-verify` running the 18 quality gate suites.

---

## 4. Formal Wire & Messaging Contracts

### Track A: LlmExecutionEngine Contract
```typescript
export interface LlmExecutionOptions<T = any> {
  systemPrompt?: string;
  userPrompt: string;
  schema?: Record<string, any>;
  preset?: 'fastTriage' | 'socraticTutoring' | 'conceptualGrading' | 'deepReasoningReview';
  temperature?: number;
  abortSignal?: AbortSignal;
  maxRetries?: number;
}

export interface LlmExecutionEngineContract {
  executeJson<T>(options: LlmExecutionOptions<T>): Promise<T>;
  executeText(options: LlmExecutionOptions<string>): Promise<string>;
}
```

### Track B: LiveWorkspaceContext Frame Demuxing Contract
```typescript
export interface ClientWsFrame {
  type: string;
  challenge?: Record<string, any>;
  manifest?: Record<string, any>;
  activeFilePath?: string;
  content?: string;
  delta?: string;
  [key: string]: any;
}

export interface LiveWorkspaceContextContract {
  applyClientFrame(frame: ClientWsFrame): boolean;
  getActiveFile(): { path: string; content: string } | null;
  getManifestXml(): string;
  getChallengeMetadata(): Record<string, any>;
}
```

### Track C: IdeBridgeConnection Headless Contract
```typescript
export type IdeBridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';

export interface IdeBridgeOptions {
  port: number;
  channel: 'task' | 'whiteboard';
  onFileUpdated: (path: string, content: string) => void;
  onStatusChange?: (status: IdeBridgeStatus) => void;
  onError?: (err: Error) => void;
}

export interface IdeBridgeConnectionContract {
  connect(): void;
  disconnect(): void;
  sendFileUpdate(path: string, content: string): void;
  readonly status: IdeBridgeStatus;
}
```

### Track D: ChallengeEvaluationSession Contract
```typescript
export interface ChallengeEvaluationInput {
  challengeId: string;
  userId?: string;
  files: Array<{ path: string; content: string }>;
  activePhase?: number;
  timeSpentSeconds?: number;
  abortSignal?: AbortSignal;
}

export interface TerminalEvaluationVerdict {
  status: 'PASSED' | 'FAILED';
  score: number;
  evaluation: Record<string, any>;
  timeSpentSeconds: number;
}

export interface ChallengeEvaluationSessionContract {
  runGates(): AsyncIterable<EvaluationPipelineEvent>;
  getTerminalVerdict(): TerminalEvaluationVerdict | null;
}
```

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only. No schema changes or table drops.
- **SQLite Persistence**:
  - `coding_submissions` upsert logic previously in `EvaluationPipelinePersistence` is preserved atomically inside `ChallengeEvaluationSession`.
  - Zero database migrations required; backward-compatible with all existing rows.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Track A: LlmExecutionEngine {P} C {Q}
- **Pre-Conditions {P}**:
  - `userPrompt` is non-empty.
  - `envConfig.proxy.chatUrl` is defined.
- **Algorithm C**:
  - Attempt POST to LiteLLM Proxy chat URL with Bearer token.
  - On network failure with `host.docker.internal`, retry once with `localhost`.
  - On HTTP 429 or 503, apply Full-Jitter Exponential Backoff ($T = \text{random}(0, \min(2500, 800 \times 1.8^{\text{attempt}}))$) up to 2 retries.
  - Strip markdown code fences (` ```json `), execute JSON parse; on failure, perform regex JSON extraction.
  - On persistent 429/503, throw structured `LlmGatewayUnavailableError`.
- **Post-Conditions {Q}**:
  - Guaranteed valid typed object `T` returned, or domain error thrown.
- **Orthogonal Invariants**:
  - Zero raw Google API keys exposed; routing strictly via LiteLLM Proxy (Invariant 1).

### 6.2. Track B: LiveWorkspaceContext {P} C {Q}
- **Pre-Conditions {P}**:
  - Incoming frame is valid UTF-8 JSON.
- **Algorithm C**:
  - If `session_init`: hydrate challenge metadata and starter files from pre-compiled SQLite statements.
  - If `workspace_active_file_changed`: update active pointer atomically without reallocating file buffers.
  - If `workspace_file_update`: update file buffer, recompute manifest hash, and mark XML dirty.
- **Post-Conditions {Q}**:
  - `getActiveFile()` and `getManifestXml()` always return consistent snapshots.
- **Orthogonal Invariants**:
  - `ProxySession` loose properties are no longer mutated outside the aggregate root.

### 6.3. Track C: IdeBridgeConnection {P} C {Q}
- **Pre-Conditions {P}**:
  - Valid port (:41789 or :41790) and channel specified.
- **Algorithm C**:
  - Establish loopback WebSocket connection.
  - Manage 15s heartbeat ping and 5s exponential reconnect backoff.
  - When loopback sends `file_sync`, notify typed callback `onFileUpdated`.
  - Eliminate untyped `window.dispatchEvent('workspace_file_updated')`.
- **Post-Conditions {Q}**:
  - Disconnect cleans up all timers and aborts in-flight pings.
- **Orthogonal Invariants**:
  - Zero memory leaks upon component unmount.

### 6.4. Track D: ChallengeEvaluationSession {P} C {Q}
- **Pre-Conditions {P}**:
  - Valid challengeId and array of code files provided.
- **Algorithm C**:
  - Execute Gate 1 (JVM) -> Gate 2 (AST & Static) -> Gate 3 (PITest Mutation) -> Gate 4 (AI Evaluator) -> Gate 5 (Persistence).
  - Any gate failure formats canonical `TerminalEvaluationVerdict` and triggers atomic SQLite upsert.
  - Gate 5 completion commits passing verdict and returns final score.
- **Post-Conditions {Q}**:
  - `getTerminalVerdict()` returns the non-null verdict after pipeline completion or early abort.
- **Orthogonal Invariants**:
  - Test-quality failures never masquerade as mutant survival failures (Gate 2 invariant).
