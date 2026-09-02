const {
  calculateRetrievability,
  nextInterval,
  mapScoreToRating,
  calculateNextState,
  calculateRbfKernel,
  FsrsRating,
  FsrsState,
  FSRS_5_WEIGHTS,
  DECAY_FACTOR
} = require('../dist/services/fsrsEngine');

console.log('=== 1. Testing Retrievability R(t, S) with Canonical Decay Factor ===');

// Verify Decay Factor is exactly 19/81 (~0.234568)
console.log(`DECAY_FACTOR: ${DECAY_FACTOR} (Expected: 19/81 = ${19/81})`);
if (Math.abs(DECAY_FACTOR - 19 / 81) > 1e-7) throw new Error('DECAY_FACTOR must strictly equal 19/81');

// Day 0: R should be 1.0
const r0 = calculateRetrievability(0, 5.0);
console.log(`R(t=0, S=5): ${r0} (Expected: 1.0)`);
if (r0 !== 1.0) throw new Error(`Expected R=1.0 at t=0, got ${r0}`);

// Canonical Invariant: At t = S, R(S, S) MUST strictly equal 0.9000
const rAtS = calculateRetrievability(5, 5.0);
console.log(`R(t=S, S=5): ${rAtS} (Canonical Standard: 0.9000)`);
if (Math.abs(rAtS - 0.9000) > 0.0001) throw new Error(`Expected R=0.9000 at t=S, got ${rAtS}`);

// Long time: t = 60, S = 5: R should significantly decay
const rLong = calculateRetrievability(60, 5.0);
console.log(`R(t=60, S=5): ${rLong} (Expected: < 0.60)`);
if (rLong > 0.60) throw new Error(`Expected R < 0.60 at t=60, got ${rLong}`);

console.log('\n=== 2. Testing Score Mapping to FSRS Ratings ===');
console.log(`Score 95 -> ${mapScoreToRating(95)} (Expected: ${FsrsRating.Easy})`);
if (mapScoreToRating(95) !== FsrsRating.Easy) throw new Error('Expected Easy');

console.log(`Score 80 -> ${mapScoreToRating(80)} (Expected: ${FsrsRating.Good})`);
if (mapScoreToRating(80) !== FsrsRating.Good) throw new Error('Expected Good');

console.log(`Score 65 -> ${mapScoreToRating(65)} (Expected: ${FsrsRating.Hard})`);
if (mapScoreToRating(65) !== FsrsRating.Hard) throw new Error('Expected Hard');

console.log(`Score 35 -> ${mapScoreToRating(35)} (Expected: ${FsrsRating.Again})`);
if (mapScoreToRating(35) !== FsrsRating.Again) throw new Error('Expected Again');

console.log('\n=== 3. Testing Gaussian RBF Kernel for Deficit Diffusion ===');

// d = 0: K should be 1.0
const k0 = calculateRbfKernel(0);
console.log(`K(d=0.0): ${k0.toFixed(4)} (Expected: 1.0000)`);
if (Math.abs(k0 - 1.0) > 1e-4) throw new Error('Expected K=1.0 at d=0');

// d = 0.10: K should be ~0.7261
const k10 = calculateRbfKernel(0.10);
console.log(`K(d=0.10): ${k10.toFixed(4)} (Expected: ~0.7261)`);
if (Math.abs(k10 - 0.7261) > 0.005) throw new Error(`Expected K ~ 0.7261 at d=0.10, got ${k10}`);

// d = 0.25: K should be ~0.1353
const k25 = calculateRbfKernel(0.25);
console.log(`K(d=0.25): ${k25.toFixed(4)} (Expected: ~0.1353)`);
if (Math.abs(k25 - 0.1353) > 0.005) throw new Error(`Expected K ~ 0.1353 at d=0.25, got ${k25}`);

// d = 0.30: K should be 0.0 (truncated outside critical radius d <= 0.25)
const k30 = calculateRbfKernel(0.30);
console.log(`K(d=0.30): ${k30} (Expected: 0)`);
if (k30 !== 0) throw new Error(`Expected K=0 for d > 0.25, got ${k30}`);

