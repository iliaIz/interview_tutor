/**
 * liveVoiceFrameParser.test.ts
 * Regression tests for LiveVoiceFrameParser token whitespace preservation & sanitization.
 * SOTA Late 2026.
 */

import assert from 'assert';
import { LiveVoiceFrameParser } from '../src/audio/LiveVoiceFrameParser';

console.log('🧪 Running LiveVoiceFrameParser contract tests...');

// Test 1: Preserves leading and trailing whitespaces on streaming deltas
{
  const frame1 = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: 'Если ' }
        ]
      }
    }
  });

  const frame2 = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: 'меняется' }
        ]
      }
    }
  });

  const frame3 = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: ' только ' }
        ]
      }
    }
  });

  const frame4 = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: 'код.' }
        ]
      }
    }
  });

  const parsed1 = LiveVoiceFrameParser.parse(frame1);
  const parsed2 = LiveVoiceFrameParser.parse(frame2);
  const parsed3 = LiveVoiceFrameParser.parse(frame3);
  const parsed4 = LiveVoiceFrameParser.parse(frame4);

  assert(parsed1 && parsed1.textDeltas[0] === 'Если ', 'Frame 1 should preserve trailing space');
  assert(parsed2 && parsed2.textDeltas[0] === 'меняется', 'Frame 2 should preserve token');
  assert(parsed3 && parsed3.textDeltas[0] === ' только ', 'Frame 3 should preserve leading and trailing spaces');
  assert(parsed4 && parsed4.textDeltas[0] === 'код.', 'Frame 4 should preserve token');

  const accumulated = (parsed1?.textDeltas[0] || '') +
                      (parsed2?.textDeltas[0] || '') +
                      (parsed3?.textDeltas[0] || '') +
                      (parsed4?.textDeltas[0] || '');

  assert.strictEqual(accumulated, 'Если меняется только код.', 'Words should not be glued together!');
  console.log('  ✅ Test 1 Passed: Streaming deltas preserve whitespaces properly without concatenating words.');
}

// Test 2: Strips non-speech tags while preserving adjacent spaces
{
  const frame = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: ' <no speech> Ответ правильный: {pause} продолжаем. ' }
        ]
      }
    }
  });

  const parsed = LiveVoiceFrameParser.parse(frame);
  assert(parsed, 'Frame should be parsed');
  assert.strictEqual(parsed.textDeltas[0], '  Ответ правильный:  продолжаем. ');
  console.log('  ✅ Test 2 Passed: Non-speech tokens stripped cleanly without dropping spacing.');
}

// Test 3: Standalone <no speech> token produces empty delta and does not pollute transcript
{
  const frame = JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          { text: '<no speech>' }
        ]
      }
    }
  });

  const parsed = LiveVoiceFrameParser.parse(frame);
  assert(parsed, 'Frame should parse');
  assert.strictEqual(parsed.hasText, false, 'Pure non-speech frame should not register text');
  assert.strictEqual(parsed.textDeltas.length, 0, 'No text deltas should be emitted');
  console.log('  ✅ Test 3 Passed: Pure non-speech frame emits 0 text deltas.');
}

// Test 4: Spec 42 transport/handoff/tool-sync control frames parse accurately
{
  const reconnecting = LiveVoiceFrameParser.parse(
    JSON.stringify({ type: 'upstream_reconnecting', attempt: 2, maxAttempts: 3, mode: 'reconnect' })
  );
  assert.deepStrictEqual(reconnecting?.reconnectPayload, { attempt: 2, maxAttempts: 3, mode: 'reconnect' });

  const handoffStart = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hot_handoff_started', timeLeftSeconds: 45 }));
  assert.strictEqual(handoffStart?.hotHandoffState, 'started');

  const handoffDone = LiveVoiceFrameParser.parse(JSON.stringify({ type: 'hot_handoff_complete', mode: 'resumption' }));
  assert.strictEqual(handoffDone?.hotHandoffState, 'complete');

  const awaitingSpeech = LiveVoiceFrameParser.parse(
    JSON.stringify({ type: 'tool_awaiting_speech', tools: ['update_whiteboard'] })
  );
  assert.strictEqual(awaitingSpeech?.toolAwaitingSpeech, true);

  const pong = LiveVoiceFrameParser.parse(
    JSON.stringify({ type: 'sync_pong', isUpstreamConnected: false, isUpstreamReconnecting: false, isHandoffActive: false })
  );
  assert.strictEqual(pong?.syncPongPayload?.isUpstreamConnected, false);
  console.log('  ✅ Test 4 Passed: Transport, handoff, tool_awaiting_speech, and sync_pong frames parsed.');
}

// Test 5: upstream_error frame parses structured errorPayload
{
  const errFrame = LiveVoiceFrameParser.parse(
    JSON.stringify({
      type: 'upstream_error',
      error: 'Quota exhausted across pool',
      errorCode: 'QUOTA_EXHAUSTED',
      retryable: true
    })
  );
  assert.deepStrictEqual(errFrame?.errorPayload, {
    error: 'Quota exhausted across pool',
    errorCode: 'QUOTA_EXHAUSTED',
    retryable: true
  });
  console.log('  ✅ Test 5 Passed: upstream_error frame parsed with errorCode & retryable flag.');
}

console.log('🎉 All LiveVoiceFrameParser tests passed successfully!\n');
