/**
 * AudioPlayoutManager
 * Seamless 24kHz Int16 mono PCM playback scheduling with jitter buffering
 * and click-free 5ms linear gain de-click ramp on Barge-in interruption.
 */
export class AudioPlayoutManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playheadCursor = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private readonly JITTER_LEAD_SECONDS = 0.025; // 25ms jitter buffer
  private readonly TARGET_SAMPLE_RATE = 24000;

  constructor() {
    // AudioContext will be initialized or resumed on user interaction
  }

  private ensureContext(): { context: AudioContext; masterGain: GainNode } {
    if (!this.context || this.context.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioCtx({ latencyHint: 'interactive' });
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.context.destination);
    }
    return { context: this.context, masterGain: this.masterGain! };
  }

  public async resume(): Promise<void> {
    const { context } = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  /**
   * Enqueue Base64-encoded Int16 PCM 24kHz chunk into Web Audio timeline
   */
  public enqueuePcmChunk(base64Payload: string): void {
    const { context } = this.ensureContext();
    if (context.state === 'suspended') {
      void context.resume();
    }

    const binaryString = atob(base64Payload);
    const byteLength = binaryString.length;
    const rawBytes = new Uint8Array(byteLength);

    for (let i = 0; i < byteLength; i++) {
      rawBytes[i] = binaryString.charCodeAt(i);
    }

    const int16Samples = new Int16Array(rawBytes.buffer);
    const float32Samples = new Float32Array(int16Samples.length);

    // Normalize Int16 to [-1.0, 1.0] Float32
    for (let i = 0; i < int16Samples.length; i++) {
      const sample = int16Samples[i];
      float32Samples[i] = sample < 0 ? sample / 32768 : sample / 32767;
    }

    this.scheduleBufferOnTimeline(float32Samples);
  }

  private scheduleBufferOnTimeline(samples: Float32Array): void {
    if (samples.length === 0) return;
    const { context, masterGain } = this.ensureContext();

    const buffer = context.createBuffer(1, samples.length, this.TARGET_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);

    const now = context.currentTime;

    // Reset cursor if playback fell behind due to network stall
    if (this.playheadCursor < now) {
      this.playheadCursor = now + this.JITTER_LEAD_SECONDS;
    }

    const startTime = this.playheadCursor;
    source.start(startTime);
    this.playheadCursor += buffer.duration;

    this.activeSources.add(source);

    source.onended = () => {
      try {
        source.disconnect();
      } catch {}
      this.activeSources.delete(source);
    };
  }

  /**
   * Instantly stops playback with a 5ms de-click ramp on serverContent.interrupted (Barge-in)
   */
  public handleInterruption(): void {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const fadeDurationSec = 0.005; // 5ms linear ramp

    try {
      // 1. Rapid fade-out to prevent acoustic pop/click
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0, now + fadeDurationSec);

      // 2. Tear down active nodes after ramp completes
      setTimeout(() => {
        for (const source of this.activeSources) {
          try {
            source.stop();
            source.disconnect();
          } catch {}
        }
        this.activeSources.clear();
        this.playheadCursor = 0;

        // 3. Reset gain back to unity (1.0) for future speech
        if (this.context && this.masterGain && this.context.state !== 'closed') {
          this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
          this.masterGain.gain.setValueAtTime(1.0, this.context.currentTime);
        }
      }, fadeDurationSec * 1000 + 2);
    } catch (err) {
      console.warn('Interruption cleanup warning:', err);
    }
  }

  public async teardown(): Promise<void> {
    this.handleInterruption();
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close();
      } catch {}
    }
    this.context = null;
    this.masterGain = null;
    this.activeSources.clear();
    this.playheadCursor = 0;
  }
}
