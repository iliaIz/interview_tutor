import { Router } from 'express';
import { db } from '../services/db';
import { evaluateAnswerWithGemini } from '../services/geminiText';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';
import { TOPIC_MAP } from '../services/topics';
import { getAuthUserId } from '../middleware/auth';
import { recordEvaluationAndSyncProgress } from '../services/progressService';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { safeJsonParse } from '../utils/safeJson';

const router = Router();

export interface SaveEvaluationPayload {
  questionId: string;
  topic: string;
  mode: 'voice' | 'text';
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  userAnswer?: string;
  transcript?: string;
  audioMetrics?: any;
}

// POST /api/eval - Evaluate user text answer using Gemini and persist to SQLite
router.post('/', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const { questionId, topic, question, referenceAnswer, userAnswer, userGender } = req.body;

  if (!question || !referenceAnswer || !userAnswer) {
    throw new AppError('Missing required parameters: question, referenceAnswer, userAnswer', 400);
  }

  const trimmedAnswer = typeof userAnswer === 'string' ? userAnswer.trim() : '';
  const isDummyPlaceholder =
    trimmedAnswer.length < 15 ||
    trimmedAnswer.toLowerCase().includes('устный ответ кандидата') ||
    trimmedAnswer.toLowerCase().includes('кандидат завершил ответ без звука');

  if (isDummyPlaceholder) {
    throw new AppError('Ответ кандидата отсутствует или не содержит содержательного текста для оценки', 422);
  }

  const evaluation = await evaluateAnswerWithGemini(question, referenceAnswer, userAnswer, userGender || 'female');

  let decayResult = null;
  let progressSummary = null;
  if (questionId && topic) {
    const { progress } = recordEvaluationAndSyncProgress({
      userId,
      questionId,
      topic,
      mode: 'text',
      score: evaluation.score,
      isPassed: evaluation.isPassed,
      positivePoints: evaluation.positivePoints,
      missingPoints: evaluation.missingPoints,
      feedback: evaluation.feedback,
      userAnswer: userAnswer || ''
    });
    progressSummary = progress;

    // Apply Knowledge Decay safely
    try {
      decayResult = await applyKnowledgeDecay({
        questionId,
        topic,
        assistanceLevel: evaluation.isPassed ? (evaluation.score >= 85 ? 'solo' : 'guided') : 'relapse'
      });
    } catch (err: any) {
      console.warn('Knowledge decay update failed:', err?.message);
    }

    // Record new gap if failed
    if (!evaluation.isPassed && evaluation.missingPoints && evaluation.missingPoints.length > 0) {
      recordNewErrorGap({
        questionId,
        topic,
        errorConcept: evaluation.missingPoints[0],
        initialDeficit: 1.0
      }).catch(err => {
        console.warn('Record new error gap failed:', err?.message);
      });
    }
  }

  res.json({
    ...evaluation,
    knowledgeUpdate: decayResult,
    progress: progressSummary
  });
}));

// POST /api/eval/save - Persist evaluation from Gemini Live Function Calling or client
router.post('/save', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const {
    questionId,
    topic,
    mode = 'voice',
    score,
    isPassed,
    positivePoints = [],
    missingPoints = [],
    feedback = '',
    userAnswer = '',
    transcript = '',
    audioMetrics = null
  } = req.body;

  if (!questionId || !topic || score === undefined) {
    throw new AppError('Missing required parameters: questionId, topic, score', 400);
  }

  const numScore = Math.round(Number(score));
  const passedBool = isPassed !== undefined ? !!isPassed : numScore >= 70;

  const trimmedAnswer = typeof userAnswer === 'string' ? userAnswer.trim() : '';
  const isDummyText = trimmedAnswer.length < 15 || trimmedAnswer.toLowerCase().includes('устный ответ кандидата');
  if (numScore === 0 && isDummyText && !transcript) {
    throw new AppError('Попытка сохранения фантомной нулевой оценки без содержательного ответа кандидата заблокирована', 422);
  }

  const { evalId, progress } = recordEvaluationAndSyncProgress({
    userId,
    questionId,
    topic,
    mode,
    score: numScore,
    isPassed: passedBool,
    positivePoints,
    missingPoints,
    feedback,
    userAnswer,
    transcript,
    audioMetrics
  });

  res.json({
    success: true,
    id: evalId,
    score: numScore,
    isPassed: passedBool,
    progress,
    message: 'Evaluation saved and progress synchronized successfully'
  });
}));

// GET /api/eval/latest/:questionId - Get the latest detailed report for a question
router.get('/latest/:questionId', asyncHandler(async (req, res) => {
  const { questionId } = req.params;

  const stmt = db.prepare(`
    SELECT * FROM question_evaluations
    WHERE question_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(questionId) as any;

  if (!row) {
    throw new AppError('No evaluation found for this question', 404);
  }

  res.json({
    id: row.id,
    questionId: row.question_id,
    topic: row.topic,
    mode: row.mode,
    score: row.score,
    isPassed: Boolean(row.is_passed),
    positivePoints: safeJsonParse<string[]>(row.positive_points, []),
    missingPoints: safeJsonParse<string[]>(row.missing_points, []),
    feedback: row.feedback,
    userAnswer: row.user_answer,
    transcript: row.transcript,
    audioMetrics: safeJsonParse<any>(row.audio_metrics, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}));

// GET /api/eval/topic/:topicId - Get evaluation summary for all questions in a topic
router.get('/topic/:topicId', asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  const topicId = String(req.params.topicId).toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId] || topicId;

  const stmt = db.prepare(`
    SELECT 
      qe.question_id as questionId,
      qe.score,
      qe.is_passed as isPassed,
      qe.mode,
      qe.created_at as createdAt,
      qe.feedback,
      qe.positive_points as positivePoints,
      qe.missing_points as missingPoints
    FROM question_evaluations qe
    INNER JOIN (
      SELECT question_id, MAX(created_at) as max_created
      FROM question_evaluations
      WHERE (user_id = ? OR user_id = 'default_user') AND (topic = ? OR topic = ?)
      GROUP BY question_id
    ) latest ON qe.question_id = latest.question_id AND qe.created_at = latest.max_created
    WHERE (qe.user_id = ? OR qe.user_id = 'default_user') AND (qe.topic = ? OR qe.topic = ?)
  `);

  const rows = stmt.all(userId, dbTopicName, topicId, userId, dbTopicName, topicId) as any[];

  const summaries = rows.map(r => ({
    questionId: r.questionId,
    score: r.score,
    isPassed: Boolean(r.isPassed),
    mode: r.mode,
    createdAt: r.createdAt,
    feedback: r.feedback,
    positivePoints: safeJsonParse<string[]>(r.positivePoints, []),
    missingPoints: safeJsonParse<string[]>(r.missingPoints, [])
  }));

  res.json(summaries);
}));

export default router;
