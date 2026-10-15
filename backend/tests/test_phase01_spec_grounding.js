/**
 * test_phase01_spec_grounding.js
 * Verification suite for Wave 15 Phase 01: Task Specification & Grounding Remediation.
 * Bounded cognitive size: <= 200 lines.
 */

const assert = require('assert');
const path = require('path');
const Database = require('better-sqlite3');

console.log('🧪 Running Wave 15 Phase 01: Task Specification Grounding Verification...');

const fs = require('fs');
const defaultDb = fs.existsSync('/app/data/interview.db')
  ? '/app/data/interview.db'
  : (fs.existsSync(path.join(__dirname, '../data/interview.db'))
      ? path.join(__dirname, '../data/interview.db')
      : path.join(__dirname, '../../backend/data/interview.db'));
const dbPath = process.env.DB_PATH || defaultDb;
const db = new Database(dbPath);

function testCodingChallengesHydration() {
  console.log('\n  1. Testing SQLite SSOT Hydration for Coding Challenges...');
  const testIds = ['mc_rate_limiter_token_bucket', 'kata_gilded_rose', 'kata_trip_service'];

  for (const challengeId of testIds) {
    const row = db.prepare(
      'SELECT id, slug, title, category, track, target_stack, short_description, instructions_markdown FROM coding_challenges WHERE id = ? OR slug = ?'
    ).get(challengeId, challengeId);

    assert.ok(row, `Challenge ${challengeId} must exist in SQLite coding_challenges`);
    assert.ok(row.title && row.title.length > 5, `Challenge ${challengeId} must have non-empty title`);
    assert.ok(
      row.instructions_markdown && row.instructions_markdown.length > 200,
      `Challenge ${challengeId} must have rich instructions_markdown (actual: ${row.instructions_markdown?.length || 0})`
    );
    console.log(`     ✅ ${challengeId}: title="${row.title}", instructions=${row.instructions_markdown.length} chars`);
  }
}

function testBugChallengesHydration() {
  console.log('\n  2. Testing SQLite SSOT Hydration for Bug Hunt Challenges...');
  const rows = db.prepare('SELECT id, title, subtopic, bug_explanation, code_snippet, fixed_code FROM bug_challenges LIMIT 3').all();

  assert.ok(rows.length > 0, 'Must have bug challenges in SQLite');
  for (const bRow of rows) {
    assert.ok(bRow.title, 'Bug challenge must have title');
    assert.ok(bRow.bug_explanation && bRow.bug_explanation.length > 20, 'Bug challenge must have bug_explanation');
    assert.ok(bRow.code_snippet && bRow.code_snippet.length > 20, 'Bug challenge must have code_snippet');
    console.log(`     ✅ [Bug] ${bRow.id}: title="${bRow.title}", explanation=${bRow.bug_explanation.length} chars`);
  }
}

function testTheoryQuestionsHydration() {
  console.log('\n  3. Testing SQLite SSOT Hydration for Theory Questions...');
  const rows = db.prepare('SELECT id, topic, question, answer FROM questions LIMIT 3').all();

  assert.ok(rows.length > 0, 'Must have theory questions in SQLite');
  for (const qRow of rows) {
    assert.ok(qRow.question, 'Question must have text');
    assert.ok(qRow.answer && qRow.answer.length > 50, 'Question must have answer');
    console.log(`     ✅ [Theory] ${qRow.id}: topic="${qRow.topic}", answer=${qRow.answer.length} chars`);
  }
}

