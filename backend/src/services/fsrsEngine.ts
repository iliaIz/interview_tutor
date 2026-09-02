import { db } from './db';
import { cosineSimilarity } from './vectorMemoryService';

export enum FsrsRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4
}

export enum FsrsState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

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
  dueAt: string;
  isOverdue: boolean;
}

export interface FsrsStatsData {
  freshCount: number;       // R >= 0.90
  riskCount: number;        // 0.70 <= R < 0.90
  criticalCount: number;    // R < 0.70 / Overdue
  totalTracked: number;
  averageRetention: number;
  retentionForecast: {
    day: number;
    avgRetention: number;
    dueCount: number;
  }[];
}

/**
 * Standard FSRS-5 19-parameter weight vector (SOTA 2026 default)
 */
export const FSRS_5_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621
];

export const DECAY_FACTOR = 0.19;
export const REQUEST_RETENTION = 0.90;

/**
 * Retrievability formula R(t, S)
 * Probability of recalling the card after t days given stability S
 */
export function calculateRetrievability(elapsedDays: number, stability: number): number {
  const s = Math.max(0.1, stability);
  const t = Math.max(0, elapsedDays);
  const r = Math.pow(1 + DECAY_FACTOR * (t / s), -0.5);
  return Math.max(0.01, Math.min(1.0, parseFloat(r.toFixed(4))));
}

/**
 * Calculates optimal interval (in days) to achieve target retention
 */
export function nextInterval(stability: number, targetRetention: number = REQUEST_RETENTION): number {
  const s = Math.max(0.1, stability);
  const factor = (Math.pow(targetRetention, -1 / 0.5) - 1) / DECAY_FACTOR;
  const days = Math.round(s * factor);
  return Math.max(1, days);
}

/**
 * Maps performance score (0-100) and test status into FSRS rating (1..4)
 */
export function mapScoreToRating(score: number, isPassed?: boolean): FsrsRating {
  if (score >= 90) return FsrsRating.Easy;
  if (score >= 75 || (isPassed && score >= 65)) return FsrsRating.Good;
  if (score >= 50 || isPassed) return FsrsRating.Hard;
  return FsrsRating.Again;
}

/**
 * Initial difficulty D_0(g) for first review
 */
function initDifficulty(rating: FsrsRating): number {
  const w = FSRS_5_WEIGHTS;
  const d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return Math.max(1.0, Math.min(10.0, parseFloat(d.toFixed(2))));
}

/**
 * Next difficulty D' with mean reversion
 */
function nextDifficulty(d: number, rating: FsrsRating): number {
  const w = FSRS_5_WEIGHTS;
  const delta = -w[6] * (rating - 3);
  const dPrime = w[7] * initDifficulty(FsrsRating.Good) + (1 - w[7]) * (d + delta);
  return Math.max(1.0, Math.min(10.0, parseFloat(dPrime.toFixed(2))));
}

/**
 * FSRS-5 state transition: computes new Stability, Difficulty, State, and due_at
 */
