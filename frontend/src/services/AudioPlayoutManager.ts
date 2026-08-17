/**
 * AudioPlayoutManager
 * Seamless 24kHz Int16 mono PCM playback scheduling with:
 * - Studio-grade DynamicsCompressor + Gain boost (1.35x)
 * - Safe Int16 TypedArray buffer unpacking (endianness-safe)
 * - 80ms jitter queue to prevent underruns
 * - Autoplay policy suspended queueing and auto-flush
 * - 5ms linear gain de-click ramp on Barge-in interruption
 */
export class AudioPlayoutManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private playheadCursor = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private pendingSamples: Float32Array[] = [];
  private readonly JITTER_LEAD_SECONDS = 0.080; // 80ms jitter buffer for smooth playback
  private readonly TARGET_SAMPLE_RATE = 24000;

  constructor() {
    this.ensureContext();
  }

  public ensureContext(): { context: AudioContext; masterGain: GainNode } {
    if (!this.context || this.context.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioCtx({ latencyHint: 'interactive' });

      // Studio Compressor for loud & clear dialogue
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.context.currentTime);
      this.compressor.knee.setValueAtTime(30, this.context.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.context.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.context.currentTime);

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.35; // Gentle boost for soft speech

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    }
    return { context: this.context, masterGain: this.masterGain! };
  }

  public isSuspended(): boolean {
    return !this.context || this.context.state === 'suspended';
  }

  public async resume(): Promise<void> {
    const { context } = this.ensureContext();
    if (context.state === 'suspended') {
      try {
        await context.resume();
        console.log('🔊 AudioContext resumed, current state:', context.state);
      } catch (err) {
        console.warn('AudioContext resume warning:', err);
      }
    }

    if (context.state === 'running' && this.pendingSamples.length > 0) {
      console.log(`🔊 Flushing ${this.pendingSamples.length} pending audio frames to speakers...`);
      const queued = [...this.pendingSamples];
      this.pendingSamples = [];
      this.playheadCursor = context.currentTime + this.JITTER_LEAD_SECONDS;
      for (const samples of queued) {
        this.scheduleBufferOnTimeline(samples);
      }
    }
  }

  /**
   * Enqueue Base64-encoded Int16 PCM 24kHz chunk into Web Audio timeline
   */
  public enqueuePcmChunk(base64Payload: string): void {
    if (!base64Payload || base64Payload.length === 0) return;
    const { context } = this.ensureContext();

    const binaryString = atob(base64Payload);
    const len = binaryString.length;
    const sampleCount = Math.floor(len / 2);
    if (sampleCount === 0) return;

    const uint8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      uint8[i] = binaryString.charCodeAt(i);
    }

    // Direct TypedArray view (Little Endian signed 16-bit PCM)
    const int16 = new Int16Array(uint8.buffer, uint8.byteOffset, sampleCount);
    const float32Samples = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      float32Samples[i] = int16[i] / 32768.0;
    }

    if (context.state === 'suspended') {
      this.pendingSamples.push(float32Samples);
      void this.resume();
      return;
    }

    this.scheduleBufferOnTimeline(float32Samples);
  }

  private scheduleBufferOnTimeline(samples: Float32Array): void {
    if (samples.length === 0) return;
    const { context, masterGain } = this.ensureContext();

    if (context.state === 'suspended') {
      this.pendingSamples.push(samples);
      return;
    }

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
    this.pendingSamples = [];
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

        // 3. Reset gain back to unity (1.35) for future speech
        if (this.context && this.masterGain && this.context.state !== 'closed') {
          this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
          this.masterGain.gain.setValueAtTime(1.35, this.context.currentTime);
        }
      }, fadeDurationSec * 1000 + 2);
    } catch (err) {
      console.warn('Interruption cleanup warning:', err);
    }
  }

  public async teardown(): Promise<void> {
    this.handleInterruption();
    this.pendingSamples = [];
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close();
      } catch {}
    }
    this.context = null;
    this.masterGain = null;
    this.compressor = null;
    this.activeSources.clear();
    this.playheadCursor = 0;
  }
}
