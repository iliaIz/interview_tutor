import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/interview.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    global_id INTEGER,
    num INTEGER,
    topic TEXT,
    question TEXT,
    answer TEXT,
    source_pages TEXT
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    topic TEXT PRIMARY KEY,
    completed_ids TEXT,
    last_question_id TEXT,
    mastered_ids TEXT,
    review_ids TEXT,
    shuffle INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS podcast_jobs (
    job_id TEXT PRIMARY KEY,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    audio_url TEXT,
    transcript TEXT,
    metadata TEXT,
    error TEXT,
    audio_path TEXT
  );

  CREATE TABLE IF NOT EXISTS question_evaluations (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    is_passed BOOLEAN NOT NULL,
    positive_points TEXT,
    missing_points TEXT,
    feedback TEXT,
    user_answer TEXT,
    transcript TEXT,
    audio_metrics TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_eval_question ON question_evaluations(question_id);
  CREATE INDEX IF NOT EXISTS idx_eval_topic ON question_evaluations(topic);
`);

export function recoverOrphanedJobs() {
  try {
    const info = db.prepare(`
      UPDATE podcast_jobs
      SET status = 'FAILED',
          error = 'Процесс генерации прерван перезапуском сервера'
      WHERE status IN ('PROCESSING', 'QUEUED')
    `).run();
    if (info.changes > 0) {
      console.log(`🧹 Recovered ${info.changes} orphaned podcast jobs marked as FAILED`);
    }
  } catch (err) {
    console.error('Error recovering orphaned jobs:', err);
  }
}

export function seedQuestionsFromJSON() {
  const possiblePaths = [
    '/json/all_interview_questions.json',
    path.join(__dirname, '../../../json/all_interview_questions.json'),
    path.join(__dirname, '../../json/all_interview_questions.json'),
    path.join(process.cwd(), 'json/all_interview_questions.json')
  ];

  let jsonPath = possiblePaths.find(p => fs.existsSync(p));

  if (!jsonPath) {
    console.log('⚠️ JSON source file not found in paths:', possiblePaths);
    return;
  }

  console.log('🌱 Syncing database questions from JSON:', jsonPath);
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const questions = JSON.parse(rawData);

  // Clean old questions and insert fresh questions from JSON in a single transaction
  const deleteOldStmt = db.prepare('DELETE FROM questions');
  const insertStmt = db.prepare(`
    INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
    VALUES (@id, @global_id, @num, @topic, @question, @answer, @source_pages)
  `);

  const syncAll = db.transaction((qs: any[]) => {
    deleteOldStmt.run();
    for (const q of qs) {
      insertStmt.run({
        id: q.id,
        global_id: q.global_id,
        num: q.num,
        topic: q.topic,
        question: q.question,
        answer: q.answer,
        source_pages: JSON.stringify(q.source_pages || [])
      });
    }
  });

  syncAll(questions);
  console.log(`✅ Database synced with ${questions.length} questions from enhorse/java-interview!`);
}
