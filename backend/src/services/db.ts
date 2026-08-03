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
`);

export function seedQuestionsFromJSON() {
  const jsonPath = path.join(__dirname, '../../../json/all_interview_questions.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('⚠️ JSON source file not found at:', jsonPath);
    return;
  }

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions');
  const result = countStmt.get() as { count: number };

  if (result.count === 0) {
    console.log('🌱 Seeding database with questions from JSON...');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const questions = JSON.parse(rawData);

    const insertStmt = db.prepare(`
      INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
      VALUES (@id, @global_id, @num, @topic, @question, @answer, @source_pages)
    `);

    const insertMany = db.transaction((qs: any[]) => {
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

    insertMany(questions);
    console.log(`✅ Database seeded with ${questions.length} questions!`);
  }
}
