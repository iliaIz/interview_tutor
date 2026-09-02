const {
  getPersonaPromptDirectives,
  calculateFaangScorecard
} = require('../dist/prompts/personas');

console.log('=== 1. Testing getPersonaPromptDirectives for all 4 Personas ===');

const personas = ['mentor', 'amazon_bar_raiser', 'google_staff', 'yandex_core'];
const grades = ['L4_MIDDLE', 'L5_SENIOR', 'L6_STAFF'];

for (const p of personas) {
  for (const g of grades) {
    const res = getPersonaPromptDirectives({
      persona: p,
      targetGrade: g,
      topic: 'Java Memory Model & Spring Transactions'
    });
    console.log(`✅ [${p}] [${g}]: Title="${res.personaTitle}", HasRole=${res.roleDirective.length > 50}, HasGrade=${res.gradeExpectationDirective.length > 50}`);
  }
}

console.log('\n=== 2. Testing calculateFaangScorecard Calculations ===');

// Strong Hire Test
const shScorecard = calculateFaangScorecard({
  score: 92,
  persona: 'amazon_bar_raiser',
  targetGrade: 'L5_SENIOR',
  positivePoints: ['Accurately explained contiguous humongous allocation in G1', 'Analyzed cloud footprint and costs'],
  missingPoints: []
});
console.log('Strong Hire Result:', JSON.stringify(shScorecard, null, 2));
if (shScorecard.verdict !== 'STRONG_HIRE') throw new Error('Expected STRONG_HIRE');
if (shScorecard.percentile < 90) throw new Error('Expected percentile >= 90');

// Hire Test
const hScorecard = calculateFaangScorecard({
  score: 78,
  persona: 'yandex_core',
  targetGrade: 'L5_SENIOR',
  positivePoints: ['Correct understanding of happens-before and volatile read/write fences'],
  missingPoints: ['Did not mention @Contended annotation']
});
console.log('Hire Result Verdict:', hScorecard.verdict, 'Percentile:', hScorecard.percentile);
if (hScorecard.verdict !== 'HIRE') throw new Error('Expected HIRE');

// Leaning No Hire Test
const lnhScorecard = calculateFaangScorecard({
  score: 55,
  persona: 'google_staff',
  targetGrade: 'L6_STAFF',
  positivePoints: ['Basic awareness of sharding'],
  missingPoints: ['Failed to analyze worst-case quadratic complexity under hash collision', 'Omitted split-brain risk']
});
console.log('Leaning No Hire Verdict:', lnhScorecard.verdict, 'Calibrated Grade:', lnhScorecard.calibratedGrade);
if (lnhScorecard.verdict !== 'LEANING_NO_HIRE') throw new Error('Expected LEANING_NO_HIRE');
if (lnhScorecard.calibratedGrade !== 'L5_SENIOR') throw new Error('Expected calibratedGrade to downgrade to L5_SENIOR for L6 target');

console.log('\n🎉 ALL FAANG PERSONA & SCORECARD UNIT TESTS PASSED!');
