/**
 * test_company_profile_schema.js
 * Verifies that company_profiles.json adheres to CompanyProfileSchema (TypeBox Value.Check)
 * and contains SSOT engineering dossier, readinessConfig, voicePreset & curatedChallenges invariants
 * (Issue #55 / SPEC-12, Issue #168 / SPEC-44).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Value } = require('@sinclair/typebox/value');

let sharedModule;
try {
  sharedModule = require('@interview-prep/shared');
} catch {
  sharedModule = require('../../shared/dist');
}

const { CompanyProfileSchema } = sharedModule;
assert.ok(CompanyProfileSchema, 'CompanyProfileSchema must be exported from @interview-prep/shared');

console.log('🧪 [TEST] Verifying CompanyProfileSchema & SSOT Manifest (Spec 12 + Spec 44)...');

const candidates = [
  path.resolve(process.cwd(), 'json/company_profiles.json'),
  path.resolve(__dirname, '../../json/company_profiles.json'),
  path.resolve(__dirname, '../../../json/company_profiles.json')
];

const profilesPath = candidates.find((c) => fs.existsSync(c));
assert.ok(profilesPath, 'company_profiles.json must be found');

const raw = fs.readFileSync(profilesPath, 'utf8');
const profiles = JSON.parse(raw);
assert.ok(Array.isArray(profiles) && profiles.length >= 2, 'Profiles must be a non-empty array with at least 2 companies');

// 0. Validate EVERY profile in company_profiles.json against compiled CompanyProfileSchema
for (const profile of profiles) {
  const isValid = Value.Check(CompanyProfileSchema, profile);
  if (!isValid) {
    const errors = [...Value.Errors(CompanyProfileSchema, profile)].map(
      (err) => `  - ${err.path}: ${err.message} (value=${JSON.stringify(err.value)})`
    );
    assert.fail(`Profile '${profile.id}' failed CompanyProfileSchema validation:\n${errors.join('\n')}`);
  }

  assert.ok(profile.readinessConfig, `Profile '${profile.id}' must define readinessConfig`);
  assert.ok(profile.voicePreset, `Profile '${profile.id}' must define voicePreset`);

  if (Array.isArray(profile.customQuickActionChips)) {
    for (const chip of profile.customQuickActionChips) {
      assert.strictEqual(
        typeof chip.promptMessage,
        'string',
        `Chip '${chip.id}' in '${profile.id}' must define promptMessage`
      );
      assert.ok(
        !Object.prototype.hasOwnProperty.call(chip, 'prompt'),
        `Chip '${chip.id}' in '${profile.id}' must not use deprecated 'prompt' key`
      );
    }
  }
}

const raif = profiles.find((p) => p.id === 'raiffeisen_dgtl');
assert.ok(raif, 'raiffeisen_dgtl profile must exist');

// 1. Raiffeisen DGTL Dossier & Manifest Verification
assert.ok(Array.isArray(raif.competencies) && raif.competencies.length === 9, 'Must contain exactly 9 PE competencies');
assert.ok(Array.isArray(raif.specReviewChecklist) && raif.specReviewChecklist.length === 8, 'Must contain exactly 8 spec review points');
assert.ok(Array.isArray(raif.starScenarios) && raif.starScenarios.length === 4, 'Must contain exactly 4 STAR scenarios');
assert.ok(raif.talentQGuide && raif.talentQGuide.deadlineHours === 72, 'talentQGuide with 72h deadline required');
assert.strictEqual(raif.talentQGuide.verbalRules.length, 3, '3 verbal rules required');
assert.ok(Array.isArray(raif.takeHomePrCases) && raif.takeHomePrCases.length === 3, 'Must contain 3 Take-Home PR cases');
assert.ok(
  raif.takeHomePrCases.every((pr) => pr.options.some((o) => o.isCorrect)),
  'Every Take-Home PR case must have at least one correct option'
);
assert.ok(
  Array.isArray(raif.expressRunbook.mustReviewTasks) && raif.expressRunbook.mustReviewTasks.length === 7,
  'Must have 7 review task links'
);
assert.ok(
  Array.isArray(raif.customQuickActionChips) && raif.customQuickActionChips.length === 4,
  '4 custom quick action chips required for raiffeisen_dgtl'
);
assert.strictEqual(raif.readinessConfig.theory.total, 20);
assert.deepStrictEqual(raif.readinessConfig.codeReview, { total: 2, idPrefixes: ['case_'] });
assert.deepStrictEqual(raif.readinessConfig.liveCoding, {
  total: 2,
  idPrefixes: ['iban-'],
  exactIds: ['lld-key-value-cache-ttl']
});
assert.deepStrictEqual(raif.readinessConfig.sql, { total: 5, idPrefixes: ['sql-raiff-'] });
assert.strictEqual(raif.readinessConfig.systemDesignTotal, 5);

// 2. Alfa Digital Dossier, Curated Challenges & Readiness Manifest Verification
const alfa = profiles.find((p) => p.id === 'alfa_digital');
assert.ok(alfa, 'alfa_digital profile must exist');
assert.strictEqual(alfa.stages.length, 5, 'alfa_digital must contain 5 pipeline stages');
assert.strictEqual(alfa.readinessConfig.questionCatalogFile, 'alfa_interview_questions.json');
assert.strictEqual(alfa.readinessConfig.theory.total, 27);
assert.deepStrictEqual(alfa.readinessConfig.codeReview, { total: 6, idPrefixes: ['cr-alfa-'] });
assert.deepStrictEqual(alfa.readinessConfig.liveCoding, {
  total: 5,
  idPrefixes: ['lc-alfa-'],
  exactIds: ['lld-key-value-cache-ttl']
});
assert.deepStrictEqual(alfa.readinessConfig.sql, { total: 7, idPrefixes: ['sql-alfa-'] });
assert.strictEqual(alfa.readinessConfig.systemDesignTotal, 5);
assert.ok(
  Array.isArray(alfa.curatedChallenges) && alfa.curatedChallenges.length === 11,
  'alfa_digital must contain 11 curatedChallenges'
);
assert.strictEqual(
  alfa.curatedChallenges.filter((c) => c.category === 'code_review').length,
  6,
  'alfa_digital must contain 6 curated code_review challenges'
);
assert.strictEqual(
  alfa.curatedChallenges.filter((c) => c.category === 'live_coding').length,
  5,
  'alfa_digital must contain 5 curated live_coding challenges'
);
assert.ok(
  Array.isArray(alfa.customQuickActionChips) && alfa.customQuickActionChips.length === 3,
  '3 custom quick action chips required for alfa_digital'
);

// 3. Negative Regression Checks (Schema fails on malformed prompt or invalid readinessConfig)
{
  const badChipProfile = JSON.parse(JSON.stringify(alfa));
  badChipProfile.customQuickActionChips = [
    { id: 'broken', label: 'Broken', prompt: 'legacy field instead of promptMessage' }
  ];
  assert.strictEqual(
    Value.Check(CompanyProfileSchema, badChipProfile),
    false,
    'Schema must reject customQuickActionChips missing promptMessage'
  );

  const badReadinessProfile = JSON.parse(JSON.stringify(alfa));
  badReadinessProfile.readinessConfig.theory.total = 0;
  assert.strictEqual(
    Value.Check(CompanyProfileSchema, badReadinessProfile),
    false,
    'Schema must reject readinessConfig with total < 1'
  );

  const badVoiceProfile = JSON.parse(JSON.stringify(raif));
  badVoiceProfile.voicePreset.systemPrompt = '';
  assert.strictEqual(
    Value.Check(CompanyProfileSchema, badVoiceProfile),
    false,
    'Schema must reject voicePreset with empty systemPrompt'
  );
}

console.log('✅ [TEST PASSED] All CompanyProfiles validated via TypeBox CompanyProfileSchema with 0 defects.');
