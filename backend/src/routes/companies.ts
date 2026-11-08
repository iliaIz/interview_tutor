import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CompanyProfile } from '@interview-prep/shared';

const router = Router();
const PROFILES_PATH = path.resolve(__dirname, '../../../json/company_profiles.json');

let cachedProfiles: CompanyProfile[] | null = null;

function loadProfiles(): CompanyProfile[] {
  if (cachedProfiles) return cachedProfiles;
  try {
    const raw = fs.readFileSync(PROFILES_PATH, 'utf-8');
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
