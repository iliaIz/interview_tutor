import path from 'path';
import fs from 'fs';
import { db } from '../connection';

export function seedQuestionsFromJSON() {
  const possiblePaths = [
    path.join(process.cwd(), 'json/all_interview_questions.json'),
    path.join(__dirname, '../../../../../json/all_interview_questions.json'),
    path.join(__dirname, '../../../../json/all_interview_questions.json'),
    path.join(__dirname, '../../../json/all_interview_questions.json'),
    path.join(__dirname, '../../json/all_interview_questions.json'),
    '/json/all_interview_questions.json'
  ];

  const jsonPath = possiblePaths.find((p) => fs.existsSync(p));

  if (!jsonPath) {
    console.log('⚠️ JSON source file not found in paths:', possiblePaths);
    return;
  }

  console.log('🌱 Syncing database questions from JSON:', jsonPath);
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const questions = JSON.parse(rawData);

  const upsertStmt = db.prepare(`
    INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
    VALUES (@id, @global_id, @num, @topic, @question, @answer, @source_pages)
    ON CONFLICT(id) DO UPDATE SET
      global_id = excluded.global_id,
      num = excluded.num,
      topic = excluded.topic,
      question = excluded.question,
      answer = excluded.answer,
      source_pages = excluded.source_pages
  `);

  const syncAll = db.transaction((qs: any[]) => {
    for (const q of qs) {
      upsertStmt.run({
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
