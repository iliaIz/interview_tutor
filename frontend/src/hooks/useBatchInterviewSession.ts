import { useState, useRef, useEffect, useCallback } from 'react';
import { Question, useAppStore } from '../store/useAppStore';
import { useInterviewConfig } from './useInterviewConfig';
import { EvaluationResult } from '../types/voice';

export interface UseBatchInterviewSessionOptions {
  questionsBatch?: Question[];
  initialQuestionIndex?: number;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  onIndexChange?: (newIndex: number) => void;
  onBatchComplete?: (results: Record<string, EvaluationResult>) => void;
  onAutoAdvance?: (targetIndex: number) => void;
}

export function useBatchInterviewSession({
  questionsBatch,
  initialQuestionIndex = 0,
  questionId,
  topic = 'Java Core & Spring',
  currentQuestionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = '',
  onIndexChange,
  onBatchComplete,
  onAutoAdvance
}: UseBatchInterviewSessionOptions) {
  const isBatchMode = Boolean(questionsBatch && questionsBatch.length > 0);
  const totalQuestions = isBatchMode && questionsBatch ? questionsBatch.length : 1;

  const { activeBatchSession, saveBatchSessionCheckpoint, clearBatchSession } = useAppStore();
  const { config: interviewConfig } = useInterviewConfig();

  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, EvaluationResult>>({});
  const batchResultsRef = useRef<Record<string, EvaluationResult>>({});
  const sessionIdRef = useRef<string>('');

  // Countdown for transition between questions
  const [countdown, setCountdown] = useState<number>(interviewConfig.transitionDelay ?? 5);
  const [isTransitionPaused, setIsTransitionPaused] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize initial question index if provided
  useEffect(() => {
    setActiveBatchIndex(initialQuestionIndex);
  }, [initialQuestionIndex]);

  // Resolve current active question
  const currentQ: Question | null =
    isBatchMode && questionsBatch ? questionsBatch[activeBatchIndex] || questionsBatch[0] : null;

  const activeQuestionId = currentQ?.id || questionId || '';
  const activeTopic = currentQ?.topic || topic || 'Java Core & Spring';
  const activeQuestionText = currentQ?.question || currentQuestionText || 'Расскажите о вашем опыте в backend-разработке.';
  const activeReferenceAnswer = currentQ?.answer || referenceAnswer || '';
  const activeQuestionNum = currentQ?.num ?? activeBatchIndex + 1;

  // Initialize or generate Session ID
  const ensureSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
    return sessionIdRef.current;
  }, []);

  // Resume saved checkpoint session from SQLite/Zustand
  const resumeSavedSession = useCallback(() => {
    if (!activeBatchSession) return initialQuestionIndex;
    sessionIdRef.current = activeBatchSession.sessionId;
    batchResultsRef.current = { ...activeBatchSession.results };
    setBatchResults(activeBatchSession.results);
    const targetIdx = Math.min(activeBatchSession.currentIndex, totalQuestions - 1);
    setActiveBatchIndex(targetIdx);
    onIndexChange?.(targetIdx);
    return targetIdx;
  }, [activeBatchSession, totalQuestions, initialQuestionIndex, onIndexChange]);

  // Start fresh batch session
  const startFreshBatch = useCallback(() => {
    clearBatchSession();
    sessionIdRef.current = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    batchResultsRef.current = {};
    setBatchResults({});
    setActiveBatchIndex(initialQuestionIndex);
    onIndexChange?.(initialQuestionIndex);
    return initialQuestionIndex;
  }, [clearBatchSession, initialQuestionIndex, onIndexChange]);

  // Save single question evaluation result and update checkpoint
  const recordEvaluationResult = useCallback(
    (qId: string, result: EvaluationResult, currentIndex: number) => {
      batchResultsRef.current[qId] = result;
      setBatchResults((prev) => ({ ...prev, [qId]: result }));

      const sid = ensureSessionId();
      saveBatchSessionCheckpoint(sid, {
        topicId: activeTopic,
        topicName: activeTopic,
        questions: questionsBatch || [],
        currentIndex: currentIndex + 1,
        results: { ...batchResultsRef.current },
        isComplete: !isBatchMode || currentIndex >= totalQuestions - 1
      });

      const hasMoreQuestions = isBatchMode && currentIndex < totalQuestions - 1;
      const isFinalQuestion = isBatchMode && currentIndex === totalQuestions - 1;

      if (isFinalQuestion) {
        onBatchComplete?.({ ...batchResultsRef.current });
      }

      return {
        hasMoreQuestions,
        isFinalQuestion,
        allResults: { ...batchResultsRef.current }
      };
    },
    [
      ensureSessionId,
      activeTopic,
      questionsBatch,
      isBatchMode,
      totalQuestions,
      saveBatchSessionCheckpoint,
      onBatchComplete
    ]
  );

  // Transition Countdown Timer Loop
  const startTransitionCountdown = useCallback(
    (onFinish: (nextIndex: number) => void) => {
      const delay = interviewConfig.transitionDelay ?? 5;
      setCountdown(delay);
      setIsTransitionPaused(false);

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      const isAutoAdvance = interviewConfig.autoAdvance !== false && delay > 0;
      if (!isAutoAdvance) return;

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            onFinish(activeBatchIndex + 1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [interviewConfig.transitionDelay, interviewConfig.autoAdvance, activeBatchIndex]
  );

  const stopTransitionCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const toggleTransitionPause = useCallback(() => {
    setIsTransitionPaused((prev) => {
      const next = !prev;
      if (next) {
        stopTransitionCountdown();
      } else {
        startTransitionCountdown((nextIdx) => {
          onAutoAdvance?.(nextIdx);
        });
      }
      return next;
    });
  }, [stopTransitionCountdown, startTransitionCountdown, onAutoAdvance]);

  const selectQuestionIndex = useCallback(
    (newIndex: number) => {
      stopTransitionCountdown();
      const clamped = Math.max(0, Math.min(newIndex, totalQuestions - 1));
      setActiveBatchIndex(clamped);
      onIndexChange?.(clamped);
      return clamped;
    },
    [totalQuestions, stopTransitionCountdown, onIndexChange]
  );

  return {
    isBatchMode,
    totalQuestions,
    activeBatchIndex,
    activeQuestionId,
    activeTopic,
    activeQuestionText,
    activeReferenceAnswer,
    activeQuestionNum,
    batchResults,
    batchResultsRef,
    sessionIdRef,
    countdown,
    isTransitionPaused,
    hasSavedSession: Boolean(activeBatchSession && !activeBatchSession.isComplete),
    ensureSessionId,
    resumeSavedSession,
    startFreshBatch,
    recordEvaluationResult,
    startTransitionCountdown,
    stopTransitionCountdown,
    toggleTransitionPause,
    selectQuestionIndex
  };
}
