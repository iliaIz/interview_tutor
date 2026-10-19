/**
 * audioDuckingController.ts
 * Speculative Audio Ducking & De-Click Barge-In Controller for SOTA Gemini Live Playout.
 * Bounded cognitive size: <= 120 lines.
 */

export class AudioDuckingController {
  private isDucked = false;

  public speculativeDuck(
    context: AudioContext | null,
    masterGain: GainNode | null,
    targetGain = 0.35,
    rampMs = 15
  ): void {
    if (this.isDucked || !masterGain || !context || context.state === 'closed') return;
    const now = context.currentTime;
    try {
      masterGain.gain.cancelScheduledValues?.(now);
      masterGain.gain.setValueAtTime?.(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime?.(targetGain, now + rampMs / 1000);
    } catch {}
    this.isDucked = true;
  }

  public rollbackDucking(
    context: AudioContext | null,
    masterGain: GainNode | null,
    baseGain = 1.5,
    rampMs = 15
  ): void {
    if (!this.isDucked || !masterGain || !context || context.state === 'closed') return;
    const now = context.currentTime;
    try {
      masterGain.gain.cancelScheduledValues?.(now);
      masterGain.gain.setValueAtTime?.(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime?.(baseGain, now + rampMs / 1000);
    } catch {}
    this.isDucked = false;
  }

  public commitBargeIn(
    context: AudioContext | null,
    masterGain: GainNode | null,
    onCommitted: () => void,
    baseGain = 1.5,
    deClickMs = 5
  ): void {
    if (masterGain && context && context.state !== 'closed') {
      const now = context.currentTime;
      try {
        masterGain.gain.cancelScheduledValues?.(now);
        masterGain.gain.setValueAtTime?.(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime?.(0.0, now + deClickMs / 1000);
      } catch {}
    }
    setTimeout(() => {
      onCommitted();
      if (masterGain && context && context.state !== 'closed') {
        try {
          masterGain.gain.setValueAtTime?.(baseGain, context.currentTime);
        } catch {}
      }
      this.isDucked = false;
    }, deClickMs + 2);
  }

  public reset(): void {
    this.isDucked = false;
  }

  public isCurrentlyDucked(): boolean {
    return this.isDucked;
  }
}
