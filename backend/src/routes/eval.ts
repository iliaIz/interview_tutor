import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../services/db';
import { evaluateAnswerWithGemini } from '../services/geminiText';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';

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
    const { questionId, topic, question, referenceAnswer, userAnswer } = req.body;

    if (!question || !referenceAnswer || !userAnswer) {
      return res.status(400).json({ error: 'Missing required parameters: question, referenceAnswer, userAnswer' });
    }

    const evaluation = await evaluateAnswerWithGemini(question, referenceAnswer, userAnswer);

    // If questionId and topic are provided, persist evaluation
    let decayResult = null;
    if (questionId && topic) {
      const evalId = crypto.randomBytes(16).toString('hex');
      const stmt = db.prepare(`
        INSERT INTO question_evaluations (
          id, question_id, topic, mode, score, is_passed,
          positive_points, missing_points, feedback, user_answer,
          transcript, audio_metrics, created_at, updated_at
        ) VALUES (
          @id, @question_id, @topic, @mode, @score, @is_passed,
          @positive_points, @missing_points, @feedback, @user_answer,
          @transcript, @audio_metrics, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      stmt.run({
        id: evalId,
        question_id: questionId,
        topic,
        mode: 'text',
        score: evaluation.score,
        is_passed: evaluation.isPassed ? 1 : 0,
        positive_points: JSON.stringify(evaluation.positivePoints || []),
        missing_points: JSON.stringify(evaluation.missingPoints || []),
        feedback: evaluation.feedback || '',
        user_answer: userAnswer || '',
        transcript: null,
        audio_metrics: null
      });

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
      knowledgeUpdate: decayResult
    });
  } catch (error: any) {
    console.error('Error in /api/eval route:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

// POST /api/eval/save - Persist evaluation from Gemini Live Function Calling or client
router.post('/save', async (req, res) => {
  try {
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

    const evalId = crypto.randomBytes(16).toString('hex');
    const stmt = db.prepare(`
      INSERT INTO question_evaluations (
        id, question_id, topic, mode, score, is_passed,
        positive_points, missing_points, feedback, user_answer,
        transcript, audio_metrics, created_at, updated_at
      ) VALUES (
        @id, @question_id, @topic, @mode, @score, @is_passed,
        @positive_points, @missing_points, @feedback, @user_answer,
        @transcript, @audio_metrics, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    stmt.run({
      id: evalId,
      question_id: questionId,
      topic,
      mode,
      score: Math.round(Number(score)),
      is_passed: isPassed ? 1 : 0,
      positive_points: JSON.stringify(positivePoints),
      missing_points: JSON.stringify(missingPoints),
      feedback,
      user_answer: userAnswer,
      transcript: transcript || '',
      audio_metrics: audioMetrics ? JSON.stringify(audioMetrics) : null
    });

    res.json({
      success: true,
      id: evalId,
      score: Math.round(Number(score)),
      isPassed: !!isPassed,
      message: 'Evaluation saved successfully'
    });
  } catch (error: any) {
    console.error('Error in /api/eval/save:', error);
    res.status(500).json({ error: error.message || 'Failed to save evaluation' });
  }
});

// GET /api/eval/latest/:questionId - Get the latest detailed report for a question
router.get('/latest/:questionId', (req, res) => {
  try {
    const questionId = (Array.isArray(req.params.questionId) ? req.params.questionId[0] : req.params.questionId) as string;
    const stmt = db.prepare(`
      SELECT * FROM question_evaluations
      WHERE question_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(questionId) as any;
    if (!row) {
      return res.status(404).json({ error: 'No evaluation record found for this question' });
    }

    res.json({
      id: row.id,
      questionId: row.question_id,
      topic: row.topic,
      mode: row.mode,
      score: row.score,
      isPassed: Boolean(row.is_passed),
      positivePoints: row.positive_points ? JSON.parse(row.positive_points) : [],
      missingPoints: row.missing_points ? JSON.parse(row.missing_points) : [],
      feedback: row.feedback,
      userAnswer: row.user_answer,
      transcript: row.transcript,
      audioMetrics: row.audio_metrics ? JSON.parse(row.audio_metrics) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error in /api/eval/latest/:questionId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch latest evaluation' });
  }
});

// GET /api/eval/topic/:topicId - Get evaluation summary for all questions in a topic
router.get('/topic/:topicId', (req, res) => {
  try {
    const topicId = (Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId) as string;
    const stmt = db.prepare(`
      SELECT e.*
      FROM question_evaluations e
      INNER JOIN (
        SELECT question_id, MAX(created_at) as max_created
        FROM question_evaluations
        GROUP BY question_id
      ) latest ON e.question_id = latest.question_id AND e.created_at = latest.max_created
      WHERE LOWER(e.topic) = LOWER(?) OR LOWER(e.topic) LIKE '%' || LOWER(?) || '%'
    `);

    const rows = stmt.all(topicId, topicId) as any[];

    const mapped = rows.map((row) => ({
      id: row.id,
      questionId: row.question_id,
      topic: row.topic,
      mode: row.mode,
      score: row.score,
      isPassed: Boolean(row.is_passed),
      positivePoints: row.positive_points ? JSON.parse(row.positive_points) : [],
      missingPoints: row.missing_points ? JSON.parse(row.missing_points) : [],
      feedback: row.feedback,
      userAnswer: row.user_answer,
      transcript: row.transcript,
      audioMetrics: row.audio_metrics ? JSON.parse(row.audio_metrics) : null,
      createdAt: row.created_at
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error('Error in /api/eval/topic/:topicId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch topic evaluations' });
  }
});

export default router;
