import { useState, useEffect, useCallback, useRef } from 'react';
import { useInterviewConfig } from '../../hooks/useInterviewConfig';
import { useAppStore } from '../../store/useAppStore';
import { useLiveVoiceSession, LiveAudioSessionParams } from '../../audio/useLiveVoiceSession';
import { VoiceEvaluationResult } from '../../types/voice';
import { QuestionItem, VoiceModalProps } from './voiceModalTypes';
import { useVoiceModalShortcuts } from './useVoiceModalShortcuts';

export type VoiceModalStage = 'lobby' | 'active' | 'verdict' | 'grand_finale';

export interface UseVoiceModalCoordinatorReturn {
  stage: VoiceModalStage;
  setStage: (stage: VoiceModalStage) => void;
  activeBatchIndex: number;
  setActiveBatchIndex: (index: number) => void;
  batchResults: Record<string, VoiceEvaluationResult>;
  setBatchResults: React.Dispatch<React.SetStateAction<Record<string, VoiceEvaluationResult>>>;
  textInput: string;
  setTextInput: (text: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCribSheetOpen: boolean;
  setIsCribSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isWhiteboardOpen: boolean;
  setIsWhiteboardOpen: (open: boolean) => void;
  isMuted: boolean;
  handleToggleMute: () => void;
  isBatchMode: boolean;
  totalQuestions: number;
  activeTopic: string;
  activeQuestionText: string;
  activeReferenceAnswer: string;
  interviewConfig: any;
  setInterviewConfig: any;
  activeWhiteboardState: any;
  activeBatchSession: any;
  clearBatchSession: () => void;
  state: any;
  metrics: any;
  statusMessage: string;
  dialogueTurns: any[];
  evaluation: VoiceEvaluationResult | null;
  pendingEvaluationRef: React.MutableRefObject<VoiceEvaluationResult | null>;
  startSessionForIndex: (targetIndex: number, isRetryAttempt?: boolean) => Promise<void>;
  handleNextQuestion: () => void;
  handleRetryCurrentQuestion: () => void;
  handleFinishBatch: () => void;
  handleFinishTutor: () => void;
  handleClose: () => void;
  handleSendText: (e: React.FormEvent) => void;
  handleInteraction: () => void;
}

export function useVoiceModalCoordinator(props: VoiceModalProps): UseVoiceModalCoordinatorReturn {
  const {
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
    vadPauseMs,
    onIndexChange,
    onBatchComplete,
    onEvaluationComplete,
    onTutorComplete
  } = props;

  const { config: interviewConfig, setConfig: setInterviewConfig } = useInterviewConfig();
  const [stage, setStage] = useState<VoiceModalStage>(() => {
    return initialSessionType === 'tutor' ? 'active' : 'lobby';
  });
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(initialQuestionIndex);
  const [batchResults, setBatchResults] = useState<Record<string, VoiceEvaluationResult>>({});
  const [textInput, setTextInput] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCribSheetOpen, setIsCribSheetOpen] = useState<boolean>(false);

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
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const {
    state,
    metrics,
    statusMessage,
    dialogueTurns,
    activeScorecard,
    connect,
    disconnect,
    toggleMic,
    handleInteraction,
    sendCustomFrame
  } = useLiveVoiceSession();
  const evaluation = activeScorecard as VoiceEvaluationResult | null;

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    toggleMic();
  }, [toggleMic]);

  const startSessionForIndex = useCallback(async (targetIndex: number, isRetryAttempt = false) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    try {
      setStage('active');
      const targetQ = isBatchMode && questionsBatch ? questionsBatch[targetIndex] : null;

      const config: LiveAudioSessionParams = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        questionId: targetQ?.id || questionId || 'Q_DEFAULT',
        topic: targetQ?.topic || topic,
        questionText: targetQ?.question || currentQuestionText,
        referenceAnswer: targetQ?.answer || referenceAnswer,
        sessionType: initialSessionType,
        tutorMode: initialSessionType === 'tutor' ? initialTutorMode : undefined,
        voice: interviewConfig.voice,
        userGender: interviewConfig.userGender,
        turnMode: interviewConfig.turnMode,
        liveModel: interviewConfig.liveModel,
        temperature: 1.0,
        vadPauseMs: vadPauseMs ?? interviewConfig.vadPauseMs,
        enableSilenceClarification: interviewConfig.enableSilenceClarification,
        persona: interviewConfig.persona,
        targetGrade: interviewConfig.targetGrade,
        strategy: initialSessionType === 'tutor' ? 'socratic_tutoring' : interviewConfig.strategy,
        strictness: interviewConfig.strictness,
        deepDive: interviewConfig.deepDive,
        liveCoaching: interviewConfig.liveCoaching,
        maxProbes: interviewConfig.maxProbes,
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
    vadPauseMs,
    totalQuestions,
    connect
  ]);

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

  useEffect(() => {
    if (!sendCustomFrame || !isOpen) return;
    const handleWorkspaceFileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; content: string; language?: string }>;
      if (customEvent.detail) {
        const { path, content, language = 'java' } = customEvent.detail;
        sendCustomFrame({
          type: 'workspace_file_update',
          path: path || 'Whiteboard.java',
          content,
          language
        });
      }
    };
    window.addEventListener('workspace_file_updated', handleWorkspaceFileUpdated);
    return () => {
      window.removeEventListener('workspace_file_updated', handleWorkspaceFileUpdated);
    };
  }, [sendCustomFrame, isOpen]);

  const pendingEvaluationRef = useRef<VoiceEvaluationResult | null>(null);

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
    }
  }, [
    evaluation,
    activeQuestionId,
    onEvaluationComplete,
    isBatchMode,
    questionsBatch,
    activeTopic,
    activeBatchIndex,
    batchResults,
    totalQuestions,
    saveBatchSessionCheckpoint
  ]);

  useEffect(() => {
    if (pendingEvaluationRef.current && stage === 'active' && state !== 'AI_SPEAKING') {
      setStage('verdict');
    }
  }, [state, stage, evaluation]);

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

  const resetAndClose = useCallback((onBeforeClose?: () => void) => {
    disconnect();
    pendingEvaluationRef.current = null;
    hasAutoStartedRef.current = false;
    isConnectingRef.current = false;
    onBeforeClose?.();
    setStage(initialSessionType === 'tutor' ? 'active' : 'lobby');
    onClose();
  }, [disconnect, initialSessionType, onClose]);

  const handleFinishTutor = useCallback(() => {
    resetAndClose(() => onTutorComplete?.(activeTopic, activeQuestionId));
  }, [resetAndClose, onTutorComplete, activeTopic, activeQuestionId]);

  const handleClose = useCallback(() => {
    resetAndClose();
  }, [resetAndClose]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    setTextInput('');
  };

  useVoiceModalShortcuts({
    isOpen,
    stage,
    state,
    onToggleMute: handleToggleMute,
    onInteraction: handleInteraction
  });

  return {
    stage,
    setStage,
    activeBatchIndex,
    setActiveBatchIndex,
    batchResults,
    setBatchResults,
    textInput,
    setTextInput,
    isSettingsOpen,
    setIsSettingsOpen,
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
    activeReferenceAnswer,
    interviewConfig,
    setInterviewConfig,
    activeWhiteboardState,
    activeBatchSession,
    clearBatchSession,
    state,
    metrics,
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
  };
}
