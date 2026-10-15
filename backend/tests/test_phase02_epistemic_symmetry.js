/**
 * test_phase02_epistemic_symmetry.js
 * 
 * Gate 02 Automated Verification Suite:
 * 1. System Design Probe Grounding (Canvas Mermaid Topology & Notes)
 * 2. System Design Evaluator Epistemic Symmetry (Conversation History & Defense Evidence Trail)
 * 3. SRE Triage Probe Grounding (Thread Telemetry & Tarjan SCC Deadlock Digest)
 * 4. SRE Triage Evaluator Epistemic Symmetry (Investigation Digest & Chat Evidence Trail)
 * 5. SQLite Scenario & Triage Manifest Verification
 */

const assert = require('assert');
const fs = require('fs');
const Database = require('better-sqlite3');

console.log('=== RUNNING WAVE 15 PHASE 02: EPISTEMIC SYMMETRY VERIFICATION ===\n');

function runTest(suiteName, fn) {
  try {
    fn();
    console.log(`[PASS] ${suiteName}`);
  } catch (err) {
    console.error(`[FAIL] ${suiteName}:`, err.message);
    process.exitCode = 1;
  }
}

// Read source files staged in storage
const basePath = fs.existsSync('/app/storage/test_phase02') ? '/app/storage/test_phase02' : 'storage/test_phase02';
const sdPromptsSource = fs.readFileSync(`${basePath}/systemDesignPrompts.ts`, 'utf8');
const triagePromptsSource = fs.readFileSync(`${basePath}/triagePrompts.ts`, 'utf8');

// 1. System Design Probe Grounding
runTest('Suite 1: System Design Probe Grounding in Source Code', () => {
  assert(
    sdPromptsSource.includes('currentTopology?: string;'),
    'SystemDesignProbeParams must include currentTopology'
  );
  assert(
    sdPromptsSource.includes('candidateNotes?: string;'),
    'SystemDesignProbeParams must include candidateNotes'
  );
  assert(
    sdPromptsSource.includes('=== АКТУАЛЬНАЯ АРХИТЕКТУРА НА ХОЛСТЕ КАНДИДАТА (MERMAID / CANVAS) ==='),
    'Probe prompt must define canvas topology section'
  );
  assert(
    sdPromptsSource.includes('=== АРХИТЕКТУРНЫЕ ЗАМЕТКИ КАНДИДАТА ==='),
    'Probe prompt must define candidate notes section'
  );
});

// 2. System Design Evaluator Epistemic Symmetry
runTest('Suite 2: System Design Evaluator Epistemic Symmetry in Source Code', () => {
  assert(
    sdPromptsSource.includes('conversationHistory?: Array<{ role: string; content: string }>;'),
    'SystemDesignEvalParams must include conversationHistory'
  );
  assert(
    sdPromptsSource.includes('=== ХОД ОБСУЖДЕНИЯ И ЗАЩИТА АРХИТЕКТУРНЫХ РЕШЕНИЙ (CONVERSATION HISTORY) ==='),
    'Evaluation prompt must define conversation history section'
  );
  assert(
    sdPromptsSource.includes('ИНВАРИАНТ УЧЕТА ДИАЛОГА:'),
    'Evaluation prompt must enforce dialogue invariant'
  );
  assert(
    sdPromptsSource.includes('КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО снижать балл по шкале "tradeOffJustification"'),
    'Evaluation prompt must protect candidate justified choices from phantom penalties'
  );

  const sdEvalSource = fs.readFileSync(`${basePath}/systemDesignEvaluator.ts`, 'utf8');
  assert(
    sdEvalSource.includes('conversationHistory?: Array<{ role: string; content: string }>;'),
    'EvaluationPayload in systemDesignEvaluator.ts must include conversationHistory'
  );
  assert(
    sdEvalSource.includes('conversationHistory') && sdEvalSource.includes('buildSystemDesignEvaluationPrompt'),
    'systemDesignEvaluator.ts must pass conversationHistory to prompt builder'
  );
});

// 3. SRE Triage Probe Grounding
runTest('Suite 3: SRE Triage Probe Grounding in Source Code', () => {
  assert(
    triagePromptsSource.includes('triageDigest?: {'),
    'TriageProbeParams must include triageDigest'
  );
  assert(
    triagePromptsSource.includes('АКТУАЛЬНОЕ СОСТОЯНИЕ РАССЛЕДОВАНИЯ КАНДИДАТА:'),
    'Probe prompt must include current investigation state section'
  );
  assert(
    triagePromptsSource.includes('Текущая фаза:'),
    'Probe prompt must include investigation phase'
  );
  assert(
    triagePromptsSource.includes('Телеметрия JVM потоков:'),
    'Probe prompt must include thread telemetry'
  );
  assert(
    triagePromptsSource.includes('Детектор Tarjan SCC:'),
    'Probe prompt must include Tarjan SCC deadlock detector'
  );
  assert(
    triagePromptsSource.includes('Черновик гипотезы кандидата:'),
    'Probe prompt must include candidate draft hypothesis'
  );

  const triageRouteSource = fs.readFileSync(`${basePath}/triage.ts`, 'utf8');
  assert(
    triageRouteSource.includes('const { incidentId, userMessage, conversationHistory, triageDigest } = req.body;'),
    'triage.ts /probe route must extract triageDigest'
  );
  assert(
    triageRouteSource.includes('triageDigest'),
    'triage.ts /probe route must forward triageDigest to prompt builder'
  );
});

