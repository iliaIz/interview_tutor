import { Router, Request, Response } from 'express';
import { db } from '../services/db';

export const roadmapsRouter = Router();

// GET /api/roadmaps
roadmapsRouter.get('/', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT id, title, total_steps, manifest_json FROM guided_roadmaps ORDER BY total_steps ASC').all() as any[];
    const roadmaps = rows.map(r => {
      try {
        const manifest = JSON.parse(r.manifest_json);
        return {
          id: manifest.id || r.id,
          title: manifest.title || r.title,
          totalSteps: manifest.totalSteps || r.total_steps,
          badge: manifest.badge,
          description: manifest.description,
          milestonesCount: manifest.milestones?.length || 5
        };
      } catch {
        return r;
      }
    });

    res.json(roadmaps);
  } catch (err: any) {
    console.error('Error fetching roadmaps:', err);
    res.status(500).json({ error: 'Failed to fetch roadmaps', message: err.message });
  }
});

// GET /api/roadmaps/:id
roadmapsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT manifest_json FROM guided_roadmaps WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }
    const manifest = JSON.parse(row.manifest_json);

    // Get user progress
    const userId = (req.query.userId as string) || 'default_user';
    const progressRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, req.params.id) as any;

    const completedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json) : [];
    const currentStep: number = progressRow ? progressRow.current_step : 1;

    res.json({
      ...manifest,
      userProgress: {
        completedSteps,
        currentStep,
        percentage: Math.round((completedSteps.length / manifest.totalSteps) * 100)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch roadmap details', message: err.message });
  }
});

// POST /api/roadmaps/progress
roadmapsRouter.post('/progress', (req: Request, res: Response) => {
  try {
    const { roadmapId, completedStep, isCompleted, userId = 'default_user' } = req.body;
    
    const progressRow = db.prepare('SELECT completed_steps_json FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, roadmapId) as any;
    let completedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json) : [];

    if (isCompleted) {
      completedSteps = Array.from(new Set([...completedSteps, completedStep]));
    } else {
      completedSteps = completedSteps.filter(s => s !== completedStep);
    }

    db.prepare(`
      INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
        completed_steps_json = excluded.completed_steps_json,
        current_step = excluded.current_step,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, roadmapId, JSON.stringify(completedSteps), completedStep);

    res.json({ success: true, completedSteps });
  } catch (err: any) {
    console.error('Error saving roadmap progress:', err);
    res.status(500).json({ error: 'Failed to save progress', message: err.message });
  }
});
