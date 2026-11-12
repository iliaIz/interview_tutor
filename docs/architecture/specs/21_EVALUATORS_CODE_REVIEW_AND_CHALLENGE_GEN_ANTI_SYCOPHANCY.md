# Spec 21: Epistemic Benevolence & Anti-Sycophancy Architecture (Part 3: Evaluators, Code Review, Challenge Generation & Zero-Phantom Deductions)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [GLOSSARY.md](../../../GLOSSARY.md), [PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md](../../reports/PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md), [Spec 19](19_EPISTEMIC_BENEVOLENCE_AND_ANTI_SYCOPHANCY_TRIAGE.md), [Spec 20](20_VOICE_SYSTEM_DESIGN_WAR_ROOM_ANTI_SYCOPHANCY.md), and Architectural Decision Record in `.ai/handoff/architect_response.md`.
- **Domain Intent**: Eliminate AI sycophancy, flattering "sandwich-review" commentary, and unearned passing scores across text interview question evaluation (`geminiText.ts`), automated Java 21 workspace code review (`codeEvaluator.ts`), and production bug incident challenge generation (`tutorService.ts`).
- **Operating Envelope**:
  - Conceptual grading evaluation via LiteLLM Proxy: Response latency $\le 3000$ ms, structured JSON output (`EvalResult`), strict mathematical ledger where `score = 100 - sum(deductions)`.
  - Java 21 practice code evaluation via LiteLLM Proxy: Full-Jitter retry (up to 2 retries, 40s per attempt timeout), structured JSON output (`EvaluationResult`), Verdict-First summary review.
  - Bug incident challenge synthesis via LiteLLM Proxy: Rich enterprise context (2025–2026 post-mortems), deterministic root cause physics (`bugExplanation`), progressive non-spoiler analytical hints.
  - File Length Invariants (Rule 8): Newly created files $\le 350$ lines, modified files $\le 400$ lines. Monolithic files exceeding 400 lines (`tutorService.ts` = 539 lines, `codeEvaluator.ts` = 399 lines) MUST NOT expand; logic must be decomposed into dedicated SRP modules (`bugChallengeTypes.ts`, `bugChallengeRepository.ts`, `codeEvaluatorTypes.ts`).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. Real JVM Sandbox execution engine and AST security rules (`JvmExecutionService.ts`, `astAnalyzer.ts`).
2. Frontend evaluation presentation components (`PracticeEvaluationModal.tsx`, `BugChallengeView.tsx`).
3. Database schemas and tables (SQLite `bug_challenges`, `questions`, PostgreSQL schemas) — column types, names, and nullability constraints remain 100% frozen.
4. Exported public function signatures: `evaluateAnswerWithGemini`, `evaluateChallengeSubmission`, `generateBugChallenge`, `getSavedBugChallenges`, `updateBugChallengeStatus`.

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam 1 (Conceptual Q&A Evaluator & Zero-Phantom Ledger)**:  
  `backend/src/services/geminiText.ts`
- **Primary Seam 2 (Java 21 Code Review & Verdict-First Summary)**:  
  `backend/src/services/codeEvaluator.ts` & `backend/src/services/codeEvaluatorTypes.ts`
- **Primary Seam 3 (Bug Challenge Synthesis & Ground Truth Physics)**:  
  `backend/src/services/tutorService.ts`, `backend/src/services/bugChallengeTypes.ts`, `backend/src/services/bugChallengeRepository.ts`
- **Primary Seam 4 (Automated Prompt Verification Suite)**:  
  `backend/src/scripts/verifyPrompts.ts`
- **Verification Command**:  
  `remote-verify` (Cloud verification via GitHub Actions runner to preserve the 1.8 GB VPS memory boundary) and static line count validation (`wc -l`).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Conceptual Answer Evaluation Contract (`EvalResult`)
Wire contract in `backend/src/services/geminiText.ts`:
```typescript
export interface EvalResult {
  score: number;         // 0-100, strictly 100 minus sum(deductions)
  isPassed: boolean;      // true iff score >= 70
  positivePoints: string[]; // Specific technical facts answered correctly; empty [] if none
  missingPoints: string[];  // Missing mechanisms or errors, each formatted with "[-X баллов]"
  feedback: string;       // Dry, objective technical verdict (2-3 sentences) without praise/flattery
}
```

#### Zero-Phantom-Deductions Ledger Specification:
1. Base score is 100 points.
2. Every item in `missingPoints` MUST end with an explicit deduction weight: e.g. `"Отсутствует проверка на carrier thread pinning в synchronized блоке [-25 баллов]"`.
3. Mathematical invariant: $\text{score} = 100 - \sum \text{deductions}$. If $\text{missingPoints} = []$, then $\text{score} = 100$.
4. If the candidate answer is fundamentally incorrect, $\text{score} < 70$ (`isPassed: false`), and `positivePoints` MUST be `[]`.
5. Under no circumstances may `feedback` contain empty compliments (`"Отличная попытка!"`, `"Ты молодец"`).

