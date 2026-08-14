import { db } from './db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

const STORAGE_DIR = path.join(process.cwd(), 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

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

export function buildPodcastText(questionIds?: string[], topicName?: string): { text: string; topic: string } {
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

  let text = `Topic: ${topic}\n\nHere are the interview questions and detailed answers to discuss in the audio podcast recap:\n\n`;

  questions.forEach((q, idx) => {
    text += `Question #${idx + 1} (${q.topic}): ${q.question}\n`;
    text += `Answer: ${q.answer}\n\n`;
  });

  return { text, topic };
}

/**
 * Generate dialogue script using Gemini / LiteLLM Proxy
 */
async function generateDialogueScript(
  text: string,
  options: GeneratePodcastOptions
): Promise<{ name_of_guest: string; dialogue: DialogueItem[] }> {
  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const endpointUrl = `${cleanProxyBase}/v1/chat/completions`;
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
  const modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-v3';

  const isDuo = options.mode !== 'solo';
  const systemPrompt = options.systemPrompt || `Ты — ведущий эксперт по IT-собеседованиям. Твоя задача — создавать структурированный ${isDuo ? 'динамичный диалог двух ведущих (Host и Guest)' : 'увлекательный монолог ведущего (Host)'} на русском языке.`;
  const userPrompt = options.userPrompt || `Создай глубокий и полезный разбор следующего материала.`;

  const scriptPrompt = `${systemPrompt}

${userPrompt}

Инструкции к формату:
Верни ответ СТРОГО в JSON формате без разметки markdown:
{
  "name_of_guest": "${isDuo ? 'Эксперт' : 'Ведущий'}",
  "dialogue": [
    ${isDuo ? '{"speaker": "Host", "text": "..."}, {"speaker": "Guest", "text": "..."}' : '{"speaker": "Host", "text": "..."}'}
  ]
}

Исходный материал:
${text}`;

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: scriptPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawJson = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawJson);
      if (parsed.dialogue && Array.isArray(parsed.dialogue) && parsed.dialogue.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('LiteLLM script generation failed, fallback to default script:', err);
  }

  // Fallback simple script
  return {
    name_of_guest: isDuo ? 'Эксперт' : 'Ведущий',
    dialogue: [
      { speaker: 'Host', text: `Приветствуем всех слушателей! Сегодня мы подробно разбираем ключевые вопросы темы: ${text.slice(0, 100)}...` },
      { speaker: isDuo ? 'Guest' : 'Host', text: 'Давайте последовательно пройдемся по каждому вопросу, архитектуре и важным деталям для собеседования.' }
    ]
  };
}

/**
 * Convert 16-bit 24kHz mono PCM buffer into a valid WAV file by prepending RIFF header.
 */
