process.env.DB_PATH = ':memory:';

const assert = require('assert');
const http = require('http');
const express = require('express');
const {
  normalizePracticeContext,
  normalizeIncidentsContext,
  normalizeSystemDesignContext
} = require('../../shared/dist');
const { db } = require('../dist/services/db');
const { llmGateway, LlmGatewayUnavailableError } = require('../dist/services/LlmGatewayClient');
const practiceTutorModule = require('../dist/routes/practiceTutor');

const practiceTutorRouter = practiceTutorModule.default;
const { resolveTutorRouteContext } = practiceTutorModule;

console.log('🧪 Starting Spec 58 /api/practice-tutor Route & Resolver Verification Suite...');

const CANONICAL_GUARD_TEST = `
@Test
public void shouldCalculateTieredFee() {
  TieredFeeCalculator calc = new TieredFeeCalculator();
  BigDecimal fee = calc.calculateFee(new BigDecimal("1500.00"));
  assertThat(fee).isEqualByComparingTo(new BigDecimal("30.00"));
}`.trim();

const LEAKED_LLM_MARKDOWN = `
Вот готовое решение:
\`\`\`java
${CANONICAL_GUARD_TEST}
\`\`\`
`;

function seedInMemoryChallenge() {
  const manifest = {
    id: 'kata_spec58_guard',
    slug: 'kata-spec58-guard',
    title: 'Spec 58 Fee Guard Kata',
    category: 'testing_mutation',
    badge: 'Spec58',
    difficulty: 'Middle',
    shortDescription: 'Verify fee boundary',
    instructionsMarkdown: 'Write boundary assertions for calculateFee in Spec58GuardTest without leaking.',
    workspaceFiles: [{ path: 'src/test/java/com/curriculum/spec58/Spec58GuardTest.java', content: CANONICAL_GUARD_TEST }]
  };
  db.prepare(
    'INSERT INTO coding_challenges (id, slug, title, category, track, badge, difficulty, target_stack, short_description, instructions_markdown, manifest_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    manifest.id, manifest.slug, manifest.title, manifest.category, 'testing_mutation',
    manifest.badge, manifest.difficulty, 'Java 21 LTS', manifest.shortDescription, manifest.instructionsMarkdown, JSON.stringify(manifest)
  );

  db.prepare(
    `INSERT INTO bug_challenges (id, topic_id, topic_name, preset, difficulty, category_badge, title, subtopic, language, code_snippet, bug_explanation, fixed_code, hints_json, is_solved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    'bug_spec62_guard',
    'concurrency',
    'Concurrency & JMM',
    'race_condition',
    'Senior',
    '⚡ Concurrency',
    'Spec 62 Check-Then-Act Map Bug',
    'ConcurrentHashMap atomicity',
    'java',
    'if (!map.containsKey(key)) { map.put(key, expensiveInit(key)); }',
    'Операции containsKey и put не атомарны, два потока одновременно вычисляют и перезаписывают значение.',
    'public Value getOrCreate(String key) {\n  return map.computeIfAbsent(key, k -> expensiveInit(k));\n}',
    JSON.stringify(['Посмотри на атомарность связки containsKey + put'])
  );
}

async function run() {
  seedInMemoryChallenge();

  // 1. Direct unit check of resolveTutorRouteContext across all 5 arenas + legacy fallback
  {
    const practiceCanonical = resolveTutorRouteContext(
      normalizePracticeContext({
        kataId: 'kata_spec58_guard',
        kataTitle: 'Spec 58 Fee Guard Kata',
        kataCategory: 'Concurrency Lab',
        kataInstructions: 'Use StampedLock optimistic reads cleanly.',
        activeFilePath: 'src/main/java/OrderBook.java',
        activeFileContent: 'long stamp = lock.tryOptimisticRead();',
        selectedCodeSnippet: 'lock.tryOptimisticRead()',
        cursorLine: 14,
        cursorColumn: 9,
        survivingMutants: [{ id: 'm1', name: 'Mutant1', file: 'OrderBook.java', line: 14 }],
        activeCompassRuleId: 'STAMPED_LOCK_OPTIMISTIC',
        activeWhiteboardSnippet: { title: 'Stamp Flow', code: 'lock.validate(stamp)', language: 'java' },
        academyBridgeContext: { moduleTitle: 'Loom & Locks', learningObjective: 'Optimistic read' },
        hintTier: 2,
        persona: 'senior_socratic',
        assistanceLevel: 3
      })
    );
    assert.strictEqual(practiceCanonical.arena, 'practice');
    assert.strictEqual(practiceCanonical.isPolymorphic, true, 'arena === practice MUST set isPolymorphic = true');
    assert.strictEqual(practiceCanonical.isPracticeArena, true);
    assert.strictEqual(practiceCanonical.context.entityTitle, 'Spec 58 Fee Guard Kata');
    assert.strictEqual(practiceCanonical.context.selectedCodeSnippet, 'lock.tryOptimisticRead()');
    assert.strictEqual(practiceCanonical.context.cursorLine, 14);
    assert.strictEqual(practiceCanonical.context.activeWhiteboardSnippet.title, 'Stamp Flow');
    assert.strictEqual(practiceCanonical.context.academyBridgeContext.moduleTitle, 'Loom & Locks');
    assert.strictEqual(practiceCanonical.context.hintTier, 2);

    for (const arena of ['practice', 'sql_arena', 'companies', 'system_design', 'incidents']) {
      const res = resolveTutorRouteContext({ arena, entityId: `e-${arena}`, entityTitle: `T-${arena}`, domain: 'D' });
      assert.strictEqual(res.arena, arena);
      assert.strictEqual(res.isPolymorphic, true, `Arena ${arena} must resolve as polymorphic`);
    }

    const legacyResolved = resolveTutorRouteContext({
      kataId: 'kata_spec58_guard',
      kataTitle: 'Legacy Title',
      activeFileContent: 'class Legacy {}',
      testFailureMessage: 'Expected 1 but got 0'
    });
    assert.strictEqual(legacyResolved.isPolymorphic, false);
    assert.strictEqual(legacyResolved.context.entityId, 'kata_spec58_guard');
    assert.strictEqual(legacyResolved.context.activeCodeOrQuery, 'class Legacy {}');
    assert.strictEqual(legacyResolved.context.runtimeError, 'Expected 1 but got 0');
    console.log('✅ resolveTutorRouteContext (all 5 arenas + legacy compat): PASSED');
  }

  const origCompleteText = llmGateway.completeText.bind(llmGateway);
  const origStreamChat = llmGateway.streamChat.bind(llmGateway);
  let lastExecOpts = null;
  let mockBehavior = { mode: 'text', text: 'Проверь граничное условие по модулю.' };

  llmGateway.completeText = async (opts) => {
    lastExecOpts = opts;
    if (mockBehavior.mode === '429') {
      throw new LlmGatewayUnavailableError('rate_limit_exceeded', '429 mocked');
    }
    if (mockBehavior.mode === '503') {
      throw new LlmGatewayUnavailableError('proxy_unreachable', '503 mocked');
    }
    return mockBehavior.text;
  };

  llmGateway.streamChat = async function* (opts) {
    lastExecOpts = opts;
    yield 'Попробуй ';
    yield mockBehavior.text;
  };

  const app = express();
  app.use(express.json());
  app.use('/api/practice-tutor', practiceTutorRouter);

  const server = await new Promise((resolve) => {
    const s = http.createServer(app);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/practice-tutor`;

  const postJson = (path, body) =>
    fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  try {
    // 2. POST /chat with canonical arena === 'practice' (JSON + TreeEditDistanceGuard)
    mockBehavior = { mode: 'text', text: LEAKED_LLM_MARKDOWN };
    const chatBody = {
      ...normalizePracticeContext({
        kataId: 'kata_spec58_guard',
        kataTitle: 'Spec 58 Fee Guard Kata',
        kataCategory: 'testing_mutation',
        kataInstructions: '',
        activeFilePath: 'src/test/java/Spec58GuardTest.java',
        activeFileContent: 'public class Spec58GuardTest {}',
        selectedCodeSnippet: 'assertThat(fee).isNotNull();',
        activeWhiteboardSnippet: { title: 'Fee Matrix', code: 'fee = 30.00', language: 'java' },
        academyBridgeContext: { moduleTitle: 'RIPR Oracles', learningObjective: 'Kill boundary mutant' },
        persona: 'senior_socratic',
        assistanceLevel: 3
      }),
      messages: [{ role: 'user', content: 'Помоги написать тест' }],
      stream: false
    };
    const chatRes = await postJson('/chat', chatBody);
    assert.strictEqual(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.strictEqual(chatJson.leakDetected, true, 'Canonical practice /chat must redact leaked SQLite solution');
    assert.ok(chatJson.content.includes('[Socratic Guard]'));
    const chatSysPrompt = lastExecOpts.messages[0].content;
    assert.ok(chatSysPrompt.includes('Spec 58 Fee Guard Kata'));
    assert.ok(chatSysPrompt.includes('assertThat(fee).isNotNull();'));
    assert.ok(chatSysPrompt.includes('Fee Matrix'));
    assert.ok(chatSysPrompt.includes('RIPR Oracles'));
    assert.ok(chatSysPrompt.includes('Write boundary assertions for calculateFee'), 'Must hydrate instructions from SQLite');

    // 3. POST /chat SSE streaming for arena === 'practice'
    const sseRes = await postJson('/chat', { ...chatBody, stream: true });
    assert.strictEqual(sseRes.status, 200);
    assert.ok(sseRes.headers.get('content-type').includes('text/event-stream'));
    const sseText = await sseRes.text();
    assert.ok(sseText.includes('"delta":"Попробуй "'));
    assert.ok(sseText.includes('"done":true,"leakDetected":true'));

    // 4. POST /chat for arena === 'system_design' preserves activeCodeOrQuery, activeFilePath, instructions, companyContext
    mockBehavior = { mode: 'text', text: 'Проверь атомарность списания в 2 фазы.' };
    const sdChatRes = await postJson('/chat', {
      ...normalizeSystemDesignContext({
        scenarioId: 'sd-atm',
        scenarioTitle: 'ATM Dispenser',
        activeStudioTab: 'runtime',
        activeCodeSnippet: 'public void dispense() { /* bug */ }',
        activeFilePath: 'src/main/java/AtmDispenser.java',
        capacityMathSummary: '5000 RPS',
        companyContextName: 'Raiffeisen Bank'
      }),
      messages: [{ role: 'user', content: 'Где баг?' }],
      stream: false
    });
    assert.strictEqual(sdChatRes.status, 200);
    const sdPrompt = lastExecOpts.messages[0].content;
    assert.ok(sdPrompt.includes('src/main/java/AtmDispenser.java'));
    assert.ok(sdPrompt.includes('public void dispense()'));
    assert.ok(sdPrompt.includes('5000 RPS'));
    assert.ok(sdPrompt.includes('Raiffeisen Bank'));
    console.log('✅ POST /chat (canonical practice JSON/SSE + system_design): PASSED');

    // 5. POST /hint with arena === 'practice', hintTier: 0, live persona, TreeEditDistanceGuard & 429/503
    mockBehavior = { mode: 'text', text: LEAKED_LLM_MARKDOWN };
    const hintRes = await postJson('/hint', {
      ...normalizePracticeContext({
        kataId: 'kata_spec58_guard',
        kataTitle: 'Spec 58 Fee Guard Kata',
        activeFilePath: 'src/test/java/Spec58GuardTest.java',
        activeFileContent: 'class Spec58GuardTest {}',
        persona: 'senior_socratic',
        assistanceLevel: 3
      }),
      hintTier: 0
    });
    assert.strictEqual(hintRes.status, 200);
    const hintJson = await hintRes.json();
    assert.strictEqual(hintJson.hintTier, 0, 'hintTier 0 must not fall back to 1');
    assert.strictEqual(hintJson.leakDetected, true);
    assert.ok(hintJson.content.includes('[Socratic Guard]'));
    assert.ok(lastExecOpts.systemPrompt.includes('УРОВЕНЬ 0'));
    assert.ok(lastExecOpts.systemPrompt.includes('SENIOR SOCRATIC'));

    mockBehavior = { mode: '429' };
    const hint429 = await postJson('/hint', { kataId: 'kata_spec58_guard', hintTier: 1 });
    assert.strictEqual(hint429.status, 429);
    assert.strictEqual((await hint429.json()).isGatewayUnavailable, true);

    mockBehavior = { mode: '503' };
    const hint503 = await postJson('/hint', { kataId: 'kata_spec58_guard', hintTier: 1 });
    assert.strictEqual(hint503.status, 503);
    assert.strictEqual((await hint503.json()).isGatewayUnavailable, true);

    // 5b. ChallengeCatalogLoader fallback when challengeId is not in SQLite
    mockBehavior = {
      mode: 'text',
      text: '```java\npublic class DiscountCalculatorTest {\n  private final DiscountCalculator calculator = new DiscountCalculator();\n  @Test\n  public void shouldCalculateStandardDiscount() {\n    BigDecimal price = new BigDecimal("100.00");\n    BigDecimal result = calculator.applyDiscount(price);\n    assertThat(result).isNotNull();\n  }\n}\n```'
    };
    const fallbackHint = await postJson('/hint', { kataId: 'kata_prim_01_scalar_assertions', hintTier: 2 });
    assert.strictEqual(fallbackHint.status, 200);
    assert.strictEqual((await fallbackHint.json()).leakDetected, true, 'ChallengeCatalogLoader fallback must guard leaks');
    console.log('✅ POST /hint (canonical practice, hintTier 0, catalog fallback, Guard, 429/503): PASSED');

    // 6. POST /rule-grounding across ALL 5 compass rule maps + pre-T7 legacy UI aliases, 400 unknown, guard & 429/503
    const expectedRules = [
      ['AAA_PATTERN', 'Паттерн AAA'],
      ['CLOCK_INJECTION', 'Виртуального Времени'],
      ['OUTBOX_PATTERN', 'Transactional Outbox'],
      ['cglib-lifecycle', 'CGLIB-прокси'],
      ['STAMPED_LOCK_OPTIMISTIC', 'StampedLock'],
      ['DISRUPTOR_LOCK_FREE', 'Безблокировочные Очереди'],
      ['REPLACE_CONDITIONAL_WITH_POLYMORPHISM', 'Замена Условий Полиморфизмом'],
      ['SMELL_REMEDIATION', 'Запахами Кода'],
      ['LOCK_FREE_DISRUPTOR', 'Безблокировочные Очереди'],
      ['REPLACE_CONDITIONAL_POLYMORPHISM', 'Замена Условий Полиморфизмом'],
      ['SMELL_REMEDIATION_DEMETER', 'Запахами Кода']
    ];
    mockBehavior = { mode: 'text', text: LEAKED_LLM_MARKDOWN };
    for (const [ruleId, expectedFragment] of expectedRules) {
      const rgRes = await postJson('/rule-grounding', {
        ...normalizePracticeContext({
          kataId: 'kata_spec58_guard',
          kataTitle: 'Spec 58 Fee Guard Kata',
          activeFilePath: 'src/test/java/Spec58GuardTest.java',
          activeFileContent: 'class Spec58GuardTest {}'
        }),
        ruleId
      });
      assert.strictEqual(rgRes.status, 200, `Expected HTTP 200 for ruleId=${ruleId}`);
      const rgJson = await rgRes.json();
      assert.strictEqual(rgJson.ruleId, ruleId);
      assert.ok(rgJson.ruleName.includes(expectedFragment), `Expected ${expectedFragment} in ${rgJson.ruleName}`);
      assert.strictEqual(rgJson.leakDetected, true, `TreeEditDistanceGuard must guard /rule-grounding for ${ruleId}`);
      assert.ok(rgJson.content.includes('[Socratic Guard]'));
    }

    assert.strictEqual((await postJson('/rule-grounding', { ruleId: 'NON_EXISTENT_RULE' })).status, 400);
    mockBehavior = { mode: '429' };
    assert.strictEqual((await postJson('/rule-grounding', { ruleId: 'STAMPED_LOCK_OPTIMISTIC' })).status, 429);
    mockBehavior = { mode: '503' };
    assert.strictEqual((await postJson('/rule-grounding', { ruleId: 'SMELL_REMEDIATION' })).status, 503);
    console.log('✅ POST /rule-grounding (all 5 compass maps, unknown 400, TreeEditDistanceGuard, 429/503): PASSED');

    // 7. GET /*compass-rules endpoints return 5 rules each
    for (const ep of ['compass-rules', 'lld-compass-rules', 'transaction-compass-rules', 'concurrency-compass-rules', 'refactoring-compass-rules']) {
      const r = await fetch(`${baseUrl}/${ep}`);
      assert.strictEqual(r.status, 200);
      const data = await r.json();
      assert.strictEqual(data.rules.length, 5, `${ep} must return 5 rules`);
    }
    console.log('✅ GET /*compass-rules (all 5 endpoints): PASSED');

    // 8. Spec 62: Bug Hunt ground-truth hydration, TreeEditDistanceGuard & POST /verify-diagnosis
    {
      const leakedFixText = '```java\npublic Value getOrCreate(String key) {\n  return map.computeIfAbsent(key, k -> expensiveInit(k));\n}\n```';
      mockBehavior = { mode: 'text', text: leakedFixText };
      const bugHintRes = await postJson(
        '/hint',
        {
          ...normalizeIncidentsContext({
            bugId: 'bug_spec62_guard',
            title: 'Spec 62 Check-Then-Act Map Bug',
            topic: 'concurrency',
            buggyCode: 'if (!map.containsKey(key)) { map.put(key, expensiveInit(key)); }',
            tutorRole: 'code_review'
          }),
          hintTier: 1
        }
      );
      assert.strictEqual(bugHintRes.status, 200);
      const bugHintJson = await bugHintRes.json();
      assert.strictEqual(bugHintJson.leakDetected, true, 'Unsolved Bug Hunt /hint must trigger TreeEditDistanceGuard on fixed_code leak');
      assert.ok(lastExecOpts.systemPrompt.includes('containsKey и put не атомарны'), 'Server prompt must hydrate bug_explanation from SQLite');

      assert.strictEqual((await postJson('/verify-diagnosis', { diagnosis: '   ' })).status, 400);
      assert.strictEqual((await postJson('/verify-diagnosis', { bugId: 'non_existent_bug', diagnosis: 'race' })).status, 404);

      mockBehavior = {
        mode: 'text',
        text: JSON.stringify({
          verdict: 'partial',
          feedback: 'Верно про потоки, но используйте:\n```java\npublic Value getOrCreate(String key) {\n  return map.computeIfAbsent(key, k -> expensiveInit(k));\n}\n```'
        })
      };
      const partialRes = await postJson('/verify-diagnosis', {
        bugId: 'bug_spec62_guard',
        diagnosis: 'Тут проблемы с потоками в мапе',
        context: normalizeIncidentsContext({
          bugId: 'bug_spec62_guard',
          title: 'Spec 62 Check-Then-Act Map Bug',
          buggyCode: 'if (!map.containsKey(key)) { map.put(key, expensiveInit(key)); }'
        })
      });
      assert.strictEqual(partialRes.status, 200);
      const partialJson = await partialRes.json();
      assert.strictEqual(partialJson.verdict, 'partial');
      assert.strictEqual(partialJson.isCorrect, false);
      assert.strictEqual(partialJson.fsrsRecorded, false);
      assert.ok(!partialJson.feedback.includes('expensiveInit(k));\n```'), 'Partial feedback must redact leaked fixed_code');

      mockBehavior = {
        mode: 'text',
        text: JSON.stringify({
          verdict: 'solved',
          feedback: 'Точно: containsKey и put образуют гонку check-then-act.'
        })
      };
      const solvedRes = await postJson('/verify-diagnosis', {
        bugId: 'bug_spec62_guard',
        diagnosis: 'Неатомарная связка containsKey + put допускает двойную инициализацию и перезапись.',
        context: normalizeIncidentsContext({
          bugId: 'bug_spec62_guard',
          title: 'Spec 62 Check-Then-Act Map Bug',
          buggyCode: 'if (!map.containsKey(key)) { map.put(key, expensiveInit(key)); }'
        })
      });
      assert.strictEqual(solvedRes.status, 200);
      const solvedJson = await solvedRes.json();
      assert.strictEqual(solvedJson.verdict, 'solved');
      assert.strictEqual(solvedJson.isCorrect, true);
      assert.strictEqual(solvedJson.fsrsRecorded, true);
      assert.ok(solvedJson.revealedExplanation.includes('не атомарны'));
      const rowAfter = db.prepare('SELECT is_solved FROM bug_challenges WHERE id = ?').get('bug_spec62_guard');
      assert.strictEqual(rowAfter.is_solved, 1, 'verify-diagnosis solved verdict must persist is_solved=1 in SQLite');
      console.log('✅ Spec 62 Bug Hunt ground-truth guard & POST /verify-diagnosis: PASSED');
    }
  } finally {
    llmGateway.completeText = origCompleteText;
    llmGateway.streamChat = origStreamChat;
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }

  console.log('🎉 ALL SPEC 58 PRACTICE TUTOR ROUTE TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
