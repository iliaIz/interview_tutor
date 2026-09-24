/**
 * VoiceModal.tsx
 * Unified Headless Architecture Voice Interview & Socratic Tutoring Modal (SOTA Late 2026).
 * Single responsibility: modal coordinator & UI orchestrator (< 250 lines).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Settings, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { useLiveVoiceSession } from '../audio/useLiveVoiceSession';
import { VoiceEngineConfig } from '../audio/types';
import { VoiceEvaluationResult } from '../types/voice';
import { VoiceLobbyView } from './voice/VoiceLobbyView';
import { VoiceVerdictView } from './voice/VoiceVerdictView';
import { VoiceGrandFinaleView } from './voice/VoiceGrandFinaleView';
import { VoiceMicButton } from './voice/VoiceMicButton';
import { VoiceSubtitles } from './voice/VoiceSubtitles';
import { VoiceVisualizer } from './voice/VoiceVisualizer';

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
  onEvaluationComplete
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

  const session = useLiveVoiceSession();
  const {
    state,
    isMuted,
    rmsDb,
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

  // Handle incoming evaluation
  useEffect(() => {
    if (evaluation) {
      setBatchResults((prev) => ({ ...prev, [activeQuestionId]: evaluation }));
      onEvaluationComplete?.(evaluation);

      if (isBatchMode && activeBatchIndex + 1 < totalQuestions) {
        const nextIdx = activeBatchIndex + 1;
        setActiveBatchIndex(nextIdx);
        onIndexChange?.(nextIdx);
        setStage('verdict');
      } else if (isBatchMode && activeBatchIndex + 1 >= totalQuestions) {
        setStage('grand_finale');
        onBatchComplete?.(batchResults);
      } else {
        setStage('verdict');
      }
    }
  }, [evaluation]);

  const handleClose = () => {
    disconnect();
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
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
          <div className="flex flex-col flex-1 min-h-0 py-2">
            <p className="text-xs sm:text-sm text-slate-600 font-medium mb-3 line-clamp-2 px-1">
              {activeQuestionText}
            </p>

            <VoiceVisualizer rmsDb={rmsDb} isActive={state === 'AI_SPEAKING' || state === 'LISTENING'} color={state === 'AI_SPEAKING' ? 'rose' : 'emerald'} />
            <VoiceSubtitles turns={dialogueTurns} statusMessage={statusMessage} />
            <VoiceMicButton state={state} isMuted={isMuted} rmsDb={rmsDb} onClick={handleCentralButtonClick} onToggleMute={toggleMute} />

            {/* Candidate Text Fallback */}
            <form onSubmit={handleSendText} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Или напишите ответ текстом..."
                className="flex-1 bg-white/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs sm:text-sm font-medium hover:bg-slate-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {stage === 'verdict' && evaluation && (
          <VoiceVerdictView
            evaluation={evaluation}
            interviewConfig={interviewConfig}
            retryCurrentQuestionCleanly={startSession}
            onClose={handleClose}
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
      </div>
    </div>
  );
};
