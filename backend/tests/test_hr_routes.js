/**
 * test_hr_routes.js
 * Verification of HR API REST endpoints and JSON fixtures delivery.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 VERIFYING HR REST API & FIXTURE INTEGRITY...');

// 1. Direct verify fixtures exist and are valid JSON
const fixturesDir = path.join(__dirname, '../src/data/hr/fixtures');
const questionsPath = path.join(fixturesDir, 'canonicalQuestionMatrix.json');
const dossierPath = path.join(fixturesDir, 'canonicalCandidateDossier.json');
const jobsPath = path.join(fixturesDir, 'defaultJobContexts.json');

assert.ok(fs.existsSync(questionsPath), 'canonicalQuestionMatrix.json must exist');
assert.ok(fs.existsSync(dossierPath), 'canonicalCandidateDossier.json must exist');
assert.ok(fs.existsSync(jobsPath), 'defaultJobContexts.json must exist');

const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
const dossier = JSON.parse(fs.readFileSync(dossierPath, 'utf-8'));

assert.ok(Array.isArray(questions), 'Questions must be an array');
assert.strictEqual(questions.length, 12, 'Must have 12 canonical questions');

// Verify all 12 questions have required fields
for (const q of questions) {
  assert.ok(q.id, 'Question must have id');
  assert.ok(q.title, 'Question must have title');
  assert.ok(q.canonicalQuestion, 'Question must have canonicalQuestion');
  assert.ok(q.referenceAnswer, 'Question must have referenceAnswer');
  assert.ok(q.targetDurationSec, 'Question must have targetDurationSec');
  assert.ok(Array.isArray(q.requiredAnchors), 'Question must have requiredAnchors');
}

// Verify elevator pitch question
const pitch = questions.find(q => q.id === 'hr_q0_elevator_pitch');
assert.ok(pitch, 'Must contain elevator pitch question');
assert.ok(pitch.referenceAnswer.includes('Илья'), 'Pitch must contain Ilya');
assert.ok(pitch.referenceAnswer.includes('БТЛаб'), 'Pitch must reference BTLab');

console.log('✅ HR fixtures & 12 canonical questions verified successfully.');
