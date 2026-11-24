/**
 * podcast.ts
 * Deep facade and orchestrator for audio podcast generation (SPEC-27).
 * Encapsulates background job progression, delegating audio DSP to PodcastAudioPipeline,
 * script generation to PodcastScriptGenerator, and concurrency/storage to PodcastJobManager.
 * Cognitive Bounding SLA: <= 250 lines (Rule 8 compliant).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { envConfig } from '../config/env';
import { DEFAULT_SECONDARY_VOICE_NAME, DEFAULT_VOICE_NAME } from '../config/liveDefaults';

import {
  WavInfo,
  StitchSegment,
  WavStitcherService,
  OpusEncoderService,
  synthesizeTTSBuffer,
  synthesizeTTSWithRetry
} from './podcast/PodcastAudioPipeline';

import {
  JobTelemetry,
  StepTelemetry,
  PodcastJobProgress,
  PodcastJobState,
  STORAGE_DIR,
  JobEventEmitter,
  globalJobEmitter,
  acquireJobSlot,
  releaseJobSlot,
  cleanupOldStorageFiles,
  saveJob,
  getJob,
  fetchJobStatus,
  streamAudioFile
} from './podcast/PodcastJobManager';

import {
  GeneratePodcastOptions,
  QuestionRow,
  DialogueItem,
  DEFAULT_STRICT_SYSTEM_PROMPT,
  DEFAULT_STRICT_USER_PROMPT,
  buildPodcastText,
  generateDialogueScript
} from './podcast/PodcastScriptGenerator';

export {
  WavInfo,
  StitchSegment,
  WavStitcherService,
  OpusEncoderService,
  synthesizeTTSBuffer,
  synthesizeTTSWithRetry,
  JobTelemetry,
  StepTelemetry,
  PodcastJobProgress,
  PodcastJobState,
  JobEventEmitter,
  globalJobEmitter,
  cleanupOldStorageFiles,
  saveJob,
  getJob,
  fetchJobStatus,
  streamAudioFile,
  GeneratePodcastOptions,
  QuestionRow,
  DialogueItem,
  DEFAULT_STRICT_SYSTEM_PROMPT,
  DEFAULT_STRICT_USER_PROMPT,
  buildPodcastText
};

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
          voice1: options.voice1 || DEFAULT_VOICE_NAME,
          voice2: options.voice2 || DEFAULT_SECONDARY_VOICE_NAME,
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
  const voice1 = options.voice1 || DEFAULT_VOICE_NAME;
  const voice2 = options.voice2 || DEFAULT_SECONDARY_VOICE_NAME;
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
        speaker: speakerLabel,
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
