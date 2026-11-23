import { db } from './db';
import {
  getUserEntityProgress,
  resolveStepCompletion
} from './roadmapProgressResolver';

export interface RoadmapSummary {
  id: string;
  category: string;
  title: string;
  totalSteps: number;
  badge: string;
  difficulty: string;
  estimatedDuration: string;
  description?: string;
  milestonesCount: number;
  userProgress: {
    completedCount: number;
    currentStep: number;
    percentage: number;
  };
}

export interface NextBestStepResult {
  hasRecommendation: boolean;
  message?: string;
  courseId: string;
  courseTitle: string;
  step?: any;
  stepNumber?: number;
  title?: string;
  targetArena?: string;
  targetScenarioId?: string;
  estimatedMinutes?: number;
  domain?: string;
  pedagogicalRationale?: string;
}

export interface TransactionSubmissionRecord {
  scenario_id: string;
  passed: number;
  score: number;
  updated_at: string;
}

const CONCURRENCY_REGEX = /\b(jmm|thread|loom|lock|concur|mutex|volatile|atomic|phaser|barrier)\b/i;
const DATABASE_REGEX = /\b(postgres|postgresql|sql|tx|transact|transaction|mvcc|hikari|acid|isolation|index|wal)\b/i;
const SYSTEM_DESIGN_REGEX = /\b(design|system|sharding|kafka|raft|cache|redis|load|balancer|cap|pacelc|event-driven)\b/i;
const FORENSICS_REGEX = /\b(dump|leak|gc|triage|forensic|profil|oom|crash|deadlock|flamegraph)\b/i;

export class RoadmapProgressionEngine {
  static getAllRoadmaps(userId: string): RoadmapSummary[] {
    const rows = db.prepare('SELECT id, title, category, total_steps, manifest_json FROM guided_roadmaps ORDER BY total_steps ASC').all() as any[];
    const entityProgress = getUserEntityProgress(userId);

    return rows.map((r) => {
      try {
        const manifest = JSON.parse(r.manifest_json);
        const steps = manifest.steps || [];

        const progRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, r.id) as any;
        const manualSteps: number[] = progRow ? JSON.parse(progRow.completed_steps_json || '[]') : [];
        const currentStep: number = progRow ? progRow.current_step : 1;

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
  }

  static getNextBestStep(userId: string, requestedCourseId?: string): NextBestStepResult | null {
    let courseId = requestedCourseId;
    if (!courseId) {
      const lastActive = db.prepare('SELECT roadmap_id FROM roadmap_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) as any;
      courseId = lastActive?.roadmap_id || 'senior-bigtech-sprint-25';
    }

    let row = db.prepare('SELECT id, title, manifest_json FROM guided_roadmaps WHERE id = ?').get(courseId) as any;
    if (!row) {
      row = db.prepare('SELECT id, title, manifest_json FROM guided_roadmaps ORDER BY total_steps ASC LIMIT 1').get() as any;
    }
    if (!row) return null;

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
      return {
        hasRecommendation: false,
        message: 'Все шаги курса успешно пройдены! Ваша подготовка на высшем уровне.',
        courseId: row.id,
        courseTitle: manifest.title
      };
    }

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

    return {
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
    };
  }

  static getRoadmapById(roadmapId: string, userId: string): any | null {
    const row = db.prepare('SELECT manifest_json, category FROM guided_roadmaps WHERE id = ?').get(roadmapId) as any;
    if (!row) return null;

    const manifest = JSON.parse(row.manifest_json);
    const entityProgress = getUserEntityProgress(userId);

    const progressRow = db.prepare('SELECT completed_steps_json, current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, roadmapId) as any;
    const manualCompletedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json || '[]') : [];
    const currentStep: number = progressRow ? progressRow.current_step : 1;

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

    let concTotal = 0, concDone = 0;
    let dbTotal = 0, dbDone = 0;
    let sdTotal = 0, sdDone = 0;
    let triageTotal = 0, triageDone = 0;

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

    return {
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
    };
  }

  static updateStepProgress(userId: string, roadmapId: string, completedStep: number, isCompleted: boolean): number[] {
    const progressRow = db.prepare('SELECT completed_steps_json FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(userId, roadmapId) as any;
    let completedSteps: number[] = progressRow ? JSON.parse(progressRow.completed_steps_json || '[]') : [];

    if (isCompleted) {
      completedSteps = Array.from(new Set([...completedSteps, completedStep]));
    } else {
      completedSteps = completedSteps.filter((s) => s !== completedStep);
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

    return completedSteps;
  }

  static getTransactionSubmissions(userId: string): TransactionSubmissionRecord[] {
    return db.prepare(`
      SELECT scenario_id, passed, score, updated_at 
      FROM spring_transaction_submissions 
      WHERE user_id = ?
    `).all(userId) as TransactionSubmissionRecord[];
  }

  static recordTransactionSubmission(userId: string, scenarioId: string, passed: boolean, score?: number, userConfigs?: any): void {
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
  }
}
