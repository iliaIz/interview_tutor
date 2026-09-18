/**
 * silenceGenerator.ts
 *
 * Generates calibrated zero-PCM buffers for silence and pause simulation.
 * Format: 16 000 Hz, 16-bit Little-Endian, 1 channel (Mono).
 * Byte rate: 16 000 samples/sec * 2 bytes/sample = 32 000 bytes/sec.
 */

export const SAMPLE_RATE = 16000;
export const BYTES_PER_SAMPLE = 2; // 16-bit
export const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE; // 32,000 bytes/sec

/**
 * Generates a buffer of digital silence (all zeros) for a specified duration in milliseconds.
 */
export function generateSilence(durationMs: number): Buffer {
  if (durationMs <= 0) return Buffer.alloc(0);
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const numBytes = numSamples * BYTES_PER_SAMPLE;
  return Buffer.alloc(numBytes, 0);
}

/**
 * Generates a brief acoustic impulse (burst) to test noise rejection.
 * e.g. 150ms of low-energy white noise or a click.
 */
export function generateNoiseBurst(durationMs: number = 150, amplitude: number = 0.05): Buffer {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const buf = Buffer.alloc(numSamples * BYTES_PER_SAMPLE);
  for (let i = 0; i < numSamples; i++) {
    // Generate gentle pseudo-random noise within amplitude bound
    const sampleVal = Math.round((Math.random() * 2 - 1) * amplitude * 32767);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, sampleVal)), i * 2);
  }
  return buf;
}
