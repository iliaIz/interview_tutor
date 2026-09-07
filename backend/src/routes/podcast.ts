import { Router } from 'express';
import fs from 'fs';
import { 
  startPodcastJob, 
  fetchJobStatus, 
  streamAudioFile, 
  synthesizeTTSBuffer, 
  globalJobEmitter,
  getJob
} from '../services/podcast';
import { TOPIC_MAP } from '../services/topics';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// POST /api/podcast/generate - Start audio recap job
router.post('/generate', asyncHandler(async (req, res) => {
  const { questionIds, topicId, topicName, tone, length, language, systemPrompt, userPrompt, mode, voice1, voice2 } = req.body;

  const resolvedTopicName = topicName || (topicId ? TOPIC_MAP[String(topicId).toLowerCase()] : undefined);

  if ((!questionIds || questionIds.length === 0) && !resolvedTopicName) {
    throw new AppError('Provide questionIds or valid topicId/topicName', 400);
  }

  const job = await startPodcastJob({
    questionIds,
    topicName: resolvedTopicName,
    tone: tone || 'Fun',
    length: length || 'Medium (10-15 min)',
    language: language || 'Russian',
    systemPrompt,
    userPrompt,
    mode,
    voice1: voice1 || 'Kore',
    voice2: voice2 || 'Puck',
  });

  res.json(job);
}));

// GET /api/podcast/progress/:jobId - Server-Sent Events (SSE) stream for real-time progress
router.get('/progress/:jobId', (req, res): void => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const currentJob = getJob(jobId);

  // 1. Mandatory SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 2. Immediately flush headers to trigger EventSource.OPEN on client
  res.flushHeaders();

  const sendEvent = (eventName: string, payload: unknown): void => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    const resWithFlush = res as unknown as { flush?: () => void };
    if (typeof resWithFlush.flush === 'function') {
      resWithFlush.flush();
    }
  };

  sendEvent('connected', { jobId, timestamp: Date.now() });

  // If already completed or failed, send event immediately
  if (currentJob) {
    if (currentJob.status === 'COMPLETED') {
      sendEvent('job_completed', {
        jobId,
        stage: 'completed',
        progress: 100,
        data: {
          audio_url: currentJob.audio_url,
          telemetry: currentJob.progress?.telemetry
        }
      });
      res.end();
      return;
    } else if (currentJob.status === 'FAILED') {
      sendEvent('job_error', { error: currentJob.error || 'Job failed' });
      res.end();
      return;
    } else if (currentJob.progress) {
      sendEvent('job_progress', {
        jobId,
        stage: currentJob.progress.stage,
        progress: currentJob.progress.percentage,
        data: currentJob.progress
      });
    }
  }

  // 3. Heartbeat ping every 15s to keep proxy connections alive
  const heartbeatInterval = setInterval(() => {
    res.write(': ping\n\n');
    const resWithFlush = res as unknown as { flush?: () => void };
    if (typeof resWithFlush.flush === 'function') {
      resWithFlush.flush();
    }
  }, 15000);

  // 4. Job Event Listener
  const jobListener = (event: any) => {
    if (event.jobId !== jobId) return;

    if (event.stage === 'failed') {
      sendEvent('job_error', { error: event.error ?? 'Job processing failed' });
      cleanup();
      res.end();
    } else if (event.stage === 'completed') {
      sendEvent('job_completed', event);
      cleanup();
      res.end();
    } else {
      sendEvent('job_progress', event);
    }
  };

  globalJobEmitter.on('progress', jobListener);

  // 5. Cleanup on client disconnect
  const cleanup = () => {
    clearInterval(heartbeatInterval);
    globalJobEmitter.off('progress', jobListener);
  };

  req.on('close', cleanup);
});

// GET /api/podcast/status/:jobId - Check job status via REST fallback
router.get('/status/:jobId', asyncHandler(async (req, res) => {
  const jobId = (Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId) as string;
  const status = await fetchJobStatus(jobId);
  res.json(status);
}));

// GET /api/podcast/audio/:jobId - Stream Opus/WAV audio with full HTTP 206 Partial Content support
router.get('/audio/:jobId', asyncHandler(async (req, res) => {
  const jobId = (Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId) as string;
  const { filePath, mimeType } = await streamAudioFile(jobId);

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const fileExt = filePath.endsWith('.opus') ? 'opus' : 'wav';
  const filename = `podcast_${jobId}.${fileExt}`;

  if (!range) {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    res.writeHead(416, {
      'Content-Range': `bytes */${fileSize}`,
    });
    res.end();
    return;
  }

  const chunkSize = end - start + 1;
  const fileStream = fs.createReadStream(filePath, { start, end });

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': mimeType,
    'Content-Disposition': `inline; filename="${filename}"`,
  });

  fileStream.pipe(res);
}));

const sampleAudioCache = new Map<string, Buffer>();

// GET /api/podcast/sample-audio - Stream WAV sample for voice preview using Gemini TTS
router.get('/sample-audio', asyncHandler(async (req, res) => {
  const voice = (req.query.voice as string) || 'Kore';

  if (sampleAudioCache.has(voice)) {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(sampleAudioCache.get(voice));
  }

  const sampleTexts: Record<string, string> = {
    'Kore': 'Привет! Я Kore. Помогу вам легко подготовиться к техническому собеседованию.',
    'Puck': 'Здравствуйте! Я Puck. Давайте детально изучим ключевые концепции и архитектуру.',
    'Charon': 'Приветствую! Я Charon. Разберу сложные ответы и подводные камни backend-разработки.',
    'Aoede': 'Всем привет! Я Aoede. Объясню всё доступно, ярко и с практическими примерами.',
    'Fenrir': 'Приветствую! Я Fenrir. Проведем строгий разбор архитектуры и стандартов.',
  };

  const text = sampleTexts[voice] || 'Привет! Это пример звучания выбранного голоса.';

  const buffer = await synthesizeTTSBuffer(text, voice);
  sampleAudioCache.set(voice, buffer);

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(buffer);
}));

export default router;
