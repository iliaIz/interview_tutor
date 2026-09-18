/**
 * testAcousticFixtures.ts
 *
 * Automated verification of Stage 01:
 * Silence generator, noise generator, RIFF WAV parser & 24k->16k resampler.
 */

import { generateSilence, generateNoiseBurst, SAMPLE_RATE, BYTES_PER_SECOND } from '../testing/acoustic/silenceGenerator';
import { wavToPcm16k, GOLDEN_FIXTURES } from '../testing/acoustic/acousticFixtureManager';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('🚀 Running Stage 01 Acoustic Fixture Verification...\n');

// 1. Silence Generator
const silence1s = generateSilence(1000);
assert(silence1s.length === BYTES_PER_SECOND, `1s silence is exactly ${BYTES_PER_SECOND} bytes (got ${silence1s.length})`);
assert(silence1s.every((b) => b === 0), '1s silence contains only zero bytes');

const silence500ms = generateSilence(500);
assert(silence500ms.length === BYTES_PER_SECOND / 2, `500ms silence is exactly ${BYTES_PER_SECOND / 2} bytes`);

// 2. Noise Burst Generator
const noise150ms = generateNoiseBurst(150);
assert(noise150ms.length === 16000 * 2 * 0.15, `150ms noise burst is exactly 4800 bytes (got ${noise150ms.length})`);
const hasNonZero = noise150ms.some((b) => b !== 0);
assert(hasNonZero, 'Noise burst contains acoustic audio samples');

// 3. Synthetic 24kHz Mono WAV -> 16kHz PCM Converter & Resampler Test
function createSyntheticWav(sampleRate: number, durationSeconds: number): Buffer {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // subchunk1 size
  header.writeUInt16LE(1, 20); // audio format (PCM)
  header.writeUInt16LE(1, 22); // 1 channel
  header.writeUInt32LE(sampleRate, 24); // sample rate
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    // 440 Hz Sine wave
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000);
    data.writeInt16LE(sample, i * 2);
  }

  return Buffer.concat([header, data]);
}

const wav24k = createSyntheticWav(24000, 1.0); // 1 second of 24kHz audio
const pcm16k = wavToPcm16k(wav24k);
assert(
  Math.abs(pcm16k.length - 32000) <= 2,
  `Resampled 24kHz WAV (1s) to 16kHz PCM has 32000 bytes (got ${pcm16k.length})`
);

// 4. Fixture Catalog Definition Completeness
assert(Object.keys(GOLDEN_FIXTURES).length >= 6, `Golden fixtures catalog has >= 6 fixtures (got ${Object.keys(GOLDEN_FIXTURES).length})`);
assert(!!GOLDEN_FIXTURES.candidate_sycophancy_bait, 'candidate_sycophancy_bait is registered');
assert(!!GOLDEN_FIXTURES.candidate_hesitation_part1, 'candidate_hesitation_part1 is registered');
assert(!!GOLDEN_FIXTURES.candidate_hesitation_part2, 'candidate_hesitation_part2 is registered');

console.log('\n🎉 All Stage 01 Acoustic Fixture assertions passed successfully!');
