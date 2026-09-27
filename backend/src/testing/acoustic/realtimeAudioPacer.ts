/**
 * realtimeAudioPacer.ts
 *
 * SOTA Sub-Millisecond Drift-Compensated Audio Pacer.
 * Emulates physical microphone hardware by streaming 16kHz PCM chunks
 * at strictly 1.0x real-time rate over WebSocket.
 */

import WebSocket from 'ws';
import { generateSilence, SAMPLE_RATE, BYTES_PER_SAMPLE } from './silenceGenerator';

export interface PacerOptions {
  chunkDurationMs?: number; // default 40ms (1280 bytes)
  bargeIn?: boolean;
  bargeInType?: 'acoustic' | 'tactile';
  onChunkSent?: (chunkIndex: number, totalChunks: number, elapsedMs: number) => void;
  onSpeechEnd?: () => void;
  signal?: AbortSignal;
  manualTurnCommit?: boolean;
}

/**
 * High-resolution asynchronous delay using process.hrtime.bigint() with drift compensation.
 */
export async function preciseSleep(ms: number, targetTimeNs: bigint): Promise<bigint> {
  const nowNs = process.hrtime.bigint();
  const remainingNs = targetTimeNs - nowNs;

  if (remainingNs > 2_000_000n) {
    // If more than 2ms remaining, use setTimeout for most of it to yield event loop
    const sleepMs = Number(remainingNs / 1_000_000n) - 1;
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  // Busy-wait the last fraction of a millisecond for sub-millisecond precision
  while (process.hrtime.bigint() < targetTimeNs) {
    // Spin until target time reached
  }

  return process.hrtime.bigint();
}

export class RealtimeAudioPacer {
  /**
   * Streams a raw PCM buffer into the WebSocket in timed chunks.
   */
  public static async streamPcm(
    ws: WebSocket,
    pcmBuffer: Buffer,
    options: PacerOptions = {}
  ): Promise<{ durationMs: number; chunksSent: number }> {
    const chunkMs = options.chunkDurationMs || 40;
    const chunkSize = Math.floor((SAMPLE_RATE * BYTES_PER_SAMPLE * chunkMs) / 1000); // 1280 bytes for 40ms
    const totalChunks = Math.ceil(pcmBuffer.length / chunkSize);

    if (totalChunks === 0 || ws.readyState !== WebSocket.OPEN) {
      return { durationMs: 0, chunksSent: 0 };
    }

    const startNs = process.hrtime.bigint();
    const chunkDurationNs = BigInt(chunkMs) * 1_000_000n;

    for (let i = 0; i < totalChunks; i++) {
      if (options.signal?.aborted || ws.readyState !== WebSocket.OPEN) {
        break;
      }

      const offset = i * chunkSize;
      const end = Math.min(offset + chunkSize, pcmBuffer.length);
      const chunk = pcmBuffer.subarray(offset, end);

      const frame: any = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: chunk.toString('base64')
            }
          ]
        }
      };
      if (options.bargeIn) {
        frame.bargeIn = true;
        frame.bargeInType = options.bargeInType || 'acoustic';
      }

      ws.send(JSON.stringify(frame));

      if (options.onChunkSent) {
        const elapsed = Number((process.hrtime.bigint() - startNs) / 1_000_000n);
        options.onChunkSent(i + 1, totalChunks, elapsed);
      }

      // Schedule next chunk target time
      const targetTimeNs = startNs + BigInt(i + 1) * chunkDurationNs;
      await preciseSleep(chunkMs, targetTimeNs);
    }

    const totalElapsedMs = Number((process.hrtime.bigint() - startNs) / 1_000_000n);
    return { durationMs: totalElapsedMs, chunksSent: totalChunks };
  }

  /**
   * Streams a spoken response buffer followed by a trailing period of silence.
   * Simulates a candidate finishing their thought and pausing for VAD detection.
   */
  public static async streamSpeechWithTrailingSilence(
    ws: WebSocket,
    speechPcm: Buffer,
    trailingSilenceMs: number = 2000,
    options: PacerOptions = {},
    onSpeechEndCallback?: () => void
  ): Promise<{ speechDurationMs: number; silenceDurationMs: number }> {
    const speechResult = await this.streamPcm(ws, speechPcm, options);
    if (onSpeechEndCallback) {
      onSpeechEndCallback();
    } else if (options.onSpeechEnd) {
      options.onSpeechEnd();
    }
    const silenceBuffer = generateSilence(trailingSilenceMs);
    const silenceResult = await this.streamPcm(ws, silenceBuffer, options);

    // SOTA Client-Authoritative Duplex (Invariant 2.6):
    // Client commits the turn upon VAD endpointing (trailing silence conclusion)
    if (ws.readyState === WebSocket.OPEN && !options.manualTurnCommit) {
      ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }

    return {
      speechDurationMs: speechResult.durationMs,
      silenceDurationMs: silenceResult.durationMs
    };
  }

  /**
   * Streams a two-part speech with a mid-sentence hesitation pause (thinking pause).
   * Simulates: part1 -> pause (e.g. 800ms) -> part2 -> trailing silence (e.g. 2000ms).
   */
  public static async streamHesitationSpeech(
    ws: WebSocket,
    part1Pcm: Buffer,
    hesitationPauseMs: number,
    part2Pcm: Buffer,
    trailingSilenceMs: number = 2000,
    options: PacerOptions = {}
  ): Promise<void> {
    await this.streamPcm(ws, part1Pcm, options);
    const pauseBuffer = generateSilence(hesitationPauseMs);
    await this.streamPcm(ws, pauseBuffer, options);
    await this.streamPcm(ws, part2Pcm, options);
    const trailingBuffer = generateSilence(trailingSilenceMs);
    await this.streamPcm(ws, trailingBuffer, options);

    // SOTA Client-Authoritative Duplex (Invariant 2.6):
    // Client commits turn upon speech conclusion
    if (ws.readyState === WebSocket.OPEN && !options.manualTurnCommit) {
      ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }
}
