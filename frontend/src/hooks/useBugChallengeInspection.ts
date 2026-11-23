/**
 * useBugChallengeInspection.ts
 * Headless in-process domain hook for bug challenge inspection, AST static rules,
 * takeaways extraction, and cheat sheet bookmark synchronization.
 * SLA: <= 150 lines (Rule 8 compliant).
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { evaluateAstRules } from '../utils/astRules';
import { generateUnifiedDiff } from '../utils/diff';

export interface AstAnalysisResultItem {
  id: string;
  text: string;
  isViolation: boolean;
}

export interface TechStackInfo {
  language: string;
  javaVersion: string;
  framework: string;
  keyLibraries: string[];
}

export interface ProductionContext {
  systemName: string;
  architectureType: string;
  incidentSymptoms: string;
  businessImpact: string;
  prReviewContext: string;
}

export interface BugChallenge {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  language: 'java' | 'sql' | 'kotlin';
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  hints: string[];
  categoryBadge?: string;
  difficultyBadge?: string;
  sampledQuestionId?: string;
  isTopicExhausted?: boolean;
  remainingCount?: number;
  totalTopicQuestions?: number;
  isSolved?: boolean;
  lastScore?: number;
  lastFeedback?: string;
  keyTakeaways?: string[];
  techStack?: TechStackInfo;
  productionContext?: ProductionContext;
  testSuite?: string;
  astRules?: string[];
  createdAt?: string;
}

export interface BugChallengeInspectionResult {
  astAnalysis: AstAnalysisResultItem[];
  unifiedDiffCode: string;
  takeaways: string[];
  bookmarked: boolean;
  handleToggleBookmark: () => void;
}

export function useBugChallengeInspection(challenge: BugChallenge): BugChallengeInspectionResult {
  const { addCheatSheetBookmark, removeCheatSheetBookmark, isBookmarked } = useAppStore();
  const bookmarked = isBookmarked(challenge.id);

  // Compute AST analysis on snippet using unified rules
  const astAnalysis = useMemo(() => {
    return evaluateAstRules(challenge.codeSnippet || '');
  }, [challenge.codeSnippet]);

  // Compute unified diff string for solution inspection
  const unifiedDiffCode = useMemo(() => {
    return generateUnifiedDiff(challenge.codeSnippet, challenge.fixedCode);
  }, [challenge.codeSnippet, challenge.fixedCode]);

  // Extract or generate 3 key takeaways for cheat sheet synthesis
  const takeaways = useMemo(() => {
    if (challenge.keyTakeaways && challenge.keyTakeaways.length > 0) {
      return challenge.keyTakeaways;
    }
    const explanationLines = challenge.bugExplanation
      .split('\n')
      .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((l) => l.length > 10);

    if (explanationLines.length >= 2) {
      return explanationLines.slice(0, 3);
    }

    return [
      `Суть дефекта: ${challenge.title} в подразделе ${challenge.subtopic}.`,
      `Риск: нарушение потокобезопасности или корректности данных под нагрузкой.`,
      `Архитектурное решение: применение thread-safe примитивов или правильных контрактов Spring.`
    ];
  }, [challenge]);

  const handleToggleBookmark = useCallback(() => {
    if (bookmarked) {
      removeCheatSheetBookmark(challenge.id);
    } else {
      addCheatSheetBookmark({
        id: challenge.id,
        topicId: challenge.topicId,
        topicName: challenge.topicName,
        title: challenge.title,
        subtopic: challenge.subtopic,
        takeaways,
        codeSnippet: challenge.codeSnippet,
        fixedCode: challenge.fixedCode,
        categoryBadge: challenge.categoryBadge
      });
    }
  }, [bookmarked, challenge, takeaways, addCheatSheetBookmark, removeCheatSheetBookmark]);

  return {
    astAnalysis,
    unifiedDiffCode,
    takeaways,
    bookmarked,
    handleToggleBookmark
  };
}
