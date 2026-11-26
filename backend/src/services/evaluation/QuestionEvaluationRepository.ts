import crypto from 'crypto';
import Database from 'better-sqlite3';
import { db } from '../db';
import { TOPIC_DEFINITIONS, TOPIC_MAP } from '../topics';

export interface RecordEvaluationParams {
  id?: string; userId?: string; questionId: string; topic: string; mode: 'text' | 'voice';
  score: number; isPassed: boolean; feedback?: string; positivePoints?: string[];
  missingPoints?: string[]; userAnswer?: string; transcript?: string;
  audioMetrics?: any; turnTelemetry?: any; speechCoaching?: any; audioPath?: string | null;
}

export interface TopicProgressSummary {
  topic: string; topicId: string; total: number; completedCount: number;
  masteredCount: number; percentage: number; completedIds: string[]; masteredIds: string[];
}

export interface LatestEvaluationRecord {
  id: string; questionId: string; topic: string; mode: string; score: number;
  isPassed: boolean; positivePoints: string[]; missingPoints: string[]; feedback: string;
  userAnswer: string; transcript: string | null; audioMetrics: any; turnTelemetry: any[];
  createdAt: string; updatedAt: string;
}

export interface TopicEvaluationSummary {
  questionId: string; score: number; isPassed: boolean; mode: string; createdAt: string;
  feedback: string; positivePoints: string[]; missingPoints: string[];
}

