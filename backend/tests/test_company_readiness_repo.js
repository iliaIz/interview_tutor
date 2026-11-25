const assert = require('assert');
const Database = require('better-sqlite3');
const express = require('express');
const http = require('http');

console.log('========================================================================');
console.log('🧪 SPEC 44 COMPANY READINESS REPOSITORY & TENANCY ROUTE TESTS');
console.log('========================================================================\n');

const { CompanyReadinessRepository } = require('../dist/services/companies/CompanyReadinessRepository');
const companiesRouter = require('../dist/routes/companies').default || require('../dist/routes/companies');

function createTestDb() {
  const mem = new Database(':memory:');
  mem.exec(`
    CREATE TABLE company_question_mastery (
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      is_mastered INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      last_evaluated_at TEXT,
      PRIMARY KEY (user_id, company_id, question_id)
    );
    CREATE TABLE coding_submissions (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT,
      score INTEGER
    );
    CREATE TABLE system_design_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL
    );
  `);
  return mem;
}

async function runTests() {
  const mem = createTestDb();
  const repo = new CompanyReadinessRepository(mem);

  // 1. Validate loaded profiles via TypeBox + manifest extensions
  const profiles = CompanyReadinessRepository.loadProfiles(true);
  assert.ok(profiles.length >= 2, 'Expected at least 2 company profiles');
  assert.ok(profiles.find((p) => p.id === 'alfa_digital')?.readinessConfig?.questionCatalogFile === 'alfa_interview_questions.json');
  console.log('  ✅ TypeBox loadProfiles validates all manifests');

  // 2. Manifest-driven readiness counts with multi-tenant isolation
  repo.recordQuestionMastery('alfa_digital', 'q_01', 'alice', true, 95);
  repo.recordQuestionMastery('alfa_digital', 'q_02', 'alice', true, 100);
  repo.recordQuestionMastery('alfa_digital', 'q_01', 'bob', true, 90);

  mem.prepare('INSERT INTO coding_submissions (id, challenge_id, user_id, status, score) VALUES (?, ?, ?, ?, ?)').run('s1', 'cr-alfa-01', 'alice', 'PASSED', 92);
  mem.prepare('INSERT INTO coding_submissions (id, challenge_id, user_id, status, score) VALUES (?, ?, ?, ?, ?)').run('s2', 'lld-key-value-cache-ttl', 'alice', 'PASSED', 88);
  mem.prepare('INSERT INTO coding_submissions (id, challenge_id, user_id, status, score) VALUES (?, ?, ?, ?, ?)').run('s3', 'sql-alfa-01', 'alice', 'PASSED', 100);
  mem.prepare('INSERT INTO coding_submissions (id, challenge_id, user_id, status, score) VALUES (?, ?, ?, ?, ?)').run('s4', 'iban-parser', 'alice', 'PASSED', 95);
  mem.prepare('INSERT INTO system_design_submissions (id, user_id, scenario_id) VALUES (?, ?, ?)').run('sd1', 'alice', 'sd-payments');

  const aliceAlfa = repo.calculateReadiness('alfa_digital', 'alice');
  assert.strictEqual(aliceAlfa.theory.completed, 2);
  assert.strictEqual(aliceAlfa.theory.total, 27);
  assert.strictEqual(aliceAlfa.codeReview.completed, 1);
  assert.strictEqual(aliceAlfa.codeReview.total, 6);
  assert.strictEqual(aliceAlfa.liveCoding.completed, 1, 'exactIds rule must include lld-key-value-cache-ttl');
  assert.strictEqual(aliceAlfa.liveCoding.total, 5);
  assert.strictEqual(aliceAlfa.sql.completed, 1);
  assert.strictEqual(aliceAlfa.sql.total, 7);
  assert.strictEqual(aliceAlfa.systemDesign.completed, 1);
  assert.strictEqual(aliceAlfa.systemDesign.total, 5);

  const bobAlfa = repo.calculateReadiness('alfa_digital', 'bob');
  assert.strictEqual(bobAlfa.theory.completed, 1);
  assert.strictEqual(bobAlfa.codeReview.completed, 0, 'Tenants must stay isolated');

  const aliceRaiff = repo.calculateReadiness('raiffeisen_dgtl', 'alice');
  assert.strictEqual(aliceRaiff.liveCoding.completed, 2, 'raiffeisen manifest must count iban- prefix AND exactId lld-key-value-cache-ttl');
  assert.strictEqual(aliceRaiff.liveCoding.total, 2);
  console.log('  ✅ Manifest-driven readiness index & multi-tenant SQL isolation passed');

  // 3. Curated questions driven by manifest questionCatalogFile (not companyId hardcode)
  assert.strictEqual(repo.getCuratedQuestions('raiffeisen_dgtl', 'alice').length, 0);
  const alfaQuestions = repo.getCuratedQuestions('alfa_digital', 'alice');
  assert.ok(alfaQuestions.length > 0, 'alfa_digital catalog must load from manifest questionCatalogFile');
  console.log('  ✅ Manifest-driven curated question catalog passed');

  // 4. Companies route ignores query/body user_id spoofing & uses req.user.id
  const app = express();
  app.use(express.json());
  app.use('/api/companies', (req, _res, next) => {
    req.user = { id: 'real_auth_user', role: 'user' };
    next();
  }, companiesRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const { db } = require('../dist/services/db');
    db.prepare('INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, ?)').run('spoofed_victim', 'Victim', 'user');
    db.prepare('INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, ?)').run('real_auth_user', 'Real', 'user');
    CompanyReadinessRepository.recordQuestionMastery('alfa_digital', 'q_spoof_test', 'spoofed_victim', false, 0);

    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/companies/alfa_digital/questions/q_spoof_test/mastery',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`))));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ user_id: 'spoofed_victim', isMastered: true, score: 100 }));
      req.end();
    });

    const victimRow = db.prepare('SELECT is_mastered FROM company_question_mastery WHERE user_id = ? AND question_id = ?').get('spoofed_victim', 'q_spoof_test');
    const authRow = db.prepare('SELECT is_mastered FROM company_question_mastery WHERE user_id = ? AND question_id = ?').get('real_auth_user', 'q_spoof_test');
    assert.strictEqual(victimRow.is_mastered, 0, 'Route MUST NOT mutate spoofed query/body user_id');
    assert.strictEqual(authRow.is_mastered, 1, 'Route MUST attribute mastery to authenticated req.user.id');
    console.log('  ✅ Companies route tenancy enforcement (getAuthUserId) verified');
  } finally {
    server.close();
  }

  console.log('\n🎉 All Spec 44 CompanyReadinessRepository tests PASSED!\n');
}

runTests().catch((err) => {
  console.error('❌ Spec 44 test suite failed:', err);
  process.exit(1);
});
