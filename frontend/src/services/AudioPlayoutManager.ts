/**
 * AudioPlayoutManager
 * Seamless 24kHz Int16 mono PCM playback scheduling with:
 * - Direct Little-Endian DataView float conversion (100% cross-platform safe)
 * - Safe gain boost (1.5x) direct to destination
 * - 80ms jitter queue to prevent underruns
 * - Autoplay policy suspended queueing with concurrent resume protection
 * - 5ms linear gain de-click ramp on Barge-in interruption
 */
export class AudioPlayoutManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playheadCursor = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private pendingSamples: Float32Array[] = [];
  private isResuming = false;
  private readonly JITTER_LEAD_SECONDS = 0.080; // 80ms jitter buffer for smooth playback
  private readonly TARGET_SAMPLE_RATE = 24000;

  constructor() {
    this.ensureContext();
  }

  public ensureContext(): { context: AudioContext; masterGain: GainNode } {
    if (!this.context || this.context.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioCtx({ latencyHint: 'interactive' });

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.5; // Clear, loud, comfortable volume
      this.masterGain.connect(this.context.destination);
    }
    return { context: this.context, masterGain: this.masterGain! };
  }

  public isSuspended(): boolean {
    return !this.context || this.context.state === 'suspended';
  }

  public async resume(): Promise<void> {
    const { context } = this.ensureContext();
    if (context.state === 'suspended') {
      if (!this.isResuming) {
        this.isResuming = true;
        try {
          await context.resume();
          console.log('🔊 AudioContext resumed, state:', context.state);
        } catch (err) {
          console.warn('AudioContext resume warning:', err);
        } finally {
          this.isResuming = false;
        }
      }
    }

    if (context.state === 'running' && this.pendingSamples.length > 0) {
      console.log(`🔊 Flushing ${this.pendingSamples.length} queued audio chunks to speakers...`);
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

    // Direct DataView for guaranteed Little-Endian 16-bit signed decoding
    const dataView = new DataView(uint8.buffer, uint8.byteOffset, len);
    const float32Samples = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      float32Samples[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0;
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
    if (this.playheadCursor < now + this.JITTER_LEAD_SECONDS) {
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
   * Returns true if audio is currently actively scheduled or playing
   */
  public isPlaying(): boolean {
    return this.activeSources.size > 0 || this.pendingSamples.length > 0;
  }

  /**
   * Clears scheduled queue and stops all active audio playback immediately
   */
  public clearQueue(): void {
    this.pendingSamples = [];
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    if (this.context && this.context.state !== 'closed') {
      this.playheadCursor = this.context.currentTime + this.JITTER_LEAD_SECONDS;
    } else {
      this.playheadCursor = 0;
    }
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

        // 3. Reset gain back to unity (1.5) for future speech
        if (this.context && this.masterGain && this.context.state !== 'closed') {
          this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
          this.masterGain.gain.setValueAtTime(1.5, this.context.currentTime);
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
    this.activeSources.clear();
    this.playheadCursor = 0;
  }
}
