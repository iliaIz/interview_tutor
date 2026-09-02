import { Router } from 'express';
import { db } from '../services/db';
import { evaluateAnswerWithGemini } from '../services/geminiText';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';
import { TOPIC_MAP, TOPIC_DEFINITIONS } from '../services/topics';
import { getAuthUserId } from '../middleware/auth';
import { recordEvaluationAndSyncProgress } from '../services/progressService';

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
router.post('/', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { questionId, topic, question, referenceAnswer, userAnswer, userGender } = req.body;

    if (!question || !referenceAnswer || !userAnswer) {
      return res.status(400).json({ error: 'Missing required parameters: question, referenceAnswer, userAnswer' });
    }

    const evaluation = await evaluateAnswerWithGemini(question, referenceAnswer, userAnswer, userGender || 'female');

    // If questionId and topic are provided, persist evaluation and atomically sync progress
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

      // Apply Knowledge Decay
      try {
        decayResult = await applyKnowledgeDecay({
          questionId,
          topic,
          assistanceLevel: evaluation.isPassed ? (evaluation.score >= 85 ? 'solo' : 'guided') : 'relapse'
        });
      } catch (e) {}

      // Record new gap if failed
      if (!evaluation.isPassed && evaluation.missingPoints && evaluation.missingPoints.length > 0) {
        try {
          void recordNewErrorGap({
            questionId,
            topic,
            errorConcept: evaluation.missingPoints[0],
            initialDeficit: 1.0
          });
        } catch (e) {}
      }
    }

    res.json({
      ...evaluation,
      knowledgeUpdate: decayResult,
      progress: progressSummary
    });
  } catch (error: any) {
    console.error('Error in /api/eval route:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

// POST /api/eval/save - Persist evaluation from Gemini Live Function Calling or client
router.post('/save', async (req, res) => {
  try {
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
      return res.status(400).json({ error: 'Missing required parameters: questionId, topic, score' });
    }

    const numScore = Math.round(Number(score));
    const passedBool = isPassed !== undefined ? !!isPassed : numScore >= 70;

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
  } catch (error: any) {
    console.error('Error in /api/eval/save:', error);
    res.status(500).json({ error: error.message || 'Failed to save evaluation' });
  }
});

// GET /api/eval/latest/:questionId - Get the latest detailed report for a question
router.get('/latest/:questionId', (req, res) => {
  try {
    const { questionId } = req.params;

    const stmt = db.prepare(`
      SELECT * FROM question_evaluations
      WHERE question_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(questionId) as any;

    if (!row) {
      return res.status(404).json({ error: 'No evaluation found for this question' });
    }

    res.json({
      id: row.id,
      questionId: row.question_id,
      topic: row.topic,
      mode: row.mode,
      score: row.score,
      isPassed: Boolean(row.is_passed),
      positivePoints: JSON.parse(row.positive_points || '[]'),
      missingPoints: JSON.parse(row.missing_points || '[]'),
      feedback: row.feedback,
      userAnswer: row.user_answer,
      transcript: row.transcript,
      audioMetrics: JSON.parse(row.audio_metrics || 'null'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error in /api/eval/latest/:questionId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch evaluation report' });
  }
});

// GET /api/eval/topic/:topicId - Get evaluation summary for all questions in a topic
router.get('/topic/:topicId', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const topicId = req.params.topicId.toLowerCase();
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
      positivePoints: JSON.parse(r.positivePoints || '[]'),
      missingPoints: JSON.parse(r.missingPoints || '[]')
    }));

    res.json(summaries);
  } catch (error: any) {
    console.error('Error in /api/eval/topic/:topicId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch topic evaluations' });
  }
});

export default router;
