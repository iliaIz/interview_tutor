/**
 * AudioPlayoutManager.ts
 * Deep 24kHz PCM streaming audio playout engine backed by AudioBackendPort (Spec 50 / #186).
 */

export interface AudioBackendPort {
  readonly isMobile: boolean;
  ensureGraph(): { sampleRate: number; state: AudioContextState };
  resumeContext(): Promise<void>;
  getRawContext(): AudioContext;
  setNominalGain(value: number): void;
  getGainValue(): number;
  postWorkletSamples(samples: Float32Array): boolean;
  flushWorklet(): void;
  drainWorklet(): void;
  onWorkletReady(listener: () => void): void;
  onWorkletDrained(listener: () => void): void;
  close(): Promise<void>;
}

let sharedBrowserAudioContext: AudioContext | null = null;

function getOrCreateBrowserAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext unavailable outside browser environment');
  }
  if (!sharedBrowserAudioContext || sharedBrowserAudioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedBrowserAudioContext = new AudioCtx({ latencyHint: 'interactive' });
  }
  if (sharedBrowserAudioContext.state === 'suspended') {
    void sharedBrowserAudioContext.resume().catch(() => {});
  }
  return sharedBrowserAudioContext;
}

function decodeBase64PcmToFloat32(base64Payload: string): Float32Array | null {
  const sanitized = (base64Payload || '').replace(/\s+/g, '');
  if (!sanitized) return null;

  let uint8: Uint8Array;
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    try {
      uint8 = (Uint8Array as any).fromBase64(sanitized);
    } catch {
      const bin = atob(sanitized);
      uint8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) uint8[i] = bin.charCodeAt(i);
    }
  } else {
    const bin = atob(sanitized);
    uint8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) uint8[i] = bin.charCodeAt(i);
  }

  const sampleCount = Math.floor(uint8.byteLength / 2);
  if (sampleCount <= 1) return null;
  const view = new DataView(uint8.buffer, uint8.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    out[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0;
  }
  return out;
}

class BrowserAudioBackendPort implements AudioBackendPort {
  public readonly isMobile: boolean;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletInitPromise: Promise<void> | null = null;
  private speakerphoneElement: HTMLAudioElement | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private readyListener?: () => void;
  private drainedListener?: () => void;

  constructor(initialContext?: AudioContext) {
    this.isMobile = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (initialContext && initialContext.state !== 'closed') {
      this.attachContext(initialContext);
    }
  }

  private attachContext(ctx: AudioContext): void {
    this.context = ctx;
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1.5;
    }
    if (this.isMobile) {
      if (!this.speakerphoneElement) {
        try {
          const dest = ctx.createMediaStreamDestination();
          this.masterGain.connect(dest);
          const audio = document.createElement('audio');
          audio.setAttribute('playsinline', 'true');
          audio.setAttribute('webkit-playsinline', 'true');
          audio.autoplay = true;
          audio.muted = false;
          audio.volume = 1.0;
          audio.srcObject = dest.stream;
          audio.play().catch(() => {});
          this.mediaStreamDest = dest;
          this.speakerphoneElement = audio;
        } catch {
          this.masterGain.connect(ctx.destination);
        }
      }
    } else {
      this.masterGain.connect(ctx.destination);
    }
    void this.initWorklet(ctx);
  }

  private async initWorklet(ctx: AudioContext): Promise<void> {
    if (this.workletNode || this.workletInitPromise || ctx.state === 'closed') return;
    this.workletInitPromise = (async () => {
      try {
        await ctx.audioWorklet.addModule('/worklets/gemini-audio-processor.js');
        if (ctx.state === 'closed') return;
        const node = new AudioWorkletNode(ctx, 'gemini-audio-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        if (this.masterGain) node.connect(this.masterGain);
        node.port.onmessage = (event) => {
          if (event.data?.type === 'drained') this.drainedListener?.();
        };
        this.workletNode = node;
        this.readyListener?.();
      } catch (err) {
        console.error('Failed to register gemini-audio-processor worklet:', err);
      } finally {
        this.workletInitPromise = null;
      }
    })();
    return this.workletInitPromise;
  }

  public ensureGraph(): { sampleRate: number; state: AudioContextState } {
    if (!this.context || this.context.state === 'closed') {
      this.masterGain = null;
      this.workletNode = null;
      this.attachContext(getOrCreateBrowserAudioContext());
    }
    return { sampleRate: this.context!.sampleRate || 24000, state: this.context!.state };
  }

  public async resumeContext(): Promise<void> {
    this.ensureGraph();
    const ctx = this.context!;
    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(this.mediaStreamDest || ctx.destination);
      src.start(0);
    } catch {}
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      await ctx.resume().catch((err) => console.warn('AudioContext resume warning:', err));
    }
    await this.initWorklet(ctx);
    if (this.speakerphoneElement?.paused) {
      this.speakerphoneElement.play().catch(() => {});
    }
  }

  public getRawContext(): AudioContext {
    this.ensureGraph();
    return this.context!;
  }

  public setNominalGain(value: number): void {
    if (!this.masterGain || !this.context || this.context.state === 'closed') return;
    const now = this.context.currentTime;
    try {
      this.masterGain.gain.cancelScheduledValues?.(now);
      this.masterGain.gain.setValueAtTime?.(value, now);
    } catch {}
    this.masterGain.gain.value = value;
  }

  public getGainValue(): number {
    return this.masterGain?.gain?.value ?? 1.5;
  }

  public postWorkletSamples(samples: Float32Array): boolean {
    if (!this.workletNode) return false;
    this.workletNode.port.postMessage({ type: 'chunk', data: samples }, [samples.buffer]);
    return true;
  }

  public flushWorklet(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'flush' });
    }
  }

  public drainWorklet(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'drain' });
    }
  }

  public onWorkletReady(listener: () => void): void {
    this.readyListener = listener;
  }

  public onWorkletDrained(listener: () => void): void {
    this.drainedListener = listener;
  }

  public async close(): Promise<void> {
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch {}
    }
    if (this.speakerphoneElement) {
      try { this.speakerphoneElement.pause(); this.speakerphoneElement.srcObject = null; } catch {}
    }
    if (this.mediaStreamDest) {
      try { this.mediaStreamDest.disconnect(); } catch {}
    }
    this.workletNode = null;
    this.speakerphoneElement = null;
    this.mediaStreamDest = null;
    if (this.context && this.context.state !== 'closed') {
      if (sharedBrowserAudioContext === this.context) sharedBrowserAudioContext = null;
      try { await this.context.close(); } catch {}
    }
    this.context = null;
    this.masterGain = null;
  }
}

