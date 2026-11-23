/**
 * CandidateMemoryAggregate.ts
 * Deep Domain Aggregate unifying Spaced Repetition (FSRS-5) and Deficit Vector Memory.
 * High-leverage domain coordinator encapsulating card schedules and candidate error vectors.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import {
  FsrsCardRepository,
  FsrsCardRecord,
  NeighborPropagationResult,
  FsrsQueueItem,
  FsrsStatsData
} from './FsrsCardRepository';

import {
  CandidateDeficitMemoryRepository,
  CandidateGap,
  KnowledgeRadarSnapshot,
  UserProfileData
} from './CandidateDeficitMemoryRepository';

export type {
  FsrsCardRecord,
  NeighborPropagationResult,
  FsrsQueueItem,
  FsrsStatsData,
  CandidateGap,
  KnowledgeRadarSnapshot,
  UserProfileData
};

export interface ReviewEvent {
  userId?: string;
  questionId: string;
  topic: string;
  score: number;
  isPassed?: boolean;
  missingPoints?: string[];
  feedback?: string;
}

export class CandidateMemoryAggregate {
  private static instance: CandidateMemoryAggregate | null = null;
  private readonly cardRepo = FsrsCardRepository.getInstance();
  private readonly deficitRepo = CandidateDeficitMemoryRepository.getInstance();

  public static getInstance(): CandidateMemoryAggregate {
    if (!this.instance) {
      this.instance = new CandidateMemoryAggregate();
    }
    return this.instance;
  }

  /**
   * Unified high-leverage review entry point: records review, updates FSRS intervals,
   * decays error gaps, and triggers neighbor deficit propagation if needed.
   */
  public async recordReview(event: ReviewEvent): Promise<{
    card: FsrsCardRecord;
    propagatedCount: number;
    propagatedNeighbors: NeighborPropagationResult[];
  }> {
    const userId = event.userId || 'default_user';
    const result = await this.cardRepo.updateFsrsCardState({
      userId,
      questionId: event.questionId,
      score: event.score,
      isPassed: event.isPassed
    });

    const assistanceLevel = event.isPassed && event.score >= 75 ? 'solo' : event.score >= 50 ? 'guided' : 'relapse';
    await this.deficitRepo.applyKnowledgeDecay({
      userId,
      questionId: event.questionId,
      topic: event.topic,
      assistanceLevel
    });

    if (event.missingPoints && event.missingPoints.length > 0 && event.score < 75) {
      for (const gapText of event.missingPoints.slice(0, 3)) {
        await this.deficitRepo.recordNewErrorGap({
          userId,
          questionId: event.questionId,
          topic: event.topic,
          errorConcept: gapText,
          initialDeficit: 1.0
        });
      }
    }

    return result;
  }

  public async updateFsrsCardState(params: Parameters<FsrsCardRepository['updateFsrsCardState']>[0]) {
    return this.cardRepo.updateFsrsCardState(params);
  }

  public async propagateDeficitCluster(questionId: string, userId: string = 'default_user', now: Date = new Date()) {
    return this.cardRepo.propagateDeficitCluster(questionId, userId, now);
  }

  public getFsrsQueue(userId: string = 'default_user', limit: number = 10): FsrsQueueItem[] {
    return this.cardRepo.getFsrsQueue(userId, limit);
  }

  public getFsrsStats(userId: string = 'default_user'): FsrsStatsData {
    return this.cardRepo.getFsrsStats(userId);
  }

  public async applyKnowledgeDecay(params: Parameters<CandidateDeficitMemoryRepository['applyKnowledgeDecay']>[0]) {
    return this.deficitRepo.applyKnowledgeDecay(params);
  }

  public async recordNewErrorGap(params: Parameters<CandidateDeficitMemoryRepository['recordNewErrorGap']>[0]) {
    return this.deficitRepo.recordNewErrorGap(params);
  }

  public getKnowledgeRadarData(userId: string = 'default_user'): KnowledgeRadarSnapshot {
    return this.deficitRepo.getKnowledgeRadarData(userId);
  }

  public resetGapForPractice(gapId: string, userId: string = 'default_user'): boolean {
    return this.deficitRepo.resetGapForPractice(gapId, userId);
  }

  public async findRelevantCandidateGaps(userId: string = 'default_user', currentTopic: string = '', limit = 3): Promise<CandidateGap[]> {
    return this.deficitRepo.findRelevantCandidateGaps(userId, currentTopic, limit);
  }

  public getUserProfile(userId: string = 'default_user'): UserProfileData {
    return this.deficitRepo.getUserProfile(userId);
  }

  public updateUserProfile(userIdOrProfile: string | Partial<UserProfileData>, maybeProfile?: Partial<UserProfileData>): UserProfileData {
    return this.deficitRepo.updateUserProfile(userIdOrProfile, maybeProfile);
  }
}
