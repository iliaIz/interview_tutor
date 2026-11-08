const assert = require('assert');
const {
  normalizeSqlArenaContext,
  normalizeCompanyContext,
  normalizePracticeContext
} = require('../../shared/dist');

console.log('🧪 Starting Polymorphic Tutor Normalizers Test Suite...');

// 1. Test SQL Arena Context Normalizer
{
  const mockSqlPayload = {
    challenge: {
      id: 'sql-raiff-01',
      slug: 'sql-raiff-01-sleeping-clients',
      title: 'Спящие клиенты с активными картами (NULL trap)',
      instructionsMarkdown: 'Найдите клиентов с активными картами...',
      schemaSql: 'CREATE TABLE clients (id INT PRIMARY KEY);',
      seedSql: 'INSERT INTO clients VALUES (1), (2);',
      category: 'traps'
    },
    currentSql: 'SELECT * FROM clients WHERE id NOT IN (SELECT client_id FROM transactions);',
    executionResult: {
      success: true,
      error: undefined,
      diff: {
        missingRows: [{ id: 1 }],
        unexpectedRows: [],
        columnMismatch: false,
        orderMismatch: false
      }
    },
    companyContextName: 'АО «Райффайзенбанк»'
  };

  const context = normalizeSqlArenaContext(mockSqlPayload);
  assert.strictEqual(context.arena, 'sql_arena', 'Arena must be sql_arena');
  assert.strictEqual(context.entityId, 'sql-raiff-01');
  assert.strictEqual(context.domain, 'PostgreSQL 16 & Relational Invariants');
  assert.strictEqual(context.activeCodeOrQuery, mockSqlPayload.currentSql);
  assert.ok(context.schemaOrDdl.includes('CREATE TABLE clients'));
  assert.strictEqual(context.executionDiff.missingRowsCount, 1);
  assert.strictEqual(context.companyContext.companyName, 'АО «Райффайзенбанк»');
  assert.strictEqual(context.quickActionChips.length, 4, 'Must have 4 domain quick chips');
  assert.strictEqual(context.quickActionChips[0].id, 'why_empty');
  assert.strictEqual(context.quickActionChips[1].id, 'index_plan');

  console.log('✅ normalizeSqlArenaContext: PASSED');
}

// 2. Test Company Studio Context Normalizer
{
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
      }
    },
    activeStage: {
      id: 'stage-3-code-review',
      title: '3. Секция Code Review: TransferService',
      description: 'Поиск 7 скрытых дефектов',
      format: 'code_review'
    },
    activeCodeSnippet: 'public void transfer(Account from, Account to, BigDecimal amount) { ... }'
  };

  const context = normalizeCompanyContext(mockCompanyPayload);
  assert.strictEqual(context.arena, 'companies', 'Arena must be companies');
  assert.strictEqual(context.persona, 'company_interviewer');
  assert.strictEqual(context.entityId, 'raiffeisen_dgtl');
  assert.strictEqual(context.companyContext.companyName, 'АО «Райффайзенбанк» (Raiffeisen DGTL)');
  assert.strictEqual(context.companyContext.stageTitle, '3. Секция Code Review: TransferService');
  assert.ok(context.companyContext.redFlags.includes('Использование double в деньгах'));
  assert.strictEqual(context.quickActionChips.length, 4);
  assert.strictEqual(context.quickActionChips[0].id, 'pitch_review');
  assert.strictEqual(context.quickActionChips[1].id, 'star_drill');
  assert.strictEqual(context.quickActionChips[2].id, 'socks_warehouse');
  assert.strictEqual(context.quickActionChips[3].id, 'transferservice_defects');

  console.log('✅ normalizeCompanyContext: PASSED');
}

// 3. Test Practice Context Normalizer
{
  const mockPracticePayload = {
    kataId: 'kata-iban-01',
    kataTitle: 'IBAN Validation ISO 13616',
    kataCategory: 'Algorithms & Streaming Math',
    kataInstructions: 'Реализуйте посимвольный расчет остатка mod 97',
    activeFilePath: 'src/main/java/IbanValidator.java',
    activeFileContent: 'public boolean validate(String iban) { return false; }',
    compilerError: undefined,
    testFailureMessage: 'Expected true, got false'
  };

  const context = normalizePracticeContext(mockPracticePayload);
  assert.strictEqual(context.arena, 'practice');
  assert.strictEqual(context.entityId, 'kata-iban-01');
  assert.strictEqual(context.entityTitle, 'IBAN Validation ISO 13616');
  assert.strictEqual(context.runtimeError, 'Expected true, got false');
  assert.strictEqual(context.quickActionChips.length, 3);

  console.log('✅ normalizePracticeContext: PASSED');
}

console.log('🎉 All Polymorphic Tutor Normalizer tests passed deterministically in 0ms!');
