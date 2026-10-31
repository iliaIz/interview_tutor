import { Router, Request, Response } from 'express';
import { getAllHrQuestions, getHrQuestion, getCandidateDossier, getJobContext } from '../services/live/hrContextResolver';

export const hrRouter = Router();

/**
 * GET /api/hr/questions
 * Returns all canonical questions and rubrics from canonicalQuestionMatrix.json
 */
hrRouter.get('/questions', (_req: Request, res: Response) => {
  try {
    const questions = getAllHrQuestions();
    res.json({ questions, count: questions.length });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch questions:', err);
    res.status(500).json({ error: 'Failed to fetch HR questions' });
  }
});

/**
 * GET /api/hr/questions/:id
 * Returns a specific question by id
 */
hrRouter.get('/questions/:id', (req: Request, res: Response) => {
  try {
    const question = getHrQuestion(req.params.id);
    if (!question || (req.params.id !== question.id && req.params.id !== 'default')) {
      return res.status(404).json({ error: `Question not found: ${req.params.id}` });
    }
    res.json({ question });
  } catch (err: any) {
    console.error(`[HR_ROUTER_ERROR] Failed to fetch question ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

/**
 * GET /api/hr/dossier
 * Returns the canonical candidate dossier
 */
hrRouter.get('/dossier', (_req: Request, res: Response) => {
  try {
    const dossier = getCandidateDossier();
    res.json({ dossier });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch dossier:', err);
    res.status(500).json({ error: 'Failed to fetch candidate dossier' });
  }
});

/**
 * GET /api/hr/job-context
 * Returns the default job context
 */
hrRouter.get('/job-context', (_req: Request, res: Response) => {
  try {
    const jobContext = getJobContext();
    res.json({ jobContext });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch job context:', err);
    res.status(500).json({ error: 'Failed to fetch job context' });
  }
});
