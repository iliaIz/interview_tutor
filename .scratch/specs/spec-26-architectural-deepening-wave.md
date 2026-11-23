# Spec 26: Architectural Deepening Wave (Memory Aggregate, Upstream Live Pipe, LLM Judge & Store Slicing)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing documents include `GLOSSARY.md`, `docs/adr/0001-sota-2026-design-patterns-practice.md`, `docs/adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md`, `docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md`, and `docs/adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md`.
- **Operating Envelope**:
  - Target Latency:
    - FSRS interval & memory decay updates: p95 < 2ms (in-process SQLite transaction + pure math).
    - Code evaluation via `LlmExecutionEngine`: p95 < 8s (dependent on LiteLLM model latency), with 40s timeout and 2-attempt Full-Jitter retry.
    - Live audio upstream pipe: packet dispatch latency < 5ms.
    - Frontend store state transitions: < 1ms, zero spurious re-renders across disjoint studio tabs.
  - Tenancy: Multi-tenant per `userId` parameter, isolated SQLite tables (`fsrs_card_states`, `candidate_error_vectors`, `question_embeddings`).
  - Cognitive Bounding (Rule 8): Every new file MUST NOT exceed 350 lines; modified files MUST NOT exceed 400 lines.

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Physically forbidden from modifying:
  - Database schema DDL or SQLite table structures (`fsrs_card_states`, `candidate_error_vectors`, `fsrs_review_logs`, `question_embeddings` schemas remain unchanged).
  - External HTTP REST API endpoints and response contracts (`/api/memory/radar`, `/api/memory/queue`, `/api/memory/stats`, `/api/eval/submit`, `/api/practice/evaluate`).
  - AudioWorklet ring-buffer DSP or client-side Web Audio routing (`EchoGuard`, `AudioPlayoutManager`).
  - Active authentication mechanics in `frontend/src/store/useAuthStore.ts`.

## 3. Pre-Agreed Verification Seams
- **Memory Seam**: `backend/src/services/memory/CandidateMemoryAggregate.ts` tested via `backend/tests/test_fsrs_engine.js` and `backend/tests/test_memory_multitenancy.js`.
- **Live Upstream Pipe Seam**: `backend/src/services/live/UpstreamGeminiPipe.ts` verified through `backend/src/services/live/liveAudioStreamRouter.ts` and `backend/tests/test_live_tool_silence_isolation.js`.
- **LLM Judge Seam**: `backend/src/services/codeEvaluator.ts` verified through `ChallengeEvaluationSession.ts` and unit test runner `npm run test:prompts`.
- **Frontend Store Seam**: `frontend/src/store/useAppStore.ts` verified via headless slice tests and typecheck `npx tsc --noEmit`.
- **Cloud Verification Runner**: GitHub Actions `remote-verify` (Workflow `.github/workflows/ai-verify.yml`).

## 4. Formal Wire & Messaging Contracts

### 4.1. Candidate Memory Aggregate Interface
```typescript
export interface ReviewEvent {
  userId: string;
  questionId: string;
  topic: string;
  score: number;             // 0-100
  isPassed?: boolean;
  missingPoints?: string[];  // Conceptual gaps
  feedback?: string;
  elapsedSeconds?: number;
}

export interface CandidateMemoryAggregate {
  recordReview(event: ReviewEvent): Promise<{
    nextIntervalDays: number;
    retrievability: number;
    propagatedNeighborsCount: number;
  }>;
  getStudyQueue(userId?: string, limit?: number): Promise<FsrsQueueItem[]>;
  getKnowledgeRadar(userId?: string): Promise<KnowledgeRadarSnapshot>;
  findDeficitGaps(userId: string, topic: string, limit?: number): Promise<CandidateGap[]>;
}
```

### 4.2. Upstream Gemini Pipe Typed Events
```typescript
export type UpstreamTurnEvent =
  | { type: 'SETUP_COMPLETE' }
  | { type: 'GREETING_READY'; greetingText: string }
  | { type: 'AUDIO_CHUNK'; audioData: Buffer; text?: string }
  | { type: 'TOOL_CALL'; callId: string; toolName: string; args: any }
  | { type: 'TURN_FINISHED'; audioBytes: number; transcript: string; wasBargeIn: boolean }
  | { type: 'INTERRUPTED' }
  | { type: 'ERROR'; errorCode: string; retryable: boolean; message: string };

export interface UpstreamGeminiPipe {
  connect(isInternalReconnect?: boolean): void;
  sendClientInput(input: { audioChunk?: Buffer; audioStreamEnd?: boolean }): void;
  sendToolResponse(responsePayload: any): void;
  subscribe(handler: (event: UpstreamTurnEvent) => void): () => void;
  close(code?: number, reason?: string): void;
}
```

