import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, CheckCircle2, XCircle, Play, 
  RotateCcw, Sparkles, Sliders, FileCode, Layers, Info
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { oneDark } from '@codemirror/theme-one-dark';
import confetti from 'canvas-confetti';
import { MICRO_KATAS, MicroKata } from './MicroKatasCatalog';
import { MarkdownRenderer } from '../../MarkdownRenderer';

interface MicroKataArenaProps {
  initialKataId?: string;
  onBack: () => void;
}

export const MicroKataArena: React.FC<MicroKataArenaProps> = ({ initialKataId, onBack }) => {
  const [selectedKataId, setSelectedKataId] = useState<string>(initialKataId || MICRO_KATAS[0].id);

  const activeKata: MicroKata = useMemo(() => {
    return MICRO_KATAS.find(k => k.id === selectedKataId) || MICRO_KATAS[0];
  }, [selectedKataId]);

  // Parameters state initialized with defaultParams
  const [params, setParams] = useState<Record<string, any>>(activeKata.defaultParams);

  // Sync params when activeKata changes
  React.useEffect(() => {
    setParams(activeKata.defaultParams);
    setSimulationResult(null);
  }, [activeKata.id]);

  const [simulationResult, setSimulationResult] = useState<ReturnType<MicroKata['runSimulation']> | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const result = activeKata.runSimulation(params);
      setSimulationResult(result);
      setIsSimulating(false);

      if (result.isPassed) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (_) {}
      }
    }, 80);
  };

  const handleResetParams = () => {
    setParams(activeKata.defaultParams);
    setSimulationResult(null);
  };

  return (
    <div className="flex flex-col h-full bg-pastel-canvas text-pastel-text overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-pastel-border bg-pastel-card/90 backdrop-blur-md z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-pastel-border hover:bg-pastel-hover text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Каталог</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Level 0: Micro-Kata #{activeKata.number}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeKata.category}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {activeKata.difficulty}
            </span>
          </div>
        </div>

        {/* Quick Kata Selector Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-xl">
          {MICRO_KATAS.map((k) => {
            const isSelected = k.id === selectedKataId;
            return (
              <button
                key={k.id}
                onClick={() => setSelectedKataId(k.id)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'bg-pastel-card hover:bg-pastel-hover text-pastel-text/80 border border-pastel-border'
                }`}
              >
                #{k.number} {k.category}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main 2-Column Split Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Theoretical Math & Reference Invariants (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full border-r border-pastel-border overflow-y-auto p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-pastel-text">
              {activeKata.title}
            </h1>
            <p className="text-xs text-pastel-text-muted mt-1">
              {activeKata.subtitle}
            </p>
          </div>

          {/* Hard Invariant Alert */}
          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-indigo-300">
                Строгий архитектурный инвариант:
              </div>
              <div className="text-xs text-pastel-text mt-1 leading-relaxed">
                {activeKata.hardInvariantText}
              </div>
              <div className="text-[11px] text-pastel-text-muted mt-2 font-mono">
                Сложность: {activeKata.asymptoticComplexity} | Бюджет: &lt; {activeKata.executionBudgetMs} мс
              </div>
            </div>
          </div>

          {/* Mathematical Model (LaTeX Rendered) */}
          <div className="p-4 rounded-xl border border-pastel-border bg-pastel-card/50">
            <div className="flex items-center space-x-2 mb-3">
              <Info className="w-4 h-4 text-pastel-accent" />
              <span className="text-xs font-semibold text-pastel-text uppercase tracking-wider">
                Математический аппарат & Закон распределения
              </span>
            </div>
            <div className="text-xs text-pastel-text leading-relaxed">
              <MarkdownRenderer content={activeKata.mathematicalModelMarkdown} />
            </div>
          </div>

          {/* Java 21 Reference Code Implementation & Invariant Verification */}
          <div className="p-4 rounded-xl border border-pastel-border bg-pastel-card/50 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-pastel-text uppercase tracking-wider">
                  Эталонная реализация на Java 21 & AssertJ инварианты
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Java 21 Virtual Threads
              </span>
            </div>
            <div className="rounded-lg overflow-hidden border border-pastel-border text-xs">
              <CodeMirror
                value={activeKata.javaCodeSnippet}
                extensions={[java()]}
                theme={oneDark}
                readOnly
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: false
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Simulation Playground (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full overflow-y-auto p-6 space-y-6 bg-pastel-card/20">
          {/* Controls Card */}
          <div className="p-5 rounded-xl border border-pastel-border bg-pastel-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-pastel-text uppercase tracking-wider">
                  Параметры эксперимента
                </span>
              </div>
              <button
                onClick={handleResetParams}
                className="text-[11px] flex items-center space-x-1 text-pastel-text-muted hover:text-pastel-text transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Сброс</span>
              </button>
            </div>

            {/* Dynamic Controls List */}
            <div className="space-y-4 pt-1">
              {activeKata.paramDefinitions.map((param) => {
                const val = params[param.key] ?? (param.options ? param.options[0].value : param.min);

                if (param.type === 'slider') {
                  return (
                    <div key={param.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-pastel-text">
                          {param.label}
                        </label>
                        <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded">
                          {val}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step || 1}
                        value={val}
                        onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                        className="w-full h-1.5 bg-pastel-border rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <p className="text-[11px] text-pastel-text-muted">
                        {param.description}
                      </p>
                    </div>
                  );
                }

                if (param.type === 'select') {
                  return (
                    <div key={param.key} className="space-y-1.5">
                      <label className="text-xs font-medium text-pastel-text block">
                        {param.label}
                      </label>
                      <select
                        value={val.toString()}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === 'true' ? true : raw === 'false' ? false : isNaN(Number(raw)) ? raw : Number(raw);
                          handleParamChange(param.key, parsed);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-pastel-border bg-pastel-card text-xs text-pastel-text focus:ring-1 focus:ring-indigo-500 outline-none"
                      >
                        {param.options?.map((opt) => (
                          <option key={opt.label} value={opt.value.toString()}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-pastel-text-muted">
                        {param.description}
                      </p>
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSimulating ? 'Вычисление инвариантов...' : 'Запустить симуляцию в памяти'}</span>
            </button>
          </div>

          {/* Simulation Results Card */}
          {simulationResult ? (
            <div className="p-5 rounded-xl border border-pastel-border bg-pastel-card shadow-sm space-y-4">
              {/* Verdict Header */}
              <div className={`p-3 rounded-lg flex items-center justify-between border ${
                simulationResult.isPassed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <div className="flex items-center space-x-2">
                  {simulationResult.isPassed ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {simulationResult.isPassed ? 'ИНВАРИАНТ ПОДТВЕРЖДЕН' : 'ИНВАРИАНТ НАРУШЕН'}
                    </div>
                    {simulationResult.failureReason && (
                      <div className="text-[11px] text-rose-300 mt-0.5">
                        {simulationResult.failureReason}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/20">
                  {simulationResult.isPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(simulationResult.metrics).map(([k, v]) => (
                  <div key={k} className="p-2.5 rounded-lg border border-pastel-border bg-pastel-card/50">
                    <div className="text-[10px] text-pastel-text-muted capitalize">
                      {k.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div className="text-xs font-mono font-semibold text-pastel-text mt-0.5">
                      {v.toString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Visual Distribution Chart */}
              {simulationResult.chartsData && simulationResult.chartsData.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold text-pastel-text-muted flex items-center justify-between">
                    <span>Распределение нагрузки / Метрика</span>
                    <span className="text-[10px] font-normal">Текущее vs Эталон</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {simulationResult.chartsData.map((item) => {
                      const maxVal = Math.max(...(simulationResult.chartsData?.map(d => d.value) || [100]), item.benchmark || 0, 1);
                      const widthPct = Math.min(100, Math.max(4, (item.value / maxVal) * 100));
                      return (
                        <div key={item.name} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono text-pastel-text-muted">
                            <span>{item.name}</span>
                            <span className="text-pastel-text font-medium">{item.value}</span>
                          </div>
                          <div className="h-2 w-full bg-pastel-border/60 rounded-full overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: item.color || '#6366f1'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Execution Logs */}
              <div className="space-y-1.5 pt-1 border-t border-pastel-border">
                <span className="text-[11px] font-semibold text-pastel-text-muted">
                  Логи выполнения AssertJ теста:
                </span>
                <div className="p-3 rounded-lg bg-black/40 border border-pastel-border text-[11px] font-mono space-y-1 text-pastel-text-muted">
                  {simulationResult.logs.map((log, i) => (
                    <div key={i} className="leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-pastel-border flex flex-col items-center justify-center text-center space-y-2">
              <Layers className="w-8 h-8 text-pastel-text-muted/60" />
              <div className="text-xs font-medium text-pastel-text">
                Симуляция готова к запуску
              </div>
              <p className="text-[11px] text-pastel-text-muted max-w-xs">
                Настройте параметры в блоке выше и нажмите «Запустить симуляцию», чтобы проверить математический инвариант в действии.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
