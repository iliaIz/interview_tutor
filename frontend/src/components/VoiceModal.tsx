/**
 * VoiceModal.tsx
 * Unified Headless Architecture Voice Interview & Socratic Tutoring Modal (SOTA Late 2026).
 * Single responsibility: modal coordinator & UI orchestrator (< 250 lines).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Settings, Sparkles, AlertCircle, RotateCcw, Code2 } from 'lucide-react';
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

export interface QuestionItem {
  id: string;
  topic?: string;
  question: string;
  answer?: string;
  num?: number;
}

export interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  questionsBatch?: QuestionItem[];
  initialQuestionIndex?: number;
  initialSessionType?: 'interview' | 'tutor';
  initialTutorMode?: string;
  customPromptOverride?: string;
  onIndexChange?: (newIndex: number) => void;
  onBatchComplete?: (batchResults: Record<string, VoiceEvaluationResult>) => void;
  onEvaluationComplete?: (evaluation: VoiceEvaluationResult) => void;
  onTutorComplete?: (topic: string, questionId: string) => void;
}

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
  const [stage, setStage] = useState<'lobby' | 'active' | 'verdict' | 'grand_finale'>('lobby');
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, VoiceEvaluationResult>>({});
  const [textInput, setTextInput] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

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

  const session = useLiveVoiceSession();
  const {
    state,
    isMuted,
    rmsDb,
    isDraining,
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

  const startSession = useCallback(async () => {
    setStage('active');
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const config: VoiceEngineConfig = {
      sessionId,
      questionId: activeQuestionId,
      topic: activeTopic,
      questionText: activeQuestionText,
      referenceAnswer: activeReferenceAnswer,
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
      questionIndex: activeBatchIndex,
      totalQuestions
    };
    await connect(config);
  }, [
    activeQuestionId,
    activeTopic,
    activeQuestionText,
    activeReferenceAnswer,
    initialSessionType,
    initialTutorMode,
    interviewConfig,
    customPromptOverride,
    activeBatchIndex,
    totalQuestions,
    connect
  ]);

  const pendingEvaluationRef = useRef<VoiceEvaluationResult | null>(null);

  // Handle incoming evaluation: save result and wait for physical audio to drain
  useEffect(() => {
    if (evaluation) {
      pendingEvaluationRef.current = evaluation;
      setBatchResults((prev) => ({ ...prev, [activeQuestionId]: evaluation }));
      onEvaluationComplete?.(evaluation);

      // Dual-Sided Handshake: if physical audio has already drained, switch immediately
      if (!isDraining && state !== 'AI_SPEAKING') {
        setStage('verdict');
      }
    }
  }, [evaluation, activeQuestionId, onEvaluationComplete, isDraining, state]);

  // When physical audio finishes draining, transition to verdict if evaluation was received
  useEffect(() => {
    if (pendingEvaluationRef.current && stage === 'active') {
      if (!isDraining && state !== 'AI_SPEAKING') {
        setStage('verdict');
      }
    }
  }, [isDraining, state, stage]);

  const handleNextQuestion = useCallback(() => {
    disconnect();
    pendingEvaluationRef.current = null;
    const nextIdx = activeBatchIndex + 1;
    setActiveBatchIndex(nextIdx);
    onIndexChange?.(nextIdx);
    setTimeout(() => {
      startSession();
    }, 100);
  }, [activeBatchIndex, onIndexChange, disconnect, startSession]);

  const handleFinishBatch = useCallback(() => {
    setStage('grand_finale');
    onBatchComplete?.(batchResults);
  }, [batchResults, onBatchComplete]);

  const handleFinishTutor = useCallback(() => {
    disconnect();
    pendingEvaluationRef.current = null;
    onTutorComplete?.(activeTopic, activeQuestionId);
    setStage('lobby');
    onClose();
  }, [disconnect, onTutorComplete, activeTopic, activeQuestionId, onClose]);

  const handleClose = () => {
    disconnect();
    pendingEvaluationRef.current = null;
    setStage('lobby');
    onClose();
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextMessage(textInput);
    setTextInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#FFF0F5]/95 via-white/95 to-slate-50/95 border border-rose-100/80 rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-rose-100/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
            <h2 className="font-bold text-slate-800 text-sm sm:text-base tracking-tight truncate max-w-[260px] sm:max-w-md">
              {activeTopic}
            </h2>
            {isBatchMode && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-700 text-xs font-semibold">
                {activeBatchIndex + 1} / {totalQuestions}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
              title="Интерактивная доска кода"
              className={`p-1.5 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                isWhiteboardOpen || activeWhiteboardState
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-rose-50/70 hover:text-rose-600 hover:border-rose-200'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">Доска кода</span>
              {activeWhiteboardState && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Stage Render */}
        {stage === 'lobby' && (
          <VoiceLobbyView
            interviewConfig={interviewConfig}
            handleConfigChange={setInterviewConfig}
            isBatchMode={isBatchMode}
            totalQuestions={totalQuestions}
            speechCoachingMode="adaptive"
            updateSpeechCoachingMode={() => {}}
            canResumeSession={false}
            activeBatchSession={null}
            handleResumeSession={() => {}}
            handleStartFresh={() => {}}
            startLiveInterview={startSession}
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
            retryCurrentQuestionCleanly={startSession}
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
              setActiveBatchIndex(0);
              setStage('lobby');
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
