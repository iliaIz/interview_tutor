import { Router, Request, Response } from 'express';
import fs from 'fs';
import { CompanyProfile } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../utils/pathResolver';
import { db } from '../services/db';

const router = Router();
let cachedProfiles: CompanyProfile[] | null = null;

function loadProfiles(): CompanyProfile[] {
  if (cachedProfiles && cachedProfiles.length > 0) return cachedProfiles;
  try {
    const profilesPath = resolveJsonCatalogPath('company_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      console.error(`[CompaniesRoute] company_profiles.json not found at: ${profilesPath}`);
      return [];
    }
    const raw = fs.readFileSync(profilesPath, 'utf-8');
    cachedProfiles = JSON.parse(raw);
    return cachedProfiles || [];
  } catch (err) {
    console.error('[CompaniesRoute] Failed to load company profiles:', err);
    return [];
  }
}

// GET /api/companies - List all company prep profiles
router.get('/', (_req: Request, res: Response) => {
  const profiles = loadProfiles();
  res.json(profiles);
});

// GET /api/companies/:id/readiness - Retrieve candidate readiness index for company
router.get('/:id/readiness', (req: Request, res: Response) => {
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.id === req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Company profile '${req.params.id}' not found` });
  }

  const companyId = req.params.id;
  const userId = (req.query.user_id as string) || 'default_user';

  try {
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

    const readiness = {
      companyId,
      overallPercentage: overallPct,
      theory: { completed: completedTheory, total: totalTheory, percentage: theoryPct },
      codeReview: { completed: completedCR, total: totalCR, percentage: crPct },
      liveCoding: { completed: completedLC, total: totalLC, percentage: lcPct },
      sql: { completed: completedSql, total: totalSql, percentage: sqlPct },
      systemDesign: { completed: completedSD, total: totalSD, percentage: sdPct }
    };

    res.json(readiness);
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to compute readiness:', err);
    res.status(500).json({ error: 'Failed to compute readiness index' });
  }
});

// GET /api/companies/:id/questions - Retrieve curated questions for company
router.get('/:id/questions', (req: Request, res: Response) => {
  const companyId = req.params.id;
  const userId = (req.query.user_id as string) || 'default_user';

  if (companyId === 'alfa_digital') {
    const jsonPath = resolveJsonCatalogPath('alfa_interview_questions.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: 'Alfa Digital questions catalog not found' });
    }

    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const questions = JSON.parse(raw);

      // Annotate with mastery status from SQLite
      const masteryRows = db.prepare(
        'SELECT question_id, is_mastered, score FROM company_question_mastery WHERE user_id = ? AND company_id = ?'
      ).all(userId, companyId) as Array<{ question_id: string; is_mastered: number; score: number }>;

      const masteryMap = new Map(masteryRows.map((r) => [r.question_id, r]));

      const enriched = questions.map((q: any) => {
        const mastery = masteryMap.get(q.id);
        return {
          ...q,
          isMastered: mastery ? Boolean(mastery.is_mastered) : false,
          userScore: mastery ? mastery.score : 0
        };
      });

      return res.json(enriched);
    } catch (err: any) {
      console.error('[CompaniesRoute] Failed to load company questions:', err);
      return res.status(500).json({ error: 'Failed to load company questions' });
    }
  }

  res.json([]);
});

// POST /api/companies/:id/questions/:questionId/mastery - Toggle mastery for question
router.post('/:id/questions/:questionId/mastery', (req: Request, res: Response) => {
  const { id: companyId, questionId } = req.params;
  const userId = (req.body.user_id as string) || 'default_user';
  const isMastered = req.body.isMastered !== undefined ? (req.body.isMastered ? 1 : 0) : 1;
  const score = Number(req.body.score) || 100;

  try {
    db.prepare(`
      INSERT INTO company_question_mastery (user_id, company_id, question_id, is_mastered, score, last_evaluated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, company_id, question_id) DO UPDATE SET
        is_mastered = excluded.is_mastered,
        score = excluded.score,
        last_evaluated_at = CURRENT_TIMESTAMP
    `).run(userId, companyId, questionId, isMastered, score);

    res.json({ success: true, companyId, questionId, isMastered: Boolean(isMastered), score });
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to update mastery:', err);
    res.status(500).json({ error: 'Failed to record question mastery' });
  }
});

// GET /api/companies/:id - Retrieve specific company profile
router.get('/:id', (req: Request, res: Response) => {
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.id === req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Company profile '${req.params.id}' not found` });
  }
  res.json(profile);
});

export default router;

