/**
 * test_live_tool_executor_workspace.js
 * Deterministic :memory: SQLite & fake-port verification suite for Spec 56 (#204):
 * 1. ?awaitInit=1 earlyQueue replay preserves explicit questionText, enforces precedence
 *    (explicit questionText > bugTitle > challenge.title), and forwards dossierId/jobId/questionMatrixId.
 * 2. Overlapping async ToolAudioMutex batches keep shouldGateMicAudio() & isToolCallPending armed
 *    until the last call.id completes (release in finally), plus partial cancellation.
 * 3. matchWorkspaceFilePath disambiguates main/.../Foo.java vs test/.../Foo.java, preserves isReadOnly,
 *    recomputes xmlManifest, and ensures read_file SQLite fallback does not hijack activeFile.
 * 4. resolveWhiteboardScheduling SSOT handles 24000-byte boundary consistently.
 * 5. All 7 tool dispatchers + LiveWorkspaceStore execute deterministically over :memory: SQLite / fake port.
 */

process.env.DB_PATH = ':memory:';

const assert = require('assert');
const { EventEmitter } = require('events');
const { DatabaseBootstrap } = require('../dist/services/db/DatabaseBootstrap');
const {
  LiveWorkspaceStore,
  createSqliteWorkspaceCatalogPort,
  matchWorkspaceFilePath,
  resolveWorkspaceFileMatch
} = require('../dist/services/live/LiveWorkspaceStore');
const {
  LiveToolExecutor,
  LiveToolEngine,
  createDefaultToolPersistencePort,
  resolveWhiteboardScheduling
} = require('../dist/services/live/LiveToolExecutor');
const { LiveVoiceSession } = require('../dist/services/live/LiveVoiceSession');
const { LiveSessionBlueprintBuilder } = require('../dist/services/live/LiveSessionBlueprintBuilder');
const { LiveClientGuardService } = require('../dist/services/live/liveClientGuardService');
const { ToolAudioMutex } = require('../dist/services/live/ToolAudioMutex');

function createMockSocket() {
  const sock = new EventEmitter();
  sock.readyState = 1; // WebSocket.OPEN
  sock.sent = [];
  sock.send = (raw) => {
    try { sock.sent.push(JSON.parse(raw.toString())); } catch { sock.sent.push(raw); }
  };
  sock.close = () => { sock.readyState = 3; };
  return sock;
}

function createMockUpstream() {
  const sent = [];
  return {
    sent,
    port: {
      connect: () => {},
      sendUpstream: (raw) => {
        try { sent.push(JSON.parse(raw.toString())); } catch { sent.push(raw); }
        return true;
      },
      isUpstreamOpen: () => true,
      reconnect: () => {},
      close: () => {}
    }
  };
}