### 4.3. ChallengeEvaluationJudge Request/Response
```typescript
export interface EvaluationRequest {
  challenge: CodingChallenge;
  files: FileNode[];
  activePhase?: number;
  sandboxResult?: SandboxExecutionResponse;
  abortSignal?: AbortSignal;
}

// Returned EvaluationResult satisfies existing schema: compilationStatus, virtualExecutionResult, concurrencyAnalysis, architecturalCompliance, scoreBreakdown.
```

## 5. Storage & Zero-Downtime Migration Contract
- **Strategy**: Additive-Only & In-Place Facade Expansion.
- Zero changes to SQLite table names or columns.
- `fsrsEngine.ts` and `vectorMemoryService.ts` remain as re-exporting facades delegating to `CandidateMemoryAggregate`, `FsrsAlgorithm`, and `VectorEmbeddingRepository` to preserve backwards compatibility for any external script or test.
- `useAppStore.ts` re-exports sliced actions so all 57 consuming components continue functioning without API churn.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Memory Review Recording
- **{P}**: Valid `ReviewEvent` with `userId` and `questionId`.
- **Algorithm C**:
  1. Calculate FSRS-5 state transition via stateless `FsrsAlgorithm.calculateNextState()`.
  2. Upsert `fsrs_card_states` and record in `fsrs_review_logs`.
  3. Decay error vectors in `candidate_error_vectors` according to assistance level and retrievability.
  4. If `score < 75`, insert/reinforce conceptual error gap with initial deficit 1.0.
  5. Calculate RBF kernel and propagate deficit to top-$k$ nearest question neighbors.
- **{Q}**: Persistent state updated atomically; retrievability, stability, and next interval returned.
- **Orthogonal Invariant**: Pure FSRS math has 0 external side effects and operates deterministically.

### 6.2. LLM Code Evaluation Judge
- **{P}**: Valid `EvaluationRequest` with AST analysis pre-computed.
- **Algorithm C**:
  1. If `sandboxResult && !sandboxResult.isCompilable`, short-circuit and return compiler diagnostics.
  2. Assemble system prompt and user XML prompt.
  3. Delegate to `LlmExecutionEngine.executeJson<RawEvaluationResponse>()`.
  4. Automatically benefit from Docker networking failover and Full-Jitter exponential backoff.
  5. Normalize test cases and concurrency findings.
- **{Q}**: Complete `EvaluationResult` produced. Transient LiteLLM errors surface structured `LlmGatewayUnavailableError` (HTTP 503).
- **Orthogonal Invariant**: Zero duplicate HTTP client code or raw JSON fence trimming in `codeEvaluator.ts`.

### 6.3. Upstream Gemini Transport Pipe
- **{P}**: Upstream WebSocket URL and setup message configured.
- **Algorithm C**:
  1. Open WebSocket connection to LiteLLM Live Gateway with Full-Jitter backoff retry (up to 3 attempts).
  2. Send initial `setupMessage` once open.
  3. Decode incoming frames (handling both string and binary UTF-8 frames per Invariant 2.3).
  4. Enforce Turn 0 lockdown: filter unauthorized tool calls before candidate answers.
  5. Dispatch strongly-typed `UpstreamTurnEvent`s to listeners.
- **{Q}**: Clean event stream; zero direct mutations on `session` object inside transport pipe.
- **Orthogonal Invariant**: All downstream events conform strictly to Gemini Live 3.8 protocol.

### 6.4. Sliced Frontend Store
- **{P}**: Zustand root store initialized.
- **Algorithm C**:
  1. Partition state into cohesive slices (`practiceSlice`, `academySlice`, `whiteboardSlice`, `uiSlice`).
  2. Delete dead ghost auth fields and methods.
  3. Combine slices into `useAppStore` root hook.
- **{Q}**: Monaco editor updates mutate only `practiceSlice`; dead auth code removed; bundle size reduced.
- **Orthogonal Invariant**: Zero regression in existing 57 call sites importing `useAppStore`.
