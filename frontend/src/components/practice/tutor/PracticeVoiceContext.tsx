import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLiveVoiceSession, LiveAudioSessionParams } from '../../../audio/useLiveVoiceSession';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { buildPracticeSessionParams } from './practiceSessionParamsBuilder';

interface PracticeVoiceContextType {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  isError?: boolean;
  lastError?: string | null;
  rmsDb: number;
  statusMessage: string;
  aiTranscript: string;
  startSession: (params: LiveAudioSessionParams) => Promise<void>;
  disconnectSession: () => void;
  toggleMic: () => void;
  finishManualTurn: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  startPracticeSession: () => Promise<void>;
  startPracticeSessionWithReview: (focusedFinding?: any) => Promise<void>;
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

  const session = useLiveVoiceSession({
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
    handleInteraction
  } = session;

  const launchPracticeSession = useCallback(async (seniorReviewPayload?: any) => {
    try {
      const state = useAppStore.getState();
      const files = state.practiceWorkspaceFiles.length > 0 ? state.practiceWorkspaceFiles : practiceWorkspaceFiles;
      const activeIndex = typeof state.activeWorkspaceFileIndex === 'number' ? state.activeWorkspaceFileIndex : activeWorkspaceFileIndex;
      const params = buildPracticeSessionParams({
        activePracticeChallenge,
        files,
        activeFileIndex: activeIndex,
        activeTransactionLabScenarioId,
        activeArtifact: selectActiveWhiteboardArtifact(state),
        codeRevisions: state.codeRevisions || [],
        interviewConfig,
        tutorPersona,
        seniorReviewPayload,
        academyBreadcrumbContext: state.academyBreadcrumbContext
      });
      await startSession(params);
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

  const startPracticeSession = useCallback(async () => {
    return launchPracticeSession(undefined);
  }, [launchPracticeSession]);

  const startPracticeSessionWithReview = useCallback(async (focusedFinding?: any) => {
    const state = useAppStore.getState();
    const report = state.activePracticeReport;
    const seniorReviewPayload = report ? {
      overallScore: report.scoreBreakdown?.overallScore ?? 0,
      summaryReview: report.scoreBreakdown?.summaryReview || '',
      findings: report.concurrencyAnalysis?.findings || [],
      focusedFinding: focusedFinding || null
    } : undefined;
    return launchPracticeSession(seniorReviewPayload);
  }, [launchPracticeSession]);

  // SOTA Late 2026: Zero live audio channel pollution. Code is read on-demand via read_file tool.
  const codeSyncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (codeSyncDebounceRef.current) clearTimeout(codeSyncDebounceRef.current);
    };
  }, []);

  const syncEditorCode = useCallback((code: string, fileName?: string, language: string = 'java', immediate: boolean = false) => {
    if (!session.isConnected) return;

    if (codeSyncDebounceRef.current) {
      clearTimeout(codeSyncDebounceRef.current);
      codeSyncDebounceRef.current = null;
    }

    const performSync = () => {
      // SOTA Late 2026: Update backend memory for read_file tool resolution.
      // NEVER inject clientContent text turns into Gemini Live audio stream!
      session.sendCustomFrame?.({
        type: 'workspace_file_update',
        path: fileName || 'Solution.java',
        content: code,
        language
      });
    };

    if (immediate) {
      performSync();
    } else {
      codeSyncDebounceRef.current = setTimeout(performSync, 1000);
    }
  }, [session]);

  const injectActiveFocusGroundingFrame = useCallback(() => {
    if (!session.isConnected) return;
    const state = useAppStore.getState();
    const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
    if (!current) return;
    const fileName = current.path.split('/').pop() || current.path;
    session.sendCustomFrame?.({
      type: 'workspace_active_file_changed',
      path: fileName
    });
  }, [session]);

  // Synchronize external file updates (e.g. from IntelliJ IDEA bridge or Whiteboard)
  useEffect(() => {
    if (!session.isConnected) return;
    const handleWorkspaceFileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; content: string; language?: string }>;
      if (customEvent.detail) {
        const { path, content, language = 'java' } = customEvent.detail;
        syncEditorCode(content, path, language, true);
      }
    };
    window.addEventListener('workspace_file_updated', handleWorkspaceFileUpdated);
    return () => {
      window.removeEventListener('workspace_file_updated', handleWorkspaceFileUpdated);
    };
  }, [session.isConnected, syncEditorCode]);

  const handleCentralButtonClick = useCallback(() => {
    handleInteraction();
  }, [handleInteraction]);

  return (
    <PracticeVoiceContext.Provider
      value={{
        ...session,
        sendTextMessage,
        startPracticeSession,
        startPracticeSessionWithReview,
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
