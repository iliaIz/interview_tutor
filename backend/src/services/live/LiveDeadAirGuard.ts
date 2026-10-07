/**
 * LiveDeadAirGuard.ts
 * SOTA Late 2026 Acoustic Output Watchdog for Gemini Multimodal Live Downlink.
 *
 * Problem:
 * Certain upstream neural vocoders (e.g. Aoede or Fenrir in non-English speech with mixed terms)
 * synthesize initial greeting speech (2-5s) and then encounter an EOS/alignment failure, streaming
 * 30-90 seconds of continuous digital silence (-65 dB to -70 dB PCM frames) while holding turn open.
 *
 * Solution:
 * Analyzes RMS amplitude of model audio frames in real time:
 * - Before speech begins: allows TTFA/TTFT pacing.
 * - Active speech: (RMS > 200 / > -44 dB) marks speech started and resets silence counters.
 * - Syntactic pauses: allows up to 1200ms of inter-word / inter-phrase pause.
 * - Dead-air damping: suppresses trailing silence frames between 1200ms and 2000ms.
 * - Clamping: when continuous dead-air reaches >= 2000ms after speech, flags immediate turn clamp,
 *   enabling the stream router to gracefully truncate the turn and emit terminal turnComplete: true.
 *
 * Cognitive bounding limit: <= 140 lines.
 */

export interface DeadAirProcessResult {
  suppressChunk: boolean;
  shouldClampTurn: boolean;
  rms: number;
}

export class LiveDeadAirGuard {
  private hasSpeechStarted = false;
  private consecutiveSilenceBytes = 0;
  private isClamped = false;

  public reset(): void {
    this.hasSpeechStarted = false;
    this.consecutiveSilenceBytes = 0;
    this.isClamped = false;
  }

  public getIsClamped(): boolean {
    return this.isClamped;
  }

  public getHasSpeechStarted(): boolean {
    return this.hasSpeechStarted;
  }

  public processChunk(base64Pcm: string): DeadAirProcessResult {
    if (!base64Pcm) {
      return { suppressChunk: false, shouldClampTurn: false, rms: 0 };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Pcm, 'base64');
    } catch {
      return { suppressChunk: false, shouldClampTurn: false, rms: 0 };
    }

    const sampleCount = Math.floor(buffer.length / 2);
    if (sampleCount === 0) {
      return { suppressChunk: false, shouldClampTurn: false, rms: 0 };
    }

    let sumSq = 0;
    for (let i = 0; i < sampleCount; i++) {
      const val = buffer.readInt16LE(i * 2);
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / sampleCount);

    // Active speech threshold: RMS > 200 (~-44 dB in 16-bit PCM)
    // SOTA Late 2026: If actual voice is synthesized, immediately unclamp and let speech through!
    if (rms > 200) {
      this.isClamped = false;
      this.hasSpeechStarted = true;
      this.consecutiveSilenceBytes = 0;
      return { suppressChunk: false, shouldClampTurn: false, rms };
    }

    if (this.isClamped) {
      return { suppressChunk: true, shouldClampTurn: false, rms: 0 };
    }

    // Silence floor detection after speech has started
    if (this.hasSpeechStarted && rms <= 100) {
      this.consecutiveSilenceBytes += buffer.length;
      // 24kHz 16-bit mono PCM = 48,000 bytes per second
      const silenceMs = Math.round((this.consecutiveSilenceBytes / 48000) * 1000);

      // Natural syntactic pause (up to 1200ms) - let through untouched
      if (silenceMs <= 1200) {
        return { suppressChunk: false, shouldClampTurn: false, rms };
      }

      // Beyond 1200ms but under 2000ms: suppress dead-air chunks to protect client buffer
      if (silenceMs < 2000) {
        return { suppressChunk: true, shouldClampTurn: false, rms };
      }

      // Reached >= 2000ms of dead air after speech: clamp the turn!
      this.isClamped = true;
      return { suppressChunk: true, shouldClampTurn: true, rms };
    }

    // Intermediate energy (100 < rms <= 200, e.g. low phonemes or whispers): let through
    return { suppressChunk: false, shouldClampTurn: false, rms };
  }
}