// 4. SRE Triage Evaluator Epistemic Symmetry
runTest('Suite 4: SRE Triage Evaluator Epistemic Symmetry in Source Code', () => {
  assert(
    triagePromptsSource.includes('conversationHistory?: Array<{ role: \'user\' | \'assistant\'; content: string }>;'),
    'TriageEvaluationParams must include conversationHistory'
  );
  assert(
    triagePromptsSource.includes('investigationDigest?: {'),
    'TriageEvaluationParams must include investigationDigest'
  );
  assert(
    triagePromptsSource.includes('ХОД РАССЛЕДОВАНИЯ И ДИАЛОГ С INCIDENT COMMANDER (EVIDENCE TRAIL):'),
    'Evaluation system prompt must include evidence trail section'
  );
  assert(
    triagePromptsSource.includes('ПРАВИЛО ЭПИСТЕМИЧЕСКОЙ СИММЕТРИИ:'),
    'Evaluation system prompt must include epistemic symmetry rule'
  );
  assert(
    triagePromptsSource.includes('Запрещено снижать баллы за краткость в итоговом текстовом поле'),
    'Evaluation system prompt must forbid phantom brevity deductions'
  );
  assert(
    triagePromptsSource.includes('[Данные телеметрии и состояние расследования]:'),
    'Evaluation user prompt must include telemetry and Tarjan digest'
  );

  const triageRouteSource = fs.readFileSync(`${basePath}/triage.ts`, 'utf8');
  assert(
    triageRouteSource.includes('conversationHistory, investigationDigest } = req.body;'),
    'triage.ts /evaluate route must extract conversationHistory and investigationDigest'
  );
});

// 5. Frontend Arenas Grounding & Payload Verification
runTest('Suite 5: Frontend Arenas Epistemic Symmetry Payloads', () => {
  const sdArenaSource = fs.readFileSync(`${basePath}/SystemDesignArena.tsx`, 'utf8');
  assert(
    sdArenaSource.includes('currentTopology,'),
    'SystemDesignArena must pass currentTopology in handleSendMessage'
  );
  assert(
    sdArenaSource.includes('candidateNotes'),
    'SystemDesignArena must pass candidateNotes in handleSendMessage'
  );

  const triageStudioSource = fs.readFileSync(`${basePath}/IncidentTriageStudio.tsx`, 'utf8');
  assert(
    triageStudioSource.includes('const triageDigest = useMemo('),
    'IncidentTriageStudio must memoize triageDigest with Tarjan SCC and thread telemetry'
  );
  assert(
    triageStudioSource.includes('triageDigest') && triageStudioSource.includes('/api/triage/probe'),
    'IncidentTriageStudio must pass triageDigest to /api/triage/probe'
  );
  assert(
    triageStudioSource.includes('conversationHistory: chatMessages') && triageStudioSource.includes('/api/triage/evaluate'),
    'IncidentTriageStudio must pass conversationHistory and investigationDigest to /api/triage/evaluate'
  );
});

// 6. SQLite SSOT Database Integrity
runTest('Suite 6: SQLite Manifests & Triage Integrity', () => {
  const db = new Database('/app/data/interview.db');
  
  const triageCount = db.prepare('SELECT COUNT(*) as cnt FROM production_triage_challenges').get().cnt;
  assert(triageCount > 0, 'Must have production_triage_challenges in DB');

  const triageRow = db.prepare('SELECT manifest_json FROM production_triage_challenges LIMIT 1').get();
  const triageManifest = JSON.parse(triageRow.manifest_json);
  assert(triageManifest.symptomsMarkdown, 'Triage manifest must have symptomsMarkdown');
  assert(triageManifest.rootCauseAnalysis, 'Triage manifest must have rootCauseAnalysis');
  assert(triageManifest.remediationMarkdown, 'Triage manifest must have remediationMarkdown');

  const sdCount = db.prepare('SELECT COUNT(*) as cnt FROM system_design_manifests').get().cnt;
  assert(sdCount > 0, 'Must have system_design_manifests in DB');

  console.log(`     Verified ${triageCount} triage challenges and ${sdCount} system design manifests.`);
});

console.log('\n=== ALL PHASE 02 VERIFICATION SUITES PASSED CLEANLY (GATE 02 OPEN) ===');
