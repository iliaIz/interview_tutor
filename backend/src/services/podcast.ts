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

export interface PodcastJobState {
  job_id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  audio_url?: string;
  transcript?: string;
  metadata?: any;
  error?: string;
  audioPath?: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function saveJob(job: PodcastJobState) {
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
    metadata: job.metadata ? JSON.stringify(job.metadata) : null,
    error: job.error || null,
    audio_path: job.audioPath || null,
  });
}

export function getJob(jobId: string): PodcastJobState | undefined {
  const stmt = db.prepare('SELECT * FROM podcast_jobs WHERE job_id = ?');
  const row = stmt.get(jobId) as any;
  if (!row) return undefined;
  return {
    job_id: row.job_id,
    status: row.status,
    created_at: row.created_at,
    audio_url: row.audio_url || undefined,
    transcript: row.transcript || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
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
  const systemPrompt = options.systemPrompt || `Ты — ведущий эксперт по IT-собеседованиям. Твоя задача — создавать структурированный ${isDuo ? 'диалог двух ведущих (Host и Guest)' : 'монолог ведущего (Host)'} на русском языке.`;
  const userPrompt = options.userPrompt || `Создай разбор следующего материала.`;

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
      if (parsed.dialogue && Array.isArray(parsed.dialogue)) {
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
      { speaker: 'Host', text: `Приветствую! Сегодня мы разбираем важные вопросы по теме: ${text.slice(0, 100)}...` },
      { speaker: isDuo ? 'Guest' : 'Host', text: 'Давайте подробно пройдемся по каждому вопросу и ключевым концепциям.' }
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

  const jobState: PodcastJobState = {
    job_id: jobId,
    status: 'QUEUED',
    created_at: now,
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

  try {
    job.status = 'PROCESSING';
    saveJob(job);

    const { text, topic } = buildPodcastText(options.questionIds, options.topicName);

    // 1. Generate Script
    const script = await generateDialogueScript(text, options);

    // 2. Synthesize each dialogue line
    const voice1 = options.voice1 || 'Kore';
    const voice2 = options.voice2 || 'Puck';

    const audioBuffers: Buffer[] = [];
    let transcriptText = `Topic: ${topic}\n\n`;

    for (let i = 0; i < script.dialogue.length; i++) {
      const line = script.dialogue[i];
      const selectedVoice = line.speaker === 'Host' ? voice1 : voice2;
      const speakerName = line.speaker === 'Host' ? 'Host (Ведущий)' : (script.name_of_guest || 'Guest');

      transcriptText += `**${speakerName}**: ${line.text}\n\n`;

      const lineBuffer = await synthesizeTTSBuffer(line.text, selectedVoice);
      audioBuffers.push(lineBuffer);
    }

    // Combine audio buffers
    const combinedBuffer = Buffer.concat(audioBuffers);
    const fileName = `podcast_${jobId}.mp3`;
    const filePath = path.join(STORAGE_DIR, fileName);

    await fs.promises.writeFile(filePath, combinedBuffer);

    job.status = 'COMPLETED';
    job.audioPath = filePath;
    job.audio_url = `/api/podcast/audio/${jobId}`;
    job.transcript = transcriptText;
    job.metadata = {
      dialogue_count: script.dialogue.length,
      voice1,
      voice2,
      topic,
    };
    saveJob(job);
  } catch (err: any) {
    console.error(`Podcast job ${jobId} failed:`, err);
    job.status = 'FAILED';
    job.error = err.message || 'Podcast generation failed';
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
