/**
 * fsrsEngine.ts
 * Thin Facade Adapter delegating to CandidateMemoryAggregate, FsrsAlgorithm,
 * and VectorEmbeddingRepository.
 * Preserves 100% backwards compatibility for existing callers & test suites.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import {
  FsrsRating,
  FsrsState,
  FSRS_5_WEIGHTS,
  DECAY_FACTOR,
  REQUEST_RETENTION,
  calculateRetrievability,
  nextInterval,
  mapScoreToRating,
  calculateNextState,
  calculateRbfKernel
} from './memory/FsrsAlgorithm';
import {
  getCachedQuestionEmbeddings,
  invalidateQuestionEmbeddingCache
} from './memory/VectorEmbeddingRepository';
import {
  CandidateMemoryAggregate,
  FsrsCardRecord,
  NeighborPropagationResult,
  FsrsQueueItem,
  FsrsStatsData
} from './memory/CandidateMemoryAggregate';

export {
  FsrsRating,
  FsrsState,
  FsrsCardRecord,
  NeighborPropagationResult,
  FsrsQueueItem,
  FsrsStatsData,
  FSRS_5_WEIGHTS,
  DECAY_FACTOR,
  REQUEST_RETENTION,
  calculateRetrievability,
  nextInterval,
  mapScoreToRating,
  calculateNextState,
  calculateRbfKernel,
  getCachedQuestionEmbeddings,
  invalidateQuestionEmbeddingCache
};

const aggregate = CandidateMemoryAggregate.getInstance();

export async function propagateDeficitCluster(
  questionId: string,
  userId: string = 'default_user',
  now: Date = new Date()
) {
  return aggregate.propagateDeficitCluster(questionId, userId, now);
}

export async function updateFsrsCardState(params: {
  userId?: string;
  questionId: string;
  score: number;
  isPassed?: boolean;
}) {
  return aggregate.updateFsrsCardState(params);
}

export function getFsrsQueue(userId: string = 'default_user', limit: number = 10): FsrsQueueItem[] {
  return aggregate.getFsrsQueue(userId, limit);
}

export function getFsrsStats(userId: string = 'default_user'): FsrsStatsData {
  return aggregate.getFsrsStats(userId);
}
