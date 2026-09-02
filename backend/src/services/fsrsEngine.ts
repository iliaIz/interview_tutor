import crypto from 'crypto';
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

/**
 * Analytical factor for R(t=S) = 0.90:
 * (1 + factor)^(-0.5) = 0.90 <=> factor = 0.90^(-2) - 1 = 19 / 81 ~= 0.2345679
 */
export const DECAY_FACTOR = 19 / 81;
export const REQUEST_RETENTION = 0.90;

/**
 * Retrievability formula R(t, S)
 * Probability of recalling the card after t days given stability S
 * Invariant: R(S, S) strictly equals 0.9000
 */
export function calculateRetrievability(elapsedDays: number, stability: number): number {
  const s = Math.max(0.1, stability);
  const t = Math.max(0, elapsedDays);
  const r = Math.pow(1 + DECAY_FACTOR * (t / s), -0.5);
  return Math.max(0.01, Math.min(1.0, parseFloat(r.toFixed(4))));
}

/**
 * Calculates optimal interval (in days) to achieve target retention
 * At targetRetention = 0.90: (0.90^(-2) - 1) / (19/81) = 1.0 => days = Math.round(stability)
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
  } else if (card.elapsedDays < 1) {
    // SOTA Intra-day Same-Day Consolidation using w[17] and w[18]
    newDifficulty = nextDifficulty(card.difficulty, rating);
    if (rating === FsrsRating.Again) {
      newState = FsrsState.Relearning;
      newLapses += 1;
    } else {
      newState = FsrsState.Review;
    }
    const sSameDay = card.stability * (1 + Math.exp(w[17]) * (rating - 3 + w[18]));
    newStability = Math.max(w[0], sSameDay);
  } else {
    // Repeated Review (Inter-day)
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
      newStability = Math.min(card.stability, Math.max(w[0], sForget));
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

  newStability = parseFloat(newStability.toFixed(4));
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
 * Continuous Gaussian RBF Kernel for Vector Deficit Diffusion
 * K(v_A, v_k) = exp(- d^2 / (2 * sigma^2)), sigma = 0.125
 * Truncated at d > 0.25 (equivalent to cosine similarity < 0.75)
 */
export function calculateRbfKernel(distance: number, sigma: number = 0.125): number {
  if (distance > 0.25) return 0;
  return Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(sigma, 2)));
}

/**
 * Propagates deficit to semantically related questions via Gaussian RBF diffusion.
 * When a candidate lapses (Again / Hard), related concepts receive:
 * 1. Difficulty infiltration: D'_k = min(10, D_k + alpha * K * (10 - D_k)), alpha = 0.20
 * 2. Stability degradation: S'_k = max(w0, S_k * (1 - beta * K)), beta = 0.35
 * 3. Schedule adjustment: recalculated due_at; if <= now, marked as immediately due.
 */
