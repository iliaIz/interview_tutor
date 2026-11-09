# Spec 15: Practice Catalog Starter Workspace & TDD Remediation

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing ADR [`docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md`](file:///home/djelu/projects/interview_tutor/docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), Spec 06 [`06_MACHINE_CODING_AND_LLD.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/specs/06_MACHINE_CODING_AND_LLD.md), Spec 02 [`02_TESTING_AND_MUTATION_ARENA.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/specs/02_TESTING_AND_MUTATION_ARENA.md), and Audit Report [`docs/reports/PRACTICE_CATALOG_COMPLETION_AND_INTEGRITY_AUDIT.md`](file:///home/djelu/projects/interview_tutor/docs/reports/PRACTICE_CATALOG_COMPLETION_AND_INTEGRITY_AUDIT.md).
- **Core Intent**: Remediate the 61 defective practice katas (out of 132 total) where starter workspaces accidentally contained reference solutions, pre-killed mutants, or pre-fixed code review bugs. Enforce the Zero-Stillborn Starter Invariant: every kata must start in an actionable, incomplete state requiring candidate implementation to pass.
- **Operating Envelope**:
  - Target Catalog Size: 132 coding challenges across 7 tracks.
  - Initial Workspace State: 100% of Machine Coding challenges must start **RED** (`testsPassed: false` on initial run); 100% of Mutation challenges must start with `mutationScore < requiredScore` (mutants survive initial run); 100% of Code Review challenges must contain the documented defects.
  - Evaluation Latency: JVM compilation & test run $\le 1200$ms in cloud sandbox.
  - Tenancy Isolation: Single-user workspace drafts per challenge session; zero cross-talk between candidate draft and canonical seed.

## 2. Explicit Non-Goals (Blast-Radius Protection)
- **Forbidden Modifications**:
  - `frontend/src/audio/` and `backend/src/services/live/` (Gemini Live Audio pipeline is strictly out of scope).
  - The 71 already correct challenges (`lld-*` 35 tasks, `L0-REF`..`L3-REF` 24 tasks, `DP-01`..`DP-07` 7 tasks, core stubs) must NOT have their schemas or contracts modified.
  - `coding_submissions` schema and historical submissions for other challenges must not be dropped or wiped.
  - `ChallengeEvaluationPipeline.ts` gate architecture (Sandbox $\to$ AST $\to$ Mutation $\to$ AI Review $\to$ Persistence) must remain immutable.

## 3. Pre-Agreed Verification Seams
- **Primary Seam 1 (Catalog Integrity & Zero-Stillborn Starter Suite)**:
  - File: `backend/tests/verify_starter_workspaces_integrity.js`.
  - Asserts that no challenge starter workspace in `SEEDED_CHALLENGES`, `machine_coding_challenges.json`, `additionalChallenges.ts`, `refactoring_challenges.json`, and `mutationChallenges` contains fully implemented solution code or killing assertions.
- **Primary Seam 2 (Challenge Fetch & Submission Reset Seam)**:
  - Route: `GET /api/practice/challenges/:id` (returns clean stub when no submission exists).
  - Persistence: `backend/src/services/sandbox/evaluationPipelinePersistence.ts` and `coding_submissions` table.
- **Real-Wire Dependencies**:
  - SQLite `interview.db` (real transactional catalog).
  - Cloud Java 21 Sandbox runner (`interview-sandbox`). Zero internal domain mocks.

## 4. Formal Wire & Messaging Contracts
- **Challenge Hydration Wire Contract (`GET /api/practice/challenges/:id`)**:
```json
{
  "challenge": {
    "id": "iban-validator",
    "title": "Валидация банковского счета IBAN (ISO 13616, mod 97)",
    "workspaceFiles": [
      {
        "path": "src/main/java/com/bank/iban/IbanValidator.java",
        "content": "package com.bank.iban;\n\npublic class IbanValidator {\n    public boolean validate(String iban) {\n        // TODO: Реализуйте потоковую валидацию IBAN по стандарту ISO 13616 без использования BigInteger\n        throw new UnsupportedOperationException(\"Not implemented yet\");\n    }\n}\n",
        "readOnly": false,
        "isMainEntryPoint": true
      },
      {
        "path": "src/test/java/com/bank/iban/IbanValidatorTest.java",
        "readOnly": true
      }
    ]
  },
  "lastEvaluation": null,
  "savedDraft": null
}
```

- **Starter Workspace Schema Contract**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "StarterWorkspaceManifest",
  "type": "object",
  "required": ["id", "workspaceFiles"],
  "properties": {
    "id": { "type": "string" },
    "workspaceFiles": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "content", "readOnly"],
        "properties": {
          "path": { "type": "string" },
          "content": { "type": "string" },
          "readOnly": { "type": "boolean" },
          "isMainEntryPoint": { "type": "boolean" }
        }
      }
    }
  }
}
```

## 5. Storage & Migration Contract
- **Strategy**: Additive In-Place Manifest Refresh (`dbSeedCatalogs.ts`).
- **Data Remediation**:
  1. `json/machine_coding_challenges.json`: Replace reference implementations in `iban-validator` and `sparse-vector` with `UnsupportedOperationException` stubs.
  2. `json/refactoring_challenges.json`: Re-inject the documented 7 architectural defects into `case_transfer_service` and 6 defects into `case_account_collections`.
  3. `backend/src/services/additionalChallenges.ts`: Replace full method bodies in the 14 `mc_*` tasks with TDD stubs (`throw new UnsupportedOperationException("Not implemented yet");`).
  4. `backend/src/services/mutationChallenges/`: Clean all 42 `*Test.java` files, removing killing assertions and leaving test method skeletons / incomplete tests so initial mutation score is below threshold.
  5. SQLite Database Synchronization: Reseed `coding_challenges.manifest_json` via `dbSeedCatalogs.ts`.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1 Machine Coding Initial Run Contract
- **Pre-Conditions {P}**:
  - Challenge is of category `machine_coding` (e.g. `iban-validator`, `sparse-vector`, `mc_*`, `lld-*`).
  - Candidate opens challenge with initial `workspaceFiles` (zero modifications).
- **Algorithm C**:
  - Candidate executes `POST /api/practice/evaluate/:id` without code modifications.
  - Sandboxed compiler runs `javac` and `mvn test`.
- **Post-Conditions {Q}**:
  - `sandboxResult.success === false` OR `sandboxResult.failedCount > 0`.
  - Gate 1 `SANDBOX_EXECUTION` emits status `'FAILED'` due to `UnsupportedOperationException` or assertion mismatch.
  - Status is strictly NOT `'PASSED'`; submission score is $\le 20$.
- **Orthogonal Invariant**: Under no circumstances does an unmodified Machine Coding starter workspace evaluate to `PASSED` or score $\ge 70$.

### 6.2 Mutation Testing Initial Run Contract
- **Pre-Conditions {P}**:
  - Challenge is of category `testing_mutation` (`TST-01`..`TST-42`).
  - Candidate opens challenge with initial starter test suite.
- **Algorithm C**:
  - Candidate triggers mutation run via sandbox pipeline.
  - JVM Mutation Engine injects configured mutants into production class.
- **Post-Conditions {Q}**:
  - Initial `mutationScore.percentage < requiredMutationScore` (mutants survive).
  - Gate 3 `MUTATION_TESTS` emits status `'FAILED'` with remediation hint.
  - Challenge cannot be completed until candidate adds tests that kill all surviving mutants.

### 6.3 Code Review Bug Presence Contract
- **Pre-Conditions {P}**:
  - Challenge is of track `raiffeisen_code_review` (`case_transfer_service`, `case_account_collections`).
- **Algorithm C**:
  - Candidate opens initial codebase.
- **Post-Conditions {Q}**:
  - `TransferService.java` contains unsorted locks (deadlock risk), missing `findForUpdate` (lost update risk), and missing fail-fast check.
  - `Account.java` contains `package java.snippet.account`, `TreeMap<Date>`, and `double balance`.
  - Code Review test suite verifies the presence of defects or fails until candidate refactors.
