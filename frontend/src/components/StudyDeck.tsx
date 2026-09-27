import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { VoiceModal } from './VoiceModal';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import { StudyDeckHeader } from './study/StudyDeckHeader';
import { StudyFlashcard } from './study/StudyFlashcard';
import { StudyReaderBar } from './study/StudyReaderBar';
import { TutorMode } from './study/studyTypes';

export const StudyDeck: React.FC = () => {
  const {
    currentBatch,
    currentQuestionIndex,
    setQuestionIndex,
    setView,
    selectedTopicId,
    selectedTopicName,
    openRecapModal,
    openTopicQuestions,
    evaluationsMap,
    openReportModal,
    setQuestionEvaluation,
    updateTopicProgress,
    openTransactionLab,
    setBatch,
    startQuizWithQuestions
  } = useAppStore();

  const [isAutoHealing, setIsAutoHealing] = useState(false);
  const { config } = useInterviewConfig();
  const studyModality = config.studyModality || 'voice';

  // SOTA 2026 Auto-Healing: If page reloads with empty batch but valid selectedTopicId, restore questions automatically
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
          console.warn('Auto-healing batch failed:', err);
        })
        .finally(() => {
          setIsAutoHealing(false);
        });
    }
  }, [currentBatch, selectedTopicId, isAutoHealing, setBatch]);

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [voiceInitialIndex, setVoiceInitialIndex] = useState<number>(0);
  const [voiceModalSessionType, setVoiceModalSessionType] = useState<'interview' | 'tutor'>('interview');
  const [voiceModalTutorMode, setVoiceModalTutorMode] = useState<TutorMode>(() => {
    return (localStorage.getItem('interview_tutor_mode') as TutorMode) || 'deep_dive';
  });
  const [customPromptForTutor, setCustomPromptForTutor] = useState('');

  const openVoiceSession = (type: 'interview' | 'tutor', initialIdx: number, prompt: string = '') => {
    AudioPlayoutManager.warmup();
    setVoiceInitialIndex(initialIdx);
    setVoiceModalSessionType(type);
    setCustomPromptForTutor(prompt);
    setVoiceSessionId(`voice_session_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    setIsVoiceOpen(true);
  };

  const handleStartVoiceBlitz = () => {
    openVoiceSession('interview', 0, '');
  };

  const handleStartTextQuiz = () => {
    if (!currentBatch || currentBatch.length === 0) return;
    const currentQ = currentBatch[currentQuestionIndex] || currentBatch[0];
    startQuizWithQuestions(
      selectedTopicId || currentQ.topic,
      selectedTopicName || currentQ.topic,
      currentBatch
    );
  };

  const handleSelectTutorMode = (mode: TutorMode) => {
    setVoiceModalTutorMode(mode);
    try {
      localStorage.setItem('interview_tutor_mode', mode);
    } catch {}
  };

  // Global Keyboard Arrow Navigation (← Previous / Next →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (isVoiceOpen) return;
      if (e.key === 'ArrowRight' && currentBatch && currentQuestionIndex < currentBatch.length - 1) {
        e.preventDefault();
        setQuestionIndex(currentQuestionIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentQuestionIndex > 0) {
        e.preventDefault();
        setQuestionIndex(currentQuestionIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestionIndex, currentBatch, isVoiceOpen, setQuestionIndex]);

  if (isAutoHealing) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-pastel-accentViolet border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-pastel-muted">Восстановление изучаемой темы...</p>
      </div>
    );
  }

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Нет вопросов в выбранной порции.</p>
        <button
          onClick={() => setView('topics')}
          className="mt-4 px-4 py-2 bg-pastel-card border border-pastel-border rounded-xl text-sm font-semibold cursor-pointer"
        >
          Вернуться к выбору тем
        </button>
      </div>
    );
  }

  const currentQ = currentBatch[currentQuestionIndex];
  const isLast = currentQuestionIndex === currentBatch.length - 1;
  const activeEvaluation = evaluationsMap[currentQ.id];

  const handleRecapCurrentQuestion = () => {
    openRecapModal({
      questionIds: [currentQ.id],
      topicName: selectedTopicName || currentQ.topic,
      title: `Вопрос #${currentQ.num}: ${currentQ.question.slice(0, 40)}...`,
    });
  };

  const handleRecapBatch = () => {
    openRecapModal({
      questionIds: currentBatch.map((q) => q.id),
      topicName: selectedTopicName || currentQ.topic,
      title: `Порция: ${selectedTopicName || currentQ.topic} (${currentBatch.length} вопр.)`,
    });
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6 min-w-0">
      <StudyDeckHeader
        selectedTopicId={selectedTopicId}
        topicTitle={selectedTopicName || currentQ.topic}
        currentIndex={currentQuestionIndex}
        totalBatch={currentBatch.length}
        onBackToTopics={() => setView('topics')}
        onOpenTopicQuestions={() => {
          if (selectedTopicId) openTopicQuestions(selectedTopicId, selectedTopicName || currentQ.topic);
        }}
        onStartVoiceBlitz={handleStartVoiceBlitz}
        onRecapBatch={handleRecapBatch}
      />

      <StudyFlashcard
        currentQuestion={currentQ}
        currentIndex={currentQuestionIndex}
        activeEvaluation={activeEvaluation}
        voiceModalTutorMode={voiceModalTutorMode}
        onSelectTutorMode={handleSelectTutorMode}
        onOpenVoiceSession={(type, prompt) => openVoiceSession(type, currentQuestionIndex, prompt || '')}
        onOpenReportModal={openReportModal}
        onRecapQuestion={handleRecapCurrentQuestion}
        onOpenTransactionLab={openTransactionLab}
      />

      <StudyReaderBar
        currentIndex={currentQuestionIndex}
        totalBatch={currentBatch.length}
        questionNum={currentQ.num}
        isLast={isLast}
        studyModality={studyModality}
        onPrev={() => setQuestionIndex(currentQuestionIndex - 1)}
        onNext={() => setQuestionIndex(currentQuestionIndex + 1)}
        onStartVoiceBlitz={handleStartVoiceBlitz}
        onStartTextQuiz={handleStartTextQuiz}
      />

      {isVoiceOpen && voiceSessionId && (
        <VoiceModal
          key={voiceSessionId}
          isOpen={isVoiceOpen}
          onClose={() => {
            setIsVoiceOpen(false);
            setVoiceSessionId(null);
          }}
          questionId={currentQ.id}
          topic={selectedTopicName || currentQ.topic}
          currentQuestionText={currentQ.question}
          referenceAnswer={currentQ.answer}
          questionsBatch={currentBatch}
          initialQuestionIndex={voiceInitialIndex}
          onIndexChange={(newIdx) => {
            setQuestionIndex(newIdx);
            setVoiceInitialIndex(newIdx);
          }}
          initialSessionType={voiceModalSessionType}
          initialTutorMode={voiceModalTutorMode}
          customPromptOverride={customPromptForTutor}
          onBatchComplete={(evaluations: Record<string, any>) => {
            Object.entries(evaluations).forEach(([qId, evalData]: [string, any]) => {
              const numScore = typeof evalData.score === 'number' ? evalData.score : parseFloat(String(evalData.score)) || 0;
              const isMastered = evalData.isPassed && numScore >= 8;
              setQuestionEvaluation(qId, evalData);
              if (selectedTopicId) {
                updateTopicProgress(selectedTopicId, qId, isMastered, currentBatch.length);
              }
            });
          }}
        />
      )}
    </div>
  );
};
