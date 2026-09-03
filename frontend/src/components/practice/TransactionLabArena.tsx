import React, { useState, useMemo, useEffect } from 'react';
import {
  Database,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Layers,
  HelpCircle,
  Volume2,
  Send,
  RotateCcw,
  BookOpen,
  Award,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { TRANSACTION_LAB_SCENARIOS } from '../../data/transactionLabCatalog';
import {
  TransactionScenario,
  TransactionAnnotationConfig,
  ScenarioEvaluationResult
} from '../../types/transactionLab';
import { TransactionValidator } from '../../services/transactionValidator';
import { TransactionAnnotationChip } from './TransactionAnnotationChip';
import { ExecutionFlameChart } from './ExecutionFlameChart';
import { HikariPoolSlotMeter } from './HikariPoolSlotMeter';

interface TransactionLabArenaProps {
  initialScenarioId?: string;
  onBack: () => void;
  onStartVoiceDefense?: (scenario: TransactionScenario, question: string) => void;
}

export const TransactionLabArena: React.FC<TransactionLabArenaProps> = ({
  initialScenarioId,
  onBack,
  onStartVoiceDefense
}) => {
  // Active Scenario state
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    return initialScenarioId || TRANSACTION_LAB_SCENARIOS[0].id;
  });

  const scenario = useMemo(() => {
    return (
      TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeScenarioId) ||
      TRANSACTION_LAB_SCENARIOS[0]
    );
  }, [activeScenarioId]);

  // Load slider state (Threads T)
  const [threads, setThreads] = useState<number>(scenario.simulatedLoad.defaultThreads);

  // User configured annotations for each method: record of methodId -> config
  const [userConfigs, setUserConfigs] = useState<Record<string, TransactionAnnotationConfig>>({});

  // Reset user configs when scenario changes
  useEffect(() => {
    const initial: Record<string, TransactionAnnotationConfig> = {};
    for (const service of scenario.services) {
      for (const method of service.methods) {
        // Default to REQUIRED or NONE for testing
        initial[method.id] = { propagation: 'REQUIRED' };
      }
    }
    setUserConfigs(initial);
    setThreads(scenario.simulatedLoad.defaultThreads);
    setEvalResult(null);
    setSelectedMethodId(scenario.services[0]?.methods[0]?.id);
  }, [scenario]);

  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>(
    scenario.services[0]?.methods[0]?.id
  );

  // Evaluation results
  const [evalResult, setEvalResult] = useState<ScenarioEvaluationResult | null>(null);

  // Update specific method config
  const handleMethodConfigChange = (methodId: string, newConfig: TransactionAnnotationConfig) => {
    setUserConfigs((prev) => ({
      ...prev,
      [methodId]: newConfig
    }));
    // Re-evaluate if already evaluated
    if (evalResult) {
      const reEvaluated = TransactionValidator.evaluateScenario(
        scenario,
        { ...userConfigs, [methodId]: newConfig },
        threads
      );
      setEvalResult(reEvaluated);
    }
  };

  // Run AST Validator
  const handleRunEvaluation = () => {
    const result = TransactionValidator.evaluateScenario(scenario, userConfigs, threads);
    setEvalResult(result);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-slate-50 via-pastel-bg/30 to-violet-50/20 overflow-y-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            title="Назад к практике"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-700 bg-violet-100/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                SOTA 2026 Workbench
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-semibold text-slate-500">{scenario.domain}</span>
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              {scenario.title}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunEvaluation}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Проверить архитектуру (AST)</span>
          </button>

          {onStartVoiceDefense && (
            <button
              type="button"
              onClick={() => {
                const q = scenario.probingQuestions[0]?.question || 'Защитите выбранные параметры транзакций.';
                onStartVoiceDefense(scenario, q);
              }}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              title="Запустить голосовую защиту с ИИ-экзаменатором"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Защитить с ИИ</span>
            </button>
          )}
        </div>
      </header>

      {/* Main 3-Panel Grid */}
      <main className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: Scenarios List & Problem Statement (4 cols) */}
        <section className="lg:col-span-4 space-y-4 flex flex-col min-h-0">
          {/* Scenario Selector Pill Dropdown */}
          <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm space-y-3">
            <label className="font-extrabold text-xs text-slate-800 uppercase tracking-wide flex items-center justify-between">
              <span>Каталог 11 Сценариев:</span>
              <span className="text-[10px] text-violet-600 font-bold font-mono">
                {TRANSACTION_LAB_SCENARIOS.findIndex((s) => s.id === activeScenarioId) + 1} / 11
              </span>
            </label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {TRANSACTION_LAB_SCENARIOS.map((sc, idx) => {
                const isActive = sc.id === activeScenarioId;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setActiveScenarioId(sc.id)}
                    className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer border ${
                      isActive
                        ? 'bg-violet-50 text-violet-900 border-violet-300 shadow-2xs font-bold'
                        : 'bg-slate-50/60 hover:bg-slate-100 text-slate-700 border-slate-200/80 text-xs'
                    }`}
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="text-[10px] text-slate-400 font-mono">#{idx + 1} &bull; {sc.difficulty}</div>
                      <div className="truncate text-xs font-semibold">{sc.title}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-white border border-slate-200 shrink-0">
                      {sc.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Problem Statement Card */}
          <div className="p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm space-y-3 flex-1 flex flex-col">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-600" />
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                Постановка задачи и инварианты
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {scenario.problemStatement}
            </p>

            {/* Probing Questions for Defense */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                Контрольные вопросы для защиты с ИИ:
              </span>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {scenario.probingQuestions.map((pq, idx) => (
                  <li key={idx} className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-[11px] leading-snug">
                    <span className="font-bold text-amber-900 mr-1">Q{idx + 1}:</span>
                    {pq.question}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Center & Right Column: Code Editor & Explorable Workbench (8 cols) */}
        <section className="lg:col-span-8 space-y-5">
          {/* Method Implementation Cards with Interactive Annotation Chips */}
          <div className="p-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                  Архитектурный редактор сервисов Spring Boot
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Нажимайте на плашку <span className="font-mono text-violet-600 font-bold">@Transactional</span> для настройки параметров
              </span>
            </div>

            {/* Services & Methods */}
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
                        {/* Business Contract */}
                        <div className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                          <span className="font-bold text-slate-700">Контракт: </span>
                          {method.businessContract}
                        </div>

                        {/* Interactive Annotation Popover Chip */}
                        <div className="mb-1.5">
                          <TransactionAnnotationChip
                            config={currentConfig}
                            onChange={(cfg) => handleMethodConfigChange(method.id, cfg)}
                            methodName={method.name}
                          />
                        </div>

                        {/* Method Code Snippet */}
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

          {/* Two-Contour Execution Flame Chart */}
          <ExecutionFlameChart
            scenario={scenario}
            userConfigs={userConfigs}
            activeMethodId={selectedMethodId}
            onSelectMethod={setSelectedMethodId}
          />

          {/* HikariCP ConcurrentBag Slot-Bay Meter */}
          <HikariPoolSlotMeter
            scenario={scenario}
            userConfigs={userConfigs}
            threads={threads}
            onThreadsChange={setThreads}
          />

          {/* AST Evaluation Report Modal / Banner */}
          {evalResult && (
            <div
              className={`p-5 rounded-2xl border shadow-md space-y-3 transition-all animate-fadeIn ${
                evalResult.isPassed
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {evalResult.isPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <h4 className="font-extrabold text-sm">
                    {evalResult.isPassed
                      ? `Тест архитектуры пройден! (Оценка: ${evalResult.overallScore}/100)`
                      : `Обнаружены архитектурные дефекты (Оценка: ${evalResult.overallScore}/100)`}
                  </h4>
                </div>
                <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white/80 border">
                  {evalResult.isPassed ? 'READY FOR PRODUCTION' : 'NEEDS REVISION'}
                </span>
              </div>

              <p className="text-xs leading-relaxed font-medium">{evalResult.summary}</p>

              {/* Per-Method Violations List */}
              <div className="space-y-2 pt-2 border-t border-black/10">
                {Object.values(evalResult.methodResults).map((mRes) => {
                  if (mRes.violations.length === 0) return null;
                  return (
                    <div key={mRes.methodId} className="p-2.5 rounded-xl bg-white/80 border text-xs space-y-1">
                      <div className="font-bold text-slate-800 font-mono">Метод: {mRes.methodId}</div>
                      <ul className="list-disc list-inside space-y-0.5 text-rose-800">
                        {mRes.violations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                      {mRes.tips.length > 0 && (
                        <p className="text-[11px] text-slate-600 pt-1 italic">
                          💡 Совет: {mRes.tips[0]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
