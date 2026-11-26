# Spec 56: Deep `LiveToolExecutor`, `LiveWorkspaceStore` & Session Replay Fixes

> **Governing Glossary:** `LiveSessionAggregate`, `Turn 0 Lockdown`, `Slim Live Handshake Barrier` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md), [ADR 0006](../../adr/0006-evaluation-memory-cascade-and-json-catalogs.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Live tool execution & workspace manifest custody (`<= 350L` per file)

---

## 1. Intent & Workload Envelope
Collapse `LiveWorkspaceContext` (352L) and `workspaceManifestStore` (130L) into a single deep `LiveWorkspaceStore` (`<= 340L`) owning challenge resolution (`WorkspaceChallengeCatalogPort`), path-accurate manifest updates, and the sole `session_init` merger shared with `liveBlueprintParamParser`. Simultaneously deepen `LiveToolEngine` (368L) into `LiveToolExecutor(ToolPersistencePort)` (`<= 340L`), delegating evaluation persistence to Spec 54 `QuestionEvaluationService` (eliminating direct global `db` singletons and transitive `livePromptBuilder` disk I/O), fixing the Spec 53 `?awaitInit=1` `earlyQueue` `questionText` overwrite regression, per-call `ToolAudioMutex.release(id)`, dual `isToolCallPending` drift, `24000`-byte whiteboard handoff duplication, and `matchWorkspaceFilePath` basename collisions.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT change WebSocket binary audio wire format, Spec 51 `UpstreamTransportPort` custody boundaries, or Turn 0 Lockdown blocking `submit_interview_evaluation` before candidate speech.
- Do NOT regress `?awaitInit=1` 150ms readiness wait in `LiveVoiceSession.ts` or break `test_live_tool_silence_isolation.js`, `test_spec37_deadair_mutex_resumption.js`, or `test_hr_simulator_engine.js`.
- All created/modified files under `backend/src/services/live/` stay `<= 350L` (new) / `<= 400L` (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seams:** `LiveToolExecutor.executeFunctionCalls(ctx, ports?)` + `LiveWorkspaceStore` (`resolve`, `applyInitAndClientFrame`, `readWorkspaceFile`, `matchFilePath`).
- **Adapters (`ports & adapters` / `local-substitutable`):**
  - `ToolPersistencePort`: production adapter backed by `QuestionEvaluationService` (Spec 54), `coding_challenges`/`bug_challenges`/`system_design_submissions` SQLite repository; `:memory:` SQLite or fake port in unit/contract tests (`0` writes to `data/interview.db` or `llmGateway.embed()`).
  - `WorkspaceChallengeCatalogPort`: SQLite prepared queries on injected `Database` (`defaultDb` in prod, `:memory:` in tests — zero module-level cached `Statement` bound to global `db`).
- **Verification Command (CI):** `npm run test:live:tool-isolation && npm run test:vad:unit && npm run test:hr && node tests/test_live_tool_executor_workspace.js && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface ToolPersistencePort {
  saveEvaluationOutcome(input: QuestionEvaluationRecordInput): Promise<{ evaluationId: string; deltaProgress?: unknown }>;
  saveSystemDesignSubmission(input: { userId: string; scenarioId: string; diagramMermaid: string; overallScore: number; verdictJson: string }): void;
  updateBugSolved(input: { challengeId: string; status: 'solved'; decayedTopic?: string; userId: string }): Promise<void>;
  readChallengeFileFromStore(challengeId: string, filePath: string): Promise<{ path: string; content: string } | null>;
}

export interface WorkspaceChallengeCatalogPort {
  findChallengeRecord(challengeId: string, sessionType: string): ChallengeLookupRow | null;
}
```
- **`session_init` Precedence Contract:** `LiveWorkspaceStore.mergeInitFrame(target, initFrame)` is the single SSOT used by both `LiveSessionBlueprintBuilder` (pre-connect) and `LiveVoiceSession`/`DownstreamClientPipe` (`earlyQueue` replay or post-connect updates): `explicit questionText > bugTitle > challenge.title`, and replay MUST NOT overwrite resolved `questionText` or drop `dossierId`/`jobId`/`questionMatrixId`.
- **`ToolAudioMutex` Lifecycle:** Acquire `mutex.acquire(call.id)` per call, release in `finally { mutex.release(call.id); }` individually per call rather than indiscriminate `reset()` when async batches overlap; `isToolCallPending` derives symmetrically or clears cleanly when `activeCount() === 0`.
- **Single Whiteboard Speech Handoff Owner:** Only `LiveToolExecutor` (via shared helper `resolveWhiteboardScheduling(action, currentTurnAudioBytes)`) evaluates `>= 24000` bytes (`SILENT` vs `WHEN_IDLE`); `liveWorkspaceHandlers.ts` stays pure without re-checking audio byte thresholds.
- **Path Matching Precedence:** Exact normalized path match -> suffix path match (`/foo/Bar.java`) -> basename match ONLY when unique across manifest files (throwing/returning ambiguity or first exact match, preventing silent overwrite across `main/.../Foo.java` vs `test/.../Foo.java`). Wait on `applyWorkspaceFileUpdate`: SQLite `read_file` fallback MUST NOT overwrite `manifest.activeFile` unless `markActive === true`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Zero SQL DDL changes.
- Move `WatchdogManager` initialization inside `SessionTurnState` constructor cleanly so `LiveVoiceSession.ts` no longer constructs `new SessionTurnState(..., undefined as any)` before patching `.watchdogs`.
- Maintain compatibility re-exports (`LiveToolEngine`, `LiveWorkspaceContext`) only if needed by any legacy script until updated inside the same wave.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `LiveSessionBlueprint` + incoming `toolCall` batch or client `session_init`/`workspace_*` frame + injected `ToolPersistencePort` & `WorkspaceChallengeCatalogPort`.
- `{C}` Execute Turn 0 check, deduplicate against single normalized turn state, acquire per-call mutex `acquire(call.id)` with guaranteed `finally { release(call.id) }`, resolve paths without basename aliasing, delegate grading persistence to `ToolPersistencePort.saveEvaluationOutcome`, and schedule `update_whiteboard` once using `24000`-byte rule.
- `{Q}` Overlapping async tool calls keep audio mutex armed until the last call finishes (`activeCount() === 0`); `?awaitInit=1` `earlyQueue` replay preserves explicit `questionText`; unit tests exercise `read_file`, `mark_bug_solved`, `report_identified_smell`, `submit_interview_evaluation`, `inject_chaos_failure`, `record_candidate_observation`, `submit_hiring_committee_verdict`, and `LiveWorkspaceStore` deterministically over `:memory:` SQLite.
