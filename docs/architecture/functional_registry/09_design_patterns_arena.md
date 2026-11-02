# Subsystem 09: Design Patterns Practice Arena Subsystem

> **Location:** `docs/architecture/functional_registry/09_design_patterns_arena.md`  
> **SSOT Hierarchy:** Functional Registry (Depth = 2)  
> **Related Architecture Spec:** [`docs/architecture/specs/09_DESIGN_PATTERNS_PRACTICE_ARENA.md`](../specs/09_DESIGN_PATTERNS_PRACTICE_ARENA.md)  
> **Governing ADR:** [`docs/adr/0001-sota-2026-design-patterns-practice.md`](../../adr/0001-sota-2026-design-patterns-practice.md)

---

## 1. Subsystem Scope & Architectural Invariants

The **Design Patterns Practice Arena** trains engineers to identify production architectural code smells (anti-patterns) and refactor them into modern Java 21 idioms or classic enterprise GoF patterns without introducing accidental complexity.

### Core Architecture
1. **Three-Tier Curated Curriculum Matrix:**
   - *Tier A: Modern Java 21 Replacements* (Strategy $\rightarrow$ `Function<T, R>` lambdas, Visitor $\rightarrow$ `sealed interface` + pattern matching in `switch`, Iterator $\rightarrow$ Streams).
   - *Tier B: Anti-Pattern Traps* (Mutable Singleton $\rightarrow$ Spring DI Singleton Scope, Procedural status switch spaghetti $\rightarrow$ State pattern, Tight vendor SDK $\rightarrow$ Hexagonal Ports & Adapters).
   - *Tier C: Enterprise Spring GoF* (Spring AOP Proxy self-invocation `@Transactional` bypass, Decorator pattern for cross-cutting repository concerns).
2. **Deterministic Gate 2 AST Structural Verifier:**
   Syntactic guardrails enforcing structural shape (`disallowedConstructs: ['getInstance', 'PROCEDURAL_STATE_SWITCH']`, `requiredKeywords: ['sealed interface', 'record']`, `maxMethodLines: 25`).
3. **Gate 4 Overengineering Sentinel:**
   LiteLLM prompt directive penalizing GoF class explosion where clean Java 21 standard features suffice.

### Hard Invariants
- **Zero Local Heavy Build Invariant:** Local node strictly respects 1.8 GB RAM constraint; heavy builds and tests run in GitHub Actions runners (`remote-verify`).
- **Cognitive Bounding Limit:** Source files $\le 350$ lines; modified files $\le 400$ lines (Rule 8).
- **Zero Database Migration Invariant:** Challenge manifests persisted in existing SQLite `coding_challenges.manifest_json` without DDL schema modifications.

---

## 2. Functions Touched & Decision Log

### 2.1. `RefactoringAstVerifier.verify(files, constraints)`
- **File:** `backend/src/services/sandbox/RefactoringAstVerifier.ts`
- **1. What Was Done:** Extended in-memory AST verifier with `disallowedConstructs` (detecting `getInstance()` singleton anti-pattern, `PROCEDURAL_STATE_SWITCH`), `requiredKeywords` (verifying `sealed interface`, `permits`, `record`), and `checkMethodLengths` (bounding procedural giant methods).
- **2. Hypotheses & Intermediate Conclusions:** Relying solely on JVM test results allows candidates to bypass patterns through procedural shortcuts. AST verification rejects procedural cheats in $<10$ms before invoking heavy LLM judges.
- **3. Rationale & "Why":** Candidates often write green tests using mutable global state or giant switch blocks. Enforcing structural AST constraints ensures candidates actually refactor into the target design abstraction.
- **4. Failure Modes & Invariants:** Comment stripping preserves newline indices to pinpoint exact violation lines without false positives on string literals.

---

### 2.2. `ChallengeEvaluationPipeline.evaluate(input)`
- **File:** `backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`
- **1. What Was Done:** Wired `manifest.category === 'design_patterns'` into evaluation flow: Gate 1 runs sandbox tests with `isRefactoring: true`; Gate 2 extracts AST constraints from `manifest.designPatternContext.structuralConstraints` and terminates stream if violated; Gate 4 delegates to LiteLLM judge.
- **2. Hypotheses & Intermediate Conclusions:** Reusing the generic 5-gate pipeline prevents duplicating runner code and ensures consistent SSE progress events across all platform tracks.
- **3. Rationale & "Why":** A unified pipeline guarantees that candidates cannot bypass AST checks even when unit tests pass 100%.

---

### 2.3. `evaluateChallengeSubmission(req)`
- **File:** `backend/src/services/codeEvaluator.ts`
- **1. What Was Done:** Injected `Overengineering Sentinel` directive into the evaluator system instruction when `challenge.designPatternContext` is present. Prompts judge to penalize 10-class boilerplate when Java 21 lambdas or records are cleaner.
- **2. Hypotheses & Intermediate Conclusions:** Without explicit negative penalties for class proliferation, LLMs enthusiastically praise textbook 1994 GoF boilerplate even when modern Java 21 features make it obsolete.
- **3. Rationale & "Why":** Senior interviewers look for pragmatic trade-offs, not blind pattern dogmatism.

---

### 2.4. `seedNextGenCatalogs(db)`
- **File:** `backend/src/services/dbSeedCatalogs.ts` & `json/design_patterns_challenges.json`
- **1. What Was Done:** Created seed catalog with 7 high-quality production refactoring challenges (`DP-01` to `DP-07`) and wired automatic idempotent upsert into `coding_challenges` table.
- **2. Hypotheses & Intermediate Conclusions:** Synthetic toy examples (`Dog extends Animal`) do not prepare candidates for legacy production codebases. Each kata includes messy initial code, realistic domain context, and characterization unit tests.

---

### 2.5. Frontend UI & HUD Integration
- **Files:** `frontend/src/components/practice/PracticeCatalogConstants.ts`, `frontend/src/components/practice/PracticeCatalogHeader.tsx`, `frontend/src/components/practice/ChallengeSpecPanel.tsx`
- **1. What Was Done:** Added `design_patterns` category with `DESIGN_PATTERNS_ARCHETYPES` filter pills; rendered `DesignPatternContext` banner in `ChallengeSpecPanel` highlighting the target pattern, anti-pattern smell, and modern Java 21 tip.
- **2. Hypotheses & Intermediate Conclusions:** Reusing `WorkspaceEditor` and `PracticeArena` provides seamless Monaco multi-file editing and audio companion support with zero new components.
