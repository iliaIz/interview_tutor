import { Router } from 'express';
import { startPodcastJob, fetchJobStatus, streamAudioFile, buildPodcastText } from '../services/podcast';

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
      voice1,
      voice2,
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
    const audioRes = await streamAudioFile(jobId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="podcast_${jobId}.mp3"`);

    if (audioRes.body) {
      // Stream response body to express response
      const arrayBuffer = await audioRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'Audio body empty' });
    }
  } catch (error: any) {
    console.error('Error streaming audio:', error);
    res.status(500).json({ error: error.message || 'Error streaming audio' });
  }
});

// GET /api/podcast/sample-audio - Stream MP3 sample for voice preview
router.get('/sample-audio', async (req, res) => {
  try {
    const voice = (req.query.voice as string) || 'ru-RU-SvetlanaNeural';
    const sampleTexts: Record<string, string> = {
      'ru-RU-SvetlanaNeural': 'Привет! Я Светлана. Помогу вам легко подготовиться к техническому собеседованию.',
      'ru-RU-DmitryNeural': 'Здравствуйте! Я Дмитрий. Давайте детально изучим ключевые концепции и архитектуру.',
      'ru-RU-ElenaNeural': 'Приветствую! Я Елена. Разберу ответы и подводные камни, которые спрашивают интервьюеры.',
      'ru-RU-DariyaNeural': 'Всем привет! Я Дарья. Разберем практические задачи backend-разработки ярко и понятно.',
    };

    const text = sampleTexts[voice] || 'Привет! Это пример звучания выбранного диктора.';
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ru&client=tw-ob`;

    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }

    res.status(500).json({ error: 'Failed to fetch sample audio stream' });
  } catch (err: any) {
    console.error('Error fetching sample audio:', err);
    res.status(500).json({ error: err.message || 'Sample audio error' });
  }
});

export default router;
