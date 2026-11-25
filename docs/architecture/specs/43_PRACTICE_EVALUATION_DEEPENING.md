# Spec 43: Consolidated Practice Evaluation Pipeline, Static Seam & Multi-Tenant Persistence

> **Governing Glossary:** `Evaluation Gate`, `Structural AST Invariant` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0001](../../adr/0001-sota-2026-design-patterns-practice.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · `<= 120s` E2E stream (`< 80ms` Gate 1/2/3 sandbox)

---

## 1. Intent & Workload Envelope
Eliminate the two shallow pass-through shims (`ChallengeEvaluationPipeline.ts` [23L], `evaluationPipelinePersistence.ts` [11L]) wrapping `ChallengeEvaluationSession`, remove 3 redundant workspace AST scans across Gates 1–4, unify `evaluation_json` persistence into one canonical envelope, fix unpersisted Gate 3/4 failure exits, and propagate `userId` to vector error gap recording.
- **Target Latency:** Static analysis once `< 5ms`; JVM Gate 1/3 `< 150ms`; Gate 4 AI judge `< 40s/attempt`.
- **Tenancy Isolation:** Strictly `shared-multi-tenant` (`userId` keyed in `coding_submissions` and `vectorMemoryService`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The following modules MUST NOT be structurally altered or deleted during execution:
- UI React views (`PracticeArenaWorkspace.tsx`, `PracticeEvaluationModal.tsx`, `ReviewProgressConsole.tsx`) — preserve all JSX branches and ARIA contracts.
- Compiler daemon Java classes (`CompilerService.java`) and AST rule definitions (`AstSecurityScanner.ts`, `TestQualityScanner.ts`, `RefactoringAstVerifier.ts`).
- SQLite DDL tables (`coding_challenges`, `coding_submissions`, `question_evaluations`).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `ChallengeEvaluationSession.evaluate(input, ports?)` in `backend/src/services/sandbox/ChallengeEvaluationSession.ts` + HTTP SSE adapter `backend/src/routes/practiceSseAdapter.ts`.
- **Dependencies:**
  - `local-substitutable`: In-memory SQLite DB / temporary `ChallengeSubmissionRepository` for Gate 5 & failure persistence.
  - `ports & adapters`: Injectable `{ jvmRunner, staticAnalyzer, mutationRunner, llmJudge, submissionRepo }` ports defaulting to concrete production implementations.
- **Verification Commands (CI):** `npm run test:practice:resilience && node tests/test_practice_evaluate_sse.js`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface EvaluationSessionPorts {
  jvmRunner?: (req: SandboxExecutionRequest) => Promise<SandboxExecutionResponse>;
  mutationRunner?: (req: MutationExecutionRequest) => Promise<MutationExecutionResponse>;
  staticAnalyzer?: typeof JavaStaticAnalysisEngine.verify;
  llmJudge?: (req: EvaluationRequest) => Promise<EvaluationResult>;
  submissionRepo?: Pick<typeof ChallengeSubmissionRepository, 'loadManifest' | 'persistSubmission'>;
}

export interface CanonicalPersistedEvaluation {
  schemaVersion: 2;
  status: 'PASSED' | 'FAILED';
  compilationStatus: { isCompilable: boolean; syntaxErrors: Array<{ lineNumber: number; errorMessage: string }> };
  sandboxResult?: SandboxExecutionResponse;
  astViolations?: EvaluationAstViolation[];
  mutationScore?: EvaluationMutationScorePayload;
  aiFeedback?: EvaluationAiFeedbackPayload;
  aiEvaluationResult?: EvaluationResult;
  scoreBreakdown: { overallScore: number; summaryReview: string; [k: string]: unknown };
}
```
- **Input Validation Contract (`validateWorkspaceFiles`):** Reject empty arrays, `files.length > 15` (practice) / `> 20` (sandbox), or any file content `> 200_000` chars with HTTP 400 uniformly across `practiceSseAdapter.ts`, `PracticeChallengeCatalog.ts`, and `sandbox.ts`.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy:** Additive canonical `schemaVersion: 2` JSON envelope written by `ChallengeSubmissionRepository.persistSubmission` while `PracticeChallengeCatalog.getChallengeManifest` remains backward-compatible with legacy `evaluation_json` rows. Zero SQL DDL changes.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- **Gate 1–4 Terminal Completeness:**
  - `{P}` Valid `ChallengeEvaluationInput` with `userId` and non-empty `files`.
  - `{C}` Run `JavaStaticAnalysisEngine.verify` once prior to JVM execution (`skipPreScan: true` passed to `JvmExecutionService` & `JvmMutationEngine`), then execute Gates 1–5; on ANY Gate 1/2/3 failure persist a `CanonicalPersistedEvaluation`, set `terminalVerdict`, and yield terminal `FAILED` with `evaluation`; on Gate 4 failure yield `FAILED` with `retryable`/`503` metadata and set `terminalVerdict`.
  - `{Q}` `terminalVerdict` is non-null whenever Gate 1/2/3/5 finishes; JSON mode returns HTTP 200 (never spurious HTTP 500 on Gate 3 failure); SSE mode always emits terminal `complete` or `error`; `recordNewErrorGap` receives `req.userId`.
