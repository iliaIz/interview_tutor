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

console.log('🎉 All LiveVoiceFrameParser tests passed successfully!\n');
