/**
 * AcousticBargeInGuard.ts
 * SOTA Late September 2026 Guard for Acoustic Barge-In & Turn 0 Question Recitation.
 * 
 * Enforces:
 * 1. Turn 0 Acoustic Lockdown Invariant: Software speech detection CANNOT interrupt
 *    the AI interviewer while reciting the technical question on Turn 0.
 *    (Tactile click-to-interrupt remains active).
 * 2. Sustained Speech Confirmation Filter: Eliminates false-positive barge-ins caused
 *    by loudspeaker echo bleed, keyboard clicks, or breath transients.
 * 
 * Cognitive bounding limit: <= 120 lines.
 */

import { MicrophoneMetrics } from './MicrophoneCapture';

export interface AcousticBargeInGuardOptions {
  sustainedFramesThreshold?: number;
}

export class AcousticBargeInGuard {
  private isTurn0Locked: boolean = true;
  private consecutiveSpeechFrames: number = 0;
  private readonly sustainedFramesThreshold: number;

  constructor(options: AcousticBargeInGuardOptions = {}) {
    this.sustainedFramesThreshold = options.sustainedFramesThreshold ?? 3;
  }

  /**
   * Set or unlock Turn 0 Question Recitation lockdown.
   * Locked on session start; unlocked once Turn 0 audio has physically drained.
   */
  public setTurn0Lockdown(locked: boolean): void {
    this.isTurn0Locked = locked;
    if (locked) {
      this.consecutiveSpeechFrames = 0;
    }
  }

  public isTurn0RecitationLocked(): boolean {
    return this.isTurn0Locked;
  }

  /**
   * Evaluates if incoming microphone audio metrics constitute a genuine,
   * candidate acoustic barge-in interruption.
   */
  public evaluateAcousticBargeIn(metrics?: MicrophoneMetrics): boolean {
    // Invariant: Turn 0 Question Recitation CANNOT be interrupted by software acoustic VAD
    if (this.isTurn0Locked) {
      this.consecutiveSpeechFrames = 0;
      return false;
    }

    if (!metrics || !metrics.speechDetected) {
      if (this.consecutiveSpeechFrames > 0) {
        this.consecutiveSpeechFrames--;
      }
      return false;
    }

    // Require energy to be comfortably above noise floor if noiseFloorDb is provided
    if (typeof metrics.noiseFloorDb === 'number' && typeof metrics.rmsDb === 'number') {
      const margin = metrics.rmsDb - metrics.noiseFloorDb;
      if (margin < 8.0) {
        return false;
      }
    }

    // Loud direct speech (rmsDb >= -20 dB) triggers immediately
    if (typeof metrics.rmsDb === 'number' && metrics.rmsDb >= -20) {
      this.consecutiveSpeechFrames = 0;
      return true;
    }

    this.consecutiveSpeechFrames++;
    if (this.consecutiveSpeechFrames >= this.sustainedFramesThreshold) {
      this.consecutiveSpeechFrames = 0;
      return true;
    }

    return false;
  }

  public reset(): void {
    this.isTurn0Locked = true;
    this.consecutiveSpeechFrames = 0;
  }
}