export class AudioPlayoutManager {
  private readonly backend: AudioBackendPort;
  private pendingSamples: Float32Array[] = [];
  private isResuming = false;
  private isWorkletPlaying = false;
  private hasReportedFirstPlayoutInTurn = false;
  private autoDrainTimer: ReturnType<typeof setTimeout> | null = null;
  public onPlaybackFinished?: () => void;
  public onFirstAudioPlayout?: (playoutEpochMs: number) => void;

  public static getOrCreateContext(): AudioContext {
    return getOrCreateBrowserAudioContext();
  }

  public static warmup(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      return getOrCreateBrowserAudioContext();
    } catch {
      return null;
    }
  }

  constructor(backendOrContext?: AudioContext | AudioBackendPort) {
    this.backend =
      backendOrContext && 'ensureGraph' in backendOrContext
        ? backendOrContext
        : new BrowserAudioBackendPort(backendOrContext);
    this.backend.onWorkletReady(() => this.flushPendingSamples());
    this.backend.onWorkletDrained(() => {
      this.isWorkletPlaying = false;
      this.hasReportedFirstPlayoutInTurn = false;
      this.onPlaybackFinished?.();
    });
    if (!backendOrContext || 'ensureGraph' in backendOrContext) {
      this.backend.ensureGraph();
    }
  }

  public getContext(): AudioContext {
    return this.backend.getRawContext();
  }

  public async resume(): Promise<void> {
    if (this.isResuming) return;
    this.isResuming = true;
    try {
      await this.backend.resumeContext();
      this.flushPendingSamples();
    } finally {
      this.isResuming = false;
    }
  }

  public enqueuePcmChunk(base64Payload: string): void {
    const float32Samples = decodeBase64PcmToFloat32(base64Payload);
    if (!float32Samples) return;

    const { state } = this.backend.ensureGraph();
    if (state === 'suspended' || state === 'interrupted') {
      this.pendingSamples.push(float32Samples);
      void this.resume();
      return;
    }

    if (Math.abs(this.backend.getGainValue() - 1.5) > 0.05) {
      this.backend.setNominalGain(1.5);
    }

    if (!this.dispatchChunk(float32Samples)) {
      this.pendingSamples.push(float32Samples);
      void this.resume();
    }
  }

  private dispatchChunk(samples: Float32Array): boolean {
    if (!this.hasReportedFirstPlayoutInTurn) {
      this.hasReportedFirstPlayoutInTurn = true;
      try { this.onFirstAudioPlayout?.(Date.now()); } catch {}
    }
    const posted = this.backend.postWorkletSamples(samples);
    if (!posted) return false;
    this.isWorkletPlaying = true;
    this.resetSafetyDrainWatchdog();
    return true;
  }

  private flushPendingSamples(): void {
    if (this.pendingSamples.length === 0) return;
    const queued = [...this.pendingSamples];
    this.pendingSamples = [];
    for (let i = 0; i < queued.length; i++) {
      if (!this.dispatchChunk(queued[i])) {
        this.pendingSamples = queued.slice(i);
        break;
      }
    }
  }

  private resetSafetyDrainWatchdog(): void {
    if (this.autoDrainTimer) clearTimeout(this.autoDrainTimer);
    this.autoDrainTimer = setTimeout(() => {
      this.autoDrainTimer = null;
      if (this.isWorkletPlaying) {
        console.warn('⚠️ [AudioPlayoutManager] Safety 15s drain watchdog triggered. Gracefully draining worklet.');
        this.notifyTurnComplete();
      }
    }, 15_000);
  }

  public notifyTurnComplete(): void {
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
      this.autoDrainTimer = null;
    }
    this.backend.drainWorklet();
  }

  public isPlaying(): boolean {
    return this.isWorkletPlaying || this.pendingSamples.length > 0;
  }

  public clearQueue(): void {
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
      this.autoDrainTimer = null;
    }
    this.isWorkletPlaying = false;
    this.hasReportedFirstPlayoutInTurn = false;
    this.pendingSamples = [];
    this.backend.flushWorklet();
  }

  public handleInterruption(): void {
    this.clearQueue();
    this.backend.setNominalGain(1.5);
  }

  public async teardown(): Promise<void> {
    this.onPlaybackFinished = undefined;
    this.clearQueue();
    await this.backend.close();
  }
}
