/**
 * test_catalog_seeder_bootstrap.js
 * In-memory SQLite verification for DatabaseBootstrap, ChallengeCatalogLoader, and CatalogSeeder (Spec 57 / #202).
 */

const assert = require('assert');
const Database = require('better-sqlite3');
const { Value, CodingChallengeSchema } = require('@interview-prep/shared');
const { DatabaseBootstrap } = require('../dist/services/db/DatabaseBootstrap');
const { CatalogSeeder } = require('../dist/services/db/CatalogSeeder');
const { ChallengeCatalogLoader, loadCodingChallengeCatalogs } = require('../dist/services/db/ChallengeCatalogLoader');

function runTests() {
  console.log('\n🧪 Running Spec 57 DatabaseBootstrap & CatalogSeeder Verification...');

  // 1. ChallengeCatalogLoader + CodingChallengeSchema TypeBox parity across all 6 JSON catalogs
  const loaded = loadCodingChallengeCatalogs();
  assert.strictEqual(loaded.base.length, 7, 'base_challenges.json contains 7 challenges');
  assert.strictEqual(loaded.additionalLld.length, 13, 'additional_lld_challenges.json contains 13 challenges');
  assert.strictEqual(loaded.mutation.length, 42, 'mutation_challenges.json contains 42 challenges');
  assert.strictEqual(loaded.machineCoding.length, 41, 'machine_coding_challenges.json contains 41 challenges');
  assert.strictEqual(loaded.refactoring.length, 32, 'refactoring_challenges.json contains 32 challenges');
  assert.strictEqual(loaded.designPatterns.length, 7, 'design_patterns_challenges.json contains 7 challenges');
  assert.strictEqual(loaded.all.length, 142, 'Total loaded challenges equals 142 (135 coding/mutation + 7 DP)');

  for (const item of loaded.all) {
    assert.ok(Value.Check(CodingChallengeSchema, item), `CodingChallengeSchema validates ${item.id}`);
  }
  console.log('  ✅ CatalogLoader validated all 142 JSON challenges via CodingChallengeSchema');

  // 2. DatabaseBootstrap(':memory:') performs zero hidden auth DELETEs
  const memDb = DatabaseBootstrap.createDatabase(':memory:');
  memDb.prepare("INSERT INTO users (id, email, name) VALUES ('user_keep', 'keep@test.local', 'Keep User')").run();
  memDb.prepare("INSERT INTO invite_tokens (code, user_id, role, is_active) VALUES ('REVOKED1', 'user_keep', 'candidate', 0)").run();

  // Re-running initSchema must NOT purge auth records silently
  DatabaseBootstrap.initSchema(memDb);
  const keptUsers = memDb.prepare("SELECT id FROM users WHERE id = 'user_keep'").all();
  assert.strictEqual(keptUsers.length, 1, 'DatabaseBootstrap.initSchema executes zero silent auth DELETEs');

  // Explicit cleanupInactiveInvites purges revoked invite tokens & non-master unattached users
  DatabaseBootstrap.cleanupInactiveInvites(memDb);
  const purgedUsers = memDb.prepare("SELECT id FROM users WHERE id = 'user_keep'").all();
  assert.strictEqual(purgedUsers.length, 0, 'DatabaseBootstrap.cleanupInactiveInvites purges inactive users explicitly');
  console.log('  ✅ DatabaseBootstrap separates schema init from explicit cleanupInactiveInvites');

  // 3. Idempotent multi-boot seeding: DP-01..DP-07 must never be overwritten by LLD-xx
  CatalogSeeder.seedAllCatalogs(memDb);
  CatalogSeeder.seedCodingChallenges(memDb); // Simulate standalone re-seed after DP rows exist!
  CatalogSeeder.seedAllCatalogs(memDb);

  const dpRows = memDb.prepare("SELECT id, task_code FROM coding_challenges WHERE category = 'design_patterns' ORDER BY task_code ASC").all();
  assert.strictEqual(dpRows.length, 7, 'Expected 7 Design Patterns challenges');
  assert.deepStrictEqual(
    dpRows.map((r) => r.task_code),
    ['DP-01', 'DP-02', 'DP-03', 'DP-04', 'DP-05', 'DP-06', 'DP-07'],
    'DP-01..DP-07 remain intact after repeated seedCodingChallenges calls'
  );

  const tstRows = memDb.prepare("SELECT id, task_code FROM coding_challenges WHERE track = 'testing_mutation' ORDER BY task_code ASC").all();
  assert.strictEqual(tstRows.length, 42, 'Expected 42 TST mutation challenges');
  assert.strictEqual(tstRows[0].task_code, 'TST-01', 'First TST code is TST-01');
  assert.strictEqual(tstRows[41].task_code, 'TST-42', 'Last TST code is TST-42');

  const lldRows = memDb.prepare("SELECT id, task_code FROM coding_challenges WHERE COALESCE(track, '') NOT IN ('testing_mutation', 'design_patterns') AND COALESCE(category, '') != 'design_patterns' ORDER BY task_code ASC").all();
  assert.strictEqual(lldRows.length, 93, 'Expected 93 LLD challenges with zero DP overlap');
  const lldNumbers = lldRows.map((r) => Number(String(r.task_code).replace('LLD-', ''))).sort((a, b) => a - b);
  assert.strictEqual(lldNumbers[0], 1, 'First LLD code is LLD-01');
  assert.strictEqual(lldNumbers[92], 93, 'Contiguous LLD codes end at LLD-93 with zero gaps');

  memDb.close();
  console.log('  ✅ Disjoint TST-01..42, DP-01..07, LLD-01..93 verified across repeated seeding boots!\n');
}

runTests();
