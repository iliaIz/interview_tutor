# Spec 54: `QuestionEvaluationService` & Unified Multi-Tenant Memory Cascade

> **Governing Glossary:** `QuestionEvaluationService`, `Evaluation Gate` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0001](../../adr/0001-sota-2026-design-patterns-practice.md), [ADR 0006](../../adr/0006-evaluation-memory-cascade-and-json-catalogs.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Conceptual grading `< 45s` via `LlmGatewayClient`; Outcome persistence `< 15ms`

---

## 1. Intent & Workload Envelope
Eliminate the 3-way duplicated evaluation outcome cascade (`recordEvaluationAndSyncProgress` -> `updateFsrsCardState` -> `applyKnowledgeDecay` -> `recordNewErrorGap`), fix verified multi-tenant isolation bugs where `routes/eval.ts` (`POST /`) and `CascadedTurnEngine.ts` omit `userId` (defaulting gaps to `'default_user'`) while `liveEvaluationToolDispatcher.ts` alternates between `'default_user'` and `'anonymous'`, remove duplicate FAANG scorecard merge logic, and replace 3 identical SQL self-healing merges across `progressService.ts` and `routes/topics.ts`. Decouple text grading from outcome persistence so voice pipelines consume `recordOutcome` without loading `LlmGatewayClient` grading prompts.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT alter `ChallengeEvaluationSession` (Spec 43 Gate 1–5 coding sandbox pipeline) or coding submission DDL (`coding_submissions`).
- Do NOT break `verifyPrompts.ts` (`npm run test:prompts`) or security substring checks (`wrapUntrustedContext`, `PROMPT_INJECTION_DEFENSE_DIRECTIVE`, `ANTI_SYCOPHANCY_DIRECTIVES`) on `buildEvaluateAnswerSystemPrompt`.
- Every newly created or modified source file under `backend/src/` stays `<= 350` lines (new) / `<= 400` lines (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `QuestionEvaluationService` (`evaluateTextAnswer`, `recordOutcome`, `getLatestEvaluation`, `getTopicSummaries`) backed by `QuestionEvaluationRepository(database: Database)` (`backend/src/services/evaluation/`).
- **Real-Wire / Local-Substitutable Dependencies:** In-memory `:memory:` SQLite `Database` (`QuestionEvaluationRepository` + `FsrsCardRepository` + `CandidateDeficitMemoryRepository`) + injected `LlmGatewayClient` port and `mergeFaangScorecard` helper.
- **Verification Command (CI):** `npm run test:prompts && npm run test:practice:resilience && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface QuestionEvaluationRecordInput {
  userId?: string;
  questionId: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  userAnswer: string;
  score: number;
  isPassed: boolean;
  feedback: string;
  missingPoints: string[];
  dialogueTranscript?: string;
  assistanceLevelOverride?: 'solo' | 'guided' | 'relapse';
  resolvedGapIds?: string[];
  faangScorecard?: Record<string, unknown> | null;
  systemDesignEvaluationId?: string;
}

export interface QuestionEvaluationPorts {
  llmGateway?: Pick<LlmGatewayClient, 'completeJson'>;
  memoryAggregate?: Pick<CandidateMemoryAggregate, 'recordReview' | 'updateFsrsCardState' | 'applyKnowledgeDecay' | 'recordNewErrorGap'>;
}
```
- **API Route Preservation (`/api/eval`):** `POST /api/eval` retains `{ score, feedback, isPassed, missingPoints, ... }` JSON shape and propagates `LlmGatewayUnavailableError` cleanly as HTTP `503`/`429` rather than wrapping in `500`.
- **Tenant Isolation Contract:** `GET /api/eval/latest/:questionId`, `GET /api/eval/topic/:topicId`, and `routes/stt.ts` `question_evaluations` audio update MUST filter by normalized `userId = normalizeUserId(req.userId)` (`'default_user'` fallback when single-user unauthenticated, never `'anonymous'` vs `'default_user'` split).

---

## 5. Storage & Zero-Downtime Migration Contract
- Zero SQL DDL changes (`question_evaluations`, `user_progress`, `fsrs_card_states`, `candidate_error_vectors`, `user_progress_ledger` schemas unchanged).
- Unifies `progressService.syncTopicProgressFromEvaluations` SQL merge inside `QuestionEvaluationRepository` (deduplicating `progressService.ts` L160/L254 and `routes/topics.ts` L148).
- Keeps `backend/src/services/geminiText.ts` solely as a minimal `<= 30L` compatibility re-export of `EvalResult`, `buildEvaluateAnswerSystemPrompt`, and `evaluateAnswerWithGemini` (or updates `verifyPrompts.ts` / `routes/eval.ts` directly if preserving prompt invariants).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid evaluation request or model verdict containing `questionId`, `score` in `[0, 100]`, and optional `req.userId`.
- `{C}` Normalize `userId = rawUserId?.trim() || 'default_user'`; persist row into `question_evaluations`, upsert `user_progress`, recompute topic mastery via unified merge, run FSRS update, apply deficit decay using `assistanceLevelOverride` or derived level, record missing-point gaps under the **exact same `userId`**, and optionally record `STUDIO_3_DEFENSE` ledger entry when matched in `system_design_aliases`/`system_design_manifests`.
- `{Q}` Zero rows written under `'anonymous'` or mismatched `'default_user'` when a real `userId` is supplied; `GET /latest/:questionId` and `stt.ts` updates cannot read/overwrite another tenant's row; `CascadedTurnEngine` drops redundant pre-check `SELECT` on `questions` and delegates to `recordOutcome`.
