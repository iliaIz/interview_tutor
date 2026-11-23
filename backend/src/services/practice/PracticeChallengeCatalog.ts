/**
 * PracticeChallengeCatalog.ts
 * Deep domain repository for Coding Challenges, Submissions, Drafts, and Maven Scaffolding.
 * Encapsulates SQLite db.prepare queries and status resolution.
 * Cognitive Bounding SLA: <= 320 lines (Rule 8 compliant).
 */

import { db } from '../db';
import { CodingChallenge } from '../challengeSeedData';
import { EvaluationPipelinePersistence } from '../sandbox/evaluationPipelinePersistence';
import { buildChallengeZipPackage } from '../mavenScaffoldGenerator';
import { fetchSpringTransactionChallenges, fetchSpringTransactionManifest } from '../practiceTxCatalogService';

export interface ChallengeFilter {
  category?: string;
  track?: string;
}

export interface PracticeChallengeItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  track: string;
  badge: string;
  difficulty: string;
  targetStack: string;
  timeLimitMinutes: number;
  shortDescription: string;
  taskCode: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';
  lastScore?: number;
  lastStatus?: string;
  timeSpentSeconds: number;
  completedAt?: string;
  updated_at?: string;
}

export interface ChallengeWorkspaceDetails {
  challenge: CodingChallenge;
  savedDraft: any[] | null;
  activePhase: number;
  lastEvaluation: any | null;
  timeSpentSeconds: number;
  updatedAt: string;
}

export interface SaveDraftPayload {
  challengeId: string;
  files: Array<{ path: string; content: string }>;
  activePhase?: number;
  timeSpentSeconds?: number;
}

