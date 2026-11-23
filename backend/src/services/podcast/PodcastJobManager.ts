/**
 * PodcastJobManager.ts
 * Manages background podcast job state, concurrency queues, SQLite persistence, and SSE events (SPEC-27).
 * Cognitive Bounding SLA: <= 250 lines (Rule 8 compliant).
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { db } from '../db';

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

export const STORAGE_DIR = path.join(process.cwd(), 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export class JobEventEmitter extends EventEmitter {}
export const globalJobEmitter = new JobEventEmitter();

// Concurrency Limiter (Max 2 concurrent jobs)
let activeRunningJobs = 0;
const MAX_CONCURRENT_JOBS = 2;
const pendingJobQueue: Array<() => void> = [];

export function acquireJobSlot(): Promise<void> {
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

export function releaseJobSlot(): void {
  activeRunningJobs = Math.max(0, activeRunningJobs - 1);
  if (pendingJobQueue.length > 0) {
    const next = pendingJobQueue.shift();
    if (next) next();
  }
}

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

export function saveJob(job: PodcastJobState): void {
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
