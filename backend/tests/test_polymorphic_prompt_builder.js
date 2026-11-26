const assert = require('assert');
const {
  normalizeSqlArenaContext,
  normalizeCompanyContext,
  normalizeSystemDesignContext,
  normalizePracticeContext
} = require('../../shared/dist');
const {
  buildPolymorphicTutorSystemPrompt
} = require('../dist/prompts/tutor/polymorphicPromptBuilder');
const {
  buildPracticeTutorSystemPrompt
} = require('../dist/prompts/practiceTutorPrompts');

console.log('🧪 Starting Polymorphic Tutor Prompt Builder Test Suite...');

// 1. Test SQL Arena prompt generation
{
  const mockSqlPayload = {
    challenge: {
      id: 'sql-raiff-01',
      title: 'Спящие клиенты с активными картами (NULL trap)',
      instructionsMarkdown: 'Найдите клиентов с активными картами...',
      schemaSql: 'CREATE TABLE clients (id INT PRIMARY KEY);',
      seedSql: 'INSERT INTO clients VALUES (1);'
    },
    currentSql: 'SELECT * FROM clients WHERE id NOT IN (SELECT client_id FROM transactions);',
    executionResult: {
      success: false,
      error: 'syntax error at or near NOT',
      diff: undefined
    },
    companyContextName: 'АО «Райффайзенбанк»'
  };

  const context = normalizeSqlArenaContext(mockSqlPayload);
  const prompt = buildPolymorphicTutorSystemPrompt(context);

  assert.ok(prompt.includes('PostgreSQL 16'), 'Prompt must mention PostgreSQL 16');
  assert.ok(prompt.includes('Спящие клиенты с активными картами'), 'Prompt must contain challenge title');
  assert.ok(prompt.includes('Трехзначная логика SQL'), 'Prompt must mention 3-valued logic');
  assert.ok(prompt.includes('NOT EXISTS'), 'Prompt must guide towards NOT EXISTS');
  assert.ok(prompt.includes('syntax error at or near NOT'), 'Prompt must contain runtime error');

  console.log('✅ buildSqlArenaTutorPrompt: PASSED');
}

// 2. Test Company Studio prompt generation
{
  // 2a. Specific company profile with takeHomePrCases
  const mockCompanyPayload = {
    profile: {
      id: 'raiffeisen_dgtl',
      name: 'АО «Райффайзенбанк» (Raiffeisen DGTL)',
      tagline: 'Product Engineering, финтех-устойчивость',
      culture: {
        engineeringParadigm: 'Product Engineer',
        metricsFocus: ['TTM', 'Pain Index'],
        redFlags: ['Использование double в деньгах'],
        greenFlags: ['Детерминированная сортировка PK min->max']
      },
      takeHomePrCases: [
        { title: 'cib-interns-test-task (Склад носков)' }
      ]
    },
    activeStage: {
      id: 'stage-3-code-review',
      title: '3. Секция Code Review: TransferService',
      description: 'Поиск 7 скрытых дефектов'
    },
    activeCodeSnippet: 'public void transfer(Account from, Account to, BigDecimal amount)'
  };

  const context = normalizeCompanyContext(mockCompanyPayload);
  const prompt = buildPolymorphicTutorSystemPrompt(context);

  assert.ok(prompt.includes('Staff Product Engineer & Bar-Raiser'), 'Prompt must have Bar-Raiser role');
  assert.ok(prompt.includes('АО «Райффайзенбанк» (Raiffeisen DGTL)'), 'Prompt must have company name');
  assert.ok(prompt.includes('TTM, Pain Index'), 'Prompt must have metrics focus');
  assert.ok(prompt.includes('Использование double в деньгах'), 'Prompt must have red flag');
  assert.ok(prompt.includes('Разбор дефектов и техдизайна'), 'Prompt must mention defect review');
  assert.ok(prompt.includes('cib-interns-test-task'), 'Prompt must mention takeHomeContext when present');

  // 2b. Generic company without takeHomePrCases (zero leaked domain constants)
  const genericCompanyPayload = {
    profile: {
      id: 'acme_global',
      name: 'Acme Global FinTech',
      tagline: 'Global Clearing Hub'
    },
    activeStage: {
      id: 'system-design',
      title: 'Ledger Architecture'
    }
  };

  const genericContext = normalizeCompanyContext(genericCompanyPayload);
  const genericPrompt = buildPolymorphicTutorSystemPrompt(genericContext);

  assert.ok(genericPrompt.includes('Acme Global FinTech'), 'Prompt must render generic company name');
  assert.ok(!genericPrompt.includes('cib-interns-test-task'), 'Must not leak cib-interns-test-task');
  assert.ok(!genericPrompt.includes('носков'), 'Must not leak socks');

  console.log('✅ buildCompanyStudioTutorPrompt: PASSED (both custom and agnostic profiles)');
}

