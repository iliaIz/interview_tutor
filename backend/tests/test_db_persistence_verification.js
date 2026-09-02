const { db } = require('../dist/services/db');

async function testDatabaseHardening() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING DATABASE HARDENING & PERSISTENCE');
  console.log('========================================================================\n');

  // 1. Check foreign_keys pragma
  const fkRow = db.prepare('PRAGMA foreign_keys').get();
  console.log('PRAGMA foreign_keys:', fkRow.foreign_keys);
  if (fkRow.foreign_keys !== 1) {
    console.error('❌ Expected PRAGMA foreign_keys to be 1 (ON)!');
    process.exit(1);
  }
  console.log('✅ PRAGMA foreign_keys = ON verified!');

  // 2. Test system_design_submissions persistence
  const testScenarioId = 'test_scenario_123';
  const testSubId = `sd_test_${Date.now()}`;
  const testMermaid = JSON.stringify({ nodes: [{ id: 'api_gateway', type: 'Gateway' }] });
  const testNotes = 'Test system design notes';
  const testEval = JSON.stringify({ overallScore: 88, verdict: 'BAR_RAISER_HIRE' });

  db.prepare(`
    INSERT INTO system_design_submissions (
      id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(testSubId, testScenarioId, 'default_user', testMermaid, testNotes, testEval);

  const retrievedSd = db.prepare(`
    SELECT * FROM system_design_submissions WHERE id = ?
  `).get(testSubId);

  if (!retrievedSd || retrievedSd.scenario_id !== testScenarioId) {
    console.error('❌ Failed to retrieve system_design_submissions!');
    process.exit(1);
  }
  console.log('✅ system_design_submissions successfully saved and retrieved:', retrievedSd.id);

  // 3. Test triage_submissions persistence
  const testIncidentId = 'inc_cache_stampede';
  const testTriageId = `triage_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO triage_submissions (
      id, incident_id, user_id, rca_hypothesis, prevention_plan, evaluation_json, score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    testTriageId,
    testIncidentId,
    'default_user',
    'Cache stampede on product details key',
    'Add probabilistic early expiration and distributed mutex',
    JSON.stringify({ verdict: 'RESOLVED', totalScore: 95 }),
    95
  );

  const retrievedTriage = db.prepare(`
    SELECT * FROM triage_submissions WHERE id = ?
  `).get(testTriageId);

  if (!retrievedTriage || retrievedTriage.score !== 95) {
    console.error('❌ Failed to retrieve triage_submissions!');
    process.exit(1);
  }
  console.log('✅ triage_submissions successfully saved and retrieved:', retrievedTriage.id);

  // Clean up test records
  db.prepare('DELETE FROM system_design_submissions WHERE id = ?').run(testSubId);
  db.prepare('DELETE FROM triage_submissions WHERE id = ?').run(testTriageId);

  console.log('\n🎉 ALL DATABASE INTEGRITY & PERSISTENCE CHECKS PASSED!');
  process.exit(0);
}

testDatabaseHardening().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
