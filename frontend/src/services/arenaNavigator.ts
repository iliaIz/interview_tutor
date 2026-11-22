import { useAppStore } from '../store/useAppStore';
import { TargetArena, CompanyPipelineStage, CompanyProfile } from '@interview-prep/shared';
import { AudioPlayoutManager } from './AudioPlayoutManager';

export interface ArenaNavigationTarget {
  arena: TargetArena;
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

/**
 * Deterministically navigates to any assessment arena or challenge,
 * pre-hydrating target stores before transitioning views.
 * Eliminates dangling entity IDs and string-prefix sniffing.
 * File length limit: <= 350 lines (Rule 8).
 */
export class ArenaWorkspaceCoordinator {
  public static async launch(
    target: ArenaNavigationTarget,
    callbacks?: LocalStudioCallbacks
  ): Promise<void> {
    const store = useAppStore.getState();

    switch (target.arena) {
      case 'practice': {
        await store.openPracticeChallengeById(target.entityId);
        break;
      }

      case 'system_design': {
        await store.openSystemDesignById(target.entityId);
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

/**
 * Resolves a stage launch action into an ArenaNavigationTarget.
 */
export function resolveStageTarget(stage: CompanyPipelineStage): ArenaNavigationTarget {
  return {
    arena: stage.targetArena,
    entityId: stage.targetEntityId,
    contextTitle: stage.title
  };
}

/**
 * Resolves a runbook taskId into a typed ArenaNavigationTarget
 * using profile stages and typed mustReviewTasks.
 */
export function resolveRunbookTaskTarget(
  taskId: string,
  profile: CompanyProfile,
  explicitArena?: TargetArena
): ArenaNavigationTarget {
  if (explicitArena) {
    return { arena: explicitArena, entityId: taskId };
  }

  // 1. Check explicit typed mustReviewTasks in expressRunbook
  const typedTask = profile.expressRunbook.mustReviewTasks?.find((t) => t.taskId === taskId);
  if (typedTask) {
    return {
      arena: typedTask.targetArena,
      entityId: typedTask.taskId,
      contextTitle: typedTask.title
    };
  }

  // 2. Check stages
  const stage = profile.stages.find((s) => s.targetEntityId === taskId || s.id === taskId);
  if (stage) {
    return resolveStageTarget(stage);
  }

  // 3. Fallback heuristics for raw legacy string taskIds
  if (taskId.startsWith('sql-')) {
    return { arena: 'sql_arena', entityId: taskId };
  }
  if (taskId.startsWith('SD-') || taskId.startsWith('sd-')) {
    return { arena: 'system_design', entityId: taskId };
  }
  if (taskId === 'cib-interns-test-task') {
    return { arena: 'take_home', entityId: taskId };
  }

  // Default to practice arena (machine coding / refactoring katas)
  return { arena: 'practice', entityId: taskId };
}