### 4.2. Java 21 Practice Code Review Contract (`EvaluationResult`)
Wire contract in `backend/src/services/codeEvaluatorTypes.ts` and `codeEvaluator.ts`:
```typescript
export interface ConcurrencyFinding {
  category: 'RACE_CONDITION' | 'NON_ATOMIC_COMPOUND' | 'JMM_VISIBILITY' | 'CARRIER_THREAD_PINNING' | 'DEADLOCK_RISK';
  location: string;
  description: string;
  remediation: string;
}

export interface EvaluationResult {
  compilationStatus: { isCompilable: boolean; syntaxErrors: { lineNumber: number; errorMessage: string }[] };
  virtualExecutionResult: { passCount: number; failCount: number; testCases: TestCaseResult[] };
  concurrencyAnalysis: { hasRaceConditions: boolean; hasJmmVisibilityIssues: boolean; hasCarrierThreadPinning: boolean; findings: ConcurrencyFinding[] };
  architecturalCompliance: { isSolidCompliant: boolean; springBootBestPracticesViolations: string[]; modernJava21IdiomAdoption: string[] };
  scoreBreakdown: {
    correctnessScore: number;
    concurrencyScore: number;
    architectureScore: number;
    modernIdiomsScore: number;
    overallScore: number;
    summaryReview: string;
  };
  evaluationTimestamp: string;
  astSignalsSummary: string[];
}
```

#### Verdict-First Summary Specification:
1. First sentence of `summaryReview` MUST immediately state production-readiness status and defect count:
   - Defective: `"Код не готов к продакшену из-за N критических дефектов многопоточности/архитектуры..."`
   - Production-ready: `"Код готов к продакшену: инварианты потокобезопасности, транзакционности и управления ресурсами соблюдены."`
2. Zero "sandwich feedback": starting with flattering compliments (`"Код написан аккуратно и чисто"`, `"Хорошая структура"`) when defects exist is strictly prohibited.
3. Zero-Fluff `findings`: contains ONLY real, verifiable defects. Compliments or styling trivia are forbidden.

### 4.3. Bug Incident Challenge Generation Contract (`BugChallenge`)
Extracted to `backend/src/services/bugChallengeTypes.ts`:
```typescript
export interface TechStackInfo {
  language: string;
  javaVersion: string;
  framework: string;
  keyLibraries: string[];
}

export interface ProductionContext {
  systemName: string;
  architectureType: string;
  incidentSymptoms: string;
  businessImpact: string;
  prReviewContext: string;
}

export interface BugChallenge {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  language: 'java' | 'sql' | 'kotlin';
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  hints: string[];
  categoryBadge?: string;
  difficultyBadge?: string;
  sampledQuestionId?: string;
  isTopicExhausted?: boolean;
  remainingCount?: number;
  totalTopicQuestions?: number;
  isSolved?: boolean;
  lastScore?: number;
  lastFeedback?: string;
  keyTakeaways?: string[];
  techStack?: TechStackInfo;
  productionContext?: ProductionContext;
  createdAt?: string;
}
```

#### Ground Truth Invariant for `bugExplanation`:
1. `bugExplanation` MUST detail the exact low-level failure physics:
   - JMM: missing happens-before edge, volatile write reordering, lock coarsening hazards.
   - Virtual Threads: carrier thread pinning inside synchronized blocks / native frames.
   - Spring Framework: proxy self-invocation bypassing `@Transactional` / `@Cacheable`, bean lifecycle races.
   - Database: non-repeatable read, lost update under Read Committed, HikariCP pool exhaustion.
2. Structured into: (a) Exact Root Cause Mechanism, (b) Runtime Failure Manifestation, (c) Required Production-Grade Fix.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Schema Changes**: Zero DDL changes. SQLite table `bug_challenges` columns and constraints remain 100% identical.
- **Repository Isolation**: Database queries (`SELECT`, `INSERT ... ON CONFLICT`, `UPDATE`) in `tutorService.ts` are extracted to `bugChallengeRepository.ts` as pure domain queries.
- **Rollout Strategy**: Additive-only refactoring; all existing imports are re-exported.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Conceptual Answer Grading (`evaluateAnswerWithGemini`)
- **Pre-Conditions {P}**: Non-empty `question`, `referenceAnswer`, and `userAnswer` strings; valid LiteLLM proxy connection.
- **Algorithm C**: Prompt evaluates candidate answer against reference using `EPISTEMIC_BENEVOLENCE_AXIOM` and `ZERO-PHANTOM-DEDUCTIONS`.
- **Post-Conditions {Q}**:
  - `score` equals $100 - \sum \text{deductions}$.
  - If `score < 100`, `missingPoints` is non-empty and contains deductions in `[-X баллов]` format.
  - If `score < 70`, `isPassed === false`.
  - `feedback` contains zero flattering cliches and states the primary point of failure.

### 6.2. Practice Code Review (`evaluateChallengeSubmission`)
- **Pre-Conditions {P}**: Valid `challenge` and sanitized `files` array; optional `sandboxResult`.
- **Algorithm C**: Evaluates AST signals and code snippets using `Verdict-First` summary rules and `Zero-Fluff` findings.
- **Post-Conditions {Q}**:
  - `summaryReview` starts with engineering production-readiness verdict.
  - `concurrencyAnalysis.findings` contains only genuine concurrency hazards without praise.
  - `overallScore` strictly computed from component weights.

### 6.3. Bug Challenge Generation (`generateBugChallenge`)
- **Pre-Conditions {P}**: Valid `topicId` and target stack preset.
- **Algorithm C**: Synthesizes production-grade incident challenge adhering to `EPISTEMIC RIGOR & GROUND TRUTH INVARIANT`.
- **Post-Conditions {Q}**:
  - `bugExplanation` details exact causal failure mechanics and why naive fixes fail.
  - `hints` provide non-spoiler analytical direction.
  - Result persisted to SQLite `bug_challenges` and returned to caller.