export function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitDepth = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
  header.writeUInt16LE(numChannels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Synthesize TTS audio for single text line via LiteLLM Gateway
 */
export async function synthesizeTTSBuffer(text: string, voice: string): Promise<Buffer> {
  const validVoice = (['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir'].includes(voice)) ? voice : 'Kore';

  const rawProxyUrl = process.env.LITELLM_BASE_URL || process.env.LITELLM_PROXY_URL || 'http://host.docker.internal:4000/v1';
  const cleanProxyBase = rawProxyUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const speechUrl = `${cleanProxyBase}/v1/audio/speech`;
  const proxyApiKey = process.env.LITELLM_API_KEY || 'sk-1234';
  const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-tts-v3';

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
 * Start asynchronous podcast generation job in Node.js backend.
 */
export async function startPodcastJob(options: GeneratePodcastOptions): Promise<PodcastJobState> {
  const jobId = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  const scriptModel = process.env.GEMINI_TEXT_MODEL || 'gemini-v3';
  const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-tts-v3';

  const jobState: PodcastJobState = {
    job_id: jobId,
    status: 'QUEUED',
    created_at: now,
    progress: {
      percentage: 0,
      stage: 'script',
      stageLabel: 'Инициализация и постановка в очередь...',
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

  // Execute processing asynchronously in background
  processPodcastJobAsync(jobId, options).catch((err) => {
    console.error(`Background job ${jobId} unhandled error:`, err);
  });

  return jobState;
}

async function processPodcastJobAsync(jobId: string, options: GeneratePodcastOptions) {
  const job = getJob(jobId);
  if (!job) return;

  const startTime = Date.now();
  const scriptModel = process.env.GEMINI_TEXT_MODEL || 'gemini-v3';
  const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-tts-v3';
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
    job.status = 'PROCESSING';
    job.progress = {
      percentage: 5,
      stage: 'script',
      stageLabel: 'ИИ создает подробный сценарий и реплики диалога...',
      currentStep: 0,
      totalSteps: 1,
      telemetry
    };
    saveJob(job);

    const { text, topic } = buildPodcastText(options.questionIds, options.topicName);

    // 1. Generate Script
    const scriptStartTime = Date.now();
    const script = await generateDialogueScript(text, options);
    const scriptDurationSec = Math.round((Date.now() - scriptStartTime) / 100) / 10;
    telemetry.scriptDurationSec = scriptDurationSec;

    const totalLines = script.dialogue.length;

    job.progress = {
      percentage: 15,
      stage: 'synthesis',
      stageLabel: `Сценарий готов (${totalLines} реплик). Запуск синтеза речи...`,
      currentStep: 0,
      totalSteps: totalLines,
      telemetry
    };
    saveJob(job);

    // 2. Synthesize audio lines with controlled batching (concurrency = 2) for 2x speedup
    const ttsStartTime = Date.now();
    const rawPcmBuffers: (Buffer | null)[] = new Array(totalLines).fill(null);
    let transcriptText = `Topic: ${topic}\n\n`;

    // Process in batches of 2 parallel requests
    const CONCURRENCY = 2;
    for (let i = 0; i < totalLines; i += CONCURRENCY) {
      const batchIndices = [];
      for (let b = 0; b < CONCURRENCY && (i + b) < totalLines; b++) {
        batchIndices.push(i + b);
      }

      await Promise.all(batchIndices.map(async (idx) => {
        const line = script.dialogue[idx];
        const selectedVoice = line.speaker === 'Host' ? voice1 : voice2;
        const speakerLabel = line.speaker === 'Host' ? `Host (${voice1})` : `${script.name_of_guest || 'Guest'} (${voice2})`;

        const stepStart = Date.now();
        let stepStatus: 'completed' | 'failed' = 'completed';

        try {
          const wavBuffer = await synthesizeTTSBuffer(line.text, selectedVoice);
          // Strip 44-byte WAV header so we concatenate pure 24kHz PCM data
          const pcmChunk = wavBuffer.length > 44 ? wavBuffer.subarray(44) : wavBuffer;
          rawPcmBuffers[idx] = pcmChunk;
        } catch (ttsErr) {
          console.error(`TTS Error on line ${idx + 1}:`, ttsErr);
          stepStatus = 'failed';
        }

        const stepDurationMs = Date.now() - stepStart;
        telemetry.steps.push({
          index: idx + 1,
          speaker: speakerLabel,
          voice: selectedVoice,
          text: line.text,
          durationMs: stepDurationMs,
          status: stepStatus
        });
      }));

      // Update progress after each batch completes
      const completedCount = Math.min(i + batchIndices.length, totalLines);
      const percentage = 15 + Math.round((completedCount / totalLines) * 75);
      const currentLine = script.dialogue[Math.min(i + batchIndices.length - 1, totalLines - 1)];

      job.progress = {
        percentage,
        stage: 'synthesis',
        stageLabel: `Озвучено ${completedCount} из ${totalLines} реплик (${percentage}%)`,
        currentStep: completedCount,
        totalSteps: totalLines,
        currentSpeaker: currentLine.speaker === 'Host' ? `Ведущий (${voice1})` : `${script.name_of_guest || 'Эксперт'} (${voice2})`,
        currentTextSnippet: currentLine.text,
        telemetry
      };
      saveJob(job);
    }

    const ttsDurationSec = Math.round((Date.now() - ttsStartTime) / 100) / 10;
    telemetry.ttsDurationSec = ttsDurationSec;

    // 3. Merging pure PCM into master RIFF WAV
    job.progress = {
      percentage: 92,
      stage: 'merging',
      stageLabel: 'Сборка и нормализация мастер-аудиодорожки...',
      currentStep: totalLines,
      totalSteps: totalLines,
      telemetry
    };
    saveJob(job);

    // Build transcript
    script.dialogue.forEach((line) => {
      const speakerName = line.speaker === 'Host' ? `Host (${voice1})` : `${script.name_of_guest || 'Guest'} (${voice2})`;
      transcriptText += `**${speakerName}**: ${line.text}\n\n`;
    });

    const validPcmChunks = rawPcmBuffers.filter((b): b is Buffer => b !== null);
    const combinedPcm = Buffer.concat(validPcmChunks);
    const finalWavBuffer = pcmToWav(combinedPcm, 24000, 1, 16);

    const fileName = `podcast_${jobId}.wav`;
    const filePath = path.join(STORAGE_DIR, fileName);
    await fs.promises.writeFile(filePath, finalWavBuffer);

    const totalDurationSec = Math.round((Date.now() - startTime) / 100) / 10;
    telemetry.endTime = Date.now();
    telemetry.totalDurationSec = totalDurationSec;
    telemetry.totalBytes = finalWavBuffer.length;
    telemetry.audioDurationEstimateSec = Math.round(combinedPcm.length / 48000); // 24000 samples * 2 bytes = 48000 bytes/sec

    job.status = 'COMPLETED';
    job.audioPath = filePath;
    job.audio_url = `/api/podcast/audio/${jobId}`;
    job.transcript = transcriptText;
    job.progress = {
      percentage: 100,
      stage: 'completed',
      stageLabel: 'Аудиопересказ успешно создан!',
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

export async function streamAudioFile(jobId: string): Promise<{ filePath: string }> {
  const job = getJob(jobId);
  if (!job || job.status !== 'COMPLETED' || !job.audioPath) {
    throw new Error('Audio file not ready or job failed');
  }

  if (!fs.existsSync(job.audioPath)) {
    throw new Error('Audio file does not exist on server');
  }

  return { filePath: job.audioPath };
}
