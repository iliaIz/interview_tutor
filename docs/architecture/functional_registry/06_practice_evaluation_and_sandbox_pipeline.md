# 06. Practice Evaluation Pipeline & Live Review Monitoring

> **Location:** `docs/architecture/functional_registry/06_practice_evaluation_and_sandbox_pipeline.md`  
> **Subsystem (Level 1):** Practice Evaluation Pipeline & Live Review Monitoring  
> **Primary Files:** [`backend/src/routes/practice.ts`](file:///home/djelu/projects/interview_tutor/backend/src/routes/practice.ts), [`backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/sandbox/ChallengeEvaluationPipeline.ts), [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts), [`frontend/src/components/practice/useEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/useEvaluationPipeline.ts), [`frontend/src/components/practice/ReviewProgressConsole.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/ReviewProgressConsole.tsx)

---

## 1. Subsystem Scope
Handles candidate Java 21 workspace submission evaluation, orchestrating the In-Memory JVM Sandbox, static AST / Project Loom carrier-pinning analysis, LLM architecture scoring (`gemini-smart` via LiteLLM Proxy), and live Server-Sent Events (SSE) streaming with interactive UI status monitoring.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `handleEvaluationStream()` & `ChallengeEvaluationPipeline` (SSE Streaming Adapter & Pipeline)
- **Location:** [`backend/src/routes/practice.ts`](file:///home/djelu/projects/interview_tutor/backend/src/routes/practice.ts), [`backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/sandbox/ChallengeEvaluationPipeline.ts)
- **What Was Done:**
  - Safely purged legacy monolithic `challengeSubmissionService.ts` to uphold Ports & Adapters architecture.
  - Rewired `routes/practice.ts` (POST `/challenges/:id/evaluate` and `/evaluate`) as a clean HTTP SSE transport adapter streaming domain events from `ChallengeEvaluationPipeline.evaluate()`.
  - Configured SSE streaming response headers (`text/event-stream; charset=utf-8`, `no-cache, no-transform`, `keep-alive`, `X-Accel-Buffering: no`) with early header flushing.
  - Bound client disconnect to `AbortController` via `res.on('close')`.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Coupling Express `res` directly into domain logic in `challengeSubmissionService.ts` broke separation of concerns and prevented transport-agnostic pipeline reuse across WebSockets or background jobs.
  - *Intermediate Conclusion:* Pure async generator `AsyncIterable<EvaluationPipelineEvent>` decoupled from Express allows the route to act strictly as a streaming transport adapter.
- **Rationale & "Why":** Clean Architecture / Ports & Adapters separation and compliance with SPEC-004.
- **Invariants:** Domain evaluation pipeline must have zero Express imports; SSE transport adapter must cleanly `res.end()` on completion or failure.

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
### 2.7 Transactions Lab Unification, Ambient Voice Pairing, Submission Persistence & Focus Mode Fix
- **Location:** [`frontend/src/components/practice/PracticeArena.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/PracticeArena.tsx), [`frontend/src/components/practice/TransactionLabArena.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/TransactionLabArena.tsx), [`frontend/src/components/practice/TransactionLabHeader.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/TransactionLabHeader.tsx), [`frontend/src/components/practice/TransactionServiceEditor.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/TransactionServiceEditor.tsx), [`backend/src/services/practiceTxCatalogService.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/practiceTxCatalogService.ts), [`backend/src/services/live/liveWsChallengeResolver.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsChallengeResolver.ts), [`backend/src/routes/practice.ts`](file:///home/djelu/projects/interview_tutor/backend/src/routes/practice.ts)
- **What Was Done:**
  - **Focus Mode CSS Specificity Resolution:** Fixed specificity collision in `PracticeArena.tsx` where `mobileTab === 'spec'` caused `md:flex` to override `hidden` when `isFocusMode === true`. De-duplicated conditional class strings so `hidden` is unconditionally applied during Focus Mode, allowing the code editor to occupy 100% width.
  - **Transactions Lab Soft Luxury Pastel UI & 100dvh:** Replaced legacy dark slate background with platform canonical soft luxury pastel palette (`#FFF0F5`, `bg-pastel-bg text-pastel-text`, `h-[calc(100dvh-4rem)]`), matching Refactoring and Machine Coding arenas.
  - **Ambient Voice AI-Напарник:** Wired `usePracticeVoice()` and `AmbientVoicePill` into `TransactionLabArena`, allowing users to summon the voice AI partner during Spring Transaction puzzle solving and oral defense.
  - **Catalog Unification & SQLite Persistence:** Created `practiceTxCatalogService.ts` to surface 16 Spring Transaction scenarios under `/api/practice/challenges` (catalog total: 137 challenges), with full support for search queries and completion status filtering ("Все", "Решенные", "В процессе"). Enabled automatic submission recording to `/api/roadmaps/transactions/submissions` upon passing verification.
  - **Gemini Live Challenge Resolution Decomposition:** Extracted `liveWsChallengeResolver.ts` from `liveWsSessionParams.ts` (keeping both $\le 300$ lines, Rule 8 compliant) to resolve `spring_transaction_challenges` with `domain: 'transactions'` instead of falling back to `'lld'`.
  - **Cognitive Bounding Modularization:** Decomposed `TransactionLabArena.tsx` (436 lines down to 306 lines) into `TransactionLabHeader.tsx` (119 lines) and `TransactionServiceEditor.tsx` (91 lines).
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* Focus Mode was squeezing or hiding the code editor rather than the specification because Tailwind's responsive media query classes (`md:flex`) evaluate after non-responsive base classes (`hidden`), overriding visibility.
  - *Intermediate Conclusion:* In responsive layouts, hide/show states must be conditionally constructed in JSX/template strings to prevent CSS cascade specificity leaks.
- **Invariants:**
  - In Focus Mode, specification panels MUST have `hidden` and editors MUST expand to 100% available container width.
  - All source files must strictly respect Rule 8 cognitive limits ($\le 350$ lines for new files, $\le 400$ lines for modified files).
  - Passing Spring Transaction scenarios MUST persist verification status into SQLite database.

### 2.8 Mutation Testing Engine, Zero-Stillborn Invariant & Diagnostic Taxonomy Separation
- **Location:** [`backend/src/services/sandbox/runner/CompilerService.java`](file:///home/djelu/projects/interview_tutor/backend/src/services/sandbox/runner/CompilerService.java), [`backend/src/services/sandbox/JvmMutationEngine.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/sandbox/JvmMutationEngine.ts), [`backend/src/services/mutationChallenges/`](file:///home/djelu/projects/interview_tutor/backend/src/services/mutationChallenges/), [`frontend/src/components/practice/MutantDiffInspector.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/MutantDiffInspector.tsx), [`frontend/src/components/practice/MutationRadarWidget.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/MutationRadarWidget.tsx), [`backend/tests/verify_all_mutation_challenges.js`](file:///home/djelu/projects/interview_tutor/backend/tests/verify_all_mutation_challenges.js)
- **What Was Done:**
  - **Elimination of Stillborn Mutants in Catalogs:** Updated all 12 katas in L0 (Primitives `PRIM-01`..`06`) and L1 (Reverse Testing `REV-01`..`06`) to define `mutatedContent` as complete, self-contained, compilable Java source units matching SOTA late 2026 Gregor/PIT mutation testing standards.
  - **Modular Catalog Decomposition (Rule 8):** Decomposed `primitivesChallenges.ts` (1170 lines) into modular subcomponents: `l0PrimitivesPart1.ts` (303 lines), `l0PrimitivesPart2.ts` (310 lines), `l1ReversePart1.ts` (265 lines), `l1ReversePart2.ts` (237 lines), and re-exported clean aggregated entrypoints `primitivesChallenges.ts` (16 lines) and `reverseTestingChallenges.ts` (11 lines), ensuring all files stay strictly below the 350-line cognitive threshold.
  - **Defense-in-Depth Resilient Line Patching:** In `CompilerService.java` (lines 705–738), added runtime AST unit detection (`isFullUnit`). When a mutant provides a localized snippet without class declarations, the in-runner engine automatically patches the exact target line in the original source instead of overwriting the whole compilation unit. Additionally, compiler diagnostics (`mutantRun.compilerOutput`) are appended to `failureReason` for instant diagnostic transparency.
  - **Pre-Flight Normalization in Node Engine:** Enhanced `JvmMutationEngine.ts` to expand snippet mutants against in-memory source files before dispatching payload JSON across the daemon TCP socket.
  - **Diagnostic Taxonomy & Honest UI Feedback:** Fixed critical UI bug in `MutantDiffInspector.tsx` and `MutationRadarWidget.tsx` where checking `!isKilled` conflated `STILLBORN` with `SURVIVED`. Replaced false accusations of "Брешь в тестах: Ваши тесты проходят даже тогда, когда логика сломана" on compilation failures with dedicated amber `STILLBORN` compiler diagnostic alerts. Displayed `stillbornCount` in metrics grid when $> 0$.
  - **Automated CI/CD Quality Gate:** Implemented `verify_all_mutation_challenges.js` and wired it into `deploy.yml` to assert zero stillborn mutants and 100% structural integrity across all 42 platform mutation challenges.
- **Hypotheses & Intermediate Conclusions:**
  - *Observation:* When submitting `tmp/DiscountCalculatorTest.java` for `PRIM-01: Scalar Assertions & AAA Pattern`, the UI reported `STILLBORN MathMutator (+ instead of -) (строка 13) Брешь в тестах`. The test asserted `90.00` while `+` resulted in `110.00`, so the mutant should have been killed.
  - *Root Cause:* `primitivesChallenges.ts` defined `mutatedContent` as a single line snippet (`return originalPrice.add(discount)...`). `CompilerService.java` placed this snippet directly into `mutatedSources.put(targetKey, mutContent)`, replacing the entire Java class file with one return line, resulting in javac compiler syntax failure (`class, interface, enum, or record expected`). The UI then conflated `STILLBORN` with `SURVIVED`.
  - *Intermediate Conclusion:* Mutation engines must treat code replacements as complete source units or provide deterministic line-splicing fallbacks. UI presentation layers must strictly separate user test deficiencies (uncaught semantic mutations) from infrastructure compiler errors.
- **Invariants:**
  - Every mutant in all 42 platform katas must either compile as a complete unit or patch safely into the target source file without creating Stillborn mutants.
  - The UI MUST never display "Брешь в тестах" when a mutant fails due to compiler errors (`STILLBORN`).




