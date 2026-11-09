import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { TRANSACTION_LAB_SCENARIOS } from '../../data/transactionLabCatalog';
import {
  TransactionScenario,
  TransactionAnnotationConfig,
  ScenarioEvaluationResult
} from '../../types/transactionLab';
import { TransactionValidator } from '../../services/transactionValidator';
import {
  saveTxLabLocalDraft,
  getTxLabLocalDraft,
  removeTxLabLocalDraft,
  syncTxLabDraftWithCloud,
  fetchTxLabDraftFromCloud
} from '../../services/transactionLabDraftStorage';
import { TransactionLabHeader } from './TransactionLabHeader';
import { TransactionServiceEditor } from './TransactionServiceEditor';
import { TransactionScenarioSelector } from './TransactionScenarioSelector';
import { TransactionTimelineScrubber } from './TransactionTimelineScrubber';
import { HikariPoolSlotMeter } from './HikariPoolSlotMeter';
import { TransactionVerdictCard } from './TransactionVerdictCard';
import { TransactionCompassSheet } from './compass/TransactionCompassSheet';
import { PracticeTutorDrawer } from './tutor/PracticeTutorDrawer';
import { WhiteboardDrawer } from '../WhiteboardDrawer';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { useAppStore } from '../../store/useAppStore';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';
import { AmbientVoicePill } from './tutor/AmbientVoicePill';

interface TransactionLabArenaProps {
  initialScenarioId?: string;
  onBack: () => void;
  onStartVoiceDefense?: (scenario: TransactionScenario, question: string) => void;
}

/**
 * TransactionLabArena.tsx (SOTA Late 2026 Decomposed).
 * Single responsibility: layout coordinator and interactive workbench for Spring Transactions Lab.
 * Cognitive bounding limit: <= 350 lines.
 */
