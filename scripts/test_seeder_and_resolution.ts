import { db, seedNextGenCatalogs } from '../backend/dist/services/db.js';
import { resolveScenarioManifest } from '../backend/dist/routes/systemDesign.js';

console.log('--- Testing Seeder and Dual-Key Alias Resolution ---');

// 1. Run Seeder
seedNextGenCatalogs();

// 2. Query Counts
const manifestCount = (db.prepare('SELECT COUNT(*) as count FROM system_design_manifests').get() as any).count;
const aliasCount = (db.prepare('SELECT COUNT(*) as count FROM system_design_aliases').get() as any).count;

console.log(`\nSQLite Database State:`);
console.log(`- system_design_manifests: ${manifestCount} rows`);
console.log(`- system_design_aliases:   ${aliasCount} rows`);

if (manifestCount !== 26) {
  console.error(`❌ Expected 26 manifests, got ${manifestCount}`);
  process.exit(1);
}

if (aliasCount < 82) {
  console.error(`❌ Expected at least 82 aliases, got ${aliasCount}`);
  process.exit(1);
}

// 3. Test Dual-Key Resolution on Key Historic Roadmap IDs
const testKeys = [
  'L3-PERF-HIKARICP-STARVATION', // Direct Canonical ID
  'hld-micro-01',                // Alias to L3-PERF-HIKARICP-STARVATION
  'hld-faded-01',                // Alias to L3-PERF-HIKARICP-STARVATION
  'hld-faded-03',                // Alias to L4-DIST-KAFKA-REBALANCE-LAG
  'hld-micro-02',                // Alias to L3-PERF-CACHE-STAMPEDE
  'hld-scenario-01',             // Alias to L4-DIST-IDEMPOTENT-OUTBOX
  'hld-scenario-05',             // Alias to L5-DIST-SYS-001
  'FIN-CELL-8092',               // Tier 4 Staff Principal
  'hld-scenario-18',             // Alias to Tier 4
];

console.log(`\nTesting Resolution for ${testKeys.length} keys:`);
for (const key of testKeys) {
  const manifest = resolveScenarioManifest(key);
  if (!manifest) {
    console.error(`❌ FAILED to resolve key '${key}'!`);
    process.exit(1);
  }
  console.log(`  ✅ Key '${key}' resolved to Canonical ID '${manifest.canonical_id}' (${manifest.title})`);
}

console.log('\n🎉 ALL TESTS PASSED! Seeder, SQLite dual-key resolution, and backward compatibility are 100% operational.');
