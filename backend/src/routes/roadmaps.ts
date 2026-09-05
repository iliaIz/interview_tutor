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
  completedTransactions: Set<string>;
  masteredTopics: Set<string>;
}

function getUserEntityProgress(userId: string): UserEntityProgress {
  try {
    // 1. Coding challenges (LLD & Testing Katas)
    const codeRows = db.prepare(`
      SELECT challenge_id FROM coding_submissions 
      WHERE user_id = ? AND (status = 'COMPLETED' OR status = 'PASSED' OR (score IS NOT NULL AND score >= 70))
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

    // 4. Spring transaction submissions
    const txRows = db.prepare(`
      SELECT scenario_id FROM spring_transaction_submissions 
      WHERE user_id = ? AND (passed = 1 OR (score IS NOT NULL AND score >= 70))
    `).all(userId) as any[];
    const completedTransactions = new Set<string>(txRows.map(r => r.scenario_id));

    // 5. Mastered theory topics
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

    return { completedChallenges, completedIncidents, completedScenarios, completedTransactions, masteredTopics };
  } catch (err) {
    console.error('Error reading user entity progress:', err);
    return {
      completedChallenges: new Set(),
      completedIncidents: new Set(),
      completedScenarios: new Set(),
      completedTransactions: new Set(),
      masteredTopics: new Set()
    };
  }
}

function resolveStepCompletion(step: any, manualSteps: number[], entityProgress: UserEntityProgress) {
  const core = step.coreRequirements || {};
  const isManual = manualSteps.includes(step.stepNumber);
  const targetArena = step.targetArena || core.targetArena;
  const targetScenarioId = step.targetScenarioId || core.targetScenarioId;

  const isTxPassed = Boolean(
    (targetArena === 'transactions' || core.taskType === 'transactions') &&
    targetScenarioId && entityProgress.completedTransactions.has(targetScenarioId)
  );

  const isLldPassed = Boolean(
    (core.lldChallengeSlug && entityProgress.completedChallenges.has(core.lldChallengeSlug)) ||
    (targetArena === 'machine_coding' && targetScenarioId && entityProgress.completedChallenges.has(targetScenarioId))
  );

  const isTestingPassed = Boolean(
    (targetArena === 'testing_mutation' || core.taskType === 'testing_mutation') &&
    targetScenarioId && entityProgress.completedChallenges.has(targetScenarioId)
  );

  const isTriagePassed = Boolean(
    (core.triageIncidentId && entityProgress.completedIncidents.has(core.triageIncidentId)) ||
    (targetArena === 'incident_triage' && targetScenarioId && entityProgress.completedIncidents.has(targetScenarioId))
  );

  const isHldPassed = Boolean(
    (core.hldScenarioId && entityProgress.completedScenarios.has(core.hldScenarioId)) ||
    (targetArena === 'system_design' && targetScenarioId && entityProgress.completedScenarios.has(targetScenarioId))
  );

  const isCompleted = isManual || isTxPassed || isLldPassed || isTestingPassed || isTriagePassed || isHldPassed;

  return {
    isCompleted,
    entityStatus: {
      isManual,
      isTxPassed,
      isLldPassed,
      isTestingPassed,
      isTriagePassed,
      isHldPassed
    }
  };
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
          const { isCompleted } = resolveStepCompletion(s, manualSteps, entityProgress);
          if (isCompleted) {
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

// GET /api/roadmaps/next-best-step (Next Best Action Recommender)
roadmapsRouter.get('/next-best-step', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const requestedCourseId = req.query.courseId as string;

    // 1. Find user's active course or fallback
    let courseId = requestedCourseId;
    if (!courseId) {
      const lastActive = db.prepare('SELECT roadmap_id FROM roadmap_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) as any;
      courseId = lastActive?.roadmap_id || 'senior-bigtech-sprint-25';
    }

    let row = db.prepare('SELECT id, title, manifest_json FROM guided_roadmaps WHERE id = ?').get(courseId) as any;
    if (!row) {
      row = db.prepare('SELECT id, title, manifest_json FROM guided_roadmaps ORDER BY total_steps ASC LIMIT 1').get() as any;
    }
    if (!row) {
      return res.status(404).json({ error: 'No active roadmaps found' });
    }

    const manifest = JSON.parse(row.manifest_json);
    const steps = manifest.steps || [];
    const entityProgress = getUserEntityProgress(userId);

    const progRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, row.id) as any;
    const manualSteps: number[] = progRow ? JSON.parse(progRow.completed_steps_json || '[]') : [];

    const resolvedSteps = steps.map((s: any) => {
      const resolved = resolveStepCompletion(s, manualSteps, entityProgress);
      return { ...s, ...resolved };
    });

    const completedSet = new Set<number>(resolvedSteps.filter((s: any) => s.isCompleted).map((s: any) => Number(s.stepNumber)));
    const uncompleted = resolvedSteps.filter((s: any) => !s.isCompleted);

    if (uncompleted.length === 0) {
      return res.json({
        hasRecommendation: false,
        message: 'Все шаги курса успешно пройдены! Ваша подготовка на высшем уровне.',
        courseId: row.id,
        courseTitle: manifest.title
      });
    }

    // Cognitive interleaving: identify arena of last completed step
    let lastArena: string | null = null;
    if (completedSet.size > 0) {
      const lastCompletedNum = Math.max(...Array.from(completedSet));
      const lastStep = resolvedSteps.find((s: any) => s.stepNumber === lastCompletedNum);
      if (lastStep) lastArena = lastStep.targetArena || lastStep.coreRequirements?.taskType;
    }

    let recommended = uncompleted[0];
    if (uncompleted.length > 1 && lastArena) {
      const interleaved = uncompleted.find((s: any) => (s.targetArena || s.coreRequirements?.taskType) !== lastArena);
      if (interleaved) {
        recommended = interleaved;
      }
    }

    res.json({
      hasRecommendation: true,
      courseId: row.id,
      courseTitle: manifest.title,
      step: recommended,
      stepNumber: recommended.stepNumber,
      title: recommended.title,
      targetArena: recommended.targetArena || recommended.coreRequirements?.taskType || 'theory',
      targetScenarioId: recommended.targetScenarioId || recommended.coreRequirements?.targetScenarioId || recommended.coreRequirements?.lldChallengeSlug,
      estimatedMinutes: recommended.estimatedMinutes || 20,
      domain: recommended.domain || 'core_java',
      pedagogicalRationale: recommended.pedagogicalRationale || `Рекомендуемый следующий шаг: освоение темы «${recommended.title}» в целевой арене.`
    });
  } catch (err: any) {
    console.error('Error computing next best step:', err);
    res.status(500).json({ error: 'Failed to compute next best step', message: err.message });
  }
});

// GET /api/roadmaps/transactions/submissions
roadmapsRouter.get('/transactions/submissions', (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const rows = db.prepare(`
      SELECT scenario_id, passed, score, updated_at 
      FROM spring_transaction_submissions 
      WHERE user_id = ?
    `).all(userId) as any[];
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
    const id = `tx_${userId}_${scenarioId}`;
    db.prepare(`
      INSERT INTO spring_transaction_submissions (id, user_id, scenario_id, passed, score, user_configs_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        passed = MAX(spring_transaction_submissions.passed, excluded.passed),
        score = MAX(spring_transaction_submissions.score, excluded.score),
        user_configs_json = excluded.user_configs_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(id, userId, scenarioId, passed ? 1 : 0, score !== undefined ? score : (passed ? 100 : 0), JSON.stringify(userConfigs || {}));

    res.json({ success: true, scenarioId, passed: Boolean(passed) });
  } catch (err: any) {
    console.error('Error saving transaction submission:', err);
    res.status(500).json({ error: 'Failed to save transaction submission', message: err.message });
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
      const resolved = resolveStepCompletion(step, manualCompletedSteps, entityProgress);
      if (resolved.isCompleted) {
        resolvedCompletedSteps.push(step.stepNumber);
      }

      return {
        ...step,
        isCompleted: resolved.isCompleted,
        entityStatus: resolved.entityStatus
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
      const domain = st.domain || '';
      const text = `${st.title} ${st.seniorBarConcept}`;

      if (domain === 'concurrency' || CONCURRENCY_REGEX.test(text)) {
        concTotal++;
        if (st.isCompleted) concDone++;
      }
      if (domain === 'transactions' || DATABASE_REGEX.test(text)) {
        dbTotal++;
        if (st.isCompleted) dbDone++;
      }
      if (domain === 'system_design' || SYSTEM_DESIGN_REGEX.test(text)) {
        sdTotal++;
        if (st.isCompleted) sdDone++;
      }
      if (domain === 'incident_triage' || domain === 'jvm' || FORENSICS_REGEX.test(text)) {
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