export function calculateNextState(
  card: {
    stability: number;
    difficulty: number;
    elapsedDays: number;
    reps: number;
    lapses: number;
    state: FsrsState;
    lastReviewAt: string | null;
  },
  rating: FsrsRating,
  reviewTime: Date = new Date()
): {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  lastReviewAt: string;
  dueAt: string;
} {
  const w = FSRS_5_WEIGHTS;
  let newStability: number;
  let newDifficulty: number;
  let newState: FsrsState;
  let newLapses = card.lapses;
  let newReps = card.reps + 1;

  if (card.state === FsrsState.New || card.reps === 0) {
    // Initial Review
    newStability = w[rating - 1];
    newDifficulty = initDifficulty(rating);
    if (rating === FsrsRating.Again) {
      newState = FsrsState.Learning;
      newLapses += 1;
    } else {
      newState = FsrsState.Review;
    }
  } else {
    // Repeated Review
    const r = calculateRetrievability(card.elapsedDays, card.stability);
    newDifficulty = nextDifficulty(card.difficulty, rating);

    if (rating === FsrsRating.Again) {
      // Forgetting / Lapse
      newLapses += 1;
      newState = FsrsState.Relearning;
      const sForget = w[11] *
        Math.pow(newDifficulty, -w[12]) *
        (Math.pow(card.stability + 1, w[13]) - 1) *
        Math.exp(w[14] * (1 - r));
      newStability = Math.min(card.stability, Math.max(0.1, sForget));
    } else {
      // Successful Recall
      newState = FsrsState.Review;
      const hardPenalty = rating === FsrsRating.Hard ? w[15] : 1.0;
      const easyBonus = rating === FsrsRating.Easy ? w[16] : 1.0;
      const sRecall = card.stability * (
        1 +
        Math.exp(w[8]) *
        (11 - newDifficulty) *
        Math.pow(card.stability, -w[9]) *
        (Math.exp(w[10] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus
      );
      newStability = Math.max(0.2, sRecall);
    }
  }

  newStability = parseFloat(newStability.toFixed(2));
  newDifficulty = parseFloat(newDifficulty.toFixed(2));

  const scheduledDays = rating === FsrsRating.Again ? 1 : nextInterval(newStability, REQUEST_RETENTION);
  const dueTime = new Date(reviewTime.getTime() + scheduledDays * 24 * 60 * 60 * 1000);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays: 0,
    scheduledDays,
    reps: newReps,
    lapses: newLapses,
    state: newState,
    lastReviewAt: reviewTime.toISOString(),
    dueAt: dueTime.toISOString()
  };
}

/**
 * Propagates deficit to semantically related questions via cosine similarity of embeddings.
 * When a candidate lapses (Again/Hard), related concepts have their review schedule tightened by 30%.
 */
export async function propagateDeficitCluster(questionId: string, userId: string = 'default_user'): Promise<number> {
  try {
    const sourceRow = db.prepare('SELECT embedding, topic FROM question_embeddings WHERE question_id = ?').get(questionId) as any;
    if (!sourceRow?.embedding) return 0;

    const sourceBuf = sourceRow.embedding as Buffer;
    const sourceVec = new Float32Array(sourceBuf.buffer.slice(sourceBuf.byteOffset, sourceBuf.byteOffset + sourceBuf.byteLength));

    const otherRows = db.prepare('SELECT question_id, embedding FROM question_embeddings WHERE question_id != ?').all(questionId) as any[];
    let propagatedCount = 0;

    const updateStmt = db.prepare(`
      UPDATE fsrs_card_states
      SET scheduled_days = MAX(1, CAST(scheduled_days * 0.7 AS INTEGER)),
          due_at = DATETIME('now', '+' || MAX(1, CAST(scheduled_days * 0.7 AS INTEGER)) || ' days'),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND question_id = ? AND due_at > CURRENT_TIMESTAMP
    `);

    for (const r of otherRows) {
      if (!r.embedding) continue;
      const b = r.embedding as Buffer;
      const vec = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
      const sim = cosineSimilarity(sourceVec, vec);

      // Semantic proximity threshold: 0.78
      if (sim >= 0.78) {
        const changes = updateStmt.run(userId, r.question_id).changes;
        if (changes > 0) propagatedCount++;
      }
    }

    return propagatedCount;
  } catch (err) {
    console.warn('Deficit propagation warning:', err);
    return 0;
  }
}

/**
 * Updates or creates FSRS card state after an answer evaluation
 */
export async function updateFsrsCardState(params: {
  userId?: string;
  questionId: string;
  score: number;
  isPassed?: boolean;
}): Promise<{ card: FsrsCardRecord; propagatedCount: number }> {
  const { userId = 'default_user', questionId, score, isPassed } = params;
  const rating = mapScoreToRating(score, isPassed);
  const now = new Date();

  // 1. Fetch current card or init default
  const existing = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?').get(userId, questionId) as FsrsCardRecord | undefined;

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

  // 2. Run FSRS-5 algorithm
  const next = calculateNextState(baseCard, rating, now);

  // 3. Persist to SQLite
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
    questionId,
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

  // 4. Propagate deficit if failed / struggled
  let propagatedCount = 0;
  if (rating === FsrsRating.Again || rating === FsrsRating.Hard) {
    propagatedCount = await propagateDeficitCluster(questionId, userId);
  }

  const updatedCard = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?').get(userId, questionId) as FsrsCardRecord;

  return {
    card: updatedCard,
    propagatedCount
  };
}

/**
 * Returns prioritized queue of questions due today or with R < 0.80
 */
export function getFsrsQueue(userId: string = 'default_user', limit: number = 10): FsrsQueueItem[] {
  const rows = db.prepare(`
    SELECT 
      f.question_id,
      f.stability,
      f.difficulty,
      f.elapsed_days,
      f.reps,
      f.lapses,
      f.last_review_at,
      f.due_at,
      q.topic,
      q.question,
      q.answer
    FROM fsrs_card_states f
    JOIN questions q ON f.question_id = q.id
    WHERE f.user_id = ?
  `).all(userId) as any[];

  const now = Date.now();
  const queueItems: FsrsQueueItem[] = [];

  for (const row of rows) {
    let elapsedDays = 0;
    if (row.last_review_at) {
      elapsedDays = Math.max(0, (now - new Date(row.last_review_at).getTime()) / (1000 * 60 * 60 * 24));
    }
    const r = calculateRetrievability(elapsedDays, row.stability);
    const dueTime = new Date(row.due_at).getTime();
    const isOverdue = dueTime <= now;

    // Due for review if past due_at or retrievability dropped below 80%
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
        dueAt: row.due_at,
        isOverdue
      });
    }
  }

  // Sort by lowest retrievability first (most urgent deficits first)
  queueItems.sort((a, b) => a.retrievability - b.retrievability);
  return queueItems.slice(0, limit);
}

