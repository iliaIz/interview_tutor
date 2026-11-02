# Design Patterns Practice Arena Specification (Pillar 09 SSOT)

> **Document:** `docs/architecture/specs/09_DESIGN_PATTERNS_PRACTICE_ARENA.md`  
> **Status:** Authoritative Single Source of Truth (SSOT)  
> **Target Standard:** SOTA Late 2026 / Java 21 LTS  
> **Governing ADR:** [docs/adr/0001-sota-2026-design-patterns-practice.md](file:///home/djelu/projects/interview_tutor/docs/adr/0001-sota-2026-design-patterns-practice.md)  
> **Ubiquitous Language:** [GLOSSARY.md](file:///home/djelu/projects/interview_tutor/GLOSSARY.md)

---

## 1. Intent & Workload Envelope

### 1.1. Core Mission
The **Design Patterns Practice Arena** trains software engineers to identify real production architectural smells (anti-patterns) and refactor them into either modern Java 21 idioms (replacing obsolete GoF boilerplate) or classic enterprise patterns (State, Adapter, Decorator, Proxy, Chain of Responsibility, Spring DI). Unlike theoretical quiz systems or toy implementations (`Dog extends Animal`), candidates refactor compiling, test-backed legacy modules to eliminate architectural debt without breaking behavioral contracts.

### 1.2. Operating Envelope
- **Gate 2 AST Structural Verification Latency:** $p50 < 5$ms, $p99 < 15$ms (pure in-memory AST scan).
- **Catalog Query Latency:** $p50 < 10$ms, $p99 < 30$ms via SQLite indexed query.
- **Full 5-Gate Evaluation Latency:** $p95 < 4500$ms (JVM Docker Sandbox + AST Verifier + LiteLLM Judge).
- **Concurrency & QPS Target:** 25 req/sec interactive code submissions, 100 QPS catalog lookups.
- **Tenancy Isolation:** `shared-multi-tenant` with strict tenant user ID scoping (`req.user.id`).
- **Data Classification:** `Internal` (educational code files, AST violation logs, evaluation scores).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementation agent is **strictly forbidden** from touching or modifying the following subsystems:
1. **Realtime Voice & Audio DSP Pipeline:** `backend/src/services/live/`, `frontend/src/worklets/`, `frontend/src/services/audio/` (AudioWorklet ring buffers, EchoGuard, Auto-VAD WebSockets).
2. **Spaced Repetition & Cognitive Ladder:** `backend/src/services/fsrs/`, `fsrs_card_states` table.
3. **Sandbox Infrastructure Harness:** `docker/` container definitions, memory bounds, or network sandboxing scripts.
4. **Existing DDL Schema:** No `ALTER TABLE`, `DROP TABLE`, or destructive schema mutations in `backend/src/services/dbSchema.ts`.
5. **Parallel Studio Implementations:** Prohibited from creating duplicate Monaco editors, duplicate SSE runners, or secondary WebSocket endpoints.

---

## 3. Pre-Agreed Verification Seams

1. **Primary Seam 1 (AST Structural Guardrail):**  
   `backend/src/services/sandbox/RefactoringAstVerifier.ts`  
   *Seam Type:* Pure TypeScript headless domain service.  
   *Requirement:* Zero network dependencies, zero DB calls, sub-10ms execution verifying syntax shape (`disallowedConstructs`, `requiredKeywords`, `disallowedImports`).
2. **Primary Seam 2 (5-Gate Evaluation Pipeline):**  
   `backend/src/services/sandbox/ChallengeEvaluationPipeline.ts`  
   *Seam Type:* Decoupled `AsyncIterable<EvaluationPipelineEvent>`.  
   *Requirement:* Enforces sequential gates: Gate 1 (JVM Tests) -> Gate 2 (AST Invariants) -> Gate 4 (AI Evaluation) -> Gate 5 (SQLite persistence).
3. **Primary Seam 3 (Catalog & Routing API):**  
   `backend/src/routes/practice.ts` & `frontend/src/components/practice/PracticeCatalogConstants.ts`  
   *Seam Type:* REST endpoints (`GET /api/practice/challenges?category=design_patterns`).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Manifest Schema Extension (`@interview-prep/shared`)
Stored within `coding_challenges.manifest_json`:

```typescript
export interface DesignPatternContext {
  targetPattern: 'STATE' | 'ADAPTER' | 'DECORATOR' | 'PROXY' | 'CHAIN_OF_RESPONSIBILITY' | 'FACTORY_METHOD' | 'BUILDER' | 'SEALED_VISITOR_REPLACEMENT' | 'FUNCTIONAL_STRATEGY';
  categoryTier: 'modern_alternatives' | 'anti_patterns' | 'enterprise_gof';
  antiPatternSmell: {
    name: string;
    description: string;
    symptoms: string[];
    riskImpact: string;
  };
  modernAlternativeTip?: string;
  socraticProbes: Array<{
    id: string;
    question: string;
    expectedTradeOffConsideration: string;
  }>;
  structuralConstraints: {
    disallowedConstructs?: string[]; // e.g. ['getInstance', 'synchronized']
    disallowedImports?: string[];    // e.g. ['java.lang.ThreadLocal']
    disallowedFieldTypes?: string[]; // e.g. ['double', 'float']
    requiredInjections?: string[];   // e.g. ['java.time.Clock']
    requiredKeywords?: string[];     // e.g. ['sealed interface', 'record', 'permits']
    maxMethodLines?: number;         // Caps procedural giant methods
  };
}
```

### 4.2. Synchronous REST Contract
- `GET /api/practice/challenges?category=design_patterns&archetype={archetype}`
  - **Headers:** `Authorization: Bearer <token>` or Cookie session.
  - **Response (200 OK):**
    ```json
    [
      {
        "id": "DP-01-STATE-ORDER-FSM",
        "slug": "state-order-fsm-refactoring",
        "title": "Refactoring Procedural Order State Ladder to State Pattern",
        "category": "design_patterns",
        "track": "design_patterns",
        "badge": "🔄 State Pattern",
        "difficulty": "Middle",
        "targetStack": "Java 21 LTS",
        "shortDescription": "Устранение 400-строчного каскада if/else в OrderService через полиморфную стейт-машину"
      }
    ]
    ```

---

## 5. Storage & Zero-Downtime Migration Contract

- **Strategy:** `Additive-Only`.
- **Database Table:** Reuses existing `coding_challenges` and `coding_submissions`.
- **Lock-Safety:** Zero DDL executions. The `manifest_json` column stores `DesignPatternContext` directly.
- **Index Re-use:** Existing B-Tree index `idx_code_chall_cat` on `coding_challenges(category)` immediately serves category filters in $O(\log N)$.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Operation: Filter Catalog by Design Patterns
- **Pre-Conditions {P}:** Caller invokes `GET /api/practice/challenges?category=design_patterns`.
- **Algorithm C:**
  1. Parameterized query executes: `SELECT id, slug, title, category, track, badge, difficulty, target_stack, time_limit_minutes, short_description, task_code, updated_at FROM coding_challenges WHERE category = 'design_patterns'`.
  2. If `archetype` query parameter is provided, filter rows in memory or via indexed `task_code`.
- **Post-Conditions {Q}:** Returns HTTP 200 array of challenge summaries with zero manifest deserialization overhead.

### 6.2. Operation: Gate 2 AST Verification (`RefactoringAstVerifier.verify`)
- **Pre-Conditions {P}:**
  - Gate 1 (JVM sandboxed test execution) completed with `testsPassed === true`.
  - Candidate submitted $N \ge 1$ Java files.
- **Algorithm C:**
  1. Strip block comments preserving newline offsets.
  2. Validate each line against `disallowedConstructs` (e.g. `getInstance()`, raw procedural state switch).
  3. Validate against `disallowedImports` and `disallowedFieldTypes`.
  4. Validate presence of `requiredKeywords` (e.g. `sealed interface` for Visitor replacement).
- **Post-Conditions {Q}:**
  - If violations $> 0$: Pipeline emits `{ gate: 'AST_INVARIANTS', status: 'FAILED', payload: { violations } }`, persists record with `score = 30`, and halts before invoking LiteLLM.
  - If violations $== 0$: Pipeline emits `{ gate: 'AST_INVARIANTS', status: 'PASSED' }`, unblocking Gate 4 AI evaluation.

### 6.3. Operation: Gate 4 Overengineering & Socratic Review
- **Pre-Conditions {P}:** Gate 1 and Gate 2 have PASSED.
- **Algorithm C:**
  - AI Judge evaluates candidate's refactoring against `socraticProbes` and `antiPatternSmell`.
  - Assesses whether candidate introduced class explosion where a simple `Function<T, R>` or Java record was appropriate.
- **Post-Conditions {Q}:** Emits `{ gate: 'AI_EVALUATION', status: 'PASSED', payload: { score, feedback, rubricScores } }`.
