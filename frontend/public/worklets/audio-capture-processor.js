/**
 * AudioWorkletProcessor for high-performance audio capture
 * - Hardware native sample rate -> 16kHz linear downsampling
 * - Signed 16-bit PCM quantization
 * - Schmitt-trigger VAD & RMS dB computation
 * - Zero-copy buffer transfer
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    // sampleRate is provided globally in the AudioWorklet scope by the browser
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.phase = 0;
    this.previousSample = 0;

    // 100ms chunks at 16kHz (1600 samples)
    this.outputChunkCapacity = 1600;
    this.outputBuffer = new Int16Array(this.outputChunkCapacity);
    this.outputBufferIndex = 0;

    // VAD Schmitt-trigger hysteresis state
    this.isSpeechActive = false;
    this.hangoverCounter = 0;
    this.HANGOVER_LIMIT_FRAMES = 2; // ~200ms
    this.VAD_ASSERT_DB = -42;
    this.VAD_DEASSERT_DB = -50;
  }

  process(inputs, _outputs, _parameters) {
    const inputChannel = inputs[0]?.[0];
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    const inputLength = inputChannel.length;
    let inputCursor = 0;

    while (inputCursor < inputLength) {
      if (this.phase < 1.0) {
        const s0 = this.previousSample;
        const s1 = inputChannel[inputCursor];
        const interpolated = s0 + this.phase * (s1 - s0);

        // Clamped signed 16-bit PCM quantization
        const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
        this.outputBuffer[this.outputBufferIndex++] =
          clamped < 0 ? clamped * 32768 : clamped * 32767;

        if (this.outputBufferIndex >= this.outputChunkCapacity) {
          this.emitBufferChunk();
        }

        this.phase += this.resampleRatio;
      } else {
        const index0 = Math.floor(this.phase) - 1;
        const index1 = index0 + 1;
        this.phase -= Math.floor(this.phase);

        const s0 = index0 < 0 ? this.previousSample : inputChannel[index0];
        const s1 = index1 < inputLength ? inputChannel[index1] : inputChannel[inputLength - 1];
        const interpolated = s0 + this.phase * (s1 - s0);

        const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
        this.outputBuffer[this.outputBufferIndex++] =
          clamped < 0 ? clamped * 32768 : clamped * 32767;

        if (this.outputBufferIndex >= this.outputChunkCapacity) {
          this.emitBufferChunk();
        }

        this.phase += this.resampleRatio;
      }

      inputCursor = Math.min(
        inputLength,
        inputCursor + Math.max(1, Math.floor(this.phase))
      );
    }

    this.previousSample = inputChannel[inputLength - 1];
    return true;
  }

  emitBufferChunk() {
    let powerSum = 0;
    for (let i = 0; i < this.outputBufferIndex; i++) {
      const normalized = this.outputBuffer[i] / 32768;
      powerSum += normalized * normalized;
    }

    const rms = Math.sqrt(powerSum / this.outputBufferIndex);
    const db = 20 * Math.log10(Math.max(rms, 1e-5));

    // Schmitt-trigger VAD update
    if (db > this.VAD_ASSERT_DB) {
      this.isSpeechActive = true;
      this.hangoverCounter = this.HANGOVER_LIMIT_FRAMES;
    } else if (db < this.VAD_DEASSERT_DB) {
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
        },
      },
      [chunkTransfer.buffer]
    );

    this.outputBufferIndex = 0;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
