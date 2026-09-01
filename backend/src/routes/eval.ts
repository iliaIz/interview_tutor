import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../services/db';
import { evaluateAnswerWithGemini } from '../services/geminiText';
import { applyKnowledgeDecay, recordNewErrorGap } from '../services/vectorMemoryService';
import { TOPIC_MAP, TOPIC_DEFINITIONS } from '../services/topics';

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

// Atomic helper to update user_progress when an evaluation is scored
function syncProgressForEvaluation(questionId: string, topicInput: string, numScore: number, isPassed: boolean) {
  try {
    let dbTopicName = TOPIC_MAP[topicInput.toLowerCase()] || topicInput;
    if (!dbTopicName) {
      const found = TOPIC_DEFINITIONS.find(
        t => t.id.toLowerCase() === topicInput.toLowerCase() || t.name.toLowerCase() === topicInput.toLowerCase()
      );
      if (found) dbTopicName = found.name;
    }
    if (!dbTopicName) {
      const qRow = db.prepare('SELECT topic FROM questions WHERE id = ?').get(questionId) as any;
      if (qRow?.topic) dbTopicName = qRow.topic;
    }
    if (!dbTopicName) return;

    if (numScore >= 70 || isPassed) {
      const progressStmt = db.prepare('SELECT * FROM user_progress WHERE topic = ?');
      const row = progressStmt.get(dbTopicName) as any;

      let completedIds: string[] = row ? JSON.parse(row.completed_ids || '[]') : [];
      let masteredIds: string[] = row ? JSON.parse(row.mastered_ids || '[]') : [];

      if (!completedIds.includes(questionId)) {
        completedIds.push(questionId);
      }
      if (numScore >= 90 && !masteredIds.includes(questionId)) {
        masteredIds.push(questionId);
      }

      const countRow = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?').get(dbTopicName) as any;
      const total = countRow ? countRow.count : 100;
      const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

      const upsertStmt = db.prepare(`
        INSERT INTO user_progress (
          topic, completed_ids, mastered_ids, percentage, shuffle, batch_size, updated_at
        ) VALUES (
          @topic, @completed_ids, @mastered_ids, @percentage, @shuffle, @batch_size, CURRENT_TIMESTAMP
        ) ON CONFLICT(topic) DO UPDATE SET
          completed_ids = @completed_ids,
          mastered_ids = @mastered_ids,
          percentage = @percentage,
          updated_at = CURRENT_TIMESTAMP
      `);

      upsertStmt.run({
        topic: dbTopicName,
        completed_ids: JSON.stringify(completedIds),
        mastered_ids: JSON.stringify(masteredIds),
        percentage,
        shuffle: row ? (row.shuffle || 0) : 0,
        batch_size: row ? (row.batch_size || 5) : 5
      });
    }
  } catch (err) {
    console.error('Failed to sync user_progress from evaluation:', err);
  }
}

// POST /api/eval - Evaluate user text answer using Gemini and persist to SQLite
router.post('/', async (req, res) => {
  try {
    const { questionId, topic, question, referenceAnswer, userAnswer, userGender } = req.body;

    if (!question || !referenceAnswer || !userAnswer) {
      return res.status(400).json({ error: 'Missing required parameters: question, referenceAnswer, userAnswer' });
    }

    const evaluation = await evaluateAnswerWithGemini(question, referenceAnswer, userAnswer, userGender || 'female');

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

      // Synchronize user_progress
      syncProgressForEvaluation(questionId, topic, evaluation.score, evaluation.isPassed);

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
    const numScore = Math.round(Number(score));
    const passedBool = isPassed !== undefined ? !!isPassed : numScore >= 70;

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
      score: numScore,
      is_passed: passedBool ? 1 : 0,
      positive_points: JSON.stringify(positivePoints),
      missing_points: JSON.stringify(missingPoints),
      feedback,
      user_answer: userAnswer,
      transcript: transcript || '',
      audio_metrics: audioMetrics ? JSON.stringify(audioMetrics) : null
    });

    // Synchronize user_progress
    syncProgressForEvaluation(questionId, topic, numScore, passedBool);

    res.json({
      success: true,
      id: evalId,
      score: numScore,
      isPassed: passedBool,
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
        GROUP BY question_id
      ) latest ON qe.question_id = latest.question_id AND qe.created_at = latest.max_created
      WHERE qe.topic = ? OR qe.topic = ?
    `);

    const rows = stmt.all(dbTopicName, topicId) as any[];

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
