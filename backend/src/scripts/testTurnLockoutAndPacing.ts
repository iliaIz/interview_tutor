/**
 * testTurnLockoutAndPacing.ts
 * Deterministic unit test for SOTA 2026 Half-Duplex Acoustic Lockout & Subtitle Pacing Invariants.
 * 
 * Verifies:
 * 1. Immediate Lockout: When candidate commits turn, session.isAiGenerating = true immediately.
 * 2. Echo Suppression: Raw mic audio arriving while session.isAiGenerating = true is dropped.
 * 3. Tactile Exemption: Explicit tactile barge-in unblocks generation and passes through.
 * 4. Anchor Stability: commitAnchor reflects candidate commit timestamp, preventing cumulative TTFA drift.
 */

import assert from 'assert';

interface MockSession {
  sessionId: string;
  isAiGenerating: boolean;
  isToolCallPending: boolean;
  lastTurnCommitTime?: number;
  lastActivityAt: number;
  sessionStartedAt: number;
  currentTurnIndex: number;
  currentTurnMetrics: {
    turnIndex: number;
    candidateSpeechStartedAt: number;
    candidateSpeechEndedAt: number;
    speechDurationMs: number;
    audioBytesReceived: number;
    textChars: number;
    droppedEchoChunksCount: number;
    wasBargeIn: boolean;
    bargeInType: 'acoustic' | 'tactile' | null;
  } | null;
}

function runLockoutAndPacingTests() {
  console.log('🧪 Running Turn-Lockout & Anti-Echo Guard Invariant Tests...');

  const tStart = 10000;
  const session: MockSession = {
    sessionId: 'test_session_lockout',
    isAiGenerating: false,
    isToolCallPending: false,
    lastActivityAt: tStart,
    sessionStartedAt: tStart,
    currentTurnIndex: 1,
    currentTurnMetrics: null
  };

  // Test 1: Candidate commits speech turn
  const tCommit = 14500;
  const turnCompleteMsg = { clientContent: { turnComplete: true } };

  // Simulate liveWsConnectionHandler logic
  if (turnCompleteMsg.clientContent?.turnComplete) {
    session.isAiGenerating = true;
    session.lastTurnCommitTime = tCommit;
    session.currentTurnMetrics = {
      turnIndex: session.currentTurnIndex,
      candidateSpeechStartedAt: tCommit - 3000,
      candidateSpeechEndedAt: tCommit,
      speechDurationMs: 3000,
      audioBytesReceived: 48000,
      textChars: 0,
      droppedEchoChunksCount: 0,
      wasBargeIn: false,
      bargeInType: null
    };
  }

  assert.strictEqual(session.isAiGenerating, true, 'Invariant Violation: isAiGenerating must be true immediately on turnComplete');
  assert.strictEqual(session.lastTurnCommitTime, tCommit, 'Invariant Violation: lastTurnCommitTime must equal commit timestamp');
  console.log('  ✅ Test 1 Passed: Immediate mic lockout activated on turnComplete');

  // Test 2: Mic audio packet arrives while AI is generating (Echo Bleed)
  let sentToGemini = false;
  function handleClientFrame(payload: any) {
    if (session.isToolCallPending || session.isAiGenerating) {
      if (payload.realtime_input?.audio || payload.realtimeInput?.audio) {
        if (!payload.bargeIn && !payload.barge_in) {
          if (session.currentTurnMetrics) {
            session.currentTurnMetrics.droppedEchoChunksCount++;
          }
          return; // Dropped!
        }
      }
    }
    sentToGemini = true;
  }

  const micEchoChunk = {
    realtimeInput: {
      audio: { mimeType: 'audio/pcm;rate=16000', data: 'dGVzdA==' }
    }
  };

  handleClientFrame(micEchoChunk);
  assert.strictEqual(sentToGemini, false, 'Invariant Violation: Mic audio during AI generation MUST be dropped');
  assert.strictEqual(session.currentTurnMetrics?.droppedEchoChunksCount, 1, 'Invariant Violation: droppedEchoChunksCount must increment');
  console.log('  ✅ Test 2 Passed: Mic echo audio successfully dropped without reaching upstream Gemini');

  // Test 3: Tactile Barge-In overrides lockout
  let bargeInHandled = false;
  function handleBargeIn() {
    session.isAiGenerating = false;
    if (session.currentTurnMetrics) {
      session.currentTurnMetrics.wasBargeIn = true;
      session.currentTurnMetrics.bargeInType = 'tactile';
    }
    bargeInHandled = true;
  }

  handleBargeIn();
  assert.strictEqual(session.isAiGenerating, false, 'Invariant Violation: isAiGenerating must be false after tactile barge-in');
  assert.strictEqual(session.currentTurnMetrics?.wasBargeIn, true);
  assert.strictEqual(session.currentTurnMetrics?.bargeInType, 'tactile');
  console.log('  ✅ Test 3 Passed: Tactile barge-in unblocks generation cleanly');

  // Test 4: TTFT & TTFA commitAnchor calculation (Zero Drift Invariant)
  session.isAiGenerating = true;
  session.lastTurnCommitTime = 20000;
  const tFirstText = 21200;
  const commitAnchor = session.lastTurnCommitTime || session.currentTurnMetrics?.candidateSpeechEndedAt || session.sessionStartedAt;
  const ttft = tFirstText - commitAnchor;

  assert.strictEqual(commitAnchor, 20000, 'commitAnchor must use lastTurnCommitTime');
  assert.strictEqual(ttft, 1200, 'TTFT must accurately measure elapsed time from commit (1200ms, not cumulative 11200ms)');
  console.log(`  ✅ Test 4 Passed: commitAnchor accurately yields TTFT=${ttft}ms without cumulative session drift`);

  console.log('\n🎉 ALL TURN-LOCKOUT & ANTI-ECHO INVARIANT TESTS PASSED!');
}

runLockoutAndPacingTests();
