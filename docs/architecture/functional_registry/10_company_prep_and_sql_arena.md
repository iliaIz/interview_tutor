# Subsystem 10: Targeted Company Preparation Hub & In-Browser SQL Arena

> **Location:** `docs/architecture/functional_registry/10_company_prep_and_sql_arena.md`  
> **Parent Index:** [`INDEX.md`](./INDEX.md)  
> **Governing Specification:** [`10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md`](../specs/10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md)  
> **Status:** Active (Empirically Verified SOTA Late 2026)

---

## 1. Architectural Purpose & Boundaries

This subsystem introduces company-targeted technical assessment pipelines (starting with Raiffeisenbank / Raiffeisen DGTL) without creating parallel silos, duplicate coding engines, or server memory bloat.

### Critical Invariants Enforced:
1. **Canonical SSOT Projections:** All coding katas, system design scenarios, questions, and code review challenges reside in canonical datasets. Company tracks sequence these as curated DAG pipelines.
2. **Zero-VPS-Load In-Browser PostgreSQL 16:** Interactive SQL queries execute via `@electric-sql/pglite` (WebAssembly build of official PostgreSQL 16) directly in candidate browsers (<30ms cold start, 0 MB server RAM load), strictly protecting the 1.8 GB VPS.
3. **Deterministic SQL Result Comparator:** Compares ground-truth rows against candidate results, handling Three-Valued Logic NULLs, floating point precision ($10^{-4}$ epsilon), column mismatches, and `orderMatters` assertions.
4. **Company Readiness Index (CRI):** Telemetry-backed readiness metric aggregating weighted completions across all pipeline stages.

---

## 2. Catalog of Touched Functions & Subsystems

### 2.1. `executeSqlChallenge(challenge, candidateQuery, options)`
- **File:** `frontend/src/services/sql/pgliteExecutionEngine.ts`
- **What Was Done:** Instantiates an ephemeral in-memory PostgreSQL 16 WebAssembly instance, applies schema DDL and seed data with intentional NULLs, executes the ground-truth expected query and candidate query, and evaluates relational diffs.
- **Hypothesis & Conclusion:** 
  - *Hypothesis:* WebAssembly Postgres will provide full PostgreSQL syntax support (`NOT EXISTS`, `INTERVAL '30 days'`, `DENSE_RANK`, `COUNT(*) FILTER`, `NULLIF`) without consuming server resources.
  - *Empirical Observation:* PGlite executes relational queries in 1–5 ms with zero server memory footprint, cleanly distinguishing three-valued logic outcomes.
- **Rationale & Why:** Dockerized Postgres per user violates VPS memory constraints; SQLite lacks PostgreSQL dialect features. PGlite in WASM solves the root cause.
- **Failure Modes & Invariants:** Ephemeral instances are strictly closed in a `finally` block to prevent browser memory leaks; query execution is bounded by an 8,000 ms timeout.

### 2.2. `evaluateSqlResultDiff(expectedRows, actualRows, orderMatters)`
- **File:** `frontend/src/services/sql/tableDiffEvaluator.ts`
- **What Was Done:** Implements multiset and ordered relational tuple comparison. Detects column count/name mismatches, row count deltas, missing rows, unexpected rows, and sort order violations.
- **Hypothesis & Conclusion:** Prevents string-matching and regex false-positives by comparing actual relational projections.
- **Rationale & Why:** Multiple queries (e.g. CTE vs subquery vs LEFT JOIN ... WHERE IS NULL) can produce identical sets; evaluating relational results ensures pedagogical fairness.

### 2.3. `CompanyPrepStudio`
- **File:** `frontend/src/components/companies/CompanyPrepStudio.tsx`
- **What Was Done:** Decomposed studio hub implementing the 4-tab workflow: Pipeline (5-stage hiring progression), Dossier (Product Engineer paradigm, Red/Green flags), Runbook (4-min pitch, checklist), and embedded SQL Arena.
- **Failure Modes & Invariants:** Adheres strictly to the $\le 350$ lines file hygiene limit by decomposing into `CompanyPipelineTab`, `CompanyDossierTab`, `CompanyRunbookTab`, and `SqlArenaHeader`.

### 2.4. `raiffeisen_dgtl_pe` Voice Persona
- **File:** `backend/src/prompts/personas.ts`
- **What Was Done:** Added the `raiffeisen_dgtl_pe` persona directive to Gemini Live prompting, calibrating questions on STAR, TTM/Pain Index, `BigDecimal` invariants, and deterministic DB lock ordering (`min -> max`).

