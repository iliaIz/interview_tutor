# Spec: Platform Security & Tenancy Isolation Hardening (SPEC-05)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [`GLOSSARY.md`](file:///home/djelu/projects/interview_tutor/GLOSSARY.md) terms: `Tenant Scoping`, `FSRS Card State`, `Candidate Error Gap`, `Prompt Injection Defense`. Harmonizes [`docs/architecture/reviews/practice_subsections/00_PRACTICE_AI_ARCHITECTURAL_AUDIT.md`](file:///home/djelu/projects/interview_tutor/docs/architecture/reviews/practice_subsections/00_PRACTICE_AI_ARCHITECTURAL_AUDIT.md).
- **Operating Envelope**:
  - Request volume: Up to 50 concurrent authenticated candidate sessions.
  - P99 latency: $\le 15$ms for authentication, authorization, and payload validation middleware.
  - Tenancy isolation: `isolated-multi-tenant` (Zero cross-tenant leakage between user IDs in SQL, memory vectors, and FSRS repetitions).
  - Data classification tier: `Internal` / `PII` (Candidate code drafts, evaluation transcripts, knowledge decay vectors).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from modifying:
1. **Gemini Live WebSocket session management**: `backend/src/services/live/LiveVoiceSession.ts`, `sessionFsm.ts` (governed by SPEC-06).
2. **Frontend UI styling & themes**: `frontend/src/components/*` (only auth token propagation in API clients may be aligned).
3. **LiteLLM Gateway proxy routing**: `LiteLLM_Proxy/*` and upstream model configurations.
4. **JVM Sandbox container runtime**: `backend/src/services/sandbox/JvmExecutionService.ts`.

## 3. Pre-Agreed Verification Seams
- **Primary Seam**: Express route middleware and vector memory caller seams:
  - `backend/src/routes/practice.ts`
  - `backend/src/services/live/liveEvaluationToolDispatcher.ts`
  - `backend/src/services/live/liveWorkspaceHandlers.ts`
  - `backend/src/services/codeEvaluator.ts`
- **Real-Wire Dependencies**: Real SQLite database instance with schema fixtures. Zero mocks for `requireAuth`, `db`, or `vectorMemoryService`.
- **Environment Invariant (Strict Rule 0)**:
  - Local VPS: ONLY fast static typechecking (`export PATH="/home/djelu/.local/node/bin:$PATH" && cd backend && npx tsc --noEmit`).
  - Cloud CI/CD: Full security audit and auth integration verification in GitHub Actions cloud runner via `remote-verify`.

## 4. Formal Wire & Messaging Contracts

### 4.1. Authenticated Practice Routes
```yaml
openapi: 3.1.0
paths:
  /api/practice/transaction-lab/draft:
    post:
      summary: Auto-save transaction lab scenario draft
      security:
        - BearerAuth: []
        - CookieAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [scenarioId, code]
              properties:
                scenarioId: { type: string, maxLength: 100 }
                code: { type: string, maxLength: 200000 }
      responses:
        '200': { description: Draft saved successfully }
        '401': { description: Unauthorized }
        '400': { description: Payload validation error }

  /api/practice/transaction-lab/draft/{scenarioId}:
    get:
      summary: Retrieve saved transaction lab draft
      security:
        - BearerAuth: []
        - CookieAuth: []
      parameters:
        - name: scenarioId
          in: path
          required: true
          schema: { type: string, maxLength: 100 }
      responses:
        '200': { description: Draft state returned }
        '401': { description: Unauthorized }
        '404': { description: Draft not found }

  /api/practice/reset/{challengeId}:
    post:
      summary: Reset workspace and delete submission records for challenge
      security:
        - BearerAuth: []
        - CookieAuth: []
      parameters:
        - name: challengeId
          in: path
          required: true
          schema: { type: string, maxLength: 100 }
      responses:
        '200': { description: Challenge workspace reset }
        '401': { description: Unauthorized }

  /api/practice/{challengeId}/export-zip:
    get:
      summary: Export candidate workspace solution as a Maven zip archive
      security:
        - BearerAuth: []
        - CookieAuth: []
      parameters:
        - name: challengeId
          in: path
          required: true
          schema: { type: string, maxLength: 100 }
      responses:
        '200': { description: Zip archive streamed }
        '401': { description: Unauthorized }
```

### 4.2. Vector Memory & Knowledge Decay Signature Contracts
```typescript
export interface KnowledgeDecayParams {
  userId: string;
  topic?: string;
  decayRate?: number;
}

export interface CandidateErrorGapRecord {
  userId: string;
  topic: string;
  subtopic?: string;
  questionText: string;
  candidateAnswerText: string;
  feedbackText: string;
  severity: 'minor' | 'moderate' | 'critical';
}
```

## 5. Storage & Zero-Downtime Migration Contract
- **Rollout Strategy**: Additive-Only middleware attachment and query scoping. Zero database DDL schema migrations required.
- **Data Protection**: Existing tables (`coding_submissions`, `candidate_error_vectors`, `fsrs_card_states`) already feature `user_id` columns; this specification mandates strict `user_id = ?` enforcement in all queries.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Route Authentication & Payload Bounding
- **Pre-Conditions {P}**:
  - Request received on `/transaction-lab/draft`, `/transaction-lab/draft/:scenarioId`, `/reset/:challengeId`, or `/:challengeId/export-zip`.
- **Algorithm C**:
  1. Validate auth token via `requireAuth` middleware. If missing or invalid $\rightarrow$ return `HTTP 401 Unauthorized`.
  2. For `POST /draft` and `POST /transaction-lab/draft`:
     - Assert `files.length <= 15`.
     - Assert every `f.content.length <= 200_000` bytes.
     - If exceeded $\rightarrow$ return `HTTP 400 Bad Request`.
  3. Resolve `userId = getAuthUserId(req)`. Assert `userId !== 'default_user'`.
- **Post-Conditions {Q}**:
  - Record written to or deleted from `coding_submissions` strictly under active `userId`. Zero unauthenticated draft mutations.

### 6.2. Vector Memory Tenancy Isolation
- **Pre-Conditions {P}**:
  - AI tutor or tool dispatcher triggers `handleSubmitInterviewEvaluation` or `handleMarkBugSolved`.
- **Algorithm C**:
  1. Extract `userId = session.userId`. If missing, fallback to explicit session-bound ID, never hardcoded `'default_user'`.
  2. Invoke `applyKnowledgeDecay({ userId, topic: session.topic })`.
  3. Invoke `recordNewErrorGap({ userId, topic: session.topic, ... })`.
- **Post-Conditions {Q}**:
  - `candidate_error_vectors` and `fsrs_card_states` updated with `user_id = session.userId`. Zero cross-tenant contamination.

### 6.3. XML Path Injection Defense
- **Pre-Conditions {P}**:
  - `ChallengeEvaluationPipeline` Gate 4 prepares prompt XML in `codeEvaluator.ts`.
- **Algorithm C**:
  1. Sanitize file path attributes using XML attribute escaping: `& -> &amp;`, `" -> &quot;`, `' -> &apos;`, `< -> &lt;`, `> -> &gt;`.
  2. Emit `<file path="${escapedPath}">` with bounded path length $\le 256$ chars.
- **Post-Conditions {Q}**:
  - Prompt XML structure cannot be broken or manipulated by malicious submitted filenames.
