import { db } from './db';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { callLiteLlmChat, parseJsonFromLlm } from './llmClient';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { Readable, PassThrough } from 'stream';

export interface GeneratePodcastOptions {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  tone?: string;
  length?: string;
  language?: string;
  systemPrompt?: string;
  userPrompt?: string;
  mode?: 'solo' | 'duo';
  voice1?: string;
  voice2?: string;
}

export interface QuestionRow {
  id: string;
  global_id: number;
  num: number;
  topic: string;
  question: string;
  answer: string;
}

export interface DialogueItem {
  speaker: 'Host' | 'Guest';
  text: string;
}

export interface StepTelemetry {
  index: number;
  speaker: string;
  voice: string;
  text: string;
  durationMs: number;
  status: 'completed' | 'failed';
  retries?: number;
}

export interface JobTelemetry {
  startTime: number;
  endTime?: number;
  totalDurationSec?: number;
  scriptDurationSec?: number;
  ttsDurationSec?: number;
  audioDurationEstimateSec?: number;
  totalBytes?: number;
  modelsUsed: {
    scriptModel: string;
    ttsModel: string;
  };
  voices: {
    voice1: string;
    voice2?: string;
    mode: 'solo' | 'duo';
  };
  steps: StepTelemetry[];
}

export interface PodcastJobProgress {
  percentage: number;
  stage: 'script' | 'synthesis' | 'merging' | 'completed' | 'failed';
  stageLabel: string;
  currentStep: number;
  totalSteps: number;
  currentSpeaker?: string;
  currentTextSnippet?: string;
  telemetry?: JobTelemetry;
}

export interface PodcastJobState {
  job_id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  audio_url?: string;
  transcript?: string;
  progress?: PodcastJobProgress;
  metadata?: any;
  error?: string;
  audioPath?: string;
}

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
  wavBuffer: Buffer;
  pauseAfterMs: number;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Global SSE Event Emitter
export class JobEventEmitter extends EventEmitter {}
export const globalJobEmitter = new JobEventEmitter();

// Concurrency Limiter (Max 2 concurrent jobs)
let activeRunningJobs = 0;
const MAX_CONCURRENT_JOBS = 2;
const pendingJobQueue: Array<() => void> = [];

function acquireJobSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeRunningJobs < MAX_CONCURRENT_JOBS) {
      activeRunningJobs++;
      resolve();
    } else {
      pendingJobQueue.push(() => {
        activeRunningJobs++;
        resolve();
      });
    }
  });
}

function releaseJobSlot(): void {
  activeRunningJobs = Math.max(0, activeRunningJobs - 1);
  if (pendingJobQueue.length > 0) {
    const next = pendingJobQueue.shift();
    if (next) next();
  }
}

