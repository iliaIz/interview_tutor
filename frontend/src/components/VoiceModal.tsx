import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, Layers, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { useAppStore, Question } from '../store/useAppStore';
import { useLiveAudioSession } from '../hooks/useLiveAudioSession';
import { useBatchInterviewSession } from '../hooks/useBatchInterviewSession';
import { useSpeechCoachingTelemetry } from '../hooks/useSpeechCoachingTelemetry';
import { AcousticTelemetryService, QuestionStructureFormat } from '../services/AcousticTelemetryService';
import { triggerSuccessConfetti } from '../utils/confetti';
import { EvaluationResult } from '../types/voice';

// Sub-views and Drawers
import { VoiceLobbyView } from './voice/VoiceLobbyView';
import { VoiceActiveInterviewView } from './voice/VoiceActiveInterviewView';
import { VoiceTransitionView } from './voice/VoiceTransitionView';
import { VoiceVerdictView } from './voice/VoiceVerdictView';
import { VoiceGrandFinaleView } from './voice/VoiceGrandFinaleView';
import { VoiceTutorView } from './voice/VoiceTutorView';
import { VoiceSettingsDrawer } from './VoiceSettingsDrawer';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { WhiteboardDrawer } from './WhiteboardDrawer';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  questionsBatch?: Question[];
  initialQuestionIndex?: number;
  initialSessionType?: 'interview' | 'tutor';
  initialTutorMode?: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  customPromptOverride?: string;
  onIndexChange?: (newIndex: number) => void;
  onBatchComplete?: (results: Record<string, EvaluationResult>) => void;
  onEvaluationComplete?: (result: EvaluationResult) => void;
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
  // Reference-counted body scroll lock (SOTA Invariant 6)
  useBodyScrollLock(isOpen);

  const { activeWhiteboardState, isWhiteboardOpen, setIsWhiteboardOpen } = useAppStore();
  const { config: interviewConfig, setConfig: setInterviewConfig } = useInterviewConfig();

  // Session Type & Stage State
  const [sessionType, setSessionType] = useState<'interview' | 'tutor'>(initialSessionType);
  const [tutorMode, setTutorMode] = useState<'deep_dive' | 'socratic' | 'eli5' | 'free_chat'>(initialTutorMode);
  const [stage, setStage] = useState<'lobby' | 'active' | 'transition' | 'verdict' | 'grand_finale'>('lobby');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  // Multimodal text input
  const [inputText, setInputText] = useState('');
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Batch Interview Hook
  const batch = useBatchInterviewSession({
    questionsBatch,
    initialQuestionIndex,
    questionId,
    topic,
    currentQuestionText,
    referenceAnswer,
    onIndexChange,
    onBatchComplete,
    onAutoAdvance: (nextIdx) => {
      void startLiveSessionForQuestion(nextIdx);
    }
  });

  // 2. Speech Coaching & Telemetry Hook
  const coaching = useSpeechCoachingTelemetry();

  const questionStructure: QuestionStructureFormat = useMemo(() => {
    return AcousticTelemetryService.classifyQuestionStructure(batch.activeQuestionText, batch.activeTopic);
  }, [batch.activeQuestionText, batch.activeTopic]);

  // 3. Unified Live Audio Session Hook (Single Source of Truth)
  const audio = useLiveAudioSession({
    sessionType,
    tutorMode,
    topic: batch.activeTopic,
    questionId: batch.activeQuestionId,
    questionText: batch.activeQuestionText,
    referenceAnswer: batch.activeReferenceAnswer,
    voice: interviewConfig.voice,
    userGender: interviewConfig.userGender,
    turnMode: interviewConfig.turnMode,
    liveModel: interviewConfig.liveModel,
    persona: interviewConfig.persona,
    targetGrade: interviewConfig.targetGrade,
    strategy: sessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
    maxProbes: interviewConfig.maxProbes,
    deepDive: Boolean(interviewConfig.deepDive || (sessionType === 'tutor' && tutorMode === 'deep_dive')),
    liveCoaching: Boolean(interviewConfig.liveCoaching || sessionType === 'tutor'),
    questionIndex: batch.activeBatchIndex,
    totalQuestions: batch.totalQuestions,
    customPrompt: customPromptOverride || interviewConfig.customPromptOverride,
    initialUserMessage: customPromptOverride,
    sessionId: batch.sessionIdRef.current,
    onWhiteboardUpdate: (payload) => {
      useAppStore.getState().setWhiteboardState(payload as any);
      useAppStore.getState().setIsWhiteboardOpen(true);
    },
    onEvaluationCompleted: (evalData) => {
      if (sessionType === 'tutor') return;
      handleEvaluationFinalized(evalData);
    },
    onError: (err) => console.error('Voice session error:', err),
    onDisconnect: () => {}
  });

  // Finalize Evaluation & Decide Next Screen
  const handleEvaluationFinalized = useCallback(
    (evalData: EvaluationResult) => {
      setEvaluation(evalData);
      const recorded = batch.recordEvaluationResult(batch.activeQuestionId, evalData, batch.activeBatchIndex);
      onEvaluationComplete?.(evalData);

      // Trigger background Deepgram STT with buffered Int16 PCM
      const pcmBase64 = audio.getRecordedPcmBase64();
      if (pcmBase64) {
        void coaching.triggerBackgroundStt(pcmBase64);
        audio.clearRecordedPcm();
      }

      if (recorded.hasMoreQuestions) {
        setStage('transition');
        batch.startTransitionCountdown((nextIdx) => {
          void startLiveSessionForQuestion(nextIdx);
        });
      } else if (recorded.isFinalQuestion) {
        setStage('grand_finale');
        triggerSuccessConfetti();
      } else {
        setStage('verdict');
        if ((evalData.score ?? 0) >= 80) triggerSuccessConfetti();
      }
    },
    [batch, audio, coaching, onEvaluationComplete]
  );

  // Start Live Session for specific question
  const startLiveSessionForQuestion = useCallback(
    async (targetIndex: number, isRetry = false) => {
      batch.stopTransitionCountdown();
      const clamped = batch.selectQuestionIndex(targetIndex);
      setStage('active');
      setEvaluation(null);
      coaching.resetCoachingTurn();
      audio.clearRecordedPcm();

      const targetQ = questionsBatch?.[clamped] || {
        id: batch.activeQuestionId,
        topic: batch.activeTopic,
        question: batch.activeQuestionText,
        answer: batch.activeReferenceAnswer
      };

      await audio.startSession({
        questionIndex: clamped,
        totalQuestions: batch.totalQuestions,
        questionId: targetQ.id,
        topic: targetQ.topic,
        questionText: targetQ.question,
        referenceAnswer: targetQ.answer,
        isRetry
      });
    },
    [batch, coaching, audio, questionsBatch]
  );

  const startLiveInterview = useCallback(async () => {
    batch.ensureSessionId();
    await startLiveSessionForQuestion(batch.activeBatchIndex);
  }, [batch, startLiveSessionForQuestion]);

  const handleResumeSavedSession = useCallback(async () => {
    const targetIdx = batch.resumeSavedSession();
    await startLiveSessionForQuestion(targetIdx);
  }, [batch, startLiveSessionForQuestion]);

  const handleStartFreshSession = useCallback(async () => {
    const startIdx = batch.startFreshBatch();
    await startLiveSessionForQuestion(startIdx);
  }, [batch, startLiveSessionForQuestion]);

  const retryCurrentQuestion = useCallback(async () => {
    await startLiveSessionForQuestion(batch.activeBatchIndex, true);
  }, [batch.activeBatchIndex, startLiveSessionForQuestion]);

  const handleClose = useCallback(async () => {
    batch.stopTransitionCountdown();
    await audio.stopSession();
    onClose();
  }, [batch, audio, onClose]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      batch.stopTransitionCountdown();
      void audio.stopSession();
    };
  }, []);

  if (!isOpen) return null;

  // Grand finale cumulative summary metrics
  const evaluatedResults = Object.values(batch.batchResults);
  const totalEvaluated = evaluatedResults.length;
  const avgScore =
    totalEvaluated > 0
      ? Math.round(evaluatedResults.reduce((acc, r) => acc + (r.score ?? 0), 0) / totalEvaluated)
      : 0;
  const passedCount = evaluatedResults.filter((r) => r.isPassed).length;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto modal-overscroll-contain">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25 }}
        className={`bg-white rounded-3xl p-3.5 sm:p-6 border border-pastel-border shadow-2xl relative overflow-hidden flex flex-col my-auto transition-all duration-300 modal-overscroll-contain ${
          sessionType === 'tutor'
            ? 'max-w-5xl w-full max-h-[96dvh] sm:max-h-[92vh]'
            : 'max-w-xl w-full max-h-[96dvh] sm:max-h-[92vh]'
        }`}
      >
        {/* Soft Ambient Auras */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-pastel-border/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-pastel-text text-xs sm:text-base truncate">
                  {sessionType === 'tutor' ? 'AI-Тьютор • Deep Dive' : 'Gemini Live Interviewer'}
                </h3>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    audio.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-pastel-muted truncate">
                {batch.isBatchMode && (
                  <span className="font-bold text-pastel-accentViolet flex items-center gap-1 shrink-0">
                    <Layers className="w-3 h-3" />
                    {batch.activeBatchIndex + 1}/{batch.totalQuestions}
                  </span>
                )}
                <span className="truncate">
                  {stage === 'lobby'
                    ? sessionType === 'tutor'
                      ? 'Лобби ментора'
                      : 'Лобби'
                    : stage === 'active'
                    ? sessionType === 'tutor'
                      ? 'Диалог с наставником'
                      : 'Live диалог'
                    : stage === 'transition'
                    ? 'Автопереход'
                    : stage === 'grand_finale'
                    ? '🎉 Итоги'
                    : 'Результаты'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer shrink-0"
            title="Закрыть модальное окно"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Progress Bar */}
        {batch.isBatchMode && stage !== 'lobby' && stage !== 'grand_finale' && (
          <div className="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar shrink-0">
            {questionsBatch?.map((q, idx) => {
              const res = batch.batchResults[q.id];
              const isCurrent = idx === batch.activeBatchIndex;
              return (
                <div
                  key={q.id}
                  className={`h-1.5 flex-1 min-w-[12px] rounded-full transition-all ${
                    isCurrent
                      ? 'bg-pastel-accentViolet shadow-xs ring-2 ring-pastel-accentViolet/30'
                      : res
                      ? res.isPassed
                        ? 'bg-emerald-400'
                        : 'bg-rose-400'
                      : 'bg-slate-200'
                  }`}
                  title={`Вопрос #${q.num || idx + 1}: ${q.question.slice(0, 45)}...`}
                />
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW ROUTING (LOBBY | ACTIVE | TRANSITION | VERDICT | GRAND FINALE)       */}
        {/* ========================================================================= */}
        {sessionType === 'tutor' && (stage === 'lobby' || stage === 'active') ? (
          <VoiceTutorView
            stage={stage}
            activeTopic={batch.activeTopic}
            activeQuestionNum={batch.activeQuestionNum}
            activeBatchIndex={batch.activeBatchIndex}
            totalQuestions={batch.totalQuestions}
            isBatchMode={batch.isBatchMode}
            activeQuestionText={batch.activeQuestionText}
            activeReferenceAnswer={batch.activeReferenceAnswer}
            tutorMode={tutorMode}
            setTutorMode={setTutorMode}
            startLiveInterview={startLiveInterview}
            systemHealth={{ isAiReady: true }}
            setIsSettingsOpen={setIsSettingsOpen}
            interviewConfig={interviewConfig}
            isAiSpeaking={audio.isAiSpeaking}
            isThinking={audio.isThinking}
            thinkingStage={audio.thinkingStage}
            isRecording={audio.isRecording}
            isUserSpeaking={audio.isUserSpeaking}
            isPauseHolding={audio.isPauseHolding}
            rmsDb={audio.rmsDb}
            onInterruption={audio.handleBargeIn}
            triggerEndTurn={audio.finishManualTurn}
            toggleMic={audio.toggleMic}
            dialogueTurns={audio.dialogueTurns}
            inputText={inputText}
            setInputText={setInputText}
            handleInputKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
                e.preventDefault();
                void audio.sendTextMessage(inputText.trim());
                setInputText('');
              }
            }}
            handleSendCustomText={(textToSend) => {
              const text = (textToSend !== undefined ? textToSend : inputText).trim();
              if (text) {
                void audio.sendTextMessage(text);
                setInputText('');
              }
            }}
            isMuted={audio.isMuted}
            toggleMute={audio.toggleMute}
            retryCurrentQuestionCleanly={retryCurrentQuestion}
            onClose={handleClose}
            onSwitchToInterview={() => {
              setSessionType('interview');
              void startLiveInterview();
            }}
            textInputRef={textInputRef}
            isSessionPaused={audio.isSessionPaused}
            onToggleSessionPause={() => {
              if (audio.isSessionPaused) audio.resumeSession();
              else audio.pauseSession();
            }}
            onSwitchQuestion={(targetIdx) => {
              void startLiveSessionForQuestion(targetIdx);
            }}
          />
        ) : (
          <>
            {/* Context Question Banner */}
            {stage !== 'grand_finale' && batch.activeQuestionText && (
              <div className="mt-3.5 p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/70 text-xs shadow-2xs shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-pastel-accentViolet flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
                    {batch.isBatchMode
                      ? `Вопрос #${batch.activeQuestionNum} (${batch.activeBatchIndex + 1}/${batch.totalQuestions}):`
                      : 'Вопрос темы:'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold shadow-2xs ${questionStructure.badgeStyle}`}
                  >
                    {questionStructure.title}
                  </span>
                </div>
                <p className="text-pastel-text leading-relaxed font-bold">{batch.activeQuestionText}</p>
                {questionStructure.description && (
                  <p className="text-[10px] text-pastel-muted mt-1 leading-snug">
                    {questionStructure.description}
                  </p>
                )}
              </div>
            )}

            {/* Stage 1: Lobby */}
            {stage === 'lobby' && (
              <VoiceLobbyView
                interviewConfig={interviewConfig}
                handleConfigChange={setInterviewConfig}
                isBatchMode={batch.isBatchMode}
                totalQuestions={batch.totalQuestions}
                speechCoachingMode={coaching.speechCoachingMode}
                updateSpeechCoachingMode={coaching.updateSpeechCoachingMode}
                canResumeSession={batch.hasSavedSession}
                activeBatchSession={useAppStore.getState().activeBatchSession}
                handleResumeSession={handleResumeSavedSession}
                handleStartFresh={handleStartFreshSession}
                startLiveInterview={startLiveInterview}
                systemHealth={{ isAiReady: true }}
                setIsSettingsOpen={setIsSettingsOpen}
              />
            )}

            {/* Stage 2: Active Interview */}
            {stage === 'active' && (
              <VoiceActiveInterviewView
                isSessionPaused={audio.isSessionPaused}
                onToggleSessionPause={() => {
                  if (audio.isSessionPaused) audio.resumeSession();
                  else audio.pauseSession();
                }}
                interviewConfig={interviewConfig}
                isBatchMode={batch.isBatchMode}
                activeBatchIndex={batch.activeBatchIndex}
                totalQuestions={batch.totalQuestions}
                isConnectionLost={false}
                onManualReconnect={() => {
                  void startLiveSessionForQuestion(batch.activeBatchIndex);
                }}
                onReturnToLobby={() => setStage('lobby')}
                isAiSpeaking={audio.isAiSpeaking}
                isThinking={audio.isThinking}
                isRecording={audio.isRecording}
                isUserSpeaking={audio.isUserSpeaking}
                isPauseHolding={audio.isPauseHolding}
                thinkingStage={audio.thinkingStage}
                rmsDb={audio.rmsDb}
                onBargeIn={audio.handleBargeIn}
                onEndTurn={audio.finishManualTurn}
                onToggleMic={audio.toggleMic}
                onInstantRestEvalFallback={() => {
                  // Instant REST eval fallback if needed
                  fetch('/api/eval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      questionId: batch.activeQuestionId,
                      topic: batch.activeTopic,
                      question: batch.activeQuestionText,
                      referenceAnswer: batch.activeReferenceAnswer,
                      userAnswer: coaching.liveTranscript || 'Устный ответ кандидата'
                    })
                  })
                    .then((res) => res.json())
                    .then((resData) => handleEvaluationFinalized(resData))
                    .catch(() => {});
                }}
                speechCoachingMode={coaching.speechCoachingMode}
                liveClarityMetrics={coaching.liveClarityMetrics}
                questionStructure={questionStructure}
                dialogueTurns={audio.dialogueTurns}
                inputText={inputText}
                setInputText={setInputText}
                onSendCustomText={(txt) => {
                  const text = (txt !== undefined ? txt : inputText).trim();
                  if (text) {
                    void audio.sendTextMessage(text);
                    setInputText('');
                  }
                }}
                isMuted={audio.isMuted}
                onToggleMute={audio.toggleMute}
                isSubmitting={false}
                onSurrenderAndExplain={() => {
                  void audio.sendTextMessage('Сдаюсь. Объясни, пожалуйста, устройство под капотом.');
                }}
                onRetryCleanly={retryCurrentQuestion}
                onEndInterviewImmediately={() => {
                  batch.stopTransitionCountdown();
                  void audio.stopSession();
                  setStage('lobby');
                }}
              />
            )}

            {/* Stage 2.5: Transition Screen */}
            {stage === 'transition' && evaluation && (
              <VoiceTransitionView
                evaluation={evaluation}
                activeBatchIndex={batch.activeBatchIndex}
                totalQuestions={batch.totalQuestions}
                nextQuestionNum={questionsBatch?.[batch.activeBatchIndex + 1]?.num ?? batch.activeBatchIndex + 2}
                countdown={batch.countdown}
                isTransitionPaused={batch.isTransitionPaused}
                interviewConfig={interviewConfig}
                dialogueTurns={audio.dialogueTurns}
                deepgramTranscript={coaching.deepgramTranscript}
                onAdvance={(nextIdx) => {
                  void startLiveSessionForQuestion(nextIdx);
                }}
                onRetry={retryCurrentQuestion}
                onTogglePause={batch.toggleTransitionPause}
                onFinishInterview={() => {
                  setStage('grand_finale');
                  triggerSuccessConfetti();
                }}
                onConfigChange={setInterviewConfig}
              />
            )}

            {/* Stage 3: Single Verdict */}
            {stage === 'verdict' && evaluation && (
              <VoiceVerdictView
                evaluation={evaluation}
                interviewConfig={interviewConfig}
                retryCurrentQuestionCleanly={retryCurrentQuestion}
                onClose={handleClose}
              />
            )}

            {/* Stage 4: Grand Finale */}
            {stage === 'grand_finale' && (
              <VoiceGrandFinaleView
                totalEvaluated={totalEvaluated}
                totalQuestions={batch.totalQuestions}
                activeTopic={batch.activeTopic}
                avgScore={avgScore}
                passedCount={passedCount}
                questionsBatch={questionsBatch}
                allResults={batch.batchResults}
                handleRetry={handleStartFreshSession}
                onClose={handleClose}
              />
            )}
          </>
        )}
      </motion.div>

      {/* Drawers */}
      <VoiceSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={interviewConfig}
        onChangeConfig={setInterviewConfig}
        questionText={batch.activeQuestionText}
        referenceAnswer={batch.activeReferenceAnswer}
      />

      <MemoryRadarDrawer isOpen={isRadarOpen} onClose={() => setIsRadarOpen(false)} />

      <WhiteboardDrawer
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        state={activeWhiteboardState}
      />
    </div>,
    document.body
  );
};