### 2.5. Catalog Path Resolution & Production Volume Isolation
- **Files:** `backend/src/utils/pathResolver.ts`, `backend/src/routes/companies.ts`, `backend/src/routes/sqlChallenges.ts`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`
- **What Was Done:** 
  1. Created unified `resolveJsonCatalogPath(filename)` checking multi-environment candidates (`process.cwd()/json`, `dist/../json`, `src/../../json`, `/app/json`).
  2. Replaced fragile single `__dirname/../../../json` paths in `companies.ts` and `sqlChallenges.ts`.
  3. Removed obsolete `./json:/app/json:ro` volume mount in `docker-compose.prod.yml` to prevent stale host mounts from masking Docker image builds.
  4. Added `git fetch origin main && git checkout -f "${GITHUB_SHA}"` to `deploy.yml` on VPS.
  5. Added explicit loading, error, and retry states (`RotateCcw`, `AlertCircle`) in `CompanyPrepStudio.tsx` and `SqlArena.tsx` to eliminate infinite hangs.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* `path.resolve(__dirname, '../../../json/...')` in compiled `dist/routes/` resolved to container root `/json/...` instead of `/app/json/...`, throwing `ENOENT` and returning empty lists.
  - *Empirical Observation:* Confirmed via VPS container logs: `[CompaniesRoute] Failed to load company profiles: Error: ENOENT: no such file or directory, open '/json/company_profiles.json'`.
- **Rationale & Why:** Hardcoded relative paths break across TS source vs. compiled dist. Multi-path fallback resolution combined with self-contained Docker images resolves the root cause.
- **Failure Modes & Invariants:** Prevents `ENOENT` on missing files; prevents silent JSON catalog drift across environments; guarantees actionable UI recovery cards on fetch failures.

### 2.6. Wave 4: Multimodal Theory Deck & Zero-Auto-Send Copilot Adapter (SPEC-29)
- **Files:** `frontend/src/services/CompanyTrackContextAdapter.ts`, `frontend/src/components/companies/useCompanyTheoryDeck.ts`, `frontend/src/components/companies/CompanyQuestionItem.tsx`, `frontend/src/components/companies/CompanyTheoryHeader.tsx`, `frontend/src/components/companies/CompanyTheoryDeckTab.tsx`
- **What Was Done:**
  1. Extracted `CompanyTrackContextAdapter` normalizing company profiles and theory questions into canonical `TutorActiveContext` and typed `VoiceModal` props.
  2. Eliminated eager chat dispatch (`store.sendMessage`) when opening Copilot drawer (`Zero-Auto-Send Invariant`). Drawer now opens with contextual chips (`💡 Объяснить физику концепции`, `🎯 Что спросит сеньор?`, `❌ Красные флаги`, `⚡ Сократический блиц`), leaving user in full control of prompt execution.
  3. Added multimodal Live Gemini Voice sessions directly from each question card: `🎙️ Тьютор` (`initialSessionType="tutor"` for Socratic learning without evaluation pressure) and `🎙️ Скрининг` (`initialSessionType="interview"` for scored oral evaluation).
  4. Decomposed `CompanyTheoryDeckTab.tsx` (339 lines -> 165 lines) into headless hook and focused presenter components, achieving 100% Rule 8 file hygiene compliance.
- **Hypotheses & Conclusions:**
  - *Hypothesis:* Eagerly sending synthetic chat messages on button click hijacked user intention and violated ADR 0003. Decoupling drawer opening from LLM execution restored candidate control.
  - *Observation:* Users can now choose whether to learn via voice (Live Gemini), get examined (Screening), or ask specific questions in Copilot without unwanted text spam.
- **Rationale & Why:** Adheres strictly to the Hub-and-Spoke Copilot architecture (ADR 0003) and Gemini Live multimodal state machine (ADR 0004).


### 2.6. Polymorphic `TutorActiveContext` & Omnipresent AI Copilot
- **Files:** `shared/src/schemas/tutorContext.ts`, `shared/src/schemas/tutorNormalizer.ts`, `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`, `backend/src/routes/practiceTutorStreaming.ts`, `frontend/src/store/tutorTransport.ts`, `frontend/src/store/usePracticeTutorStore.ts`, `frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx`, `frontend/src/components/practice/tutor/TutorQuickActionChips.tsx`.
- **What Was Done:**
  1. Built canonical `TutorActiveContext` schema and normalizers (`normalizeSqlArenaContext`, `normalizeCompanyContext`, `normalizePracticeContext`).
  2. Single global root-mounted `<PracticeTutorDrawer />` in `App.tsx` shared across Practice, SQL Arena, and Company Prep Studio (Zero Parallel Reimplementation Invariant).
  3. Polymorphic SSE streaming backend (`/api/practice-tutor/chat`) dynamically selecting Socratic personas (`sql_arena`, `company_interviewer`, `junior_explainer`, `middle_scaffold`, `senior_socratic`).
  4. Decoupled transport module (`tutorTransport.ts`) keeping store under file hygiene limits.
- **Hypotheses & Conclusions:** Unified drawer eliminates duplicate code, state sync bugs, and redundant streaming routes while dynamically adapting chips and instructions to candidate context.

### 2.7. Take-Home Project Lab & 25 PR Flaw Forensics
- **File:** `frontend/src/components/companies/CompanyTakeHomeLab.tsx`
- **What Was Done:**
  1. Built interactive lab mirroring official `Raiffeisen-DGTL/cib-interns-test-task` (`/income`, `/outcome`, `/socks`).
  2. Implemented forensics on 5 real candidate PR rejections (PR #173 race condition in Java memory read, PR #169 missing composite UNIQUE, PR #174 double precision loss in cottonPart, PR #171 missing DDL constraint, PR #177 silent catch).
  3. Interactive quiz with canonical atomic single-line SQL solution:
     `UPDATE socks SET quantity = quantity - :quantity WHERE color = :color AND cotton_part = :cottonPart AND quantity >= :quantity;`.

### 2.8. 9 PE Competencies, 8-Point Spec Review, 4 STAR Cases, Talent Q Guide
- **Files:** `frontend/src/components/companies/dossier/CompanyCompetenciesRadar.tsx`, `frontend/src/components/companies/dossier/CompanySpecReviewChecklist.tsx`, `frontend/src/components/companies/dossier/CompanyStarScenarios.tsx`, `frontend/src/components/companies/dossier/CompanyTalentQGuide.tsx`, `frontend/src/components/companies/CompanyDossierTab.tsx`.
- **What Was Done:**
  1. 9 Product Engineer competencies radar with self-assessment filter and bar-raiser question prompts.
  2. Interactive 8-point Spec Review checklist tracking readiness before defense.
  3. 4 STAR situation cards (Compliance tokenization, Strangler Fig legacy migration, Blameless 12-min post-mortem, AI agent idempotency guards).
  4. Talent Q 72-hour survival guide with live numerical $\Delta\%$ calculator and verbal logic decision rules.

### 2.9. Canonical FinTech System Design & Machine Coding Challenges
- **Files:** `scenarios/manifests/l5_senior/SD-ATM-HARDWARE-DISPENSER.json`, `scenarios/manifests/l5_senior/SD-REALTIME-FRAUD-DETECTION.json`, `json/machine_coding_challenges.json`, `json/refactoring_challenges.json`.
- **What Was Done:**
  1. Bankomat ATM Cash Dispenser manifest (Bounded Knapsack, 2-phase hold/clear ledger protocol, paper jam compensation).
  2. Real-Time Card Fraud Scoring manifest (SLA < 100ms, Redis Cluster, Flink streaming, Drools/ML fallback).
  3. `iban-validator` challenge (ISO 13616 streaming mod 97, zero BigInteger allocation).
  4. `sparse-vector` challenge (Two-pointer CSR storage over primitive arrays $O(\min(L_1, L_2))$).
  5. `case_transfer_service` (7 defects: Deadlock row lock ordering min->max, Lost Update, Fail-Fast, Idempotency, rollbackFor Exception, dirty checking redundant save, boundary validation).
  6. `case_account_collections` (`Account.java`: package SecurityException, TreeMap Date millisecond collision, double precision loss, System.currentTimeMillis ID collision).

### 2.10. SPEC-12: Deepened Manifest SSOT & Deterministic ArenaNavigator Seam Architecture
- **Files:** `shared/src/schemas/companyProfile.ts`, `shared/src/schemas/tutorNormalizer.ts`, `json/company_profiles.json`, `frontend/src/services/arenaNavigator.ts`, `frontend/src/components/companies/CompanyPrepStudio.tsx`, `frontend/src/components/companies/CompanyDossierTab.tsx`, `frontend/src/components/companies/dossier/*`, `frontend/src/components/companies/CompanyTakeHomeLab.tsx`, `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`.
- **What Was Done (SPEC-12 Execution):**
  1. **SSOT Manifest Ingestion (Issue #55):** Extended `CompanyProfileSchema` with typed domain collections (`competencies`, `specReviewChecklist`, `starScenarios`, `talentQGuide`, `takeHomePrCases`, `customQuickActionChips`). Ingested 9 PE competencies, 8 spec review checks, 4 STAR cases, Talent Q guide, and 3 PR cases into `json/company_profiles.json`. Added schema validation test suite `test_company_profile_schema.js`.
  2. **Deterministic ArenaNavigator Seam (Issue #56):** Implemented `launchArenaTask`, `resolveStageTarget`, and `resolveRunbookTaskTarget` in `frontend/src/services/arenaNavigator.ts`. Pre-hydrates target arena stores (Practice, Incidents, System Design) before view switching, completely eliminating dangling entity IDs and string-prefix sniffing. Dynamic `VoiceModal` props driven by company profile.
  3. **Manifest-Driven Dossier View Adapters (Issue #57):** Transformed all 4 dossier components (`CompanyCompetenciesRadar`, `CompanySpecReviewChecklist`, `CompanyStarScenarios`, `CompanyTalentQGuide`) into generic view adapters reading from `profile` props while preserving 100% of interactive calculators, checklists, and visual state.
  4. **Purged Copilot Domain Leakage (Issue #58):** Purged hardcoded bank entities from `tutorNormalizer.ts` and `polymorphicPromptBuilder.ts`. Socratic chips and take-home context are generated dynamically from the company manifest with clean generic fallbacks.
  5. **Take-Home Forensics Decomposition (Issue #59):** Refactored `CompanyTakeHomeLab.tsx` to read PR forensics from `profile.takeHomePrCases`, deleted ~160 lines of hardcoded arrays, reducing file length to 197 lines (strictly $\le 200$ lines).
- **Invariants Upheld:** Zero-trust local execution (all 5 issues verified via cloud `remote-verify` in GitHub Actions), Cognitive Bounding (all files $\le 350$ lines, TakeHomeLab $\le 200$ lines), Zero Phantom Fallbacks, UI Deletion Test Exception adhered to.

---

### 2.11. Wave 7 Architectural Deepening: SQL Arena Headless Engine & Modular Workbench
- **Files Touched:**
  - `frontend/src/components/sql/hooks/useSqlArena.ts`
  - `frontend/src/components/sql/components/SqlChallengeDetailCard.tsx`
  - `frontend/src/components/sql/components/SqlWorkbenchPanel.tsx`
  - `frontend/src/components/sql/SqlArena.tsx`
- **1. What Was Done:**
  - Extracted `useSqlArena` (184 lines) headless hook managing PGlite execution lifecycle, catalog loading, tab auto-routing heuristic (`diff`/`result`), Copilot store synchronization, and global keyboard shortcuts.
  - Extracted `SqlChallengeDetailCard` (40 lines) rendering category, difficulty grade, challenge title, interview trap description, and instructions markdown.
  - Extracted `SqlWorkbenchPanel` (78 lines) owning CodeMirror editor buffer, execution toolbar, reset, and AI-Copilot launch action.
  - Collapsed `SqlArena.tsx` from 379 lines down to 192 lines.
- **2. Hypotheses & Intermediate Conclusions:**
  - Mixing PGlite WASM query execution, CodeMirror configuration, results tab rendering, and Copilot store synchronization inside `SqlArena.tsx` created monolithic component bloat. Extracting `useSqlArena` isolates all state and asynchronous execution logic behind a clean headless interface.
- **3. Rationale & "Why":** Strict adherence to Rule 8 file hygiene ($\le 350$ lines for new files, $\le 400$ lines for modified files) and headless domain decoupling.
- **4. Failure Modes & Invariants:**
  - Query execution with matched diff automatically routes to `result` with success confetti.
  - Query execution with unmatched diff automatically routes to `diff` view.
  - Omnipresent Copilot store context is synchronized on challenge/sql change and cleanly pruned on arena unmount.

---

### 2.12. Wave 8 Architectural Deepening: Company Prep Studio Session & Header Decoupling
- **Files Touched:**
  - `frontend/src/components/companies/hooks/useCompanyStudioSession.ts`
  - `frontend/src/components/companies/components/CompanyPrepStudioHeader.tsx`
  - `frontend/src/components/companies/CompanyPrepStudio.tsx`
- **1. What Was Done:**
  - Extracted `useCompanyStudioSession.ts` (171 lines) headless hook managing profile loading, CRI score calculation, localStorage completed stages persistence, polymorphic Copilot context synchronization, and arena navigation routing.
  - Extracted `CompanyPrepStudioHeader.tsx` (120 lines) rendering the brand banner and sub-tab selection bar.
  - Collapsed `CompanyPrepStudio.tsx` from 365 lines down to 165 lines.
- **2. Hypotheses & Intermediate Conclusions:**
  - As the top churn hotspot (7 commits across recent PRs), `CompanyPrepStudio.tsx` had accumulated heavy state management and side effects. Isolating session state and navigation into `useCompanyStudioSession` decoupled business logic from presentation.
- **3. Rationale & "Why":** Strict adherence to Rule 8 file hygiene ($\le 350$ lines for new files, $\le 400$ lines for modified files) and headless domain decoupling.
- **4. Failure Modes & Invariants:**
  - CRI readiness index calculations remain monotonic and accurately reflect stage weights and mastery updates.
  - Copilot state automatically clears on arena unmount to prevent stale context bleeding.

---

### 2.13. Spec 44 Architectural Deepening (`#168–#169`): Manifest Readiness Repository, Tenant Auth & ArenaNavigation Seam
- **Files Touched:**
  - `shared/src/schemas/companyProfile.ts`
  - `backend/src/services/companies/CompanyReadinessRepository.ts`, `backend/src/routes/companies.ts`, `backend/tests/test_company_readiness_repo.js`
  - `frontend/src/services/arenaNavigator.ts`, `frontend/src/store/slices/academySlice.ts`
  - `frontend/src/components/companies/hooks/useCompanyStudioSession.ts`, `CompanyPrepStudio.tsx`, `CompanyPrepStudioHeader.tsx`, `CompanyChallengesTab.tsx`, `frontend/src/services/CompanyTrackContextAdapter.ts`
- **1. What Was Done:**
  - Added TypeBox `CompanyProfileSchema` validation (`Value.Check`), manifest-driven `readinessConfig` SQL & `questionCatalogFile` loading, and injectable `database` into `CompanyReadinessRepository.ts`; switched `routes/companies.ts` to `getAuthUserId(req)`.
  - Consolidated academy & company arena transitions behind `ArenaWorkspaceCoordinator` (`arenaNavigator.ts`), replaced hardcoded switch arrays in `useCompanyStudioSession`, `CompanyChallengesTab`, and `CompanyTrackContextAdapter` with manifest data (`curatedChallenges`, `readinessConfig`, `voicePreset`), and cleared completed stage/tab state on company switches.
- **2. Failure Modes & Invariants:**
  - `companies` endpoints never default to `'default_user'`; invalid company manifests fail explicit TypeBox validation; switching companies resets `completedCompanyStageIds` to `[]`.

---

### 2.14. Spec 58 (`#208`): Company Context Normalization, Dynamic Bar-Raiser & Atomic Drawer Selectors
- **Files Touched:** `frontend/src/services/CompanyTrackContextAdapter.ts`, `frontend/src/components/companies/hooks/useCompanyStudioSession.ts`, `frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx`, `frontend/src/components/practice/tutor/practiceContextBuilder.ts`.
- **1. What Was Done:**
  - Rebuilt `CompanyTrackContextAdapter.createTheoryQuestionContext` over shared `normalizeCompanyContext`, ensuring full red/green/take-home context parity without manual duplication.
  - Hardened `useCompanyStudioSession` to clear stale `activeContext` on missing profiles and keep `sql_arena` context isolated across tab transitions.
  - Slimmed `PracticeTutorDrawer.tsx` (`189L <= 270L`) using an `isOpen` mount guard + atomic selectors + lazy `buildLivePracticeContext` dispatch evaluation + dynamic `${companyName} Bar-Raiser` labeling.
- **2. Invariants:** Closed `PracticeTutorDrawer` never subscribes to keystroke or sandbox state; hardcoded bank labels never override active `companyContext.companyName`.





