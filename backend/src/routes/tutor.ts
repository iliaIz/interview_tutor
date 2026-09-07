import { Router } from 'express';
import {
  generateBugChallenge,
  getSavedBugChallenges,
  updateBugChallengeStatus
} from '../services/tutorService';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// POST /api/tutor/bug-challenge
router.post('/bug-challenge', asyncHandler(async (req, res) => {
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
    if (error.name === 'LlmGatewayUnavailableError' || error.reason) {
      return res.status(503).json({
        error: error.userMessage || error.message || 'AI Gateway временно недоступен',
        isGatewayUnavailable: true,
        retryAfterSeconds: error.retryAfterSeconds || 5,
        reason: error.reason || 'proxy_unreachable',
        availableBankCount: 70
      });
    }
    throw error;
  }
}));

// GET /api/tutor/saved-challenges
router.get('/saved-challenges', asyncHandler(async (req, res) => {
  const topicId = req.query.topicId as string | undefined;
  const filter = (req.query.filter as 'all' | 'unsolved' | 'solved') || 'all';

  const saved = getSavedBugChallenges(topicId, filter);
  res.json(saved);
}));

// POST /api/tutor/update-challenge-status
router.post('/update-challenge-status', asyncHandler(async (req, res) => {
  const { challengeId, isSolved, score, feedback, keyTakeaways } = req.body;
  if (!challengeId) {
    throw new AppError('challengeId is required', 400);
  }

  const success = updateBugChallengeStatus({
    challengeId,
    isSolved: Boolean(isSolved),
    score,
    feedback,
    keyTakeaways
  });

  res.json({ success });
}));

export default router;
