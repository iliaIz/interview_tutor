import assert from 'node:assert/strict';
import {
  ArenaCoordinatorStore,
  ArenaWorkspaceCoordinator,
  resolveAcademyStepTarget,
  resolveRunbookTaskTarget
} from '../src/services/arenaNavigator';

function createFakeStore() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const store: ArenaCoordinatorStore = {
    openPracticeChallengeById: async (id) => { calls.push({ method: 'openPracticeChallengeById', args: [id] }); return true; },
    openSystemDesignById: async (id) => { calls.push({ method: 'openSystemDesignById', args: [id] }); },
    openTransactionLab: (id) => { calls.push({ method: 'openTransactionLab', args: [id] }); },
    openTriageIncident: (inc) => { calls.push({ method: 'openTriageIncident', args: [inc] }); },
    openTopicBugHunt: (id, name) => { calls.push({ method: 'openTopicBugHunt', args: [id, name] }); },
    openTopicQuestions: (id, name) => { calls.push({ method: 'openTopicQuestions', args: [id, name] }); },
    setView: (view) => { calls.push({ method: 'setView', args: [view] }); },
    setStudioTab: (tab) => { calls.push({ method: 'setStudioTab', args: [tab] }); }
  };
  return { calls, store };
}

async function runTests() {
  // 1. Academy step resolution & single-seam coordinator launch
  const { calls, store } = createFakeStore();

  await ArenaWorkspaceCoordinator.launch(
    resolveAcademyStepTarget({ targetArena: 'spring_transactions', targetScenarioId: 'phantom_read', title: 'Tx' }),
    undefined,
    { getStore: () => store }
  );
  assert.deepEqual(calls[0], { method: 'openTransactionLab', args: ['phantom_read'] });

  await ArenaWorkspaceCoordinator.launch(
    resolveAcademyStepTarget({ targetArena: 'machine_coding', coreRequirements: { lldChallengeSlug: 'rate-limiter-token-bucket' }, title: 'RateLimiter' }),
    undefined,
    { getStore: () => store }
  );
  assert.deepEqual(calls[1], { method: 'openPracticeChallengeById', args: ['rate-limiter-token-bucket'] });

  await ArenaWorkspaceCoordinator.launch(
    resolveAcademyStepTarget({ targetArena: 'triage', targetScenarioId: 'triage-02', title: 'OOM' }),
    undefined,
    {
      getStore: () => store,
      fetchTriageIncidents: async () => [{ id: 'triage-02', slug: 'triage-02', title: 'OOM' }]
    }
  );
  assert.deepEqual(calls[2], { method: 'openTriageIncident', args: [{ id: 'triage-02', slug: 'triage-02', title: 'OOM' }] });
  assert.deepEqual(calls[3], { method: 'setStudioTab', args: ['triage'] });

  await ArenaWorkspaceCoordinator.launch(
    resolveAcademyStepTarget({ domain: 'concurrency', title: 'JMM' }),
    undefined,
    { getStore: () => store }
  );
  assert.deepEqual(calls[4], { method: 'openTopicQuestions', args: ['concurrency', 'Java Core & Spring'] });
  assert.deepEqual(calls[5], { method: 'setStudioTab', args: ['theory'] });

  // 2. Runbook target resolution via typed mustReviewTasks
  const target = resolveRunbookTaskTarget('cr-alfa-01', {
    id: 'alfa_digital',
    name: 'Alfa',
    brandColor: '#EF3124',
    logoBadge: 'A',
    tagline: 'Bank',
    culture: { engineeringParadigm: 'HighLoad', metricsFocus: [], keyTechnologies: [], interviewStyle: 'Tech', redFlags: [], greenFlags: [] },
    expressRunbook: {
      summary: 'Sprint',
      priorityTopics: [],
      mustReviewTasks: [{ taskId: 'cr-alfa-01', title: 'PaymentController', targetArena: 'practice' }],
      lastMinuteTips: []
    },
    stages: []
  } as any);
  assert.deepEqual(target, { arena: 'practice', entityId: 'cr-alfa-01', contextTitle: 'PaymentController' });

  console.log('✅ All arenaNavigator coordinator tests passed!');
}

runTests().catch((err) => {
  console.error('❌ arenaNavigator tests failed:', err);
  process.exit(1);
});
