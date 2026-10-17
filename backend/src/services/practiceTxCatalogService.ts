import { db } from './db';

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
  updated_at?: string;
  isCompleted: boolean;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';
  lastScore?: number;
  lastStatus: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';
  timeSpentSeconds: number;
  completedAt?: string;
}

/**
 * Fetches canonical Spring Transaction challenges with user submission state.
 */
export function fetchSpringTransactionChallenges(userId: string): PracticeChallengeItem[] {
  try {
    const txRows = db.prepare(`
      SELECT id, scenario_number, slug, title, domain, difficulty, badge, manifest_json, updated_at 
      FROM spring_transaction_challenges 
      ORDER BY scenario_number ASC
    `).all() as any[];

    const txSubStmt = db.prepare(`
      SELECT scenario_id, passed, score, user_configs_json, updated_at 
      FROM spring_transaction_submissions 
      WHERE user_id = ?
    `);
    const txSubs = txSubStmt.all(userId) as any[];
    const txSubMap = new Map(txSubs.map((s) => [s.scenario_id, s]));

    return txRows.map((r, idx) => {
      let manifest: any = null;
      try {
        manifest = JSON.parse(r.manifest_json);
      } catch {}

      const sub = txSubMap.get(r.id);
      const isCompleted = sub?.passed === 1 || (sub?.score !== undefined && sub.score >= 70);
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED' = 'NOT_STARTED';

      if (isCompleted) {
        status = 'COMPLETED';
      } else if (sub) {
        status = 'IN_PROGRESS';
      }

      const rawDiff = r.difficulty || 'Middle';
      const difficulty = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();

      return {
        id: r.id,
        slug: r.slug || r.id,
        title: r.title,
        category: 'spring_transactions',
        track: 'transactions',
        badge: r.badge || 'Rollback Rules',
        difficulty,
        targetStack: 'Spring Boot 3.3 • Java 21 • HikariCP',
        timeLimitMinutes: 20,
        shortDescription: manifest?.problemStatement || r.domain || '',
        taskCode: `TX-${String(r.scenario_number || idx + 1).padStart(2, '0')}`,
        updated_at: r.updated_at,
        isCompleted,
        status,
        lastScore: sub?.score,
        lastStatus: status,
        timeSpentSeconds: 0,
        completedAt: isCompleted ? sub?.updated_at : undefined
      };
    });
  } catch (err) {
    console.warn('[fetchSpringTransactionChallenges] Could not query spring transactions:', err);
    return [];
  }
}

/**
 * Fetches full manifest and user draft for a Spring Transaction scenario.
 */
export function fetchSpringTransactionManifest(challengeId: string, userId: string): any | null {
  try {
    const row = db.prepare(`
      SELECT manifest_json 
      FROM spring_transaction_challenges 
      WHERE id = ? OR slug = ?
    `).get(challengeId, challengeId) as any;

    if (!row?.manifest_json) return null;

    const manifest = JSON.parse(row.manifest_json);
    const draftRow = db.prepare(`
      SELECT user_configs_json, passed, score, updated_at 
      FROM spring_transaction_submissions 
      WHERE scenario_id = ? AND user_id = ?
    `).get(manifest.id, userId) as any;

    let userConfigs = null;
    if (draftRow?.user_configs_json) {
      try {
        userConfigs = JSON.parse(draftRow.user_configs_json);
      } catch {}
    }

    return {
      challenge: {
        ...manifest,
        category: 'spring_transactions',
        track: 'transactions',
        targetStack: 'Spring Boot 3.3 • Java 21 • HikariCP'
      },
      savedDraft: userConfigs,
      activePhase: 1,
      lastEvaluation: draftRow
        ? { isPassed: Boolean(draftRow.passed), overallScore: draftRow.score }
        : null,
      timeSpentSeconds: 0
    };
  } catch (err) {
    console.warn(`[fetchSpringTransactionManifest] Error fetching tx manifest ${challengeId}:`, err);
    return null;
  }
}
