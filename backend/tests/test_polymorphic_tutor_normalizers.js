const assert = require('assert');
const {
  Value,
  TutorActiveContextSchema,
  normalizeSqlArenaContext,
  normalizeCompanyContext,
  normalizePracticeContext,
  normalizeIncidentsContext,
  normalizeSystemDesignContext
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
  // 2a. Specific company profile with custom chips and takeHomePrCases
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
      customQuickActionChips: [
        { id: 'pitch_review', label: '🎙️ Отрепетируй 4-мин питч', promptMessage: 'Питч' },
        { id: 'star_drill', label: '🚨 Каверзный вопрос по STAR', promptMessage: 'STAR' },
        { id: 'socks_warehouse', label: '🧦 Ловушки «Склада носков»', promptMessage: 'Носки' },
        { id: 'transferservice_defects', label: '🛡️ Дефекты TransferService', promptMessage: 'Transfer' }
      ],
      takeHomePrCases: [
        { title: 'cib-interns-test-task (Склад носков)' }
      ]
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
  assert.strictEqual(context.quickActionChips[2].id, 'socks_warehouse');
  assert.ok(context.companyContext.takeHomeContext);
  assert.strictEqual(context.companyContext.takeHomeContext.title, 'Take-Home Lab (АО «Райффайзенбанк» (Raiffeisen DGTL))');

  // 2b. Generic company without custom chips or takeHomePrCases (zero leaked domain constants)
  const genericCompanyPayload = {
    profile: {
      id: 'acme_fintech',
      name: 'Acme FinTech Global',
      tagline: 'Highload Payments'
    },
    activeStage: {
      id: 'fit-round',
      title: 'Cultural Fit & Leadership'
    }
  };

  const genericContext = normalizeCompanyContext(genericCompanyPayload);
  assert.strictEqual(genericContext.entityId, 'acme_fintech');
  assert.strictEqual(genericContext.companyContext.takeHomeContext, undefined, 'takeHomeContext must be undefined when no PR cases');
  assert.strictEqual(genericContext.quickActionChips.length, 4);
  const chipIds = genericContext.quickActionChips.map((c) => c.id);
  assert.deepStrictEqual(chipIds, ['pitch_review', 'star_drill', 'culture_fit', 'architecture_defense']);
  const serialized = JSON.stringify(genericContext);
  assert.ok(!serialized.includes('cib-interns-test-task'), 'Must not leak cib-interns-test-task');
  assert.ok(!serialized.includes('носков'), 'Must not leak socks');
  assert.ok(!serialized.includes('TransferService'), 'Must not leak TransferService');

  console.log('✅ normalizeCompanyContext: PASSED (both custom and generic agnostic profiles)');
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
  assert.ok(Value.Check(TutorActiveContextSchema, context), 'Basic Practice context must pass TutorActiveContextSchema');

  const richPracticePayload = {
    ...mockPracticePayload,
    persona: 'senior_socratic',
    assistanceLevel: 3,
    selectedCodeSnippet: 'return mod97 == 1;',
    cursorLine: 42,
    cursorColumn: 17,
    survivingMutants: [
      { id: 'm1', name: 'BoundaryMutator', description: 'mod97 >= 1', file: 'IbanValidator.java', line: 42, mutatedContent: 'return mod97 >= 1;' }
    ],
    activeCompassRuleId: 'MUTANT_ADVERSARY',
    activeWhiteboardSnippet: { title: 'ISO 13616 Trace', code: 'int rem = 0;', language: 'java' },
    workspaceManifest: {
      activeFile: { path: 'src/main/java/IbanValidator.java', content: 'class IbanValidator {}' },
      secondaryFiles: [{ path: 'src/test/java/IbanValidatorTest.java', content: 'class IbanValidatorTest {}' }],
      projectTree: ['src/main/java/IbanValidator.java', 'src/test/java/IbanValidatorTest.java'],
      xmlManifest: '<workspace_manifest />'
    },
    academyBridgeContext: {
      courseId: 'java-senior-sprint',
      stepId: 'step-3',
      moduleTitle: 'Modular Arithmetic',
      learningObjective: 'Prevent integer overflow',
      targetConcepts: ['Streaming mod 97', 'Boundary testing']
    },
    hintTier: 2
  };

  const richContext = normalizePracticeContext(richPracticePayload);
  assert.strictEqual(richContext.persona, 'senior_socratic');
  assert.strictEqual(richContext.assistanceLevel, 3);
  assert.strictEqual(richContext.selectedCodeSnippet, 'return mod97 == 1;');
  assert.strictEqual(richContext.cursorLine, 42);
  assert.strictEqual(richContext.cursorColumn, 17);
  assert.strictEqual(richContext.survivingMutants.length, 1);
  assert.strictEqual(richContext.activeCompassRuleId, 'MUTANT_ADVERSARY');
  assert.strictEqual(richContext.activeWhiteboardSnippet.title, 'ISO 13616 Trace');
  assert.strictEqual(richContext.workspaceManifest.projectTree.length, 2);
  assert.strictEqual(richContext.academyBridgeContext.moduleTitle, 'Modular Arithmetic');
  assert.strictEqual(richContext.hintTier, 2);
  assert.strictEqual(richContext.kataInstructions, mockPracticePayload.kataInstructions);
  assert.ok(Value.Check(TutorActiveContextSchema, richContext), 'Rich Practice context must pass TutorActiveContextSchema');

  console.log('✅ normalizePracticeContext: PASSED (legacy minimal + full Spec 58 fields)');
}

