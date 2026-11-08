import { Router, Request, Response } from 'express';
import fs from 'fs';
import { SqlChallenge } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../utils/pathResolver';

const router = Router();
let cachedChallenges: SqlChallenge[] | null = null;

function loadSqlChallenges(): SqlChallenge[] {
  if (cachedChallenges && cachedChallenges.length > 0) return cachedChallenges;
  try {
    const challengesPath = resolveJsonCatalogPath('sql_challenges.json');
    if (!fs.existsSync(challengesPath)) {
      console.error(`[SqlChallengesRoute] sql_challenges.json not found at: ${challengesPath}`);
      return [];
    }
    const raw = fs.readFileSync(challengesPath, 'utf-8');
    cachedChallenges = JSON.parse(raw);
    return cachedChallenges || [];
  } catch (err) {
    console.error('[SqlChallengesRoute] Failed to load sql challenges:', err);
    return [];
  }
}

// GET /api/sql-challenges - List all interactive SQL challenges
router.get('/', (req: Request, res: Response) => {
  const challenges = loadSqlChallenges();
  const company = req.query.company as string | undefined;

  if (company) {
    const filtered = challenges.filter(
      (c) => c.companyContext?.company.toLowerCase() === company.toLowerCase()
    );
    return res.json(filtered);
  }

  res.json(challenges);
});

// GET /api/sql-challenges/:id - Retrieve specific challenge with DDL and expected query
router.get('/:id', (req: Request, res: Response) => {
  const challenges = loadSqlChallenges();
  const challenge = challenges.find((c) => c.id === req.params.id || c.slug === req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: `Sql challenge '${req.params.id}' not found` });
  }
  res.json(challenge);
});

export default router;
