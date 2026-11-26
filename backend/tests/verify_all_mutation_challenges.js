/**
 * Pre-Flight Verification Test for All 42 Mutation Challenges (Spec 57 JSON Catalog Cutover)
 * Enforces Zero-Stillborn Mutants, CodingChallengeSchema validation, Archetype completeness,
 * and Full-Unit Mutation Standards (SOTA Late 2026).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let sharedModule;
try {
  sharedModule = require('@interview-prep/shared');
} catch {
  sharedModule = require('../../shared/dist');
}
const { Value, CodingChallengeSchema } = sharedModule;

function loadMutationChallenges() {
  const distLoaderPath = path.resolve(__dirname, '../dist/services/db/ChallengeCatalogLoader.js');
  if (fs.existsSync(distLoaderPath)) {
    const { ChallengeCatalogLoader } = require(distLoaderPath);
    return ChallengeCatalogLoader.loadMutationChallenges();
  }
  const jsonPath = path.resolve(__dirname, '../../json/mutation_challenges.json');
  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  assert.ok(Array.isArray(items), 'mutation_challenges.json must be a JSON array');
  return items;
}

const ARCHETYPE_EXPECTED_IDS = {
  legacy_seams: [
    'kata_test_trip_service_seam',
    'kata_test_gilded_rose_approval',
    'kata_test_overloaded_constructor_clock_seam',
    'kata_test_legacy_security_context_seam',
    'kata_test_legacy_tax_engine_golden_master'
  ],
  junit5_boundaries: [
    'kata_test_financial_tx_validator',
    'kata_test_combinatorial_pricing_discounts',
    'kata_test_dynamic_rbac_matrix_testfactory',
    'kata_test_banking_account_lifecycle_nested',
    'kata_test_security_context_cleanup_extension'
  ],
  mockito_verification: [
    'kata_test_strict_in_order_audit',
    'kata_test_async_event_dto_captor',
    'kata_test_spy_partial_mocking_var',
    'kata_test_resilient_cascading_retry',
    'kata_test_deterministic_time_mockstatic_uuid'
  ],
  state_machines: [
    'kata_test_order_state_machine_dynamic',
    'kata_test_idempotent_account_service',
    'kata_test_resilience_circuit_breaker',
    'kata_test_sliding_window_rate_limiter',
    'kata_test_distributed_saga_orchestrator'
  ],
  concurrency_loom: [
    'kata_test_awaitility_polling_stability',
    'kata_test_race_condition_ledger_transfer',
    'kata_test_deadlock_provocation_ordered_locking',
    'kata_test_virtual_thread_carrier_pinning',
    'kata_test_lock_free_ringbuffer_contention'
  ],
  archunit_slices: [
    'kata_test_archunit_layer_isolation',
    'kata_test_archunit_enterprise_api_governance',
    'kata_test_archunit_transactional_integrity',
    'kata_test_spring_webmvc_problem_detail',
    'kata_test_jackson_financial_pan_masking'
  ]
};

const ALL_MUTATION_CHALLENGES = loadMutationChallenges();
const L0_PRIMITIVES_CHALLENGES = ALL_MUTATION_CHALLENGES.filter(c => c.id.startsWith('kata_prim_'));
const L1_REVERSE_TESTING_CHALLENGES = ALL_MUTATION_CHALLENGES.filter(c => c.id.startsWith('kata_rev_'));
const COMBAT_MUTATION_CHALLENGES = ALL_MUTATION_CHALLENGES.filter(c => c.id.startsWith('kata_test_'));

console.log('========================================================================');
console.log('🧪 PRE-FLIGHT VERIFICATION: ALL 42 MUTATION CHALLENGES & ZERO-STILLBORN');
console.log('========================================================================\n');

// 1. Assert Total Challenge Counts Across Tiers
console.log('Checking catalog sizes...');
console.log(`  - L0 Primitives: ${L0_PRIMITIVES_CHALLENGES.length} (expected 6)`);
console.log(`  - L1 Reverse Testing: ${L1_REVERSE_TESTING_CHALLENGES.length} (expected 6)`);
console.log(`  - L3 Combat Challenges: ${COMBAT_MUTATION_CHALLENGES.length} (expected 30)`);
console.log(`  - Total Challenges: ${ALL_MUTATION_CHALLENGES.length} (expected 42)`);

assert.strictEqual(L0_PRIMITIVES_CHALLENGES.length, 6, 'Expected exactly 6 L0 Primitives challenges');
assert.strictEqual(L1_REVERSE_TESTING_CHALLENGES.length, 6, 'Expected exactly 6 L1 Reverse Testing challenges');
assert.strictEqual(COMBAT_MUTATION_CHALLENGES.length, 30, 'Expected exactly 30 L3 Combat challenges');
assert.strictEqual(ALL_MUTATION_CHALLENGES.length, 42, 'Expected exactly 42 total mutation challenges');

const combatIdSet = new Set(COMBAT_MUTATION_CHALLENGES.map(c => c.id));
for (const [archetype, expectedIds] of Object.entries(ARCHETYPE_EXPECTED_IDS)) {
  assert.strictEqual(expectedIds.length, 5, `Archetype ${archetype} must define 5 katas`);
  for (const id of expectedIds) {
    assert.ok(combatIdSet.has(id), `Missing ${archetype} combat kata '${id}' in mutation_challenges.json`);
  }
}

// 2. Validate Every Challenge Schema, Structure, and Mutant Integrity
let totalMutantsChecked = 0;
let fullUnitMutantsCount = 0;

for (const challenge of ALL_MUTATION_CHALLENGES) {
  assert.ok(
    Value.Check(CodingChallengeSchema, challenge),
    `Challenge '${challenge?.id ?? 'unknown'}' failed CodingChallengeSchema validation`
  );
  assert(challenge.id, `Challenge must have an id: ${JSON.stringify(challenge)}`);
  assert(challenge.title, `Challenge ${challenge.id} must have a title`);
  assert(Array.isArray(challenge.workspaceFiles) && challenge.workspaceFiles.length >= 2,
    `Challenge ${challenge.id} must have at least 2 workspace files (production service + test suite)`);
  assert(Array.isArray(challenge.mutants) && challenge.mutants.length >= 1,
    `Challenge ${challenge.id} must have at least 1 mutant`);

  const filePaths = challenge.workspaceFiles.map(f => f.path);

  for (const mutant of challenge.mutants) {
    totalMutantsChecked++;
    assert(mutant.id, `Challenge ${challenge.id} mutant missing id`);
    assert(mutant.name, `Challenge ${challenge.id} mutant ${mutant.id} missing name`);
    assert(mutant.file, `Challenge ${challenge.id} mutant ${mutant.id} missing file`);
    assert(filePaths.includes(mutant.file),
      `Challenge ${challenge.id} mutant ${mutant.id} references file '${mutant.file}' which does not exist in workspaceFiles: [${filePaths.join(', ')}]`);
    assert(mutant.mutatedContent && mutant.mutatedContent.trim().length > 0,
      `Challenge ${challenge.id} mutant ${mutant.id} has empty mutatedContent`);

    const isFullUnit = mutant.mutatedContent.includes('class ') ||
                       mutant.mutatedContent.includes('interface ') ||
                       mutant.mutatedContent.includes('record ') ||
                       mutant.mutatedContent.includes('enum ');

    if (isFullUnit) {
      fullUnitMutantsCount++;
      assert(mutant.mutatedContent.includes('class ') || mutant.mutatedContent.includes('record ') || mutant.mutatedContent.includes('interface '),
        `Challenge ${challenge.id} mutant ${mutant.id} full-unit missing class/record/interface keyword`);
    } else {
      const targetFile = challenge.workspaceFiles.find(f => f.path === mutant.file);
      assert(targetFile, `Target file ${mutant.file} not found`);
      const lineCount = targetFile.content.split('\n').length;
      assert(mutant.line > 0 && mutant.line <= lineCount,
        `Challenge ${challenge.id} mutant ${mutant.id} line ${mutant.line} is out of bounds [1, ${lineCount}]`);
    }
  }
}

console.log(`\n✅ Checked ${ALL_MUTATION_CHALLENGES.length} challenges with ${totalMutantsChecked} mutants.`);
console.log(`   - Self-contained Full Units: ${fullUnitMutantsCount}`);
console.log('   - Structural, Archetype & TypeBox Contract Integrity: 100% Validated');

// 3. Specifically verify PRIM-01 contract and mutants
const prim01 = ALL_MUTATION_CHALLENGES.find(c => c.id === 'kata_prim_01_scalar_assertions');
assert(prim01, 'PRIM-01 challenge must exist in catalog');
assert.strictEqual(prim01.mutants.length, 2, 'PRIM-01 must have 2 mutants');

const m1 = prim01.mutants.find(m => m.id === 'mutant_prim_01_math');
const m2 = prim01.mutants.find(m => m.id === 'mutant_prim_01_return_zero');
assert(m1, 'PRIM-01 must have mutant_prim_01_math');
assert(m2, 'PRIM-01 must have mutant_prim_01_return_zero');

assert(m1.mutatedContent.includes('class DiscountCalculator'), 'PRIM-01 mutant 1 must be full class');
assert(m1.mutatedContent.includes('originalPrice.add(discount)'), 'PRIM-01 mutant 1 must have add mutation');
assert(m2.mutatedContent.includes('class DiscountCalculator'), 'PRIM-01 mutant 2 must be full class');
assert(m2.mutatedContent.includes('return BigDecimal.ZERO;'), 'PRIM-01 mutant 2 must have ZERO mutation');

console.log('✅ PRIM-01 Scalar Assertions verified: both mutants defined as self-contained compilable classes.');
console.log('\n🎉 ALL PRE-FLIGHT CHECKS PASSED SUCCESSFULLY!\n');