// 4. Test System Design Context Normalizer + Schema check across arenas
{
  const sdContext = normalizeSystemDesignContext({
    scenarioId: 'sd-rate-limiter',
    scenarioTitle: 'Distributed Rate Limiter',
    targetLevel: 'L5_SENIOR',
    activeStudioTab: 'runtime',
    activeCodeSnippet: 'public class TokenBucket {}',
    activeFilePath: 'src/main/java/TokenBucket.java',
    topologySummary: 'gateway -> redis_cluster',
    capacityMathSummary: '100k RPS',
    companyContextName: 'BigTech Core'
  });
  assert.strictEqual(sdContext.arena, 'system_design');
  assert.ok(Value.Check(TutorActiveContextSchema, sdContext), 'System Design context must pass TutorActiveContextSchema');
  console.log('✅ normalizeSystemDesignContext + schema parity: PASSED');
}

// 5. Test Spec 62 Incidents / Bug Hunt Context Normalizer
{
  const bugCtx = normalizeIncidentsContext({
    bugId: 'bug-race-counter-01',
    title: 'Thread-Unsafe Counter Under Virtual Threads',
    topic: 'concurrency',
    difficulty: 'Senior',
    buggyCode: 'private int count = 0;\npublic void inc() { count++; }',
    bugType: 'RACE_CONDITION',
    incidentContext: 'Счётчик теряет инкременты под нагрузкой.',
    hintCost: 'Подумай об атомарности RMW',
    language: 'java',
    selectedCodeSnippet: 'public void inc() { count++; }',
    cursorLine: 2,
    tutorRole: 'code_review',
    persona: 'senior_socratic',
    assistanceLevel: 3
  });
  assert.strictEqual(bugCtx.arena, 'incidents');
  assert.strictEqual(bugCtx.tutorRole, 'code_review');
  assert.strictEqual(bugCtx.cursorLine, 2);
  assert.strictEqual(bugCtx.incidentMeta.bugType, 'RACE_CONDITION');
  assert.ok(bugCtx.quickActionChips && bugCtx.quickActionChips.length >= 3);
  assert.ok(Value.Check(TutorActiveContextSchema, bugCtx), 'Bug Hunt incidents context must pass TutorActiveContextSchema');
  console.log('✅ normalizeIncidentsContext + schema parity: PASSED');
}

console.log('🎉 All Polymorphic Tutor Normalizer tests passed deterministically in 0ms!');
