import crypto from 'crypto';
import { db } from './db';
import { TOPIC_DEFINITIONS, TOPIC_MAP } from './topics';
import { updateFsrsCardState } from './fsrsEngine';

export interface RecordEvaluationParams {
  id?: string;
  userId?: string;
  questionId: string;
  topic: string;
  mode: 'text' | 'voice';
  score: number;
  isPassed: boolean;
  feedback?: string;
  positivePoints?: string[];
  missingPoints?: string[];
  userAnswer?: string;
  transcript?: string;
  audioMetrics?: any;
  turnTelemetry?: any;
  speechCoaching?: any;
  audioPath?: string;
}

export interface TopicProgressSummary {
  topic: string;
  topicId: string;
  total: number;
  completedCount: number;
  masteredCount: number;
  percentage: number;
  completedIds: string[];
  masteredIds: string[];
}

/**
 * Resolves any topic input (slug, id, name, lowercase) to the exact database topic name and slug
 */
export function resolveTopic(topicInput: string, questionId?: string): { dbTopicName: string; topicId: string } {
  const cleanInput = (topicInput || '').trim();
  const lower = cleanInput.toLowerCase();

  // 1. Direct slug lookup
  if (TOPIC_MAP[lower]) {
    const found = TOPIC_DEFINITIONS.find(t => t.id.toLowerCase() === lower);
    return { dbTopicName: TOPIC_MAP[lower], topicId: found ? found.id : lower };
  }

  // 2. Direct name lookup
  const byName = TOPIC_DEFINITIONS.find(
    t => t.name.toLowerCase() === lower || t.id.toLowerCase() === lower
  );
  if (byName) {
    return { dbTopicName: byName.name, topicId: byName.id };
  }

  // 3. Fallback: Lookup question topic in questions table
  if (questionId) {
    try {
      const qRow = db.prepare('SELECT topic FROM questions WHERE id = ?').get(questionId) as any;
      if (qRow?.topic) {
        const byQTopic = TOPIC_DEFINITIONS.find(t => t.name.toLowerCase() === qRow.topic.toLowerCase());
        return {
          dbTopicName: qRow.topic,
          topicId: byQTopic ? byQTopic.id : qRow.topic.toLowerCase()
        };
      }
    } catch {}
  }

  // Default fallback
  return { dbTopicName: cleanInput || 'Spring Framework', topicId: lower || 'spring' };
}

/**
 * Records a question evaluation and atomically synchronizes user_progress in SQLite
 */
