import { useAppStore } from '../store/useAppStore';
import { TargetArena, CompanyPipelineStage, CompanyProfile } from '@interview-prep/shared';
import { AudioPlayoutManager } from './AudioPlayoutManager';

export type ExtendedTargetArena = TargetArena | 'transactions' | 'triage' | 'theory';

export interface ArenaNavigationTarget {
  arena: ExtendedTargetArena;
  entityId: string;
  contextTitle?: string;
  options?: {
    voiceTopic?: string;
    voiceQuestionText?: string;
    voicePromptOverride?: string;
  };
}

export interface LocalStudioCallbacks {
  setActiveSubTab: (subTab: 'pipeline' | 'dossier' | 'runbook' | 'sql_arena' | 'take_home') => void;
  setTargetSqlChallengeId: (id: string) => void;
  setIsVoiceOpen: (open: boolean) => void;
}

export interface ArenaCoordinatorStore {
  openPracticeChallengeById: (idOrSlug: string) => Promise<boolean>;
  openSystemDesignById: (scenarioIdOrAlias: string) => Promise<void>;
  openTransactionLab: (scenarioId?: string) => void;
  openTriageIncident: (incident: any) => void;
  openTopicBugHunt: (topicId: string, topicName: string) => void;
  openTopicQuestions: (topicId: string, topicName: string) => void;
  setView: (view: 'topics' | 'questions' | 'study' | 'quiz') => void;
  setStudioTab: (tab: any) => void;
}

export interface ArenaLaunchPorts {
  getStore?: () => ArenaCoordinatorStore;
  fetchTriageIncidents?: () => Promise<any[]>;
}

async function defaultFetchTriageIncidents(): Promise<any[]> {
  const res = await fetch('/api/triage/incidents', { credentials: 'include' });
  return res.ok ? res.json() : [];
}

/**
 * Resolves an Academy roadmap step into a typed ArenaNavigationTarget
 * so Academy and Company Studio share one canonical navigation seam (Spec 44).
 */
export function resolveAcademyStepTarget(step: any): ArenaNavigationTarget {
  const targetArena = step?.targetArena || step?.coreRequirements?.targetArena || step?.coreRequirements?.taskType;
  const targetScenarioId = step?.targetScenarioId || step?.coreRequirements?.targetScenarioId;

  if (targetArena === 'transactions' || targetArena === 'spring_transactions') {
    return { arena: 'transactions', entityId: targetScenarioId || 'self_invocation_bypass', contextTitle: step?.title };
  }
  if (targetArena === 'system_design' || targetArena === 'hld') {
    return {
      arena: 'system_design',
      entityId: targetScenarioId || step?.coreRequirements?.hldScenarioId || 'hld-scenario-01',
      contextTitle: step?.title
    };
  }
  if (targetArena === 'incident_triage' || targetArena === 'triage') {
    return {
      arena: 'triage',
      entityId: targetScenarioId || step?.coreRequirements?.triageIncidentId || 'triage-l0-01',
      contextTitle: step?.title
    };
  }
  if (targetArena === 'testing_mutation' || targetArena === 'machine_coding' || targetArena === 'lld') {
    return {
      arena: 'practice',
      entityId: targetScenarioId || step?.coreRequirements?.lldChallengeSlug || 'rate-limiter-token-bucket',
      contextTitle: step?.title
    };
  }
  if (targetArena === 'oral_interview') {
    return { arena: 'theory', entityId: '', contextTitle: step?.title };
  }
  return {
    arena: 'theory',
    entityId: step?.domain || step?.coreRequirements?.theoryTopic || 'core',
    contextTitle: 'Java Core & Spring'
  };
}

/**
 * Deterministically navigates to any assessment arena or challenge,
 * pre-hydrating target stores before transitioning views.
 * Eliminates duplicate store branching and dangling entity IDs (<= 180 lines).
 */
export class ArenaWorkspaceCoordinator {
  public static async launch(
    target: ArenaNavigationTarget,
    callbacks?: LocalStudioCallbacks,
    ports?: ArenaLaunchPorts
  ): Promise<void> {
    const store = ports?.getStore ? ports.getStore() : useAppStore.getState();

    switch (target.arena) {
      case 'practice': {
        await store.openPracticeChallengeById(target.entityId);
        break;
      }

      case 'transactions': {
        store.openTransactionLab(target.entityId || 'self_invocation_bypass');
        break;
      }

      case 'system_design': {
        await store.openSystemDesignById(target.entityId);
        break;
      }

      case 'triage': {
        try {
          const fetcher = ports?.fetchTriageIncidents ?? defaultFetchTriageIncidents;
          const incidents = await fetcher();
          const found = incidents.find((i: any) => i.id === target.entityId || i.slug === target.entityId);
          if (found) store.openTriageIncident(found);
        } catch (e) {
          console.error('[ArenaWorkspaceCoordinator] Failed to load triage incident:', e);
        }
        store.setStudioTab('triage');
        break;
      }

      case 'theory': {
        if (target.entityId) {
          store.openTopicQuestions(target.entityId, target.contextTitle || 'Java Core & Spring');
        } else {
          store.setView('questions');
        }
        store.setStudioTab('theory');
        break;
      }

      case 'sql_arena': {
        if (callbacks?.setTargetSqlChallengeId && callbacks?.setActiveSubTab) {
          callbacks.setTargetSqlChallengeId(target.entityId);
          callbacks.setActiveSubTab('sql_arena');
        } else {
          store.setStudioTab('companies');
        }
        break;
      }

      case 'take_home': {
        if (callbacks?.setActiveSubTab) {
          callbacks.setActiveSubTab('take_home');
        } else {
          store.setStudioTab('companies');
        }
        break;
      }

      case 'voice_modal': {
        AudioPlayoutManager.warmup();
        callbacks?.setIsVoiceOpen(true);
        break;
      }

      case 'incidents': {
        store.openTopicBugHunt(target.entityId, target.contextTitle || target.entityId);
        store.setStudioTab('incidents');
        break;
      }

      default: {
        console.warn(`[ArenaWorkspaceCoordinator] Unknown arena: ${target.arena}`);
        store.setStudioTab('practice');
      }
    }
  }
}

export const launchArenaTask = ArenaWorkspaceCoordinator.launch;

export function resolveStageTarget(stage: CompanyPipelineStage): ArenaNavigationTarget {
  return {
    arena: stage.targetArena,
    entityId: stage.targetEntityId,
    contextTitle: stage.title
  };
}

export function resolveRunbookTaskTarget(
  taskId: string,
  profile: CompanyProfile,
  explicitArena?: TargetArena
): ArenaNavigationTarget {
  if (explicitArena) {
    return { arena: explicitArena, entityId: taskId };
  }
  const typedTask = profile.expressRunbook.mustReviewTasks?.find((t) => t.taskId === taskId);
  if (typedTask) {
    return { arena: typedTask.targetArena, entityId: typedTask.taskId, contextTitle: typedTask.title };
  }
  const stage = profile.stages.find((s) => s.targetEntityId === taskId || s.id === taskId);
  if (stage) {
    return resolveStageTarget(stage);
  }
  if (taskId.startsWith('sql-')) return { arena: 'sql_arena', entityId: taskId };
  if (taskId.startsWith('SD-') || taskId.startsWith('sd-')) return { arena: 'system_design', entityId: taskId };
  if (taskId === 'cib-interns-test-task') return { arena: 'take_home', entityId: taskId };
  return { arena: 'practice', entityId: taskId };
}
