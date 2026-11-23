/**
 * CandidateDeficitMemoryRepository.ts
 * Manages candidate error vectors, deficit decay math, and user profile settings.
 * Encapsulates SQLite tables (candidate_error_vectors, user_profile_settings).
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import crypto from 'crypto';
import { db } from '../db';
import {
  embedText,
  float32ArrayToBuffer,
  bufferToFloat32Array,
  cosineSimilarity,
  getOrCacheQuestionEmbedding
} from './VectorEmbeddingRepository';

export interface CandidateGap {
  id: string;
  questionId?: string;
  topic: string;
  subtopic?: string;
  errorConcept: string;
  deficitWeight: number;
  status: 'ACTIVE_DEFICIT' | 'VERIFYING' | 'MASTERED';
  soloStreak: number;
  similarity?: number;
}

export interface KnowledgeRadarSnapshot {
  activeDeficits: CandidateGap[];
  verifyingGaps: CandidateGap[];
  masteredGaps: CandidateGap[];
  stats: { activeCount: number; verifyingCount: number; masteredCount: number; totalGaps: number };
}

export interface UserProfileData {
  id: string;
  candidateName: string;
  targetSeniority: 'junior' | 'middle' | 'senior' | 'lead';
  primaryStack: string;
  preferredTone: 'rigorous' | 'supportive' | 'academic';
  focusAreas: string[];
}

export class CandidateDeficitMemoryRepository {
  private static instance: CandidateDeficitMemoryRepository | null = null;

  public static getInstance(): CandidateDeficitMemoryRepository {
    if (!this.instance) {
      this.instance = new CandidateDeficitMemoryRepository();
    }
    return this.instance;
  }

  public async applyKnowledgeDecay(params: {
    userId?: string;
    questionId?: string;
    topic: string;
    assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
    resolvedGapIds?: string[];
  }): Promise<{ updatedGaps: any[]; masteredCount: number }> {
    const userId = params.userId || 'default_user';
    const delta = params.assistanceLevel === 'solo' ? -1.0 : params.assistanceLevel === 'guided' ? -0.5 : params.assistanceLevel === 'assisted' ? -0.25 : 0.8;
    const targetIds = [...(params.resolvedGapIds || [])];

    if (targetIds.length === 0 && params.questionId) {
      const matching = db.prepare(`SELECT id FROM candidate_error_vectors WHERE user_id = ? AND question_id = ? AND status IN ('ACTIVE_DEFICIT', 'VERIFYING')`).all(userId, params.questionId) as any[];
      matching.forEach(r => targetIds.push(r.id));
    }

    const results: any[] = [];
    let masteredCount = 0;

    for (const gapId of targetIds) {
      const row = db.prepare('SELECT * FROM candidate_error_vectors WHERE id = ? AND user_id = ?').get(gapId, userId) as any;
      if (!row) continue;

      let newWeight = Math.max(0.0, Math.min(1.0, parseFloat((row.deficit_weight + delta).toFixed(2))));
      let newStatus = row.status;
      let soloStreak = row.solo_streak;
      let assistedCount = row.assisted_count;

      if (params.assistanceLevel === 'solo') {
        soloStreak += 1;
        if (newWeight <= 0.1 || soloStreak >= 1) { newWeight = 0.0; newStatus = 'MASTERED'; masteredCount++; }
        else { newStatus = 'VERIFYING'; }
      } else if (params.assistanceLevel === 'guided') {
        if (newWeight <= 0.1) { newWeight = 0.0; newStatus = 'MASTERED'; masteredCount++; }
        else { newStatus = 'VERIFYING'; }
      } else if (params.assistanceLevel === 'assisted') {
        assistedCount += 1;
        newStatus = newWeight <= 0.4 ? 'VERIFYING' : 'ACTIVE_DEFICIT';
      } else {
        soloStreak = 0;
        newStatus = 'ACTIVE_DEFICIT';
      }

      db.prepare(`
        UPDATE candidate_error_vectors
        SET deficit_weight = ?, status = ?, solo_streak = ?, assisted_count = ?, last_tested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newWeight, newStatus, soloStreak, assistedCount, gapId);

      results.push({ id: gapId, oldWeight: row.deficit_weight, newWeight, newStatus, delta });
    }

    return { updatedGaps: results, masteredCount };
  }

  public async recordNewErrorGap(params: {
    questionId?: string;
    topic: string;
    subtopic?: string;
    errorConcept: string;
    initialDeficit?: number;
    userId?: string;
  }): Promise<string> {
    const userId = params.userId || 'default_user';
    const existing = db.prepare(`SELECT id FROM candidate_error_vectors WHERE user_id = ? AND topic = ? AND error_concept = ?`).get(userId, params.topic, params.errorConcept) as any;

    if (existing) {
      db.prepare(`UPDATE candidate_error_vectors SET deficit_weight = 1.0, status = 'ACTIVE_DEFICIT', solo_streak = 0, last_tested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(existing.id, userId);
      return existing.id;
    }

    const id = `gap_${crypto.randomBytes(12).toString('hex')}`;
    const embedding = await embedText(`${params.topic} ${params.subtopic || ''}: ${params.errorConcept}`);
    const blob = float32ArrayToBuffer(embedding);

    db.prepare(`
      INSERT INTO candidate_error_vectors (id, user_id, question_id, topic, subtopic, error_concept, embedding, deficit_weight, status, solo_streak, assisted_count, last_tested_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE_DEFICIT', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, userId, params.questionId || null, params.topic, params.subtopic || null, params.errorConcept, blob, params.initialDeficit ?? 1.0);

    return id;
  }

  public getKnowledgeRadarData(userId: string = 'default_user'): KnowledgeRadarSnapshot {
    const rows = db.prepare(`SELECT id, question_id, topic, subtopic, error_concept, deficit_weight, status, solo_streak FROM candidate_error_vectors WHERE user_id = ? ORDER BY updated_at DESC`).all(userId) as any[];
    const active: CandidateGap[] = [], verifying: CandidateGap[] = [], mastered: CandidateGap[] = [];

    for (const r of rows) {
      const g: CandidateGap = { id: r.id, questionId: r.question_id, topic: r.topic, subtopic: r.subtopic, errorConcept: r.error_concept, deficitWeight: r.deficit_weight, status: r.status, soloStreak: r.solo_streak };
      if (r.status === 'MASTERED') mastered.push(g);
      else if (r.status === 'VERIFYING') verifying.push(g);
      else active.push(g);
    }

    return { activeDeficits: active, verifyingGaps: verifying, masteredGaps: mastered, stats: { activeCount: active.length, verifyingCount: verifying.length, masteredCount: mastered.length, totalGaps: rows.length } };
  }

  public resetGapForPractice(gapId: string, userId: string = 'default_user'): boolean {
    const res = db.prepare(`UPDATE candidate_error_vectors SET deficit_weight = 1.0, status = 'ACTIVE_DEFICIT', solo_streak = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(gapId, userId);
    return res.changes > 0;
  }

  public async findRelevantCandidateGaps(
    questionText: string,
    topic: string,
    questionId?: string,
    threshold = 0.70,
    userId = 'default_user'
  ): Promise<CandidateGap[]> {
    try {
      const questionVec = questionId
        ? await getOrCacheQuestionEmbedding(questionId, questionText, topic)
        : await embedText(`${topic}: ${questionText}`);

      const rows = db.prepare(`
        SELECT id, question_id, topic, subtopic, error_concept, embedding, deficit_weight, status, solo_streak
        FROM candidate_error_vectors
        WHERE user_id = ? AND status IN ('ACTIVE_DEFICIT', 'VERIFYING')
        ORDER BY updated_at DESC
        LIMIT 100
      `).all(userId) as any[];

      if (!rows || rows.length === 0) return [];

      const matches: CandidateGap[] = [];
      for (const row of rows) {
        if (!row.embedding) continue;
        const gapVec = bufferToFloat32Array(row.embedding);
        const sim = cosineSimilarity(questionVec, gapVec);
        if (sim >= threshold) {
          matches.push({
            id: row.id,
            questionId: row.question_id,
            topic: row.topic,
            subtopic: row.subtopic,
            errorConcept: row.error_concept,
            deficitWeight: row.deficit_weight,
            status: row.status,
            soloStreak: row.solo_streak,
            similarity: sim
          });
        }
      }

      matches.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
      return matches.slice(0, 2);
    } catch (err) {
      console.error('Error finding relevant candidate gaps:', err);
      return [];
    }
  }

  public getUserProfile(userId: string = 'default_user'): UserProfileData {
    const row = db.prepare('SELECT * FROM user_profile_settings WHERE id = ?').get(userId) as any;
    if (!row) {
      return { id: userId, candidateName: 'Кандидат', targetSeniority: 'senior', primaryStack: 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka', preferredTone: 'rigorous', focusAreas: ['Spring Transactional', 'JMM & Concurrency', 'Kafka Partitions'] };
    }
    let focusAreas: string[] = [];
    try { if (row.focus_areas_json) focusAreas = JSON.parse(row.focus_areas_json); } catch {}
    return { id: row.id, candidateName: row.candidate_name || 'Кандидат', targetSeniority: row.target_seniority || 'senior', primaryStack: row.primary_stack || 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka', preferredTone: row.preferred_tone || 'rigorous', focusAreas };
  }

  public updateUserProfile(userIdOrProfile: string | Partial<UserProfileData>, maybeProfile?: Partial<UserProfileData>): UserProfileData {
    const userId = typeof userIdOrProfile === 'string' ? userIdOrProfile : 'default_user';
    const profile = typeof userIdOrProfile === 'string' ? (maybeProfile || {}) : userIdOrProfile;
    const current = this.getUserProfile(userId);
    const updated: UserProfileData = { ...current, ...profile, id: userId, focusAreas: profile.focusAreas || current.focusAreas };

    db.prepare(`
      INSERT INTO user_profile_settings (id, candidate_name, target_seniority, primary_stack, preferred_tone, focus_areas_json, updated_at)
      VALUES (@id, @candidateName, @targetSeniority, @primaryStack, @preferredTone, @focusAreasJson, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET candidate_name = excluded.candidate_name, target_seniority = excluded.target_seniority, primary_stack = excluded.primary_stack, preferred_tone = excluded.preferred_tone, focus_areas_json = excluded.focus_areas_json, updated_at = CURRENT_TIMESTAMP
    `).run({ id: updated.id, candidateName: updated.candidateName, targetSeniority: updated.targetSeniority, primaryStack: updated.primaryStack, preferredTone: updated.preferredTone, focusAreasJson: JSON.stringify(updated.focusAreas) });

    return updated;
  }
}
