import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import type { TutorRole } from '@interview-prep/shared/tutor';
import { useLiveVoiceSession, AudioLevelSubscriber } from '../../../audio/useLiveVoiceSession';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useSelectionFocusStore } from '../../../store/useSelectionFocusStore';
import type { BugChallenge } from '../../BugChallengeCard';
import { buildPracticeSessionParams } from './practiceSessionParamsBuilder';
import { buildBugHuntSessionParams } from './bugHuntSessionParamsBuilder';

interface PracticeVoiceContextType {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  isError: boolean;
  lastError: string | null;
  statusMessage: string;
  disconnect: () => void;
  toggleMic: () => void;
  handleInteraction: () => void;
  sendTextMessage: (text: string, displayText?: string) => void;
  subscribeAudioLevel: AudioLevelSubscriber;
  startPracticeSession: () => Promise<void>;
  startPracticeSessionWithReview: (focusedFinding?: any) => Promise<void>;
  launchBugHuntSession: (challengeOverride?: BugChallenge | null, roleOverride?: TutorRole) => Promise<void>;
  syncEditorCode?: (code: string, fileName?: string, language?: string, immediate?: boolean) => void;
  injectActiveFocusGroundingFrame?: () => void;
}

const PracticeVoiceContext = createContext<PracticeVoiceContextType | null>(null);