export class PracticeChallengeCatalog {
  /**
   * Lists coding challenges matching category and track filters with user submission statuses.
   */
  public static listChallenges(filter: ChallengeFilter, userId: string): PracticeChallengeItem[] {
    const { category, track } = filter;
    let query = 'SELECT id, slug, title, category, track, badge, difficulty, target_stack, time_limit_minutes, short_description, task_code, updated_at FROM coding_challenges';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (category && category !== 'all') {
      whereClauses.push('category = ?');
      params.push(category);
    }
    if (track && track !== 'all') {
      whereClauses.push('track = ?');
      params.push(track);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    query += ' ORDER BY task_code ASC, created_at ASC';

    const rows = db.prepare(query).all(...params) as any[];

    // Fetch submission status for the authenticated user
    const subStmt = db.prepare('SELECT challenge_id, status, score, files_json, time_spent_seconds, updated_at FROM coding_submissions WHERE user_id = ?');
    const submissions = subStmt.all(userId) as any[];
    const subMap = new Map(submissions.map((s) => [s.challenge_id, s]));

    const standardChallenges: PracticeChallengeItem[] = rows.map((r) => {
      const sub = subMap.get(r.id);
      const isCompleted = sub?.status === 'PASSED' || (sub?.score !== undefined && sub.score >= 70);
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED' = 'NOT_STARTED';

      if (isCompleted) {
        status = 'COMPLETED';
      } else if (sub?.status === 'FAILED' || (sub?.score !== undefined && sub.score < 70)) {
        status = 'FAILED';
      } else if (sub && (sub.files_json || (sub.time_spent_seconds && sub.time_spent_seconds > 0))) {
        status = 'IN_PROGRESS';
      }

      const rawDiff = r.difficulty || 'Middle';
      const difficulty = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();

      return {
        ...r,
        difficulty,
        taskCode: r.task_code || r.id,
        track: r.track || 'lld_bigtech',
        timeLimitMinutes: r.time_limit_minutes,
        targetStack: r.target_stack,
        shortDescription: r.short_description,
        isCompleted,
        status,
        lastScore: sub?.score,
        lastStatus: status,
        timeSpentSeconds: sub?.time_spent_seconds || 0,
        completedAt: isCompleted ? sub?.updated_at : undefined
      };
    });

    const txChallenges = (!category || category === 'all' || category === 'spring_transactions')
      ? fetchSpringTransactionChallenges(userId)
      : [];

    if (category === 'spring_transactions') {
      return txChallenges as PracticeChallengeItem[];
    }

    return [...standardChallenges, ...(txChallenges as PracticeChallengeItem[])];
  }

  /**
   * Retrieves full challenge manifest and active user draft.
   */
  public static getChallengeManifest(challengeIdOrSlug: string, userId: string): ChallengeWorkspaceDetails | null {
    const row = db.prepare('SELECT manifest_json, updated_at FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeIdOrSlug, challengeIdOrSlug) as any;

    if (!row) {
      const txData = fetchSpringTransactionManifest(challengeIdOrSlug, userId);
      return txData ? (txData as any) : null;
    }

    const manifest: CodingChallenge = JSON.parse(row.manifest_json);
    (manifest as any).updated_at = row.updated_at;

    const draftRow = db.prepare('SELECT files_json, active_phase, status, score, evaluation_json, time_spent_seconds FROM coding_submissions WHERE challenge_id = ? AND user_id = ?')
      .get(manifest.id, userId) as any;

    let draftFiles = null;
    let activePhase = 1;
    let lastEvaluation = null;
    let timeSpentSeconds = 0;

    if (draftRow) {
      try {
        draftFiles = JSON.parse(draftRow.files_json);
        activePhase = draftRow.active_phase || 1;
        timeSpentSeconds = draftRow.time_spent_seconds || 0;
        if (draftRow.evaluation_json) {
          lastEvaluation = JSON.parse(draftRow.evaluation_json);
        }
      } catch {}
    }

    return {
      challenge: manifest,
      savedDraft: draftFiles,
      activePhase,
      lastEvaluation,
      timeSpentSeconds,
      updatedAt: row.updated_at
    };
  }

  /**
   * Saves workspace draft files for a challenge, enforcing length and size invariants.
   */
  public static saveDraft(userId: string, payload: SaveDraftPayload): { success: boolean; savedAt: string } {
    const { challengeId, files, activePhase = 1, timeSpentSeconds = 0 } = payload;

    if (!challengeId || !Array.isArray(files)) {
      throw new Error('challengeId and files array are required');
    }
    if (files.length > 15) {
      throw new Error('Exceeded maximum allowable files limit (15 files max)');
    }
    for (const f of files) {
      if (typeof f.content === 'string' && f.content.length > 200_000) {
        throw new Error(`File ${f.path || 'unknown'} exceeds maximum allowable size (200KB max)`);
      }
    }

    const canonicalChallengeId = EvaluationPipelinePersistence.resolveCanonicalChallengeId(challengeId);
    const submissionId = `sub_${canonicalChallengeId}_${userId}`;
    const stmt = db.prepare(`
      INSERT INTO coding_submissions (
        id, challenge_id, user_id, files_json, active_phase, time_spent_seconds, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        files_json = excluded.files_json,
        active_phase = excluded.active_phase,
        time_spent_seconds = excluded.time_spent_seconds,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(submissionId, canonicalChallengeId, userId, JSON.stringify(files), activePhase, timeSpentSeconds);
    return { success: true, savedAt: new Date().toISOString() };
  }

  /**
   * Saves transaction lab scenario draft.
   */
  public static saveTransactionLabDraft(userId: string, scenarioId: string, userConfigs: any, threads: number = 1): { success: boolean; savedAt: string } {
    if (!scenarioId || !userConfigs) {
      throw new Error('scenarioId and userConfigs are required');
    }
    const submissionId = `tx_sub_${scenarioId}_${userId}`;
    const stmt = db.prepare(`
      INSERT INTO coding_submissions (
        id, challenge_id, user_id, files_json, active_phase, time_spent_seconds, updated_at
      ) VALUES (
        ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        files_json = excluded.files_json,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(submissionId, scenarioId, userId, JSON.stringify({ userConfigs, threads }));
    return { success: true, savedAt: new Date().toISOString() };
  }

  /**
   * Retrieves transaction lab draft.
   */
  public static getTransactionLabDraft(userId: string, scenarioId: string) {
    const submissionId = `tx_sub_${scenarioId}_${userId}`;
    const row = db.prepare('SELECT files_json, updated_at FROM coding_submissions WHERE id = ?').get(submissionId) as any;
    if (!row) {
      return null;
    }
    const data = JSON.parse(row.files_json);
    return {
      scenarioId,
      userConfigs: data.userConfigs || {},
      threads: data.threads || 1,
      updatedAt: row.updated_at
    };
  }

  /**
   * Resets a user's workspace draft.
   */
  public static resetWorkspace(userId: string, challengeId: string): void {
    const canonicalChallengeId = EvaluationPipelinePersistence.resolveCanonicalChallengeId(challengeId);
    const submissionId = `sub_${canonicalChallengeId}_${userId}`;
    db.prepare('DELETE FROM coding_submissions WHERE id = ? OR (challenge_id = ? AND user_id = ?)').run(submissionId, canonicalChallengeId, userId);
  }

  /**
   * Scaffolds and packages a challenge as a downloadable Maven zip archive.
   */
  public static exportMavenPackage(challengeIdOrSlug: string, userId: string): { filename: string; buffer: Buffer } {
    const row = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeIdOrSlug, challengeIdOrSlug) as any;
    if (!row) {
      throw new Error('Challenge not found');
    }

    const challenge: CodingChallenge = JSON.parse(row.manifest_json);
    const defaultFiles = challenge.workspaceFiles || [];

    const sub = db.prepare('SELECT files_json FROM coding_submissions WHERE user_id = ? AND challenge_id = ?').get(userId, challenge.id) as any;
    let files = defaultFiles;
    if (sub && sub.files_json) {
      try {
        files = JSON.parse(sub.files_json);
      } catch {}
    }

    const zipBuffer = buildChallengeZipPackage(challenge, files);
    const filename = `challenge-${challenge.slug || challenge.id}.zip`;
    return { filename, buffer: zipBuffer };
  }
}