// Storage auto-cleanup (delete files older than 7 days)
export function cleanupOldStorageFiles(): void {
  try {
    const now = Date.now();
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const files = fs.readdirSync(STORAGE_DIR);
    for (const file of files) {
      const filePath = path.join(STORAGE_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up old podcast file: ${file}`);
      }
    }
  } catch (err) {
    console.error('Storage cleanup error:', err);
  }
}

export const DEFAULT_STRICT_SYSTEM_PROMPT = `Ты — ведущий технический архитектор и автор обучающих IT-подкастов по подготовке к техническим собеседованиям.
Перед тобой структурированный список вопросов с ЭТАЛОННЫМИ профессиональными ответами (Answer) из нашей базы знаний.

КРИТИЧЕСКИЕ ПРАВИЛА СОЗДАНИЯ СЦЕНАРИЯ:
1. ОБЯЗАТЕЛЬНАЯ ПОЛНОТА: Ты ОБЯЗАН последовательно и глубоко разобрать КАЖДЫЙ вопрос из списка (от первого до последнего) без единого пропуска и без поверхностных объединений.
2. СООТВЕТСТВИЕ ЭТАЛОНУ: В репликах эксперта ОБЯЗАТЕЛЬНО должны прозвучать все ключевые концепции, названия классов, аннотаций, интерфейсов, фаз жизненного цикла, исключений и архитектурных нюансов, содержащихся в блоке "Answer".
3. СТРУКТУРА ДИАЛОГА: На каждый вопрос выдели от 2 до 4 связанных реплик:
   - Ведущий (Host) четко формулирует вопрос, озвучивает практический контекст или задает каверзные вопросы интервьюера.
   - Эксперт (Guest) дает исчерпывающий, структурированный и глубокий ответ, опираясь на эталонные факты и приводя жизненные аналогии из коммерческой разработки.
4. ЖИВАЯ И ПОНЯТНАЯ ПОДАЧА: Веди диалог на безупречном русском языке с естественными интонациями, но никогда не жертвуй технической точностью ради сокращения объема.`;

export const DEFAULT_STRICT_USER_PROMPT = `Создай глубокий, увлекательный и на 100% соответствующий эталонным ответам аудиоразбор. Раскрой все технические термины и архитектурные концепции, чтобы слушатель идеально сдал эту тему на собеседовании.`;

function saveJob(job: PodcastJobState) {
  const mergedMetadata = {
    ...(job.metadata || {}),
    progress: job.progress
  };

  const stmt = db.prepare(`
    INSERT INTO podcast_jobs (job_id, status, created_at, audio_url, transcript, metadata, error, audio_path)
    VALUES (@job_id, @status, @created_at, @audio_url, @transcript, @metadata, @error, @audio_path)
    ON CONFLICT(job_id) DO UPDATE SET
      status = excluded.status,
      audio_url = excluded.audio_url,
      transcript = excluded.transcript,
      metadata = excluded.metadata,
      error = excluded.error,
      audio_path = excluded.audio_path
  `);

  stmt.run({
    job_id: job.job_id,
    status: job.status,
    created_at: job.created_at,
    audio_url: job.audio_url || null,
    transcript: job.transcript || null,
    metadata: JSON.stringify(mergedMetadata),
    error: job.error || null,
    audio_path: job.audioPath || null,
  });

  // Emit SSE event
  globalJobEmitter.emit('progress', {
    jobId: job.job_id,
    stage: job.progress?.stage || 'processing',
    progress: job.progress?.percentage || 0,
    data: {
      stageLabel: job.progress?.stageLabel,
      currentStep: job.progress?.currentStep,
      totalSteps: job.progress?.totalSteps,
      currentSpeaker: job.progress?.currentSpeaker,
      currentTextSnippet: job.progress?.currentTextSnippet,
      telemetry: job.progress?.telemetry,
      audio_url: job.audio_url
    },
    error: job.error
  });
}

export function getJob(jobId: string): PodcastJobState | undefined {
  const stmt = db.prepare('SELECT * FROM podcast_jobs WHERE job_id = ?');
  const row = stmt.get(jobId) as any;
  if (!row) return undefined;
  
  let parsedMetadata: any = {};
  try {
    if (row.metadata) parsedMetadata = JSON.parse(row.metadata);
  } catch {}

  return {
    job_id: row.job_id,
    status: row.status,
    created_at: row.created_at,
    audio_url: row.audio_url || undefined,
    transcript: row.transcript || undefined,
    progress: parsedMetadata.progress,
    metadata: parsedMetadata,
    error: row.error || undefined,
    audioPath: row.audio_path || undefined,
  };
}

export function buildPodcastText(questionIds?: string[], topicName?: string): { text: string; topic: string; questionsCount: number } {
  let questions: QuestionRow[] = [];

  if (questionIds && questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders}) ORDER BY num ASC`);
    questions = stmt.all(...questionIds) as QuestionRow[];
  } else if (topicName) {
    const stmt = db.prepare(`SELECT * FROM questions WHERE topic = ? ORDER BY num ASC LIMIT 10`);
    questions = stmt.all(topicName) as QuestionRow[];
  }

  if (questions.length === 0) {
    throw new Error('No questions found for podcast generation.');
  }

  const topic = topicName || questions[0].topic || 'Java & Spring Interview Prep';

  let text = `Тема пересказа: ${topic}\n`;
  text += `Всего вопросов: ${questions.length}\n\n`;
  text += `Ниже представлены вопросы для собеседования и ЭТАЛОННЫЕ ответы из базы знаний, которые ОБЯЗАТЕЛЬНО должны быть последовательно и полностью раскрыты в диалоге:\n\n`;

  questions.forEach((q, idx) => {
    text += `────────────────────────────────────────────────────────────────\n`;
    text += `ВОПРОС #${idx + 1} (${q.topic}): ${q.question}\n`;
    text += `ЭТАЛОННЫЙ ОТВЕТ (ANSWER):\n${q.answer}\n\n`;
  });

  return { text, topic, questionsCount: questions.length };
}

/**
 * Generate dialogue script using Gemini / LiteLLM Proxy
 */
async function generateDialogueScript(
  text: string,
  options: GeneratePodcastOptions,
  questionsCount: number
): Promise<{ name_of_guest: string; dialogue: DialogueItem[] }> {
  const isDuo = options.mode !== 'solo';
  const systemPrompt = options.systemPrompt || DEFAULT_STRICT_SYSTEM_PROMPT;
  const userPrompt = options.userPrompt || DEFAULT_STRICT_USER_PROMPT;

  const scriptPrompt = `${systemPrompt}

${userPrompt}

ИНСТРУКЦИИ К ФОРМАТУ ВЫВОДА:
Верни ответ СТРОГО в JSON формате без символов markdown:
{
  "name_of_guest": "${isDuo ? 'Эксперт' : 'Ведущий'}",
  "dialogue": [
    ${isDuo 
      ? '{"speaker": "Host", "text": "Вопрос/вводная ведущего..."}, {"speaker": "Guest", "text": "Развернутый ответ эксперта с опорой на эталон..."}' 
      : '{"speaker": "Host", "text": "Структурированный разбор вопроса..."}'}
  ]
}

ВАЖНО: В диалоге должно быть последовательно раскрыто ВСЕ ${questionsCount} вопросов с опорой на эталонный блок Answer!

Исходный материал для разбора:
${text}`;

  const chatResult = await callLiteLlmChat({
    model: envConfig.models.text,
    messages: [{ role: 'user', content: scriptPrompt }],
    response_format: { type: 'json_object' },
    temperature: REASONING_PRESETS.podcastDramaturgy.temperature,
    max_tokens: REASONING_PRESETS.podcastDramaturgy.maxTokens,
    extra_body: buildReasoningExtraBody(REASONING_PRESETS.podcastDramaturgy)
  }, {
    timeoutMs: 60_000,
    maxRetries: 2
  });

  const parsed = parseJsonFromLlm(chatResult.content);

  if (!parsed.dialogue || !Array.isArray(parsed.dialogue) || parsed.dialogue.length === 0) {
    throw new Error('ИИ вернул пустой или некорректный список реплик в сценарии.');
  }

  return parsed;
}

/**
 * Dynamic RIFF/WAV Header Parser with Word-Alignment
 */
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

      // Word alignment (chunks padded to 2-byte boundary)
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

/**
 * FFmpeg Opus Transcoding Service (VoIP profile, 48kbps, Ogg Opus)
 */
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

/**
 * Synthesize TTS audio for single text line via LiteLLM Gateway
 */
export async function synthesizeTTSBuffer(text: string, voice: string): Promise<Buffer> {
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

/**
 * Synthesize TTS audio with smart exponential backoff retry on 429/502/503 limits
 */
export async function synthesizeTTSWithRetry(
  text: string, 
  voice: string, 
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

/**
 * Start asynchronous podcast generation job in Node.js backend.
 */
export async function startPodcastJob(options: GeneratePodcastOptions): Promise<PodcastJobState> {
  const jobId = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  const scriptModel = envConfig.models.text;
  const ttsModel = envConfig.models.tts;

  const jobState: PodcastJobState = {
    job_id: jobId,
    status: 'QUEUED',
    created_at: now,
    progress: {
      percentage: 0,
      stage: 'script',
      stageLabel: 'Инициализация и постановка в очередь генерации...',
      currentStep: 0,
      totalSteps: 1,
      telemetry: {
        startTime: Date.now(),
        modelsUsed: { scriptModel, ttsModel },
        voices: {
          voice1: options.voice1 || 'Kore',
          voice2: options.voice2 || 'Puck',
          mode: options.mode || 'duo'
        },
        steps: []
      }
    }
  };

  saveJob(jobState);

  // Execute processing asynchronously with concurrency limiter
  (async () => {
    await acquireJobSlot();
    try {
      await processPodcastJobAsync(jobId, options);
    } finally {
      releaseJobSlot();
    }
  })().catch((err) => {
    console.error(`Background job ${jobId} unhandled error:`, err);
  });

  return jobState;
}

async function processPodcastJobAsync(jobId: string, options: GeneratePodcastOptions) {
  const job = getJob(jobId);
  if (!job) return;

  const startTime = Date.now();
  const scriptModel = envConfig.models.text;
  const ttsModel = envConfig.models.tts;
  const voice1 = options.voice1 || 'Kore';
  const voice2 = options.voice2 || 'Puck';
  const mode = options.mode || 'duo';

  const telemetry: JobTelemetry = {
    startTime,
    modelsUsed: { scriptModel, ttsModel },
    voices: { voice1, voice2, mode },
    steps: []
  };

  try {
    cleanupOldStorageFiles();

    job.status = 'PROCESSING';
    job.progress = {
      percentage: 5,
      stage: 'script',
      stageLabel: 'ИИ создает подробный сценарий на основе эталонных ответов базы знаний...',
      currentStep: 0,
      totalSteps: 1,
      telemetry
    };
    saveJob(job);

    const { text, topic, questionsCount } = buildPodcastText(options.questionIds, options.topicName);

    // 1. Generate Script
    const scriptStartTime = Date.now();
    const script = await generateDialogueScript(text, options, questionsCount);
    const scriptDurationSec = Math.round((Date.now() - scriptStartTime) / 100) / 10;
    telemetry.scriptDurationSec = scriptDurationSec;

    const totalLines = script.dialogue.length;

    job.progress = {
      percentage: 15,
      stage: 'synthesis',
      stageLabel: `Сценарий готов (${totalLines} реплик по ${questionsCount} вопросам). Запуск синтеза речи...`,
      currentStep: 0,
      totalSteps: totalLines,
      telemetry
    };
    saveJob(job);

    // 2. Synthesize audio lines with pacing & retry
    const ttsStartTime = Date.now();
    const stitchedSegments: StitchSegment[] = [];
    let transcriptText = `Topic: ${topic}\n\n`;

    for (let i = 0; i < totalLines; i++) {
      const line = script.dialogue[i];
      const selectedVoice = line.speaker === 'Host' ? voice1 : voice2;
      const speakerLabel = line.speaker === 'Host' ? `Host (${voice1})` : `${script.name_of_guest || 'Guest'} (${voice2})`;

      const stepStart = Date.now();
      let stepStatus: 'completed' | 'failed' = 'completed';
      let retriesCount = 0;

      const { buffer: wavBuffer, retries } = await synthesizeTTSWithRetry(
        line.text, 
        selectedVoice, 
        4, 
        (attempt, delayMs) => {
          if (job.progress) {
            job.progress.stageLabel = `Лимит Gemini TTS (429), повтор через ${Math.round(delayMs / 1000)}с (реплика ${i + 1}/${totalLines})...`;
            saveJob(job);
          }
        }
      );
      retriesCount = retries;

      // 300ms pause between speaker turns
      stitchedSegments.push({
        wavBuffer,
        pauseAfterMs: 300
      });

      const stepDurationMs = Date.now() - stepStart;
      telemetry.steps.push({
        index: i + 1,
        speaker: speakerLabel,
        voice: selectedVoice,
        text: line.text,
        durationMs: stepDurationMs,
        status: stepStatus,
        retries: retriesCount
      });

      // Update progress after each replica
      const completedCount = i + 1;
      const percentage = 15 + Math.round((completedCount / totalLines) * 75);

      job.progress = {
        percentage,
        stage: 'synthesis',
        stageLabel: `Озвучено ${completedCount} из ${totalLines} реплик (${percentage}%)`,
        currentStep: completedCount,
        totalSteps: totalLines,
        currentSpeaker: line.speaker === 'Host' ? `Ведущий (${voice1})` : `${script.name_of_guest || 'Эксперт'} (${voice2})`,
        currentTextSnippet: line.text,
        telemetry
      };
      saveJob(job);

      if (i < totalLines - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    const ttsDurationSec = Math.round((Date.now() - ttsStartTime) / 100) / 10;
    telemetry.ttsDurationSec = ttsDurationSec;

    // 3. Merging and Transcoding to Opus
    job.progress = {
      percentage: 92,
      stage: 'merging',
      stageLabel: 'Склейка дорожек и транскодирование в Opus (48 kbps VoIP)...',
      currentStep: totalLines,
      totalSteps: totalLines,
      telemetry
    };
    saveJob(job);

    script.dialogue.forEach((line) => {
      const speakerName = line.speaker === 'Host' ? `Host (${voice1})` : `${script.name_of_guest || 'Guest'} (${voice2})`;
      transcriptText += `**${speakerName}**: ${line.text}\n\n`;
    });

    const masterWavBuffer = WavStitcherService.stitch(stitchedSegments);

    const opusFileName = `podcast_${jobId}.opus`;
    const opusFilePath = path.join(STORAGE_DIR, opusFileName);

    try {
      await OpusEncoderService.encodeWavToOpus(masterWavBuffer, opusFilePath);
      job.audioPath = opusFilePath;
      job.audio_url = `/api/podcast/audio/${jobId}`;
    } catch (ffmpegErr) {
      console.warn('FFmpeg Opus encoding failed, fallback to WAV:', ffmpegErr);
      const wavFileName = `podcast_${jobId}.wav`;
      const wavFilePath = path.join(STORAGE_DIR, wavFileName);
      await fs.promises.writeFile(wavFilePath, masterWavBuffer);
      job.audioPath = wavFilePath;
      job.audio_url = `/api/podcast/audio/${jobId}`;
    }

    const finalStat = fs.statSync(job.audioPath);
    const totalDurationSec = Math.round((Date.now() - startTime) / 100) / 10;
    telemetry.endTime = Date.now();
    telemetry.totalDurationSec = totalDurationSec;
    telemetry.totalBytes = finalStat.size;
    telemetry.audioDurationEstimateSec = Math.round(masterWavBuffer.length / 48000);

    job.status = 'COMPLETED';
    job.transcript = transcriptText;
    job.progress = {
      percentage: 100,
      stage: 'completed',
      stageLabel: `Аудиопересказ успешно создан (${stitchedSegments.length}/${totalLines} реплик)!`,
      currentStep: totalLines,
      totalSteps: totalLines,
      telemetry
    };
    job.metadata = {
      dialogue_count: totalLines,
      voice1,
      voice2,
      topic,
      telemetry
    };
    saveJob(job);
  } catch (err: any) {
    console.error(`Podcast job ${jobId} failed:`, err);
    job.status = 'FAILED';
    job.error = err.message || 'Podcast generation failed';
    if (job.progress) {
      job.progress.stage = 'failed';
      job.progress.stageLabel = `Ошибка: ${job.error}`;
    }
    saveJob(job);
  }
}

export async function fetchJobStatus(jobId: string): Promise<PodcastJobState> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  return job;
}

export async function streamAudioFile(jobId: string): Promise<{ filePath: string; mimeType: string }> {
  const job = getJob(jobId);
  if (!job || job.status !== 'COMPLETED' || !job.audioPath) {
    throw new Error('Audio file not ready or job failed');
  }

  if (!fs.existsSync(job.audioPath)) {
    throw new Error('Audio file does not exist on server');
  }

  const mimeType = job.audioPath.endsWith('.opus') ? 'audio/ogg; codecs=opus' : 'audio/wav';
  return { filePath: job.audioPath, mimeType };
}
