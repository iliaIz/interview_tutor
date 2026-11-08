import { Router, Request, Response } from 'express';
import fs from 'fs';
import { CompanyProfile } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../utils/pathResolver';

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
