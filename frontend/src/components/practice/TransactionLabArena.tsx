import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Flame,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Compass,
  CheckCircle2
} from 'lucide-react';
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
import { TransactionAnnotationChip } from './TransactionAnnotationChip';
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

  const { isConnected: isVoiceConnected, sendTextMessage } = usePracticeVoice();

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
    if (evalResult.isPassed && academyBreadcrumbContext) {
      toggleAcademyStepProgress(
        academyBreadcrumbContext.courseId,
        academyBreadcrumbContext.stepNumber,
        true
      );
    }
  }, [evalResult, academyBreadcrumbContext, toggleAcademyStepProgress, setLatestTxEvaluation]);

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
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 relative">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
            <span>{scenario.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">
              {scenario.level}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSavedTime && (
            <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
              Сохранено {lastSavedTime}
            </span>
          )}

          <button
            type="button"
            onClick={handleResetScenario}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer text-xs"
            title="Сбросить конфигурацию к значениям по умолчанию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сброс</span>
          </button>

          <button
            type="button"
            onClick={() => toggleCompass()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer text-xs font-semibold"
          >
            <Compass className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span>Transaction Compass</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-[9px] text-slate-400">Ctrl+/</kbd>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* Scenario Selector */}
        <TransactionScenarioSelector
          scenarios={filteredScenarios}
          activeScenarioId={scenario.id}
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
          onSelectScenario={setActiveScenarioId}
        />

        {/* Problem Statement Card */}
        <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs space-y-2 text-slate-800">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-violet-700">
            <BookOpen className="w-4 h-4" />
            <span>Постановка задачи и бизнес-инварианты</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            {scenario.problemStatement}
          </p>
        </div>

        {/* Services & Methods Implementation Cards */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                Архитектурный редактор сервисов Spring Boot
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Кликайте на плашку <span className="font-mono text-violet-600 font-bold">@Transactional</span> для настройки параметров
            </span>
          </div>

          <div className="space-y-4">
            {scenario.services.map((svc) => (
              <div key={svc.className} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="font-mono text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-violet-600">@Service</span>
                  <span>public class {svc.className} {'{'}</span>
                </div>

                {svc.methods.map((method) => {
                  const currentConfig = userConfigs[method.id] || { propagation: 'NONE' };
                  const isSelected = selectedMethodId === method.id;

                  return (
                    <div
                      key={method.id}
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`ml-4 sm:ml-6 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-violet-400 shadow-xs ring-2 ring-violet-200/60'
                          : 'bg-white/80 hover:bg-white border-slate-200'
                      }`}
                    >
                      <div className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                        <span className="font-bold text-slate-700">Контракт: </span>
                        {method.businessContract}
                      </div>

                      <div className="mb-1.5">
                        <TransactionAnnotationChip
                          config={currentConfig}
                          onChange={(cfg) => handleMethodConfigChange(method.id, cfg)}
                          methodName={method.name}
                        />
                      </div>

                      <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                        <code>{method.codeSnippet}</code>
                      </pre>
                    </div>
                  );
                })}

                <div className="font-mono text-xs font-bold text-slate-800">{'}'}</div>
              </div>
            ))}
          </div>
        </div>

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
      <PracticeTutorDrawer />
      <WhiteboardDrawer
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        state={activeWhiteboardState}
      />
      <AmbientVoicePill />
    </div>
  );
};
