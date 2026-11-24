/**
 * test_hr_simulator_engine.js
 * SOTA Late 2026 Regression & Invariant Verification Suite for Generic HR Voice Simulator Engine.
 */

const assert = require('assert');
const { Value } = require('@sinclair/typebox/value');
const { 
  CandidateDossierSchema, 
  JobContextSchema, 
  HrScorecardSchema 
} = require('@interview-prep/shared');

const { 
  getCandidateDossier, 
  getJobContext, 
  getAllHrQuestions,
  getHrQuestion 
} = require('../dist/services/live/hrContextResolver');

const { 
  buildHrSimulatorSystemPrompt,
  HR_ANTI_SYCOPHANCY_DIRECTIVES 
} = require('../dist/services/live/hrPromptBuilder');

const { getLiveToolDeclarations } = require('../dist/services/live/liveToolDeclarations');
const { HrSimulationOrchestrator } = require('../dist/services/live/HrSimulationOrchestrator');

console.log('========================================================================');
console.log('🧪 SOTA HR VOICE SIMULATOR ENGINE INVARIANT & CONTRACT TEST SUITE');
console.log('========================================================================\n');

async function runAllTests() {
  // --------------------------------------------------------------------------
  // SUITE 1: TypeBox Schema Validation
  // --------------------------------------------------------------------------
  console.log('🔹 [Suite 1] TypeBox Schema Validation (Positive & Negative)');
  {
    const dossier = getCandidateDossier('canonical_senior_java');
    assert.strictEqual(Value.Check(CandidateDossierSchema, dossier), true, 'Canonical dossier must pass schema check');

    const job = getJobContext('fintech_highload_expansion');
    assert.strictEqual(Value.Check(JobContextSchema, job), true, 'Canonical job context must pass schema check');

    // Negative schema test: Missing required fields
    const invalidDossier = { candidateId: 'invalid' };
    assert.strictEqual(Value.Check(CandidateDossierSchema, invalidDossier), false, 'Malformed dossier must fail schema check');

    // Scorecard schema test
    const validScorecard = {
      sessionId: 'sess_123',
      turnId: 'turn_1',
      questionId: 'q01_pitch',
      mode: 'rapid_fire_micro_drill',
      overallScore: 88,
      passed: true,
      metrics: {
        substanceMatch: 90,
        lexicalDensity: 85,
        pacingScore: 92,
        deliveryConfidence: 82
      },
      turnDurationSec: 74.2,
      averageWpm: 124,
      fillerWordsSpotted: ['ну'],
      anchorsHit: ['7.4 года БФТ', 'НПД / 422-ФЗ'],
      anchorsMissed: [],
      actionableCritique: 'Отличный темп и аргументация.',
      nextAction: 'advance_next_question'
    };
    assert.strictEqual(Value.Check(HrScorecardSchema, validScorecard), true, 'Valid scorecard must pass schema check');
    console.log('  ✅ Suite 1 passed: Schema checks verified.');
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Ground Truth Context Resolver & Fixtures Integrity
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 2] Ground Truth Context Resolver & Canonical Fixtures');
  {
    const dossier = getCandidateDossier();
    assert.ok(dossier.fullName.includes('Илья') && dossier.fullName.includes('Ижуков'), 'Full name must match Ilya Izhukov');
    assert.strictEqual(dossier.age, 35);
    assert.strictEqual(dossier.compliance.military.category, 'V');
    assert.strictEqual(dossier.compliance.taxStatus, 'npd_self_employed');
    assert.strictEqual(dossier.financials.targetSalaryNet, 310000);
    assert.ok(dossier.careerTracks[0].companyAlias.includes('БТЛаб'));
    assert.strictEqual(dossier.careerTracks[0].durationMonths, 88);
    assert.strictEqual(dossier.showcase.rpsSustained, 2200);

    const questions = getAllHrQuestions();
    assert.ok(questions.length >= 5, `Expected >= 5 questions in matrix, got ${questions.length}`);
    const pitchQ = getHrQuestion('q01_elevator_pitch');
    assert.ok(pitchQ, 'Pitch question q01_elevator_pitch must exist');
    assert.ok(pitchQ.requiredAnchors.length >= 4, 'Pitch must have >= 4 required anchors');
    console.log('  ✅ Suite 2 passed: Canonical dossier & question matrix verified.');
  }

  // --------------------------------------------------------------------------
  // SUITE 3: HR Prompt Builder & Anti-Sycophancy Directives
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 3] HR System Prompt Generator & Anti-Sycophancy Directives');
  {
    const dossier = getCandidateDossier();
    const job = getJobContext();
    const prompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'full_screening_simulation',
      personaId: 'friendly_sourcer',
      voiceName: 'Kore'
    });

    assert.ok(prompt.includes('ДИРЕКТИВЫ АНТИ-СИКОФАНТИИ'), 'Prompt must enforce anti-sycophancy');
    assert.ok(prompt.includes('ЗАПРЕТ ФАЛЬШИВОЙ ПОХВАЛЫ'), 'Prompt must ban false praise');
    assert.ok(prompt.includes('422-ФЗ'), 'Prompt must include 422-FZ legal basis');
    assert.ok(prompt.includes('Илья') || prompt.includes('БТЛаб'), 'Prompt must serialize ground truth candidate facts');
    assert.ok(prompt.includes('TURN 0 LOCKDOWN'), 'Prompt must enforce Turn 0 lockdown');
    assert.ok(prompt.includes('Елена') || prompt.includes('FRIENDLY SOURCER'), 'Prompt must identify persona');

    // Check behavioral persona
    const conflictPrompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'rapid_fire_micro_drill',
      personaId: 'behavioral_conflict_hunter',
      activeQuestion: getHrQuestion('q01_elevator_pitch')
    });
    assert.ok(conflictPrompt.includes('HR-ПСИХОЛОГ') || conflictPrompt.includes('КОРПОРАТИВНОЙ КУЛЬТУРЫ'), 'Prompt must identify behavioral persona');
    assert.ok(conflictPrompt.includes('Extreme Ownership') || conflictPrompt.includes('конфликт'), 'Behavioral persona must focus on ownership / conflict');
    console.log('  ✅ Suite 3 passed: Anti-sycophancy and persona directives verified.');
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Tool Declarations & Dispatcher Schema
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 4] HR Tool Declarations & Gemini Live Compatibility');
  {
    const allTools = getLiveToolDeclarations('hr_simulation');
    const tools = allTools.filter((t) => ['advance_hr_phase', 'submit_hr_evaluation', 'emit_hr_round_evaluation'].includes(t.name));
    assert.strictEqual(tools.length, 3, 'Must declare exactly 3 HR tools');
    
    const toolNames = tools.map((t) => t.name);
    assert.ok(toolNames.includes('advance_hr_phase'), 'Tool advance_hr_phase must be declared');
    assert.ok(toolNames.includes('submit_hr_evaluation'), 'Tool submit_hr_evaluation must be declared');
    assert.ok(toolNames.includes('emit_hr_round_evaluation'), 'Tool emit_hr_round_evaluation must be declared');

    for (const tool of tools) {
      assert.ok(tool.description && tool.description.length > 20, `Tool ${tool.name} must have detailed description`);
      assert.strictEqual(tool.parameters.type, 'OBJECT', `Tool ${tool.name} parameters must be OBJECT`);
    }
    console.log('  ✅ Suite 4 passed: Gemini Live HR tool declarations valid.');
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Deterministic FSM & Pacing Watchdog
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 5] HrSimulationOrchestrator FSM & Pacing Watchdog');
  {
    let lastDispatchedFrame = null;
    let lastToolResponse = null;

    const mockWs = {
      readyState: 1, // OPEN
      send: (str) => {
        lastDispatchedFrame = JSON.parse(str);
      }
    };

    const mockUpstream = {
      readyState: 1,
      send: (str) => {
        lastToolResponse = JSON.parse(str);
      }
    };

    const orchestrator = new HrSimulationOrchestrator({
      session: { sessionId: 'test_sess_01' },
      clientSocket: mockWs,
      geminiSocket: mockUpstream,
      mode: 'full_screening_simulation'
    });

    assert.strictEqual(orchestrator.getCurrentPhase(), 'phase1_small_talk');

    // Transition phase via orchestrator
    orchestrator.transitionToPhase('phase2_elevator_pitch', 'Small talk concluded cleanly');
    assert.strictEqual(orchestrator.getCurrentPhase(), 'phase2_elevator_pitch');
    assert.strictEqual(lastDispatchedFrame.type, 'hr_phase_transition');
    assert.strictEqual(lastDispatchedFrame.payload.toPhase, 'phase2_elevator_pitch');

    orchestrator.destroy();
    console.log('  ✅ Suite 5 passed: Orchestrator state machine & phase dispatch verified.');
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Spec 38 Mentor Coach & Rehearsal Directives Verification
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 6] Spec 38: Mentor Coach Rehearsal & Chunking Directives');
  {
    const dossier = getCandidateDossier();
    const job = getJobContext();
    const pitchQ = getHrQuestion('hr_q0_elevator_pitch') || getHrQuestion('q01_elevator_pitch');
    assert.ok(pitchQ.chunks && pitchQ.chunks.length >= 2, 'Elevator pitch must have at least 2 chunks');

    const chunk1 = pitchQ.chunks[0];
    const tutorPrompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'tutor_rehearsal',
      personaId: 'mentor_coach',
      activeQuestion: pitchQ,
      activeChunk: chunk1,
      voiceName: 'Aoede'
    });

    assert.ok(tutorPrompt.includes('ОЛЬГА'), 'Prompt must identify coach Olga');
    assert.ok(tutorPrompt.includes('TUTOR REHEARSAL'), 'Prompt must include tutor rehearsal mode');
    assert.ok(tutorPrompt.includes(chunk1.title), 'Prompt must focus on active chunk title');
    assert.ok(tutorPrompt.includes('МОМЕНТАЛЬНЫЙ СТОП НА ОШИБКАХ'), 'Prompt must mandate in-flight stop on errors');
    assert.ok(tutorPrompt.includes('МГНОВЕННЫЙ ОТВЕТ НА ПРОСЬБУ О ПОМОЩИ'), 'Prompt must mandate instant answer on help request');
    assert.ok(tutorPrompt.includes('ТОЧНОСТЬ ФАКТОВ VS СВОБОДА ФОРМУЛИРОВОК'), 'Prompt must define epistemic precision boundary');
    assert.ok(tutorPrompt.includes('НИКАКИХ ОЦЕНОК И СКОРИНГОВ'), 'Prompt must prohibit scoring in rehearsal');

    // Tool suppression in hr_tutor
    const tutorTools = getLiveToolDeclarations('hr_tutor');
    const hrEvalTools = tutorTools.filter((t) => ['emit_hr_round_evaluation', 'submit_hr_evaluation'].includes(t.name));
    assert.strictEqual(hrEvalTools.length, 0, 'Rehearsal mode (hr_tutor) must NOT expose evaluation tools');

    console.log('  ✅ Suite 6 passed: Spec 38 mentor coach & rehearsal invariants verified.');
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL HR SIMULATOR ENGINE INVARIANT SUITES PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ HR Simulator Invariant Test Suite Failed:', err);
  process.exit(1);
});
