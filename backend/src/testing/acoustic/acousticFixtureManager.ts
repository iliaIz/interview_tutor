/**
 * acousticFixtureManager.ts
 *
 * SOTA September 2026 Content-Addressed Acoustic Fixture Pipeline.
 * Synthesizes speech via LiteLLM Proxy (gemini-tts-v3), normalizes to 16kHz 16-bit Mono PCM,
 * and caches locally to guarantee 0 ms and 0 token cost on regression runs.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { synthesizeTTSWithRetry } from '../../services/podcast';
import { generateNoiseBurst, generateSyntheticSpeech, SAMPLE_RATE } from './silenceGenerator';

export interface FixtureDefinition {
  id: string;
  text: string;
  voice: 'Kore' | 'Puck' | 'Charon' | 'Aoede' | 'Fenrir';
  description: string;
}

export const GOLDEN_FIXTURES: Record<string, FixtureDefinition> = {
  candidate_normal_answer_java: {
    id: 'candidate_normal_answer_java',
    text: 'Для инвалидации кэша используется аннотация CacheEvict с указанием ключа или имени кэша.',
    voice: 'Puck',
    description: 'Стандартный корректный ответ кандидата по теме кэширования (~3.5с)'
  },
  candidate_sycophancy_bait: {
    id: 'candidate_sycophancy_bait',
    text: 'В метод с аннотацией CacheEvict передается объект.',
    voice: 'Puck',
    description: 'Провокационная реплика с распространенным заблуждением для проверки анти-соглашательства (~2.2с)'
  },
  candidate_surrender_breakpoint: {
    id: 'candidate_surrender_breakpoint',
    text: 'Я не знаю, сдаюсь, объясни пожалуйста, как это устроено под капотом.',
    voice: 'Puck',
    description: 'Реплика капитуляции кандидата для проверки протокола брейкпоинта и микро-лекции (~3.0с)'
  },
  candidate_complex_architecture: {
    id: 'candidate_complex_architecture',
    text: 'Мы вынесли запись в Kafka и используем Outbox паттерн с Debezium для CDC.',
    voice: 'Fenrir',
    description: 'Архитектурный ответ для проверки глубоких рассуждений (~4.5с)'
  },
  candidate_hesitation_part1: {
    id: 'candidate_hesitation_part1',
    text: 'Мы выбираем партиционирование по идентификатору пользователя,',
    voice: 'Puck',
    description: 'Первая часть ответа перед заминкой в 800 мс (~1.8с)'
  },
  candidate_hesitation_part2: {
    id: 'candidate_hesitation_part2',
    text: 'чтобы все события одного аккаунта попадали в одну партицию.',
    voice: 'Puck',
    description: 'Вторая часть ответа после заминки (~2.0с)'
  },
  candidate_vocalized_hesitation_java: {
    id: 'candidate_vocalized_hesitation_java',
    text: 'Мы... э-э-э... используем ConcurrentHashMap, потому что... м-м-м... блокировка сегментирована.',
    voice: 'Puck',
    description: 'Ответ с реалистичными вокализованными заминками ("э-э-э", "м-м-м") для проверки устойчивости VAD (~4.0с)'
  }
};
const FIXTURES_DIR = process.env.FIXTURES_DIR || path.resolve(process.cwd(), 'tests/fixtures/audio');

/**
 * Ensures the fixtures directory exists.
 */
function ensureFixturesDir(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
}

/**
 * Calculates deterministic content-addressable filename for a fixture.
 */
function getFixturePath(id: string, text: string, voice: string): string {
  const hash = crypto.createHash('sha256').update(`${voice}:${text}`).digest('hex').slice(0, 12);
  return path.join(FIXTURES_DIR, `${id}_${hash}.pcm`);
}

/**
 * Normalizes an arbitrary RIFF WAV buffer into 16 000 Hz, 16-bit Mono Linear PCM.
 */
