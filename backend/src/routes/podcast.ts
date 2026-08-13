import { Router } from 'express';
import { startPodcastJob, fetchJobStatus, streamAudioFile, synthesizeTTSBuffer } from '../services/podcast';

const router = Router();

// TOPIC MAP matching topics.ts
const TOPIC_MAP: Record<string, string> = {
  'java': 'Java Core',
  'spring': 'Spring Framework',
  'hibernate': 'Hibernate ORM',
  'docker': 'Docker'
};

// POST /api/podcast/generate - Start audio recap job
router.post('/generate', async (req, res) => {
  try {
    const { questionIds, topicId, topicName, tone, length, language, systemPrompt, userPrompt, mode, voice1, voice2 } = req.body;

    const resolvedTopicName = topicName || (topicId ? TOPIC_MAP[topicId.toLowerCase()] : undefined);

    if ((!questionIds || questionIds.length === 0) && !resolvedTopicName) {
      return res.status(400).json({ error: 'Provide questionIds or valid topicId/topicName' });
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
  } catch (error: any) {
    console.error('Error generating podcast:', error);
    res.status(500).json({ error: error.message || 'Internal podcast service error' });
  }
});

// GET /api/podcast/status/:jobId - Check job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await fetchJobStatus(jobId);
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: error.message || 'Error fetching status' });
  }
});

// GET /api/podcast/audio/:jobId - Stream MP3 audio
router.get('/audio/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { filePath } = await streamAudioFile(jobId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="podcast_${jobId}.mp3"`);

    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error streaming audio:', error);
    res.status(500).json({ error: error.message || 'Error streaming audio' });
  }
});

const sampleAudioCache = new Map<string, Buffer>();

// GET /api/podcast/sample-audio - Stream WAV sample for voice preview using Gemini TTS
router.get('/sample-audio', async (req, res) => {
  try {
    const voice = (req.query.voice as string) || 'Kore';

    // 1. Return instantly from in-memory cache if generated previously
    if (sampleAudioCache.has(voice)) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(sampleAudioCache.get(voice));
    }

    const sampleTexts: Record<string, string> = {
      'Kore': 'Привет! Я Kore. Помогу вам легко подготовиться к техническому собеседованию.',
      'Puck': 'Здравствуйте! Я Puck. Давайте детально изучим ключевые концепции и архитектуру.',
      'Charon': 'Приветствую! Я Charon. Разберу сложные ответы и подводные камни backend-разработки.',
    };

    const text = sampleTexts[voice] || 'Привет! Это пример звучания выбранного голоса.';

    const buffer = await synthesizeTTSBuffer(text, voice);
    sampleAudioCache.set(voice, buffer);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (err: any) {
    console.error('Error fetching sample audio:', err);
    res.status(500).json({ error: err.message || 'Sample audio error' });
  }
});

export default router;
