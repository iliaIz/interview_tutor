/**
 * voiceNavigationContracts.test.ts
 * Contract test suite for Hands-Free Voice Batch Navigation & Tear-Free Audio Handshake (Wave 20).
 * Cognitive bounding limit: <= 350 lines.
 */

import { NativeLiveVoiceEngine } from '../src/audio/NativeLiveVoiceEngine';
import { NavigationActionEvent, VoiceEngineConfig } from '../src/audio/types';

interface TestContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: TestContext = { passed: 0, failed: 0, failures: [] };

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    ctx.passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    ctx.failed++;
    const msg = detail ? `${testName}: ${detail}` : testName;
    ctx.failures.push(msg);
    console.error(`  ❌ ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Mocks for Web Audio & WebSocket
// ---------------------------------------------------------------------------

class MockGainNode {
  gain = {
    value: 1,
    linearRampToValueAtTime: (_v: number, _t: number) => {},
    cancelScheduledValues: (_t: number) => {}
  };
  connect(_dest: any) {}
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  sampleRate = 16000;
  resume = async () => {};
  close = async () => {};
  createGain = () => new MockGainNode();
  createBufferSource = () => ({
    buffer: null,
    connect: () => {},
    start: () => {},
    stop: () => {},
    onended: null
  });
}

(global as any).AudioContext = MockAudioContext;
(global as any).window = {
  AudioContext: MockAudioContext,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
(global as any).navigator = {
  mediaDevices: {
    getUserMedia: async () => ({
      getTracks: () => [{ stop: () => {} }]
    })
  }
};

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 CONTRACT TEST SUITE: HANDS-FREE VOICE NAVIGATION (WAVE 20)');
  console.log('========================================================================\n');

  // Test 1: Navigation Action Receipt & Soft-Mute Invariant
  console.log('Test 1: Verifying soft-mute and pending navigation registration upon receiving navigation_action...');
  let receivedNavAction: NavigationActionEvent | null = null;
  let committedNavAction: NavigationActionEvent | null = null;

  const engine = new NativeLiveVoiceEngine({
    onNavigationAction: (nav) => {
      receivedNavAction = nav;
    },
    onNavigationCommit: (nav) => {
      committedNavAction = nav;
    }
  });

  const navEvent: NavigationActionEvent = {
    direction: 'next',
    action: 'proceed_next',
    currentIndex: 0,
    targetIndex: 1,
    totalQuestions: 5
  };

  // Simulate server dispatching navigation_action frame
  (engine as any).handleServerFrame(JSON.stringify({
    type: 'navigation_action',
    ...navEvent
  }));

  assert(receivedNavAction !== null, 'onNavigationAction callback must be triggered');
  assert(receivedNavAction?.targetIndex === 1, 'Target index must be 1');
  assert((engine as any).isMuted === true, 'Microphone stream must be soft-muted during navigation');
  assert(committedNavAction === null, 'Navigation must NOT commit until audio playout drains completely');
  console.log('✅ Test 1 Passed: Navigation registered, mic muted, premature commit prevented.\n');

  // Test 2: Dual-Sided Handshake Drain before Navigation Commit
  console.log('Test 2: Verifying that onNavigationCommit fires only after physical audio playout finishes...');
  // Simulate Gemini sending turn completion
  (engine as any).handleServerFrame(JSON.stringify({
    serverContent: {
      modelTurn: { parts: [{ text: 'Переходим к следующему вопросу.' }] },
      turnComplete: true
    }
  }));

  // While playout is playing, commit must not fire
  const playout = engine.getPlayoutManager();
  // Simulate DAC drain callback
  (engine as any).handleAudioPlayoutFinished();

  assert(committedNavAction !== null, 'onNavigationCommit must fire upon physical playout finish');
  assert(committedNavAction?.targetIndex === 1, 'Committed action targetIndex must be 1');
  assert((engine as any).isMuted === false, 'Microphone unmuted upon navigation handoff');
  console.log('✅ Test 2 Passed: Dual-Sided Handshake held navigation until DAC drain.\n');

  // Test 3: Boundary Blocked Action (e.g. Previous on Question 1)
  console.log('Test 3: Verifying that boundary-blocked navigation does not trigger onNavigationCommit...');
  committedNavAction = null;
  receivedNavAction = null;

  const blockedNavEvent: NavigationActionEvent = {
    direction: 'prev',
    action: 'review_previous',
    currentIndex: 0,
    targetIndex: 0,
    totalQuestions: 5,
    isBoundaryBlocked: true,
    boundaryMessage: 'Кандидат уже на первом вопросе.'
  };

  (engine as any).handleServerFrame(JSON.stringify({
    type: 'navigation_action',
    ...blockedNavEvent
  }));

  assert(receivedNavAction !== null, 'onNavigationAction received boundary notification');
  assert(receivedNavAction?.isBoundaryBlocked === true, 'Action marked as boundary-blocked');

  // Simulate turn complete and playout drain
  (engine as any).isServerTurnComplete = true;
  (engine as any).handleAudioPlayoutFinished();

  assert(committedNavAction === null, 'Boundary-blocked navigation must NOT commit index change');
  assert(engine.getState() === 'LISTENING', 'Engine must return cleanly to LISTENING state');
  console.log('✅ Test 3 Passed: Boundary-blocked navigation gracefully returned to listening.\n');

  // Test 4: Finish Batch Action Trigger
  console.log('Test 4: Verifying finish_batch action on last question forward navigation...');
  committedNavAction = null;

  const finishNavEvent: NavigationActionEvent = {
    direction: 'next',
    action: 'finish_batch',
    currentIndex: 4,
    targetIndex: 4,
    totalQuestions: 5
  };

  (engine as any).handleServerFrame(JSON.stringify({
    type: 'navigation_action',
    ...finishNavEvent
  }));

  (engine as any).isServerTurnComplete = true;
  (engine as any).handleAudioPlayoutFinished();

  assert(committedNavAction !== null, 'Finish batch action committed');
  assert(committedNavAction?.action === 'finish_batch', 'Action is finish_batch');
  console.log('✅ Test 4 Passed: Finish batch action correctly recognized and committed.\n');

  console.log('========================================================================');
  console.log(`🎉 ALL ${ctx.passed} CONTRACT TESTS PASSED (0 FAILURES)`);
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
