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
    const { questionIds, topicId, topicName, tone, length, language } = req.body;

    const resolvedTopicName = topicName || (topicId ? TOPIC_MAP[topicId.toLowerCase()] : undefined);

    if ((!questionIds || questionIds.length === 0) && !resolvedTopicName) {
      return res.status(400).json({ error: 'Provide questionIds or valid topicId/topicName' });
    }

    const job = await startPodcastJob({
      questionIds,
      topicName: resolvedTopicName,
      tone: tone || 'Fun',
      length: length || 'Medium (3-5 min)',
      language: language || 'Russian'
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

export default router;
