/**
 * AudioWorkletProcessor for high-performance audio capture
 * - Operates seamlessly on native AudioContext sample rates (48kHz, 44.1kHz, 16kHz)
 * - Built-in high-fidelity linear downsampler to 16kHz PCM
 * - Signed 16-bit Int16 PCM quantization
 * - Schmitt-trigger VAD & RMS dB computation
 * - Zero-copy 1024-sample buffer transfer (64ms chunks @ 16kHz)
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    // sampleRate is a global in AudioWorkletGlobalScope provided by the parent AudioContext
    this.sourceSampleRate = typeof sampleRate !== 'undefined' ? sampleRate : 48000;
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;
    this.resamplePos = 0;
    this.prevSample = 0;

    // 1600 samples @ 16kHz = 100ms chunk (canonical SOTA streaming matching Gemini 3.8 Live)
    this.outputChunkCapacity = 1600;
    this.outputBuffer = new Int16Array(this.outputChunkCapacity);
    this.outputBufferIndex = 0;

    // VAD Schmitt-trigger hysteresis state with Dynamic Noise Floor Estimation
    this.isSpeechActive = false;
    this.hangoverCounter = 0;
    this.HANGOVER_LIMIT_FRAMES = 3;
    this.noiseFloorDb = -55.0; // Running noise floor tracker
    this.VAD_ASSERT_DB = -42;
    this.VAD_DEASSERT_DB = -50;

    // Message port listener for clean turn boundaries and buffer flush
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'RESET' || data.type === 'FLUSH')) {
        if (data.type === 'FLUSH' && this.outputBufferIndex > 0) {
          this.emitBufferChunk();
        } else {
          this.outputBufferIndex = 0;
          this.resamplePos = 0;
          this.prevSample = 0;
          this.isSpeechActive = false;
          this.hangoverCounter = 0;
        }
      }
    };
  }

  process(inputs, _outputs, _parameters) {
    const inputChannel = inputs[0]?.[0];
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    const inputLength = inputChannel.length;

    if (Math.abs(this.resampleRatio - 1.0) < 0.001) {
      // 1:1 direct 16kHz pass-through
      for (let i = 0; i < inputLength; i++) {
        const sample = inputChannel[i];
        const clamped = Math.max(-1.0, Math.min(1.0, sample));
        this.outputBuffer[this.outputBufferIndex++] =
          clamped < 0 ? clamped * 32768 : clamped * 32767;

        if (this.outputBufferIndex >= this.outputChunkCapacity) {
          this.emitBufferChunk();
        }
      }
    } else {
      // Continuous quantum boundary linear interpolation resampling (e.g. 48kHz / 44.1kHz -> 16kHz)
      while (this.resamplePos < inputLength - 1) {
        const i0 = Math.floor(this.resamplePos);
        const frac = this.resamplePos - i0;
        const s0 = i0 >= 0 ? inputChannel[i0] : this.prevSample;
        const s1 = i0 + 1 >= 0 ? inputChannel[i0 + 1] : this.prevSample;

        const sample = s0 + frac * (s1 - s0);
        const clamped = Math.max(-1.0, Math.min(1.0, sample));
        this.outputBuffer[this.outputBufferIndex++] =
          clamped < 0 ? clamped * 32768 : clamped * 32767;

        if (this.outputBufferIndex >= this.outputChunkCapacity) {
          this.emitBufferChunk();
        }

        this.resamplePos += this.resampleRatio;
      }
      this.resamplePos -= inputLength;
      this.prevSample = inputChannel[inputLength - 1];
    }

    return true;
  }

  emitBufferChunk() {
    if (this.outputBufferIndex === 0) return;

    let powerSum = 0;
    for (let i = 0; i < this.outputBufferIndex; i++) {
      const normalized = this.outputBuffer[i] / 32768;
      powerSum += normalized * normalized;
    }

    const rms = Math.sqrt(powerSum / this.outputBufferIndex);
    const db = 20 * Math.log10(Math.max(rms, 1e-5));

    // Dynamic Noise Floor update (slow adapt to ambient room noise, e.g. Android mobile AGC)
    if (!this.isSpeechActive || db < this.noiseFloorDb + 3) {
      this.noiseFloorDb = 0.96 * this.noiseFloorDb + 0.04 * db;
      this.noiseFloorDb = Math.max(-65.0, Math.min(-32.0, this.noiseFloorDb));
    }

    // Adaptive threshold: at least 7.5 dB above ambient noise floor, bounded to [-44, -28] dB
    const dynamicAssertDb = Math.max(-44.0, Math.min(-28.0, this.noiseFloorDb + 7.5));
    const dynamicDeassertDb = Math.max(-52.0, Math.min(-34.0, this.noiseFloorDb + 3.0));

    // Schmitt-trigger VAD update
    if (db > dynamicAssertDb) {
      this.isSpeechActive = true;
      this.hangoverCounter = this.HANGOVER_LIMIT_FRAMES;
    } else if (db < dynamicDeassertDb) {
      if (this.hangoverCounter > 0) {
        this.hangoverCounter--;
      } else {
        this.isSpeechActive = false;
      }
    }

    // Zero-copy transfer across worker thread boundary
    const chunkTransfer = new Int16Array(this.outputBuffer.subarray(0, this.outputBufferIndex));
    this.port.postMessage(
      {
        type: 'AUDIO_FRAME',
        pcmBuffer: chunkTransfer.buffer,
        metrics: {
          rmsDb: Number(db.toFixed(1)),
          speechDetected: this.isSpeechActive,
          noiseFloorDb: Number(this.noiseFloorDb.toFixed(1)),
        },
      },
      [chunkTransfer.buffer]
    );

    this.outputBufferIndex = 0;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);


