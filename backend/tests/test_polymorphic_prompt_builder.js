const assert = require('assert');
const {
  normalizeSqlArenaContext,
  normalizeCompanyContext
} = require('../../shared/dist');
const {
  buildPolymorphicTutorSystemPrompt
} = require('../dist/prompts/tutor/polymorphicPromptBuilder');

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
  assert.ok(prompt.includes('TransferService'), 'Prompt must include transfer service');
  assert.ok(prompt.includes('cib-interns-test-task'), 'Prompt must mention socks warehouse take-home');

  console.log('✅ buildCompanyStudioTutorPrompt: PASSED');
}

console.log('🎉 All Polymorphic Prompt Builder tests passed deterministically in 0ms!');