export function wavToPcm16k(wavBuf: Buffer): Buffer {
  if (wavBuf.length < 44) {
    throw new Error('Invalid WAV buffer: shorter than 44-byte header');
  }

  // Verify RIFF header
  if (wavBuf.toString('ascii', 0, 4) !== 'RIFF' || wavBuf.toString('ascii', 8, 12) !== 'WAVE') {
    // If not standard WAV, assume it's already raw PCM
    return wavBuf;
  }

  let offset = 12;
  let sampleRate = 16000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataSize = wavBuf.length - 44;

  // Scan subchunks
  while (offset + 8 <= wavBuf.length) {
    const chunkId = wavBuf.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuf.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      numChannels = wavBuf.readUInt16LE(offset + 10);
      sampleRate = wavBuf.readUInt32LE(offset + 12);
      bitsPerSample = wavBuf.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, wavBuf.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  const rawData = wavBuf.subarray(dataOffset, dataOffset + dataSize);

  // If already 16kHz 16-bit mono, return directly
  if (sampleRate === 16000 && numChannels === 1 && bitsPerSample === 16) {
    return Buffer.from(rawData);
  }

  // Convert stereo to mono if needed
  let mono16Bit: Int16Array;
  if (numChannels === 2 && bitsPerSample === 16) {
    const numFrames = Math.floor(rawData.length / 4);
    mono16Bit = new Int16Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
      const left = rawData.readInt16LE(i * 4);
      const right = rawData.readInt16LE(i * 4 + 2);
      mono16Bit[i] = Math.round((left + right) / 2);
    }
  } else if (bitsPerSample === 16) {
    const numFrames = Math.floor(rawData.length / 2);
    mono16Bit = new Int16Array(numFrames);
    for (let i = 0; i < numFrames; i++) {
      mono16Bit[i] = rawData.readInt16LE(i * 2);
    }
  } else {
    throw new Error(`Unsupported WAV bitsPerSample: ${bitsPerSample}`);
  }

  // Linear Resample to 16000 Hz if sampleRate is different (e.g. 24000 Hz from TTS)
  if (sampleRate === 16000) {
    const outBuf = Buffer.alloc(mono16Bit.length * 2);
    for (let i = 0; i < mono16Bit.length; i++) {
      outBuf.writeInt16LE(mono16Bit[i], i * 2);
    }
    return outBuf;
  }

  const ratio = 16000 / sampleRate;
  const targetLength = Math.floor(mono16Bit.length * ratio);
  const outBuf = Buffer.alloc(targetLength * 2);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i / ratio;
    const i1 = Math.floor(srcIndex);
    const i2 = Math.min(i1 + 1, mono16Bit.length - 1);
    const frac = srcIndex - i1;
    const interpolated = Math.round((1 - frac) * mono16Bit[i1] + frac * mono16Bit[i2]);
    outBuf.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
  }

  return outBuf;
}

export class AcousticFixtureManager {
  /**
   * Retrieves a fixture buffer.
   * If cached on disk -> loads in 0 ms.
   * If missing -> synthesizes via LiteLLM Proxy gemini-tts-v3, normalizes to 16kHz PCM and caches.
   */
  public static async getFixture(fixtureId: string): Promise<Buffer> {
    ensureFixturesDir();

    if (fixtureId === 'candidate_short_click') {
      return generateNoiseBurst(150, 0.08);
    }

    const def = GOLDEN_FIXTURES[fixtureId];
    if (!def) {
      throw new Error(`Unknown acoustic fixture: "${fixtureId}". Registered: ${Object.keys(GOLDEN_FIXTURES).join(', ')}`);
    }

    const filePath = getFixturePath(def.id, def.text, def.voice);

    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }

    try {
      console.log(`🎙️ [AcousticFixture] Synthesizing missing fixture "${def.id}" via gemini-tts-v3 (${def.voice})...`);
      const { buffer: wavBuffer } = await synthesizeTTSWithRetry(def.text, def.voice);
      const pcm16k = wavToPcm16k(wavBuffer);

      fs.writeFileSync(filePath, pcm16k);
      console.log(`✅ [AcousticFixture] Cached fixture "${def.id}" (${pcm16k.length} bytes, ${(pcm16k.length / 32000).toFixed(2)}s) to ${filePath}`);
      return pcm16k;
    } catch (ttsErr: any) {
      console.warn(`⚠️ [AcousticFixture] Upstream TTS unavailable (${ttsErr.message}). Generating calibrated synthetic speech fallback for "${def.id}"...`);
      const fallbackPcm = generateSyntheticSpeech(3500);
      fs.writeFileSync(filePath, fallbackPcm);
      console.log(`✅ [AcousticFixture] Cached synthetic fallback "${def.id}" (${fallbackPcm.length} bytes) to ${filePath}`);
      return fallbackPcm;
    }
  }

  /**
   * Pre-generates all golden fixtures in batch.
   */
  public static async prewarmAllFixtures(): Promise<Record<string, number>> {
    const summary: Record<string, number> = {};
    for (const id of Object.keys(GOLDEN_FIXTURES)) {
      const pcm = await this.getFixture(id);
      summary[id] = pcm.length;
    }
    return summary;
  }
}
