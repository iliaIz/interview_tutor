# Spec: Decoupled Evaluation Pipeline & PITest Mutation Verification (SPEC-004)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `Evaluation Gate`, `Mutation Testing Gate (PITest)`, `Time Virtualization Invariant`, `Financial Precision Invariant`. Harmonizes [`06_practice_evaluation_and_sandbox_pipeline.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/functional_registry/06_practice_evaluation_and_sandbox_pipeline.md).
- **Operating Envelope**:
  - Full 4-Gate execution duration: p50 $\le 2.5$s, p95 $\le 6.0$s (JVM Sandbox compile + JUnit + PITest + LiteLLM Judge).
  - Memory consumption: Dedicated JVM sandbox per execution limited to 256MB heap; zero host process memory leakage on VPS 1.8GB RAM.
  - Tenancy isolation: Fully isolated ephemeral process jail for user submitted Java code.
  - Data classification: `Internal` (candidate code submissions & evaluation reports).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Live voice WebSocket streaming**: `backend/src/services/live/*`.
2. **Frontend UI styling & components**: `frontend/src/components/practice/*` (only SSE event listener in `useEvaluationPipeline.ts` may be aligned).
3. **Sandbox container base image**: No rebuild of Docker images on VPS (Rule 0).
4. **Existing challenge manifests**: `coding_challenges` test cases and canonical solution code in SQLite DB.

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Domain evaluation interface `ChallengeEvaluationPipeline.evaluate(submission: EvaluationInput): AsyncIterable<EvaluationPipelineEvent>` in [`backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/sandbox/ChallengeEvaluationPipeline.ts).
- **Real-Wire Dependencies**: Real ephemeral JVM execution in Docker sandbox or Java 21 process runner. Zero mocks for `JvmExecutionService`, `RefactoringAstVerifier`, or `JvmMutationEngine`.
- **Verification Environment Invariant (Strict Rule 0)**:
  - **Local VPS**: ONLY fast static typechecking (`export PATH="/home/djelu/.local/node/bin:$PATH" && cd backend && npx tsc --noEmit`). Running JVM sandbox, Gradle, PITest mutation runner, or Docker containers on VPS is strictly prohibited and blocked.
  - **GitHub Actions CI/CD**: Real-wire ephemeral JVM sandbox execution, Gradle tests, and PITest mutation verification run exclusively in cloud runners (16 GB RAM) via `remote-verify`.

## 4. Formal Wire & Messaging Contracts

### 4.1. Domain Event Stream Contract (`AsyncIterable<EvaluationPipelineEvent>`)
```typescript
export type EvaluationGateType =
  | 'JVM_UNIT_TESTS'
  | 'AST_INVARIANTS'
  | 'MUTATION_TESTS'
  | 'AI_EVALUATION'
  | 'PERSISTENCE';

export interface EvaluationPipelineEvent {
  gate: EvaluationGateType;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  progressPercent: number;
  payload?: {
    testResults?: { passed: number; failed: number; total: number };
    astViolations?: Array<{ rule: string; line: number; message: string }>;
    mutationScore?: { killedMutants: number; totalMutants: number; percentage: number };
    aiFeedback?: { score: number; critique: string; positivePoints: string[]; missingPoints: string[] };
    error?: string;
  };
  timestamp: number;
}
```

### 4.2. HTTP SSE Transport Adapter (`routes/practice.ts`)
```typescript
router.post('/challenges/:id/evaluate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const event of ChallengeEvaluationPipeline.evaluate(submissionInput)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ gate: 'PERSISTENCE', status: 'FAILED', payload: { error: err.message } })}\n\n`);
  } finally {
    res.end();
  }
});
```

### 4.3. Reconnection & Mutation Gate Activation
- Re-wire orphaned `JvmMutationEngine.ts` into Gate 3 of `ChallengeEvaluationPipeline`.
- If candidate unit tests fail (Gate 1), Gate 2 (AST) and Gate 3 (Mutation) are skipped, immediately streaming failure status.
- If unit tests pass (Gate 1) and AST rules pass (Gate 2), Gate 3 executes PITest mutation testing:
  - If mutation score $< 60\%$, candidate receives actionable advice on unasserted boundary conditions.

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only domain pipeline replacement.
- **Persistence Contract**:
  - Atomic insertion into `coding_challenge_submissions` and `user_progress_ledger` upon successful pipeline completion.
  - Zero SQL schema modifications required; existing JSON columns (`artifacts_json`, `evaluation_json`) preserve backward compatibility.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Full 4-Gate Evaluation Execution
- **Pre-Conditions {P}**:
  - `challengeId` exists in SQLite `coding_challenges` table with non-null `manifest_json`.
  - Submitted `files` array contains non-empty source code for active challenge.
- **Algorithm C**:
  1. Emit `gate: 'JVM_UNIT_TESTS', status: 'RUNNING'`. Execute `JvmExecutionService.execute()`.
  2. If tests fail $\rightarrow$ emit `status: 'FAILED'`, skip subsequent gates, persist failure, and terminate stream.
  3. Emit `gate: 'AST_INVARIANTS', status: 'RUNNING'`. Verify AST rules (clock injection, BigDecimal).
  4. Emit `gate: 'MUTATION_TESTS', status: 'RUNNING'`. Run `JvmMutationEngine.execute()`.
  5. Emit `gate: 'AI_EVALUATION', status: 'RUNNING'`. Query LiteLLM proxy for senior review.
  6. Emit `gate: 'PERSISTENCE', status: 'PASSED'`. Atomic DB write to progress ledger.
- **Post-Conditions {Q}**:
  - Stream terminates cleanly with `PERSISTENCE` event and `res.end()`.
  - SQLite ledger row created with full telemetry packet.
- **Orthogonal Invariants**:
  - The domain pipeline MUST NOT import or refer to Express types (`Request`, `Response`).
  - Candidate test execution in the JVM sandbox MUST NEVER exceed 10.0 seconds wall-clock time.
