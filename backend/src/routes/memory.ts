import { Router } from 'express';
import {
  getKnowledgeRadarData,
  resetGapForPractice,
  getUserProfile,
  updateUserProfile,
  recordNewErrorGap,
  findRelevantCandidateGaps
} from '../services/vectorMemoryService';
import { getAuthUserId } from '../middleware/auth';
import { getFsrsQueue, getFsrsStats, updateFsrsCardState } from '../services/fsrsEngine';

const router = Router();

// GET /api/memory/radar - Fetch full knowledge radar (Active, Verifying, Mastered)
router.get('/radar', (req, res) => {
  try {
    const data = getKnowledgeRadarData();
    res.json(data);
  } catch (err: any) {
    console.error('Error fetching knowledge radar:', err);
    res.status(500).json({ error: 'Failed to fetch knowledge radar' });
  }
});

// POST /api/memory/reset-gap - Reset a gap back to active deficit for re-practice
router.post('/reset-gap', (req, res) => {
  try {
    const { gapId } = req.body;
    if (!gapId) {
      return res.status(400).json({ error: 'gapId is required' });
    }
    const success = resetGapForPractice(gapId);
    res.json({ success });
  } catch (err: any) {
    console.error('Error resetting gap:', err);
    res.status(500).json({ error: 'Failed to reset gap' });
  }
});

// GET /api/memory/profile - Get candidate profile settings
router.get('/profile', (req, res) => {
  try {
    const profile = getUserProfile();
    res.json(profile);
  } catch (err: any) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/memory/profile - Update candidate profile settings
router.post('/profile', (req, res) => {
  try {
    const updated = updateUserProfile(req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/memory/relevant - Test / fetch relevant gaps for a specific question
router.get('/relevant', async (req, res) => {
  try {
    const questionText = (req.query.questionText as string) || '';
    const topic = (req.query.topic as string) || '';
    const questionId = (req.query.questionId as string) || undefined;

    const gaps = await findRelevantCandidateGaps(questionText, topic, questionId);
    res.json({ gaps });
  } catch (err: any) {
    console.error('Error fetching relevant gaps:', err);
    res.status(500).json({ error: 'Failed to fetch relevant gaps' });
  }
});

// POST /api/memory/record-gap - Record a new gap
router.post('/record-gap', async (req, res) => {
  try {
    const { questionId, topic, subtopic, errorConcept, initialDeficit } = req.body;
    if (!topic || !errorConcept) {
      return res.status(400).json({ error: 'topic and errorConcept are required' });
    }

    const id = await recordNewErrorGap({
      questionId,
      topic,
      subtopic,
      errorConcept,
      initialDeficit
    });

    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Error recording gap:', err);
    res.status(500).json({ error: 'Failed to record gap' });
  }
});

// GET /api/memory/fsrs/queue - Fetch questions requiring review (due_at <= now or R < 0.80)
router.get('/fsrs/queue', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const limit = parseInt(req.query.limit as string) || 10;
    const queue = getFsrsQueue(userId, limit);
    res.json({
      queue,
      count: queue.length,
      estimatedMinutes: Math.max(1, Math.round(queue.length * 1.5))
    });
  } catch (err: any) {
    console.error('Error fetching FSRS queue:', err);
    res.status(500).json({ error: 'Failed to fetch FSRS queue' });
  }
});

// GET /api/memory/fsrs/stats - Fetch FSRS memory health stats and 30-day Ebbinghaus curve
router.get('/fsrs/stats', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const stats = getFsrsStats(userId);
    res.json(stats);
  } catch (err: any) {
    console.error('Error fetching FSRS stats:', err);
    res.status(500).json({ error: 'Failed to fetch FSRS stats' });
  }
});

// POST /api/memory/fsrs/review - Explicitly review a question with score/pass
router.post('/fsrs/review', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { questionId, score, isPassed } = req.body;
    if (!questionId || score === undefined) {
      return res.status(400).json({ error: 'questionId and score are required' });
    }
    const result = await updateFsrsCardState({
      userId,
      questionId,
      score: Number(score),
      isPassed: Boolean(isPassed)
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error recording FSRS review:', err);
    res.status(500).json({ error: 'Failed to record FSRS review' });
  }
});

export default router;
