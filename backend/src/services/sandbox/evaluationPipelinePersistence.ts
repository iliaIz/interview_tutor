import { db } from '../db';
import { CodingChallenge } from '../challengeSeedData';
import { EvaluationCodeFile } from './evaluationPipelineTypes';

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
  public static loadManifest(challengeId: string): CodingChallenge | undefined {
    try {
      const row = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ?').get(challengeId) as any;
      if (row?.manifest_json) {
        return JSON.parse(row.manifest_json);
      }
    } catch (err: any) {
      console.warn(`⚠️ Could not query manifest for challenge ${challengeId}:`, err?.message);
    }
    return undefined;
  }

  public static persistRecord(params: PersistSubmissionParams): void {
    try {
      const submissionId = `sub_${params.challengeId}_${params.userId}`;
      const upsertStmt = db.prepare(`
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

      upsertStmt.run({
        id: submissionId,
        challenge_id: params.challengeId,
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
    }
  }
}
