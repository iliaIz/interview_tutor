import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { VoiceModal } from './VoiceModal';
import { triggerSuccessConfetti } from '../utils/confetti';
import { EvalRecord } from './quiz/QuizTypes';
import { QuizHeader } from './quiz/QuizHeader';
import { QuizQuestionCard } from './quiz/QuizQuestionCard';
import { QuizResultSummary } from './quiz/QuizResultSummary';

export const ExamQuiz: React.FC = () => {
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
    systemHealth,
    openTopicQuestions,
    startStudyWithQuestions,
    startQuizWithQuestions,
    setQuestionEvaluation,
    setBatch
  } = useAppStore();

  const [isAutoHealing, setIsAutoHealing] = useState(false);

  // Auto-Healing: If quiz view reloads with empty batch but valid selectedTopicId, restore questions automatically
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
          console.warn('Auto-healing quiz batch failed:', err);
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

  // Completed Quiz Results State
  const [resultsHistory, setResultsHistory] = useState<Record<string, EvalRecord>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(new Set());

  if (isAutoHealing) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-pastel-accentViolet border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-pastel-muted">Восстановление вопросов квиза...</p>
      </div>
    );
  }

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Порция вопросов не найдена.</p>
        <button
          onClick={() => setView('topics')}
          className="mt-4 px-4 py-2 bg-white border border-pastel-border rounded-xl text-sm font-semibold cursor-pointer"
        >
          К выбору тем
        </button>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, currentQuestionIndex), currentBatch.length - 1);
  const currentQ = currentBatch[safeIndex];
  const isLast = safeIndex === currentBatch.length - 1;

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) {
      showToast({
        type: 'warning',
        title: 'Ответ пуст',
        message: 'Пожалуйста, введите ответ своими словами перед отправкой.'
      });
      return;
    }

    setLoadingEval(true);
    try {
      const res = await fetch('/api/eval/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          topic: selectedTopicName || currentQ.topic,
          questionText: currentQ.question,
          referenceAnswer: currentQ.answer,
          userAnswer: userAnswer.trim(),
          mode: 'text'
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      setEvalResult(data);

      const record: EvalRecord = {
        question: currentQ,
        userAnswer: userAnswer.trim(),
        score: data.score ?? 0,
        isPassed: !!data.isPassed,
        feedback: data.feedback || '',
        positivePoints: data.positivePoints || [],
        missingPoints: data.missingPoints || []
      };

      setResultsHistory((prev) => ({
        ...prev,
        [currentQ.id]: record
      }));

      // Cache evaluation in client store
      setQuestionEvaluation(currentQ.id, {
        id: `eval_${currentQ.id}_${Date.now()}`,
        questionId: currentQ.id,
        topic: selectedTopicName || currentQ.topic,
        mode: 'text',
        score: data.score ?? 0,
        isPassed: !!data.isPassed,
        positivePoints: data.positivePoints || [],
        missingPoints: data.missingPoints || [],
        feedback: data.feedback || '',
        userAnswer: userAnswer.trim(),
        questionText: currentQ.question,
        referenceAnswer: currentQ.answer
      });

      if (data.isPassed) {
        triggerSuccessConfetti();
        if (selectedTopicId) {
          if (data.progress) {
            syncTopicProgress(
              selectedTopicId,
              data.progress.completedCount,
              data.progress.percentage,
              data.progress.totalCount
            );
          } else {
            updateTopicProgress(selectedTopicId, currentQ.id, true, currentBatch.length);
          }
        }
      } else if (selectedTopicId) {
        updateTopicProgress(selectedTopicId, currentQ.id, false, currentBatch.length);
      }
    } catch (err: any) {
      console.error(err);
      showToast({
        type: 'error',
        title: 'Ошибка проверки',
        message: err.message || 'Не удалось оценить ответ через сервер.'
      });
    } finally {
      setLoadingEval(false);
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setEvalResult(null);
    if (!isLast) {
      setQuestionIndex(safeIndex + 1);
    } else {
      setIsQuizCompleted(true);
    }
  };

  const handleRetryFailed = () => {
    const failedQuestions = Object.values(resultsHistory)
      .filter((r) => !r.isPassed)
      .map((r) => r.question);

    if (failedQuestions.length > 0) {
      startQuizWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', failedQuestions);
      setResultsHistory({});
      setIsQuizCompleted(false);
      setEvalResult(null);
      setUserAnswer('');
    }
  };

  const handleStudyCurrentBatch = () => {
    startStudyWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', currentBatch);
  };

  const handleGoToQuestionList = () => {
    if (selectedTopicId) {
      openTopicQuestions(selectedTopicId, selectedTopicName || 'Тема');
    } else {
      setView('topics');
    }
  };

  const toggleResultExpand = (id: string) => {
    setExpandedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isQuizCompleted) {
    return (
      <QuizResultSummary
        selectedTopicName={selectedTopicName || 'Тема'}
        records={Object.values(resultsHistory)}
        expandedResultIds={expandedResultIds}
        onToggleExpand={toggleResultExpand}
        onRetryFailed={handleRetryFailed}
        onStudyCurrentBatch={handleStudyCurrentBatch}
        onGoToQuestionList={handleGoToQuestionList}
        onGoToTopics={() => setView('topics')}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <QuizHeader
        onBackToStudy={() => setView('study')}
        onGoToQuestionList={handleGoToQuestionList}
        selectedTopicName={selectedTopicName || 'Тема'}
        isVoiceReady={systemHealth.isAiReady}
        onOpenVoice={() => setIsVoiceOpen(true)}
      />

      <QuizQuestionCard
        currentQ={currentQ}
        currentIndex={currentQuestionIndex}
        totalQuestions={currentBatch.length}
        userAnswer={userAnswer}
        setUserAnswer={setUserAnswer}
        loadingEval={loadingEval}
        isAiReady={systemHealth.isAiReady}
        evalResult={evalResult}
        onEvaluate={handleEvaluate}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onNext={handleNext}
        isLast={isLast}
      />

      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        questionId={currentQ.id}
        topic={selectedTopicName || currentQ.topic}
        currentQuestionText={currentQ.question}
        referenceAnswer={currentQ.answer}
        questionsBatch={currentBatch}
        initialQuestionIndex={safeIndex}
        onIndexChange={(newIdx) => {
          setQuestionIndex(newIdx);
          setEvalResult(null);
          setUserAnswer('');
        }}
        onEvaluationComplete={async (evalData) => {
          const evalQId = evalData.questionId || currentQ.id;
          const targetQuestion = currentBatch.find((q) => q.id === evalQId) || currentQ;

          setEvalResult(evalData);

          const evalRecord = {
            id: evalQId,
            questionId: evalQId,
            topic: selectedTopicName || targetQuestion.topic,
            mode: 'voice' as const,
            score: evalData.score ?? 0,
            isPassed: !!evalData.isPassed,
            positivePoints: evalData.positivePoints || [],
            missingPoints: evalData.missingPoints || [],
            feedback: evalData.feedback || '',
            userAnswer: evalData.userAnswer || 'Устный ответ через Gemini Live',
            audioMetrics: evalData.audioMetrics,
            questionText: targetQuestion.question,
            referenceAnswer: targetQuestion.answer
          };

          setQuestionEvaluation(evalQId, evalRecord);

          setResultsHistory((prev) => ({
            ...prev,
            [evalQId]: {
              question: targetQuestion,
              userAnswer: evalData.userAnswer || '🎙️ Устный ответ в Gemini Live',
              score: evalData.score ?? 0,
              isPassed: !!evalData.isPassed,
              feedback: evalData.feedback || '',
              positivePoints: evalData.positivePoints || [],
              missingPoints: evalData.missingPoints || []
            }
          }));

          if (selectedTopicId) {
            updateTopicProgress(selectedTopicId, evalQId, !!evalData.isPassed, currentBatch.length);

            await fetch(`/api/topics/${selectedTopicId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                completedIds: [evalQId],
                masteredIds: evalData.isPassed ? [evalQId] : [],
                lastQuestionId: evalQId
              })
            });
          }
        }}
        onBatchComplete={(_batchRes) => {
          setIsQuizCompleted(true);
        }}
      />
    </div>
  );
};