/**
 * Returns full memory retention statistics and 30-day Ebbinghaus forecast curve
 */
export function getFsrsStats(userId: string = 'default_user'): FsrsStatsData {
  const rows = db.prepare(`
    SELECT stability, last_review_at, due_at
    FROM fsrs_card_states
    WHERE user_id = ?
  `).all(userId) as any[];

  const now = Date.now();
  let freshCount = 0;
  let riskCount = 0;
  let criticalCount = 0;
  let totalRetentionSum = 0;

  const currentCards: { stability: number; elapsedDays: number }[] = [];

  for (const r of rows) {
    let elapsedDays = 0;
    if (r.last_review_at) {
      elapsedDays = Math.max(0, (now - new Date(r.last_review_at).getTime()) / (1000 * 60 * 60 * 24));
    }
    const ret = calculateRetrievability(elapsedDays, r.stability);
    totalRetentionSum += ret;

    currentCards.push({ stability: r.stability, elapsedDays });

    if (ret >= 0.90) {
      freshCount++;
    } else if (ret >= 0.70) {
      riskCount++;
    } else {
      criticalCount++;
    }
  }

  const totalTracked = rows.length;
  const averageRetention = totalTracked > 0 ? parseFloat((totalRetentionSum / totalTracked).toFixed(2)) : 1.0;

  // Forecast across intervals [0, 1, 3, 7, 14, 21, 30] days
  const forecastDays = [0, 1, 3, 7, 14, 21, 30];
  const retentionForecast = forecastDays.map((extraDay) => {
    if (totalTracked === 0) {
      return { day: extraDay, avgRetention: 1.0, dueCount: 0 };
    }
    let sumR = 0;
    let due = 0;
    for (const c of currentCards) {
      const futureR = calculateRetrievability(c.elapsedDays + extraDay, c.stability);
      sumR += futureR;
      if (futureR < 0.80) due++;
    }
    return {
      day: extraDay,
      avgRetention: parseFloat((sumR / totalTracked).toFixed(2)),
      dueCount: due
    };
  });

  return {
    freshCount,
    riskCount,
    criticalCount,
    totalTracked,
    averageRetention,
    retentionForecast
  };
}
