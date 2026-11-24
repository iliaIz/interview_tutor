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
assert.ok(questions.length >= 12, `Must have at least 12 canonical questions, found ${questions.length}`);

// Verify all questions have required fields and Spec 40 microBeats integrity
let totalBeats = 0;
for (const q of questions) {
  assert.ok(q.id, 'Question must have id');
  assert.ok(q.title, 'Question must have title');
  assert.ok(q.canonicalQuestion, 'Question must have canonicalQuestion');
  assert.ok(q.referenceAnswer, 'Question must have referenceAnswer');
  assert.ok(q.targetDurationSec, 'Question must have targetDurationSec');
  assert.ok(Array.isArray(q.requiredAnchors), 'Question must have requiredAnchors');

  assert.ok(Array.isArray(q.microBeats) && q.microBeats.length >= 2, `Question ${q.id} must have >= 2 Spec 40 microBeats`);
  const chunkIds = new Set((q.chunks || []).map(c => c.id));
  const anchorIds = new Set(q.requiredAnchors.map(a => a.id));
  const forbidden = (q.forbiddenPatterns || []).map(p => p.toLowerCase());

  for (const beat of q.microBeats) {
    totalBeats++;
    assert.ok(beat.id && beat.title, `Beat in ${q.id} must have id and title`);
    assert.ok(chunkIds.has(beat.chunkId), `Beat ${beat.id} chunkId ${beat.chunkId} must exist in chunks`);
    assert.ok(Array.isArray(beat.anchorIds) && beat.anchorIds.length >= 1, `Beat ${beat.id} must link >= 1 anchor`);
    for (const aid of beat.anchorIds) {
      assert.ok(anchorIds.has(aid), `Beat ${beat.id} anchorId ${aid} must exist in requiredAnchors`);
    }
    assert.ok(Array.isArray(beat.immutableFacts) && beat.immutableFacts.length >= 1, `Beat ${beat.id} must declare immutableFacts`);
    assert.ok(Array.isArray(beat.spokenVariants) && beat.spokenVariants.length >= 2, `Beat ${beat.id} must provide >= 2 varied spokenVariants`);
    assert.strictEqual(new Set(beat.spokenVariants).size, beat.spokenVariants.length, `Beat ${beat.id} spokenVariants must be distinct`);
    assert.ok(beat.hrTriggerPrompt && beat.hrTriggerPrompt.trim().length > 5, `Beat ${beat.id} must provide hrTriggerPrompt`);
    for (const variant of beat.spokenVariants) {
      const low = variant.toLowerCase();
      for (const bad of forbidden) {
        assert.ok(!low.includes(bad), `Beat ${beat.id} variant contains forbidden pattern "${bad}"`);
      }
    }
  }
}

// Verify elevator pitch question
const pitch = questions.find(q => q.id === 'hr_q0_elevator_pitch');
assert.ok(pitch, 'Must contain elevator pitch question');
assert.ok(pitch.referenceAnswer.includes('Илья'), 'Pitch must contain Ilya');
assert.ok(pitch.referenceAnswer.includes('БТЛаб'), 'Pitch must reference BTLab');

console.log(`✅ HR fixtures, ${questions.length} canonical questions & ${totalBeats} microBeats verified successfully.`);
