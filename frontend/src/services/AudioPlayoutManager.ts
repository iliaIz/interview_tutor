/**
 * AudioPlayoutManager
 * SOTA 2026 Web Audio Streaming Playout Manager for Gemini 3.1 Live (24kHz PCM)
 */

import { decodeBase64PcmToFloat32 } from './audioPcmCodec';
import { playHoldChimeHelper, ChimeHandle, stopAllActiveChimes } from './audioChimes';
import { setupMobileSpeakerphoneBridge, teardownSpeakerphoneBridge } from './audioSinkRouting';
import {
  getOrCreateSharedAudioContext,
  warmupSharedAudioContext,
  clearSharedAudioContext
} from './audioContextHolder';
import { playBase64AudioHelper, playDecodedBufferHelper, stopAllActiveSources } from './audioBufferPlayback';
import { createGeminiAudioWorklet } from './audioWorkletFactory';
import { AudioDuckingController } from './audioDuckingController';

export class AudioPlayoutManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckingController = new AudioDuckingController();
  private workletNode: AudioWorkletNode | null = null;
  private workletInitPromise: Promise<void> | null = null;
  private speakerphoneElement: HTMLAudioElement | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;

  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private activeChimes: Set<ChimeHandle> = new Set();
  private pendingSamples: Float32Array[] = [];
  private isResuming = false;
  private isWorkletPlaying = false;
  private isExplicitlyPaused = false;
  private readonly isMobileDevice: boolean;
  public onPlaybackFinished?: () => void;
  public onFirstAudioPlayout?: (playoutEpochMs: number) => void;
  private hasReportedFirstPlayoutInTurn = false;
  public isMuted = false;
  private autoDrainTimer: ReturnType<typeof setTimeout> | null = null;

  public static getOrCreateContext(): AudioContext {
    return getOrCreateSharedAudioContext();
  }

  public static warmup(): AudioContext | null {
    return warmupSharedAudioContext();
  }

  constructor(existingContext?: AudioContext) {
    this.isMobileDevice =
      typeof window !== 'undefined' &&
      /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    this.ensureContext(existingContext);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.context && this.context.state !== 'closed') {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0.0 : 1.5, now + 0.005);
    }
  }

  public playThinkingAuraTone(): void {}

  public playHoldChime(isHold: boolean): void {
    if (this.isMuted) return;
    const { context, masterGain } = this.ensureContext();
    playHoldChimeHelper(context, masterGain, isHold, this.activeChimes);
  }

  public async suspend(): Promise<void> {
    this.isExplicitlyPaused = true;
    if (this.context && this.context.state === 'running') {
      try {
        await this.context.suspend();
      } catch {}
    }
  }

  public getContext(): AudioContext {
    return this.ensureContext().context;
  }

  public ensureContext(existingContext?: AudioContext): { context: AudioContext; masterGain: GainNode } {
    const isMobile = this.isMobileDevice;

    if (existingContext && existingContext.state !== 'closed') {
      if (this.context !== existingContext) {
        this.context = existingContext;
        this.setupMasterRouting(isMobile);
        void this.initWorklet(this.context);
      }
    } else if (!this.context || this.context.state === 'closed') {
      this.context = AudioPlayoutManager.getOrCreateContext();
      this.setupMasterRouting(isMobile);
      void this.initWorklet(this.context);
    }

    return { context: this.context!, masterGain: this.masterGain! };
  }

  private setupMasterRouting(isMobile: boolean): void {
    if (!this.context || this.context.state === 'closed') return;
    if (!this.masterGain) {
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.5;
    }

    if (isMobile) {
      if (!this.speakerphoneElement) {
        const bridge = setupMobileSpeakerphoneBridge(this.context, this.masterGain);
        if (bridge) {
          this.mediaStreamDest = bridge.mediaStreamDest;
          this.speakerphoneElement = bridge.speakerphoneElement;
        }
      }
    } else {
      this.masterGain.connect(this.context.destination);
    }
  }

  private async initWorklet(context: AudioContext): Promise<void> {
    if (this.workletNode) return;
    if (this.workletInitPromise) return this.workletInitPromise;

    this.workletInitPromise = (async () => {
      const node = await createGeminiAudioWorklet(context, this.masterGain, () => {
        this.isWorkletPlaying = false;
        this.hasReportedFirstPlayoutInTurn = false;
        this.onPlaybackFinished?.();
      });
      if (node) {
        this.workletNode = node;
        this.flushPendingSamples();
      }
      this.workletInitPromise = null;
    })();

    return this.workletInitPromise;
  }

  private flushPendingSamples(): void {
    if (this.pendingSamples.length > 0) {
      const queued = [...this.pendingSamples];
      this.pendingSamples = [];
      for (const samples of queued) {
        this.dispatchChunkToWorklet(samples);
      }
    }
  }

  public isSuspended(): boolean {
    return !this.context || this.context.state === 'suspended';
  }

  public async resume(): Promise<void> {
    this.isExplicitlyPaused = false;
    const { context } = this.ensureContext();

    try {
      const silent = context.createBuffer(1, 1, 22050);
      const src = context.createBufferSource();
      src.buffer = silent;
      src.connect(this.mediaStreamDest || context.destination);
      src.start(0);
    } catch {}

    if (context.state === 'suspended' && !this.isResuming) {
      this.isResuming = true;
      try {
        await context.resume();
      } catch (err) {
        console.warn('AudioContext resume warning:', err);
      } finally {
        this.isResuming = false;
      }
    }

    void this.initWorklet(context);

    if (this.speakerphoneElement?.paused) {
      this.speakerphoneElement.play().catch(() => {});
    }

    if (context.state === 'running' && this.workletNode) {
      this.flushPendingSamples();
    }
  }

  public enqueuePcmChunk(base64Payload: string): void {
    const float32Samples = decodeBase64PcmToFloat32(base64Payload);
    if (!float32Samples) return;

    const { context } = this.ensureContext();

    if (this.isExplicitlyPaused) {
      this.pendingSamples.push(float32Samples);
      return;
    }

    if (context.state === 'suspended') {
      this.pendingSamples.push(float32Samples);
      void this.resume();
      return;
    }

    if (!this.workletNode) {
      this.pendingSamples.push(float32Samples);
      void this.initWorklet(context);
      return;
    }

    this.dispatchChunkToWorklet(float32Samples);
  }

  private dispatchChunkToWorklet(float32Samples: Float32Array): void {
    if (!this.workletNode) return;

    if (!this.hasReportedFirstPlayoutInTurn) {
      this.hasReportedFirstPlayoutInTurn = true;
      try {
        this.onFirstAudioPlayout?.(Date.now());
      } catch {}
    }

    this.isWorkletPlaying = true;
    this.resetSafetyDrainWatchdog();

    this.workletNode.port.postMessage(
      { type: 'chunk', data: float32Samples },
      [float32Samples.buffer]
    );
  }

  private resetSafetyDrainWatchdog(): void {
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
    }
    this.autoDrainTimer = setTimeout(() => {
      this.autoDrainTimer = null;
      if (this.workletNode && this.isWorkletPlaying) {
        console.warn('⚠️ [AudioPlayoutManager] Safety 15s drain watchdog triggered. Gracefully draining worklet.');
        this.workletNode.port.postMessage({ type: 'drain' });
      }
    }, 15000);
  }

  public notifyTurnComplete(): void {
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
      this.autoDrainTimer = null;
    }
    if (this.workletNode && this.isWorkletPlaying) {
      this.workletNode.port.postMessage({ type: 'drain' });
    }
  }

  public async playBase64Audio(base64Audio: string): Promise<void> {
    const { context, masterGain } = this.ensureContext();
    if (context.state === 'suspended') {
      await this.resume();
    }
    await playBase64AudioHelper(
      context,
      masterGain,
      base64Audio,
      this.activeSources,
      (pcm) => this.enqueuePcmChunk(pcm),
      () => this.checkSourcesFinished()
    );
  }

  public playDecodedAudioBuffer(buffer: AudioBuffer): void {
    const { context, masterGain } = this.ensureContext();
    if (!masterGain) return;
    playDecodedBufferHelper(
      context,
      masterGain,
      buffer,
      this.activeSources,
      () => this.checkSourcesFinished()
    );
  }

  private checkSourcesFinished(): void {
    if (this.activeSources.size === 0 && !this.isWorkletPlaying) {
      this.onPlaybackFinished?.();
    }
  }

  public isPlaying(): boolean {
    return this.isWorkletPlaying || this.activeSources.size > 0 || this.pendingSamples.length > 0 || this.activeChimes.size > 0;
  }

  public startNewTurn(): void {
    this.resetTurnPlayoutState();
    if (this.isWorkletPlaying || this.pendingSamples.length > 0) {
      this.clearQueue();
    }
  }

  public resetTurnPlayoutState(): void {
    this.hasReportedFirstPlayoutInTurn = false;
  }

  public clearQueue(): void {
    if (this.autoDrainTimer) {
      clearTimeout(this.autoDrainTimer);
      this.autoDrainTimer = null;
    }
    this.isWorkletPlaying = false;
    this.hasReportedFirstPlayoutInTurn = false;
    this.pendingSamples = [];
    this.duckingController.reset();

    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'flush' });
    }

    stopAllActiveChimes(this.activeChimes);
    stopAllActiveSources(this.activeSources);
  }

  public speculativeDuck(targetGain = 0.35, rampMs = 15): void {
    if (this.isMuted) return;
    const { context, masterGain } = this.ensureContext();
    this.duckingController.speculativeDuck(context, masterGain, targetGain, rampMs);
  }

  public rollbackDucking(rampMs = 15): void {
    if (this.isMuted) return;
    const { context, masterGain } = this.ensureContext();
    this.duckingController.rollbackDucking(context, masterGain, 1.5, rampMs);
  }

  public commitBargeIn(deClickMs = 5): void {
    const { context, masterGain } = this.ensureContext();
    this.duckingController.commitBargeIn(
      context,
      masterGain,
      () => {
        this.clearQueue();
      },
      1.5,
      deClickMs
    );
  }

  public handleInterruption(): void {
    this.clearQueue();
  }

  public async teardown(): Promise<void> {
    this.onPlaybackFinished = undefined;
    this.clearQueue();

    teardownSpeakerphoneBridge({
      workletNode: this.workletNode,
      speakerphoneElement: this.speakerphoneElement,
      mediaStreamDest: this.mediaStreamDest
    });
    this.workletNode = null;
    this.speakerphoneElement = null;
    this.mediaStreamDest = null;

    if (this.context && this.context.state !== 'closed') {
      clearSharedAudioContext(this.context);
      try {
        await this.context.close();
      } catch {}
    }
    this.context = null;
    this.masterGain = null;
  }
}
