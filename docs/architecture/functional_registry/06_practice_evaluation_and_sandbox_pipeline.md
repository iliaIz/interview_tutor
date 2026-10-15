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

---

### 2.4 SSE Content Negotiation & Reverse-Proxy Flush Contract
- **Location:** [`backend/src/routes/practice.ts`](file:///home/djelu/projects/interview_tutor/backend/src/routes/practice.ts), [`backend/src/services/challengeSubmissionService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/challengeSubmissionService.ts), [`frontend/src/components/practice/useEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useEvaluationPipeline.ts)
- **What Was Done:**
  - Standardized SSE content negotiation: backend defaults `isSse = true` unless client explicitly requests `application/json` without `?stream=true`.
  - Frontend explicitly passes `Accept: text/event-stream` and `?stream=true`.
  - Added explicit `res.flush()` invocation in `sendSse()` to bypass Node compression middleware buffer lag.
  - Implemented client defensive fallback: if proxy strips SSE and delivers direct `application/json` payload, or returns un-prefixed JSON chunks, client parses it directly and transitions Stepper to final report instead of stalling.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Browser `fetch('/api/practice/evaluate')` without explicit `Accept` defaults to `*/*`. Backend evaluated `isSse` as `false`, completed JVM + Gemini evaluation in 8s, and returned `res.json(...)`. Frontend SSE reader ignored lines without `data:` prefix, leaving the UI permanently stuck on Step 1 ("Песочница JVM 21").
  - *Intermediate Conclusion:* End-to-end stream contract must be symmetrical and defense-in-depth: explicit request headers, unbuffered proxy routing (`flush_interval -1`), immediate server socket flushes, and resilient multi-mode client parsers.
- **Invariants:** Review pipeline must stream progress by default and cleanly resolve both streaming SSE frames and direct JSON payloads without client deadlocks.

### 2.5 Concurrency Finding Normalization & Safe Modal Rendering
- **Location:** [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts), [`backend/src/services/codeEvaluatorSchema.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluatorSchema.ts), [`frontend/src/components/practice/PracticeEvaluationModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/PracticeEvaluationModal.tsx)
- **What Was Done:**
  - Strengthened system prompt contract in `codeEvaluator.ts` to explicitly define the `findings` schema as an array of objects `{ category, location, description, remediation }`, and mandated that `findings` MUST be empty `[]` when code is thread-safe without placing praises/compliments in findings.
  - Implemented `normalizeConcurrencyFindings()` in `codeEvaluatorSchema.ts` to normalize both structured objects and plain string arrays from LLMs or legacy records, mapping categories to valid enums and filtering out false-positive praises when no concurrency race conditions exist.
  - Added resilient client-side normalization in `PracticeEvaluationModal.tsx`, preventing empty category brackets `[]` or blank `💡 Рекомендация:` boxes from ever rendering if optional fields are missing or if raw text was returned.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Candidate review modal displayed empty `[]` and `💡 Рекомендация: ` with blank text because the LLM generated an array of strings (e.g. `["AtomicReference used correctly..."]`) rather than objects, which the frontend rendered by accessing non-existent object properties `f.category` and `f.remediation`.
  - *Intermediate Conclusion:* LLMs must receive concrete few-shot JSON structures in output format prompts, and the backend/frontend must enforce symmetrical normalization contracts to tolerate schema drift and gracefully support legacy database submissions.
- **Invariants:** Every finding rendered in `PracticeEvaluationModal` is guaranteed to contain non-empty text, and praise comments are never presented under the red concurrency defect banner.

### 2.6 Voice-First Review Discussion & 100% Russian Language Lock
- **Location:** [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts), [`backend/src/services/live/LiveGreetingReplay.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/LiveGreetingReplay.ts), [`backend/src/prompts/live/livePairPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts), [`frontend/src/store/useAppStore.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/store/useAppStore.ts), [`frontend/src/components/practice/PracticeEvaluationModal.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/PracticeEvaluationModal.tsx), [`frontend/src/components/practice/PracticeArena.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/PracticeArena.tsx)
- **What Was Done:**
  - Locked `codeEvaluator.ts` system prompt to 100% Russian via `LANGUAGE_LOCK_INVARIANT`, preserving code tokens and Java terms in Latin.
  - Extended WebSocket `session_init` frame and backend `ProxySession` with `seniorReview` payload (`overallScore`, `summaryReview`, `findings`, `focusedFinding`).
  - Added Section 3.1 in `livePairPrompts.ts` to ground Gemini Live pair programming with the exact defects and scores from the code review.
  - Enhanced `LiveGreetingReplay.ts` on Turn 0 to verbalize the review results, score, and specific defect directly into the candidate's headphones.
  - Added `isPracticeReportModalOpen` to `useAppStore.ts` ensuring that closing or docking the modal retains `activePracticeReport`.
  - Upgraded `PracticeEvaluationModal.tsx` with 🎙️ «Разобрать замечание голосом» on defect cards and 🎙️ «Обсудить отчет голосом» in the footer, with «К коду (свернуть)» for non-destructive docking.
  - Integrated `PracticeArena.tsx` with file auto-focus in Monaco editor and docked `🏆 85/100` badge to reopen the review modal at any time.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Review reports were previously written in English because the system prompt was in English without the language lock invariant. In addition, users who prefer voice had no way to transition from reading defects to discussing them with the AI in real time.
  - *Intermediate Conclusion:* Seamless modal-to-voice handoff preserves the candidate's working memory, auto-focuses the relevant file in the editor, and starts an interactive verbal pairing session without cognitive friction.
- **Rationale & "Why":** SOTA 2026 Voice-First platform paradigm: voice is the primary modality for interactive review, reflection, and live refactoring.
- **Invariants:**
  - All review findings and summaries must be 100% Russian.
  - Closing the review modal must never discard `activePracticeReport`.
  - Turn 0 greeting must immediately address the candidate and the defect in Russian.


