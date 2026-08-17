/**
 * AudioWorkletProcessor for high-performance audio capture
 * - Operates on native 16kHz AudioContext stream
 * - Signed 16-bit Int16 PCM quantization
 * - Schmitt-trigger VAD & RMS dB computation
 * - Zero-copy 1024-sample buffer transfer (64ms chunks)
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1024 samples @ 16kHz = 64ms chunk (optimal real-time latency matching PyAudio)
    this.outputChunkCapacity = 1024;
    this.outputBuffer = new Int16Array(this.outputChunkCapacity);
    this.outputBufferIndex = 0;

    // VAD Schmitt-trigger hysteresis state
    this.isSpeechActive = false;
    this.hangoverCounter = 0;
    this.HANGOVER_LIMIT_FRAMES = 3;
    this.VAD_ASSERT_DB = -42;
    this.VAD_DEASSERT_DB = -50;
  }

  process(inputs, _outputs, _parameters) {
    const inputChannel = inputs[0]?.[0];
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    const inputLength = inputChannel.length;
    for (let i = 0; i < inputLength; i++) {
      const sample = inputChannel[i];
      // Clamped signed 16-bit PCM quantization
      const clamped = Math.max(-1.0, Math.min(1.0, sample));
      this.outputBuffer[this.outputBufferIndex++] =
        clamped < 0 ? clamped * 32768 : clamped * 32767;

      if (this.outputBufferIndex >= this.outputChunkCapacity) {
        this.emitBufferChunk();
      }
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

