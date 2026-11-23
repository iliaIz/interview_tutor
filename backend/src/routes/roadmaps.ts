import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { extractSessionToken } from '../middleware/auth';
import { RoadmapProgressionEngine } from '../services/RoadmapProgressionEngine';

export const roadmapsRouter = Router();

function getRequestUserId(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return user.id;
  try {
    const token = extractSessionToken(req);
    if (token) {
      const auth = authService.validateSession(token);
      if (auth?.user?.id) return auth.user.id;
    }
  } catch {}
  return 'default_user';
}

// GET /api/roadmaps
roadmapsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const roadmaps = RoadmapProgressionEngine.getAllRoadmaps(userId);
    res.json(roadmaps);
  } catch (err: any) {
    console.error('Error fetching roadmaps:', err);
    res.status(500).json({ error: 'Failed to fetch roadmaps', message: err.message });
  }
});

// GET /api/roadmaps/next-best-step (Next Best Action Recommender)
roadmapsRouter.get('/next-best-step', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const requestedCourseId = req.query.courseId as string | undefined;
    const result = RoadmapProgressionEngine.getNextBestStep(userId, requestedCourseId);
    if (!result) {
      return res.status(404).json({ error: 'No active roadmaps found' });
    }
    res.json(result);
  } catch (err: any) {
    console.error('Error computing next best step:', err);
    res.status(500).json({ error: 'Failed to compute next best step', message: err.message });
  }
});

// GET /api/roadmaps/transactions/submissions
roadmapsRouter.get('/transactions/submissions', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const rows = RoadmapProgressionEngine.getTransactionSubmissions(userId);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch transaction submissions', message: err.message });
  }
});

// POST /api/roadmaps/transactions/submissions
roadmapsRouter.post('/transactions/submissions', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const { scenarioId, passed, score, userConfigs } = req.body;
    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required' });
    }
    RoadmapProgressionEngine.recordTransactionSubmission(userId, scenarioId, Boolean(passed), score, userConfigs);
    res.json({ success: true, scenarioId, passed: Boolean(passed) });
  } catch (err: any) {
    console.error('Error saving transaction submission:', err);
    res.status(500).json({ error: 'Failed to save transaction submission', message: err.message });
  }
});

// GET /api/roadmaps/:id
roadmapsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const roadmapId = String(req.params.id);
    const roadmap = RoadmapProgressionEngine.getRoadmapById(roadmapId, userId);
    if (!roadmap) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }
    res.json(roadmap);
  } catch (err: any) {
    console.error('Error fetching roadmap details:', err);
    res.status(500).json({ error: 'Failed to fetch roadmap details', message: err.message });
  }
});

// POST /api/roadmaps/progress
roadmapsRouter.post('/progress', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const { roadmapId, completedStep, isCompleted } = req.body;
    if (!roadmapId || typeof completedStep !== 'number') {
      return res.status(400).json({ error: 'roadmapId and completedStep are required' });
    }
    const completedSteps = RoadmapProgressionEngine.updateStepProgress(
      userId,
      String(roadmapId),
      completedStep,
      Boolean(isCompleted)
    );
    res.json({ success: true, completedSteps });
  } catch (err: any) {
    console.error('Error saving roadmap progress:', err);
    res.status(500).json({ error: 'Failed to save progress', message: err.message });
  }
});
