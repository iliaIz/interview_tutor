/**
 * CompanyReadinessRepository.ts
 * Repository encapsulating validated company profile manifests, question mastery,
 * and manifest-driven readiness index computations (SPEC-27 / Spec 44 <= 180 lines).
 */

import fs from 'fs';
import Database from 'better-sqlite3';
import {
  CompanyProfile,
  CompanyProfileSchema,
  CompanyReadinessManifest,
  ReadinessCategoryRule,
  Value
} from '@interview-prep/shared';
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

const DEFAULT_READINESS_MANIFEST: CompanyReadinessManifest = {
  theory: { total: 20 },
  codeReview: { total: 1 },
  liveCoding: { total: 1 },
  sql: { total: 1 },
  systemDesignTotal: 5
};

function countMatchingSubmissions(database: Database.Database, userId: string, rule: ReadinessCategoryRule): number {
  const prefixes = rule.idPrefixes || [];
  const exactIds = rule.exactIds || [];
  if (prefixes.length === 0 && exactIds.length === 0) return 0;

  const clauses: string[] = [];
  const params: Array<string> = [userId];
  for (const prefix of prefixes) {
    clauses.push('challenge_id LIKE ?');
    params.push(`${prefix}%`);
  }
  if (exactIds.length > 0) {
    clauses.push(`challenge_id IN (${exactIds.map(() => '?').join(', ')})`);
    params.push(...exactIds);
  }
  const sql = `SELECT count(DISTINCT challenge_id) as cnt FROM coding_submissions
    WHERE user_id = ? AND (${clauses.join(' OR ')}) AND (status = 'PASSED' OR score >= 80)`;
  const row = database.prepare(sql).get(...params) as { cnt: number } | undefined;
  return row ? row.cnt : 0;
}

function toBreakdown(completed: number, totalRaw: number): ReadinessCategoryBreakdown {
  const total = Math.max(1, totalRaw);
  return { completed, total, percentage: Math.min(100, Math.round((completed / total) * 100)) };
}

export class CompanyReadinessRepository {
  private static cachedProfiles: CompanyProfile[] | null = null;
  private readonly database: Database.Database;

  constructor(database: Database.Database = db) {
    this.database = database;
  }

  public static loadProfiles(forceReload = false): CompanyProfile[] {
    if (!forceReload && this.cachedProfiles && this.cachedProfiles.length > 0) {
      return this.cachedProfiles;
    }
    const profilesPath = resolveJsonCatalogPath('company_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      console.error(`[CompanyReadinessRepository] company_profiles.json not found at: ${profilesPath}`);
      return [];
    }
    const raw = fs.readFileSync(profilesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('[COMPANY_SCHEMA_ERROR] company_profiles.json root must be an array');
    }
    for (const entry of parsed) {
      if (!Value.Check(CompanyProfileSchema, entry)) {
        const err = [...Value.Errors(CompanyProfileSchema, entry)][0];
        throw new Error(`[COMPANY_SCHEMA_ERROR] Invalid profile '${entry?.id || 'unknown'}' at ${err?.path}: ${err?.message}`);
      }
    }
    this.cachedProfiles = parsed as CompanyProfile[];
    return this.cachedProfiles;
  }

  public static getProfileById(companyId: string): CompanyProfile | undefined {
    return this.loadProfiles().find((p) => p.id === companyId);
  }

  public calculateReadiness(companyId: string, userId: string = 'default_user'): CompanyReadinessResult {
    const profile = CompanyReadinessRepository.getProfileById(companyId);
    const cfg = profile?.readinessConfig ?? DEFAULT_READINESS_MANIFEST;

    const masteredRow = this.database.prepare(
      'SELECT count(*) as cnt FROM company_question_mastery WHERE user_id = ? AND company_id = ? AND is_mastered = 1'
    ).get(userId, companyId) as { cnt: number } | undefined;

    const theory = toBreakdown(masteredRow ? masteredRow.cnt : 0, cfg.theory.total);
    const codeReview = toBreakdown(countMatchingSubmissions(this.database, userId, cfg.codeReview), cfg.codeReview.total);
    const liveCoding = toBreakdown(countMatchingSubmissions(this.database, userId, cfg.liveCoding), cfg.liveCoding.total);
    const sql = toBreakdown(countMatchingSubmissions(this.database, userId, cfg.sql), cfg.sql.total);

    const sdRow = this.database.prepare(
      'SELECT count(DISTINCT scenario_id) as cnt FROM system_design_submissions WHERE user_id = ?'
    ).get(userId) as { cnt: number } | undefined;
    const systemDesign = toBreakdown(sdRow ? sdRow.cnt : 0, cfg.systemDesignTotal);

    const overallPercentage = Math.min(
      100,
      Math.round(0.25 * theory.percentage + 0.2 * codeReview.percentage + 0.2 * liveCoding.percentage + 0.15 * sql.percentage + 0.2 * systemDesign.percentage)
    );

    return { companyId, overallPercentage, theory, codeReview, liveCoding, sql, systemDesign };
  }

  public getCuratedQuestions(companyId: string, userId: string = 'default_user'): any[] {
    const profile = CompanyReadinessRepository.getProfileById(companyId);
    const catalogFile = profile?.readinessConfig?.questionCatalogFile;
    if (!catalogFile) return [];

    const jsonPath = resolveJsonCatalogPath(catalogFile);
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Questions catalog not found for '${companyId}': ${catalogFile}`);
    }
    const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const masteryRows = this.database.prepare(
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

  public recordQuestionMastery(
    companyId: string,
    questionId: string,
    userId: string = 'default_user',
    isMastered: boolean = true,
    score: number = 100
  ): void {
    this.database.prepare(`
      INSERT INTO company_question_mastery (user_id, company_id, question_id, is_mastered, score, last_evaluated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, company_id, question_id) DO UPDATE SET
        is_mastered = excluded.is_mastered,
        score = excluded.score,
        last_evaluated_at = CURRENT_TIMESTAMP
    `).run(userId, companyId, questionId, isMastered ? 1 : 0, score);
  }

  public static calculateReadiness(companyId: string, userId: string = 'default_user', database: Database.Database = db): CompanyReadinessResult {
    return new CompanyReadinessRepository(database).calculateReadiness(companyId, userId);
  }

  public static getCuratedQuestions(companyId: string, userId: string = 'default_user', database: Database.Database = db): any[] {
    return new CompanyReadinessRepository(database).getCuratedQuestions(companyId, userId);
  }

  public static recordQuestionMastery(
    companyId: string,
    questionId: string,
    userId: string = 'default_user',
    isMastered: boolean = true,
    score: number = 100,
    database: Database.Database = db
  ): void {
    new CompanyReadinessRepository(database).recordQuestionMastery(companyId, questionId, userId, isMastered, score);
  }
}