function seedMemoryCatalog(memDb) {
  memDb.prepare(`
    INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('q_chm_1', 1, 1, 'Java Concurrency', 'Explain ConcurrentHashMap resize transfer in Java 21.', 'Uses ForwardingNode and cooperative transfer.', '[]');

  memDb.prepare(`
    INSERT INTO bug_challenges (id, topic_id, topic_name, title, subtopic, code_snippet, bug_explanation, fixed_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('bug_race_1', 'concurrency', 'Java Concurrency', 'Lost Update Counter', 'Atomicity', 'count++;', 'Non-atomic read-modify-write', 'atomicCount.incrementAndGet();');

  const manifest = {
    workspaceFiles: [
      { path: 'src/main/java/com/acme/Foo.java', content: 'public class Foo { int v = 1; }', readOnly: false },
      { path: 'src/test/java/com/acme/Foo.java', content: 'class FooTest { void ok() {} }', readOnly: true },
      { path: 'src/main/java/com/acme/UniqueBar.java', content: 'public class UniqueBar {}', readOnly: false },
      { path: 'pom.xml', content: '<project><artifactId>acme</artifactId></project>', readOnly: true }
    ]
  };
  memDb.prepare(`
    INSERT INTO coding_challenges (id, slug, title, category, track, badge, difficulty, target_stack, short_description, instructions_markdown, manifest_json, task_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ch_lld_1', 'rate-limiter', 'Rate Limiter', 'lld', 'lld_bigtech', 'LLD', 'Senior',
    'Java 21', 'Implement sliding window rate limiter.', '# Instructions', JSON.stringify(manifest), 'LLD-01'
  );
}

async function testAwaitInitReplayAndPrecedence(memDb) {
  console.log('[Test 1] ?awaitInit=1 earlyQueue replay preserves explicit questionText & forwards HR IDs');
  const catalogPort = createSqliteWorkspaceCatalogPort(memDb);

  // Precedence check: explicit questionText > bugTitle > challenge.title
  const targetA = { questionText: '' };
  LiveWorkspaceStore.mergeInitFrame(targetA, {
    questionText: 'Explicit Question Text',
    bugTitle: 'Bug Title',
    challenge: { title: 'Challenge Title' }
  });
  assert.strictEqual(targetA.questionText, 'Explicit Question Text');

  const targetB = { questionText: '' };
  LiveWorkspaceStore.mergeInitFrame(targetB, { bugTitle: 'Bug Title', challenge: { title: 'Challenge Title' } });
  assert.strictEqual(targetB.questionText, 'Bug Title');

  const targetC = { questionText: '' };
  LiveWorkspaceStore.mergeInitFrame(targetC, { challenge: { title: 'Challenge Title' } });
  assert.strictEqual(targetC.questionText, 'Challenge Title');

  // Replay via ?awaitInit=1 + earlyQueue must NOT overwrite explicit questionText with challenge.title or bugTitle
  const clientSocket = createMockSocket();
  const earlyQueue = [];
  const deps = {
    authenticate: () => ({ id: 'user_spec56', name: 'Candidate', role: 'user' }),
    findGaps: async () => [],
    getUserProfile: () => ({ targetSeniority: 'Senior', primaryStack: 'Java 21' }),
    resolveChallenge: (input) => LiveWorkspaceStore.resolve(input, catalogPort).getResolved()
  };

  setTimeout(() => {
    clientSocket.emit('message', Buffer.from(JSON.stringify({
      type: 'session_init',
      bugTitle: 'Short Bug Title',
      challenge: { title: 'Short Challenge Title' },
      dossierId: 'dossier_late_1',
      jobId: 'job_late_2',
      questionMatrixId: 'matrix_late_3'
    })));
  }, 15);

  const liveSession = await LiveVoiceSession.start({
    clientSocket,
    req: { url: '/ws/live?sessionId=spec56_await&awaitInit=1&questionText=Explicit+URL+Question' },
    earlyQueue,
    initWaitTimeoutMs: 150,
    blueprintBuilder: (req, rawInit) => LiveSessionBlueprintBuilder.resolveFromRequest(req, rawInit, deps),
    createUpstream: (opts) => {
      opts.session.isSetupComplete = true;
      return createMockUpstream().port;
    }
  });

  assert(liveSession, 'LiveVoiceSession.start resolves cleanly');
  const session = liveSession.turnState.proxySession;
  assert.strictEqual(session.questionText, 'Explicit URL Question', 'earlyQueue replay MUST preserve explicit questionText');
  assert.strictEqual(session.bugTitle, 'Short Bug Title', 'bugTitle still hydrated');
  assert.strictEqual(session.dossierId, 'dossier_late_1', 'dossierId forwarded');
  assert.strictEqual(session.jobId, 'job_late_2', 'jobId forwarded');
  assert.strictEqual(session.questionMatrixId, 'matrix_late_3', 'questionMatrixId forwarded');
  assert(liveSession.watchdogs && liveSession.watchdogs === liveSession.turnState.watchdogs && session.watchdogs === liveSession.watchdogs, 'WatchdogManager initialized cleanly inside SessionTurnState');

  // Late post-connect session_init also preserves resolved questionText and forwards IDs
  LiveWorkspaceStore.applyClientFrame(session, {
    type: 'session_init',
    questionText: 'Stale Late Frame Question',
    bugTitle: 'Other Bug',
    challenge: { title: 'Other Challenge' },
    dossierId: 'dossier_updated',
    jobId: 'job_updated',
    questionMatrixId: 'matrix_updated'
  });
  assert.strictEqual(session.questionText, 'Explicit URL Question', 'applyClientFrame preserves resolved questionText');
  assert.strictEqual(session.dossierId, 'dossier_updated');
  assert.strictEqual(session.jobId, 'job_updated');
  assert.strictEqual(session.questionMatrixId, 'matrix_updated');

  liveSession.terminate('Test1Done', 1000, 'Test');
  console.log('  ✅ Test 1 passed\n');
}

async function testOverlappingToolAudioMutexBatches() {
  console.log('[Test 2] Overlapping async ToolAudioMutex batches release per call.id in finally');
  const clientSocket = createMockSocket();
  const upstream = createMockUpstream();
  const session = {
    clientSocket,
    isSetupComplete: true,
    frameQueue: [],
    sessionId: 'sess_mutex_56',
    questionId: 'ch_lld_1',
    lastActivityAt: Date.now(),
    hasCandidateResponded: true,
    isToolCallPending: false,
    toolAudioMutex: new ToolAudioMutex()
  };

  let releaseSlowCall;
  const slowCallGate = new Promise((resolve) => { releaseSlowCall = resolve; });
  const fakePort = {
    async saveEvaluationOutcome() { return { evaluationId: 'e1' }; },
    saveSystemDesignSubmission() {},
    async updateBugSolved() {},
    async readChallengeFileFromStore(_cid, filePath) {
      if (filePath === 'slow.txt') {
        await slowCallGate;
        return { path: 'slow.txt', content: 'slow content' };
      }
      return { path: 'fast.txt', content: 'fast content' };
    }
  };

  const batch1 = LiveToolExecutor.executeFunctionCalls({
    functionCalls: [{ id: 'call_slow', name: 'read_file', args: { filePath: 'slow.txt' } }],
    clientSocket,
    upstream: upstream.port,
    session,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: fakePort });

  await new Promise((r) => setTimeout(r, 15));
  assert.strictEqual(session.toolAudioMutex.shouldGateMicAudio(), true);
  assert.strictEqual(session.toolAudioMutex.activeCount, 1);
  assert.strictEqual(session.isToolCallPending, true);

  const batch2 = LiveToolExecutor.executeFunctionCalls({
    functionCalls: [{ id: 'call_fast', name: 'read_file', args: { filePath: 'fast.txt' } }],
    clientSocket,
    upstream: upstream.port,
    session,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: fakePort });

  await batch2;
  assert.strictEqual(session.toolAudioMutex.shouldGateMicAudio(), true, 'Fast batch completion must NOT blind-reset mutex while slow call is active');
  assert.strictEqual(session.toolAudioMutex.activeCount, 1, 'Only call_fast released; call_slow remains armed');
  assert.strictEqual(session.isToolCallPending, true, 'isToolCallPending stays synced true while activeCount > 0');
  assert.strictEqual(LiveClientGuardService.shouldSuppressEchoChunk(session, true, false, 'auto'), true, 'EchoGuard gates mic audio while activeCount > 0');

  releaseSlowCall();
  await batch1;
  assert.strictEqual(session.toolAudioMutex.shouldGateMicAudio(), false, 'Mutex disarms after last call.id releases');
  assert.strictEqual(session.toolAudioMutex.activeCount, 0);
  assert.strictEqual(session.isToolCallPending, false, 'isToolCallPending clears when activeCount === 0');
  assert.strictEqual(LiveClientGuardService.shouldSuppressEchoChunk(session, true, false, 'auto'), false);

  // Cancellation of 1 call leaves other active call armed
  session.toolAudioMutex.acquire('c_keep');
  session.toolAudioMutex.acquire('c_cancel');
  session.isToolCallPending = true;
  LiveToolExecutor.handleCancellation(session, ['c_cancel']);
  assert.strictEqual(session.toolAudioMutex.shouldGateMicAudio(), true);
  assert.strictEqual(session.isToolCallPending, true);
  session.toolAudioMutex.release('c_keep');

  console.log('  ✅ Test 2 passed\n');
}

async function testWorkspacePathDisambiguationAndReadFileFallback(memDb) {
  console.log('[Test 3] matchWorkspaceFilePath disambiguation, isReadOnly, xmlManifest & read_file fallback');
  const catalogPort = createSqliteWorkspaceCatalogPort(memDb);
  const resolved = LiveWorkspaceStore.resolve({ challengeId: 'ch_lld_1', questionId: 'ch_lld_1' }, catalogPort).getResolved();
  const files = resolved.workspaceManifest.files;
  const allPaths = files.map((f) => f.path);

  assert.strictEqual(resolved.workspaceManifest.fileCount, 4, 'Merged/loaded manifest preserves both main and test Foo.java');
  assert.strictEqual(resolveWorkspaceFileMatch(files, 'src/test/java/com/acme/Foo.java').match.path, 'src/test/java/com/acme/Foo.java');
  assert.strictEqual(resolveWorkspaceFileMatch(files, '/test/java/com/acme/Foo.java').match.path, 'src/test/java/com/acme/Foo.java');
  const ambig = resolveWorkspaceFileMatch(files, 'Foo.java');
  assert.strictEqual(ambig.match, null, 'Ambiguous basename returns null');
  assert.strictEqual(ambig.ambiguous, true, 'Ambiguous basename flagged');
  assert.strictEqual(ambig.matches.length, 2);
  assert.strictEqual(resolveWorkspaceFileMatch(files, 'UniqueBar.java').match.path, 'src/main/java/com/acme/UniqueBar.java');
  assert.strictEqual(matchWorkspaceFilePath('src/main/java/com/acme/Foo.java', 'Foo.java', allPaths), false);
  assert.strictEqual(matchWorkspaceFilePath('src/main/java/com/acme/UniqueBar.java', 'UniqueBar.java', allPaths), true);

  // workspace_active_file_changed preserves isReadOnly and recomputes xmlManifest
  const session = {
    clientSocket: createMockSocket(),
    isSetupComplete: true,
    frameQueue: [],
    lastActivityAt: Date.now(),
    workspaceManifest: resolved.workspaceManifest,
    codeSnippet: resolved.codeSnippet,
    activeFilePath: resolved.activeFilePath
  };
  LiveWorkspaceStore.applyClientFrame(session, { type: 'workspace_active_file_changed', path: 'src/test/java/com/acme/Foo.java' });
  assert.strictEqual(session.workspaceManifest.activeFile.path, 'src/test/java/com/acme/Foo.java');
  assert.strictEqual(session.workspaceManifest.activeFile.isReadOnly, true, 'isReadOnly preserved on workspace_active_file_changed');
  assert(session.workspaceManifest.xmlManifest.includes('<project_workspace active_file="src/test/java/com/acme/Foo.java">'), 'xmlManifest updated on active file change');
  assert(session.workspaceManifest.xmlManifest.includes('read_only="true"'), 'xmlManifest preserves read_only="true"');

  // read_file SQLite fallback does NOT hijack activeFile / codeSnippet unless markActive === true
  const sparseSession = {
    clientSocket: createMockSocket(),
    isSetupComplete: true,
    frameQueue: [],
    lastActivityAt: Date.now(),
    questionId: 'ch_lld_1',
    codeSnippet: 'public class InitialEditorCode {}',
    activeFilePath: 'src/Initial.java',
    workspaceManifest: {
      activeFile: { path: 'src/Initial.java', content: 'public class InitialEditorCode {}', isReadOnly: false },
      files: [{ path: 'src/Initial.java', content: 'public class InitialEditorCode {}', isReadOnly: false }],
      secondaryFiles: [],
      projectTree: ['src/Initial.java']
    },
    hasCandidateResponded: true
  };
  const upstream = createMockUpstream();
  const realPort = createDefaultToolPersistencePort({ database: memDb });
  await LiveToolExecutor.executeFunctionCalls({
    functionCalls: [{ id: 'rf_pom', name: 'read_file', args: { filePath: 'pom.xml' } }],
    clientSocket: sparseSession.clientSocket,
    upstream: upstream.port,
    session: sparseSession,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: realPort });

  const pomResp = upstream.sent.find((m) => m.toolResponse?.functionResponses?.[0]?.id === 'rf_pom');
  assert.strictEqual(pomResp.toolResponse.functionResponses[0].response.result.success, true);
  assert(pomResp.toolResponse.functionResponses[0].response.result.content.includes('<artifactId>acme</artifactId>'));
  assert.strictEqual(sparseSession.workspaceManifest.activeFile.path, 'src/Initial.java', 'read_file SQLite fallback MUST NOT hijack activeFile');
  assert.strictEqual(sparseSession.codeSnippet, 'public class InitialEditorCode {}', 'read_file SQLite fallback MUST NOT hijack codeSnippet');

  // Explicit markActive: true promotes file when explicitly requested
  await LiveToolExecutor.executeFunctionCalls({
    functionCalls: [{ id: 'rf_pom_active', name: 'read_file', args: { filePath: 'pom.xml', markActive: true } }],
    clientSocket: sparseSession.clientSocket,
    upstream: upstream.port,
    session: sparseSession,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: realPort });
  assert.strictEqual(sparseSession.workspaceManifest.activeFile.path, 'pom.xml', 'markActive: true switches activeFile');
  assert(sparseSession.codeSnippet.includes('<artifactId>acme</artifactId>'));

  console.log('  ✅ Test 3 passed\n');
}

async function testAllToolDispatchersOverMemorySqlite(memDb) {
  console.log('[Test 4] All 7 tool dispatchers + resolveWhiteboardScheduling SSOT over :memory: SQLite');
  assert.strictEqual(LiveToolEngine, LiveToolExecutor, 'LiveToolEngine alias preserved');
  assert.strictEqual(resolveWhiteboardScheduling('write', 0), 'WHEN_IDLE');
  assert.strictEqual(resolveWhiteboardScheduling('write', 23999), 'WHEN_IDLE');
  assert.strictEqual(resolveWhiteboardScheduling('write', 24000), 'SILENT');
  assert.strictEqual(resolveWhiteboardScheduling('clear', 0), 'SILENT');

  const decayCalls = [];
  const fakeMemory = {
    async updateFsrsCardState(p) { return { card: p, propagatedCount: 0, propagatedNeighbors: [] }; },
    async applyKnowledgeDecay(p) { decayCalls.push(p); return { updatedGaps: [], masteredCount: 0 }; },
    async recordNewErrorGap() { return 'gap_mem_1'; },
    async recordReview(e) { return { card: e, propagatedCount: 0, propagatedNeighbors: [], knowledgeUpdate: {} }; }
  };
  const port = createDefaultToolPersistencePort({ database: memDb, memoryAggregate: fakeMemory });

  const clientSocket = createMockSocket();
  const upstream = createMockUpstream();

  // Turn 0 lockdown blocks submit_interview_evaluation & submit_hiring_committee_verdict
  const turn0Session = {
    clientSocket,
    isSetupComplete: true,
    frameQueue: [],
    lastActivityAt: Date.now(),
    sessionId: 'sess_turn0_block',
    questionId: 'q_chm_1',
    hasCandidateResponded: false
  };
  await LiveToolExecutor.executeFunctionCalls({
    functionCalls: [
      { id: 't0_eval', name: 'submit_interview_evaluation', args: { score: 90, isPassed: true, positivePoints: ['ok'], missingPoints: [], spokenFeedback: 'ok' } },
      { id: 't0_sd', name: 'submit_hiring_committee_verdict', args: { target_level: 'L6', calibrated_level: 'L5', verdict: 'HIRE', scores: { exploration: 3, architecture: 3, deep_dives: 3, operational_excellence: 3 }, calibration_defense: 'ok' } }
    ],
    clientSocket,
    upstream: upstream.port,
    session: turn0Session,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: port });
  assert(upstream.sent.find((m) => m.toolResponse?.functionResponses?.[0]?.id === 't0_eval').toolResponse.functionResponses[0].response.error);
  assert(upstream.sent.find((m) => m.toolResponse?.functionResponses?.[0]?.id === 't0_sd').toolResponse.functionResponses[0].response.error);

  // Execute all tools cleanly after candidate spoke (without userId -> normalizes to 'default_user', never 'anonymous')
  upstream.sent.length = 0;
  clientSocket.sent.length = 0;
  const activeSession = {
    clientSocket,
    isSetupComplete: true,
    frameQueue: [],
    lastActivityAt: Date.now(),
    sessionId: 'sess_all_tools',
    questionId: 'q_chm_1',
    topic: 'Java Concurrency',
    questionText: 'Explain ConcurrentHashMap resize transfer.',
    referenceAnswer: 'ForwardingNode + cooperative resizing',
    currentArchitectureMermaid: 'graph TD; A-->B;',
    hasCandidateResponded: true
  };

  await LiveToolExecutor.executeFunctionCalls({
    functionCalls: [
      { id: 'tc_smell', name: 'report_identified_smell', args: { smellId: 'carrier_pinning', justification: 'synchronized around IO' } },
      { id: 'tc_chaos', name: 'inject_chaos_failure', args: { failure_type: 'HOT_PARTITION_KEY_SATURATION', target_component_id: 'shard_1', technical_context: 'skew 90%' } },
      { id: 'tc_obs', name: 'record_candidate_observation', args: { dimension: 'system_architecture', signal: 'GREEN_FLAG', demonstrated_level: 'L5', evidence_transcript: 'consistent hashing' } },
      {
        id: 'tc_eval',
        name: 'submit_interview_evaluation',
        args: {
          score: 85,
          isPassed: true,
          positivePoints: ['ForwardingNode'],
          missingPoints: [],
          spokenFeedback: 'Сильный ответ.',
          faangScorecard: { verdict: 'HIRE', dimensionScores: { domainDepth: 92 } }
        }
      },
      {
        id: 'tc_sd',
        name: 'submit_hiring_committee_verdict',
        args: {
          target_level: 'L6',
          calibrated_level: 'L5',
          verdict: 'HIRE',
          scores: { exploration: 3.5, architecture: 3.5, deep_dives: 3.2, operational_excellence: 3.4 },
          calibration_defense: 'Solid distributed design'
        }
      }
    ],
    clientSocket,
    upstream: upstream.port,
    session: activeSession,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: port });

  // Bug solved tool against bug_race_1
  const bugSession = { ...activeSession, questionId: 'bug_race_1', topic: 'Java Concurrency' };
  await LiveToolExecutor.executeFunctionCalls({
    functionCalls: [{ id: 'tc_bug', name: 'mark_bug_solved', args: { isSolved: true, feedback: 'AtomicInteger fixes race', keyInsight: 'CAS' } }],
    clientSocket,
    upstream: upstream.port,
    session: bugSession,
    parsedHints: [],
    liveCoaching: false
  }, { persistencePort: port });

  const evalRows = memDb.prepare('SELECT user_id, score FROM question_evaluations WHERE question_id = ?').all('q_chm_1');
  assert.strictEqual(evalRows.length, 1);
  assert.strictEqual(evalRows[0].user_id, 'default_user', 'submit_interview_evaluation normalizes empty userId to default_user');
  assert.strictEqual(evalRows[0].score, 85);

  const sdRows = memDb.prepare('SELECT user_id, scenario_id, architecture_mermaid FROM system_design_submissions WHERE scenario_id = ?').all('q_chm_1');
  assert.strictEqual(sdRows.length, 1);
  assert.strictEqual(sdRows[0].user_id, 'default_user');
  assert.strictEqual(sdRows[0].architecture_mermaid, 'graph TD; A-->B;');

  const bugRow = memDb.prepare('SELECT is_solved, last_score FROM bug_challenges WHERE id = ?').get('bug_race_1');
  assert.strictEqual(bugRow.is_solved, 1);
  assert.strictEqual(bugRow.last_score, 10);

  assert(decayCalls.length >= 2 && decayCalls.every((c) => c.userId === 'default_user'), 'All knowledge decay calls use default_user, never anonymous');

  const eventTypes = new Set(clientSocket.sent.map((e) => e.type));
  assert(eventTypes.has('smell_discovered'));
  assert(eventTypes.has('chaos_injected'));
  assert(eventTypes.has('candidate_observation_recorded'));
  assert(eventTypes.has('evaluation_completed'));
  assert(eventTypes.has('hiring_committee_verdict'));
  assert(eventTypes.has('bug_solved'));

  const evalEvent = clientSocket.sent.find((e) => e.type === 'evaluation_completed');
  assert.strictEqual(evalEvent.payload.faangScorecard.dimensionScores.domainDepth.score, 92, 'mergeFaangScorecard preserved structured comment while merging numeric score');
  assert.ok(evalEvent.payload.faangScorecard.dimensionScores.domainDepth.comment);

  console.log('  ✅ Test 4 passed\n');
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 SPEC 56 LIVE TOOL EXECUTOR & WORKSPACE STORE TEST SUITE');
  console.log('========================================================================\n');

  const memDb = DatabaseBootstrap.createDatabase(':memory:');
  seedMemoryCatalog(memDb);

  try {
    await testAwaitInitReplayAndPrecedence(memDb);
    await testOverlappingToolAudioMutexBatches();
    await testWorkspacePathDisambiguationAndReadFileFallback(memDb);
    await testAllToolDispatchersOverMemorySqlite(memDb);
    console.log('🎉 ALL SPEC 56 LIVE TOOL EXECUTOR & WORKSPACE STORE TESTS PASSED!\n');
  } finally {
    memDb.close();
  }
}

run().catch((err) => {
  console.error('❌ Spec 56 test suite failed:', err);
  process.exit(1);
});