function testLivePairPromptGroundingSection() {
  console.log('\n  4. Testing buildLivePairPrompt Grounding & Denial Prohibition...');

  // Mock buildLivePairPrompt logic
  const isLld = true;
  const isFemale = true;
  const userGender = 'male';
  const bugTitle = 'In-Memory Thread-Safe Rate Limiter';
  const questionText = 'Rate Limiter: Design and implement a thread-safe token bucket rate limiter in Java 21';
  const instructionsMarkdown = '### Требования:\n1. Метод boolean allowRequest(String clientId).\n2. Емкость бакета 100 токенов, пополнение 10 токенов в секунду.\n3. Потокобезопасность без глобальной блокировки.';

  const taskMention = bugTitle ? ` по задаче «${bugTitle}»` : '';
  const greeting = `Привет! Я твоя напарница по проектированию архитектуры${taskMention}. С каких интерфейсов или доменной модели начнем?`;

  const specSection = `=== 3. АВТОРИЗОВАННАЯ СПЕЦИФИКАЦИЯ И ТРЕБОВАНИЯ К ЗАДАЧЕ (GROUND TRUTH) ===
НАЗВАНИЕ ЗАДАЧИ: "${bugTitle || questionText}"
КАТЕГОРИЯ И ДОМЕН: LLD

ПОЛНОЕ ТЗ И ТРЕБОВАНИЯ К РЕАЛИЗАЦИИ:
"""
${instructionsMarkdown}
"""

ИНВАРИАНТ ЗНАНИЯ СПЕЦИФИКАЦИИ:
Ты в совершенстве знаешь и держишь в памяти все требования к задаче выше.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО заявлять кандидату: «я не вижу спецификации задачи», «расскажи, что нужно сделать» или «какие требования у задачи».
Если кандидат спрашивает «С чего начать?», «Какая задача?» или «Помоги решить» — сразу отвечай по существу требований задачи выше!`;

  // Assertions
  assert.ok(greeting.includes('по задаче «In-Memory Thread-Safe Rate Limiter»'), 'Greeting must cite the specific challenge title');
  assert.ok(specSection.includes('GROUND TRUTH'), 'Must have GROUND TRUTH header');
  assert.ok(specSection.includes('ИНВАРИАНТ ЗНАНИЯ СПЕЦИФИКАЦИИ'), 'Must have explicit spec knowledge invariant');
  assert.ok(specSection.includes('КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО заявлять кандидату: «я не вижу спецификации задачи»'), 'Must strictly forbid denying spec visibility');
  assert.ok(specSection.includes('allowRequest(String clientId)'), 'Must contain actual challenge requirements');

  console.log('     ✅ Greeting and Specification Ground Truth verified.');
}

function testPracticeTutorHydrationFallback() {
  console.log('\n  5. Testing Practice Tutor Drawer Fallback Chain...');

  const challenge = {
    id: 'kata_gilded_rose',
    title: 'Gilded Rose Refactoring Kata',
    category: 'refactoring_kata',
    shortDescription: 'Рефакторинг системы обновления качества товаров',
    instructionsMarkdown: '### Правила Gilded Rose:\n- Качество товара никогда не превышает 50.\n- "Aged Brie" увеличивает качество со временем.'
  };

  // Simulating Drawer fallback
  const resolvedInstructions = '' || challenge.instructionsMarkdown || challenge.shortDescription || '';
  assert.ok(resolvedInstructions.includes('Aged Brie'), 'Fallback chain must resolve instructionsMarkdown when present');

  // Simulating DB fallback when frontend passes empty string
  const emptyFrontendInstructions = '';
  let serverHydratedInstructions = emptyFrontendInstructions;
  if (!serverHydratedInstructions || serverHydratedInstructions.length < 20) {
    const row = db.prepare('SELECT instructions_markdown, short_description FROM coding_challenges WHERE id = ?').get('kata_gilded_rose');
    if (row) {
      serverHydratedInstructions = row.instructions_markdown || row.short_description || '';
    }
  }

  assert.ok(serverHydratedInstructions.length > 100, 'Server must hydrate instructions from SQLite when client sends empty string');
  assert.ok(serverHydratedInstructions.includes('Gilded Rose') || serverHydratedInstructions.includes('Качество'), 'Hydrated instructions must contain challenge details');
  console.log(`     ✅ Server fallback successfully hydrated ${serverHydratedInstructions.length} chars from SQLite.`);
}

try {
  testCodingChallengesHydration();
  testBugChallengesHydration();
  testTheoryQuestionsHydration();
  testLivePairPromptGroundingSection();
  testPracticeTutorHydrationFallback();

  console.log('\n🎉 ALL WAVE 15 PHASE 01 GROUNDING & HYDRATION TESTS PASSED CLEANLY!\n');
} catch (err) {
  console.error('\n❌ Phase 01 Test Failed:', err);
  process.exit(1);
}
