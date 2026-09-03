import { Router, Request, Response } from 'express';
import { db } from '../services/db';
import { authService } from '../services/authService';
import { extractSessionToken } from '../middleware/auth';

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


interface UserEntityProgress {
  completedChallenges: Set<string>;
  completedIncidents: Set<string>;
  completedScenarios: Set<string>;
  masteredTopics: Set<string>;
}


function getUserEntityProgress(userId: string): UserEntityProgress {
  try {
    // 1. Coding challenges
    const codeRows = db.prepare(`
      SELECT challenge_id FROM coding_submissions 
      WHERE user_id = ? AND (status = 'COMPLETED' OR (score IS NOT NULL AND score >= 75))
    `).all(userId) as any[];
    const completedChallenges = new Set<string>(codeRows.map(r => r.challenge_id));

    // 2. Production triage incidents
    const triageRows = db.prepare(`
      SELECT incident_id FROM triage_submissions 
      WHERE user_id = ? AND (score IS NOT NULL AND score >= 65)
    `).all(userId) as any[];
    const completedIncidents = new Set<string>(triageRows.map(r => r.incident_id));

    // 3. System design submissions
    const sdRows = db.prepare(`
      SELECT scenario_id FROM system_design_submissions WHERE user_id = ?
    `).all(userId) as any[];
    const completedScenarios = new Set<string>(sdRows.map(r => r.scenario_id));

    // 4. Mastered topics
    const topicRows = db.prepare(`
      SELECT topic, mastered_ids FROM user_progress WHERE user_id = ? AND mastered_ids IS NOT NULL
    `).all(userId) as any[];
    const masteredTopics = new Set<string>();
    for (const tr of topicRows) {
      try {
        const ids = JSON.parse(tr.mastered_ids || '[]');
        if (Array.isArray(ids) && ids.length > 0) {
          masteredTopics.add(tr.topic);
        }
      } catch {}
    }

    return { completedChallenges, completedIncidents, completedScenarios, masteredTopics };
  } catch (err) {
    console.error('Error reading user entity progress:', err);
    return {
      completedChallenges: new Set(),
      completedIncidents: new Set(),
      completedScenarios: new Set(),
      masteredTopics: new Set()
    };
  }
}

