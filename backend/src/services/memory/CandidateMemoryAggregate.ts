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
  assistanceLevelOverride?: 'solo' | 'guided' | 'assisted' | 'relapse';
  resolvedGapIds?: string[];
}

export class CandidateMemoryAggregate {
  private static instance: CandidateMemoryAggregate | null = null;
  private readonly cardRepo: FsrsCardRepository;
  private readonly deficitRepo: CandidateDeficitMemoryRepository;

  constructor(
    cardRepo: FsrsCardRepository = FsrsCardRepository.getInstance(),
    deficitRepo: CandidateDeficitMemoryRepository = CandidateDeficitMemoryRepository.getInstance()
  ) {
    this.cardRepo = cardRepo;
    this.deficitRepo = deficitRepo;
  }

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
    knowledgeUpdate: { updatedGaps: any[]; masteredCount: number };
  }> {
    const userId = event.userId?.trim() || 'default_user';
    const result = await this.cardRepo.updateFsrsCardState({
      userId,
      questionId: event.questionId,
      score: event.score,
      isPassed: event.isPassed
    });

    const isPassed = event.isPassed ?? event.score >= 70;
    const assistanceLevel = event.assistanceLevelOverride
      ?? (isPassed ? (event.score >= 85 ? 'solo' : 'guided') : 'relapse');
    const knowledgeUpdate = await this.deficitRepo.applyKnowledgeDecay({
      userId,
      questionId: event.questionId,
      topic: event.topic,
      assistanceLevel,
      resolvedGapIds: event.resolvedGapIds
    });

    if (!isPassed && event.missingPoints && event.missingPoints.length > 0) {
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

    return {
      ...result,
      knowledgeUpdate
    };
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

  public async findRelevantCandidateGaps(
    questionText: string,
    topic: string,
    questionId?: string,
    threshold = 0.70,
    userId = 'default_user'
  ): Promise<CandidateGap[]> {
    return this.deficitRepo.findRelevantCandidateGaps(questionText, topic, questionId, threshold, userId);
  }

  public getUserProfile(userId: string = 'default_user'): UserProfileData {
    return this.deficitRepo.getUserProfile(userId);
  }

  public updateUserProfile(userIdOrProfile: string | Partial<UserProfileData>, maybeProfile?: Partial<UserProfileData>): UserProfileData {
    return this.deficitRepo.updateUserProfile(userIdOrProfile, maybeProfile);
  }
}
