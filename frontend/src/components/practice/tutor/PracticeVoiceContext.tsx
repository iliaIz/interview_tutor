import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLiveAudioSession, LiveAudioSessionParams } from '../../../hooks/useLiveAudioSession';
import { useAppStore, selectActiveWhiteboardArtifact } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { AudioPlayoutManager } from '../../../services/AudioPlayoutManager';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';
import { MutantResult } from '../../../types/practice';

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
    activeTransactionLabScenarioId,
    latestSandboxResult,
    latestMutationResult,
    latestTxEvaluation
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
      const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];
      const turnMode = interviewConfig.turnMode || 'auto';

      let topic = 'Юнит-тестирование и мутации Java 21';
      let domain = 'testing';
      let challengeCategory = activePracticeChallenge?.category || domain;
      let challengeTrack = activePracticeChallenge?.track || domain;
      let bugTitle = activePracticeChallenge?.title || 'Практическая задача';
      let bugExplanation = activePracticeChallenge?.instructionsMarkdown || '';
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
        bugExplanation = txScenario.problemStatement || '';
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
  }, [session]);

  // Reactive test execution telemetry sync into Live Voice WebSocket
  const lastSandboxSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestSandboxResult) return;
    const now = Date.now();
    if (now - lastSandboxSyncTimeRef.current < 1000) return;
    lastSandboxSyncTimeRef.current = now;

    let telemetryText = '';
    if (!latestSandboxResult.isCompilable) {
      const err = latestSandboxResult.syntaxErrors?.[0]?.errorMessage || latestSandboxResult.error || 'Ошибка компиляции';
      telemetryText = `❌ [ОШИБКА КОМПИЛЯЦИИ]: ${err}`;
    } else {
      const failed = latestSandboxResult.testResults?.filter(t => t.status !== 'PASSED') || [];
      if (failed.length > 0) {
        telemetryText = `❌ [ТЕСТЫ ПРОВАЛЕНЫ (${failed.length}/${latestSandboxResult.testResults.length})]:\n` +
          failed.slice(0, 3).map(t => `• [${t.testName}] ${t.failureReason || 'провален'}`).join('\n');
      } else {
        telemetryText = `✅ [ВСЕ UNIT-ТЕСТЫ ПРОШЛИ УСПЕШНО] (${latestSandboxResult.testResults.length}/${latestSandboxResult.testResults.length})`;
      }
      if (latestSandboxResult.concurrencyHarness?.deadlockDetected) {
        telemetryText += '\n⚠️ [КРИТИЧЕСКАЯ ОШИБКА]: Обнаружен взаимный дедлок потоков (Deadlock Detected).';
      }
      if (latestSandboxResult.concurrencyHarness?.raceConditionDetected) {
        telemetryText += '\n⚠️ [ВНИМАНИЕ]: Обнаружено состояние гонки данных (Race Condition).';
      }
    }

    if (telemetryText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: telemetryText }]
          }],
          turnComplete: false
        }
      });
    }
  }, [session.isConnected, latestSandboxResult]);

  // Reactive PITest mutation results sync
  const lastMutationSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestMutationResult) return;
    const now = Date.now();
    if (now - lastMutationSyncTimeRef.current < 1000) return;
    lastMutationSyncTimeRef.current = now;

    let mutationText = '';
    if (!latestMutationResult.baselinePassed) {
      mutationText = `⚠️ [PITest Baseline Failed]: Тесты не прошли на исходном коде: ${latestMutationResult.error || 'ошибка'}`;
    } else if (!latestMutationResult.passedThreshold) {
      mutationText = `⚠️ [РЕЗУЛЬТАТЫ PITest]: Скор ${latestMutationResult.mutationScore.toFixed(0)}% (порог >= ${latestMutationResult.requiredScore}%). Выжило мутантов: ${latestMutationResult.survivedCount} из ${latestMutationResult.totalMutants}.`;
      if (latestMutationResult.mutantResults && latestMutationResult.mutantResults.length > 0) {
        const survived = latestMutationResult.mutantResults.filter((m: MutantResult) => m.status === 'SURVIVED').slice(0, 3);
        if (survived.length > 0) {
          mutationText += '\nВыжившие мутанты:\n' + survived.map((m: MutantResult) => `• Строка ${m.line}: ${m.name} (${m.description || m.mutatorType || 'мутация'})`).join('\n');
        }
      }
    } else {
      mutationText = `🏆 [PITest: ВСЕ МУТАНТЫ УНИЧТОЖЕНЫ!]: Скор 100%, порог пройден.`;
    }

    if (mutationText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: mutationText }]
          }],
          turnComplete: false
        }
      });
    }
  }, [session.isConnected, latestMutationResult]);

  // Reactive Transaction Lab evaluation sync
  const lastTxSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestTxEvaluation) return;
    const now = Date.now();
    if (now - lastTxSyncTimeRef.current < 1000) return;
    lastTxSyncTimeRef.current = now;

    let txText = '';
    if (latestTxEvaluation.isPassed) {
      txText = `🏆 [ТРАНЗАКЦИИ: READY FOR PRODUCTION]: Оценка ${latestTxEvaluation.overallScore}/100. Все аномалии устранены.`;
    } else {
      txText = `⚠️ [ДЕФЕКТЫ ТРАНЗАКЦИЙ (${latestTxEvaluation.overallScore}/100)]:\n${latestTxEvaluation.summary}`;
      const methodViolations = Object.values(latestTxEvaluation.methodResults || {}).flatMap(m =>
        m.violations.map(v => `• Метод ${m.methodId}: ${v}`)
      ).slice(0, 3);
      if (methodViolations.length > 0) {
        txText += '\n' + methodViolations.join('\n');
      }
    }

    if (txText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [{
            role: 'user',
            parts: [{ text: txText }]
          }],
          turnComplete: false
        }
      });
    }
  }, [session.isConnected, latestTxEvaluation]);

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

