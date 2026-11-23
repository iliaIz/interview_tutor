/**
 * FsrsAlgorithm.ts
 * Pure Mathematical Implementation of FSRS-5 (Free Spaced Repetition Scheduler).
 * SOTA 2026 Default 19-parameter weight vector with Gaussian RBF kernel.
 * Pure stateless math: zero database dependencies, zero side effects.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

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

export interface FsrsCardStateSnapshot {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  lastReviewAt: string | null;
}

export interface FsrsNextStateResult {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  lastReviewAt: string;
  dueAt: string;
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
export function initDifficulty(rating: FsrsRating): number {
  const w = FSRS_5_WEIGHTS;
  const d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return Math.max(1.0, Math.min(10.0, parseFloat(d.toFixed(2))));
}

/**
 * Next difficulty D' with mean reversion
 */
export function nextDifficulty(d: number, rating: FsrsRating): number {
  const w = FSRS_5_WEIGHTS;
  const delta = -w[6] * (rating - 3);
  const dPrime = w[7] * initDifficulty(FsrsRating.Good) + (1 - w[7]) * (d + delta);
  return Math.max(1.0, Math.min(10.0, parseFloat(dPrime.toFixed(2))));
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
 * FSRS-5 state transition: computes new Stability, Difficulty, State, and due_at
 */
export function calculateNextState(
  card: FsrsCardStateSnapshot,
  rating: FsrsRating,
  reviewTime: Date = new Date()
): FsrsNextStateResult {
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