export async function propagateDeficitCluster(
  questionId: string,
  userId: string = 'default_user',
  now: Date = new Date()
): Promise<{ count: number; neighbors: NeighborPropagationResult[] }> {
  try {
    const sourceRow = db.prepare('SELECT embedding, topic FROM question_embeddings WHERE question_id = ?').get(questionId) as any;
    if (!sourceRow?.embedding) return { count: 0, neighbors: [] };

    const sourceBuf = sourceRow.embedding as Buffer;
    const sourceVec = new Float32Array(sourceBuf.buffer.slice(sourceBuf.byteOffset, sourceBuf.byteOffset + sourceBuf.byteLength));

    const otherRows = db.prepare('SELECT question_id, embedding FROM question_embeddings WHERE question_id != ?').all(questionId) as any[];
    const neighbors: NeighborPropagationResult[] = [];

    const fetchCardStmt = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?');
    const updateNeighborStmt = db.prepare(`
      INSERT INTO fsrs_card_states (
        user_id, question_id, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review_at, due_at, updated_at
      ) VALUES (
        @userId, @questionId, @stability, @difficulty, 0, @scheduledDays, 0, 0, 0, null, @dueAt, CURRENT_TIMESTAMP
      )
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        stability = @stability,
        difficulty = @difficulty,
        scheduled_days = @scheduledDays,
        due_at = @dueAt,
        updated_at = CURRENT_TIMESTAMP
    `);

    const w0 = FSRS_5_WEIGHTS[0]; // 0.40255
    const alpha = 0.20;
    const beta = 0.35;
    const targetR = REQUEST_RETENTION; // 0.90
    const nowMs = now.getTime();

    const tx = db.transaction(() => {
      for (const r of otherRows) {
        if (!r.embedding) continue;
        const b = r.embedding as Buffer;
        const vec = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
        const sim = cosineSimilarity(sourceVec, vec);
        const dist = Math.max(0, 1.0 - sim);

        // Radius cut-off d <= 0.25 (cosine similarity >= 0.75)
        if (dist <= 0.25) {
          const kernelWeight = calculateRbfKernel(dist, 0.125);
          if (kernelWeight <= 0) continue;

          const neighborCardRaw = fetchCardStmt.get(userId, r.question_id) as any;
          const oldS = neighborCardRaw ? neighborCardRaw.stability : 1.0;
          const oldD = neighborCardRaw ? neighborCardRaw.difficulty : 5.0;

          // 1. Difficulty Infiltration
          const newD = Math.min(10.0, oldD + alpha * kernelWeight * (10.0 - oldD));
          // 2. Stability Degradation
          const newS = Math.max(w0, oldS * (1.0 - beta * kernelWeight));

          // 3. New interval: at R=0.90, intervalDays = S
          const intervalDays = (81 * newS / 19) * (Math.pow(targetR, -2) - 1);
          const lastRevMs = neighborCardRaw?.last_review_at ? new Date(neighborCardRaw.last_review_at).getTime() : nowMs;
          const newDueMs = Math.round(lastRevMs + intervalDays * 86400 * 1000);
          const immediatelyDue = newDueMs <= nowMs;
          const newDueDate = new Date(newDueMs).toISOString();

          updateNeighborStmt.run({
            userId,
            questionId: r.question_id,
            stability: parseFloat(newS.toFixed(2)),
            difficulty: parseFloat(newD.toFixed(2)),
            scheduledDays: Math.max(1, Math.round(intervalDays)),
            dueAt: newDueDate
          });

          neighbors.push({
            neighborQuestionId: r.question_id,
            oldStability: parseFloat(oldS.toFixed(2)),
            newStability: parseFloat(newS.toFixed(2)),
            oldDifficulty: parseFloat(oldD.toFixed(2)),
            newDifficulty: parseFloat(newD.toFixed(2)),
            distance: parseFloat(dist.toFixed(4)),
            newDueAt: newDueDate,
            immediatelyDue
          });
        }
      }
    });

    tx();
    return { count: neighbors.length, neighbors };
  } catch (err) {
    console.warn('Deficit propagation warning:', err);
    return { count: 0, neighbors: [] };
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
}): Promise<{ card: FsrsCardRecord; propagatedCount: number; propagatedNeighbors: NeighborPropagationResult[] }> {
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

  // 4. Record audit log
  try {
    db.prepare(`
      INSERT INTO fsrs_review_logs (
        log_id, question_id, user_id, rating, state, due_at, stability, difficulty, review_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      crypto.randomUUID(),
      questionId,
      userId,
      rating,
      next.state,
      next.dueAt,
      next.stability,
      next.difficulty,
      now.toISOString()
    );
  } catch (logErr) {
    console.warn('Failed to insert fsrs_review_log:', logErr);
  }

  // 5. Propagate deficit if failed / struggled
  let propagatedCount = 0;
  let propagatedNeighbors: NeighborPropagationResult[] = [];
  if (rating === FsrsRating.Again || rating === FsrsRating.Hard) {
    const prop = await propagateDeficitCluster(questionId, userId, now);
    propagatedCount = prop.count;
    propagatedNeighbors = prop.neighbors;
  }

  const updatedCard = db.prepare('SELECT * FROM fsrs_card_states WHERE user_id = ? AND question_id = ?').get(userId, questionId) as FsrsCardRecord;

  return {
    card: updatedCard,
    propagatedCount,
    propagatedNeighbors
  };
}

/**
 * Returns prioritized queue of questions due today or with R < 0.80
 * Orders by State urgency (Relearning=3, Learning=1 first) and then Due Date
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
      f.state,
      f.last_review_at,
      f.due_at,
      q.topic,
      q.question,
      q.answer
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
        state: row.state,
        dueAt: row.due_at,
        isOverdue
      });
    }
  }

  // Primary sort: Relearning (state 3) / Learning (state 1) first, then lowest retrievability
  queueItems.sort((a, b) => {
    const aUrgentState = a.state === FsrsState.Relearning || a.state === FsrsState.Learning ? 1 : 0;
    const bUrgentState = b.state === FsrsState.Relearning || b.state === FsrsState.Learning ? 1 : 0;
    if (aUrgentState !== bUrgentState) {
      return bUrgentState - aUrgentState;
    }
    return a.retrievability - b.retrievability;
  });

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
