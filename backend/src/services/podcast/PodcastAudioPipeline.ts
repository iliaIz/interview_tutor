/**
 * PodcastAudioPipeline.ts
 * Pure audio DSP and speech synthesis pipeline for podcast recaps (SPEC-27).
 * Encapsulates binary RIFF WAV calculation, crossfade silence padding,
 * ffmpeg Opus transcoding, and LiteLLM TTS synthesis.
 * Cognitive Bounding SLA: <= 300 lines (Rule 8 compliant).
 */

import { spawn } from 'child_process';
import { Readable } from 'stream';
import { envConfig } from '../../config/env';

export interface WavInfo {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

export interface StitchSegment {
  speaker: string;
  wavBuffer: Buffer;
  pauseAfterMs: number;
}

export class WavStitcherService {
  public static parseWav(buffer: Buffer): WavInfo {
    if (buffer.length < 12) {
      throw new Error('WAV parse error: Buffer size is below 12 bytes');
    }

    const riffHeader = buffer.toString('ascii', 0, 4);
    const waveFormat = buffer.toString('ascii', 8, 12);

    if (riffHeader !== 'RIFF' || waveFormat !== 'WAVE') {
      throw new Error('WAV parse error: Missing RIFF/WAVE header signatures');
    }

    let offset = 12;
    const wavInfo: Partial<WavInfo> = {};

    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataOffset = offset + 8;

      if (chunkId === 'fmt ') {
        wavInfo.audioFormat = buffer.readUInt16LE(chunkDataOffset);
        wavInfo.numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
        wavInfo.sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
        wavInfo.byteRate = buffer.readUInt32LE(chunkDataOffset + 8);
        wavInfo.blockAlign = buffer.readUInt16LE(chunkDataOffset + 12);
        wavInfo.bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
      } else if (chunkId === 'data') {
        wavInfo.dataOffset = chunkDataOffset;
        wavInfo.dataLength = chunkSize;
        break;
      }

      const paddedSize = chunkSize + (chunkSize % 2);
      offset += 8 + paddedSize;
    }

    if (!wavInfo.dataOffset || !wavInfo.sampleRate || !wavInfo.numChannels || !wavInfo.bitsPerSample) {
      throw new Error('WAV parse error: Mandatory chunks (fmt or data) not found');
    }

    return wavInfo as WavInfo;
  }

  public static stitch(segments: StitchSegment[]): Buffer {
    if (segments.length === 0) {
      throw new Error('Stitch error: Segments array is empty');
    }

    const firstMeta = this.parseWav(segments[0].wavBuffer);
    const pcmChunks: Buffer[] = [];
    let totalPcmBytes = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const meta = this.parseWav(segment.wavBuffer);

      if (
        meta.sampleRate !== firstMeta.sampleRate ||
        meta.numChannels !== firstMeta.numChannels ||
        meta.bitsPerSample !== firstMeta.bitsPerSample
      ) {
        console.warn(`Format mismatch in segment ${i}, attempting direct concat`);
      }

      const rawData = segment.wavBuffer.subarray(
        meta.dataOffset,
        meta.dataOffset + meta.dataLength
      );
      pcmChunks.push(rawData);
      totalPcmBytes += rawData.length;

      // Add Silence Padding between replicas
      if (segment.pauseAfterMs > 0 && i < segments.length - 1) {
        const bytesPerMs = (firstMeta.sampleRate * firstMeta.numChannels * (firstMeta.bitsPerSample / 8)) / 1000;
        const rawSilenceBytes = Math.floor(segment.pauseAfterMs * bytesPerMs);
        const alignedSilenceBytes = rawSilenceBytes - (rawSilenceBytes % (firstMeta.blockAlign || 2));

        if (alignedSilenceBytes > 0) {
          pcmChunks.push(Buffer.alloc(alignedSilenceBytes, 0));
          totalPcmBytes += alignedSilenceBytes;
        }
      }
    }

    // Canonical 44-byte RIFF header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + totalPcmBytes, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(firstMeta.audioFormat || 1, 20);
    header.writeUInt16LE(firstMeta.numChannels || 1, 22);
    header.writeUInt32LE(firstMeta.sampleRate || 24000, 24);
    header.writeUInt32LE(firstMeta.byteRate || (24000 * 2), 28);
    header.writeUInt16LE(firstMeta.blockAlign || 2, 32);
    header.writeUInt16LE(firstMeta.bitsPerSample || 16, 34);
    header.write('data', 36);
    header.writeUInt32LE(totalPcmBytes, 40);

    return Buffer.concat([header, ...pcmChunks], 44 + totalPcmBytes);
  }
}

export class OpusEncoderService {
  public static async encodeWavToOpus(wavBuffer: Buffer, outputFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-loglevel', 'error',
        '-f', 'wav',
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-vbr', 'on',
        '-compression_level', '10',
        '-application', 'voip',
        '-frame_duration', '20',
        '-ar', '48000',
        '-y',
        outputFilePath
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let stderrOutput = '';
      ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString('utf8');
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrOutput}`));
        }
      });

      ffmpegProcess.on('error', (err) => {
        reject(err);
      });

      const inputStream = new Readable({
        read() {
          this.push(wavBuffer);
          this.push(null);
        },
      });

      inputStream.pipe(ffmpegProcess.stdin);
    });
  }
}

export async function synthesizeTTSBuffer(text: string, voice: string = 'Kore'): Promise<Buffer> {
  const validVoice = (['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'].includes(voice)) ? voice : 'Kore';

  const speechUrl = envConfig.proxy.speechUrl;
  const proxyApiKey = envConfig.proxy.apiKey;
  const ttsModel = envConfig.models.tts;

  const res = await fetch(speechUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${proxyApiKey}`,
    },
    body: JSON.stringify({
      model: ttsModel,
      input: text,
      voice: validVoice,
      response_format: 'wav'
    })
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Ошибка синтеза речи через LiteLLM Gateway (${res.status}): ${errTxt}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function synthesizeTTSWithRetry(
  text: string, 
  voice: string = 'Kore', 
  maxRetries = 4,
  onRetry?: (attempt: number, delayMs: number, reason: string) => void
): Promise<{ buffer: Buffer; retries: number }> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const buffer = await synthesizeTTSBuffer(text, voice);
      return { buffer, retries: attempt };
    } catch (err: any) {
      attempt++;
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota');
      const isGateway502 = err?.message?.includes('502') || err?.message?.includes('503') || err?.message?.includes('ECONNREFUSED');

      if ((isRateLimit || isGateway502) && attempt < maxRetries) {
        const delayMs = Math.min(attempt * 4000, 20000);
        const reason = isRateLimit ? 'Превышен лимит запросов к Gemini TTS (429)' : 'Временный сбой шлюза LiteLLM (502/503)';
        console.warn(`[TTS Retry ${attempt}/${maxRetries}] ${reason}. Ожидание ${delayMs / 1000}s перед повтором...`);
        if (onRetry) {
          onRetry(attempt, delayMs, reason);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Превышено количество попыток синтеза речи (${maxRetries})`);
}
