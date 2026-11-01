import { db } from '../db';
import { CodingChallenge } from '../challengeSeedData';
import { EvaluationCodeFile } from './evaluationPipelineTypes';
import { Statement } from 'better-sqlite3';

export interface PersistSubmissionParams {
  challengeId: string;
  userId: string;
  files: EvaluationCodeFile[];
  activePhase: number;
  status: string;
  score: number;
  evaluation: unknown;
  timeSpentSeconds: number;
}

/**
 * EvaluationPipelinePersistence.ts
 * Dedicated persistence and manifest-loader layer for ChallengeEvaluationPipeline.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8).
 */
export class EvaluationPipelinePersistence {
  private static loadStmt: Statement | null = null;
  private static resolveIdStmt: Statement | null = null;
  private static upsertStmt: Statement | null = null;

  public static loadManifest(challengeIdOrSlug: string): CodingChallenge | undefined {
    try {
      if (!this.loadStmt) {
        this.loadStmt = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?');
      }
      const row = this.loadStmt.get(challengeIdOrSlug, challengeIdOrSlug) as any;
      if (row?.manifest_json) {
        return JSON.parse(row.manifest_json);
      }
    } catch (err: any) {
      console.warn(`⚠️ Could not query manifest for challenge ${challengeIdOrSlug}:`, err?.message);
    }
    return undefined;
  }

  public static resolveCanonicalChallengeId(challengeIdOrSlug: string): string {
    try {
      if (!this.resolveIdStmt) {
        this.resolveIdStmt = db.prepare('SELECT id FROM coding_challenges WHERE id = ? OR slug = ?');
      }
      const row = this.resolveIdStmt.get(challengeIdOrSlug, challengeIdOrSlug) as any;
      if (row?.id) {
        return row.id;
      }
    } catch {}
    return challengeIdOrSlug;
  }

  public static persistRecord(params: PersistSubmissionParams): void {
    const canonicalChallengeId = this.resolveCanonicalChallengeId(params.challengeId);
    const submissionId = `sub_${canonicalChallengeId}_${params.userId}`;

    if (!this.upsertStmt) {
      this.upsertStmt = db.prepare(`
        INSERT INTO coding_submissions (
          id, challenge_id, user_id, files_json, active_phase, status, score,
          evaluation_json, time_spent_seconds, updated_at
        ) VALUES (
          @id, @challenge_id, @user_id, @files_json, @active_phase, @status, @score,
          @evaluation_json, @time_spent_seconds, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          files_json = excluded.files_json,
          active_phase = excluded.active_phase,
          status = excluded.status,
          score = excluded.score,
          evaluation_json = excluded.evaluation_json,
          time_spent_seconds = excluded.time_spent_seconds,
          updated_at = CURRENT_TIMESTAMP
      `);
    }

    try {
      this.upsertStmt.run({
        id: submissionId,
        challenge_id: canonicalChallengeId,
        user_id: params.userId,
        files_json: JSON.stringify(params.files),
        active_phase: params.activePhase,
        status: params.status,
        score: params.score,
        evaluation_json: JSON.stringify(params.evaluation),
        time_spent_seconds: params.timeSpentSeconds
      });
    } catch (err: any) {
      console.error('❌ EvaluationPipelinePersistence.persistRecord failed:', err?.message);
      throw err;
    }
  }
}
