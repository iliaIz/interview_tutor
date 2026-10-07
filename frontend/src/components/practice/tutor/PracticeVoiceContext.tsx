import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLiveAudioSession, LiveAudioSessionParams } from '../../../hooks/useLiveAudioSession';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { AudioPlayoutManager } from '../../../services/AudioPlayoutManager';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';
import { resolveTutorDomain } from './TutorDomain';
import { buildWorkspaceManifest } from '../../../utils/workspaceManifest';
import { usePracticeVoiceTelemetrySync } from './usePracticeVoiceTelemetrySync';

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
  syncEditorCode?: (code: string, fileName?: string, language?: string, immediate?: boolean) => void;
  injectActiveFocusGroundingFrame?: () => void;
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
    onError: (err) => console.error('Practice voice error:', err),
    onWhiteboardUpdate: (payload) => {
      useAppStore.getState().setWhiteboardState(payload);
    },
    getActiveCode: () => {
      const state = useAppStore.getState();
      const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
      return current?.content || '';
    },
    getActiveFileName: () => {
      const state = useAppStore.getState();
      const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
      return current?.path?.split('/').pop() || current?.path || 'Solution.java';
    },
    getActiveLanguage: () => 'java',
    enableGlobalSelection: true
  });

  usePracticeVoiceTelemetrySync(session);

  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    startSession,
    disconnectSession,
    toggleMic,
    finishManualTurn,
    sendTextMessage,
    handleBargeIn,
    playoutManagerRef
  } = session;

  const startPracticeSession = useCallback(async () => {
    try {
      const state = useAppStore.getState();
      const files = state.practiceWorkspaceFiles.length > 0 ? state.practiceWorkspaceFiles : practiceWorkspaceFiles;
      const activeIndex = typeof state.activeWorkspaceFileIndex === 'number' ? state.activeWorkspaceFileIndex : activeWorkspaceFileIndex;
      const currentFile = files[activeIndex] || files[0];
      const turnMode = interviewConfig.turnMode || 'auto';

      const domain = resolveTutorDomain({
        category: activePracticeChallenge?.category,
        track: activePracticeChallenge?.track,
        title: activePracticeChallenge?.title,
        hasActiveTxScenario: !!activeTransactionLabScenarioId
      });

      const DOMAIN_TOPICS: Record<string, string> = {
        lld: 'LLD архитектура и чистое проектирование на Java 21',
        transactions: 'Транзакции Spring Boot, распространение и аномалии БД',
        concurrency: 'Многопоточность, JMM и Project Loom',
        refactoring: 'Рефакторинг легаси-кода и швы по Физерсу',
        java21: 'Идиомы Java 21 LTS (Records, Sealed, Pattern Matching)',
        testing: 'Юнит-тестирование и мутации Java 21'
      };

      let topic = DOMAIN_TOPICS[domain] || DOMAIN_TOPICS.testing;
      let challengeCategory = activePracticeChallenge?.category || domain;
      let challengeTrack = activePracticeChallenge?.track || domain;
      let bugTitle = activePracticeChallenge?.title || 'Практическая задача';
      let bugExplanation = activePracticeChallenge?.instructionsMarkdown || '';
      let codeSnippet = currentFile?.content || '';

      if (activeTransactionLabScenarioId) {
        const txScenario =
          TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeTransactionLabScenarioId) ||
          TRANSACTION_LAB_SCENARIOS[0];
        challengeCategory = 'Spring Transactions';
        challengeTrack = 'spring_transactions';
        bugTitle = txScenario.title;
        bugExplanation = txScenario.problemStatement || '';
        codeSnippet = txScenario.services
          .map((s) => `// ${s.className}\n` + s.methods.map((m) => m.codeSnippet).join('\n\n'))
          .join('\n\n');
      }

      const activeArtifact = selectActiveWhiteboardArtifact(state);
      const revs = state.codeRevisions || [];
      const revSummary = revs.length > 0 ? revs.map((r) => ({ id: r.id, title: r.title })) : undefined;
      const workspaceManifest = buildWorkspaceManifest(files, activeIndex);
      const practiceSessionId = `session_practice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      await startSession({
        sessionId: practiceSessionId,
        sessionType: 'tutor',
        tutorMode: 'practice_pair',
        topic,
        challengeCategory,
        challengeTrack,
        challengeDomain: domain,
        bugTitle,
        bugExplanation,
        codeSnippet,
        workspaceManifest,
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

  const codeSyncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const focusGroundingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (codeSyncDebounceRef.current) clearTimeout(codeSyncDebounceRef.current);
      if (focusGroundingDebounceRef.current) clearTimeout(focusGroundingDebounceRef.current);
    };
  }, []);

  const syncEditorCode = useCallback((code: string, fileName?: string, language: string = 'java', immediate: boolean = false) => {
    if (!session.isConnected) return;

    if (codeSyncDebounceRef.current) {
      clearTimeout(codeSyncDebounceRef.current);
      codeSyncDebounceRef.current = null;
    }

    const performSync = () => {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{
              text: `📝 [АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ (${fileName || 'Solution.java'})]:\n\`\`\`${language}\n${code}\n\`\`\``
            }]
          }],
          turnComplete: false
        }
      });
    };

    if (immediate) {
      performSync();
    } else {
      codeSyncDebounceRef.current = setTimeout(performSync, 1500);
    }
  }, [session]);

  const injectActiveFocusGroundingFrame = useCallback(() => {
    if (!session.isConnected) return;

    if (focusGroundingDebounceRef.current) {
      clearTimeout(focusGroundingDebounceRef.current);
      focusGroundingDebounceRef.current = null;
    }

    focusGroundingDebounceRef.current = setTimeout(() => {
      const state = useAppStore.getState();
      const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
      if (!current) return;
      const fileName = current.path.split('/').pop() || current.path;
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{
              text: `🎯 [ФОКУС ВНИМАНИЯ]: Кандидат переключился на файл ${fileName}.\nСодержимое:\n\`\`\`java\n${current.content}\n\`\`\``
            }]
          }],
          turnComplete: false
        }
      });
    }, 300);
  }, [session]);

  // Synchronize active editor code into model context upon connection/reconnection
  useEffect(() => {
    if (session.isConnected) {
      const state = useAppStore.getState();
      const files = state.practiceWorkspaceFiles;
      const activeIndex = state.activeWorkspaceFileIndex;
      const current = files[activeIndex] || files[0];
      if (current?.content) {
        const fileName = current.path?.split('/').pop() || current.path || 'Solution.java';
        syncEditorCode(current.content, fileName, 'java', true);
      }
    }
  }, [session.isConnected, syncEditorCode]);

  const handleCentralButtonClick = useCallback(() => {
    const isPlaying = playoutManagerRef.current?.isPlaying() ?? false;
    if (isAiSpeaking || isPlaying) {
      handleBargeIn();
    } else if (interviewConfig.turnMode === 'manual' && isRecording) {
      finishManualTurn();
    } else {
      toggleMic();
    }
  }, [isAiSpeaking, playoutManagerRef, handleBargeIn, interviewConfig.turnMode, isRecording, finishManualTurn, toggleMic]);

  return (
    <PracticeVoiceContext.Provider
      value={{
        ...session,
        sendTextMessage,
        startPracticeSession,
        handleCentralButtonClick,
        syncEditorCode,
        injectActiveFocusGroundingFrame
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
