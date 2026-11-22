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

  const userId = (req.query.user_id as string) || 'default_user';

  try {
    const masteredRow = db.prepare(
      'SELECT count(*) as cnt FROM company_question_mastery WHERE user_id = ? AND company_id = ? AND is_mastered = 1'
    ).get(userId, req.params.id) as { cnt: number } | undefined;

    const completedTheory = masteredRow ? masteredRow.cnt : 0;
    const totalTheory = 27;
    const theoryPct = Math.min(100, Math.round((completedTheory / totalTheory) * 100));

    // Default readiness payload conforming to OpenAPI spec
    const readiness = {
      companyId: req.params.id,
      overallPercentage: Math.round(theoryPct * 0.25),
      theory: { completed: completedTheory, total: totalTheory, percentage: theoryPct },
      codeReview: { completed: 0, total: 6, percentage: 0 },
      liveCoding: { completed: 0, total: 5, percentage: 0 },
      sql: { completed: 0, total: 7, percentage: 0 },
      systemDesign: { completed: 0, total: 5, percentage: 0 }
    };

    res.json(readiness);
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to compute readiness:', err);
    res.status(500).json({ error: 'Failed to compute readiness index' });
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

