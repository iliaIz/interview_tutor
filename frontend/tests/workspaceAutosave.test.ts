/**
 * workspaceAutosave.test.ts
 * Unit & Contract tests for Practice Workspace Draft Persistence and Resolution.
 * Tests Tier 1 LocalStorage, LRU index eviction, Transaction Lab storage, and timestamp resolution.
 */

import assert from 'assert';

// Mock localStorage for Node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0
  } as any;
}

import {
  saveLocalDraft,
  getLocalDraft,
  removeLocalDraft,
  hasLocalDraft
} from '../src/services/practiceDraftStorage';
import {
  saveTxLabLocalDraft,
  getTxLabLocalDraft,
  removeTxLabLocalDraft
} from '../src/services/transactionLabDraftStorage';

console.log('🧪 Running Workspace Autosave & Draft Persistence Contract Tests...');

// Test 1: Save and Retrieve Practice Local Draft
console.log('\n[Test 1] Practice Local Draft Tier 1 Persistence');
localStorage.clear();

const testFiles = [
  { path: 'src/main/java/Solution.java', content: 'public class Solution { int x = 42; }', isMainEntryPoint: true },
  { path: 'src/test/java/SolutionTest.java', content: '@Test void test() {}', readOnly: true }
];

const saved = saveLocalDraft('lld-parking-lot', testFiles, 1, 0);
assert.strictEqual(saved, true, 'saveLocalDraft must return true on valid input');
assert.strictEqual(hasLocalDraft('lld-parking-lot'), true, 'hasLocalDraft must be true');

const retrieved = getLocalDraft('lld-parking-lot');
assert.ok(retrieved, 'getLocalDraft must return saved draft');
assert.strictEqual(retrieved?.challengeId, 'lld-parking-lot');
assert.strictEqual(retrieved?.files.length, 2);
assert.strictEqual(retrieved?.files[0].content, 'public class Solution { int x = 42; }');
assert.strictEqual(retrieved?.activePhase, 1);
assert.ok(retrieved?.updatedAt && retrieved.updatedAt > 0, 'updatedAt must be positive timestamp');
console.log('  ✅ Local draft saved and retrieved intact');

// Test 2: Draft Removal
console.log('\n[Test 2] Draft Removal on Reset');
removeLocalDraft('lld-parking-lot');
assert.strictEqual(hasLocalDraft('lld-parking-lot'), false, 'Draft must be cleared');
assert.strictEqual(getLocalDraft('lld-parking-lot'), null, 'getLocalDraft must return null');
console.log('  ✅ Draft removal verified');

// Test 3: LRU Eviction of Old Drafts (Bound to 15 entries)
console.log('\n[Test 3] LRU Eviction Limit (Max 15 Drafts)');
localStorage.clear();

for (let i = 1; i <= 20; i++) {
  saveLocalDraft(`challenge-${i}`, [{ path: 'Test.java', content: `// Task ${i}` }], 1, 0);
}

// Challenges 1 to 5 should have been evicted
for (let i = 1; i <= 5; i++) {
  assert.strictEqual(hasLocalDraft(`challenge-${i}`), false, `challenge-${i} should be evicted by LRU`);
}
// Challenges 6 to 20 should be present
for (let i = 6; i <= 20; i++) {
  assert.strictEqual(hasLocalDraft(`challenge-${i}`), true, `challenge-${i} must be preserved`);
}
console.log('  ✅ LRU bound to 15 drafts verified, preventing storage exhaustion');

// Test 4: Transaction Lab Draft Persistence
console.log('\n[Test 4] Transaction Lab Draft Persistence');
localStorage.clear();

const userConfigs = {
  'OrderService#createOrder': { propagation: 'REQUIRED' as const, isolation: 'READ_COMMITTED' as const },
  'PaymentService#processPayment': { propagation: 'REQUIRES_NEW' as const }
};

saveTxLabLocalDraft('self_invocation_bypass', userConfigs, 4);
const txDraft = getTxLabLocalDraft('self_invocation_bypass');
assert.ok(txDraft, 'Transaction draft must exist');
assert.strictEqual(txDraft?.scenarioId, 'self_invocation_bypass');
assert.strictEqual(txDraft?.threads, 4);
assert.strictEqual(txDraft?.userConfigs['OrderService#createOrder']?.propagation, 'REQUIRED');

removeTxLabLocalDraft('self_invocation_bypass');
assert.strictEqual(getTxLabLocalDraft('self_invocation_bypass'), null, 'Tx draft cleared on reset');
console.log('  ✅ Transaction Lab draft saved and cleared successfully');

// Test 5: Resolution Strategy (Local vs Server Timestamp Ordering)
console.log('\n[Test 5] Resolution Strategy (Local vs Remote Conflict Resolution)');
const now = Date.now();
const localTimeNewer = now;
const serverTimeOlder = now - 60_000;

function resolveDraft(local: { updatedAt: number; files: any[] } | null, server: { updatedAt: number; files: any[] } | null, starter: any[]) {
  if (local && server) {
    return local.updatedAt >= server.updatedAt ? local.files : server.files;
  }
  if (local) return local.files;
  if (server) return server.files;
  return starter;
}

const localFiles = [{ path: 'A.java', content: '// local newer' }];
const serverFiles = [{ path: 'A.java', content: '// server older' }];
const starterFiles = [{ path: 'A.java', content: '// starter' }];

const chosen = resolveDraft(
  { updatedAt: localTimeNewer, files: localFiles },
  { updatedAt: serverTimeOlder, files: serverFiles },
  starterFiles
);
assert.strictEqual(chosen[0].content, '// local newer', 'Newer local draft must take precedence');

const chosenServer = resolveDraft(
  { updatedAt: now - 100_000, files: localFiles },
  { updatedAt: now, files: serverFiles },
  starterFiles
);
assert.strictEqual(chosenServer[0].content, '// server older', 'Newer server draft must take precedence');

const chosenFallback = resolveDraft(null, null, starterFiles);
assert.strictEqual(chosenFallback[0].content, '// starter', 'Fallback to starter files when zero drafts');
console.log('  ✅ Conflict resolution logic verified');

console.log('\n🎉 ALL WORKSPACE AUTOSAVE & DRAFT TESTS PASSED SUCCESSFULLY!');
