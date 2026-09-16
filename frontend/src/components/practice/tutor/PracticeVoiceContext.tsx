import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLiveAudioSession, LiveAudioSessionParams } from '../../../hooks/useLiveAudioSession';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { AudioPlayoutManager } from '../../../services/AudioPlayoutManager';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';

interface PracticeVoiceContextType {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  statusMessage: string;
  aiTranscript: string;
  startSession: (params: LiveAudioSessionParams) => Promise<void>;
  disconnectSession: () => void;
  toggleMic: () => void;
  finishManualTurn: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  playoutManagerRef: React.MutableRefObject<AudioPlayoutManager | null>;
  startPracticeSession: () => Promise<void>;
  handleCentralButtonClick: () => void;
}

const PracticeVoiceContext = createContext<PracticeVoiceContextType | null>(null);

export const PracticeVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    activeTransactionLabScenarioId
  } = useAppStore();
  const { config: interviewConfig } = useInterviewConfig();
  const { persona: tutorPersona, setModality } = usePracticeTutorStore();

  const session = useLiveAudioSession({
    onError: (err) => console.error('Practice voice error:', err)
  });

  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    startSession,
    disconnectSession,
    toggleMic,
    finishManualTurn,
    sendTextMessage,
    playoutManagerRef
  } = session;

  const startPracticeSession = useCallback(async () => {
    try {
      const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];
      const turnMode = interviewConfig.turnMode || 'auto';

      let topic = 'Юнит-тестирование и мутации Java 21';
      let domain = 'testing';
      let challengeCategory = activePracticeChallenge?.category || domain;
      let challengeTrack = activePracticeChallenge?.track || domain;
      let bugTitle = activePracticeChallenge?.title || 'Практическая задача';
      let bugExplanation = activePracticeChallenge?.instructionsMarkdown?.slice(0, 800) || '';
      let codeSnippet = currentFile?.content || '';

      if (activeTransactionLabScenarioId) {
        const txScenario =
          TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeTransactionLabScenarioId) ||
          TRANSACTION_LAB_SCENARIOS[0];
        domain = 'transactions';
        topic = 'Транзакции Spring Boot, распространение и аномалии БД';
        challengeCategory = 'Spring Transactions';
        challengeTrack = 'spring_transactions';
        bugTitle = txScenario.title;
        bugExplanation = txScenario.problemStatement?.slice(0, 800) || '';
        codeSnippet = txScenario.services
          .map((s) => `// ${s.className}\n` + s.methods.map((m) => m.codeSnippet).join('\n\n'))
          .join('\n\n');
      } else {
        const category = (activePracticeChallenge?.category || '').toLowerCase();
        const track = (activePracticeChallenge?.track || '').toLowerCase();
        const title = (activePracticeChallenge?.title || '').toLowerCase();

        if (
          category.includes('lld') ||
          track.includes('lld') ||
          title.includes('rate limiter') ||
          title.includes('matching engine') ||
          title.includes('parking lot') ||
          title.includes('cache') ||
          category.includes('machine coding')
        ) {
          domain = 'lld';
          topic = 'LLD архитектура и чистое проектирование на Java 21';
        } else if (category.includes('transaction') || track.includes('transaction')) {
          domain = 'transactions';
          topic = 'Транзакции Spring Boot и аномалии БД';
        }
      }

      const activeArtifact = selectActiveWhiteboardArtifact(useAppStore.getState());
      const revs = useAppStore.getState().codeRevisions || [];
      const revSummary = revs.length > 0 ? revs.map((r) => ({ id: r.id, title: r.title })) : undefined;

      await startSession({
        sessionType: 'tutor',
        tutorMode: 'practice_pair',
        topic,
        challengeCategory,
        challengeTrack,
        challengeDomain: domain,
        bugTitle,
        bugExplanation,
        codeSnippet,
        activeCodeArtifact: activeArtifact
          ? {
              id: activeArtifact.id,
              title: activeArtifact.title,
              language: activeArtifact.language,
              code: activeArtifact.code
            }
          : undefined,
        codeRevisionsSummary: revSummary,
        voice: interviewConfig.voice || 'Kore',
        userGender: interviewConfig.userGender || 'female',
        turnMode,
        liveModel: interviewConfig.liveModel,
        vadPauseMs: interviewConfig.vadPauseMs ?? 1800,
        tutorPersona,
        strategy: 'socratic_tutoring'
      });
      setModality('voice');
    } catch (err) {
      console.error('Failed to start Live Tutor session:', err);
    }
  }, [
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    activeTransactionLabScenarioId,
    interviewConfig,
    tutorPersona,
    startSession,
    setModality
  ]);

  const handleCentralButtonClick = useCallback(() => {
    if (isAiSpeaking && playoutManagerRef.current) {
      playoutManagerRef.current.handleInterruption();
    } else if (interviewConfig.turnMode === 'manual' && isRecording) {
      finishManualTurn();
    } else {
      toggleMic();
    }
  }, [isAiSpeaking, playoutManagerRef, interviewConfig.turnMode, isRecording, finishManualTurn, toggleMic]);

  return (
    <PracticeVoiceContext.Provider
      value={{
        ...session,
        sendTextMessage,
        startPracticeSession,
        handleCentralButtonClick
      }}
    >
      {children}
    </PracticeVoiceContext.Provider>
  );
};

export const usePracticeVoice = (): PracticeVoiceContextType => {
  const ctx = useContext(PracticeVoiceContext);
  if (!ctx) {
    throw new Error('usePracticeVoice must be used within a PracticeVoiceProvider');
  }
  return ctx;
};

