# 06. Practice Evaluation Pipeline & Live Review Monitoring

> **Location:** `docs/architecture/functional_registry/06_practice_evaluation_and_sandbox_pipeline.md`  
> **Subsystem (Level 1):** Practice Evaluation Pipeline & Live Review Monitoring  
> **Primary Files:** [`backend/src/services/challengeSubmissionService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/challengeSubmissionService.ts), [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts), [`frontend/src/components/practice/useEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useEvaluationPipeline.ts), [`frontend/src/components/practice/ReviewProgressConsole.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/ReviewProgressConsole.tsx)

---

## 1. Subsystem Scope
Handles candidate Java 21 workspace submission evaluation, orchestrating the In-Memory JVM Sandbox, static AST / Project Loom carrier-pinning analysis, LLM architecture scoring (`gemini-smart` via LiteLLM Proxy), and live Server-Sent Events (SSE) streaming with interactive UI status monitoring.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `handleChallengeEvaluation()` (Backend SSE Dispatcher)
- **Location:** [`backend/src/services/challengeSubmissionService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/challengeSubmissionService.ts)
- **What Was Done:**
  - Migrated monolithic blocking evaluation into a granular event-driven SSE pipeline: `sandbox` $\rightarrow$ `sandbox_done` $\rightarrow$ `ast_analysis` $\rightarrow$ `ai_reasoning` $\rightarrow$ `heartbeat` (every 3s) $\rightarrow$ `complete`.
  - Added structured error emission (`event: error` with `canRetryAiOnly: true`) upon AI evaluation failure, allowing downstream clients to recover without re-running the Java compilation sandbox.
  - Implemented 3-second heartbeat ticks with elapsed execution time to prevent intermediary proxy disconnects.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* When LiteLLM timed out or failed, express headers had already been flushed by SSE, causing unhandled promise rejections that hung the client connection for 90s until client timeout.
  - *Intermediate Conclusion:* Trapping errors inside the SSE stream and emitting `event: error` immediately unblocks the client with actionable diagnostic details.
- **Rationale & "Why":** Adheres to SOTA 2026 progressive streaming standards for long-running reasoning LLM evaluations.
- **Invariants:** Every SSE stream must be cleanly terminated (`res.end()`) on both success and error paths.

---

### 2.2 `evaluateChallengeSubmission()` (LiteLLM Caller)
- **Location:** [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts)
- **What Was Done:**
  - Calibrated attempt timeout from 60s to 40s with maxRetries = 1 (total backend ceiling $\approx 81.5$s), fitting safely below the client's 120s safety ceiling.
  - Added multi-field content extraction: checks `message.content`, `message.reasoning_content`, and `choice.text` before throwing empty response errors.
- **Rationale & "Why":** Strict timeout budgeting prevents client starvation and cascade deadlocks.
- **Invariants:** Client timeout (120s) $>$ Backend timeout (85s) $>$ Gateway attempt timeout (40s).

---

### 2.3 `useEvaluationPipeline()` & `ReviewProgressConsole` (Frontend SOTA Monitoring)
- **Location:** [`frontend/src/components/practice/useEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useEvaluationPipeline.ts), [`frontend/src/components/practice/ReviewProgressConsole.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/ReviewProgressConsole.tsx)
- **What Was Done:**
  - Fixed critical SSE parser defect where `event.event` and `event.data` were parsed from within `data:`, dropping all stage events. Implemented standard dual-line SSE state machine.
  - Decomposed evaluation orchestration out of [`useWorkspaceRunner.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useWorkspaceRunner.ts), reducing its line count from 298 to 176 lines (Rule 8 compliance).
  - Built interactive 4-stage visual Stepper (`JVM 21 Sandbox` $\rightarrow$ `AST Loom` $\rightarrow$ `Senior AI Architect` $\rightarrow$ `Report`) with live auto-scrolling terminal log stream and 1-click retry recovery card.
- **Rationale & "Why":** Provides complete visibility into technical assessment stages, eliminating user uncertainty during deep LLM reasoning.
- **Invariants:** All newly created UI components must stay $\le 350$ lines with decoupled state hooks.
