/**
 * test_catalog_path_resolver.js
 * Verifies that JSON catalog paths are resolved robustly in both source and dist environments.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 VERIFYING CATALOG PATH RESOLVER...');

function resolveJsonCatalogPath(filename, mockDirname, mockCwd) {
  const currentDir = mockDirname || __dirname;
  const cwd = mockCwd || process.cwd();

  const candidates = [
    path.resolve(cwd, 'json', filename),
    path.resolve(cwd, '../json', filename),
    path.resolve(currentDir, '../../json', filename),
    path.resolve(currentDir, '../../../json', filename),
    path.resolve(currentDir, '../../../../json', filename),
    path.join('/app/json', filename),
    path.join('/json', filename)
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {}
  }
  return candidates[0];
}

// 1. Resolve from current repo root
const companyPath = resolveJsonCatalogPath('company_profiles.json');
assert.ok(fs.existsSync(companyPath), `company_profiles.json must be found at ${companyPath}`);
const profiles = JSON.parse(fs.readFileSync(companyPath, 'utf-8'));
assert.ok(Array.isArray(profiles), 'company_profiles.json must be an array');
assert.ok(profiles.some(p => p.id === 'raiffeisen_dgtl'), 'Must contain raiffeisen_dgtl profile');

// 2. Resolve SQL challenges
const sqlPath = resolveJsonCatalogPath('sql_challenges.json');
assert.ok(fs.existsSync(sqlPath), `sql_challenges.json must be found at ${sqlPath}`);
const challenges = JSON.parse(fs.readFileSync(sqlPath, 'utf-8'));
assert.ok(Array.isArray(challenges), 'sql_challenges.json must be an array');
assert.strictEqual(challenges.length, 10, 'Must contain exactly 10 PostgreSQL challenges');

// 3. Simulate dist/routes directory structure
const repoRoot = path.resolve(__dirname, '..');
const simulatedDistRoutes = path.join(repoRoot, 'dist', 'routes');
const resolvedFromDist = resolveJsonCatalogPath('company_profiles.json', simulatedDistRoutes, repoRoot);
assert.ok(fs.existsSync(resolvedFromDist), `Must resolve correctly when called from dist/routes: ${resolvedFromDist}`);

console.log('✅ Catalog path resolver verified successfully across all environments.');
