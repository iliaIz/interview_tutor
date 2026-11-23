/**
 * companies.ts
 * Express Route Adapter for Curated Company Preparation (SPEC-27).
 * Thin transport layer delegating to CompanyReadinessRepository.
 * Cognitive Bounding SLA: <= 100 lines (Rule 8 compliant).
 */

import { Router, Request, Response } from 'express';
import { CompanyReadinessRepository } from '../services/companies/CompanyReadinessRepository';

const router = Router();

// GET /api/companies - List all company prep profiles
router.get('/', (_req: Request, res: Response) => {
  const profiles = CompanyReadinessRepository.loadProfiles();
  res.json(profiles);
});

// GET /api/companies/:id/readiness - Retrieve candidate readiness index for company
router.get('/:id/readiness', (req: Request, res: Response) => {
  const profile = CompanyReadinessRepository.getProfileById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Company profile '${req.params.id}' not found` });
  }

  const userId = (req.query.user_id as string) || 'default_user';
  try {
    const readiness = CompanyReadinessRepository.calculateReadiness(req.params.id, userId);
    res.json(readiness);
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to compute readiness:', err);
    res.status(500).json({ error: 'Failed to compute readiness index' });
  }
});

// GET /api/companies/:id/questions - Retrieve curated questions for company
router.get('/:id/questions', (req: Request, res: Response) => {
  const userId = (req.query.user_id as string) || 'default_user';
  try {
    const questions = CompanyReadinessRepository.getCuratedQuestions(req.params.id, userId);
    res.json(questions);
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to load company questions:', err);
    res.status(500).json({ error: err.message || 'Failed to load company questions' });
  }
});

// POST /api/companies/:id/questions/:questionId/mastery - Toggle mastery for question
router.post('/:id/questions/:questionId/mastery', (req: Request, res: Response) => {
  const { id: companyId, questionId } = req.params;
  const userId = (req.body.user_id as string) || 'default_user';
  const isMastered = req.body.isMastered !== undefined ? Boolean(req.body.isMastered) : true;
  const score = Number(req.body.score) || 100;

  try {
    CompanyReadinessRepository.recordQuestionMastery(companyId, questionId, userId, isMastered, score);
    res.json({ success: true, companyId, questionId, isMastered, score });
  } catch (err: any) {
    console.error('[CompaniesRoute] Failed to update mastery:', err);
    res.status(500).json({ error: 'Failed to record question mastery' });
  }
});

// GET /api/companies/:id - Retrieve specific company profile
router.get('/:id', (req: Request, res: Response) => {
  const profile = CompanyReadinessRepository.getProfileById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Company profile '${req.params.id}' not found` });
  }
  res.json(profile);
});

export default router;
