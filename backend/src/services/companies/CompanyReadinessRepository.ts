/**
 * CompanyReadinessRepository.ts
 * Repository encapsulating company profile catalogs, question mastery,
 * and readiness index computations (SPEC-27).
 * Cognitive Bounding SLA: <= 200 lines (Rule 8 compliant).
 */

import fs from 'fs';
import { CompanyProfile } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../../utils/pathResolver';
import { db } from '../db';

export interface ReadinessCategoryBreakdown {
  completed: number;
  total: number;
  percentage: number;
}

export interface CompanyReadinessResult {
  companyId: string;
  overallPercentage: number;
  theory: ReadinessCategoryBreakdown;
  codeReview: ReadinessCategoryBreakdown;
  liveCoding: ReadinessCategoryBreakdown;
  sql: ReadinessCategoryBreakdown;
  systemDesign: ReadinessCategoryBreakdown;
}

export class CompanyReadinessRepository {
  private static cachedProfiles: CompanyProfile[] | null = null;

  public static loadProfiles(): CompanyProfile[] {
    if (this.cachedProfiles && this.cachedProfiles.length > 0) {
      return this.cachedProfiles;
    }
    try {
      const profilesPath = resolveJsonCatalogPath('company_profiles.json');
      if (!fs.existsSync(profilesPath)) {
        console.error(`[CompanyReadinessRepository] company_profiles.json not found at: ${profilesPath}`);
        return [];
      }
      const raw = fs.readFileSync(profilesPath, 'utf-8');
      this.cachedProfiles = JSON.parse(raw);
      return this.cachedProfiles || [];
    } catch (err) {
      console.error('[CompanyReadinessRepository] Failed to load company profiles:', err);
      return [];
    }
  }

  public static getProfileById(companyId: string): CompanyProfile | undefined {
    const profiles = this.loadProfiles();
    return profiles.find((p) => p.id === companyId);
  }

  public static calculateReadiness(companyId: string, userId: string = 'default_user'): CompanyReadinessResult {
    // 1. Theory
    const masteredRow = db.prepare(
      'SELECT count(*) as cnt FROM company_question_mastery WHERE user_id = ? AND company_id = ? AND is_mastered = 1'
    ).get(userId, companyId) as { cnt: number } | undefined;
    const completedTheory = masteredRow ? masteredRow.cnt : 0;
    const totalTheory = companyId === 'alfa_digital' ? 27 : 20;
    const theoryPct = Math.min(100, Math.round((completedTheory / totalTheory) * 100));

    // 2. Code Review
    const crRow = db.prepare(
      `SELECT count(DISTINCT challenge_id) as cnt FROM coding_submissions 
       WHERE user_id = ? AND challenge_id LIKE ? AND (status = 'PASSED' OR score >= 80)`
    ).get(userId, companyId === 'alfa_digital' ? 'cr-alfa-%' : 'case_%') as { cnt: number } | undefined;
    const completedCR = crRow ? crRow.cnt : 0;
    const totalCR = companyId === 'alfa_digital' ? 6 : 2;
    const crPct = Math.min(100, Math.round((completedCR / totalCR) * 100));

    // 3. Live Coding
    const lcRow = db.prepare(
      `SELECT count(DISTINCT challenge_id) as cnt FROM coding_submissions 
       WHERE user_id = ? AND (challenge_id LIKE ? OR challenge_id = 'lld-key-value-cache-ttl') AND (status = 'PASSED' OR score >= 80)`
    ).get(userId, companyId === 'alfa_digital' ? 'lc-alfa-%' : 'iban-%') as { cnt: number } | undefined;
    const completedLC = lcRow ? lcRow.cnt : 0;
    const totalLC = companyId === 'alfa_digital' ? 5 : 2;
    const lcPct = Math.min(100, Math.round((completedLC / totalLC) * 100));

    // 4. SQL
    const sqlRow = db.prepare(
      `SELECT count(DISTINCT challenge_id) as cnt FROM coding_submissions 
       WHERE user_id = ? AND challenge_id LIKE ? AND (status = 'PASSED' OR score >= 80)`
    ).get(userId, companyId === 'alfa_digital' ? 'sql-alfa-%' : 'sql-raiff-%') as { cnt: number } | undefined;
    const completedSql = sqlRow ? sqlRow.cnt : 0;
    const totalSql = companyId === 'alfa_digital' ? 7 : 5;
    const sqlPct = Math.min(100, Math.round((completedSql / totalSql) * 100));

    // 5. System Design
    const sdRow = db.prepare(
      'SELECT count(DISTINCT scenario_id) as cnt FROM system_design_submissions WHERE user_id = ?'
    ).get(userId) as { cnt: number } | undefined;
    const completedSD = sdRow ? sdRow.cnt : 0;
    const totalSD = 5;
    const sdPct = Math.min(100, Math.round((completedSD / totalSD) * 100));

    const overallPct = Math.min(
      100,
      Math.round(0.25 * theoryPct + 0.2 * crPct + 0.2 * lcPct + 0.15 * sqlPct + 0.2 * sdPct)
    );

    return {
      companyId,
      overallPercentage: overallPct,
      theory: { completed: completedTheory, total: totalTheory, percentage: theoryPct },
      codeReview: { completed: completedCR, total: totalCR, percentage: crPct },
      liveCoding: { completed: completedLC, total: totalLC, percentage: lcPct },
      sql: { completed: completedSql, total: totalSql, percentage: sqlPct },
      systemDesign: { completed: completedSD, total: totalSD, percentage: sdPct }
    };
  }

  public static getCuratedQuestions(companyId: string, userId: string = 'default_user'): any[] {
    if (companyId !== 'alfa_digital') {
      return [];
    }

    const jsonPath = resolveJsonCatalogPath('alfa_interview_questions.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error('Alfa Digital questions catalog not found');
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const questions = JSON.parse(raw);

    const masteryRows = db.prepare(
      'SELECT question_id, is_mastered, score FROM company_question_mastery WHERE user_id = ? AND company_id = ?'
    ).all(userId, companyId) as Array<{ question_id: string; is_mastered: number; score: number }>;

    const masteryMap = new Map(masteryRows.map((r) => [r.question_id, r]));

    return questions.map((q: any) => {
      const mastery = masteryMap.get(q.id);
      return {
        ...q,
        isMastered: mastery ? Boolean(mastery.is_mastered) : false,
        userScore: mastery ? mastery.score : 0
      };
    });
  }

  public static recordQuestionMastery(
    companyId: string,
    questionId: string,
    userId: string = 'default_user',
    isMastered: boolean = true,
    score: number = 100
  ): void {
    const isMasteredNum = isMastered ? 1 : 0;
    db.prepare(`
      INSERT INTO company_question_mastery (user_id, company_id, question_id, is_mastered, score, last_evaluated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, company_id, question_id) DO UPDATE SET
        is_mastered = excluded.is_mastered,
        score = excluded.score,
        last_evaluated_at = CURRENT_TIMESTAMP
    `).run(userId, companyId, questionId, isMasteredNum, score);
  }
}
