const assert = require('assert');
const Database = require('better-sqlite3');

console.log('========================================================================');
console.log('🧪 SPEC 43 CHALLENGE EVALUATION SESSION & REPOSITORY PORT TESTS');
console.log('========================================================================\n');

const { ChallengeEvaluationSession } = require('../dist/services/sandbox/ChallengeEvaluationSession');
const {
  ChallengeSubmissionRepository,
  validateWorkspaceFiles,
  WorkspaceValidationError
} = require('../dist/services/sandbox/ChallengeSubmissionRepository');

function createInMemoryPracticeDb() {
  const memDb = new Database(':memory:');
  memDb.exec(`
    CREATE TABLE coding_challenges (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      manifest_json TEXT NOT NULL
    );
    CREATE TABLE coding_submissions (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      files_json TEXT,
      active_phase INTEGER DEFAULT 1,
      status TEXT,
      score INTEGER,
      evaluation_json TEXT,
      time_spent_seconds INTEGER DEFAULT 0,
      updated_at TEXT
    );
  `);
  memDb.prepare('INSERT INTO coding_challenges (id, slug, manifest_json) VALUES (?, ?, ?)').run(
    'kata_spec43',
    'kata-spec43-slug',
    JSON.stringify({
      id: 'kata_spec43',
      slug: 'kata-spec43-slug',
      title: 'Spec 43 Mutation Kata',
      category: 'machine_coding',
      track: 'core',
      badge: 'Kata',
      difficulty: 'Senior',
      targetStack: 'Java 21',
      timeLimitMinutes: 30,
      shortDescription: 'Spec 43 test challenge',
      instructionsMarkdown: 'Solve it',
      workspaceFiles: [],
      requiredMutationScore: 75,
      mutants: [{ id: 'm1', name: 'Negate condition', file: 'Main.java', line: 5 }]
    })
  );
  return memDb;
}

