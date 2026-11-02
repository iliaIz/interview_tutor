---
status: accepted
verification: pending
date: 2026-11-02
---

# 0001. SOTA 2026 Design Patterns Practice Arena Architecture

## Context & Problem Statement
Technical interview candidates frequently memorize the 23 Gang of Four (GoF 1994) patterns academically as copy-paste class diagrams without understanding why they exist, when they introduce counterproductive accidental complexity, or how modern Java 21 LTS constructs make classic GoF boilerplate obsolete. 
Traditional pattern training platforms ask candidates to construct toy implementations (e.g. `Dog extends Animal`, `MySingleton.getInstance()`). In enterprise software engineering, writing raw mutable singletons creates hidden global state and breaks test parallelization, implementing classic Visitor classes obscures code that should use sealed interfaces with pattern matching, and hand-crafting Strategy class hierarchies duplicates functionality provided natively by first-class functions (`Function<T, R>`).
We need an educational practice track that trains developers to identify real code smells (anti-patterns) and refactor them into either modern Java 21 idioms or classic enterprise patterns (State, Adapter, Decorator, Proxy, Chain of Responsibility), while guarding against overengineering.

## Decision
1. **Host within `PracticeArena` as a Polymorphic Category (`category: 'design_patterns'`):**
   Extend the existing `PracticeArena` multi-file Monaco workspace, JVM sandbox runner, and voice companion rather than inventing a disconnected UI studio or duplicate execution harness.
2. **Pedagogical Loop: "Anti-Pattern Refactoring":**
   Each exercise starts with a realistic, compilable, working production service containing severe architectural smells (e.g. 500-line procedural switch cascades, hardcoded third-party vendor SDKs, mutable global state, CGLIB self-invocation proxy bypasses). The candidate refactors the code to an idiomatic pattern while preserving public behavioral contracts verified by unit tests.
3. **Multi-Gate Deterministic Verification:**
   - **Gate 1 (JVM Sandboxing):** Functional test suite execution verifying behavioral regression immunity.
   - **Gate 2 (Structural AST Invariants):** Static syntax enforcement via `RefactoringAstVerifier` (e.g., prohibiting `getInstance()`, detecting procedural switch cascades over polymorphic state, mandating `sealed interface` or constructor injection).
   - **Gate 4 (Senior AI Judge):** Socratic feedback evaluating trade-offs, code clarity, and architectural cleanliness.
4. **Curriculum Matrix (3 Archetypes):**
   - *Archetype A (Modern Replacements)*: Java 21 idioms replacing GoF boilerplate (Strategy via lambdas, Visitor via sealed hierarchy + pattern matching, Iterator via Streams).
   - *Archetype B (Anti-Pattern Traps)*: Eliminating anti-patterns (Singletons -> Spring DI Scope, Giant conditional ladders -> State pattern, Vendor lock-in -> Hexagonal Port/Adapter).
   - *Archetype C (Enterprise Spring GoF)*: Real-world patterns in Spring Boot (Proxy & AOP self-invocation caveats, Decorator for repository cross-cutting concerns, Chain of Responsibility for security/validation filters).
5. **Voice AI Socratic Overengineering Sentinel:**
   Real-time voice companion prompts the candidate with Socratic inquiries probing pattern justification (e.g., "Why not use a standard map of functions here instead of 5 separate Strategy classes?").
6. **Zero-Migration Data Persistence:**
   Store challenges in `coding_challenges` and candidate solutions in `coding_submissions` using `manifest_json.designPatternContext` (zero DDL locks, zero SQLite table migrations).

## Verification & Guardrail
- **Gate 2 AST Guardrail:** `RefactoringAstVerifier.ts` with explicit AST constraint definitions (`disallowedConstructs`, `requiredKeywords`, `disallowedImports`).
- **Test Seam:** `tests/integration/test_design_patterns_pipeline.ts` verifying that procedural shortcuts and mutable singleton workarounds fail Gate 2, while valid polymorphic and functional refactorings pass.
- **Contract Enforcement:** TypeBox schemas `DesignPatternChallengeManifestSchema` in `@interview-prep/shared`.

## Consequences
- **Positive**:
  - Eliminates superficial pattern memorization; candidates learn root-cause detection and design trade-offs.
  - Zero database schema migrations and zero UI component proliferation (full code reuse with `WorkspaceEditor`, `LiveVoiceEngine`, and `ChallengeEvaluationPipeline`).
  - AST verification ensures candidates cannot pass challenges by simply "making tests green" through procedural hacks.
- **Trade-offs / Negatives**:
  - Authoring realistic anti-pattern codebases requires higher initial content investment than toy code snippets.
  - AST verifier requires regex/AST rule calibration to avoid false-positive rejections on legitimate candidate variations.

## Considered & Rejected Alternatives
- **Alternative 1: Standalone Design Patterns Studio:**
  Rejected due to massive code duplication (re-implementing Monaco multi-file tabs, execution state machines, and audio routing).
- **Alternative 2: Greenfield Toy Pattern Katas:**
  Rejected because asking candidates to implement a clean-slate `CarBuilder` or `Singleton` reinforces memorization without teaching how to identify architectural debt in production legacy systems.
- **Alternative 3: LLM-Only Grading (No AST Verifier):**
  Rejected due to non-determinism and sycophancy; LLMs often grant 100% scores to procedural code that fails to implement the required architectural abstraction.