// 3. Test System Design prompt generation (preserves code, path, instructions, companyContext)
{
  const sdContext = normalizeSystemDesignContext({
    scenarioId: 'sd-atm-dispenser',
    scenarioTitle: 'ATM Cash Dispenser',
    targetLevel: 'L5_SENIOR',
    activeStudioTab: 'runtime',
    activeCodeSnippet: 'public DispenseResult withdraw(long id) { return null; }',
    activeFilePath: 'src/main/java/AtmDispenserService.java',
    fadedBug: { lineNumber: 12, description: 'Greedy bill failure', bugPattern: 'GREEDY_FALLACY' },
    topologySummary: 'atm -> dispenser -> ledger',
    capacityMathSummary: '2500 RPS peak',
    companyContextName: 'Raiffeisen FinTech'
  });
  const prompt = buildPolymorphicTutorSystemPrompt(sdContext);
  assert.ok(prompt.includes('ATM Cash Dispenser'), 'System Design prompt must include title');
  assert.ok(prompt.includes('src/main/java/AtmDispenserService.java'), 'System Design prompt must preserve activeFilePath');
  assert.ok(prompt.includes('public DispenseResult withdraw(long id)'), 'System Design prompt must preserve activeCodeOrQuery');
  assert.ok(prompt.includes('2500 RPS peak'), 'System Design prompt must preserve instructions capacity math');
  assert.ok(prompt.includes('Raiffeisen FinTech'), 'System Design prompt must preserve companyContext');
  assert.ok(!prompt.includes('undefined'), 'System Design prompt must never leak undefined');
  console.log('✅ buildSystemDesignTutorPrompt: PASSED');
}

// 4. Test Practice arena routing & company_interviewer persona parity
{
  const practiceCtx = normalizePracticeContext({
    kataId: 'kata-stamped',
    kataTitle: 'Concurrent Order Book',
    kataCategory: 'Concurrency Lab',
    kataInstructions: 'Implement StampedLock optimistic read.',
    activeFilePath: 'src/main/java/OrderBook.java',
    activeFileContent: 'class OrderBook { long stamp = lock.tryOptimisticRead(); }',
    selectedCodeSnippet: 'lock.tryOptimisticRead()',
    cursorLine: 18,
    activeCompassRuleId: 'STAMPED_LOCK_OPTIMISTIC',
    activeWhiteboardSnippet: { title: 'Lock Diagram', code: 'validate(stamp)', language: 'java' },
    academyBridgeContext: { moduleTitle: 'StampedLock Lab', learningObjective: 'Avoid write starvation', targetConcepts: ['StampedLock'] },
    hintTier: 2,
    persona: 'company_interviewer',
    assistanceLevel: 3
  });
  const polyPracticePrompt = buildPolymorphicTutorSystemPrompt(practiceCtx);
  assert.ok(polyPracticePrompt.includes('Concurrent Order Book'));
  assert.ok(polyPracticePrompt.includes('lock.tryOptimisticRead()'));
  assert.ok(polyPracticePrompt.includes('Оптимистичные Чтения с StampedLock'));
  assert.ok(polyPracticePrompt.includes('StampedLock Lab'));
  assert.ok(!polyPracticePrompt.includes('undefined'), 'Practice prompt must not leak undefined');

  for (const cat of ['Low-Level Design (LLD)', 'Testing & Mutation Katas']) {
    const p = buildPracticeTutorSystemPrompt({
      persona: 'company_interviewer',
      assistanceLevel: 3,
      kataTitle: 'Ledger Transfer',
      kataCategory: cat,
      kataInstructions: 'Check BigDecimal and locks',
      activeFilePath: 'src/main/java/Transfer.java',
      activeFileContent: 'class Transfer {}'
    });
    assert.ok(p.length > 200 && !p.includes('undefined'), `company_interviewer directive must be defined for ${cat}`);
  }
  console.log('✅ Practice arena & company_interviewer persona directives: PASSED');
}

// 5. Test Incidents arena fallback preserves instructions, code, runtimeError, companyContext
{
  const incPrompt = buildPolymorphicTutorSystemPrompt({
    arena: 'incidents',
    entityId: 'inc-oom-01',
    entityTitle: 'HikariCP Pool Exhaustion',
    domain: 'Production SRE Triage',
    persona: 'senior_socratic',
    assistanceLevel: 3,
    activeFilePath: 'src/main/java/PaymentService.java',
    activeCodeOrQuery: '@Transactional public void pay() { restClient.call(); }',
    instructions: 'p99 latency spiked to 30s',
    runtimeError: 'SQLTransientConnectionException: Connection is not available',
    companyContext: { companyId: 'fin', companyName: 'FinCore' },
    quickActionChips: []
  });
  assert.ok(incPrompt.includes('HikariCP Pool Exhaustion'));
  assert.ok(incPrompt.includes('restClient.call()'));
  assert.ok(incPrompt.includes('SQLTransientConnectionException'));
  assert.ok(incPrompt.includes('FinCore'));
  console.log('✅ Incidents arena prompt preservation: PASSED');
}

console.log('🎉 All Polymorphic Prompt Builder tests passed deterministically in 0ms!');
