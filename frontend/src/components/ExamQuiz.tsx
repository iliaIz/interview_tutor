/**
 * ExamQuiz.tsx
 * Orchestrator view for Exam Quiz Session (SPEC-29).
 * Decomposed into deep QuizSessionEngine, useQuizSession hook, and presenter components.
 * SLA: <= 140 lines (Rule 8 compliant).
 */

import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useQuizSession } from './quiz/useQuizSession';
import { QuizQuestionArena } from './quiz/QuizQuestionArena';
import { QuizScorecardView } from './quiz/QuizScorecardView';
import { VoiceModal } from './VoiceModal';

export const ExamQuiz: React.FC = () => {
  const { systemHealth } = useAppStore();

  const {
    currentBatch,
    currentQ,
    safeIndex,
    isLast,
    isAutoHealing,
    selectedTopicName,
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
  } = useQuizSession();

  if (isAutoHealing) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3 font-sans">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-pastel-accentViolet border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-pastel-muted">Восстановление вопросов квиза...</p>
      </div>
    );
  }

  if (!currentBatch || currentBatch.length === 0 || !currentQ) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center font-sans">
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

  return (
    <>
      {isQuizCompleted ? (
        <QuizScorecardView
          resultsHistory={resultsHistory}
          selectedTopicName={selectedTopicName || currentQ.topic}
          expandedResultIds={expandedResultIds}
          toggleResultExpand={toggleResultExpand}
          onRetryFailed={handleRetryFailed}
          onStudyCurrentBatch={handleStudyCurrentBatch}
          onGoToQuestionList={handleGoToQuestionList}
          onBackToTopics={() => setView('topics')}
        />
      ) : (
        <QuizQuestionArena
          currentQ={currentQ}
          safeIndex={safeIndex}
          totalQuestions={currentBatch.length}
          selectedTopicName={selectedTopicName || currentQ.topic}
          userAnswer={userAnswer}
          setUserAnswer={setUserAnswer}
          loadingEval={loadingEval}
          evalResult={evalResult}
          isLast={isLast}
          isAiReady={Boolean(systemHealth.isAiReady)}
          onEvaluate={handleEvaluate}
          onNext={handleNext}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onBackToStudy={() => setView('study')}
          onGoToQuestionList={handleGoToQuestionList}
        />
      )}

      {/* Voice Modal with Continuous Batch Mode */}
      {isVoiceOpen && (
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
            setUserAnswer('');
          }}
          onBatchComplete={(evaluations) => {
            handleVoiceEvaluationComplete(evaluations);
          }}
        />
      )}
    </>
  );
};
