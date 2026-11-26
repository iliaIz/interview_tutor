/**
 * VoiceModal.tsx
 * Unified Headless Architecture Voice Interview & Socratic Tutoring Modal (SOTA Late 2026).
 * Single responsibility: declarative modal shell & UI orchestrator (< 150 lines).
 */

import React from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { WhiteboardDrawer } from './WhiteboardDrawer';
import { VoiceLobbyView } from './voice/VoiceLobbyView';
import { VoiceActiveView } from './voice/VoiceActiveView';
import { VoiceVerdictView } from './voice/VoiceVerdictView';
import { VoiceGrandFinaleView } from './voice/VoiceGrandFinaleView';
import { VoiceModalHeader } from './voice/VoiceModalHeader';
import { QuestionItem, VoiceModalProps } from './voice/voiceModalTypes';
import { VoiceCribSheetDrawer } from './voice/VoiceCribSheetDrawer';
import { useVoiceModalCoordinator } from './voice/useVoiceModalCoordinator';

export type { QuestionItem, VoiceModalProps };

export const VoiceModal: React.FC<VoiceModalProps> = (props) => {
  const { isOpen } = props;
  useBodyScrollLock(isOpen);

  const {
    stage,
    setStage,
    activeBatchIndex,
    setActiveBatchIndex,
    batchResults,
    setBatchResults,
    textInput,
    setTextInput,
    isCribSheetOpen,
    setIsCribSheetOpen,
    isWhiteboardOpen,
    setIsWhiteboardOpen,
    isMuted,
    handleToggleMute,
    isBatchMode,
    totalQuestions,
    activeTopic,
    activeQuestionText,
    interviewConfig,
    setInterviewConfig,
    activeWhiteboardState,
    activeBatchSession,
    clearBatchSession,
    state,
    subscribeAudioLevel,
    statusMessage,
    dialogueTurns,
    evaluation,
    pendingEvaluationRef,
    startSessionForIndex,
    handleNextQuestion,
    handleRetryCurrentQuestion,
    handleFinishBatch,
    handleFinishTutor,
    handleClose,
    handleSendText,
    handleInteraction
  } = useVoiceModalCoordinator(props);

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
          isCribSheetOpen={isCribSheetOpen}
          onToggleCribSheet={() => setIsCribSheetOpen(!isCribSheetOpen)}
          onClose={handleClose}
        />

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
          />
        )}

        {stage === 'active' && (
          <VoiceActiveView
            activeQuestionText={activeQuestionText}
            isPendingEvaluation={Boolean(pendingEvaluationRef.current)}
            initialSessionType={props.initialSessionType}
            isBatchMode={isBatchMode}
            activeBatchIndex={activeBatchIndex}
            totalQuestions={totalQuestions}
            onNextQuestion={isBatchMode && activeBatchIndex + 1 < totalQuestions ? handleNextQuestion : undefined}
            onFinishTutor={handleFinishTutor}
            state={state}
            isMuted={isMuted}
            subscribeAudioLevel={subscribeAudioLevel}
            isDraining={false}
            isTransientFiltered={false}
            statusMessage={statusMessage}
            dialogueTurns={dialogueTurns}
            onCentralButtonClick={handleInteraction}
            onToggleMute={handleToggleMute}
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
              setStage(props.initialSessionType === 'tutor' ? 'active' : 'lobby');
              if (props.initialSessionType === 'tutor') {
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

        <VoiceCribSheetDrawer
          isOpen={isCribSheetOpen}
          onClose={() => setIsCribSheetOpen(false)}
        />
      </div>
    </div>
  );
};
