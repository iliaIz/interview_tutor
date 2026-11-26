import { Router } from 'express';
import { db } from '../services/db';
import { TOPIC_DEFINITIONS, TOPIC_MAP } from '../services/topics';
import { getAuthUserId } from '../middleware/auth';
import { getTopicProgress, resetTopicProgress } from '../services/progressService';
import { questionEvaluationRepository } from '../services/evaluation/QuestionEvaluationRepository';

const router = Router();

// GET /api/topics - List all topics with authoritative progress summary for authenticated user
router.get('/', (req, res) => {
  const userId = getAuthUserId(req);

  const result = TOPIC_DEFINITIONS.map(t => {
    const progress = getTopicProgress(userId, t.id);

    // Retrieve topic-specific preferences (shuffle, batch_size)
    let shuffle = false;
    let batchSize = 5;
    try {
      const row = db.prepare('SELECT shuffle, batch_size FROM user_progress WHERE user_id = ? AND topic = ?').get(userId, progress.topic) as any;
      if (row) {
        shuffle = Boolean(row.shuffle);
        batchSize = row.batch_size || 5;
      }
    } catch {}

    return {
      ...t,
      total: progress.total,
      completedCount: progress.completedCount,
      masteredCount: progress.masteredCount,
      percentage: progress.percentage,
      completedIds: progress.completedIds,
      masteredIds: progress.masteredIds,
      shuffle,
      batchSize
    };
  });

  res.json(result);
});

// GET /api/topics/:topicId/batch?size=5&shuffle=true
router.get('/:topicId/batch', (req, res) => {
  const userId = getAuthUserId(req);
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];

  if (!dbTopicName) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const size = parseInt(req.query.size as string) || 5;
  const shuffleParam = req.query.shuffle === 'true';

  // Get user progress
  const progressStmt = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND topic = ?');
  const progressRow = progressStmt.get(userId, dbTopicName) as any;

  let completedIds: string[] = progressRow ? JSON.parse(progressRow.completed_ids || '[]') : [];

  let qStmt;
  if (shuffleParam) {
    qStmt = db.prepare('SELECT * FROM questions WHERE topic = ? ORDER BY RANDOM() LIMIT ?');
  } else {
    qStmt = db.prepare('SELECT * FROM questions WHERE topic = ? ORDER BY num ASC LIMIT ? OFFSET ?');
  }

  const questions = shuffleParam
    ? qStmt.all(dbTopicName, size)
    : qStmt.all(dbTopicName, size, completedIds.length);

  const formatted = (questions as any[]).map(q => ({
    ...q,
    source_pages: JSON.parse(q.source_pages || '[]')
  }));

  res.json({
    topic: dbTopicName,
    topicId,
    batchSize: formatted.length,
    offset: completedIds.length,
    questions: formatted
  });
});

// POST /api/topics/:topicId/progress - Save progress for authenticated user
router.post('/:topicId/progress', (req, res) => {
  const userId = getAuthUserId(req);
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];
  if (!dbTopicName) return res.status(404).json({ error: 'Topic not found' });

  const { completedIds = [], masteredIds = [], reviewIds = [], lastQuestionId, shuffle = false, batchSize = 5 } = req.body;

  const countRow = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?').get(dbTopicName) as any;
  const total = countRow ? countRow.count : 100;
  const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

  const stmt = db.prepare(`
    INSERT INTO user_progress (user_id, topic, completed_ids, mastered_ids, review_ids, last_question_id, percentage, shuffle, batch_size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, topic) DO UPDATE SET
      completed_ids = excluded.completed_ids,
      mastered_ids = excluded.mastered_ids,
      review_ids = excluded.review_ids,
      last_question_id = excluded.last_question_id,
      percentage = excluded.percentage,
      shuffle = excluded.shuffle,
      batch_size = excluded.batch_size,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    userId,
    dbTopicName,
    JSON.stringify(completedIds),
    JSON.stringify(masteredIds),
    JSON.stringify(reviewIds),
    lastQuestionId || null,
    percentage,
    shuffle ? 1 : 0,
    batchSize
  );

  res.json({ success: true, topic: dbTopicName });
});

// GET /api/topics/:topicId/questions - Get all questions for a specific topic with user status
router.get('/:topicId/questions', (req, res) => {
  const userId = getAuthUserId(req);
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];

  if (!dbTopicName) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  // Self-healing merge with question_evaluations via unified repository
  const progress = questionEvaluationRepository.syncTopicProgressFromEvaluations(userId, topicId, {
    persistIfChanged: true
  });

  const completedSet = new Set(progress.completedIds);
  const masteredSet = new Set(progress.masteredIds);

  const qStmt = db.prepare('SELECT * FROM questions WHERE topic = ? ORDER BY num ASC');
  const questions = qStmt.all(dbTopicName) as any[];

  const formatted = questions.map(q => ({
    ...q,
    source_pages: JSON.parse(q.source_pages || '[]'),
    isCompleted: completedSet.has(q.id),
    isMastered: masteredSet.has(q.id)
  }));

  const meta = TOPIC_DEFINITIONS.find(t => t.id === topicId);

  res.json({
    topicId,
    topicName: dbTopicName,
    meta,
    total: formatted.length,
    completedCount: progress.completedCount,
    masteredCount: progress.masteredCount,
    questions: formatted
  });
});

// POST /api/topics/questions/by-ids - Fetch questions by specific IDs
router.post('/questions/by-ids', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required and must not be empty' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
  const rows = stmt.all(...ids) as any[];

  const formatted = rows.map(q => ({
    ...q,
    source_pages: JSON.parse(q.source_pages || '[]')
  }));

  res.json({ questions: formatted });
});

// POST /api/topics/:topicId/reset - Reset progress ("Сначала") for authenticated user
router.post('/:topicId/reset', (req, res) => {
  const userId = getAuthUserId(req);
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];
  if (!dbTopicName) return res.status(404).json({ error: 'Topic not found' });

  const result = resetTopicProgress(userId, topicId);
  res.json(result);
});

export default router;
