# 01: [Prefactor] Pure FsrsAlgorithm and CandidateMemoryAggregate

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** closed - verified in production (commit b6f818d)

## Verification
- Verified by: GitHub Actions Run 45089445074 & 45090110754
- `FsrsAlgorithm.ts`: Pure math (208 lines)
- `FsrsCardRepository.ts`: Encapsulated SQLite tables (320 lines)
- `CandidateDeficitMemoryRepository.ts`: Encapsulated deficit decay (232 lines)
- `CandidateMemoryAggregate.ts`: Deep domain seam (144 lines)
- `fsrsEngine.ts` and `vectorMemoryService.ts`: Thin facades <= 91 lines.

## What to Build
Extract pure mathematical FSRS algorithms from `fsrsEngine.ts` into a stateless, zero-dependency `FsrsAlgorithm` class. Create `VectorEmbeddingRepository` to encapsulate embedding caching and queries. Encapsulate SQLite storage operations (`fsrs_card_states`, `candidate_error_vectors`, `question_embeddings`) behind a cohesive `CandidateMemoryAggregate`. Provide a high-leverage `recordReview(event)` method so callers no longer need to coordinate 3 separate procedural steps. Convert `fsrsEngine.ts` and `vectorMemoryService.ts` into thin delegating facades (&le; 100 lines each) to ensure zero regression for existing callers.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/memory/CandidateMemoryAggregate.ts` and `backend/src/services/memory/FsrsAlgorithm.ts`.
- **Dependencies**: In-memory / file SQLite. Zero network mocks for math tests.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
```typescript
export interface ReviewEvent {
  userId: string;
  questionId: string;
  topic: string;
  score: number;
  isPassed?: boolean;
  missingPoints?: string[];
  feedback?: string;
  elapsedSeconds?: number;
}

export interface CandidateMemoryAggregate {
  recordReview(event: ReviewEvent): Promise<{
    nextIntervalDays: number;
    retrievability: number;
    propagatedNeighborsCount: number;
  }>;
  getStudyQueue(userId?: string, limit?: number): Promise<FsrsQueueItem[]>;
  getKnowledgeRadar(userId?: string): Promise<KnowledgeRadarSnapshot>;
  findDeficitGaps(userId: string, topic: string, limit?: number): Promise<CandidateGap[]>;
}
```

## Explicit Non-Goals
- Modifying SQLite table schema or column definitions.
- Modifying client-facing `/api/memory/*` route payloads.

## Acceptance Criteria
- [ ] `FsrsAlgorithm.ts` is pure math with 0 database imports and &le; 200 lines.
- [ ] `CandidateMemoryAggregate.ts` encapsulates SQLite queries and is &le; 350 lines.
- [ ] `fsrsEngine.ts` and `vectorMemoryService.ts` become thin facades &le; 150 lines.
- [ ] Existing callers (`routes/eval.ts`, `routes/memory.ts`) pass tests without regressions.
