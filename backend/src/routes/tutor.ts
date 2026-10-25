import { Router } from 'express';
import {
  generateBugChallenge,
  getSavedBugChallenges,
  updateBugChallengeStatus
} from '../services/tutorService';
import { streamBugChallengeToResponse } from '../services/bugChallengeStreamService';

const router = Router();

// POST /api/tutor/bug-challenge/stream (Two-Phase SSE Streaming)
router.post('/bug-challenge/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientAbortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      clientAbortController.abort();
    }
  });

  await streamBugChallengeToResponse(req.body || {}, res, clientAbortController.signal);
});

// POST /api/tutor/bug-challenge
router.post('/bug-challenge', async (req, res) => {
  try {
    const {
      questionId,
      topicId,
      topic,
      questionText,
      referenceAnswer,
      workoutPreset,
      defectFocus,
      difficulty,
      excludeIds,
      techStackProfile,
      customTechStack,
      customInstructions
    } = req.body;

    const challenge = await generateBugChallenge({
      questionId,
      topicId,
      topic,
      questionText,
      referenceAnswer,
      workoutPreset,
      defectFocus,
      difficulty,
      excludeIds,
      techStackProfile,
      customTechStack,
      customInstructions
    });

    res.json(challenge);
  } catch (error: any) {
    console.error('API Error in /api/tutor/bug-challenge:', error);
    if (error.name === 'LlmGatewayUnavailableError' || error.reason) {
      return res.status(503).json({
        error: error.userMessage || error.message || 'AI Gateway временно недоступен',
        isGatewayUnavailable: true,
        retryAfterSeconds: error.retryAfterSeconds || 5,
        reason: error.reason || 'proxy_unreachable',
        availableBankCount: 70
      });
    }
    res.status(500).json({ error: error.message || 'Failed to generate bug challenge' });
  }
});

// GET /api/tutor/saved-challenges
router.get('/saved-challenges', async (req, res) => {
  try {
    const topicId = req.query.topicId as string | undefined;
    const filter = (req.query.filter as 'all' | 'unsolved' | 'solved') || 'all';

    const saved = getSavedBugChallenges(topicId, filter);
    res.json(saved);
  } catch (error: any) {
    console.error('API Error in /api/tutor/saved-challenges:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch saved bug challenges' });
  }
});

// POST /api/tutor/update-challenge-status
router.post('/update-challenge-status', async (req, res) => {
  try {
    const { challengeId, isSolved, score, feedback, keyTakeaways } = req.body;
    if (!challengeId) {
      return res.status(400).json({ error: 'challengeId is required' });
    }

    const success = updateBugChallengeStatus({
      challengeId,
      isSolved: Boolean(isSolved),
      score,
      feedback,
      keyTakeaways
    });

    res.json({ success });
  } catch (error: any) {
    console.error('API Error in /api/tutor/update-challenge-status:', error);
    res.status(500).json({ error: error.message || 'Failed to update challenge status' });
  }
});

export default router;
