const assert = require('assert');
const path = require('path');
const { db, seedCodingChallenges } = require('../dist/services/db');

console.log('Testing coding_challenges schema and data integrity...');

// Ensure challenges and task codes are seeded in test DB
seedCodingChallenges();

// 1. Check total count
const totalCount = db.prepare('SELECT count(*) as count FROM coding_challenges').get().count;
console.log(`Total coding challenges in DB: ${totalCount}`);
assert.strictEqual(totalCount, 97, 'Expected 97 total challenges');

// 2. Check task_code population
const tstCount = db.prepare("SELECT count(*) as count FROM coding_challenges WHERE task_code LIKE 'TST-%'").get().count;
console.log(`Testing Katas with TST-xx: ${tstCount}`);
assert.strictEqual(tstCount, 42, 'Expected 42 TST katas');

const lldCount = db.prepare("SELECT count(*) as count FROM coding_challenges WHERE task_code LIKE 'LLD-%'").get().count;
console.log(`LLD Challenges with LLD-xx: ${lldCount}`);
assert.strictEqual(lldCount, 55, 'Expected 55 LLD challenges');

// 3. Check difficulties normalization
const diffs = db.prepare('SELECT DISTINCT difficulty FROM coding_challenges ORDER BY difficulty').all().map(r => r.difficulty);
console.log('Distinct difficulties:', diffs);
assert.deepStrictEqual(diffs, ['Junior', 'Lead', 'Middle', 'Senior'], 'All difficulties must be Title Case');

// 4. Check broken titles were fixed
const broken = db.prepare("SELECT count(*) as count FROM coding_challenges WHERE title LIKE '%\uFFFD%'").get().count;
assert.strictEqual(broken, 0, 'No broken UTF-8 titles should exist');

// 5. Check sample ordering
const firstFive = db.prepare("SELECT task_code, difficulty, title FROM coding_challenges WHERE task_code LIKE 'TST-%' ORDER BY task_code ASC LIMIT 5").all();
console.log('\nFirst 5 TST katas:');
firstFive.forEach(r => console.log(`  ${r.task_code} [${r.difficulty}] ${r.title}`));
assert.strictEqual(firstFive[0].task_code, 'TST-01');
assert.strictEqual(firstFive[0].difficulty, 'Junior');

const firstFiveLld = db.prepare("SELECT task_code, difficulty, title FROM coding_challenges WHERE task_code LIKE 'LLD-%' ORDER BY task_code ASC LIMIT 5").all();
console.log('\nFirst 5 LLD challenges:');
firstFiveLld.forEach(r => console.log(`  ${r.task_code} [${r.difficulty}] ${r.title}`));
assert.strictEqual(firstFiveLld[0].task_code, 'LLD-01');
assert.strictEqual(firstFiveLld[0].difficulty, 'Middle');

console.log('\nAll assertions passed successfully! Database and catalog integrity verified.');
db.close();
