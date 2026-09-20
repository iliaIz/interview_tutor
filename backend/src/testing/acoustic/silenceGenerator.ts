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

/**
 * Generates a soft breath/sigh noise burst (400ms low-pass filtered noise with smooth envelope).
 * Used to verify that non-speech exhalations do NOT trigger false VAD speech events.
 */
export function generateBreathNoise(durationMs: number = 400, amplitude: number = 0.04): Buffer {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const buf = Buffer.alloc(numSamples * BYTES_PER_SAMPLE);
  let lastVal = 0;

  for (let i = 0; i < numSamples; i++) {
    // Raised cosine bell envelope: fades in and fades out smoothly
    const env = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (numSamples - 1)));
    // Low-pass brownian filter to simulate warm breath
    const white = Math.random() * 2 - 1;
    lastVal = 0.9 * lastVal + 0.1 * white;
    const sampleVal = Math.round(lastVal * env * amplitude * 32767);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, sampleVal)), i * 2);
  }
  return buf;
}

/**
 * Overlays randomized mechanical keyboard click transients onto an existing speech PCM buffer.
 * Tests VAD immunity to concurrent typing sounds during an interview.
 */
export function generateTypingNoiseOverlay(speechPcm: Buffer, clicksPerSecond: number = 3): Buffer {
  const output = Buffer.from(speechPcm); // Clone buffer
  const totalSamples = Math.floor(output.length / BYTES_PER_SAMPLE);
  const clickDurationSamples = Math.floor((SAMPLE_RATE * 20) / 1000); // 20ms click

  const intervalSamples = Math.floor(SAMPLE_RATE / clicksPerSecond);
  for (let pos = Math.floor(intervalSamples * 0.5); pos < totalSamples - clickDurationSamples; pos += intervalSamples + Math.floor((Math.random() - 0.5) * 2000)) {
    for (let c = 0; c < clickDurationSamples; c++) {
      const idx = (pos + c) * BYTES_PER_SAMPLE;
      if (idx + 1 < output.length) {
        const original = output.readInt16LE(idx);
        // Exponential decay click transient
        const clickAmp = Math.exp(-c / 50) * (Math.random() * 0.15);
        const clickVal = Math.round(clickAmp * 32767);
        const mixed = Math.max(-32768, Math.min(32767, original + clickVal));
        output.writeInt16LE(mixed, idx);
      }
    }
  }
  return output;
}

/**
 * Generates synthetic harmonic speech-formant PCM (16kHz 16-bit LE) for deterministic offline testing.
 */
export function generateSyntheticSpeech(durationMs: number = 3500, amplitude: number = 0.25): Buffer {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const buf = Buffer.alloc(numSamples * BYTES_PER_SAMPLE);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Harmonic vowel formants (F0=130Hz, F1=650Hz, F2=1400Hz) with gentle amplitude modulation
    const f0 = Math.sin(2 * Math.PI * 130 * t);
    const f1 = 0.5 * Math.sin(2 * Math.PI * 650 * t);
    const f2 = 0.25 * Math.sin(2 * Math.PI * 1400 * t);
    const mod = 0.8 + 0.2 * Math.sin(2 * Math.PI * 4 * t);
    const sampleVal = Math.round((f0 + f1 + f2) * mod * amplitude * 32767);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, sampleVal)), i * 2);
  }
  return buf;
}

