/**
 * Pre-Flight Verification Test for Starter Workspaces Integrity (SPEC-15)
 * Enforces the Zero-Stillborn Starter Invariant across all 132 practice katas:
 * 1. Machine Coding: Student-editable files must be TDD stubs (throw UnsupportedOperationException / TODO).
 * 2. Raiffeisen Track: sparse-vector must be a stub; code review katas must preserve interview defects.
 * 3. Mutation Katas: Starter tests must leave target mutants alive (surviving mutants invariant).
 *
 * Cognitive limit: <= 350 lines.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MC_JSON_PATH = path.join(ROOT_DIR, 'json/machine_coding_challenges.json');
const REF_JSON_PATH = path.join(ROOT_DIR, 'json/refactoring_challenges.json');
const ADD_TS_PATH = path.join(ROOT_DIR, 'backend/src/services/additionalChallenges.ts');
const MUT_DIR = path.join(ROOT_DIR, 'backend/src/services/mutationChallenges');

const filterArg = process.argv.find(a => a.startsWith('--filter='))?.split('=')[1]?.toLowerCase();

console.log('========================================================================');
console.log('🧪 VERIFY STARTER WORKSPACES INTEGRITY (SPEC-15 ZERO-STILLBORN SUITE)');
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

// 1. Audit Raiffeisen Track
if (!filterArg || filterArg === 'raiffeisen') {
  console.log('--- 1. Raiffeisen Track Katas ---');
  if (fs.existsSync(MC_JSON_PATH)) {
    const mc = JSON.parse(fs.readFileSync(MC_JSON_PATH, 'utf-8'));
    for (const c of mc) {
      if (c.id === 'iban-validator' || c.id === 'sparse-vector') {
        const editable = c.workspaceFiles?.filter(f => !f.readOnly) || [];
        const hasStub = editable.some(f => (f.content || '').includes('UnsupportedOperationException'));
        recordCheck(c.id, hasStub, 'Starter code must throw UnsupportedOperationException');
      }
    }
  }

  if (fs.existsSync(REF_JSON_PATH)) {
    const ref = JSON.parse(fs.readFileSync(REF_JSON_PATH, 'utf-8'));
    for (const c of ref) {
      if (c.id === 'case_transfer_service') {
        const editable = c.workspaceFiles?.find(f => !f.readOnly);
        const content = editable?.content || '';
        // Bug preservation: MUST NOT have correct deterministic lock ordering
        const hasDeadlockBug = !content.includes('Math.min(fromAccountId, toAccountId)');
        recordCheck(c.id, hasDeadlockBug, 'Starter code must preserve concurrency deadlock bug (unsorted locks)');
      }
      if (c.id === 'case_account_collections') {
        const editable = c.workspaceFiles?.find(f => !f.readOnly);
        const content = editable?.content || '';
        // Bug preservation: MUST have TreeMap or double or java.snippet.account
        const hasBugs = content.includes('TreeMap') || content.includes('double balance') || content.includes('snippet.account');
        recordCheck(c.id, hasBugs, 'Starter code must preserve TreeMap/double balance anti-patterns');
      }
    }
  }
}

// 1.1 Audit Alfa Digital Track
if (!filterArg || filterArg === 'alfa') {
  console.log('--- 1.1 Alfa Digital Track Katas ---');
  if (fs.existsSync(MC_JSON_PATH)) {
    const mc = JSON.parse(fs.readFileSync(MC_JSON_PATH, 'utf-8'));
    for (const c of mc) {
      if (c.id.startsWith('lc-alfa-')) {
        const editable = c.workspaceFiles?.filter(f => !f.isReadOnly && !f.readOnly) || [];
        const hasStub = editable.some(f => (f.content || '').includes('UnsupportedOperationException'));
        recordCheck(c.id, hasStub, 'Live coding starter code must throw UnsupportedOperationException (Zero-Stillborn)');
      }
    }
  }

  if (fs.existsSync(REF_JSON_PATH)) {
    const ref = JSON.parse(fs.readFileSync(REF_JSON_PATH, 'utf-8'));
    for (const c of ref) {
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
}

// 2. Audit Legacy Machine Coding (mc_*)
if (!filterArg || filterArg === 'mc') {
  console.log('\n--- 2. Legacy Machine Coding Katas (mc_*) ---');
  if (fs.existsSync(ADD_TS_PATH)) {
    const content = fs.readFileSync(ADD_TS_PATH, 'utf-8');
    // Extract each challenge block
    const idMatches = [...content.matchAll(/id:\s*['"](mc_[^'"]+)['"]/g)];
    for (const match of idMatches) {
      const challengeId = match[1];
      const startIdx = match.index;
      const nextMatch = content.indexOf('id: \'', startIdx + 10);
      const block = content.slice(startIdx, nextMatch === -1 ? undefined : nextMatch);

      // Check if student editable java file throws UnsupportedOperationException
      const hasStub = block.includes('UnsupportedOperationException');
      recordCheck(challengeId, hasStub, 'Starter code in additionalChallenges.ts must throw UnsupportedOperationException');
    }
  }
}

// 3. Audit Mutation Katas (TST-01..TST-42)
if (!filterArg || filterArg === 'mutation') {
  console.log('\n--- 3. Mutation Testing Katas (Surviving Mutants Invariant) ---');
  if (fs.existsSync(MUT_DIR)) {
    const files = fs.readdirSync(MUT_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    for (const file of files) {
      const content = fs.readFileSync(path.join(MUT_DIR, file), 'utf-8');
      const kataMatches = [...content.matchAll(/id:\s*['"]((?:kata_|mut_)[^'"]+)['"]/g)];
      for (const km of kataMatches) {
        const kataId = km[1];
        const startIdx = km.index;
        const nextIdx = content.indexOf('id: \'', startIdx + 10);
        const kataBlock = content.slice(startIdx, nextIdx === -1 ? undefined : nextIdx);

        // Find the starter test file content
        const testMatch = kataBlock.match(/path:\s*['"][^'"]*Test\.java['"][\s\S]*?content:\s*`([\s\S]*?)`/);
        if (testMatch) {
          const testContent = testMatch[1];
          // Invariant: starter test must have incomplete assertions or TODO hints so mutants survive
          const hasIncompleteStarter = testContent.includes('// TODO') ||
                                       testContent.includes('assertThat(true).isTrue()') ||
                                       testContent.includes('// Act & Assert (candidate implementation needed)') ||
                                       testContent.includes('// Add mutant-killing assertions') ||
                                       !testContent.includes('assertThat');
          recordCheck(kataId, hasIncompleteStarter, 'Starter test file must NOT kill all mutants out-of-the-box (must contain TODO / incomplete assertions)');
        }
      }
    }
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
  console.log('\n✅ All audited starter workspaces satisfy the Zero-Stillborn Invariant!');
  process.exit(0);
}
