/**
 * QuestionCatalogEngine.ts
 * Pure domain calculations for question filtering, selection math, and stats.
 * Cognitive Bounding Limit: <= 220 lines (Rule 8 compliant).
 */

import { Question } from '../store/useAppStore';

export interface QuestionWithStatus extends Question {
  isCompleted?: boolean;
  isMastered?: boolean;
}

export type FilterStatus = 'all' | 'uncompleted' | 'completed' | 'mastered';

export interface CatalogFilterOptions {
  searchQuery: string;
  statusFilter: FilterStatus;
  evaluationsMap: Record<string, { isPassed?: boolean; score?: number }>;
}

export interface CatalogStats {
  total: number;
  completed: number;
  mastered: number;
  uncompleted: number;
  percentage: number;
}

export class QuestionCatalogEngine {
  /**
   * Helper to compute effective question status from progress and evaluationsMap
   */
  static getEffectiveStatus(
    q: QuestionWithStatus,
    evaluationsMap: Record<string, { isPassed?: boolean; score?: number }> = {}
  ): { isMastered: boolean; isCompleted: boolean; evalItem?: { isPassed?: boolean; score?: number } } {
    const evalItem = evaluationsMap[q.id];
    const evalScore = evalItem?.score !== undefined ? evalItem.score : -1;
    const isEvalPassed = evalItem?.isPassed || evalScore >= 70;

    const isMastered = Boolean(q.isMastered || evalScore >= 90);
    const isCompleted = Boolean(q.isCompleted || isEvalPassed || isMastered);

    return { isMastered, isCompleted, evalItem };
  }

  /**
   * Pure question list filtering by search query and completion status
   */
  static filterQuestions(
    questions: QuestionWithStatus[],
    options: CatalogFilterOptions
  ): QuestionWithStatus[] {
    const { searchQuery, statusFilter, evaluationsMap } = options;
    const query = searchQuery.toLowerCase().trim();

    return questions.filter((q) => {
      const { isMastered, isCompleted } = this.getEffectiveStatus(q, evaluationsMap);

      // Status filter
      if (statusFilter === 'uncompleted' && isCompleted) return false;
      if (statusFilter === 'completed' && (!isCompleted || isMastered)) return false;
      if (statusFilter === 'mastered' && !isMastered) return false;

      // Search filter
      if (!query) return true;
      const numStr = String(q.num);
      const matchNum = numStr === query || `#${numStr}` === query;
      const matchText = q.question.toLowerCase().includes(query);
      const matchId = q.id.toLowerCase().includes(query);

      return matchNum || matchText || matchId;
    });
  }

  /**
   * Aggregate completion and mastery statistics
   */
  static computeStats(
    questions: QuestionWithStatus[],
    evaluationsMap: Record<string, { isPassed?: boolean; score?: number }> = {}
  ): CatalogStats {
    const total = questions.length;
    let completed = 0;
    let mastered = 0;

    questions.forEach((q) => {
      const status = this.getEffectiveStatus(q, evaluationsMap);
      if (status.isCompleted) completed++;
      if (status.isMastered) mastered++;
    });

    const uncompleted = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, mastered, uncompleted, percentage };
  }

  /**
   * Compute range selection (Shift-Click) or single-item toggle
   */
  static computeRangeSelection(
    filteredQuestions: QuestionWithStatus[],
    lastIndex: number | null,
    currentIndex: number,
    currentSelected: Set<string>,
    targetId: string,
    isShiftKey: boolean
  ): Set<string> {
    const next = new Set(currentSelected);

    if (isShiftKey && lastIndex !== null) {
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const targetShouldBeSelected = !currentSelected.has(targetId);

      for (let i = start; i <= end; i++) {
        const item = filteredQuestions[i];
        if (item) {
          if (targetShouldBeSelected) {
            next.add(item.id);
          } else {
            next.delete(item.id);
          }
        }
      }
    } else {
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
    }

    return next;
  }

  /**
   * Compute preset selection
   */
  static computePreset(
    preset: 'first5' | 'first10' | 'uncompleted' | 'all',
    questions: QuestionWithStatus[],
    filteredQuestions: QuestionWithStatus[],
    evaluationsMap: Record<string, { isPassed?: boolean; score?: number }> = {}
  ): Set<string> {
    const next = new Set<string>();
    if (preset === 'first5') {
      filteredQuestions.slice(0, 5).forEach((q) => next.add(q.id));
    } else if (preset === 'first10') {
      filteredQuestions.slice(0, 10).forEach((q) => next.add(q.id));
    } else if (preset === 'uncompleted') {
      questions.filter((q) => !this.getEffectiveStatus(q, evaluationsMap).isCompleted).forEach((q) => next.add(q.id));
    } else if (preset === 'all') {
      questions.forEach((q) => next.add(q.id));
    }
    return next;
  }
}
