import { db } from './db';

export interface UserEntityProgress {
  completedChallenges: Set<string>;
  completedIncidents: Set<string>;
  completedScenarios: Set<string>;
  completedTransactions: Set<string>;
  masteredTopics: Set<string>;
}

export function getUserEntityProgress(userId: string): UserEntityProgress {
  try {
    // 1. Coding challenges (LLD & Testing Katas) with dual ID <-> Slug aliasing
    const codeRows = db
      .prepare(
        `
      SELECT s.challenge_id, c.id AS ch_id, c.slug AS ch_slug
      FROM coding_submissions s
      LEFT JOIN coding_challenges c ON (s.challenge_id = c.id OR s.challenge_id = c.slug)
      WHERE s.user_id = ? AND (s.status = 'COMPLETED' OR s.status = 'PASSED' OR (s.score IS NOT NULL AND s.score >= 70))
    `
      )
      .all(userId) as any[];
    const completedChallenges = new Set<string>();
    for (const r of codeRows) {
      if (r.challenge_id) completedChallenges.add(r.challenge_id);
      if (r.ch_id) completedChallenges.add(r.ch_id);
      if (r.ch_slug) completedChallenges.add(r.ch_slug);
    }

    // 2. Production triage incidents
    const triageRows = db
      .prepare(
        `
      SELECT incident_id FROM triage_submissions 
      WHERE user_id = ? AND (score IS NOT NULL AND score >= 65)
    `
      )
      .all(userId) as any[];
    const completedIncidents = new Set<string>(triageRows.map((r) => r.incident_id));

    // 3. System design submissions
    const sdRows = db
      .prepare(
        `
      SELECT scenario_id FROM system_design_submissions WHERE user_id = ?
    `
      )
      .all(userId) as any[];
    const completedScenarios = new Set<string>(sdRows.map((r) => r.scenario_id));

    // 4. Spring transaction submissions
    const txRows = db
      .prepare(
        `
      SELECT scenario_id FROM spring_transaction_submissions 
      WHERE user_id = ? AND (passed = 1 OR (score IS NOT NULL AND score >= 70))
    `
      )
      .all(userId) as any[];
    const completedTransactions = new Set<string>(txRows.map((r) => r.scenario_id));

    // 5. Mastered theory topics
    const topicRows = db
      .prepare(
        `
      SELECT topic, mastered_ids FROM user_progress WHERE user_id = ? AND mastered_ids IS NOT NULL
    `
      )
      .all(userId) as any[];
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

export function resolveStepCompletion(step: any, manualSteps: number[], entityProgress: UserEntityProgress) {
  const core = step.coreRequirements || {};
  const isManual = manualSteps.includes(step.stepNumber);
  const targetArena = step.targetArena || core.targetArena;
  const targetScenarioId = step.targetScenarioId || core.targetScenarioId;

  const isTxPassed = Boolean(
    (targetArena === 'transactions' || core.taskType === 'transactions') &&
      targetScenarioId &&
      entityProgress.completedTransactions.has(targetScenarioId)
  );

  const isLldPassed = Boolean(
    (core.lldChallengeSlug && entityProgress.completedChallenges.has(core.lldChallengeSlug)) ||
      (targetArena === 'machine_coding' && targetScenarioId && entityProgress.completedChallenges.has(targetScenarioId))
  );

  const isTestingPassed = Boolean(
    (targetArena === 'testing_mutation' || core.taskType === 'testing_mutation') &&
      targetScenarioId &&
      entityProgress.completedChallenges.has(targetScenarioId)
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
