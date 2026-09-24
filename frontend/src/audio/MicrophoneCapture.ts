/**
 * MicrophoneCapture.ts
 * Headless 16kHz PCM audio capture with AEC, Noise Suppression & Dynamic VAD metrics.
 * SOTA Late September 2026.
 */

export interface MicrophoneMetrics {
  rmsDb: number;
  speechDetected: boolean;
  noiseFloorDb?: number;
}

export interface MicrophoneCaptureOptions {
  onAudioFrame: (base64Pcm: string, metrics?: MicrophoneMetrics) => void;
  onAudioLevel?: (rmsDb: number) => void;
  onError?: (err: Error) => void;
}

export class MicrophoneCapture {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isMuted: boolean = false;
  private isCapturing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(private options: MicrophoneCaptureOptions) {}

  public async start(sharedAudioContext?: AudioContext): Promise<void> {
    if (this.isCapturing) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        this.mediaStream = stream;

        const ctx = sharedAudioContext || new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });
        this.audioCtx = ctx;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule('/worklets/audio-capture-processor.js');
        if (ctx.state === 'closed') return;

        this.sourceNode = ctx.createMediaStreamSource(stream);
        this.workletNode = new AudioWorkletNode(ctx, 'audio-capture-processor');
        this.workletNode.port.postMessage({ type: 'RESET' });

        this.workletNode.port.onmessage = (event: MessageEvent) => {
          if (!this.isCapturing || this.isMuted) return;
          const { type, pcmBuffer, metrics } = event.data;
          if (type === 'AUDIO_FRAME' && pcmBuffer) {
            if (metrics && typeof metrics.rmsDb === 'number') {
              this.options.onAudioLevel?.(metrics.rmsDb);
            }
            const base64 = this.arrayBufferToBase64(pcmBuffer);
            this.options.onAudioFrame(base64, metrics);
          }
        };

        this.sourceNode.connect(this.workletNode);
        this.isCapturing = true;
      } catch (err) {
        this.stop();
        const error = err instanceof Error ? err : new Error(String(err));
        this.options.onError?.(error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public stop(): void {
    this.isCapturing = false;
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      this.mediaStream = null;
    }
  }

  public isActive(): boolean {
    return this.isCapturing && !this.isMuted;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
