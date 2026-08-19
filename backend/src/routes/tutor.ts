import { Router } from 'express';
import { generateBugChallenge } from '../services/tutorService';

const router = Router();

// POST /api/tutor/bug-challenge
router.post('/bug-challenge', async (req, res) => {
  try {
    const { questionId, topicId, topic, questionText, referenceAnswer } = req.body;

    const challenge = await generateBugChallenge({
      questionId,
      topicId,
      topic,
      questionText,
      referenceAnswer
    });

    res.json(challenge);
  } catch (error: any) {
    console.error('API Error in /api/tutor/bug-challenge:', error);
    res.status(500).json({ error: error.message || 'Failed to generate bug challenge' });
  }
});

export default router;
