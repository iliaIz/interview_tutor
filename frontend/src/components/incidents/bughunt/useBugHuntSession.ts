import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { BugChallenge } from '../../BugChallengeCard';
import { triggerSuccessConfetti } from '../../../utils/confetti';
import { WorkoutPreset } from './BugHuntHeader';

export type DefectFocus = 'all' | 'streams' | 'concurrency' | 'testing' | 'memory' | 'spring_aop' | 'contracts';
export type TechStackProfile = 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';

export interface UseBugHuntSessionProps {
  topicId: string;
  topicName: string;
  activePreset: WorkoutPreset;
  defectFocus?: DefectFocus;
  difficulty?: 'middle' | 'senior';
  techStackProfile?: TechStackProfile;
}

export interface UseBugHuntSessionReturn {
  challenge: BugChallenge | null;
  history: BugChallenge[];
  currentIndex: number;
  currentVariantNumber: number;
  isLoadingChallenge: boolean;
  isLoadingVariation: boolean;
  generationError: string | null;
  isSolved: boolean;
  sessionSolvedCount: number;
  fetchChallenge: (overridePreset?: WorkoutPreset) => Promise<void>;
  handleGenerateVariation: () => Promise<void>;
  handleNextChallenge: () => void;
  handlePreviousChallenge: () => void;
  markBugSolved: () => void;
}

export function useBugHuntSession(props: UseBugHuntSessionProps): UseBugHuntSessionReturn {
  const {
    topicId,
    topicName,
    activePreset,
    defectFocus = 'all',
    difficulty = 'middle',
    techStackProfile = 'modern_cloud'
  } = props;

  const { academyBreadcrumbContext, toggleAcademyStepProgress } = useAppStore();

  const [history, setHistory] = useState<BugChallenge[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isLoadingVariation, setIsLoadingVariation] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [sessionSolvedCount, setSessionSolvedCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const challenge = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

  const currentVariantNumber = useMemo(() => {
    if (!challenge || currentIndex < 0) return 1;
    const sameSubtopicCount = history
      .slice(0, currentIndex + 1)
      .filter((c) => c.subtopic === challenge.subtopic).length;
    return Math.max(1, sameSubtopicCount);
  }, [challenge, currentIndex, history]);

  const fetchChallenge = useCallback(
    async (overridePreset?: WorkoutPreset) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoadingChallenge(true);
      setGenerationError(null);
      setIsSolved(false);

      const presetToUse = overridePreset || activePreset;

      try {
        const excludeIds = history.map((c) => c.id).filter(Boolean);
        const res = await fetch('/api/tutor/bug-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            topicId,
            topic: topicName,
            workoutPreset: presetToUse,
            defectFocus: defectFocus !== 'all' ? defectFocus : undefined,
            difficulty,
            techStackProfile,
            excludeIds
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `HTTP ${res.status}`);
        }

        const newChallenge: BugChallenge = await res.json();
        setHistory((prev) => {
          const nextHistory = [...prev, newChallenge];
          setCurrentIndex(nextHistory.length - 1);
          return nextHistory;
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setGenerationError(err.message || 'Ошибка генерации кейса');
        }
      } finally {
        setIsLoadingChallenge(false);
      }
    },
    [history, activePreset, topicId, topicName, defectFocus, difficulty, techStackProfile]
  );

  useEffect(() => {
    void fetchChallenge();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [topicId]);

  const handleGenerateVariation = useCallback(async () => {
    if (!challenge) return;
    setIsLoadingVariation(true);
    try {
      const res = await fetch('/api/tutor/bug-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topicId,
          topic: topicName,
          workoutPreset: activePreset,
          difficulty,
          techStackProfile,
          subtopicOverride: challenge.subtopic
        })
      });
      if (res.ok) {
        const variation: BugChallenge = await res.json();
        setHistory((prev) => {
          const nextHistory = [...prev, variation];
          setCurrentIndex(nextHistory.length - 1);
          return nextHistory;
        });
        setIsSolved(false);
      }
    } catch (e) {
      console.error('Variation generation failed:', e);
    } finally {
      setIsLoadingVariation(false);
    }
  }, [challenge, topicId, topicName, activePreset, difficulty, techStackProfile]);

  const handleNextChallenge = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsSolved(Boolean(history[currentIndex + 1].isSolved));
    } else {
      void fetchChallenge();
    }
  }, [currentIndex, history, fetchChallenge]);

  const handlePreviousChallenge = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsSolved(Boolean(history[currentIndex - 1].isSolved));
    }
  }, [currentIndex, history]);

  const markBugSolved = useCallback(() => {
    setIsSolved(true);
    setSessionSolvedCount((prev) => prev + 1);
    setHistory((prev) => prev.map((c, i) => (i === currentIndex ? { ...c, isSolved: true } : c)));
    triggerSuccessConfetti();
    if (academyBreadcrumbContext) {
      toggleAcademyStepProgress(
        academyBreadcrumbContext.courseId,
        academyBreadcrumbContext.stepNumber,
        true
      );
    }
  }, [currentIndex, academyBreadcrumbContext, toggleAcademyStepProgress]);

  return {
    challenge,
    history,
    currentIndex,
    currentVariantNumber,
    isLoadingChallenge,
    isLoadingVariation,
    generationError,
    isSolved,
    sessionSolvedCount,
    fetchChallenge,
    handleGenerateVariation,
    handleNextChallenge,
    handlePreviousChallenge,
    markBugSolved
  };
}