async function runSpec43Tests() {
  // 1. validateWorkspaceFiles boundary checks
  assert.throws(() => validateWorkspaceFiles(null), (err) => err instanceof WorkspaceValidationError && err.code === 'INVALID_FILES' && err.statusCode === 400);
  assert.throws(() => validateWorkspaceFiles([]), (err) => err instanceof WorkspaceValidationError && err.code === 'EMPTY_FILES');
  assert.doesNotThrow(() => validateWorkspaceFiles([], { allowEmpty: true }));
  const tooMany = Array.from({ length: 16 }, (_, i) => ({ path: `F${i}.java`, content: 'class F {}' }));
  assert.throws(() => validateWorkspaceFiles(tooMany), (err) => err instanceof WorkspaceValidationError && err.code === 'MAX_FILES_EXCEEDED');
  assert.throws(
    () => validateWorkspaceFiles([{ path: 'Huge.java', content: 'a'.repeat(200_001) }]),
    (err) => err instanceof WorkspaceValidationError && err.code === 'MAX_FILE_BYTES_EXCEEDED'
  );
  console.log('  ✅ validateWorkspaceFiles boundary checks passed');

  // 2. Repository manifest slug resolution + canonical v2 persistence
  const memDb = createInMemoryPracticeDb();
  const repo = new ChallengeSubmissionRepository(memDb);
  assert.strictEqual(repo.resolveCanonicalChallengeId('kata-spec43-slug'), 'kata_spec43', 'Must resolve slug -> canonical id');
  assert.ok(repo.loadManifest('kata-spec43-slug')?.title === 'Spec 43 Mutation Kata', 'Must load manifest by slug');

  // 3. Full 5-gate happy path with skipPreScan=true on Gate 3 & tenant userId forwarding to llmJudge
  let seenSkipPreScan = false;
  let seenLlmUserId = null;
  const sessionOk = new ChallengeEvaluationSession({
    submissionRepo: repo,
    jvmRunner: async () => ({
      success: true, isCompilable: true, compilationTimeMs: 12, executionTimeMs: 20, totalDurationMs: 32,
      passedCount: 2, failedCount: 0, testResults: [{ testName: 'T1', status: 'PASSED', durationMs: 5 }]
    }),
    staticAnalyzer: () => ({ passed: true, violations: [] }),
    mutationRunner: async (req) => {
      seenSkipPreScan = Boolean(req.skipPreScan);
      return {
        isMutationRun: true, baselinePassed: true, totalMutants: 4, killedCount: 4, survivedCount: 0,
        mutationScore: 100, passedThreshold: true, requiredScore: 75, executionTimeMs: 40, mutantResults: []
      };
    },
    llmJudge: async (req) => {
      seenLlmUserId = req.userId;
      return {
        compilationStatus: { isCompilable: true, syntaxErrors: [] },
        virtualExecutionResult: { passCount: 2, failCount: 0, testCases: [] },
        concurrencyAnalysis: { hasRaceConditions: false, hasJmmVisibilityIssues: false, hasCarrierThreadPinning: false, findings: [] },
        architecturalCompliance: { isSolidCompliant: true, springBootBestPracticesViolations: [], modernJava21IdiomAdoption: ['Records'] },
        scoreBreakdown: { correctnessScore: 95, concurrencyScore: 90, architectureScore: 92, modernIdiomsScore: 94, overallScore: 93, summaryReview: 'Clean.' },
        evaluationTimestamp: new Date().toISOString(),
        astSignalsSummary: []
      };
    }
  });

  const okEvents = [];
  for await (const ev of sessionOk.runGates({
    challengeId: 'kata-spec43-slug',
    userId: 'tenant_alice',
    codeFiles: [{ path: 'Main.java', content: 'public class Main {}' }],
    activePhase: 1,
    timeSpentSeconds: 95
  })) {
    okEvents.push(ev);
  }
  assert.strictEqual(seenSkipPreScan, true, 'Gate 3 mutationRunner must receive skipPreScan=true after Gate 2');
  assert.strictEqual(seenLlmUserId, 'tenant_alice', 'Gate 4 llmJudge must receive tenant userId');
  assert.strictEqual(okEvents[okEvents.length - 1].gate, 'PERSISTENCE');
  assert.strictEqual(okEvents[okEvents.length - 1].status, 'PASSED');
  assert.strictEqual(sessionOk.getTerminalVerdict()?.status, 'PASSED');

  const aliceSub = memDb.prepare('SELECT * FROM coding_submissions WHERE challenge_id = ? AND user_id = ?').get('kata_spec43', 'tenant_alice');
  assert.ok(aliceSub, 'Submission must persist under canonical challengeId for tenant_alice');
  const aliceEval = JSON.parse(aliceSub.evaluation_json);
  assert.strictEqual(aliceEval.schemaVersion, 2, 'Canonical persisted evaluation must have schemaVersion: 2');
  console.log('  ✅ Happy path port test (skipPreScan, userId propagation, v2 schema) passed');

  // 4. Gate 3 MUTATION_TESTS failure persists FAILED verdict & skips LLM judge
  let llmCalledOnMutationFail = false;
  const sessionMutFail = new ChallengeEvaluationSession({
    submissionRepo: repo,
    jvmRunner: async () => ({
      success: true, isCompilable: true, compilationTimeMs: 10, executionTimeMs: 10, totalDurationMs: 20,
      passedCount: 1, failedCount: 0, testResults: [{ testName: 'T1', status: 'PASSED', durationMs: 3 }]
    }),
    staticAnalyzer: () => ({ passed: true, violations: [] }),
    mutationRunner: async () => ({
      isMutationRun: true, baselinePassed: true, totalMutants: 4, killedCount: 1, survivedCount: 3,
      mutationScore: 25, passedThreshold: false, requiredScore: 75, executionTimeMs: 30, mutantResults: []
    }),
    llmJudge: async () => {
      llmCalledOnMutationFail = true;
      throw new Error('Should not invoke LLM on Gate 3 failure');
    }
  });

  const mutEvents = [];
  for await (const ev of sessionMutFail.runGates({
    challengeId: 'kata-spec43-slug',
    userId: 'tenant_bob',
    codeFiles: [{ path: 'Main.java', content: 'public class Main {}' }],
    activePhase: 1,
    timeSpentSeconds: 30
  })) {
    mutEvents.push(ev);
  }
  const mutFailEv = mutEvents.find((e) => e.gate === 'MUTATION_TESTS' && e.status === 'FAILED');
  assert.ok(mutFailEv, 'Must emit MUTATION_TESTS FAILED event');
  assert.ok(mutFailEv.payload?.evaluation, 'MUTATION_TESTS FAILED must attach structured evaluation payload');
  assert.strictEqual(llmCalledOnMutationFail, false, 'LLM judge must NOT be invoked when Gate 3 fails');
  assert.strictEqual(sessionMutFail.getTerminalVerdict()?.status, 'FAILED', 'getTerminalVerdict must reflect Gate 3 failure');
  assert.strictEqual(sessionMutFail.getTerminalVerdict()?.score, 25);

  const bobSub = memDb.prepare('SELECT * FROM coding_submissions WHERE challenge_id = ? AND user_id = ?').get('kata_spec43', 'tenant_bob');
  assert.ok(bobSub, 'Gate 3 FAILED must persist row in coding_submissions');
  assert.strictEqual(bobSub.status, 'FAILED');
  assert.strictEqual(bobSub.score, 25);
  assert.strictEqual(JSON.parse(bobSub.evaluation_json).schemaVersion, 2);
  console.log('  ✅ Gate 3 MUTATION_TESTS terminal persistence & early exit verified');

  console.log('\n🎉 All Spec 43 ChallengeEvaluationSession tests PASSED!\n');
}

runSpec43Tests().catch((err) => {
  console.error('❌ Spec 43 test suite failed:', err);
  process.exit(1);
});
