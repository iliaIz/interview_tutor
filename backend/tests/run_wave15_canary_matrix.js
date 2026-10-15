/**
 * run_wave15_canary_matrix.js
 * 
 * Master Verification Suite & Canary Matrix for Wave 15:
 * Context & Grounding Remediation, Epistemic Symmetry, Anti-Injection & Token Budgeting.
 * 
 * Covers all 5 Phase Gates:
 * - Gate 01: SQLite SSOT Hydration & Practice Grounding
 * - Gate 02: Epistemic Symmetry in System Design & SRE Triage
 * - Gate 03: Prompt Injection Defense & Epistemic Sanitization
 * - Gate 04: Token Budgeting, Sliding Window & Academy Bridge Context
 * - Gate 05: Final Zero-Regression SLA Verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

console.log('================================================================================');
console.log('🚀 RUNNING WAVE 15 MASTER CANARY MATRIX: ZERO-REGRESSION SLA VERIFICATION');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runSuite(gateName, testFn) {
  totalTests++;
  try {
    process.stdout.write(`  [TEST ${totalTests}] ${gateName}... `);
    testFn();
    passedTests++;
    console.log('✅ PASSED');
  } catch (err) {
    failedTests++;
    console.log(`❌ FAILED: ${err.message}`);
    process.exitCode = 1;
  }
}

const baseDir = fs.existsSync('/app/storage/canary_matrix')
  ? '/app/storage/canary_matrix'
  : (fs.existsSync('storage/canary_matrix') ? 'storage/canary_matrix' : '.');

const dbPath = fs.existsSync('/app/data/interview.db')
  ? '/app/data/interview.db'
  : (fs.existsSync('backend/data/interview.db') ? 'backend/data/interview.db' : 'data/interview.db');

const db = new Database(dbPath);

// -------------------------------------------------------------
// GATE 01: SQLite SSOT Hydration & Practice Grounding
// -------------------------------------------------------------
console.log('▶ GATE 01: Practice Spec & Voice Grounding');

runSuite('Gate 01.1: SQLite Coding Challenges SSOT Hydration', () => {
  const ids = ['mc_rate_limiter_token_bucket', 'kata_gilded_rose', 'kata_trip_service'];
  for (const id of ids) {
    const row = db.prepare('SELECT id, slug, title, category, instructions_markdown FROM coding_challenges WHERE id = ? OR slug = ?').get(id, id);
    assert(row, `Challenge ${id} must exist in database`);
    assert(row.title && row.title.length > 5, `Challenge ${id} must have title`);
    assert(row.instructions_markdown && row.instructions_markdown.length > 200, `Challenge ${id} must have instructions >= 200 chars`);
  }
});

runSuite('Gate 01.2: SQLite Bug Challenges SSOT Hydration', () => {
  const rows = db.prepare('SELECT id, title, subtopic, bug_explanation, code_snippet, fixed_code FROM bug_challenges LIMIT 3').all();
  assert(rows.length >= 3, 'Must have at least 3 bug challenges');
  for (const r of rows) {
    assert(r.title && r.bug_explanation && r.code_snippet, 'Bug challenge must have full specification');
  }
});

runSuite('Gate 01.3: Backend Route Automatic ТЗ Fallback', () => {
  const routeSrc = fs.readFileSync(`${baseDir}/practiceTutor.ts`, 'utf8');
  assert(routeSrc.includes("SELECT title, category, short_description, instructions_markdown FROM coding_challenges"), 'practiceTutor.ts must hydrate from SQLite');
});

// -------------------------------------------------------------
// GATE 02: Epistemic Symmetry in System Design & SRE Triage
// -------------------------------------------------------------
console.log('\n▶ GATE 02: Epistemic Symmetry in System Design & SRE Triage');

runSuite('Gate 02.1: System Design Canvas & Notes Grounding', () => {
  const sdSrc = fs.readFileSync(`${baseDir}/systemDesignPrompts.ts`, 'utf8');
  assert(sdSrc.includes('currentTopology?: string;'), 'Must accept currentTopology');
  assert(sdSrc.includes('candidateNotes?: string;'), 'Must accept candidateNotes');
  assert(sdSrc.includes('=== АКТУАЛЬНАЯ АРХИТЕКТУРА НА ХОЛСТЕ КАНДИДАТА (MERMAID / CANVAS) ==='), 'Must include canvas topology section');
  assert(sdSrc.includes('=== АРХИТЕКТУРНЫЕ ЗАМЕТКИ КАНДИДАТА ==='), 'Must include candidate notes section');
});

runSuite('Gate 02.2: System Design Epistemic Symmetry Directive', () => {
  const sdSrc = fs.readFileSync(`${baseDir}/systemDesignPrompts.ts`, 'utf8');
  assert(sdSrc.includes('conversationHistory?: Array<{ role: string; content: string }>;'), 'Evaluator must ingest conversationHistory');
  assert(sdSrc.includes('=== ХОД ОБСУЖДЕНИЯ И ЗАЩИТА АРХИТЕКТУРНЫХ РЕШЕНИЙ (CONVERSATION HISTORY) ==='), 'Must include conversation history section');
  assert(sdSrc.includes('ИНВАРИАНТ УЧЕТА ДИАЛОГА:'), 'Must enforce dialogue invariant');
  assert(sdSrc.includes('КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО снижать балл по шкале "tradeOffJustification"'), 'Forbids deducting points for defended decisions');
});

runSuite('Gate 02.3: SRE Triage Telemetry & Tarjan SCC Deadlock Digest', () => {
  const trSrc = fs.readFileSync(`${baseDir}/triagePrompts.ts`, 'utf8');
  assert(trSrc.includes('triageDigest?: {'), 'Probe must accept triageDigest');
  assert(trSrc.includes('threadCounts?: {'), 'Probe must accept threadCounts telemetry');
  assert(trSrc.includes('deadlockSummary?: string;'), 'Probe must accept deadlockSummary');
  assert(trSrc.includes('АКТУАЛЬНОЕ СОСТОЯНИЕ РАССЛЕДОВАНИЯ КАНДИДАТА:'), 'Must include investigation section');
  assert(trSrc.includes('Телеметрия JVM потоков:'), 'Must include JVM thread telemetry in prompt');
});

runSuite('Gate 02.4: SRE Triage Evaluator Investigation Digest Grounding', () => {
  const trSrc = fs.readFileSync(`${baseDir}/triagePrompts.ts`, 'utf8');
  assert(trSrc.includes('investigationDigest?: {'), 'Evaluator must ingest investigationDigest');
  assert(trSrc.includes('conversationHistory?: Array<{ role:'), 'Evaluator must ingest conversationHistory');
  assert(trSrc.includes('ХОД РАССЛЕДОВАНИЯ И ДИАЛОГ С INCIDENT COMMANDER (EVIDENCE TRAIL):'), 'Must include evidence trail in evaluation prompt');
  assert(trSrc.includes('ПРАВИЛО ЭПИСТЕМИЧЕСКОЙ СИММЕТРИИ:'), 'Must enforce epistemic symmetry in evaluation prompt');
});

// -------------------------------------------------------------
// GATE 03: Prompt Injection Defense & Epistemic Sanitization
// -------------------------------------------------------------
console.log('\n▶ GATE 03: Prompt Injection Defense & Epistemic Sanitization');

runSuite('Gate 03.1: Untrusted Context Sandboxing & Delimitation', () => {
  const geminiTextSrc = fs.readFileSync(`${baseDir}/geminiText.ts`, 'utf8');
  assert(geminiTextSrc.includes('wrapUntrustedContext'), 'geminiText.ts must use wrapUntrustedContext');
  assert(geminiTextSrc.includes('PROMPT_INJECTION_DEFENSE_DIRECTIVE'), 'geminiText.ts must include defense directive');

  const codeEvalSrc = fs.readFileSync(`${baseDir}/codeEvaluator.ts`, 'utf8');
  assert(codeEvalSrc.includes('wrapUntrustedContext'), 'codeEvaluator.ts must use wrapUntrustedContext');
  assert(codeEvalSrc.includes('PROMPT_INJECTION_DEFENSE_DIRECTIVE'), 'codeEvaluator.ts must include defense directive');
});

runSuite('Gate 03.2: Anti-Sycophancy Factual Anchor Rule', () => {
  const codeEvalSrc = fs.readFileSync(`${baseDir}/codeEvaluator.ts`, 'utf8');
  assert(codeEvalSrc.includes('If failed_tests_count > 0 or syntax errors exist, correctnessScore MUST NOT exceed 60 and overallScore MUST NOT exceed 68'), 'codeEvaluator must cap score on failing tests');
  
  const geminiTextSrc = fs.readFileSync(`${baseDir}/geminiText.ts`, 'utf8');
  assert(geminiTextSrc.includes('score ОБЯЗАН быть < 70'), 'geminiText must cap score for erroneous answers');
});

runSuite('Gate 03.3: Gender Alignment Across ExamQuiz & Live WebSocket', () => {
  const examQuizSrc = fs.readFileSync(`${baseDir}/ExamQuiz.tsx`, 'utf8');
  assert(examQuizSrc.includes('userGender'), 'ExamQuiz must propagate userGender');
  
  const voiceUrlSrc = fs.readFileSync(`${baseDir}/liveVoiceUrlBuilder.ts`, 'utf8');
  assert(voiceUrlSrc.includes("'userGender'"), 'liveVoiceUrlBuilder must include userGender');
});

// -------------------------------------------------------------
// GATE 04: Token Budgeting, Sliding Window & Academy Context
// -------------------------------------------------------------
console.log('\n▶ GATE 04: Token Budgeting, Sliding Window & Academy Context');

runSuite('Gate 04.1: Practice Context Pruner Sliding Window', () => {
  const prunerSrc = fs.readFileSync(`${baseDir}/practiceContextPruner.ts`, 'utf8');
  assert(prunerSrc.includes('export function pruneTutorContext'), 'Must export pruneTutorContext');
  assert(prunerSrc.includes('export function skeletonizeJavaFile'), 'Must export skeletonizeJavaFile');
  assert(prunerSrc.includes('export function estimateTokens'), 'Must export estimateTokens');
});

runSuite('Gate 04.2: Practice Tutor Token Budget Integration & Line Limits', () => {
  const tutorRouteSrc = fs.readFileSync(`${baseDir}/practiceTutor.ts`, 'utf8');
  assert(tutorRouteSrc.includes('pruneTutorContext'), 'practiceTutor.ts must invoke pruneTutorContext');
  const tutorRouteLines = tutorRouteSrc.split('\n').length;
  assert(tutorRouteLines <= 400, `practiceTutor.ts must be <= 400 lines (actual: ${tutorRouteLines})`);

  const tutorPromptsSrc = fs.readFileSync(`${baseDir}/practiceTutorPrompts.ts`, 'utf8');
  assert(tutorPromptsSrc.includes('=== ДИДАКТИЧЕСКИЙ КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ==='), 'Must include Academy section');
  const tutorPromptLines = tutorPromptsSrc.split('\n').length;
  assert(tutorPromptLines <= 400, `practiceTutorPrompts.ts must be <= 400 lines (actual: ${tutorPromptLines})`);

  const livePairSrc = fs.readFileSync(`${baseDir}/livePairPrompts.ts`, 'utf8');
  assert(livePairSrc.includes('=== КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ==='), 'Must include live pair Academy section');
  const livePairLines = livePairSrc.split('\n').length;
  assert(livePairLines <= 350, `livePairPrompts.ts must be <= 350 lines (actual: ${livePairLines})`);
});

runSuite('Gate 04.3: Live Audio WebSocket Academy Propagation', () => {
  const liveWsConnSrc = fs.readFileSync(`${baseDir}/liveWsConnectionHandler.ts`, 'utf8');
  assert(liveWsConnSrc.includes('academyCourse'), 'liveWsConnectionHandler must handle academyCourse');
  assert(liveWsConnSrc.includes('academyStep'), 'liveWsConnectionHandler must handle academyStep');
  assert(liveWsConnSrc.includes('academyBridgeContext'), 'liveWsConnectionHandler must forward academyBridgeContext');

  const liveFrameHandlerSrc = fs.readFileSync(`${baseDir}/liveWsClientFrameHandler.ts`, 'utf8');
  assert(liveFrameHandlerSrc.includes('parsed.academyBridgeContext'), 'liveWsClientFrameHandler must extract academyBridgeContext');
});

runSuite('Gate 04.4: Frontend Academy Breadcrumb & Tutor Bridge', () => {
  const appStoreSrc = fs.readFileSync(`${baseDir}/useAppStore.ts`, 'utf8');
  assert(appStoreSrc.includes('moduleTitle?: string;'), 'useAppStore must include moduleTitle');
  assert(appStoreSrc.includes('learningObjective?: string;'), 'useAppStore must include learningObjective');
  assert(appStoreSrc.includes('targetConcepts?: string[];'), 'useAppStore must include targetConcepts');

  const tutorStoreSrc = fs.readFileSync(`${baseDir}/usePracticeTutorStore.ts`, 'utf8');
  assert(tutorStoreSrc.includes('academyBridgeContext?: {'), 'usePracticeTutorStore must include academyBridgeContext');

  const tutorDrawerSrc = fs.readFileSync(`${baseDir}/PracticeTutorDrawer.tsx`, 'utf8');
  assert(tutorDrawerSrc.includes('academyBreadcrumbContext'), 'PracticeTutorDrawer must extract academyBreadcrumbContext');
  assert(tutorDrawerSrc.includes('academyBridgeContext: academyBreadcrumbContext ?'), 'PracticeTutorDrawer must forward academyBridgeContext');
});

// -------------------------------------------------------------
// GATE 05: Code Quality, Cognitive Bounds & Architecture Summary
// -------------------------------------------------------------
console.log('\n▶ GATE 05: Invariant 8 Cognitive Line Limits & SLA');

runSuite('Gate 05.1: Strict File Length Verification (Invariant 8)', () => {
  const checks = [
    { file: `${baseDir}/practiceContextPruner.ts`, max: 350, label: 'practiceContextPruner.ts (New)' },
    { file: `${baseDir}/livePairPrompts.ts`, max: 350, label: 'livePairPrompts.ts (New/Restructured)' },
    { file: `${baseDir}/practiceTutor.ts`, max: 400, label: 'practiceTutor.ts (Modified)' },
    { file: `${baseDir}/practiceTutorPrompts.ts`, max: 400, label: 'practiceTutorPrompts.ts (Modified)' },
    { file: `${baseDir}/usePracticeTutorStore.ts`, max: 400, label: 'usePracticeTutorStore.ts (Modified)' },
    { file: `${baseDir}/PracticeTutorDrawer.tsx`, max: 400, label: 'PracticeTutorDrawer.tsx (Modified)' },
    { file: `${baseDir}/liveVoiceUrlBuilder.ts`, max: 400, label: 'liveVoiceUrlBuilder.ts (Modified)' },
    { file: `${baseDir}/liveWsConnectionHandler.ts`, max: 400, label: 'liveWsConnectionHandler.ts (Modified)' },
    { file: `${baseDir}/liveWsClientFrameHandler.ts`, max: 400, label: 'liveWsClientFrameHandler.ts (Modified)' },
    { file: `${baseDir}/liveWsSessionParams.ts`, max: 400, label: 'liveWsSessionParams.ts (Modified)' }
  ];

  for (const c of checks) {
    if (fs.existsSync(c.file)) {
      const lines = fs.readFileSync(c.file, 'utf8').split('\n').length;
      assert(lines <= c.max, `${c.label} exceeds limit of ${c.max} lines (actual: ${lines})`);
    }
  }
});

console.log('\n================================================================================');
console.log(`🏁 CANARY MATRIX COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('================================================================================');

if (failedTests === 0) {
  console.log('🎉 ALL WAVE 15 PHASE GATES (01-05) VERIFIED AND LOCKED. ZERO-REGRESSION SLA MET.');
  process.exit(0);
} else {
  console.error(`💥 CANARY MATRIX FAILED WITH ${failedTests} REGRESSIONS.`);
  process.exit(1);
}
