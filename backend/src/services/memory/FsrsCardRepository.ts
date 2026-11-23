/**
 * FsrsCardRepository.ts
 * Manages SQLite persistence for FSRS card states and review audit logs.
 * Encapsulates table operations on fsrs_card_states and fsrs_review_logs.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import crypto from 'crypto';
import { db } from '../db';
import {
  FsrsRating,
  FsrsState,
  calculateRetrievability,
  mapScoreToRating,
  calculateNextState,
  calculateRbfKernel,
  FSRS_5_WEIGHTS,
  REQUEST_RETENTION
} from './FsrsAlgorithm';
import {
  cosineSimilarity,
  getCachedQuestionEmbeddings
} from './VectorEmbeddingRepository';

export interface FsrsCardRecord {
  user_id: string;
  question_id: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review_at: string | null;
  due_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface NeighborPropagationResult {
  neighborQuestionId: string;
  oldStability: number;
  newStability: number;
  oldDifficulty: number;
  newDifficulty: number;
  distance: number;
  newDueAt: string;
  immediatelyDue: boolean;
}

export interface FsrsQueueItem {
  questionId: string;
  topic: string;
  question: string;
  answer: string;
  retrievability: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  dueAt: string;
  isOverdue: boolean;
}

export interface FsrsStatsData {
  freshCount: number;
  riskCount: number;
  criticalCount: number;
  totalTracked: number;
  averageRetention: number;
  retentionForecast: { day: number; avgRetention: number; dueCount: number }[];
}

export class FsrsCardRepository {
  private static instance: FsrsCardRepository | null = null;

  public static getInstance(): FsrsCardRepository {
    if (!this.instance) {
      this.instance = new FsrsCardRepository();
    }
    return this.instance;
  }

  public async updateFsrsCardState(params: {
    userId?: string;
    questionId: string;
    score: number;
    isPassed?: boolean;
  }): Promise<{ card: FsrsCardRecord; propagatedCount: number; propagatedNeighbors: NeighborPropagationResult[] }> {
    const userId = params.userId || 'default_user';
    const rating = mapScoreToRating(params.score, params.isPassed);
    const now = new Date();

    const existing = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?').get(userId, params.questionId) as FsrsCardRecord | undefined;

    let elapsedDays = 0;
    if (existing?.last_review_at) {
      const last = new Date(existing.last_review_at).getTime();
      elapsedDays = Math.max(0, (now.getTime() - last) / (1000 * 60 * 60 * 24));
    }

    const baseCard = {
      stability: existing ? existing.stability : 1.0,
      difficulty: existing ? existing.difficulty : 5.0,
      elapsedDays,
      reps: existing ? existing.reps : 0,
      lapses: existing ? existing.lapses : 0,
      state: existing ? existing.state : FsrsState.New,
      lastReviewAt: existing ? existing.last_review_at : null
    };

    const next = calculateNextState(baseCard, rating, now);

    db.prepare(`
      INSERT INTO fsrs_card_states (
        user_id, question_id, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review_at, due_at, updated_at
      ) VALUES (
        @userId, @questionId, @stability, @difficulty, @elapsedDays, @scheduledDays, @reps, @lapses, @state, @lastReviewAt, @dueAt, CURRENT_TIMESTAMP
      )
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        stability = @stability,
        difficulty = @difficulty,
        elapsed_days = @elapsedDays,
        scheduled_days = @scheduledDays,
        reps = @reps,
        lapses = @lapses,
        state = @state,
        last_review_at = @lastReviewAt,
        due_at = @dueAt,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      userId,
      questionId: params.questionId,
      stability: next.stability,
      difficulty: next.difficulty,
      elapsedDays: next.elapsedDays,
      scheduledDays: next.scheduledDays,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      lastReviewAt: next.lastReviewAt,
      dueAt: next.dueAt
    });

    try {
      db.prepare(`
        INSERT INTO fsrs_review_logs (
          log_id, question_id, user_id, rating, state, due_at, stability, difficulty, review_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(crypto.randomUUID(), params.questionId, userId, rating, next.state, next.dueAt, next.stability, next.difficulty, now.toISOString());
    } catch (_) {}

    let propagatedCount = 0;
    let propagatedNeighbors: NeighborPropagationResult[] = [];
    if (rating === FsrsRating.Again || rating === FsrsRating.Hard) {
      const prop = await this.propagateDeficitCluster(params.questionId, userId, now);
      propagatedCount = prop.count;
      propagatedNeighbors = prop.neighbors;
    }

    const updatedCard = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?').get(userId, params.questionId) as FsrsCardRecord;
    return { card: updatedCard, propagatedCount, propagatedNeighbors };
  }

  public async propagateDeficitCluster(
    questionId: string,
    userId: string = 'default_user',
    now: Date = new Date()
  ): Promise<{ count: number; neighbors: NeighborPropagationResult[] }> {
    try {
      const allEmbeddings = getCachedQuestionEmbeddings();
      const source = allEmbeddings.find(e => e.questionId === questionId);
      if (!source) return { count: 0, neighbors: [] };

      const matched: Array<{ questionId: string; dist: number; kernelWeight: number }> = [];
      for (const item of allEmbeddings) {
        if (item.questionId === questionId) continue;
        const sim = cosineSimilarity(source.vec, item.vec);
        const dist = Math.max(0, 1.0 - sim);
        if (dist <= 0.25) {
          const kernelWeight = calculateRbfKernel(dist, 0.125);
          if (kernelWeight > 0) matched.push({ questionId: item.questionId, dist, kernelWeight });
        }
      }
      if (matched.length === 0) return { count: 0, neighbors: [] };

      const neighbors: NeighborPropagationResult[] = [];
      const fetchStmt = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?');
      const updateStmt = db.prepare(`
        INSERT INTO fsrs_card_states (
          user_id, question_id, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review_at, due_at, updated_at
        ) VALUES (@userId, @questionId, @stability, @difficulty, 0, @scheduledDays, 0, 0, 0, null, @dueAt, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
          stability = @stability, difficulty = @difficulty, scheduled_days = @scheduledDays, due_at = @dueAt, updated_at = CURRENT_TIMESTAMP
      `);

      const w0 = FSRS_5_WEIGHTS[0];
      const nowMs = now.getTime();

      const tx = db.transaction(() => {
        for (const candidate of matched) {
          const card = fetchStmt.get(userId, candidate.questionId) as any;
          const oldS = card ? card.stability : 1.0;
          const oldD = card ? card.difficulty : 5.0;
          const newD = Math.min(10.0, oldD + 0.20 * candidate.kernelWeight * (10.0 - oldD));
          const newS = Math.max(w0, oldS * (1.0 - 0.35 * candidate.kernelWeight));
          const intervalDays = (81 * newS / 19) * (Math.pow(REQUEST_RETENTION, -2) - 1);
          const lastRevMs = card?.last_review_at ? new Date(card.last_review_at).getTime() : nowMs;
          const newDueMs = Math.round(lastRevMs + intervalDays * 86400 * 1000);
          const newDueDate = new Date(newDueMs).toISOString();

          updateStmt.run({
            userId,
            questionId: candidate.questionId,
            stability: parseFloat(newS.toFixed(2)),
            difficulty: parseFloat(newD.toFixed(2)),
            scheduledDays: Math.max(1, Math.round(intervalDays)),
            dueAt: newDueDate
          });

          neighbors.push({
            neighborQuestionId: candidate.questionId,
            oldStability: parseFloat(oldS.toFixed(2)),
            newStability: parseFloat(newS.toFixed(2)),
            oldDifficulty: parseFloat(oldD.toFixed(2)),
            newDifficulty: parseFloat(newD.toFixed(2)),
            distance: parseFloat(candidate.dist.toFixed(4)),
            newDueAt: newDueDate,
            immediatelyDue: newDueMs <= nowMs
          });
        }
      });
      tx();
      return { count: neighbors.length, neighbors };
    } catch (_) {
      return { count: 0, neighbors: [] };
    }
  }

  public getFsrsQueue(userId: string = 'default_user', limit: number = 10): FsrsQueueItem[] {
    const rows = db.prepare(`
      SELECT f.question_id, f.stability, f.difficulty, f.elapsed_days, f.reps, f.lapses, f.state, f.last_review_at, f.due_at, q.topic, q.question, q.answer
      FROM fsrs_card_states f
      JOIN questions q ON f.question_id = q.id
      WHERE f.user_id = ?
      ORDER BY f.state DESC, f.due_at ASC
    `).all(userId) as any[];

    const now = Date.now();
    const queueItems: FsrsQueueItem[] = [];

    for (const row of rows) {
      let elapsedDays = 0;
      if (row.last_review_at) {
        elapsedDays = Math.max(0, (now - new Date(row.last_review_at).getTime()) / (1000 * 60 * 60 * 24));
      }
      const r = calculateRetrievability(elapsedDays, row.stability);
      const isOverdue = new Date(row.due_at).getTime() <= now;

      if (isOverdue || r < 0.80) {
        queueItems.push({
          questionId: row.question_id,
          topic: row.topic,
          question: row.question,
          answer: row.answer,
          retrievability: r,
          stability: row.stability,
          difficulty: row.difficulty,
          reps: row.reps,
          lapses: row.lapses,
          state: row.state,
          dueAt: row.due_at,
          isOverdue
        });
      }
    }

    queueItems.sort((a, b) => {
      const aUrgent = a.state === FsrsState.Relearning || a.state === FsrsState.Learning ? 1 : 0;
      const bUrgent = b.state === FsrsState.Relearning || b.state === FsrsState.Learning ? 1 : 0;
      return aUrgent !== bUrgent ? bUrgent - aUrgent : a.retrievability - b.retrievability;
    });

    return queueItems.slice(0, limit);
  }

  public getFsrsStats(userId: string = 'default_user'): FsrsStatsData {
    const rows = db.prepare('SELECT stability, last_review_at FROM fsrs_card_states WHERE user_id = ?').all(userId) as any[];
    const now = Date.now();
    let fresh = 0, risk = 0, critical = 0, sumR = 0;
    const cards: { stability: number; elapsed: number }[] = [];

    for (const r of rows) {
      const elapsed = r.last_review_at ? Math.max(0, (now - new Date(r.last_review_at).getTime()) / (86400000)) : 0;
      const ret = calculateRetrievability(elapsed, r.stability);
      sumR += ret;
      cards.push({ stability: r.stability, elapsed });
      if (ret >= 0.90) fresh++;
      else if (ret >= 0.70) risk++;
      else critical++;
    }

    const total = rows.length;
    const avg = total > 0 ? parseFloat((sumR / total).toFixed(2)) : 1.0;
    const forecast = [0, 1, 3, 7, 14, 21, 30].map(day => {
      if (total === 0) return { day, avgRetention: 1.0, dueCount: 0 };
      let fSum = 0, due = 0;
      for (const c of cards) {
        const futR = calculateRetrievability(c.elapsed + day, c.stability);
        fSum += futR;
        if (futR < 0.80) due++;
      }
      return { day, avgRetention: parseFloat((fSum / total).toFixed(2)), dueCount: due };
    });

    return { freshCount: fresh, riskCount: risk, criticalCount: critical, totalTracked: total, averageRetention: avg, retentionForecast: forecast };
  }
}
