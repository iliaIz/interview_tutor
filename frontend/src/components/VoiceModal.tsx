/**
 * VoiceModal.tsx
 * Unified Headless Architecture Voice Interview & Socratic Tutoring Modal (SOTA Late 2026).
 * Single responsibility: modal coordinator & UI orchestrator (< 250 lines).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { useAppStore } from '../store/useAppStore';
import { WhiteboardDrawer } from './WhiteboardDrawer';
import { useLiveVoiceSession } from '../audio/useLiveVoiceSession';
import { VoiceEngineConfig } from '../audio/types';
import { VoiceEvaluationResult } from '../types/voice';
import { VoiceLobbyView } from './voice/VoiceLobbyView';
import { VoiceActiveView } from './voice/VoiceActiveView';
import { VoiceVerdictView } from './voice/VoiceVerdictView';
import { VoiceGrandFinaleView } from './voice/VoiceGrandFinaleView';
import { VoiceModalHeader } from './voice/VoiceModalHeader';
import { QuestionItem, VoiceModalProps } from './voice/voiceModalTypes';

export type { QuestionItem, VoiceModalProps };

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  questionId,
  topic = 'Java Core & Spring',
  currentQuestionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = '',
  questionsBatch,
  initialQuestionIndex = 0,
  initialSessionType = 'interview',
  initialTutorMode = 'deep_dive',
  customPromptOverride,
  onIndexChange,
  onBatchComplete,
  onEvaluationComplete,
  onTutorComplete
}) => {
  useBodyScrollLock(isOpen);
  const { config: interviewConfig, setConfig: setInterviewConfig } = useInterviewConfig();
  const [stage, setStage] = useState<'lobby' | 'active' | 'verdict' | 'grand_finale'>(() => {
    return initialSessionType === 'tutor' ? 'active' : 'lobby';
  });
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, VoiceEvaluationResult>>({});
  const [textInput, setTextInput] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sync internal activeBatchIndex when parent updates initialQuestionIndex
  useEffect(() => {
    if (initialQuestionIndex !== undefined && initialQuestionIndex !== activeBatchIndex) {
      setActiveBatchIndex(initialQuestionIndex);
    }
  }, [initialQuestionIndex]);

  const isBatchMode = Boolean(questionsBatch && questionsBatch.length > 0);
  const totalQuestions = isBatchMode && questionsBatch ? questionsBatch.length : 1;
  const currentQ = isBatchMode && questionsBatch ? questionsBatch[activeBatchIndex] : null;
  const activeQuestionId = currentQ?.id || questionId || 'Q_DEFAULT';
  const activeTopic = currentQ?.topic || topic;
  const activeQuestionText = currentQ?.question || currentQuestionText;
  const activeReferenceAnswer = currentQ?.answer || referenceAnswer;

  const isWhiteboardOpen = useAppStore((s) => s.isWhiteboardOpen);
  const setIsWhiteboardOpen = useAppStore((s) => s.setIsWhiteboardOpen);
  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);
  const activeBatchSession = useAppStore((s) => s.activeBatchSession);
  const saveBatchSessionCheckpoint = useAppStore((s) => s.saveBatchSessionCheckpoint);
  const clearBatchSession = useAppStore((s) => s.clearBatchSession);

  const hasAutoStartedRef = useRef<boolean>(false);
  const isConnectingRef = useRef<boolean>(false);

  const session = useLiveVoiceSession();
  const {
    state,
    isMuted,
    rmsDb,
    isDraining,
    isTransientFiltered,
    statusMessage,
    dialogueTurns,
    evaluation,
    error,
    connect,
    disconnect,
    toggleMute,
    handleCentralButtonClick,
    sendTextMessage
  } = session;

  const startSessionForIndex = useCallback(async (targetIndex: number, isRetryAttempt = false) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    try {
      setStage('active');
      const targetQ = isBatchMode && questionsBatch ? questionsBatch[targetIndex] : null;
      const qId = targetQ?.id || questionId || 'Q_DEFAULT';
      const qTopic = targetQ?.topic || topic;
      const qText = targetQ?.question || currentQuestionText;
      const qAnswer = targetQ?.answer || referenceAnswer;

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const config: VoiceEngineConfig = {
        sessionId,
        questionId: qId,
        topic: qTopic,
        questionText: qText,
        referenceAnswer: qAnswer,
        sessionType: initialSessionType,
        tutorMode: initialSessionType === 'tutor' ? initialTutorMode : undefined,
        voice: interviewConfig.voice || 'Kore',
        turnMode: interviewConfig.turnMode || 'auto',
        liveModel: interviewConfig.liveModel || 'gemini-live-v3',
        vadPauseMs: interviewConfig.vadPauseMs ?? 1800,
        enableSilenceClarification: interviewConfig.enableSilenceClarification ?? false,
        persona: interviewConfig.persona || 'mentor',
        targetGrade: interviewConfig.targetGrade || 'L5_SENIOR',
        strategy: initialSessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
        customPrompt: customPromptOverride,
        questionIndex: targetIndex,
        totalQuestions,
        isRetry: isRetryAttempt
      };
      await connect(config);
    } finally {
      isConnectingRef.current = false;
    }
  }, [
    isBatchMode,
    questionsBatch,
    questionId,
    topic,
    currentQuestionText,
    referenceAnswer,
    initialSessionType,
    initialTutorMode,
    interviewConfig,
    customPromptOverride,
    totalQuestions,
    connect
  ]);

  // Auto-start session for Socratic Tutor when launched from study flashcard
  useEffect(() => {
    if (isOpen && initialSessionType === 'tutor' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      void startSessionForIndex(activeBatchIndex, false);
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
      isConnectingRef.current = false;
    }
  }, [isOpen, initialSessionType, activeBatchIndex, startSessionForIndex]);

  const pendingEvaluationRef = useRef<VoiceEvaluationResult | null>(null);

  // Handle incoming evaluation: save result and wait for physical audio to drain
  useEffect(() => {
    if (evaluation) {
      pendingEvaluationRef.current = evaluation;
      setBatchResults((prev) => ({ ...prev, [activeQuestionId]: evaluation }));
      onEvaluationComplete?.(evaluation);

      if (isBatchMode && questionsBatch) {
        saveBatchSessionCheckpoint(`batch_${activeTopic}_${Date.now()}`, {
          topicName: activeTopic,
          questions: questionsBatch as any,
          currentIndex: activeBatchIndex,
          results: { ...batchResults, [activeQuestionId]: evaluation },
          isComplete: activeBatchIndex + 1 >= totalQuestions
        });
      }

      // Dual-Sided Handshake: if physical audio has already drained, switch immediately
      if (!isDraining && state !== 'AI_SPEAKING') {
        setStage('verdict');
      }
    }
  }, [
    evaluation,
    activeQuestionId,
    onEvaluationComplete,
    isDraining,
    state,
    isBatchMode,
    questionsBatch,
    activeTopic,
    activeBatchIndex,
    batchResults,
    totalQuestions,
    saveBatchSessionCheckpoint
  ]);

  // When physical audio finishes draining, transition to verdict if evaluation was received
  useEffect(() => {
    if (pendingEvaluationRef.current && stage === 'active') {
      if (!isDraining && state !== 'AI_SPEAKING') {
        setStage('verdict');
      }
    }
  }, [isDraining, state, stage]);

  const handleNextQuestion = useCallback(() => {
    if (isConnectingRef.current) return;
    disconnect();
    pendingEvaluationRef.current = null;
    const nextIdx = activeBatchIndex + 1;
    setActiveBatchIndex(nextIdx);
    if (onIndexChange) {
      requestAnimationFrame(() => onIndexChange(nextIdx));
    }
    void startSessionForIndex(nextIdx, false);
  }, [activeBatchIndex, onIndexChange, disconnect, startSessionForIndex]);

  const handleRetryCurrentQuestion = useCallback(() => {
    if (isConnectingRef.current) return;
    disconnect();
    pendingEvaluationRef.current = null;
    void startSessionForIndex(activeBatchIndex, true);
  }, [activeBatchIndex, disconnect, startSessionForIndex]);

  const handleFinishBatch = useCallback(() => {
    clearBatchSession();
    setStage('grand_finale');
    onBatchComplete?.(batchResults);
  }, [batchResults, onBatchComplete, clearBatchSession]);

  const handleFinishTutor = useCallback(() => {
    disconnect();
    pendingEvaluationRef.current = null;
    hasAutoStartedRef.current = false;
    isConnectingRef.current = false;
    onTutorComplete?.(activeTopic, activeQuestionId);
    setStage(initialSessionType === 'tutor' ? 'active' : 'lobby');
    onClose();
  }, [disconnect, onTutorComplete, activeTopic, activeQuestionId, initialSessionType, onClose]);

  const handleClose = () => {
    disconnect();
    pendingEvaluationRef.current = null;
    hasAutoStartedRef.current = false;
    isConnectingRef.current = false;
    setStage(initialSessionType === 'tutor' ? 'active' : 'lobby');
    onClose();
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextMessage(textInput);
    setTextInput('');
  };

  // Ergonomic Shortcuts: Spacebar (PTT / Central Click) and 'C' (Cough Mute)
  useEffect(() => {
    if (!isOpen || stage !== 'active') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'Space' && !e.repeat && state === 'LISTENING') {
        e.preventDefault();
        handleCentralButtonClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, state, toggleMute, handleCentralButtonClick]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#FFF0F5]/95 via-white/95 to-slate-50/95 border border-rose-100/80 rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col max-h-[92vh] overflow-hidden">
        <VoiceModalHeader
          activeTopic={activeTopic}
          isBatchMode={isBatchMode}
          activeBatchIndex={activeBatchIndex}
          totalQuestions={totalQuestions}
          isWhiteboardOpen={isWhiteboardOpen}
          activeWhiteboardState={activeWhiteboardState}
          onToggleWhiteboard={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
          onClose={handleClose}
        />

        {/* Dynamic Stage Render */}
        {stage === 'lobby' && (
          <VoiceLobbyView
            interviewConfig={interviewConfig}
            handleConfigChange={setInterviewConfig}
            isBatchMode={isBatchMode}
            totalQuestions={totalQuestions}
            speechCoachingMode="adaptive"
            updateSpeechCoachingMode={() => {}}
            canResumeSession={Boolean(activeBatchSession && !activeBatchSession.isComplete)}
            activeBatchSession={activeBatchSession}
            handleResumeSession={() => {
              const resumeIdx = activeBatchSession?.currentIndex ?? 0;
              setActiveBatchIndex(resumeIdx);
              void startSessionForIndex(resumeIdx, false);
            }}
            handleStartFresh={() => {
              clearBatchSession();
              setActiveBatchIndex(0);
              void startSessionForIndex(0, false);
            }}
            startLiveInterview={() => void startSessionForIndex(activeBatchIndex, false)}
            systemHealth={{ isAiReady: true }}
            setIsSettingsOpen={setIsSettingsOpen}
          />
        )}

        {stage === 'active' && (
          <VoiceActiveView
            activeQuestionText={activeQuestionText}
            isPendingEvaluation={Boolean(pendingEvaluationRef.current)}
            initialSessionType={initialSessionType}
            isBatchMode={isBatchMode}
            activeBatchIndex={activeBatchIndex}
            totalQuestions={totalQuestions}
            onNextQuestion={isBatchMode && activeBatchIndex + 1 < totalQuestions ? handleNextQuestion : undefined}
            onFinishTutor={handleFinishTutor}
            state={state}
            isMuted={isMuted}
            rmsDb={rmsDb}
            isDraining={isDraining}
            isTransientFiltered={isTransientFiltered}
            statusMessage={statusMessage}
            dialogueTurns={dialogueTurns}
            onCentralButtonClick={handleCentralButtonClick}
            onToggleMute={toggleMute}
            textInput={textInput}
            setTextInput={setTextInput}
            onSendText={handleSendText}
          />
        )}

        {stage === 'verdict' && evaluation && (
          <VoiceVerdictView
            evaluation={evaluation}
            interviewConfig={interviewConfig}
            retryCurrentQuestionCleanly={handleRetryCurrentQuestion}
            onClose={handleClose}
            onNextQuestion={isBatchMode && activeBatchIndex + 1 < totalQuestions ? handleNextQuestion : undefined}
            nextQuestionIndex={activeBatchIndex + 1}
            totalQuestions={totalQuestions}
            onFinishBatch={isBatchMode && activeBatchIndex + 1 >= totalQuestions ? handleFinishBatch : undefined}
          />
        )}

        {stage === 'grand_finale' && (
          <VoiceGrandFinaleView
            totalEvaluated={Object.keys(batchResults).length}
            totalQuestions={totalQuestions}
            activeTopic={activeTopic}
            avgScore={
              Object.values(batchResults).reduce((sum, r) => sum + (r?.score || 0), 0) /
              (Object.keys(batchResults).length || 1)
            }
            passedCount={Object.values(batchResults).filter((r) => r?.isPassed).length}
            allResults={batchResults}
            handleRetry={() => {
              setBatchResults({});
              clearBatchSession();
              setActiveBatchIndex(0);
              setStage(initialSessionType === 'tutor' ? 'active' : 'lobby');
              if (initialSessionType === 'tutor') {
                hasAutoStartedRef.current = true;
                void startSessionForIndex(0, false);
              }
            }}
            onClose={handleClose}
          />
        )}
        <WhiteboardDrawer
          isOpen={isWhiteboardOpen}
          onClose={() => setIsWhiteboardOpen(false)}
          state={activeWhiteboardState}
        />
      </div>
    </div>
  );
};
