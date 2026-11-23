# 02: [Tracer-Bullet] Modernize Code Evaluator to ChallengeEvaluationJudge via LlmExecutionEngine

**Archetype:** Tracer-Bullet
**Blocked by:** #01 (benefits from CandidateMemoryAggregate for error gap recording)
**Status:** ready-for-agent

## What to Build
Refactor `backend/src/services/codeEvaluator.ts` to delegate all LLM generation and JSON parsing to `LlmExecutionEngine` (Spec 25). Eliminate duplicated HTTP `fetchWithFullJitterRetry` calls, authorization header management, and manual markdown code fence stripping. Inherit Docker network failover (`host.docker.internal` &rarr; `localhost:4000`) and structured `LlmGatewayUnavailableError` handling (Invariant 1 & 5). Shrink `codeEvaluator.ts` from 361 to &le; 250 lines (strictly complying with Rule 8).

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/codeEvaluator.ts` (`evaluateChallengeSubmission`).
- **Dependencies**: LiteLLM Proxy / `LlmExecutionEngine`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
export interface EvaluationRequest {
  challenge: CodingChallenge;
  files: FileNode[];
  activePhase?: number;
  sandboxResult?: SandboxExecutionResponse;
  abortSignal?: AbortSignal;
}

// Invariant: If LiteLLM throws LlmGatewayUnavailableError, ChallengeEvaluationSession catches it and returns HTTP 503 recovery payload.
```

## Explicit Non-Goals
- Altering the `EvaluationResult` or `CONCURRENCY_ANALYSIS` output schema.
- Changing AST parsing rules in `astAnalyzer.ts`.

## Acceptance Criteria
- [ ] `codeEvaluator.ts` delegates to `LlmExecutionEngine.executeJson<any>`.
- [ ] Duplicated HTTP retry and markdown stripping code deleted from `codeEvaluator.ts`.
- [ ] File line count of `codeEvaluator.ts` is &le; 250 lines.
- [ ] Practice evaluation tests and prompts verification pass.
