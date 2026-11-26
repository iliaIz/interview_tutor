/**
 * LiveDeadAirGuard.ts
 *
 * Upstream Gemini Live Vocoder Stall & Digital Silence Clamper (SOTA Late 2026).
 * Ported faithfully from gemini_live_reference/packages/bff-gateway/src/deadAirGuard.ts.
 * Suppresses trailing silence frames >1200ms and clamps turn at >=2000ms.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

export interface DeadAirGuardConfig {
  suppressThresholdMs?: number; // default: 1200ms
  clampThresholdMs?: number; // default: 2000ms
}

export interface DeadAirInspectionResult {
  suppressFrame: boolean;
  synthesizeTurnComplete: boolean;
}

export class LiveDeadAirGuard {
  private readonly suppressThresholdMs: number;
  private readonly clampThresholdMs: number;

  private hasActiveSpeechOccurred = false;
  private silenceStartTime: number | null = null;
  private isClamped = false;

  constructor(config: DeadAirGuardConfig = {}) {
    this.suppressThresholdMs = config.suppressThresholdMs ?? 1200;
    this.clampThresholdMs = config.clampThresholdMs ?? 2000;
  }

  /**
   * Inspects incoming audio chunk payload from Gemini upstream.
   * @param isZeroEnergy true if incoming PCM is digital silence / below noise floor
   */
  public inspectAudioFrame(isZeroEnergy: boolean, nowMs: number = Date.now()): DeadAirInspectionResult {
    const now = nowMs;

    if (!isZeroEnergy) {
      // Real speech audio is flowing
      this.hasActiveSpeechOccurred = true;
      this.silenceStartTime = null;
      this.isClamped = false;
      return { suppressFrame: false, synthesizeTurnComplete: false };
    }

    // Only start counting trailing dead air if active speech already occurred in this turn
    if (!this.hasActiveSpeechOccurred) {
      return { suppressFrame: false, synthesizeTurnComplete: false };
    }

    if (this.silenceStartTime === null) {
      this.silenceStartTime = now;
    }

    const elapsedSilenceMs = now - this.silenceStartTime;

    // Condition 1: Exceeded 2000ms clamp threshold -> synthesize turnComplete
    if (elapsedSilenceMs >= this.clampThresholdMs && !this.isClamped) {
      this.isClamped = true;
      this.silenceStartTime = null;
      this.hasActiveSpeechOccurred = false;
      return {
        suppressFrame: true,
        synthesizeTurnComplete: true
      };
    }

    // Condition 2: Exceeded 1200ms suppress threshold -> suppress frame
    if (elapsedSilenceMs >= this.suppressThresholdMs) {
      return {
        suppressFrame: true,
        synthesizeTurnComplete: false
      };
    }

    return { suppressFrame: false, synthesizeTurnComplete: false };
  }

  /**
   * Convenience wrapper inspecting parsed Gemini serverContent.modelTurn parts.
   */
  public inspectServerContent(serverContent: any): DeadAirInspectionResult {
    const parts = serverContent?.modelTurn?.parts;
    let isSilence = true;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data && LiveDeadAirGuard.calculateBase64PcmRms(part.inlineData.data) > 0.005) {
          isSilence = false;
          break;
        }
      }
    }
    return this.inspectAudioFrame(isSilence);
  }

  /**
   * Computes Root-Mean-Square (RMS) amplitude of Base64-encoded 16-bit linear PCM.
   */
  public static calculateBase64PcmRms(base64Data: string): number {
    if (!base64Data) return 0;
    const buf = Buffer.from(base64Data, 'base64');
    const samplesCount = Math.floor(buf.length / 2);
    if (samplesCount === 0) return 0;
    let sumSq = 0;
    for (let i = 0; i < samplesCount; i++) {
      const val = buf.readInt16LE(i * 2);
      const norm = val < 0 ? val / 32768 : val / 32767;
      sumSq += norm * norm;
    }
    return Math.sqrt(sumSq / samplesCount);
  }

  /**
   * Resets guard on turn completion or user speech turn.
   */
  public reset(): void {
    this.hasActiveSpeechOccurred = false;
    this.silenceStartTime = null;
    this.isClamped = false;
  }
}
