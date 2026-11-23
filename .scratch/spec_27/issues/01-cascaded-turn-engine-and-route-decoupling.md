# 01: [Tracer-Bullet] CascadedTurnEngine and Route Decoupling

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Extract the 562-line procedural Express route in `backend/src/routes/interviewTurn.ts` into a deep domain module `CascadedTurnEngine` and `GreetingSynthesisService`.
The engine:
1. Encapsulates Deepgram STT, Persona prompt directives, anti-sycophancy, and Epistemic Triage.
2. Replaces raw un-sandboxed `fetchWithFullJitterRetry` calls with `LlmExecutionEngine.executeJson`, inheriting Docker network failovers and 503 recovery cards.
3. Coordinates deficit decay via `CandidateMemoryAggregate` and progress recording via `progressService`.
4. Synthesizes spoken audio clamped to safe word counts (&le;40 words).
5. Reduces `interviewTurn.ts` from 562 lines to &le; 60 lines.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/interview/CascadedTurnEngine.ts` and `backend/src/routes/interviewTurn.ts`.
- **Dependencies**: In-memory / LiteLLM Proxy / SQLite.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Contract Fragment**:
```typescript
export interface TurnExecutionInput {
  sessionId?: string;
  questionId?: string;
  topic: string;
  questionText: string;
  referenceAnswer?: string;
  userTranscript?: string;
  audioBuffer?: Buffer;
  audioMimeType?: string;
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  strategy?: 'socratic_tutoring' | 'adaptive_probing';
  userId?: string;
}
```
- **Invariants**: All modified files &le; 400 lines, all new files &le; 350 lines.

## Explicit Non-Goals
- Do not change HTTP route URLs (`POST /api/interview/greeting`, `POST /api/interview/turn`).
- Do not alter evaluation scoring rubric formulas.

## Acceptance Criteria
- [ ] `CascadedTurnEngine` created with &le; 350 lines.
- [ ] `interviewTurn.ts` reduced to &le; 80 lines.
- [ ] All LLM calls route through `LlmExecutionEngine.executeJson`.
- [ ] Progress and deficit updates delegate to `CandidateMemoryAggregate`.
