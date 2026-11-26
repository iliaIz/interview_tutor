/**
 * Pre-Flight Verification Test for Starter Workspaces Integrity (SPEC-15 / SPEC-57)
 * Enforces TypeBox CodingChallengeSchema parity and Zero-Stillborn Starter Invariants across JSON catalogs:
 * 1. Machine Coding & Alfa Digital: Student-editable files must be TDD stubs (throw UnsupportedOperationException).
 * 2. Raiffeisen Track: sparse-vector must be a stub; code review katas must preserve interview defects.
 * 3. Mutation Katas: Starter tests must leave target mutants alive (surviving mutants invariant).
 *
 * Works before or after `backend` TypeScript build (reads root `json/` and `@interview-prep/shared` directly).
 * Cognitive limit: <= 350 lines.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let sharedModule;
try {
  sharedModule = require('@interview-prep/shared');
} catch {
  sharedModule = require('../../shared/dist');
}
const { Value, CodingChallengeSchema } = sharedModule;

const ROOT_DIR = path.resolve(__dirname, '../..');
const MC_JSON_PATH = path.join(ROOT_DIR, 'json/machine_coding_challenges.json');
const REF_JSON_PATH = path.join(ROOT_DIR, 'json/refactoring_challenges.json');
const BASE_JSON_PATH = path.join(ROOT_DIR, 'json/base_challenges.json');
const ADD_LLD_JSON_PATH = path.join(ROOT_DIR, 'json/additional_lld_challenges.json');
const MUT_JSON_PATH = path.join(ROOT_DIR, 'json/mutation_challenges.json');

const filterArg = process.argv.find(a => a.startsWith('--filter='))?.split('=')[1]?.toLowerCase();

console.log('========================================================================');
console.log('🧪 VERIFY STARTER WORKSPACES INTEGRITY (SPEC-15 + SPEC-57 JSON SUITE)');
console.log('========================================================================\n');

let totalChecked = 0;
const failures = [];

function recordCheck(id, pass, reason) {
  totalChecked++;
  if (!pass) {
    failures.push({ id, reason });
    console.error(`  ✗ [FAIL] ${id}: ${reason}`);
  } else {
    console.log(`  ✓ [PASS] ${id}`);
  }
}

function loadAndValidateJsonCatalog(filePath, label) {
  assert.ok(fs.existsSync(filePath), `Missing JSON catalog: ${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.ok(Array.isArray(parsed), `${label} must be a JSON array`);
  for (const item of parsed) {
    if (!Value.Check(CodingChallengeSchema, item)) {
      const firstErr = Value.Errors(CodingChallengeSchema, item).First();
      assert.fail(
        `[CodingChallengeSchema] Invalid challenge '${item?.id ?? 'unknown'}' in ${label} at ${firstErr?.path ?? ''}: ${firstErr?.message ?? 'validation failed'}`
      );
    }
  }
  return parsed;
}

const mcChallenges = (!filterArg || filterArg === 'raiffeisen' || filterArg === 'alfa')
  ? loadAndValidateJsonCatalog(MC_JSON_PATH, 'machine_coding_challenges.json')
  : [];
const refChallenges = (!filterArg || filterArg === 'raiffeisen' || filterArg === 'alfa')
  ? loadAndValidateJsonCatalog(REF_JSON_PATH, 'refactoring_challenges.json')
  : [];

// 1. Audit Raiffeisen Track
if (!filterArg || filterArg === 'raiffeisen') {
  console.log('--- 1. Raiffeisen Track Katas ---');
  for (const c of mcChallenges) {
    if (c.id === 'iban-validator' || c.id === 'sparse-vector') {
      const editable = c.workspaceFiles?.filter(f => !f.readOnly && !f.isReadOnly) || [];
      const hasStub = editable.some(f => (f.content || '').includes('UnsupportedOperationException'));
      recordCheck(c.id, hasStub, 'Starter code must throw UnsupportedOperationException');
    }
  }

  for (const c of refChallenges) {
    if (c.id === 'case_transfer_service') {
      const editable = c.workspaceFiles?.find(f => !f.readOnly && !f.isReadOnly);
      const content = editable?.content || '';
      const hasDeadlockBug = !content.includes('Math.min(fromAccountId, toAccountId)');
      recordCheck(c.id, hasDeadlockBug, 'Starter code must preserve concurrency deadlock bug (unsorted locks)');
    }
    if (c.id === 'case_account_collections') {
      const editable = c.workspaceFiles?.find(f => !f.readOnly && !f.isReadOnly);
      const content = editable?.content || '';
      const hasBugs = content.includes('TreeMap') || content.includes('double balance') || content.includes('snippet.account');
      recordCheck(c.id, hasBugs, 'Starter code must preserve TreeMap/double balance anti-patterns');
    }
  }
}

// 1.1 Audit Alfa Digital Track
if (!filterArg || filterArg === 'alfa') {
  console.log('--- 1.1 Alfa Digital Track Katas ---');
  for (const c of mcChallenges) {
    if (c.id.startsWith('lc-alfa-')) {
      const editable = c.workspaceFiles?.filter(f => !f.isReadOnly && !f.readOnly) || [];
      const hasStub = editable.some(f => (f.content || '').includes('UnsupportedOperationException'));
      recordCheck(c.id, hasStub, 'Live coding starter code must throw UnsupportedOperationException (Zero-Stillborn)');
    }
  }

  for (const c of refChallenges) {
    if (c.id === 'cr-alfa-01') {
      const editable = c.workspaceFiles?.find(f => !f.isReadOnly && !f.readOnly);
      const content = editable?.content || '';
      const hasBugs = content.includes('double amount') && content.includes('static Map');
      recordCheck(c.id, hasBugs, 'Starter code must preserve PaymentController defects');
    }
    if (c.id === 'cr-alfa-05') {
      const editable = c.workspaceFiles?.find(f => !f.isReadOnly && !f.readOnly);
      const content = editable?.content || '';
      const hasEagerBug = content.includes('FetchType.EAGER');
      recordCheck(c.id, hasEagerBug, 'Starter code must preserve Hibernate EAGER defect');
    }
  }
}

// 2. Audit Legacy Machine Coding (mc_*) & Base JSON Catalog
if (!filterArg || filterArg === 'mc') {
  console.log('\n--- 2. Legacy Machine Coding Katas (mc_*) & Base Catalog ---');
  const baseChallenges = loadAndValidateJsonCatalog(BASE_JSON_PATH, 'base_challenges.json');
  assert.strictEqual(baseChallenges.length, 7, 'base_challenges.json must contain 7 challenges');
  for (const c of baseChallenges) {
    const hasWorkspace = Array.isArray(c.workspaceFiles) && c.workspaceFiles.length > 0;
    recordCheck(c.id, hasWorkspace, 'Base challenge must contain non-empty workspaceFiles');
  }

  const additionalLld = loadAndValidateJsonCatalog(ADD_LLD_JSON_PATH, 'additional_lld_challenges.json');
  assert.strictEqual(additionalLld.length, 13, 'additional_lld_challenges.json must contain 13 challenges');
  for (const c of additionalLld) {
    if (c.id.startsWith('mc_')) {
      const editable = c.workspaceFiles?.filter(f => !f.readOnly && !f.isReadOnly) || [];
      const hasStub = editable.some(f => (f.content || '').includes('UnsupportedOperationException'));
      recordCheck(c.id, hasStub, 'Starter code in additional_lld_challenges.json must throw UnsupportedOperationException');
    }
  }
}

// 3. Audit Mutation Katas (TST-01..TST-42)
if (!filterArg || filterArg === 'mutation') {
  console.log('\n--- 3. Mutation Testing Katas (Surviving Mutants Invariant) ---');
  const mutChallenges = loadAndValidateJsonCatalog(MUT_JSON_PATH, 'mutation_challenges.json');
  assert.strictEqual(mutChallenges.length, 42, 'mutation_challenges.json must contain 42 challenges');

  for (const c of mutChallenges) {
    const testFiles = (c.workspaceFiles || []).filter(f => f.path && f.path.endsWith('Test.java'));
    if (testFiles.length === 0) {
      recordCheck(c.id, false, 'Mutation kata must contain a *Test.java file in workspaceFiles');
      continue;
    }
    const testContent = testFiles.map(f => f.content || '').join('\n');
    const hasIncompleteStarter = testContent.includes('// TODO') ||
                                 testContent.includes('assertThat(true).isTrue()') ||
                                 testContent.includes('// Act & Assert (candidate implementation needed)') ||
                                 testContent.includes('// Add mutant-killing assertions') ||
                                 !testContent.includes('assertThat');
    recordCheck(c.id, hasIncompleteStarter, 'Starter test file must NOT kill all mutants out-of-the-box (must contain TODO / incomplete assertions)');
  }
}

// 4. Summary & Exit Code
console.log('\n========================================================================');
console.log(`SUMMARY: Checked ${totalChecked} challenges.`);
console.log(`Passed: ${totalChecked - failures.length}, Failed: ${failures.length}`);
console.log('========================================================================');

if (failures.length > 0) {
  console.error('\nIntegrity violations detected:');
  failures.forEach(f => console.error(`  - ${f.id}: ${f.reason}`));
  process.exit(1);
} else {
  console.log('\n✅ All audited starter workspaces satisfy the Zero-Stillborn & CodingChallengeSchema Invariants!');
  process.exit(0);
}
