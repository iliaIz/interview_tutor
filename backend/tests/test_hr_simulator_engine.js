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
const {
  resolveQuestionMicroBeats,
  resolveGuidedSessionBeats,
  createInitialGuidedState,
  applyGuidedStepAction,
  buildStepStatePayload,
  handleGuidedStepControlFrame
} = require('../dist/services/live/hrGuidedStepper');
const { handleAdvanceHrLearningStep } = require('../dist/services/live/liveHrToolDispatcher');

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

  // --------------------------------------------------------------------------
  // SUITE 7: Spec 40 Guided Micro-Chunking ("С нуля") FSM, Tools & Anti-Parroting
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 7] Spec 40: Guided Micro-Chunking FSM, Hybrid Sync & Prompt');
  {
    const dossier = getCandidateDossier();
    const job = getJobContext();
    const pitchQ = getHrQuestion('hr_q0_elevator_pitch');
    const beats = resolveQuestionMicroBeats(pitchQ);
    assert.ok(beats.length >= 4, `Pitch must have >= 4 atomic microBeats (got ${beats.length})`);

    // Prompt checks
    const guidedPrompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'guided_zero_start',
      personaId: 'mentor_coach',
      activeQuestion: pitchQ,
      activeBeat: beats[0],
      totalBeats: beats.length,
      voiceName: 'Kore'
    });
    assert.ok(guidedPrompt.includes('ЛЕСТНИЦА 4 СТУПЕНЕЙ'), 'Guided prompt must describe 4-rung ladder');
    assert.ok(guidedPrompt.includes('АНТИ-ПОПУГАЯ'), 'Guided prompt must enforce paraphrase diversity');
    assert.ok(guidedPrompt.includes('advance_hr_learning_step'), 'Guided prompt must wire advance_hr_learning_step tool');

    // Tool isolation: expose advance_hr_learning_step ONLY in guided_zero_start, zero eval tools
    const guidedTools = getLiveToolDeclarations('hr_tutor', 'deep_dive', 'guided_zero_start');
    assert.ok(
      guidedTools.some((t) => t.name === 'advance_hr_learning_step'),
      'guided_zero_start must expose advance_hr_learning_step'
    );
    assert.strictEqual(
      guidedTools.filter((t) => ['emit_hr_round_evaluation', 'submit_hr_evaluation'].includes(t.name)).length,
      0,
      'guided_zero_start must NOT expose evaluation tools'
    );

    // Deterministic FSM progression: Rung 1 -> Rung 2 (variant rotates) -> Rung 3 (cue hides) -> Next Beat 1 -> Snowball Rung 4
    let gState = createInitialGuidedState(pitchQ);
    assert.strictEqual(gState.beatIndex, 0);
    assert.strictEqual(gState.rung, 1);
    assert.strictEqual(gState.cueVisible, true);

    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    assert.strictEqual(gState.rung, 2);
    assert.strictEqual(gState.variantIndex, 1, 'Rung 1 -> 2 must rotate phrasing variant');

    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    assert.strictEqual(gState.rung, 3);
    assert.strictEqual(gState.cueVisible, false, 'Rung 3 Naked Recall must auto-fade cue card');

    // From Beat 0 Rung 3 -> advances directly to Beat 1 Rung 1 and marks Beat 0 mastered
    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    assert.strictEqual(gState.beatIndex, 1);
    assert.strictEqual(gState.rung, 1);
    assert.strictEqual(gState.cueVisible, true);
    assert.ok(gState.masteredBeatIds.includes(beats[0].id), 'Beat 0 must be marked mastered');

    // Advance Beat 1 through Rung 1 -> 2 -> 3 -> 4 (Snowball Bridge activates from Beat 1+)
    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    gState = applyGuidedStepAction(gState, beats, 'next_rung');
    assert.strictEqual(gState.beatIndex, 1);
    assert.strictEqual(gState.rung, 4, 'Beat 1 must enter Rung 4 Snowball Bridge');

    // Tool dispatcher & button WS control handler
    const mockClientFrames = [];
    const mockGeminiFrames = [];
    const mockSession = {
      questionId: 'hr_q0_elevator_pitch',
      hrMode: 'guided_zero_start',
      isSetupComplete: true,
      hasCandidateResponded: true,
      clientSocket: { readyState: 1, send: (s) => mockClientFrames.push(JSON.parse(s)) },
      geminiSocket: { readyState: 1, send: (s) => mockGeminiFrames.push(JSON.parse(s)) },
      hrGuidedState: gState
    };

    const toolRes = handleAdvanceHrLearningStep({ action: 'next_beat', masteredCurrentBeat: true }, { session: mockSession });
    assert.strictEqual(toolRes.clientEvent.type, 'hr_step_state');
    assert.strictEqual(toolRes.clientEvent.payload.beatIndex, 2);
    assert.strictEqual(toolRes.clientEvent.payload.source, 'ai_tool');

    // Silent toggle_cue must update client state WITHOUT sending clientContent turn to Gemini
    const prevGeminiCount = mockGeminiFrames.length;
    const handledSilent = handleGuidedStepControlFrame(mockSession, mockSession.clientSocket, {
      type: 'hr_step_control',
      payload: { action: 'toggle_cue', cueVisible: false }
    });
    assert.strictEqual(handledSilent, true);
    assert.strictEqual(mockGeminiFrames.length, prevGeminiCount, 'toggle_cue must NOT interrupt Gemini Live');

    // Next button frame must both emit HR_STEP_STATE and nudge Gemini Live
    handleGuidedStepControlFrame(mockSession, mockSession.clientSocket, {
      type: 'hr_step_control',
      payload: { action: 'next_variant' }
    });
    if (mockSession.nudgeWatchdog) clearTimeout(mockSession.nudgeWatchdog);
    if (mockSession.deadAirWatchdog) clearTimeout(mockSession.deadAirWatchdog);
    assert.strictEqual(mockGeminiFrames.length, prevGeminiCount + 1, 'next_variant button must sync Gemini Live');
    assert.strictEqual(mockClientFrames[mockClientFrames.length - 1].payload.source, 'client_button');

    const snapshot = buildStepStatePayload(mockSession.hrGuidedState, beats, 'client_button');
    assert.ok(snapshot.activeVariantText.length > 10);

    console.log('  ✅ Suite 7 passed: Spec 40 Guided Micro-Chunking FSM, hybrid tools & WS sync verified.');
  }

  // --------------------------------------------------------------------------
  // SUITE 8: Spec 41 Beat Selection, Single-Beat Focus Scope & Chunk Isolation
  // --------------------------------------------------------------------------
  console.log('\n🔹 [Suite 8] Spec 41: Guided Beat Focus Scope, Entry Index & select_beat Tool');
  {
    const dossier = getCandidateDossier();
    const job = getJobContext();
    const pitchQ = getHrQuestion('hr_q0_elevator_pitch');
    const allBeats = resolveQuestionMicroBeats(pitchQ);
    assert.strictEqual(allBeats.length, 5, 'Pitch question must expose all 5 microBeats');

    // 1. Chunk isolation: resolveGuidedSessionBeats ignores Spec 38 chunks and returns all 5 beats
    const guidedAllBeats = resolveGuidedSessionBeats(pitchQ, { beatScope: 'all_from_beat' });
    assert.strictEqual(guidedAllBeats.length, 5, 'guided_zero_start must never be cropped by stale chunkId');

    // 2. Starting on Beat 4 (index 3) preserves all 5 beats and sets beatIndex=3
    const startFrom4 = createInitialGuidedState(pitchQ, {
      chunkId: 'chunk_0_1_btlab', // stale chunkId from Rehearsal must not crop guided route
      startBeatId: allBeats[3].id,
      beatScope: 'all_from_beat'
    });
    assert.strictEqual(startFrom4.beatIndex, 3, 'Must start directly on selected Beat 4 (index 3)');
    assert.strictEqual(startFrom4.beatScope, 'all_from_beat');

    // Moving past Rung 3 on first beat with empty masteredBeatIds must advance to Beat 5 rather than Rung 4 Snowball
    let afterRung3 = applyGuidedStepAction(startFrom4, guidedAllBeats, 'next_rung'); // rung 2
    afterRung3 = applyGuidedStepAction(afterRung3, guidedAllBeats, 'next_rung'); // rung 3
    afterRung3 = applyGuidedStepAction(afterRung3, guidedAllBeats, 'next_rung'); // next beat (index 4)
    assert.strictEqual(afterRung3.beatIndex, 4, 'First practiced beat skips Snowball Rung 4 until >= 1 beat mastered');
    assert.strictEqual(afterRung3.rung, 1);

    // 3. Single-beat isolated mode: strictly 1 beat, cycles Rung 1 -> 2 -> 3 -> 1 without Rung 4
    const isolatedBeats = resolveGuidedSessionBeats(pitchQ, {
      startBeatId: allBeats[2].id,
      beatScope: 'single_beat'
    });
    assert.strictEqual(isolatedBeats.length, 1, 'single_beat must resolve strictly 1 beat');
    assert.strictEqual(isolatedBeats[0].id, allBeats[2].id);

    let isoState = createInitialGuidedState(pitchQ, {
      startBeatId: allBeats[2].id,
      beatScope: 'single_beat'
    });
    assert.strictEqual(isoState.beatIndex, 0);
    assert.strictEqual(isoState.beatScope, 'single_beat');

    isoState = applyGuidedStepAction(isoState, isolatedBeats, 'next_rung'); // rung 2
    isoState = applyGuidedStepAction(isoState, isolatedBeats, 'next_rung'); // rung 3
    isoState = applyGuidedStepAction(isoState, isolatedBeats, 'next_rung'); // loops to rung 1 with rotated variant
    assert.strictEqual(isoState.rung, 1, 'single_beat loops back to Rung 1 after Rung 3 (no Rung 4)');
    assert.ok(isoState.masteredBeatIds.includes(allBeats[2].id), 'Isolated beat marked mastered after Rung 3');

    // 4. Voice tool select_beat switches beatIndex accurately and emits SSOT beats array
    const isoPayload = buildStepStatePayload(isoState, isolatedBeats, 'session_init');
    assert.strictEqual(isoPayload.beatScope, 'single_beat');
    assert.strictEqual(isoPayload.beats.length, 1);

    const mockSession = {
      questionId: 'hr_q0_elevator_pitch',
      hrMode: 'guided_zero_start',
      startBeatId: allBeats[3].id,
      beatScope: 'all_from_beat',
      isSetupComplete: true,
      hasCandidateResponded: true,
      hrGuidedState: startFrom4
    };
    const selectRes = handleAdvanceHrLearningStep({ action: 'select_beat', beatIndex: 4 }, { session: mockSession });
    assert.strictEqual(selectRes.clientEvent.payload.beatIndex, 4, 'select_beat must jump to requested beatIndex');
    assert.strictEqual(selectRes.clientEvent.payload.beats.length, 5, 'SSOT beats array must contain all 5 beats');

    // 5. Prompt declarations include select_beat & beatOutline vs isolated notice
    const guidedTools = getLiveToolDeclarations('hr_tutor', 'deep_dive', 'guided_zero_start');
    const stepTool = guidedTools.find((t) => t.name === 'advance_hr_learning_step');
    assert.ok(stepTool.parameters.properties.action.enum.includes('select_beat'), 'Tool must expose select_beat');
    assert.ok(stepTool.parameters.properties.beatIndex, 'Tool must accept beatIndex');

    const isolatedPrompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'guided_zero_start',
      personaId: 'mentor_coach',
      activeQuestion: pitchQ,
      activeBeat: isolatedBeats[0],
      beatIndex: 0,
      totalBeats: 1,
      beatScope: 'single_beat'
    });
    assert.ok(isolatedPrompt.includes('ИЗОЛИРОВАННЫЙ РЕЖИМ'), 'Single-beat prompt must declare isolated mode');

    const routePrompt = buildHrSimulatorSystemPrompt({
      dossier,
      jobContext: job,
      mode: 'guided_zero_start',
      personaId: 'mentor_coach',
      activeQuestion: pitchQ,
      activeBeat: allBeats[3],
      beatIndex: 3,
      totalBeats: 5,
      beatScope: 'all_from_beat',
      beatOutline: allBeats.map((b, i) => `${i + 1}. ${b.title}`).join(' | ')
    });
    assert.ok(routePrompt.includes('АКТИВНЫЙ МИКРО-БЛОК 4/5'), 'Route prompt must announce starting beat index 4/5');
    assert.ok(routePrompt.includes('Маршрут блоков вопроса'), 'Route prompt must embed compact 1-line beat outline');

    console.log('  ✅ Suite 8 passed: Spec 41 beat focus scope, chunk isolation & SSOT HUD contract verified.');
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL HR SIMULATOR ENGINE INVARIANT SUITES PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ HR Simulator Invariant Test Suite Failed:', err);
  process.exit(1);
});
