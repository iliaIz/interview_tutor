# Subsystem 07: Refactoring Arena & Voice Code Review Subsystem

> **Location:** `docs/architecture/functional_registry/07_refactoring_arena_subsystem.md`  
> **SSOT Hierarchy:** Functional Registry (Depth = 2)  
> **Related Architecture Spec:** [`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](../specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)  
> **Wave Plan:** [`docs/roadmap/wave_16_canonical_refactoring_arena_and_voice_first_code_review/00_MASTER_PLAN.md`](../../roadmap/wave_16_canonical_refactoring_arena_and_voice_first_code_review/00_MASTER_PLAN.md)

---

## 1. Subsystem Scope & Architectural Invariants

The Refactoring Arena & Voice Code Review subsystem delivers canonical technical interview challenges (Junior L0 to Staff L3) focused on:
1. Identifying architectural code smells and systemic vulnerabilities verbally in natural Russian with an AI interlocutor.
2. In-Memory 3-Gate Sandbox evaluation (Contract Characterization Tests -> AST/Bytecode Smell Verification -> Virtual Thread Latency/Allocation telemetry).
3. Live Socratic voice guidance and Bar-Raiser oral defense powered by Gemini Live (`@google/genai` protocol via LiteLLM Proxy).

### Hard Invariants
- **First-Turn Lockdown Invariant:** Gemini Live is strictly blocked from calling `submit_interview_evaluation` before the candidate speaks (`hasCandidateResponded === false`).
- **Carrier Pinning Invariant:** `monitorenter` / `synchronized` blocks inside blocking paths (HTTP/DB) under Virtual Threads (Loom) are strictly rejected by Gate 2 AST verifier.
- **Financial Precision Invariant:** Any use of `double` or `float` for currency calculations is hard-blocked (`BigDecimal` with `RoundingMode.HALF_EVEN` enforced).
- **Time Virtualization Invariant:** Direct calls to `System.currentTimeMillis()`, `Instant.now()`, or `LocalDate.now()` are blocked; `java.time.Clock` must be constructor-injected.
- **Cognitive Bounding Limit:** All new source files $\le 350$ lines; modified files $\le 400$ lines (Rule 8).

---

## 2. Functions Touched & Decision Log

### 2.1. `verifyRefactoringAst(files, constraints)`
- **File:** `backend/src/services/sandbox/RefactoringAstVerifier.ts`
- **1. What Was Done:** Created specialized AST/Opcode verifier for refactoring challenges. Verifies `SynchronizedTree` (Loom pinning), `double`/`float` in financial entities, `ThreadLocal` storage, and `java.time.Clock` injection. Corrected schema import to use canonical `@interview-prep/shared` monorepo link.
- **2. Hypotheses & Intermediate Conclusions:** Regex-only heuristics on source code fail when keywords appear inside comments or string literals. AST node parsing via `@babel/parser` / Tree-sitter AST or precise token stream analysis reliably isolates field definitions and method body statements without false positives. Deep relative path imports (`../../../../shared/src/...`) break TypeScript cross-package compilation under rootDir rules.
- **3. Rationale & "Why":** Greenfield machine coding bans `new Thread` or `new FileWriter` entirely, but refactoring challenges start with *dirty legacy code* that contains simulated legacy network/file calls. Refactoring AST scanner inspects target entities and flags only architectural smells while allowing legacy seams.
- **4. Failure Modes & Invariants:** Bypassing AST scan by wrapping code in reflection is prevented by `AstSecurityScanner` sandbox boundary.

---

### 2.2. `handleRefactoringSmellToolCall(ctx)`
- **File:** `backend/src/services/live/liveRefactoringToolDispatcher.ts`
- **1. What Was Done:** Implemented native non-blocking tool dispatcher for `report_identified_smell(smellId, justification)`. Dispatches real-time WebSocket frame `{ type: 'smell_discovered', smellId, justification }` to client frontend. Fixed context typing to canonical `LiveToolContext` from `liveToolDispatcher.ts`.
- **2. Hypotheses & Intermediate Conclusions:** Relying on transcript text scraping with regex caused severe false positives/negatives due to speech recognition variations in Russian tech jargon (e.g., "пиннинг потоков", "блокировка монитора", "гонка данных").
- **3. Rationale & "Why":** Gemini Live's function calling protocol provides semantic comprehension of candidate arguments. Emitting a dedicated WebSocket frame decouples audio playout from UI scorecard rendering.
- **4. Failure Modes & Invariants:** Tool responses MUST be sent back to `geminiSocket` immediately with valid function response schema to prevent upstream generation stalls or 1011 timeout disconnects.

---

### 2.3. `buildLivePairPrompt(params)` & `getLivePairPersonaInstruction(domain, persona)`
- **Files:** `backend/src/prompts/live/livePairPrompts.ts`, `backend/src/prompts/live/livePairPersonaInstructions.ts`
- **1. What Was Done:** Decomposed 403-line monolithic prompt builder by extracting persona directives into `livePairPersonaInstructions.ts` (152 lines). Added Socratic instructions for `refactoring` domain across all 4 personas (`junior_explainer`, `senior_socratic`, `faang_interviewer`, `middle_peer`).
- **2. Hypotheses & Intermediate Conclusions:** Monolithic prompt file was growing past cognitive limits. Subcomponent extraction keeps `livePairPrompts.ts` at 266 lines while allowing rich persona instructions.
- **3. Rationale & "Why":** On Turn 0, the interviewer asks the candidate to examine the code and voice identified smells. When the candidate explains a defect, the interviewer invokes `report_identified_smell`.
- **4. Failure Modes & Invariants:** The prompt explicitly forbids the AI interviewer from suggesting "rewrite from scratch" and requires Socratic probing around Michael Feathers' Seams and Characterization Tests.

---

### 2.4. `RefactoringSmellChecklistPanel` & `PracticeCatalogHeader`
- **Files:** `frontend/src/components/refactoring/RefactoringSmellChecklistPanel.tsx`, `frontend/src/components/practice/PracticeCatalog.tsx`
- **1. What Was Done:** 
  - Created `RefactoringSmellChecklistPanel` (254 lines) listening to `window.addEventListener('smell_discovered')` with real-time green glowing badges, manual checklist fallback, and Bar-Raiser Q&A accordion.
  - Decomposed 1130-line `PracticeCatalog.tsx` into `PracticeCatalogHeader.tsx` (289 lines), `PracticeChallengeCard.tsx` (89 lines), and `PracticeChallengeInspector.tsx` (245 lines), reducing `PracticeCatalog.tsx` to 357 lines.
  - Added Refactoring Arena flagship card and level filters (L0 Junior, L1 Middle, L2 Senior, L3 Staff).
- **2. Hypotheses & Intermediate Conclusions:** Previously, `refactoring_kata` was the 7th item in an overflow horizontal tab strip, virtually invisible to users. Elevating it to a top-level flagship card alongside Transactions Lab and Testing Arena boosts discovery to 100%.
- **3. Rationale & "Why":** Strict adherence to Rule 8 (file decomposition) and Rule 6 (viewport stability and reference-counted locks).
- **4. Failure Modes & Invariants:** Client-side event bus prevents race conditions: if WebSocket frame arrives before DOM component mounts, the manifest's default state is preserved until hydration.

### 2.5. `handleChallengeEvaluation(params)` Gate 2 AST Hook
- **File:** `backend/src/services/challengeSubmissionService.ts`
- **1. What Was Done:** Hooked `RefactoringAstVerifier.verify` into the SSE submission evaluation pipeline for `isRefactoringKata`. Extracted `structuralConstraints` directly from parsed challenge manifest.
- **2. Hypotheses & Intermediate Conclusions:** In `challengeSubmissionService.ts`, `challenge` is already deserialized from `row.manifest_json`. Attempting to access `challenge.manifest_json` resulted in TypeScript compilation failure `TS2339`.
- **3. Rationale & "Why":** The database stores raw JSON string in column `manifest_json`, but upon SELECT and JSON.parse, the typed object is `CodingChallenge` (which contains `structuralConstraints` at root level for refactoring challenges).
- **4. Failure Modes & Invariants:** If structural constraints fail, violations are injected into `sandboxResult.securityViolations`, failing Gate 2 and providing precise file/line/snippet feedback in SSE.

---

## 3. Subsystem Health & Verification Summary
- **Database Catalog:** 24 canonical challenges ingested into SQLite `data/interview.db` (4 Junior, 4 Middle, 8 Senior, 8 Lead).
- **JSON Manifest SSOT:** `json/refactoring_challenges.json` verified with complete multi-file workspaces and Bar-Raiser questions.
- **Automated Verification:** `scripts/verify_refactoring_suite.py` passes 100% green.
