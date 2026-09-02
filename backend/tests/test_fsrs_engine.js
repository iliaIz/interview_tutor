const {
  calculateRetrievability,
  nextInterval,
  mapScoreToRating,
  calculateNextState,
  FsrsRating,
  FsrsState,
  FSRS_5_WEIGHTS
} = require('../dist/services/fsrsEngine');

console.log('=== 1. Testing Retrievability R(t, S) ===');

// Day 0: R should be 1.0
const r0 = calculateRetrievability(0, 5.0);
console.log(`R(t=0, S=5): ${r0} (Expected: 1.0)`);
if (r0 !== 1.0) throw new Error(`Expected R=1.0 at t=0, got ${r0}`);

// At t = S: R should be approximately 0.917 (~90%)
const rAtS = calculateRetrievability(5, 5.0);
console.log(`R(t=S, S=5): ${rAtS} (Expected: ~0.917)`);
if (rAtS < 0.90 || rAtS > 0.93) throw new Error(`Expected R ~ 0.917 at t=S, got ${rAtS}`);

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

console.log('\n=== 3. Testing FSRS-5 State Transitions ===');

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

console.log('\n🎉 ALL FSRS-5 ENGINE MATHEMATICAL TESTS PASSED!');
