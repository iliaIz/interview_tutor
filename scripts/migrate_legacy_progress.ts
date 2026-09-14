/**
 * scripts/migrate_legacy_progress.ts
 * 
 * SOTA September 2026 Idempotent Progress Migration Script.
 * Backfills historical progress from legacy `system_design_submissions`
 * into the SSOT `user_progress_ledger` table with dual-key alias resolution.
 */

import path from 'path';
import fs from 'fs';
import { db } from '../backend/dist/services/db.js';

export function runProgressMigration() {
  console.log(`🔌 Connected to database via backend/src/services/db`);


  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_progress_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      canonical_id TEXT NOT NULL,
      studio_stage TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER,
      artifacts_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (canonical_id) REFERENCES system_design_manifests(canonical_id)
    );
  `);

  const initialLedgerCount = (db.prepare('SELECT COUNT(*) as c FROM user_progress_ledger').get() as any).c;
  console.log(`📊 Initial user_progress_ledger records: ${initialLedgerCount}`);

  const submissions = db.prepare(`
    SELECT id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
    FROM system_design_submissions
  `).all() as any[];

  console.log(`📥 Found ${submissions.length} legacy system_design_submissions to evaluate.`);

  let migratedCount = 0;
  let skippedCount = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO user_progress_ledger (
      id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((rows: any[]) => {
    for (const sub of rows) {
      const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(sub.scenario_id) as any;
      const canonicalId = aliasRow ? aliasRow.canonical_id : sub.scenario_id;

      // Verify canonical manifest exists
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
      if (!manifestRow) {
        console.warn(`⚠️ [Skip] No canonical manifest for scenario_id '${sub.scenario_id}' (resolved: '${canonicalId}')`);
        skippedCount++;
        continue;
      }

      let score = 75;
      let parsedEval: any = null;
      try {
        if (sub.evaluation_json) {
          parsedEval = JSON.parse(sub.evaluation_json);
          if (typeof parsedEval.totalScore === 'number') {
            score = parsedEval.totalScore;
          } else if (typeof parsedEval.overall_score === 'number') {
            score = Math.round(parsedEval.overall_score * 20);
          }
        }
      } catch {}

      const status = score >= 70 ? 'PASSED' : 'FAILED';
      const studioStage = sub.architecture_mermaid && sub.architecture_mermaid.includes('"nodes"') 
        ? 'STUDIO_2_SIMULATION' 
        : 'STUDIO_3_DEFENSE';

      const ledgerId = `prog_migrated_${sub.id}`;
      const artifactsJson = JSON.stringify({
        legacy_submission_id: sub.id,
        original_scenario_id: sub.scenario_id,
        evaluation: parsedEval
      });

      const res = insertStmt.run(
        ledgerId,
        sub.user_id || 'default_user',
        canonicalId,
        studioStage,
        status,
        score,
        artifactsJson,
        sub.created_at || new Date().toISOString(),
        sub.created_at || new Date().toISOString()
      );

      if (res.changes > 0) {
        migratedCount++;
      } else {
        skippedCount++;
      }
    }
  });

  tx(submissions);

  const finalLedgerCount = (db.prepare('SELECT COUNT(*) as c FROM user_progress_ledger').get() as any).c;
  console.log(`✅ Migration complete:`);
  console.log(`   - Newly migrated: ${migratedCount}`);
  console.log(`   - Skipped / already existing: ${skippedCount}`);
  console.log(`   - Total ledger records now: ${finalLedgerCount}`);

  // Idempotency check: run tx again and verify changes === 0
  let idempotencyNewRecords = 0;
  const testTx = db.transaction((rows: any[]) => {
    for (const sub of rows) {
      const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(sub.scenario_id) as any;
      const canonicalId = aliasRow ? aliasRow.canonical_id : sub.scenario_id;
      const manifestRow = db.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
      if (!manifestRow) continue;

      const ledgerId = `prog_migrated_${sub.id}`;
      const res = insertStmt.run(
        ledgerId,
        sub.user_id || 'default_user',
        canonicalId,
        'STUDIO_2_SIMULATION',
        'PASSED',
        80,
        '{}',
        new Date().toISOString(),
        new Date().toISOString()
      );
      if (res.changes > 0) idempotencyNewRecords++;
    }
  });
  testTx(submissions);

  if (idempotencyNewRecords > 0) {
    throw new Error(`❌ Idempotency failure: second pass inserted ${idempotencyNewRecords} records!`);
  }
  console.log(`🔒 Idempotency verified: 0 duplicate records inserted on second pass.`);

  // 4. Test with dummy legacy record to verify alias resolution & backfill
  console.log('\n🧪 Running End-to-End Migration Verification with Mock Legacy Submission...');
  const testSubId = `test_legacy_sub_${Date.now()}`;
  db.prepare(`
    INSERT INTO system_design_submissions (
      id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    testSubId,
    'hld-faded-01', // Legacy alias mapped to L4-DIST-LOCK-FENCING
    'test_user_migration',
    '{"nodes":[{"id":"n1"}],"edges":[]}',
    'Test notes',
    JSON.stringify({ totalScore: 88, verdict: 'HIRE' })
  );

  // Run migration pass
  const testRows = db.prepare(`SELECT * FROM system_design_submissions WHERE id = ?`).all(testSubId) as any[];
  tx(testRows);

  const migratedRow = db.prepare(`
    SELECT * FROM user_progress_ledger WHERE user_id = ? AND canonical_id = ?
  `).get('test_user_migration', 'L4-DIST-LOCK-FENCING') as any;

  if (!migratedRow) {
    throw new Error('❌ Failed to find migrated record in user_progress_ledger for L4-DIST-LOCK-FENCING!');
  }
  if (migratedRow.score !== 88 || migratedRow.status !== 'PASSED') {
    throw new Error(`❌ Migrated row has unexpected score or status: ${JSON.stringify(migratedRow)}`);
  }
  console.log(`✅ Verified: Mock legacy submission 'hld-faded-01' successfully migrated to canonical 'L4-DIST-LOCK-FENCING' (Score: ${migratedRow.score}, Status: ${migratedRow.status})`);

  // Clean up test data
  db.prepare(`DELETE FROM system_design_submissions WHERE id = ?`).run(testSubId);
  db.prepare(`DELETE FROM user_progress_ledger WHERE id = ?`).run(`prog_migrated_${testSubId}`);
  console.log('🧹 Cleaned up mock migration records cleanly.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate_legacy_progress.ts')) {
  runProgressMigration();
}

