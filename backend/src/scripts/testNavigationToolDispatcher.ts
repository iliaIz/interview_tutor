/**
 * testNavigationToolDispatcher.ts
 * Unit and contract test suite for liveNavigationToolDispatcher.ts
 * Cognitive bounding limit: <= 350 lines.
 */

import assert from 'assert';
import { getLiveToolDeclarations } from '../services/live/liveToolDeclarations';
import { handleNavigationToolCall } from '../services/live/liveNavigationToolDispatcher';

console.log('========================================================================');
console.log('🧪 UNIT & CONTRACT TESTS: LIVE NAVIGATION TOOL DISPATCHER (WAVE 20)');
console.log('========================================================================\n');

async function runTests() {
  // Test 1: Tool Declaration Invariants
  console.log('Test 1: Verifying tool declarations across interview and tutor modes...');
  const interviewTools = getLiveToolDeclarations('interview');
  const tutorTools = getLiveToolDeclarations('tutor');

  const navToolInterview = interviewTools.find((t: any) => t.name === 'navigate_question');
  const navToolTutor = tutorTools.find((t: any) => t.name === 'navigate_question');

  assert(navToolInterview, 'navigate_question must be declared in interview mode');
  assert(navToolTutor, 'navigate_question must be declared in tutor mode');
  assert.strictEqual(navToolInterview.behavior, 'NON_BLOCKING', 'Tool behavior must be NON_BLOCKING');
  assert.strictEqual(navToolTutor.behavior, 'NON_BLOCKING', 'Tool behavior must be NON_BLOCKING');

  const props = navToolInterview.parameters.properties;
  assert(props.direction && props.direction.enum.includes('next'), 'Schema includes next direction');
  assert(props.direction && props.direction.enum.includes('prev'), 'Schema includes prev direction');
  assert(props.action && props.action.enum.includes('skip_unanswered'), 'Schema includes skip_unanswered');
  console.log('✅ Test 1 Passed: Tool declaration and schema contracts verified.\n');

  // Helper for mock sockets
  function createMockSocket() {
    const messages: any[] = [];
    return {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => messages.push(JSON.parse(data)),
      messages
    };
  }

  // Test 2: Standard next question navigation
  console.log('Test 2: Verifying standard forward navigation (next)...');
  const clientMock1 = createMockSocket();
  const geminiMock1 = createMockSocket();
  const session1: any = {
    sessionId: 'sess_1',
    questionIndex: 0,
    totalQuestions: 3,
    sessionType: 'interview'
  };

  const handled1 = await handleNavigationToolCall({
    call: {
      id: 'call_1',
      name: 'navigate_question',
      args: { direction: 'next', action: 'proceed_next' }
    },
    clientSocket: clientMock1 as any,
    geminiSocket: geminiMock1 as any,
    session: session1
  });

  assert(handled1, 'Tool call must be handled');
  assert.strictEqual(clientMock1.messages.length, 1, 'Client socket received 1 message');
  const navEvent1 = clientMock1.messages[0];
  assert.strictEqual(navEvent1.type, 'navigation_action');
  assert.strictEqual(navEvent1.targetIndex, 1, 'Target index must be 1');
  assert.strictEqual(navEvent1.isBoundaryBlocked, false);

  assert.strictEqual(geminiMock1.messages.length, 1, 'Gemini socket received 1 response');
  const toolResp1 = geminiMock1.messages[0].toolResponse.functionResponses[0];
  assert.strictEqual(toolResp1.response.result.targetIndex, 1);
  assert.strictEqual(toolResp1.scheduling, 'WHEN_IDLE');
  console.log('✅ Test 2 Passed: Forward navigation produces correct events and tool response.\n');

  // Test 3: Boundary check at index 0 (prev)
  console.log('Test 3: Verifying boundary check when attempting to go back from first question...');
  const clientMock2 = createMockSocket();
  const geminiMock2 = createMockSocket();
  const session2: any = {
    questionIndex: 0,
    totalQuestions: 5,
    sessionType: 'tutor'
  };

  const handled2 = await handleNavigationToolCall({
    call: {
      id: 'call_2',
      name: 'navigate_question',
      args: { direction: 'prev' }
    },
    clientSocket: clientMock2 as any,
    geminiSocket: geminiMock2 as any,
    session: session2
  });

  assert(handled2, 'Tool call must be handled');
  const navEvent2 = clientMock2.messages[0];
  assert.strictEqual(navEvent2.isBoundaryBlocked, true);
  assert.strictEqual(navEvent2.targetIndex, 0);

  const toolResp2 = geminiMock2.messages[0].toolResponse.functionResponses[0];
  assert.strictEqual(toolResp2.response.result.isBoundaryBlocked, true);
  assert.strictEqual(toolResp2.response.result.success, false);
  console.log('✅ Test 3 Passed: Boundary check at start correctly blocks and informs model.\n');

  // Test 4: End of batch boundary (next at last question)
  console.log('Test 4: Verifying end-of-batch transition (next at last question)...');
  const clientMock3 = createMockSocket();
  const geminiMock3 = createMockSocket();
  const session3: any = {
    questionIndex: 4,
    totalQuestions: 5,
    sessionType: 'interview'
  };

  const handled3 = await handleNavigationToolCall({
    call: {
      id: 'call_3',
      name: 'navigate_question',
      args: { direction: 'next' }
    },
    clientSocket: clientMock3 as any,
    geminiSocket: geminiMock3 as any,
    session: session3
  });

  assert(handled3, 'Tool call must be handled');
  const navEvent3 = clientMock3.messages[0];
  assert.strictEqual(navEvent3.action, 'finish_batch');
  assert.strictEqual(navEvent3.targetIndex, 4);

  const toolResp3 = geminiMock3.messages[0].toolResponse.functionResponses[0];
  assert.strictEqual(toolResp3.response.result.action, 'finish_batch');
  console.log('✅ Test 4 Passed: Last question correctly maps to finish_batch.\n');

  // Test 5: Interview Skip Penalty Contract
  console.log('Test 5: Verifying interview skip penalty contract (0 points on skip_unanswered)...');
  const clientMock4 = createMockSocket();
  const geminiMock4 = createMockSocket();
  const session4: any = {
    sessionId: 'sess_skip',
    questionId: 'Q_CONC_01',
    topic: 'Concurrency',
    questionText: 'Что такое Happens-Before?',
    questionIndex: 1,
    totalQuestions: 3,
    sessionType: 'interview',
    hasCompletedEvaluation: false
  };

  const handled4 = await handleNavigationToolCall({
    call: {
      id: 'call_4',
      name: 'navigate_question',
      args: { direction: 'next', action: 'skip_unanswered', candidateReason: 'Не знаю Happens-Before' }
    },
    clientSocket: clientMock4 as any,
    geminiSocket: geminiMock4 as any,
    session: session4
  });

  assert(handled4, 'Tool call must be handled');
  assert(session4.hasCompletedEvaluation === true, 'Session marked as having completed evaluation');

  // Client should receive both an evaluation event (score 0, isSkipped: true) and navigation_action
  const evalEvent = clientMock4.messages.find((m: any) => m.type === 'evaluation');
  assert(evalEvent, 'Client must receive synthetic evaluation event');
  assert.strictEqual(evalEvent.evaluation.score, 0, 'Score must be 0 for skipped question');
  assert.strictEqual(evalEvent.evaluation.isSkipped, true, 'isSkipped must be true');

  const navEvent4 = clientMock4.messages.find((m: any) => m.type === 'navigation_action');
  assert(navEvent4, 'Client must receive navigation_action event');
  assert.strictEqual(navEvent4.targetIndex, 2);
  console.log('✅ Test 5 Passed: Interview skip penalty contract recorded 0 score and emitted events.\n');

  console.log('========================================================================');
  console.log('🎉 ALL LIVE NAVIGATION TOOL DISPATCHER TESTS PASSED (100% GREEN)');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
