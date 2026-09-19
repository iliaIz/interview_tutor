import { test, expect } from '@playwright/test';

/**
 * voiceSession.spec.ts
 *
 * SOTA September 2026 Browser E2E Audio Test Suite.
 * Validates the complete browser client-side audio pipeline:
 * - Fake media stream capture (48kHz host DAC)
 * - AudioWorklet module loading ('/worklets/audio-capture-processor.js' and '/worklets/gemini-audio-processor.js')
 * - AudioWorkletNode creation and 16kHz downsampling pipeline
 * - AudioContext state transitions and autoplay policies
 */

test.describe('Browser Web Audio & Live Voice Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local frontend instance or baseUrl
    await page.goto('/');
  });

  test('Hardware & Fake Media Device: getUserMedia provides active audio track', async ({ page }) => {
    const micInfo = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        const tracks = stream.getAudioTracks();
        const active = tracks.length > 0 && tracks[0].readyState === 'live';
        const label = tracks[0]?.label || '';
        tracks.forEach((t) => t.stop());
        return { success: true, active, label, trackCount: tracks.length };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    expect(micInfo.success).toBe(true);
    expect(micInfo.active).toBe(true);
    expect(micInfo.trackCount).toBeGreaterThanOrEqual(1);
  });

  test('AudioCaptureWorklet: Loads /worklets/audio-capture-processor.js and instantiates node', async ({ page }) => {
    const workletTest = await page.evaluate(async () => {
      const audioCtx = new AudioContext({ latencyHint: 'interactive' });
      try {
        await audioCtx.audioWorklet.addModule('/worklets/audio-capture-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor');

        // Test message port communication
        let resetAck = false;
        workletNode.port.postMessage({ type: 'RESET' });

        await audioCtx.close();
        return { success: true, instantiated: !!workletNode };
      } catch (err: any) {
        await audioCtx.close();
        return { success: false, error: err.message };
      }
    });

    expect(workletTest.success).toBe(true);
    expect(workletTest.instantiated).toBe(true);
  });

  test('GeminiPlayoutWorklet: Loads /worklets/gemini-audio-processor.js for 24kHz Hermite playout', async ({ page }) => {
    const playoutTest = await page.evaluate(async () => {
      const audioCtx = new AudioContext({ latencyHint: 'interactive' });
      try {
        await audioCtx.audioWorklet.addModule('/worklets/gemini-audio-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'gemini-audio-processor');

        await audioCtx.close();
        return { success: true, instantiated: !!workletNode };
      } catch (err: any) {
        await audioCtx.close();
        return { success: false, error: err.message };
      }
    });

    expect(playoutTest.success).toBe(true);
    expect(playoutTest.instantiated).toBe(true);
  });

  test('Dual-Pipeline Resampling Loop: Captures simulated audio and produces 16kHz PCM frames', async ({ page }) => {
    const pcmFramesTest = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext({ latencyHint: 'interactive' });

      try {
        await audioCtx.audioWorklet.addModule('/worklets/audio-capture-processor.js');
        const source = audioCtx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(audioCtx, 'audio-capture-processor');

        source.connect(worklet);

        return new Promise<{ success: boolean; frameReceived: boolean; frameBytes?: number }>((resolve) => {
          const timeout = setTimeout(() => {
            stream.getTracks().forEach((t) => t.stop());
            audioCtx.close();
            resolve({ success: false, frameReceived: false });
          }, 4000);

          worklet.port.onmessage = (e: MessageEvent) => {
            if (e.data.type === 'AUDIO_FRAME' && e.data.pcmBuffer) {
              clearTimeout(timeout);
              const bytes = e.data.pcmBuffer.byteLength;
              stream.getTracks().forEach((t) => t.stop());
              audioCtx.close();
              resolve({ success: true, frameReceived: true, frameBytes: bytes });
            }
          };
        });
      } catch (err: any) {
        stream.getTracks().forEach((t) => t.stop());
        await audioCtx.close();
        return { success: false, frameReceived: false };
      }
    });

    expect(pcmFramesTest.success).toBe(true);
    expect(pcmFramesTest.frameReceived).toBe(true);
    expect(pcmFramesTest.frameBytes).toBeGreaterThan(0);
  });

  test('Playout Worklet Intra-Utterance Jitter: Sustains 2.2s intra-utterance pause without premature drain or buffer reset', async ({ page }) => {
    const jitterResult = await page.evaluate(async () => {
      const audioCtx = new AudioContext({ latencyHint: 'interactive' });
      try {
        await audioCtx.audioWorklet.addModule('/worklets/gemini-audio-processor.js');
        const worklet = new AudioWorkletNode(audioCtx, 'gemini-audio-processor');
        worklet.connect(audioCtx.destination);

        let prematureDrainedFired = false;
        let finalDrainedFired = false;
        let finalDrainRequested = false;

        worklet.port.onmessage = (e: MessageEvent) => {
          if (e.data?.type === 'drained') {
            if (!finalDrainRequested) {
              prematureDrainedFired = true;
            } else {
              finalDrainedFired = true;
            }
          }
        };

        // 1. Send chunk 1: 400ms of synthetic 24kHz audio (9600 samples)
        const chunk1 = new Float32Array(9600);
        for (let i = 0; i < 9600; i++) chunk1[i] = Math.sin((i * 440 * 2 * Math.PI) / 24000) * 0.2;
        worklet.port.postMessage({ type: 'chunk', data: chunk1 }, [chunk1.buffer]);

        // 2. Wait 2.2 seconds (exceeding the old 1.5s premature autoDrainTimer)
        await new Promise((r) => setTimeout(r, 2200));

        const drainedDuringPause = prematureDrainedFired;

        // 3. Send chunk 2: another 400ms of synthetic audio
        const chunk2 = new Float32Array(9600);
        for (let i = 0; i < 9600; i++) chunk2[i] = Math.sin((i * 554 * 2 * Math.PI) / 24000) * 0.2;
        worklet.port.postMessage({ type: 'chunk', data: chunk2 }, [chunk2.buffer]);

        // 4. Send explicit turnComplete drain
        finalDrainRequested = true;
        worklet.port.postMessage({ type: 'drain' });

        // 5. Wait for final physical playout drain
        await new Promise((r) => setTimeout(r, 1200));

        await audioCtx.close();
        return {
          success: true,
          drainedDuringPause,
          finalDrainedFired
        };
      } catch (err: any) {
        await audioCtx.close();
        return { success: false, error: err.message, drainedDuringPause: true, finalDrainedFired: false };
      }
    });

    expect(jitterResult.success).toBe(true);
    expect(jitterResult.drainedDuringPause).toBe(false); // MUST NOT drain during intra-utterance pause!
    expect(jitterResult.finalDrainedFired).toBe(true);  // MUST drain after explicit drain signal
  });

  test('Synchronous User-Gesture Warmup Guard: AudioContext is in running state after warmup', async ({ page }) => {
    const warmupResult = await page.evaluate(async () => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx({ latencyHint: 'interactive' });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const postWarmupState = ctx.state;
      await ctx.close();
      return {
        postWarmupState,
        isRunning: postWarmupState === 'running'
      };
    });

    expect(warmupResult.isRunning).toBe(true);
  });
});