export const PracticeVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);
  const activeTransactionLabScenarioId = useAppStore((s) => s.activeTransactionLabScenarioId);
  const { config: interviewConfig } = useInterviewConfig();
  const tutorPersona = usePracticeTutorStore((s) => s.persona);
  const setModality = usePracticeTutorStore((s) => s.setModality);
  const visitedBugIdsRef = useRef<Set<string>>(new Set());

  const session = useLiveVoiceSession({
    onError: (err) => console.error('Practice voice error:', err),
    onWhiteboardUpdate: (payload) => {
      useAppStore.getState().setWhiteboardState(payload);
    },
    onBugSolved: () => {
      const bugId = useAppStore.getState().activeBugHuntChallenge?.id;
      if (bugId) {
        useAppStore.getState().notifyBugHuntSolved(bugId);
      }
    },
    getActiveCode: () => {
      const state = useAppStore.getState();
      if (state.currentStudioTab === 'incidents' && state.activeBugHuntChallenge) {
        return state.activeBugHuntChallenge.codeSnippet || '';
      }
      const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
      return current?.content || '';
    },
    getActiveFileName: () => {
      const state = useAppStore.getState();
      if (state.currentStudioTab === 'incidents' && state.activeBugHuntChallenge) {
        return `${state.activeBugHuntChallenge.title || 'BugChallenge'}.${state.activeBugHuntChallenge.language || 'java'}`;
      }
      const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
      return current?.path?.split('/').pop() || current?.path || 'Solution.java';
    },
    getActiveLanguage: () => {
      const state = useAppStore.getState();
      if (state.currentStudioTab === 'incidents' && state.activeBugHuntChallenge) {
        return state.activeBugHuntChallenge.language || 'java';
      }
      return 'java';
    },
    enableGlobalSelection: true
  });

  const { connect, disconnect, toggleMic, handleInteraction, sendTextMessage, sendCustomFrame, subscribeAudioLevel } = session;

  const launchBugHuntSession = useCallback(async (challengeOverride?: BugChallenge | null, roleOverride?: TutorRole) => {
    try {
      const state = useAppStore.getState();
      const targetChallenge = challengeOverride ?? state.activeBugHuntChallenge;
      if (!targetChallenge) return;
      const role = roleOverride ?? usePracticeTutorStore.getState().tutorRole;
      const focus = useSelectionFocusStore.getState().activeFocus;
      const bugId = targetChallenge.id;
      const isRevisit = bugId ? visitedBugIdsRef.current.has(bugId) : false;
      if (bugId) visitedBugIdsRef.current.add(bugId);

      const params = buildBugHuntSessionParams({
        challenge: targetChallenge,
        tutorRole: role,
        interviewConfig,
        tutorPersona,
        activeArtifact: selectActiveWhiteboardArtifact(state),
        codeRevisions: state.codeRevisions || [],
        selectedCodeSnippet: focus?.text || null,
        cursorLine: focus?.startLine || null,
        isRevisit
      });
      await connect(params);
      setModality('voice');
    } catch (err) {
      console.error('Failed to start Bug Hunt Voice session:', err);
    }
  }, [interviewConfig, tutorPersona, connect, setModality]);

  const launchPracticeSession = useCallback(async (seniorReviewPayload?: any) => {
    try {
      const state = useAppStore.getState();
      const activeCtx = usePracticeTutorStore.getState().activeContext;
      if (state.currentStudioTab === 'incidents' && state.activeBugHuntChallenge && activeCtx?.arena === 'incidents') {
        await launchBugHuntSession(state.activeBugHuntChallenge);
        return;
      }
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
      await connect(params);
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
    connect,
    setModality,
    launchBugHuntSession
  ]);

  const startPracticeSession = useCallback(async () => launchPracticeSession(undefined), [launchPracticeSession]);

  const startPracticeSessionWithReview = useCallback(async (focusedFinding?: any) => {
    const report = useAppStore.getState().activePracticeReport;
    const seniorReviewPayload = report ? {
      overallScore: report.scoreBreakdown?.overallScore ?? 0,
      summaryReview: report.scoreBreakdown?.summaryReview || '',
      findings: report.concurrencyAnalysis?.findings || [],
      focusedFinding: focusedFinding || null
    } : undefined;
    return launchPracticeSession(seniorReviewPayload);
  }, [launchPracticeSession]);

  const codeSyncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => () => {
    if (codeSyncDebounceRef.current) clearTimeout(codeSyncDebounceRef.current);
  }, []);

  const syncEditorCode = useCallback((code: string, fileName?: string, language: string = 'java', immediate: boolean = false) => {
    if (!session.isConnected) return;
    if (codeSyncDebounceRef.current) {
      clearTimeout(codeSyncDebounceRef.current);
      codeSyncDebounceRef.current = null;
    }
    const performSync = () => {
      sendCustomFrame({
        type: 'workspace_file_update',
        path: fileName || 'Solution.java',
        content: code,
        language
      });
    };
    if (immediate) performSync();
    else codeSyncDebounceRef.current = setTimeout(performSync, 1000);
  }, [session.isConnected, sendCustomFrame]);

  const injectActiveFocusGroundingFrame = useCallback(() => {
    if (!session.isConnected) return;
    const state = useAppStore.getState();
    const current = state.practiceWorkspaceFiles[state.activeWorkspaceFileIndex] || state.practiceWorkspaceFiles[0];
    if (!current) return;
    const fileName = current.path.split('/').pop() || current.path;
    sendCustomFrame({ type: 'workspace_active_file_changed', path: fileName });
  }, [session.isConnected, sendCustomFrame]);

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
    return () => { window.removeEventListener('workspace_file_updated', handleWorkspaceFileUpdated); };
  }, [session.isConnected, syncEditorCode]);

  return (
    <PracticeVoiceContext.Provider
      value={{
        isConnected: session.isConnected,
        isAiSpeaking: session.isAiSpeaking,
        isRecording: session.isRecording,
        isMuted: session.isMuted,
        isUserSpeaking: session.isUserSpeaking,
        isPauseHolding: session.isPauseHolding,
        isError: session.isError,
        lastError: session.lastError,
        statusMessage: session.statusMessage,
        disconnect,
        toggleMic,
        handleInteraction,
        sendTextMessage,
        subscribeAudioLevel,
        startPracticeSession,
        startPracticeSessionWithReview,
        launchBugHuntSession,
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
  if (!ctx) throw new Error('usePracticeVoice must be used within a PracticeVoiceProvider');
  return ctx;
};
