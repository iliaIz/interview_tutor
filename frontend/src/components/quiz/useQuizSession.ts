/**
 * useQuizSession.ts
 * Headless controller for ExamQuiz state machine, evaluation flows, and progress sync.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore, Question } from '../../store/useAppStore';
import { useInterviewConfig } from '../../hooks/useInterviewConfig';
import { QuizSessionEngine, EvalRecord } from '../../services/quiz/QuizSessionEngine';
import { triggerSuccessConfetti } from '../../utils/confetti';

export function useQuizSession() {
  const {
    currentBatch,
    currentQuestionIndex,
    setQuestionIndex,
    setView,
    selectedTopicName,
    selectedTopicId,
    updateTopicProgress,
    syncTopicProgress,
    showToast,
    openTopicQuestions,
    startStudyWithQuestions,
    startQuizWithQuestions,
    setQuestionEvaluation,
    setBatch
  } = useAppStore();

  const { config: interviewConfig } = useInterviewConfig();
  const [isAutoHealing, setIsAutoHealing] = useState(false);

  // SOTA Auto-Healing: restore questions if page reloaded with empty batch
  useEffect(() => {
    if ((!currentBatch || currentBatch.length === 0) && selectedTopicId && !isAutoHealing) {
      setIsAutoHealing(true);
      fetch(`/api/topics/${selectedTopicId}/questions`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data) => {
          const allQuestions = data.questions || [];
          if (allQuestions.length > 0) {
            setBatch(allQuestions.slice(0, 10));
          }
        })
        .catch((err) => {
          console.warn('[useQuizSession] Auto-healing quiz batch failed:', err);
        })
        .finally(() => {
          setIsAutoHealing(false);
        });
    }
  }, [currentBatch, selectedTopicId, isAutoHealing, setBatch]);

  const [userAnswer, setUserAnswer] = useState('');
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [resultsHistory, setResultsHistory] = useState<Record<string, EvalRecord>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(new Set());

  const safeIndex = currentBatch && currentBatch.length > 0
    ? Math.min(Math.max(0, currentQuestionIndex), currentBatch.length - 1)
    : 0;
  const currentQ = currentBatch?.[safeIndex];
  const isLast = currentBatch ? safeIndex === currentBatch.length - 1 : false;

  const persistProgress = useCallback(async (questionId: string, isPassed: boolean, progressData?: any) => {
    if (!selectedTopicId) return;

    if (progressData) {
      syncTopicProgress(
        selectedTopicId,
        progressData.completedCount,
        progressData.percentage,
        progressData.total
      );
    } else {
      updateTopicProgress(selectedTopicId, questionId, isPassed, currentBatch?.length || 1);
    }

    try {
      await fetch(`/api/topics/${selectedTopicId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedIds: [questionId],
          masteredIds: isPassed ? [questionId] : [],
          lastQuestionId: questionId
        })
      });
    } catch (e) {
      console.warn('[useQuizSession] Failed to persist quiz progress:', e);
    }
  }, [selectedTopicId, syncTopicProgress, updateTopicProgress, currentBatch]);

  const handleEvaluate = useCallback(async () => {
    if (!currentQ) return;
    if (!userAnswer.trim()) {
      showToast({
        type: 'warning',
        title: 'Ответ пуст',
        message: 'Пожалуйста, введите ваш ответ или надиктуйте его голосом перед отправкой.'
      });
      return;
    }

    setLoadingEval(true);
    setEvalResult(null);

    try {
      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          topic: selectedTopicName || currentQ.topic,
          question: currentQ.question,
          referenceAnswer: currentQ.answer,
          userAnswer,
          userGender: interviewConfig.userGender || 'female'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);

        const evalRecord = QuizSessionEngine.reconcileTextEval(currentQ, userAnswer, data);
        setQuestionEvaluation(currentQ.id, {
          ...evalRecord,
          id: currentQ.id,
          questionId: currentQ.id,
          topic: selectedTopicName || currentQ.topic,
          mode: 'text',
          questionText: currentQ.question,
          referenceAnswer: currentQ.answer
        });

        if (evalRecord.score >= 80) {
          triggerSuccessConfetti();
        }

        setResultsHistory((prev) => ({
          ...prev,
          [currentQ.id]: evalRecord
        }));

        await persistProgress(currentQ.id, evalRecord.isPassed, data.progress);
      } else {
        const errText = await res.text();
        showToast({
          type: 'error',
          title: 'Ошибка оценки ИИ',
          message: 'Сервер оценки не смог обработать ответ.',
          technicalDetails: `HTTP ${res.status}: ${errText}`
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Сбой подключения к серверу оценки',
        message: err?.message || 'Не удалось связаться с бэкендом оценки.',
        technicalDetails: err?.stack || String(err)
      });
    } finally {
      setLoadingEval(false);
    }
  }, [currentQ, userAnswer, selectedTopicName, interviewConfig, showToast, setQuestionEvaluation, persistProgress]);

  const handleVoiceEvaluationComplete = useCallback((evaluations: Record<string, any>) => {
    if (!currentBatch) return;
    Object.entries(evaluations).forEach(([qId, evalData]) => {
      const question = currentBatch.find((q) => q.id === qId);
      if (question) {
        const record = QuizSessionEngine.reconcileVoiceEval(question, evalData);
        setQuestionEvaluation(qId, {
          ...record,
          id: qId,
          questionId: qId,
          topic: selectedTopicName || question.topic,
          mode: 'voice',
          questionText: question.question,
          referenceAnswer: question.answer
        });
        setResultsHistory((prev) => ({
          ...prev,
          [qId]: record
        }));
        void persistProgress(qId, record.isPassed);
      }
    });
  }, [currentBatch, selectedTopicName, setQuestionEvaluation, persistProgress]);

  const handleNext = useCallback(() => {
    setUserAnswer('');
    setEvalResult(null);
    if (!isLast) {
      setQuestionIndex(safeIndex + 1);
    } else {
      setIsQuizCompleted(true);
    }
  }, [isLast, safeIndex, setQuestionIndex]);

  const handleRetryFailed = useCallback(() => {
    if (!currentBatch) return;
    const failedQuestions = QuizSessionEngine.getFailedQuestions(currentBatch, resultsHistory);
    if (failedQuestions.length > 0) {
      setResultsHistory({});
      setIsQuizCompleted(false);
      startQuizWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', failedQuestions);
    }
  }, [currentBatch, resultsHistory, selectedTopicId, selectedTopicName, startQuizWithQuestions]);

  const handleStudyCurrentBatch = useCallback(() => {
    if (currentBatch) {
      startStudyWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', currentBatch);
    }
  }, [currentBatch, selectedTopicId, selectedTopicName, startStudyWithQuestions]);

  const handleGoToQuestionList = useCallback(() => {
    if (selectedTopicId) {
      openTopicQuestions(selectedTopicId, selectedTopicName || 'Тема');
    } else {
      setView('topics');
    }
  }, [selectedTopicId, selectedTopicName, openTopicQuestions, setView]);

  const toggleResultExpand = useCallback((id: string) => {
    setExpandedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    currentBatch,
    currentQ,
    safeIndex,
    isLast,
    isAutoHealing,
    selectedTopicName,
    selectedTopicId,
    userAnswer,
    setUserAnswer,
    loadingEval,
    evalResult,
    isVoiceOpen,
    setIsVoiceOpen,
    resultsHistory,
    isQuizCompleted,
    expandedResultIds,
    handleEvaluate,
    handleVoiceEvaluationComplete,
    handleNext,
    handleRetryFailed,
    handleStudyCurrentBatch,
    handleGoToQuestionList,
    toggleResultExpand,
    setView
  };
}