console.log('\n=== 4. Testing Intra-Day Same-Day Consolidation ===');

const baseReviewCard = {
  stability: 3.17,
  difficulty: 5.0,
  elapsedDays: 0, // Same-day review
  reps: 1,
  lapses: 0,
  state: FsrsState.Review,
  lastReviewAt: new Date().toISOString()
};

const sameDayGood = calculateNextState(baseReviewCard, FsrsRating.Good);
console.log('Same-Day Review (Good, elapsed=0):', {
  oldStability: baseReviewCard.stability,
  newStability: sameDayGood.stability,
  difficulty: sameDayGood.difficulty,
  reps: sameDayGood.reps
});
if (sameDayGood.stability <= baseReviewCard.stability) {
  throw new Error('Expected stability to increase on same-day Good review');
}

const sameDayAgain = calculateNextState(baseReviewCard, FsrsRating.Again);
console.log('Same-Day Review (Again, elapsed=0):', {
  oldStability: baseReviewCard.stability,
  newStability: sameDayAgain.stability,
  state: sameDayAgain.state,
  lapses: sameDayAgain.lapses
});
if (sameDayAgain.state !== FsrsState.Relearning) {
  throw new Error('Expected state=Relearning on same-day Again');
}
if (sameDayAgain.stability < FSRS_5_WEIGHTS[0] - 0.001) {
  throw new Error(`Expected stability >= w0 (${FSRS_5_WEIGHTS[0]}), got ${sameDayAgain.stability}`);
}

console.log('\n=== 5. Testing FSRS-5 Full Lifecycle Transitions ===');

// Initial review with "Good" rating
const initialCard = {
  stability: 1.0,
  difficulty: 5.0,
  elapsedDays: 0,
  reps: 0,
  lapses: 0,
  state: FsrsState.New,
  lastReviewAt: null
};

const firstPass = calculateNextState(initialCard, FsrsRating.Good);
console.log('First Review (Good):', {
  stability: firstPass.stability,
  difficulty: firstPass.difficulty,
  reps: firstPass.reps,
  state: firstPass.state,
  scheduledDays: firstPass.scheduledDays
});

if (firstPass.reps !== 1) throw new Error('Expected reps=1');
if (Math.abs(firstPass.stability - FSRS_5_WEIGHTS[2]) > 0.01) throw new Error(`Expected stability ~ ${FSRS_5_WEIGHTS[2]}, got ${firstPass.stability}`);
if (firstPass.scheduledDays < 1) throw new Error('Expected scheduledDays >= 1');

// Second review after 4 days with "Good" rating
const secondCard = {
  ...firstPass,
  elapsedDays: 4
};
const secondPass = calculateNextState(secondCard, FsrsRating.Good);
console.log('Second Review (Good after 4 days):', {
  stability: secondPass.stability,
  difficulty: secondPass.difficulty,
  reps: secondPass.reps,
  scheduledDays: secondPass.scheduledDays
});

if (secondPass.stability <= firstPass.stability) throw new Error('Expected stability to grow on recall');
if (secondPass.reps !== 2) throw new Error('Expected reps=2');

// Third review with "Again" (Lapse)
const lapseCard = {
  ...secondPass,
  elapsedDays: 10
};
const lapsePass = calculateNextState(lapseCard, FsrsRating.Again);
console.log('Third Review (Again - Lapse):', {
  stability: lapsePass.stability,
  difficulty: lapsePass.difficulty,
  lapses: lapsePass.lapses,
  state: lapsePass.state,
  scheduledDays: lapsePass.scheduledDays
});

if (lapsePass.lapses !== 1) throw new Error('Expected lapses=1');
if (lapsePass.state !== FsrsState.Relearning) throw new Error('Expected state=Relearning');
if (lapsePass.scheduledDays !== 1) throw new Error('Expected scheduledDays=1 for Lapse');

console.log('\n🎉 ALL SOTA FSRS-5 MATHEMATICAL TESTS & INVARIANTS PASSED PERFECTLY!');
