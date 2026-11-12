import { db } from './db';
import { BugChallenge } from './bugChallengeTypes';

/**
 * Saves or updates a bug challenge record in SQLite database
 */
export function saveBugChallengeToDb(challenge: BugChallenge, topicId: string, topicName: string, preset: string, difficulty: string): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO bug_challenges (
        id, topic_id, topic_name, preset, difficulty, category_badge,
        title, subtopic, language, code_snippet, bug_explanation, fixed_code,
        hints_json, is_solved, last_score, last_feedback, key_takeaways_json,
        tech_stack_json, production_context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        is_solved = COALESCE(excluded.is_solved, bug_challenges.is_solved),
        last_score = COALESCE(excluded.last_score, bug_challenges.last_score),
        last_feedback = COALESCE(excluded.last_feedback, bug_challenges.last_feedback),
        key_takeaways_json = COALESCE(excluded.key_takeaways_json, bug_challenges.key_takeaways_json),
        tech_stack_json = COALESCE(excluded.tech_stack_json, bug_challenges.tech_stack_json),
        production_context_json = COALESCE(excluded.production_context_json, bug_challenges.production_context_json),
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      challenge.id,
      topicId,
      topicName,
      preset,
      difficulty,
      challenge.categoryBadge || '⚡ Concurrency',
      challenge.title,
      challenge.subtopic,
      challenge.language || 'java',
      challenge.codeSnippet,
      challenge.bugExplanation,
      challenge.fixedCode,
      JSON.stringify(challenge.hints || []),
      challenge.isSolved ? 1 : 0,
      challenge.lastScore || null,
      challenge.lastFeedback || null,
      challenge.keyTakeaways ? JSON.stringify(challenge.keyTakeaways) : null,
      challenge.techStack ? JSON.stringify(challenge.techStack) : null,
      challenge.productionContext ? JSON.stringify(challenge.productionContext) : null
    );
  } catch (err) {
    console.error('Error saving bug challenge to SQLite:', err);
  }
}

/**
 * Fetches saved challenges from SQLite for zero-latency, zero-cost problem bank replay
 */
export function getSavedBugChallenges(topicId?: string, filter: 'all' | 'unsolved' | 'solved' = 'all'): BugChallenge[] {
  try {
    let query = 'SELECT * FROM bug_challenges';
    const conditions: string[] = [];
    const params: any[] = [];

    if (topicId) {
      conditions.push('(topic_id = ? OR topic_name = ?)');
      params.push(topicId, topicId);
    }

    if (filter === 'unsolved') {
      conditions.push('(is_solved = 0 OR is_solved IS NULL)');
    } else if (filter === 'solved') {
      conditions.push('is_solved = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      topicName: r.topic_name,
      title: r.title,
      subtopic: r.subtopic,
      language: r.language || 'java',
      codeSnippet: r.code_snippet,
      bugExplanation: r.bug_explanation,
      fixedCode: r.fixed_code,
      hints: r.hints_json ? JSON.parse(r.hints_json) : [],
      categoryBadge: r.category_badge,
      difficultyBadge: r.difficulty || 'Middle',
      isSolved: Boolean(r.is_solved),
      lastScore: r.last_score || undefined,
      lastFeedback: r.last_feedback || undefined,
      keyTakeaways: r.key_takeaways_json ? JSON.parse(r.key_takeaways_json) : undefined,
      techStack: r.tech_stack_json ? JSON.parse(r.tech_stack_json) : undefined,
      productionContext: r.production_context_json ? JSON.parse(r.production_context_json) : undefined,
      createdAt: r.created_at
    }));
  } catch (err) {
    console.error('Error fetching saved bug challenges:', err);
    return [];
  }
}

/**
 * Updates evaluation result and status for a bug challenge
 */
export function updateBugChallengeStatus(params: {
  challengeId: string;
  isSolved: boolean;
  score?: number;
  feedback?: string;
  keyTakeaways?: string[];
}): boolean {
  try {
    const stmt = db.prepare(`
      UPDATE bug_challenges
      SET is_solved = ?,
          last_score = COALESCE(?, last_score),
          last_feedback = COALESCE(?, last_feedback),
          key_takeaways_json = COALESCE(?, key_takeaways_json),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const res = stmt.run(
      params.isSolved ? 1 : 0,
      params.score ?? null,
      params.feedback ?? null,
      params.keyTakeaways ? JSON.stringify(params.keyTakeaways) : null,
      params.challengeId
    );
    return res.changes > 0;
  } catch (err) {
    console.error('Error updating bug challenge status:', err);
    return false;
  }
}