export function recordEvaluationAndSyncProgress(params: RecordEvaluationParams): {
  evalId: string;
  progress: TopicProgressSummary;
} {
  const userId = params.userId || 'default_user';
  const evalId = params.id || crypto.randomBytes(16).toString('hex');
  const { dbTopicName, topicId } = resolveTopic(params.topic, params.questionId);

  // 1. Persist to question_evaluations
  const insertEvalStmt = db.prepare(`
    INSERT INTO question_evaluations (
      id, user_id, question_id, topic, mode, score, is_passed,
      positive_points, missing_points, feedback, user_answer,
      transcript, audio_metrics, turn_telemetry, speech_coaching_json, audio_path, created_at, updated_at
    ) VALUES (
      @id, @user_id, @question_id, @topic, @mode, @score, @is_passed,
      @positive_points, @missing_points, @feedback, @user_answer,
      @transcript, @audio_metrics, @turn_telemetry, @speech_coaching_json, @audio_path, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  insertEvalStmt.run({
    id: evalId,
    user_id: userId,
    question_id: params.questionId,
    topic: dbTopicName,
    mode: params.mode || 'text',
    score: params.score,
    is_passed: params.isPassed ? 1 : 0,
    positive_points: JSON.stringify(params.positivePoints || []),
    missing_points: JSON.stringify(params.missingPoints || []),
    feedback: params.feedback || '',
    user_answer: params.userAnswer || '',
    transcript: params.transcript || null,
    audio_metrics: params.audioMetrics ? JSON.stringify(params.audioMetrics) : null,
    turn_telemetry: params.turnTelemetry ? JSON.stringify(params.turnTelemetry) : null,
    speech_coaching_json: params.speechCoaching ? JSON.stringify(params.speechCoaching) : null,
    audio_path: params.audioPath || null
  });

  // 1.1 Update FSRS-5 memory state asynchronously
  void updateFsrsCardState({
    userId,
    questionId: params.questionId,
    score: params.score,
    isPassed: params.isPassed
  }).catch((err) => console.warn('FSRS state update warning:', err));

  // 2. Fetch existing user_progress
  const progressRow = db.prepare(
    'SELECT * FROM user_progress WHERE user_id = ? AND topic = ?'
  ).get(userId, dbTopicName) as any;

  let completedIds: string[] = progressRow ? JSON.parse(progressRow.completed_ids || '[]') : [];
  let masteredIds: string[] = progressRow ? JSON.parse(progressRow.mastered_ids || '[]') : [];

  // 3. Self-healing merge with all user's evaluations for this topic
  const evalStmt = db.prepare(`
    SELECT question_id, MAX(score) as max_score, MAX(is_passed) as any_passed
    FROM question_evaluations
    WHERE (user_id = ? OR user_id = 'default_user') AND (topic = ? OR topic = ?)
    GROUP BY question_id
  `);

  try {
    const evalRows = evalStmt.all(userId, dbTopicName, topicId) as any[];
    evalRows.forEach(e => {
      const isPassed = e.any_passed === 1 || e.max_score >= 70;
      const isMastered = e.max_score >= 90;

      if (isPassed && !completedIds.includes(e.question_id)) {
        completedIds.push(e.question_id);
      }
      if (isMastered && !masteredIds.includes(e.question_id)) {
        masteredIds.push(e.question_id);
      }
    });
  } catch {}

  // Current answer passed check
  if (params.isPassed || params.score >= 70) {
    if (!completedIds.includes(params.questionId)) {
      completedIds.push(params.questionId);
    }
  }
  if (params.score >= 90) {
    if (!masteredIds.includes(params.questionId)) {
      masteredIds.push(params.questionId);
    }
  }

  // 4. Calculate actual percentage from database questions count
  const countRow = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?').get(dbTopicName) as any;
  const total = countRow ? countRow.count : 27;
  const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

  // 5. Atomic Upsert into user_progress with composite primary key (user_id, topic)
  const upsertStmt = db.prepare(`
    INSERT INTO user_progress (
      user_id, topic, completed_ids, mastered_ids, percentage, shuffle, batch_size, updated_at
    ) VALUES (
      @user_id, @topic, @completed_ids, @mastered_ids, @percentage, @shuffle, @batch_size, CURRENT_TIMESTAMP
    ) ON CONFLICT(user_id, topic) DO UPDATE SET
      completed_ids = excluded.completed_ids,
      mastered_ids = excluded.mastered_ids,
      percentage = excluded.percentage,
      updated_at = CURRENT_TIMESTAMP
  `);

  upsertStmt.run({
    user_id: userId,
    topic: dbTopicName,
    completed_ids: JSON.stringify(completedIds),
    mastered_ids: JSON.stringify(masteredIds),
    percentage,
    shuffle: progressRow ? (progressRow.shuffle || 0) : 0,
    batch_size: progressRow ? (progressRow.batch_size || 5) : 5
  });

  return {
    evalId,
    progress: {
      topic: dbTopicName,
      topicId,
      total,
      completedCount: completedIds.length,
      masteredCount: masteredIds.length,
      percentage,
      completedIds,
      masteredIds
    }
  };
}

/**
 * Calculates current progress summary for a given topic and user
 */
export function getTopicProgress(userId: string, topicIdOrName: string): TopicProgressSummary {
  const { dbTopicName, topicId } = resolveTopic(topicIdOrName);
  const countRow = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?').get(dbTopicName) as any;
  const total = countRow ? countRow.count : 0;

  const progressRow = db.prepare(
    'SELECT * FROM user_progress WHERE user_id = ? AND topic = ?'
  ).get(userId, dbTopicName) as any;

  let completedIds: string[] = progressRow ? JSON.parse(progressRow.completed_ids || '[]') : [];
  let masteredIds: string[] = progressRow ? JSON.parse(progressRow.mastered_ids || '[]') : [];

  // Self-healing merge with question_evaluations
  try {
    const evalStmt = db.prepare(`
      SELECT question_id, MAX(score) as max_score, MAX(is_passed) as any_passed
      FROM question_evaluations
      WHERE (user_id = ? OR user_id = 'default_user') AND (topic = ? OR topic = ?)
      GROUP BY question_id
    `);
    const evalRows = evalStmt.all(userId, dbTopicName, topicId) as any[];
    evalRows.forEach(e => {
      const isPassed = e.any_passed === 1 || e.max_score >= 70;
      const isMastered = e.max_score >= 90;

      if (isPassed && !completedIds.includes(e.question_id)) {
        completedIds.push(e.question_id);
      }
      if (isMastered && !masteredIds.includes(e.question_id)) {
        masteredIds.push(e.question_id);
      }
    });
  } catch {}

  const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

  return {
    topic: dbTopicName,
    topicId,
    total,
    completedCount: completedIds.length,
    masteredCount: masteredIds.length,
    percentage,
    completedIds,
    masteredIds
  };
}

/**
 * Resets user progress and evaluations for a topic
 */
export function resetTopicProgress(userId: string, topicIdOrName: string): { success: boolean; topic: string } {
  const { dbTopicName, topicId } = resolveTopic(topicIdOrName);

  // 1. Reset user_progress
  db.prepare(`
    UPDATE user_progress
    SET completed_ids = '[]',
        mastered_ids = '[]',
        review_ids = '[]',
        last_question_id = NULL,
        percentage = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND topic = ?
  `).run(userId, dbTopicName);

  // 2. Clean up evaluations for this user and topic so they do not resurrect
  try {
    db.prepare(`
      DELETE FROM question_evaluations
      WHERE user_id = ? AND (topic = ? OR topic = ?)
    `).run(userId, dbTopicName, topicId);
  } catch {}

  return { success: true, topic: dbTopicName };
}
