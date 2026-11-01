# Spec: Evaluation Pipeline Integrity & Database Performance (SPEC-07)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `Evaluation Gate`, `Mutation Testing Gate (PITest)`, `Fast-Path Bailout`, `Database WAL Mode`. Harmonizes [`06_practice_evaluation_and_sandbox_pipeline.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/functional_registry/06_practice_evaluation_and_sandbox_pipeline.md).
- **Operating Envelope**:
  - Evaluation turnaround: Gate 1 compile + Gate 2 AST + Gate 3 PITest p50 $\le 2.0$s.
  - SQLite query latency: Lookup queries (`WHERE id = ? OR slug = ?`) p99 $\le 1.0$ms via B-tree index lookup.
  - Tenancy isolation: `isolated-multi-tenant` (Submissions and drafts partitioned by `user_id`).
  - Data classification tier: `Internal` (Evaluations, grading verdicts, score breakdowns).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Live voice WebSocket streaming**: `backend/src/services/live/*` (governed by SPEC-06).
2. **Frontend UI styling & themes**: `frontend/src/components/*` (only SSE event consumption in `useEvaluationPipeline.ts` may be observed).
3. **Sandbox container base image**: Zero container rebuilds on VPS (Rule 0).
4. **Existing challenge manifests**: `coding_challenges` test cases in SQLite DB.

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Domain evaluation pipeline and transport adapter seams:
  - `backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`
  - `backend/src/services/sandbox/evaluationPipelinePersistence.ts`
  - `backend/src/routes/practiceSseAdapter.ts`
  - `backend/src/services/dbIndexes.ts`
- **Real-Wire Dependencies**: Real SQLite database engine with compiled statements. Zero mocks for `db` or `JvmExecutionService`.
- **Environment Invariant (Strict Rule 0)**:
  - Local VPS: ONLY fast static typechecking (`export PATH="/home/djelu/.local/node/bin:$PATH" && cd backend && npx tsc --noEmit`).
  - Cloud CI/CD: Automated fault-injection tests (`test_practice_fault_injection.js`) and SSE streaming suite (`test_practice_evaluate_sse.js`) executed in GitHub Actions runner via `remote-verify`.

## 4. Formal Wire & Messaging Contracts

### 4.1. Dual-Transport Evaluation Endpoint (`POST /api/practice/evaluate` & `POST /api/practice/challenges/:id/evaluate`)
```yaml
openapi: 3.1.0
paths:
  /api/practice/challenges/{id}/evaluate:
    post:
      summary: Progressive multi-gate challenge evaluation (SSE stream or JSON response)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
        - name: Accept
          in: header
          required: false
          schema:
            type: string
            enum: ['text/event-stream', 'application/json']
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [challengeId, files]
              properties:
                challengeId: { type: string }
                files:
                  type: array
                  maxItems: 15
                  items:
                    type: object
                    required: [path, content]
                    properties:
                      path: { type: string, maxLength: 256 }
                      content: { type: string, maxLength: 200000 }
                activePhase: { type: integer, default: 1 }
                timeSpentSeconds: { type: integer, default: 0 }
      responses:
        '200':
          description: Evaluation events stream or consolidated JSON verdict
          content:
            text/event-stream:
              schema: { type: string }
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  isPassed: { type: boolean }
                  status: { type: string, enum: ['PASSED', 'FAILED'] }
                  evaluation: { type: object }
```

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only database index creation.
- **Lock-Safety Annotations**: Single-process SQLite file-lock with WAL mode. Index creation executed at server startup.
- **Schema Diff (DDL)**:
```sql
-- Additive B-tree index on slug columns to eliminate table scans
CREATE INDEX IF NOT EXISTS idx_coding_challenges_slug ON coding_challenges(slug);
CREATE INDEX IF NOT EXISTS idx_spring_tx_challenges_slug ON spring_transaction_challenges(slug);
```

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Gate 2 AST Failure Terminal SSE Emission
- **Pre-Conditions {P}**:
  - `ChallengeEvaluationPipeline.evaluate()` detects AST invariant violation (e.g. clock virtualization or bigdecimal precision failure).
  - Emits `{ gate: 'AST_INVARIANTS', status: 'FAILED', payload: { astViolations, error } }`.
- **Algorithm C**:
  1. `practiceSseAdapter.ts` receives failed `AST_INVARIANTS` event.
  2. Emits `stage: 'ast_analysis'` event with violation details.
  3. Synthesizes and immediately transmits terminal `complete` SSE event:
     ```typescript
     sendSseEvent('complete', {
       gate: 'PERSISTENCE',
       status: 'FAILED',
       stage: 'complete',
       success: false,
       isPassed: false,
       evaluation: {
         compilationStatus: { isCompilable: true, syntaxErrors: [] },
         astViolations: event.payload?.astViolations,
         scoreBreakdown: { overallScore: 30, summaryReview: event.payload?.error || 'AST violations detected' }
       }
     });
     ```
  4. Ends response stream cleanly: `res.end()`.
- **Post-Conditions {Q}**:
  - Client UI receives terminal `complete` event, populates evaluation modal with AST violations, and stops loading spinner.

### 6.2. Abort Signal Observability in Gate 1 Sandbox
- **Pre-Conditions {P}**:
  - Client aborts stream during JVM execution (`res.on('close')` fires `abortController.abort()`).
- **Algorithm C**:
  1. `JvmExecutionService.execute` finishes or errors.
  2. Before calling `EvaluationPipelinePersistence.persistRecord(...)`, check `if (input.abortSignal?.aborted) return;`.
  3. If aborted, skip database write completely and terminate generator.
- **Post-Conditions {Q}**:
  - Existing user submission and score in `coding_submissions` are NOT overwritten by cancelled/aborted requests.

### 6.3. Content-Negotiation for Non-SSE Clients
- **Pre-Conditions {P}**:
  - Request sent with `Accept: application/json` or `stream !== 'true'`.
- **Algorithm C**:
  1. Accumulate events from `ChallengeEvaluationPipeline.evaluate()` in memory.
  2. When final `complete` event or failure is reached, respond with `res.status(200).json({ success, isPassed, status, evaluation })`.
- **Post-Conditions {Q}**:
  - Automated JSON-based test suites and REST API consumers receive standard JSON response without parsing SSE event stream.

### 6.4. Canonical Challenge ID Draft Synchronization
- **Pre-Conditions {P}**:
  - Client calls `POST /api/practice/draft` with `challengeId` as slug or UUID.
- **Algorithm C**:
  1. Resolve canonical ID using indexed lookup: `canonicalId = EvaluationPipelinePersistence.resolveCanonicalChallengeId(challengeId)`.
  2. Upsert draft into `coding_submissions` with `id = sub_${canonicalId}_${userId}`.
- **Post-Conditions {Q}**:
  - Draft ID matches the ID used by `ChallengeEvaluationPipeline`, ensuring drafts and final evaluations seamlessly overwrite and synchronize.