export const TransactionLabArena: React.FC<TransactionLabArenaProps> = ({
  initialScenarioId,
  onBack,
  onStartVoiceDefense
}) => {
  const {
    academyBreadcrumbContext,
    toggleAcademyStepProgress,
    activeWhiteboardState,
    isWhiteboardOpen,
    setIsWhiteboardOpen,
    setLatestTxEvaluation
  } = useAppStore();

  const {
    isConnected: isVoiceConnected,
    startPracticeSession,
    disconnectSession: disconnectVoiceSession
  } = usePracticeVoice();

  const togglePracticeVoice = useCallback(() => {
    if (isVoiceConnected) {
      disconnectVoiceSession();
    } else {
      void startPracticeSession();
    }
  }, [isVoiceConnected, disconnectVoiceSession, startPracticeSession]);

  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // Practice Tutor Store (Socratic AI Tutor & Compass)
  const {
    isCompassOpen,
    toggleCompass,
    toggleOpen,
    sendMessage
  } = usePracticeTutorStore();

  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    return initialScenarioId || TRANSACTION_LAB_SCENARIOS[0].id;
  });

  const [selectedLevel, setSelectedLevel] = useState<'all' | 'L0' | 'L1' | 'L2' | 'L3'>('all');
  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>(undefined);

  const filteredScenarios = useMemo(() => {
    if (selectedLevel === 'all') return TRANSACTION_LAB_SCENARIOS;
    return TRANSACTION_LAB_SCENARIOS.filter((s) => s.level === selectedLevel);
  }, [selectedLevel]);

  const scenario = useMemo(() => {
    return (
      TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeScenarioId) ||
      TRANSACTION_LAB_SCENARIOS[0]
    );
  }, [activeScenarioId]);

  const [threads, setThreads] = useState<number>(scenario.simulatedLoad.defaultThreads);
  const [userConfigs, setUserConfigs] = useState<Record<string, TransactionAnnotationConfig>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check local draft
    const localDraft = getTxLabLocalDraft(scenario.id);
    let loadedConfigs: Record<string, TransactionAnnotationConfig> | null = localDraft?.userConfigs || null;
    let loadedThreads: number = localDraft?.threads ?? scenario.simulatedLoad.defaultThreads;

    if (!loadedConfigs) {
      const initial: Record<string, TransactionAnnotationConfig> = {};
      scenario.services.forEach((svc) => {
        svc.methods.forEach((m) => {
          initial[m.id] = { propagation: 'NONE' };
        });
      });
      loadedConfigs = initial;
    }

    setUserConfigs(loadedConfigs);
    setThreads(loadedThreads);
    setSelectedMethodId(scenario.services[0]?.methods[0]?.id);

    // 2. Background check cloud draft
    void fetchTxLabDraftFromCloud(scenario.id).then((cloud) => {
      if (cloud && cloud.updatedAt > (localDraft?.updatedAt || 0)) {
        setUserConfigs(cloud.userConfigs);
        setThreads(cloud.threads);
        saveTxLabLocalDraft(scenario.id, cloud.userConfigs, cloud.threads);
      }
    });
  }, [scenario]);

  // Autosave: debounced 400ms to local storage, 10s to cloud
  useEffect(() => {
    if (!scenario.id || Object.keys(userConfigs).length === 0) return;
    saveTxLabLocalDraft(scenario.id, userConfigs, threads);

    const cloudTimer = setTimeout(() => {
      void syncTxLabDraftWithCloud(scenario.id, userConfigs, threads).then((ok) => {
        if (ok) {
          setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      });
    }, 10_000);

    return () => clearTimeout(cloudTimer);
  }, [userConfigs, threads, scenario.id]);

  const handleResetScenario = useCallback(() => {
    if (!window.confirm('Сбросить конфигурацию транзакций к исходным значениям (NONE)?')) return;
    removeTxLabLocalDraft(scenario.id);
    const initial: Record<string, TransactionAnnotationConfig> = {};
    scenario.services.forEach((svc) => {
      svc.methods.forEach((m) => {
        initial[m.id] = { propagation: 'NONE' };
      });
    });
    setUserConfigs(initial);
    setThreads(scenario.simulatedLoad.defaultThreads);
    setLastSavedTime(null);
  }, [scenario]);

  const handleMethodConfigChange = useCallback((methodId: string, cfg: TransactionAnnotationConfig) => {
    setUserConfigs((prev) => ({
      ...prev,
      [methodId]: cfg
    }));
  }, []);

  // Real-time evaluation of transactions & HikariCP pool
  const evalResult: ScenarioEvaluationResult = useMemo(() => {
    return TransactionValidator.evaluateScenario(scenario, userConfigs, threads);
  }, [scenario, userConfigs, threads]);

  useEffect(() => {
    setLatestTxEvaluation(evalResult);
    if (evalResult.isPassed) {
      if (academyBreadcrumbContext) {
        toggleAcademyStepProgress(
          academyBreadcrumbContext.courseId,
          academyBreadcrumbContext.stepNumber,
          true
        );
      }
      void fetch('/api/roadmaps/transactions/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scenarioId: scenario.id,
          passed: 1,
          score: evalResult.overallScore,
          userConfigs
        })
      }).catch((e) => console.warn('[TransactionLabArena] Failed to save submission:', e));
    }
  }, [evalResult, scenario.id, userConfigs, academyBreadcrumbContext, toggleAcademyStepProgress, setLatestTxEvaluation]);

  const handleAskTutorAboutRule = useCallback((ruleTitle: string, ruleSummary: string) => {
    toggleOpen(true);
    sendMessage(
      `Разъясни подробно правило транзакций «${ruleTitle}»:\n${ruleSummary}\nКак это связано с текущим сценарием «${scenario.title}»?`,
      {
        kataId: scenario.id,
        kataTitle: scenario.title,
        kataCategory: 'Spring Transactions',
        kataInstructions: scenario.problemStatement,
        activeFilePath: 'src/main/java/TransactionScenario.java',
        activeFileContent: scenario.services.map((s) => s.methods.map((m) => m.codeSnippet).join('\n')).join('\n')
      }
    );
  }, [scenario, sendMessage, toggleOpen]);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative">
      {/* Top Workspace Navigation Bar */}
      <TransactionLabHeader
        scenario={scenario}
        onBack={onBack}
        lastSavedTime={lastSavedTime}
        isVoiceConnected={isVoiceConnected}
        onToggleVoice={togglePracticeVoice}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
        onToggleCompass={() => toggleCompass()}
        onReset={handleResetScenario}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Scenario Selector & Problem Statement (Collapsible in Focus Mode) */}
        {!isFocusMode && (
          <>
            <TransactionScenarioSelector
              scenarios={filteredScenarios}
              activeScenarioId={scenario.id}
              selectedLevel={selectedLevel}
              onSelectLevel={setSelectedLevel}
              onSelectScenario={setActiveScenarioId}
            />

            <div className="p-4 rounded-2xl bg-white/95 border border-pastel-border/80 shadow-xs space-y-2 text-pastel-text">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-violet-700">
                <BookOpen className="w-4 h-4" />
                <span>Постановка задачи и бизнес-инварианты</span>
              </div>
              <p className="text-xs text-pastel-text leading-relaxed bg-pastel-bg/60 p-3 rounded-xl border border-pastel-border/60">
                {scenario.problemStatement}
              </p>
            </div>
          </>
        )}

        {/* Services & Methods Implementation Cards */}
        <TransactionServiceEditor
          services={scenario.services}
          userConfigs={userConfigs}
          selectedMethodId={selectedMethodId}
          onSelectMethod={setSelectedMethodId}
          onMethodConfigChange={handleMethodConfigChange}
        />

        {/* Step-by-Step Interactive Timeline Scrubber & Concurrency Swimlanes */}
        <TransactionTimelineScrubber
          scenario={scenario}
          userConfigs={userConfigs}
          activeMethodId={selectedMethodId}
          onSelectMethod={setSelectedMethodId}
        />

        {/* HikariCP Slot Bay Meter */}
        <HikariPoolSlotMeter
          scenario={scenario}
          userConfigs={userConfigs}
          threads={threads}
          onThreadsChange={setThreads}
        />

        {/* Evaluation Verdict Card */}
        {evalResult && (
          <TransactionVerdictCard
            evalResult={evalResult}
            scenario={scenario}
            onStartVoiceDefense={onStartVoiceDefense}
          />
        )}
      </main>

      {/* Transaction Compass Drawer (Ctrl + /) */}
      <TransactionCompassSheet
        isOpen={isCompassOpen}
        onClose={() => toggleCompass(false)}
        onAskTutorAboutRule={handleAskTutorAboutRule}
      />

      {/* Socratic AI Tutor & Whiteboard */}
      <WhiteboardDrawer
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        state={activeWhiteboardState}
      />
      <AmbientVoicePill />
    </div>
  );
};
