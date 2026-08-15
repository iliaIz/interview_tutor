import { Router } from 'express';
import { db } from '../services/db';
import { TOPIC_DEFINITIONS, TOPIC_MAP } from '../services/topics';

const router = Router();

// GET /api/topics - List all topics with progress summary and category grouping
router.get('/', (req, res) => {
  const progressStmt = db.prepare('SELECT * FROM user_progress WHERE topic = ?');
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?');

  const result = TOPIC_DEFINITIONS.map(t => {
    const dbTopicName = t.name;
    const row = progressStmt.get(dbTopicName) as any;
    const countRow = countStmt.get(dbTopicName) as any;
    const total = countRow ? countRow.count : 0;
    
    let completedIds: string[] = [];
    let masteredIds: string[] = [];
    let shuffle = false;
    let batchSize = 5;

    if (row) {
      completedIds = JSON.parse(row.completed_ids || '[]');
      masteredIds = JSON.parse(row.mastered_ids || '[]');
      shuffle = Boolean(row.shuffle);
      batchSize = row.batch_size || 5;
    }

    const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

    return {
      ...t,
      total,
      completedCount: completedIds.length,
      masteredCount: masteredIds.length,
      percentage,
      shuffle,
      batchSize
    };
  });

  res.json(result);
});

// GET /api/topics/:topicId/batch?size=5&shuffle=true
router.get('/:topicId/batch', (req, res) => {
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];

  if (!dbTopicName) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const size = parseInt(req.query.size as string) || 5;
  const shuffleParam = req.query.shuffle === 'true';

  // Get user progress
  const progressStmt = db.prepare('SELECT * FROM user_progress WHERE topic = ?');
  const progressRow = progressStmt.get(dbTopicName) as any;

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

// POST /api/topics/:topicId/progress - Save progress
router.post('/:topicId/progress', (req, res) => {
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];
  if (!dbTopicName) return res.status(404).json({ error: 'Topic not found' });

  const { completedIds = [], masteredIds = [], reviewIds = [], lastQuestionId, shuffle = false, batchSize = 5 } = req.body;

  const stmt = db.prepare(`
    INSERT INTO user_progress (topic, completed_ids, mastered_ids, review_ids, last_question_id, shuffle, batch_size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(topic) DO UPDATE SET
      completed_ids = excluded.completed_ids,
      mastered_ids = excluded.mastered_ids,
      review_ids = excluded.review_ids,
      last_question_id = excluded.last_question_id,
      shuffle = excluded.shuffle,
      batch_size = excluded.batch_size,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    dbTopicName,
    JSON.stringify(completedIds),
    JSON.stringify(masteredIds),
    JSON.stringify(reviewIds),
    lastQuestionId || null,
    shuffle ? 1 : 0,
    batchSize
  );

  res.json({ success: true, topic: dbTopicName });
});

// GET /api/topics/:topicId/questions - Get all questions for a specific topic with user status
router.get('/:topicId/questions', (req, res) => {
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];

  if (!dbTopicName) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  // Get user progress
  const progressStmt = db.prepare('SELECT * FROM user_progress WHERE topic = ?');
  const progressRow = progressStmt.get(dbTopicName) as any;

  const completedIds: string[] = progressRow ? JSON.parse(progressRow.completed_ids || '[]') : [];
  const masteredIds: string[] = progressRow ? JSON.parse(progressRow.mastered_ids || '[]') : [];
  const completedSet = new Set(completedIds);
  const masteredSet = new Set(masteredIds);

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
    completedCount: completedIds.length,
    masteredCount: masteredIds.length,
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

  // Map to retain requested order
  const rowMap = new Map(rows.map(r => [r.id, r]));
  const ordered = ids
    .map(id => rowMap.get(id))
    .filter(Boolean)
    .map(q => ({
      ...q,
      source_pages: JSON.parse(q.source_pages || '[]')
    }));

  res.json({ questions: ordered });
});

// POST /api/topics/:topicId/reset - Reset progress ("Сначала")
router.post('/:topicId/reset', (req, res) => {
  const topicId = req.params.topicId.toLowerCase();
  const dbTopicName = TOPIC_MAP[topicId];
  if (!dbTopicName) return res.status(404).json({ error: 'Topic not found' });

  const stmt = db.prepare(`
    INSERT INTO user_progress (topic, completed_ids, mastered_ids, review_ids, last_question_id, updated_at)
    VALUES (?, '[]', '[]', '[]', NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(topic) DO UPDATE SET
      completed_ids = '[]',
      mastered_ids = '[]',
      review_ids = '[]',
      last_question_id = NULL,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(dbTopicName);

  res.json({ success: true, message: `Progress for ${dbTopicName} reset to 0%` });
});

export default router;
