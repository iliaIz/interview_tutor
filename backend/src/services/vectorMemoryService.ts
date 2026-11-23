/**
 * vectorMemoryService.ts
 * Thin Facade Adapter delegating to CandidateMemoryAggregate and VectorEmbeddingRepository.
 * Preserves 100% backwards compatibility for existing callers & routes.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import {
  cosineSimilarity,
  embedText,
  getOrCacheQuestionEmbedding
} from './memory/VectorEmbeddingRepository';
import {
  CandidateMemoryAggregate,
  CandidateGap,
  UserProfileData
} from './memory/CandidateMemoryAggregate';

export interface KnowledgeDecayParams {
  gapId?: string;
  questionId?: string;
  topic: string;
  errorConcept?: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  score?: number;
  feedback?: string;
}

export interface KnowledgeDecayEventParams {
  userId?: string;
  questionId?: string;
  topic: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  resolvedGapIds?: string[];
}

export {
  CandidateGap,
  UserProfileData,
  cosineSimilarity,
  embedText,
  getOrCacheQuestionEmbedding
};

const aggregate = CandidateMemoryAggregate.getInstance();

export async function findRelevantCandidateGaps(
  userId: string = 'default_user',
  currentTopic: string = '',
  limit: number = 3
): Promise<CandidateGap[]> {
  return aggregate.findRelevantCandidateGaps(userId, currentTopic, limit);
}

export async function applyKnowledgeDecay(params: KnowledgeDecayEventParams) {
  return aggregate.applyKnowledgeDecay(params);
}

export async function recordNewErrorGap(params: {
  questionId?: string;
  topic: string;
  subtopic?: string;
  errorConcept: string;
  initialDeficit?: number;
  userId?: string;
}): Promise<string> {
  return aggregate.recordNewErrorGap(params);
}

export function getKnowledgeRadarData(userId: string = 'default_user') {
  return aggregate.getKnowledgeRadarData(userId);
}

export function resetGapForPractice(gapId: string, userId: string = 'default_user'): boolean {
  return aggregate.resetGapForPractice(gapId, userId);
}

export function getUserProfile(userId: string = 'default_user'): UserProfileData {
  return aggregate.getUserProfile(userId);
}

export function updateUserProfile(profile: Partial<UserProfileData>): UserProfileData;
export function updateUserProfile(userId: string, profile: Partial<UserProfileData>): UserProfileData;
export function updateUserProfile(
  userIdOrProfile: string | Partial<UserProfileData>,
  maybeProfile?: Partial<UserProfileData>
): UserProfileData {
  return aggregate.updateUserProfile(userIdOrProfile, maybeProfile);
}
