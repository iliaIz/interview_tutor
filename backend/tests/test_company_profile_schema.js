/**
 * test_company_profile_schema.js
 * Verifies that company_profiles.json contains full SSOT engineering dossier artifacts
 * and adheres to CompanyProfileSchema invariants (Issue #55 / SPEC-12).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 [TEST] Verifying CompanyProfileSchema & SSOT Manifest (Issue #55)...');

const candidates = [
  path.resolve(process.cwd(), 'json/company_profiles.json'),
  path.resolve(__dirname, '../../json/company_profiles.json'),
  path.resolve(__dirname, '../../../json/company_profiles.json')
];

let profilesPath = candidates.find(c => fs.existsSync(c));
assert.ok(profilesPath, 'company_profiles.json must be found');

const raw = fs.readFileSync(profilesPath, 'utf8');
const profiles = JSON.parse(raw);
assert.ok(Array.isArray(profiles) && profiles.length > 0, 'Profiles must be a non-empty array');

const raif = profiles.find(p => p.id === 'raiffeisen_dgtl');
assert.ok(raif, 'raiffeisen_dgtl profile must exist');

// 1. Competencies Verification (9 items)
assert.ok(Array.isArray(raif.competencies), 'competencies must be an array');
assert.strictEqual(raif.competencies.length, 9, 'Must contain exactly 9 PE competencies');
for (const comp of raif.competencies) {
  assert.strictEqual(typeof comp.id, 'number', `Competency ID must be number: ${comp.title}`);
  assert.ok(comp.title && comp.title.length > 0, 'Title required');
  assert.ok(['engineering', 'product', 'quality_ai'].includes(comp.category), `Valid category required: ${comp.category}`);
  assert.ok(comp.categoryLabel, 'categoryLabel required');
  assert.ok(comp.iconName, 'iconName required');
  assert.ok(comp.techStack, 'techStack required');
  assert.ok(comp.description, 'description required');
  assert.ok(comp.interviewQuestion, 'interviewQuestion required');
  assert.ok(comp.barRaiserExpectation, 'barRaiserExpectation required');
}

// 2. Spec Review Checklist (8 items)
assert.ok(Array.isArray(raif.specReviewChecklist), 'specReviewChecklist must be an array');
assert.strictEqual(raif.specReviewChecklist.length, 8, 'Must contain exactly 8 spec review points');
for (const item of raif.specReviewChecklist) {
  assert.strictEqual(typeof item.id, 'number', `Spec item ID must be number: ${item.title}`);
  assert.ok(item.title, 'title required');
  assert.ok(item.tag, 'tag required');
  assert.ok(item.question, 'question required');
  assert.ok(item.deliverable, 'deliverable required');
  assert.ok(item.dangerIfMissing, 'dangerIfMissing required');
}

// 3. STAR Scenarios (4 items)
assert.ok(Array.isArray(raif.starScenarios), 'starScenarios must be an array');
assert.strictEqual(raif.starScenarios.length, 4, 'Must contain exactly 4 STAR scenarios');
for (const star of raif.starScenarios) {
  assert.strictEqual(typeof star.id, 'number', `STAR ID must be number: ${star.title}`);
  assert.ok(star.title, 'title required');
  assert.ok(star.tagline, 'tagline required');
  assert.ok(star.badge, 'badge required');
  assert.ok(star.interviewQuestion, 'interviewQuestion required');
  assert.ok(star.situation, 'situation required');
  assert.ok(star.task, 'task required');
  assert.ok(Array.isArray(star.action) && star.action.length > 0, 'action array required');
  assert.ok(star.result, 'result required');
  assert.ok(star.strongHireTakeaway, 'strongHireTakeaway required');
  assert.ok(star.redFlagToAvoid, 'redFlagToAvoid required');
}

// 4. Talent Q Guide
assert.ok(raif.talentQGuide, 'talentQGuide required');
assert.strictEqual(raif.talentQGuide.deadlineHours, 72, 'Deadline must be 72 hours');
assert.ok(raif.talentQGuide.warningTitle, 'warningTitle required');
assert.ok(raif.talentQGuide.formulaMarkdown, 'formulaMarkdown required');
assert.ok(Array.isArray(raif.talentQGuide.verbalRules) && raif.talentQGuide.verbalRules.length === 3, '3 verbal rules required');
assert.ok(Array.isArray(raif.talentQGuide.strategyTips) && raif.talentQGuide.strategyTips.length > 0, 'strategyTips required');

// 5. Take-Home PR Cases (3 items)
assert.ok(Array.isArray(raif.takeHomePrCases), 'takeHomePrCases must be an array');
assert.strictEqual(raif.takeHomePrCases.length, 3, 'Must contain 3 Take-Home PR cases');
for (const pr of raif.takeHomePrCases) {
  assert.ok(pr.id, 'PR id required');
  assert.ok(pr.prNumber, 'prNumber required');
  assert.ok(pr.flawCategory, 'flawCategory required');
  assert.ok(pr.codeSnippet, 'codeSnippet required');
  assert.ok(Array.isArray(pr.options) && pr.options.length >= 2, 'options array required');
  assert.ok(pr.options.some(o => o.isCorrect), 'At least one correct option required');
  assert.ok(pr.canonicalFixSql, 'canonicalFixSql required');
}

// 6. Typed Must Review Tasks
assert.ok(Array.isArray(raif.expressRunbook.mustReviewTasks), 'mustReviewTasks required in expressRunbook');
assert.strictEqual(raif.expressRunbook.mustReviewTasks.length, 7, 'Must have 7 review task links');
for (const task of raif.expressRunbook.mustReviewTasks) {
  assert.ok(task.taskId, 'taskId required');
  assert.ok(task.title, 'title required');
  assert.ok(['practice', 'incidents', 'system_design', 'sql_arena', 'voice_modal', 'take_home'].includes(task.targetArena), `Valid targetArena required for ${task.taskId}`);
}

// 7. Custom Quick Action Chips
assert.ok(Array.isArray(raif.customQuickActionChips), 'customQuickActionChips required');
assert.strictEqual(raif.customQuickActionChips.length, 4, '4 custom quick action chips required');

console.log('✅ [TEST PASSED] CompanyProfileSchema & SSOT Manifest verified with 0 defects.');
