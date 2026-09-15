import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLiveAudioSession, LiveAudioSessionParams } from '../../../hooks/useLiveAudioSession';
import { useAppStore } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { AudioPlayoutManager } from '../../../services/AudioPlayoutManager';

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
  playoutManagerRef: React.MutableRefObject<AudioPlayoutManager | null>;
  startPracticeSession: () => Promise<void>;
  handleCentralButtonClick: () => void;
}

const PracticeVoiceContext = createContext<PracticeVoiceContextType | null>(null);

export const PracticeVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activePracticeChallenge, practiceWorkspaceFiles, activeWorkspaceFileIndex } = useAppStore();
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
    playoutManagerRef
  } = session;

  const startPracticeSession = useCallback(async () => {
    try {
      const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];
      const turnMode = interviewConfig.turnMode || 'auto';

      const category = (activePracticeChallenge?.category || '').toLowerCase();
      const track = (activePracticeChallenge?.track || '').toLowerCase();
      const title = (activePracticeChallenge?.title || '').toLowerCase();

      let topic = 'Юнит-тестирование и мутации Java 21';
      let domain = 'testing';
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

      await startSession({
        sessionType: 'tutor',
        tutorMode: 'practice_pair',
        topic,
        challengeCategory: activePracticeChallenge?.category || domain,
        challengeTrack: activePracticeChallenge?.track || domain,
        challengeDomain: domain,
        bugTitle: activePracticeChallenge?.title || 'Практическая задача',
        bugExplanation: activePracticeChallenge?.instructionsMarkdown?.slice(0, 800) || '',
        codeSnippet: currentFile?.content || '',
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
