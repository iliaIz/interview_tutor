/**
 * liveVoiceFrameParser.test.ts
 * Regression tests for discriminated 4-slice LiveVoiceFrameParser & dispatchDomainEvents (Spec 53 / #191).
 */

import assert from 'assert';
import { LiveVoiceFrameParser, dispatchDomainEvents } from '../src/audio/LiveVoiceFrameParser';

console.log('🧪 Running LiveVoiceFrameParser contract tests...');

// Test 1: Preserves leading and trailing whitespaces on streaming deltas
{
  const f1 = LiveVoiceFrameParser.parse(JSON.stringify({ serverContent: { modelTurn: { parts: [{ text: 'Если ' }] } } }));
  const f2 = LiveVoiceFrameParser.parse(JSON.stringify({ serverContent: { modelTurn: { parts: [{ text: 'меняется' }] } } }));
  const f3 = LiveVoiceFrameParser.parse(JSON.stringify({ serverContent: { modelTurn: { parts: [{ text: ' только ' }] } } }));
  const f4 = LiveVoiceFrameParser.parse(JSON.stringify({ serverContent: { modelTurn: { parts: [{ text: 'код.' }] } } }));

  assert.strictEqual(f1?.kind, 'model_turn');
  assert.strictEqual(f1?.modelTurn?.textDeltas[0], 'Если ');
  assert.strictEqual(f2?.modelTurn?.textDeltas[0], 'меняется');
  assert.strictEqual(f3?.modelTurn?.textDeltas[0], ' только ');
  assert.strictEqual(f4?.modelTurn?.textDeltas[0], 'код.');

  const accumulated =
    (f1?.modelTurn?.textDeltas[0] || '') +
    (f2?.modelTurn?.textDeltas[0] || '') +
    (f3?.modelTurn?.textDeltas[0] || '') +
    (f4?.modelTurn?.textDeltas[0] || '');
  assert.strictEqual(accumulated, 'Если меняется только код.', 'Words should not be glued together!');
  console.log('  ✅ Test 1 Passed: Streaming deltas preserve whitespaces properly.');
}

// Test 2: Strips non-speech tags while preserving adjacent spaces
{
  const parsed = LiveVoiceFrameParser.parse(JSON.stringify({
    serverContent: { modelTurn: { parts: [{ text: ' <no speech> Ответ правильный: {pause} продолжаем. ' }] } }
  }));
  assert.strictEqual(parsed?.modelTurn?.textDeltas[0], '  Ответ правильный:  продолжаем. ');
  console.log('  ✅ Test 2 Passed: Non-speech tokens stripped cleanly without dropping spacing.');
}

// Test 3: Standalone <no speech> token produces empty delta and does not pollute transcript
{
  const parsed = LiveVoiceFrameParser.parse(JSON.stringify({
    serverContent: { modelTurn: { parts: [{ text: '<no speech>' }] } }
  }));
  assert.strictEqual(parsed?.modelTurn?.hasText, false);
  assert.strictEqual(parsed?.modelTurn?.textDeltas.length, 0);
  console.log('  ✅ Test 3 Passed: Pure non-speech frame emits 0 text deltas.');
}

// Test 4: Control slices + toolLifecycle parse accurately
{
  const reconnecting = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'upstream_reconnecting', attempt: 2, maxAttempts: 3, mode: 'reconnect' }));
  assert.deepStrictEqual(reconnecting?.control, { kind: 'upstream_reconnecting', attempt: 2, maxAttempts: 3, mode: 'reconnect' });

  const handoffStart = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hot_handoff_started', timeLeftSeconds: 45 }));
  assert.deepStrictEqual(handoffStart?.control, { kind: 'hot_handoff', state: 'started' });

  const handoffDone = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hot_handoff_complete', mode: 'resumption' }));
  assert.deepStrictEqual(handoffDone?.control, { kind: 'hot_handoff', state: 'complete' });

  const awaitingSpeech = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'tool_awaiting_speech', tools: ['update_whiteboard'] }));
  assert.deepStrictEqual(awaitingSpeech?.control, { kind: 'tool_awaiting_speech' });

  const toolExec = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'tool_executing' }));
  assert.strictEqual(toolExec?.toolLifecycle, 'executing');

  const pong = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'sync_pong', isUpstreamConnected: false, isUpstreamReconnecting: false, isHandoffActive: false }));
  assert.deepStrictEqual(pong?.control, {
    kind: 'sync_pong',
    payload: { isUpstreamConnected: false, isUpstreamReconnecting: false, isHandoffActive: false }
  });
  console.log('  ✅ Test 4 Passed: Control slices & toolLifecycle verified.');
}

// Test 5: upstream_error, setupComplete, ping, dead_air_recovery
{
  const errFrame = LiveVoiceFrameParser.parse(JSON.stringify({
    type: 'upstream_error', error: 'Quota exhausted across pool', errorCode: 'QUOTA_EXHAUSTED', retryable: true
  }));
  assert.deepStrictEqual(errFrame?.control, {
    kind: 'upstream_error',
    payload: { error: 'Quota exhausted across pool', errorCode: 'QUOTA_EXHAUSTED', retryable: true }
  });

  const setup = LiveVoiceFrameParser.parse(JSON.stringify({ setupComplete: true, reconnected: true }));
  assert.deepStrictEqual(setup?.control, { kind: 'setup_complete', reconnected: true, silent: false });

  const ping = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'ping', timestamp: 12345 }));
  assert.deepStrictEqual(ping?.control, { kind: 'ping', timestamp: 12345 });

  const deadAir = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'dead_air_recovery', reason: 'timeout' }));
  assert.deepStrictEqual(deadAir?.control, { kind: 'dead_air_recovery', reason: 'timeout' });
  console.log('  ✅ Test 5 Passed: Closed control union verified across setupComplete/ping/dead_air_recovery/error.');
}

// Test 6: Absorbed domainEvents + dispatchDomainEvents
{
  let wbPayload: unknown = null;
  let hrScore: unknown = null;
  let hrDelta = '';
  const wbFrame = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'whiteboard_update', payload: { nodes: ['API'] } }));
  const hrFrame = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hr_scorecard_ready', scorecard: { total: 88 } }));
  const deltaFrame = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hr_user_transcript_delta', delta: 'Опыт 7 лет' }));

  assert.strictEqual(wbFrame?.domainEvents[0]?.kind, 'whiteboard_update');
  assert.strictEqual(hrFrame?.domainEvents[0]?.kind, 'hr_scorecard_ready');
  assert.strictEqual(deltaFrame?.domainEvents[0]?.kind, 'hr_transcript_delta');

  dispatchDomainEvents(
    {
      onWhiteboardUpdate: (p) => { wbPayload = p; },
      onHrScorecardReady: (s) => { hrScore = s; },
      onHrTranscriptDelta: (t) => { hrDelta += t; }
    },
    [...(wbFrame?.domainEvents ?? []), ...(hrFrame?.domainEvents ?? []), ...(deltaFrame?.domainEvents ?? [])]
  );

  assert.deepStrictEqual(wbPayload, { nodes: ['API'] });
  assert.deepStrictEqual(hrScore, { total: 88 });
  assert.strictEqual(hrDelta, 'Опыт 7 лет');
  console.log('  ✅ Test 6 Passed: domainEvents slice & dispatchDomainEvents verified.');
}

console.log('🎉 All LiveVoiceFrameParser tests passed successfully!\n');