export function normalizeUserId(raw?: string): string {
  return raw?.trim() || 'default_user';
}

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export class QuestionEvaluationRepository {
  private readonly database: Database.Database;
  constructor(database: Database.Database = db) { this.database = database; }

  public static normalizeUserId(raw?: string): string { return normalizeUserId(raw); }

  public questionExists(questionId: string): boolean {
    if (!questionId) return false;
    try { return Boolean(this.database.prepare('SELECT 1 FROM questions WHERE id = ?').get(questionId)); }
    catch { return false; }
  }

  public resolveTopic(topicInput: string, questionId?: string): { dbTopicName: string; topicId: string } {
    const cleanInput = (topicInput || '').trim();
    const lower = cleanInput.toLowerCase();
    if (TOPIC_MAP[lower]) {
      const found = TOPIC_DEFINITIONS.find((t) => t.id.toLowerCase() === lower);
      return { dbTopicName: TOPIC_MAP[lower], topicId: found ? found.id : lower };
    }
    const byName = TOPIC_DEFINITIONS.find((t) => t.name.toLowerCase() === lower || t.id.toLowerCase() === lower);
    if (byName) return { dbTopicName: byName.name, topicId: byName.id };

    if (questionId) {
      try {
        const qRow = this.database.prepare('SELECT topic FROM questions WHERE id = ?').get(questionId) as { topic?: string } | undefined;
        if (qRow?.topic) {
          const byQTopic = TOPIC_DEFINITIONS.find((t) => t.name.toLowerCase() === qRow.topic!.toLowerCase());
          return { dbTopicName: qRow.topic, topicId: byQTopic ? byQTopic.id : qRow.topic.toLowerCase() };
        }
      } catch {}
    }
    return { dbTopicName: cleanInput || 'Spring Framework', topicId: lower || 'spring' };
  }

  public syncTopicProgressFromEvaluations(
    rawUserId: string | undefined,
    topicIdOrName: string,
    options: { persistIfChanged?: boolean; forceUpsert?: boolean; extraCompletedId?: string; extraMasteredId?: string } = {}
  ): TopicProgressSummary {
    const userId = normalizeUserId(rawUserId);
    const { dbTopicName, topicId } = this.resolveTopic(topicIdOrName);
    const progressRow = this.database.prepare(
      'SELECT completed_ids, mastered_ids, shuffle, batch_size FROM user_progress WHERE user_id = ? AND topic = ?'
    ).get(userId, dbTopicName) as any;

    const completedIds: string[] = safeParseJson<string[]>(progressRow?.completed_ids, []);
    const masteredIds: string[] = safeParseJson<string[]>(progressRow?.mastered_ids, []);
    let changed = false;

    try {
      const evalRows = this.database.prepare(`
        SELECT question_id, MAX(score) as max_score, MAX(is_passed) as any_passed
        FROM question_evaluations WHERE user_id = ? AND (topic = ? OR topic = ?) GROUP BY question_id
      `).all(userId, dbTopicName, topicId) as Array<{ question_id: string; max_score: number; any_passed: number }>;

      for (const e of evalRows) {
        if ((e.any_passed === 1 || e.max_score >= 70) && !completedIds.includes(e.question_id)) {
          completedIds.push(e.question_id);
          changed = true;
        }
        if (e.max_score >= 90 && !masteredIds.includes(e.question_id)) {
          masteredIds.push(e.question_id);
          changed = true;
        }
      }
    } catch {}

    if (options.extraCompletedId && !completedIds.includes(options.extraCompletedId)) {
      completedIds.push(options.extraCompletedId);
      changed = true;
    }
    if (options.extraMasteredId && !masteredIds.includes(options.extraMasteredId)) {
      masteredIds.push(options.extraMasteredId);
      changed = true;
    }

    const countRow = this.database.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?').get(dbTopicName) as { count?: number } | undefined;
    const total = countRow?.count ?? 0;
    const percentage = total > 0 ? Math.round((completedIds.length / total) * 100) : 0;

    if ((options.persistIfChanged && changed) || options.forceUpsert) {
      this.database.prepare(`
        INSERT INTO user_progress (user_id, topic, completed_ids, mastered_ids, percentage, shuffle, batch_size, updated_at)
        VALUES (@user_id, @topic, @completed_ids, @mastered_ids, @percentage, @shuffle, @batch_size, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, topic) DO UPDATE SET
          completed_ids = excluded.completed_ids, mastered_ids = excluded.mastered_ids,
          percentage = excluded.percentage, updated_at = CURRENT_TIMESTAMP
      `).run({
        user_id: userId, topic: dbTopicName,
        completed_ids: JSON.stringify(completedIds), mastered_ids: JSON.stringify(masteredIds),
        percentage, shuffle: progressRow ? (progressRow.shuffle || 0) : 0, batch_size: progressRow ? (progressRow.batch_size || 5) : 5
      });
    }

    return {
      topic: dbTopicName, topicId, total, completedCount: completedIds.length,
      masteredCount: masteredIds.length, percentage, completedIds, masteredIds
    };
  }

  public recordEvaluationAndSyncProgress(params: RecordEvaluationParams): {
    evalId: string; persisted: boolean; progress: TopicProgressSummary;
  } {
    const userId = normalizeUserId(params.userId);
    const evalId = params.id || crypto.randomBytes(16).toString('hex');
    const { dbTopicName, topicId } = this.resolveTopic(params.topic, params.questionId);

    if (params.questionId && !this.questionExists(params.questionId)) {
      console.warn(`⚠️ [QuestionEvaluationRepository] Question "${params.questionId}" not found in questions table. Skipping persistent evaluation.`);
      return {
        evalId, persisted: false,
        progress: {
          topic: dbTopicName, topicId, total: 1,
          completedCount: params.isPassed ? 1 : 0, masteredCount: params.score >= 90 ? 1 : 0,
          percentage: params.isPassed ? 100 : 0,
          completedIds: params.isPassed ? [params.questionId] : [],
          masteredIds: params.score >= 90 ? [params.questionId] : []
        }
      };
    }

    this.database.prepare(`
      INSERT INTO question_evaluations (
        id, user_id, question_id, topic, mode, score, is_passed, positive_points, missing_points,
        feedback, user_answer, transcript, audio_metrics, turn_telemetry, speech_coaching_json, audio_path, created_at, updated_at
      ) VALUES (
        @id, @user_id, @question_id, @topic, @mode, @score, @is_passed, @positive_points, @missing_points,
        @feedback, @user_answer, @transcript, @audio_metrics, @turn_telemetry, @speech_coaching_json, @audio_path, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run({
      id: evalId, user_id: userId, question_id: params.questionId, topic: dbTopicName,
      mode: params.mode || 'text', score: params.score, is_passed: params.isPassed ? 1 : 0,
      positive_points: JSON.stringify(params.positivePoints || []),
      missing_points: JSON.stringify(params.missingPoints || []),
      feedback: params.feedback || '', user_answer: params.userAnswer || '',
      transcript: params.transcript || null,
      audio_metrics: params.audioMetrics ? JSON.stringify(params.audioMetrics) : null,
      turn_telemetry: params.turnTelemetry ? JSON.stringify(params.turnTelemetry) : null,
      speech_coaching_json: params.speechCoaching ? JSON.stringify(params.speechCoaching) : null,
      audio_path: params.audioPath || null
    });

    const progress = this.syncTopicProgressFromEvaluations(userId, dbTopicName, {
      forceUpsert: true,
      extraCompletedId: (params.isPassed || params.score >= 70) ? params.questionId : undefined,
      extraMasteredId: params.score >= 90 ? params.questionId : undefined
    });
    return { evalId, persisted: true, progress };
  }

  public getLatestEvaluation(questionId: string, rawUserId?: string): LatestEvaluationRecord | null {
    const userId = normalizeUserId(rawUserId);
    const row = this.database.prepare(`
      SELECT * FROM question_evaluations WHERE question_id = ? AND user_id = ?
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(questionId, userId) as any;
    if (!row) return null;

    return {
      id: row.id, questionId: row.question_id, topic: row.topic, mode: row.mode,
      score: row.score, isPassed: Boolean(row.is_passed),
      positivePoints: safeParseJson<string[]>(row.positive_points, []),
      missingPoints: safeParseJson<string[]>(row.missing_points, []),
      feedback: row.feedback, userAnswer: row.user_answer, transcript: row.transcript,
      audioMetrics: safeParseJson<any>(row.audio_metrics, null),
      turnTelemetry: safeParseJson<any[]>(row.turn_telemetry, []),
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  public getTopicSummaries(rawTopicId: string, rawUserId?: string): TopicEvaluationSummary[] {
    const userId = normalizeUserId(rawUserId);
    const topicId = rawTopicId.toLowerCase();
    const dbTopicName = TOPIC_MAP[topicId] || topicId;

    const rows = this.database.prepare(`
      SELECT question_id as questionId, score, is_passed as isPassed, mode, created_at as createdAt,
             feedback, positive_points as positivePoints, missing_points as missingPoints
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY created_at DESC, rowid DESC) as rn
        FROM question_evaluations WHERE user_id = ? AND (topic = ? OR topic = ?)
      ) WHERE rn = 1
    `).all(userId, dbTopicName, topicId) as any[];

    return rows.map((r) => ({
      questionId: r.questionId, score: r.score, isPassed: Boolean(r.isPassed), mode: r.mode,
      createdAt: r.createdAt, feedback: r.feedback,
      positivePoints: safeParseJson<string[]>(r.positivePoints, []),
      missingPoints: safeParseJson<string[]>(r.missingPoints, [])
    }));
  }

  public updateEvaluationAudioPath(questionId: string, rawUserId: string | undefined, audioPath: string | null): number {
    if (!questionId || !audioPath) return 0;
    const userId = normalizeUserId(rawUserId);
    return this.database.prepare(`
      UPDATE question_evaluations SET audio_path = @audioPath, updated_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id FROM question_evaluations WHERE question_id = @questionId AND user_id = @userId
        ORDER BY created_at DESC, rowid DESC LIMIT 1
      )
    `).run({ audioPath, questionId, userId }).changes;
  }

  public recordSystemDesignDefenseLedgerIfMatched(
    questionId: string, rawUserId: string | undefined, evalId: string, score: number, artifacts?: Record<string, unknown>
  ): string | null {
    if (!questionId) return null;
    const userId = normalizeUserId(rawUserId);
    try {
      const aliasRow = this.database.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(questionId) as { canonical_id: string } | undefined;
      const canonicalId = aliasRow ? aliasRow.canonical_id : questionId;
      const manifestRow = this.database.prepare('SELECT canonical_id FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as { canonical_id: string } | undefined;
      if (!manifestRow) return null;

      const ledgerId = `prog_live_${canonicalId}_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const isPassed = typeof artifacts?.isPassed === 'boolean' ? artifacts.isPassed : score >= 70;
      this.database.prepare(`
        INSERT INTO user_progress_ledger (id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at)
        VALUES (?, ?, ?, 'STUDIO_3_DEFENSE', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(ledgerId, userId, canonicalId, isPassed ? 'PASSED' : 'FAILED', score, JSON.stringify({ savedEvalId: evalId, ...(artifacts || {}) }));
      return ledgerId;
    } catch { return null; }
  }

  public resetTopicProgress(rawUserId: string | undefined, topicIdOrName: string): { success: boolean; topic: string } {
    const userId = normalizeUserId(rawUserId);
    const { dbTopicName, topicId } = this.resolveTopic(topicIdOrName);
    this.database.prepare(`
      UPDATE user_progress SET completed_ids = '[]', mastered_ids = '[]', review_ids = '[]',
        last_question_id = NULL, percentage = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND topic = ?
    `).run(userId, dbTopicName);
    try {
      this.database.prepare('DELETE FROM question_evaluations WHERE user_id = ? AND (topic = ? OR topic = ?)').run(userId, dbTopicName, topicId);
    } catch {}
    return { success: true, topic: dbTopicName };
  }
}

export const questionEvaluationRepository = new QuestionEvaluationRepository();
