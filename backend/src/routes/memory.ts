import { Router } from 'express';
import {
  getKnowledgeRadarData,
  resetGapForPractice,
  getUserProfile,
  updateUserProfile,
  recordNewErrorGap,
  findRelevantCandidateGaps,
  applyKnowledgeDecay
} from '../services/vectorMemoryService';
import { getAuthUserId } from '../middleware/auth';
import { getFsrsQueue, getFsrsStats, updateFsrsCardState } from '../services/fsrsEngine';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// GET /api/memory/radar - Fetch full knowledge radar (Active, Verifying, Mastered)
router.get('/radar', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const data = getKnowledgeRadarData(userId);
  res.json(data);
}));

// POST /api/memory/reset-gap - Reset a gap back to active deficit for re-practice
router.post('/reset-gap', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const { gapId } = req.body;
  if (!gapId) {
    throw new AppError('gapId is required', 400);
  }
  const success = resetGapForPractice(gapId, userId);
  res.json({ success });
}));

// GET /api/memory/profile - Get candidate profile settings
router.get('/profile', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const profile = getUserProfile(userId);
  res.json(profile);
}));

// POST /api/memory/profile - Update candidate profile settings
router.post('/profile', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const updated = updateUserProfile(userId, req.body);
  res.json(updated);
}));

// GET /api/memory/relevant - Test / fetch relevant gaps for a specific question
router.get('/relevant', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const questionText = (req.query.questionText as string) || '';
  const topic = (req.query.topic as string) || '';
  const questionId = (req.query.questionId as string) || undefined;

  const gaps = await findRelevantCandidateGaps(questionText, topic, questionId, 0.70, userId);
  res.json({ gaps });
}));

// POST /api/memory/record-gap - Record a new gap
router.post('/record-gap', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const { questionId, topic, subtopic, errorConcept, initialDeficit } = req.body;
  if (!topic || !errorConcept) {
    throw new AppError('topic and errorConcept are required', 400);
  }

  const id = await recordNewErrorGap({
    userId,
    questionId,
    topic,
    subtopic,
    errorConcept,
    initialDeficit
  });

  res.json({ success: true, id });
}));

// GET /api/memory/fsrs/queue - Fetch questions requiring review (due_at <= now or R < 0.80)
router.get('/fsrs/queue', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const queue = getFsrsQueue(userId, limit);
  res.json({
    queue,
    count: queue.length,
    estimatedMinutes: Math.max(1, Math.round(queue.length * 1.5))
  });
}));

// GET /api/memory/fsrs/stats - Fetch FSRS memory health stats and 30-day Ebbinghaus curve
router.get('/fsrs/stats', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const stats = getFsrsStats(userId);
  res.json(stats);
}));

// POST /api/memory/fsrs/review - Explicitly review a question with score/pass
router.post('/fsrs/review', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const { questionId, score, isPassed } = req.body;
  if (!questionId || score === undefined) {
    throw new AppError('questionId and score are required', 400);
  }
  const result = await updateFsrsCardState({
    userId,
    questionId,
    score: Number(score),
    isPassed: Boolean(isPassed)
  });

  if (Boolean(isPassed) || Number(score) >= 70) {
    void applyKnowledgeDecay({
      userId,
      questionId,
      topic: '',
      assistanceLevel: 'solo'
    }).catch(err => {
      console.warn('Background knowledge decay failed:', err?.message);
    });
  }

  res.json(result);
}));

export default router;
