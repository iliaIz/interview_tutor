const assert = require('assert');
const { buildSystemPrompt } = require('../dist/services/live/livePromptBuilder');

console.log('🧪 Running Multimodal Deictic Grounding Prompt Builder Tests (Wave 06)...');

function testSystemDesignGrounding() {
  console.log('  Testing System Design Arena Grounding...');
  const initialMermaid = `graph TD\n  Client --> Gateway\n  Gateway --> Service\n  Service --> DB`;
  const designNotes = `Шардирование по user_id (consistent hashing). Кэш Redis cluster 3 nodes.`;

  const prompt = buildSystemPrompt({
    sessionType: 'system_design',
    topic: 'High-Load Video Streaming Platform',
    questionText: 'Design Netflix-like Streaming Architecture',
    referenceAnswer: 'Microservices architecture with CDN edge caches and object storage.',
    codeSnippet: initialMermaid,
    customPromptOverride: designNotes
  });

  // 1. Verify role and anti-sycophancy
  assert.ok(prompt.includes('FAANG PRINCIPAL ARCHITECT & BAR-RAISER'), 'Prompt should define Bar-Raiser role');
  assert.ok(prompt.includes('ANTI-SYCOPHANCY INVARIANTS'), 'Prompt should have anti-sycophancy rules');

  // 2. Verify initial Mermaid topology grounding
  assert.ok(prompt.includes('НАЧАЛЬНАЯ ТОПОЛОГИЯ АРХИТЕКТУРЫ (СХЕМА НА ХОЛСТЕ КАНДИДАТА)'), 'Prompt must include initial topology header');
  assert.ok(prompt.includes(initialMermaid), 'Prompt must include the exact Mermaid diagram code');

  // 3. Verify candidate design notes
  assert.ok(prompt.includes('АРХИТЕКТУРНЫЕ ЗАМЕТКИ И ПОЯСНИТЕЛЬНАЯ ЗАПИСКА КАНДИДАТА'), 'Prompt must include candidate notes header');
  assert.ok(prompt.includes(designNotes), 'Prompt must include candidate design notes');

  // 4. Verify telemetry anomaly directives
  assert.ok(prompt.includes('ТЕЛЕМЕТРИЯ СИМУЛЯЦИИ И АВАРИЙНЫЕ СИГНАЛЫ (ANOMALY ALERTS)'), 'Prompt must include simulation anomaly directives');
  assert.ok(prompt.includes('🚨 [АНОМАЛИЯ ХОЛСТА: БОТЛНЕК НА УЗЛЕ'), 'Prompt must mention canvas anomaly alerts');

  // 5. Verify first-turn lockdown invariant
  assert.ok(prompt.includes('FIRST-TURN LOCKDOWN'), 'Prompt must enforce first-turn tool lockdown');
  console.log('    ✅ System Design Grounding passed.');
}

function testBugHuntIncidentGrounding() {
  console.log('  Testing Bug Hunt Incident Grounding...');
  const incident = {
    systemName: 'PaymentGatewayCore',
    architectureType: 'Distributed Sagas / Spring Cloud',
    incidentSymptoms: '504 Gateway Timeout during peak traffic spike',
    businessImpact: '35% drop in transaction checkout conversions',
    prReviewContext: 'PR #412: Added distributed lock around idempotency key',
    stackTrace: 'org.springframework.dao.CannotAcquireLockException: Lock wait timeout exceeded'
  };

  const fixedCode = `public synchronized PaymentResult processPayment(PaymentRequest req) { ... }`;
  const unitTest = `@Test void shouldHandleConcurrentDebits() { ... }`;
  const hints = [
    'Обратите внимание на порядок захвата блокировок',
    'Используйте глобальное упорядочивание ключей: lock(min, max)'
  ];

  const prompt = buildSystemPrompt({
    sessionType: 'tutor',
    tutorMode: 'bug_hunt',
    topic: 'Deadlock in Distributed Transaction Manager',
    bugTitle: 'Deadlock under concurrent debit/credit requests',
    bugExplanation: 'Acquiring lock(accA) then lock(accB) while another thread acquires in reverse order.',
    codeSnippet: 'public void transfer(Account from, Account to) { lock(from); lock(to); }',
    fixedCode,
    unitTest,
    incidentContext: incident,
    hints
  });

  // 1. Verify incident context fields are ground in prompt
  assert.ok(prompt.includes('PaymentGatewayCore'), 'Prompt must include systemName');
  assert.ok(prompt.includes('Distributed Sagas / Spring Cloud'), 'Prompt must include architectureType');
  assert.ok(prompt.includes('504 Gateway Timeout'), 'Prompt must include incident symptoms');
  assert.ok(prompt.includes('35% drop in transaction checkout'), 'Prompt must include business impact');
  assert.ok(prompt.includes('PR #412'), 'Prompt must include PR review context');
  assert.ok(prompt.includes('CannotAcquireLockException'), 'Prompt must include stack trace');

  // 2. Verify reference solution fields
  assert.ok(prompt.includes(fixedCode), 'Prompt must include fixed code');
  assert.ok(prompt.includes(unitTest), 'Prompt must include unit test');

  // 3. Verify hints
  assert.ok(prompt.includes('[Уровень 1] Обратите внимание на порядок'), 'Prompt must include hint 1');
  assert.ok(prompt.includes('[Уровень 2] Используйте глобальное упорядочивание'), 'Prompt must include hint 2');

  console.log('    ✅ Bug Hunt Incident Grounding passed.');
}

function testMachineCodingFullRequirementsGrounding() {
  console.log('  Testing Machine Coding / Practice Pair Grounding...');
  const longInstructions = `
# Rate Limiter Implementation Challenge (Sliding Window Log)
## Functional Requirements:
1. Support arbitrary sliding windows with millisecond granularity.
2. Injected java.time.Clock for zero-sleep deterministic testing.
3. Thread-safe execution under 100 concurrent threads.
4. Memory cleanup of expired timestamps to avoid OutOfMemoryError.
## Edge Cases:
- Exact boundary timestamps.
- Zero-capacity limiters.
`.repeat(10); // Exceeds old 800-char limit easily (> 3500 chars)

  const initialCode = `public class SlidingWindowRateLimiter implements RateLimiter { ... }`;

  const prompt = buildSystemPrompt({
    sessionType: 'tutor',
    tutorMode: 'practice_pair',
    topic: 'Rate Limiter (Java 21)',
    questionText: longInstructions,
    codeSnippet: initialCode
  });

  // Verify that instructions are NOT truncated to 800 chars
  assert.ok(prompt.length > 3000, `Prompt should be rich and detailed, actual length: ${prompt.length}`);
  assert.ok(prompt.includes('Sliding Window Log'), 'Prompt must contain the challenge title');
  assert.ok(prompt.includes('Memory cleanup of expired timestamps'), 'Prompt must preserve deep requirements');
  assert.ok(prompt.includes(initialCode), 'Prompt must contain active editor code snippet');

  console.log('    ✅ Machine Coding Grounding passed.');
}

testSystemDesignGrounding();
testBugHuntIncidentGrounding();
testMachineCodingFullRequirementsGrounding();

console.log('\n🎉 ALL MULTIMODAL GROUNDING PROMPT BUILDER TESTS PASSED SUCCESSFULLY!');