// GET /api/roadmaps
roadmapsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const rows = db.prepare('SELECT id, title, category, total_steps, manifest_json FROM guided_roadmaps ORDER BY total_steps ASC').all() as any[];
    const entityProgress = getUserEntityProgress(userId);


    const roadmaps = rows.map(r => {
      try {
        const manifest = JSON.parse(r.manifest_json);
        const steps = manifest.steps || [];

        // Explicit manual progress
        const progRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, r.id) as any;
        const manualSteps: number[] = progRow ? JSON.parse(progRow.completed_steps_json || '[]') : [];
        const currentStep: number = progRow ? progRow.current_step : 1;

        // Resolve reactive completion
        let completedCount = 0;
        for (const s of steps) {
          const isManual = manualSteps.includes(s.stepNumber);
          const core = s.coreRequirements || {};
          const isLld = core.lldChallengeSlug && entityProgress.completedChallenges.has(core.lldChallengeSlug);
          const isTriage = core.triageIncidentId && entityProgress.completedIncidents.has(core.triageIncidentId);
          const isHld = core.hldScenarioId && entityProgress.completedScenarios.has(core.hldScenarioId);

          if (isManual || isLld || isTriage || isHld) {
            completedCount++;
          }
        }

        const totalSteps = manifest.totalSteps || r.total_steps || steps.length || 25;
        const percentage = Math.min(100, Math.round((completedCount / totalSteps) * 100));

        return {
          id: manifest.id || r.id,
          category: manifest.category || r.category || 'career',
          title: manifest.title || r.title,
          totalSteps,
          badge: manifest.badge || (manifest.category === 'domain' ? 'Специализация' : 'Карьерный Трек'),
          difficulty: manifest.difficulty || 'solid_senior',
          estimatedDuration: manifest.estimatedDuration || '2–3 недели',
          description: manifest.description,
          milestonesCount: manifest.milestones?.length || 4,
          userProgress: {
            completedCount,
            currentStep,
            percentage
          }
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
    const row = db.prepare('SELECT manifest_json, category FROM guided_roadmaps WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }
    const manifest = JSON.parse(row.manifest_json);
    const userId = getRequestUserId(req);
    const entityProgress = getUserEntityProgress(userId);


    // Get manual progress
    const progressRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, req.params.id) as any;
    const manualCompletedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json || '[]') : [];
    const currentStep: number = progressRow ? progressRow.current_step : 1;

    // Resolve each step with reactive entity status
    const resolvedCompletedSteps: number[] = [];
    const stepsWithStatus = (manifest.steps || []).map((step: any) => {
      const core = step.coreRequirements || {};
      const isManual = manualCompletedSteps.includes(step.stepNumber);
      const isLldPassed = Boolean(core.lldChallengeSlug && entityProgress.completedChallenges.has(core.lldChallengeSlug));
      const isTriagePassed = Boolean(core.triageIncidentId && entityProgress.completedIncidents.has(core.triageIncidentId));
      const isHldPassed = Boolean(core.hldScenarioId && entityProgress.completedScenarios.has(core.hldScenarioId));

      const isCompleted = isManual || isLldPassed || isTriagePassed || isHldPassed;
      if (isCompleted) {
        resolvedCompletedSteps.push(step.stepNumber);
      }

      return {
        ...step,
        isCompleted,
        entityStatus: {
          isManual,
          isLldPassed,
          isTriagePassed,
          isHldPassed
        }
      };
    });

    const totalSteps = manifest.totalSteps || stepsWithStatus.length || 25;
    const percentage = Math.min(100, Math.round((resolvedCompletedSteps.length / totalSteps) * 100));

    // Calculate 4-Pillar Senior Readiness Radar
    let concTotal = 0, concDone = 0;
    let dbTotal = 0, dbDone = 0;
    let sdTotal = 0, sdDone = 0;
    let triageTotal = 0, triageDone = 0;

    const CONCURRENCY_REGEX = /\b(jmm|thread|loom|lock|concur|mutex|volatile|atomic|phaser|barrier)\b/i;
    const DATABASE_REGEX = /\b(postgres|postgresql|sql|tx|transact|transaction|mvcc|hikari|acid|isolation|index|wal)\b/i;
    const SYSTEM_DESIGN_REGEX = /\b(design|system|sharding|kafka|raft|cache|redis|load|balancer|cap|pacelc|event-driven)\b/i;
    const FORENSICS_REGEX = /\b(dump|leak|gc|triage|forensic|profil|oom|crash|deadlock|flamegraph)\b/i;

    for (const st of stepsWithStatus) {
      const text = `${st.title} ${st.seniorBarConcept}`;
      if (CONCURRENCY_REGEX.test(text)) {
        concTotal++;
        if (st.isCompleted) concDone++;
      }
      if (DATABASE_REGEX.test(text)) {
        dbTotal++;
        if (st.isCompleted) dbDone++;
      }
      if (SYSTEM_DESIGN_REGEX.test(text)) {
        sdTotal++;
        if (st.isCompleted) sdDone++;
      }
      if (FORENSICS_REGEX.test(text)) {
        triageTotal++;
        if (st.isCompleted) triageDone++;
      }
    }

    const concurrencyPillar = concTotal > 0 ? Math.round((concDone / concTotal) * 100) : percentage;
    const databasePillar = dbTotal > 0 ? Math.round((dbDone / dbTotal) * 100) : percentage;
    const systemDesignPillar = sdTotal > 0 ? Math.round((sdDone / sdTotal) * 100) : percentage;
    const forensicsPillar = triageTotal > 0 ? Math.round((triageDone / triageTotal) * 100) : percentage;

    let rank = '🌱 Начало подготовки';
    if (percentage >= 80) rank = '👑 BigTech Bar-Raiser';
    else if (percentage >= 50) rank = '⭐ Solid Senior Ready';
    else if (percentage >= 20) rank = '📈 Middle+ Accelerating';

    res.json({
      ...manifest,
      steps: stepsWithStatus,
      userProgress: {
        completedSteps: Array.from(new Set(resolvedCompletedSteps)),
        currentStep,
        percentage,
        rank,
        pillars: {
          concurrency: concurrencyPillar,
          databases: databasePillar,
          systemDesign: systemDesignPillar,
          forensics: forensicsPillar
        }
      }
    });
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

    const progressRow = db.prepare('SELECT completed_steps_json FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, roadmapId) as any;
    let completedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json || '[]') : [];

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
        current_step = CASE
          WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
          ELSE roadmap_progress.current_step
        END,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, roadmapId, JSON.stringify(completedSteps), completedStep);

    res.json({ success: true, completedSteps });
  } catch (err: any) {
    console.error('Error saving roadmap progress:', err);
    res.status(500).json({ error: 'Failed to save progress', message: err.message });
  }
});
