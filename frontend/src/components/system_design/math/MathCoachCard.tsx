import React from 'react';
import {
  TrendingUp,
  HardDrive,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Radio,
  Sparkles,
  HelpCircle,
  Zap
} from 'lucide-react';
import { MathScenario, PRESET_SCENARIOS } from './MathCoachPresets';
import { CapacityResults, ValidationSummary } from '../../../utils/capacityMath';

interface MathCoachCardProps {
  scenario: MathScenario;
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  userPeakQps: string;
  setUserPeakQps: (val: string) => void;
  userStorageTb: string;
  setUserStorageTb: (val: string) => void;
  userHotRamGb: string;
  setUserHotRamGb: (val: string) => void;
  isEvaluated: boolean;
  onEvaluate: () => void;
  onReset: () => void;
  mathResults: CapacityResults;
  validation: ValidationSummary | null;
  onApplyCalculations?: (summary: string) => void;
  isTutorOpen: boolean;
  onToggleTutor: () => void;
  onStartVoiceTutor: () => void;
}

export const MathCoachCard: React.FC<MathCoachCardProps> = ({
  scenario,
  activeScenarioId,
  onSelectScenario,
  userPeakQps,
  setUserPeakQps,
  userStorageTb,
  setUserStorageTb,
  userHotRamGb,
  setUserHotRamGb,
  isEvaluated,
  onEvaluate,
  onReset,
  mathResults,
  validation,
  onApplyCalculations,
  isTutorOpen,
  onToggleTutor,
  onStartVoiceTutor
}) => {
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Math Coach: Прикидки на салфетке (Back-of-the-Envelope)
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
              Окно допуска &plusmn;25%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Отработка математических расчетов QPS, дисков, RAM и сети за 60 секунд перед началом дизайна
          </p>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={activeScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            {PRESET_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scenario Brief Bar */}
      <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-violet-600" />
            Дано в условиях задачи:
          </span>
          <p className="text-xs text-violet-800 font-medium leading-relaxed">
            {scenario.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            DAU: {(scenario.dau / 1_000_000).toFixed(0)}M
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            Запись: {scenario.writesPerUser} / день
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 font-bold text-violet-900">
            Чтение: {scenario.readsPerUser} / день
          </span>
        </div>
      </div>

      {/* 3 Core Estimation Exercises Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Peak QPS */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              Пиковый Total RPS / QPS:
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Peak = 3x Avg</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка (напр. 3500)"
              value={userPeakQps}
              onChange={(e) => setUserPeakQps(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.qps.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.qps.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.qps.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-violet-900">~{mathResults.peakTotalQps.toLocaleString()} QPS</span>
              <span className="text-[10px] text-slate-500 block">
                (Запись: {mathResults.peakWriteQps.toLocaleString()} + Чтение: {mathResults.peakReadQps.toLocaleString()})
              </span>
            </div>
          )}
        </div>

        {/* Metric 2: Storage Volume */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              Хранилище на {scenario.retentionYears} лет (TB):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">+20% Index/Repl</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка в TB (напр. 120)"
              value={userStorageTb}
              onChange={(e) => setUserStorageTb(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.storage.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.storage.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.storage.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-indigo-900">~{mathResults.totalStorageTb.toLocaleString()} TB</span>
              <span className="text-[10px] text-slate-500 block">
                ({scenario.retentionYears} лет с учетом индексов и репликации)
              </span>
            </div>
          )}
        </div>

        {/* Metric 3: Hot RAM Cache */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Горячий кэш RAM (GB):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">80/20 Rule</span>
          </div>
          <div className="space-y-1">
            <input
              type="number"
              placeholder="Ваша прикидка в GB (напр. 64)"
              value={userHotRamGb}
              onChange={(e) => setUserHotRamGb(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:ring-2 focus:ring-violet-400 outline-none"
            />
            {validation && (
              <div className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${validation.ram.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {validation.ram.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{validation.ram.msg}</span>
              </div>
            )}
          </div>
          {isEvaluated && (
            <div className="pt-2 border-t border-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px]">Точный расчет:</span>
              <span className="font-bold text-emerald-950">~{mathResults.hotRamGb.toLocaleString()} GB</span>
              <span className="text-[10px] text-slate-500 block">
                (20% суточного трафика чтения в Redis кластере)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>

          <button
            type="button"
            onClick={onToggleTutor}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isTutorOpen
                ? 'bg-violet-100 text-violet-800 border border-violet-300 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
            <span>AI-Наставник (Чат)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-200/80 font-mono text-violet-900 font-bold">
              4 режима
            </span>
          </button>

          <button
            type="button"
            onClick={onStartVoiceTutor}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-md active:scale-95"
            title="Запустить двусторонний голосовой диалог с Gemini Live"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-violet-200" />
            <span>Live Голос</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 font-mono font-bold">
              Gemini Live
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isEvaluated && onApplyCalculations && (
            <button
              type="button"
              onClick={() => {
                const summary = [
                  `- **Пиковый QPS**: ~${mathResults.peakTotalQps.toLocaleString()} (Запись: ${mathResults.peakWriteQps.toLocaleString()} QPS, Чтение: ${mathResults.peakReadQps.toLocaleString()} QPS)`,
                  `- **Хранение (на ${scenario.retentionYears} лет)**: ~${mathResults.totalStorageTb.toLocaleString()} TB (суточный прирост: ${mathResults.dailyStorageGb.toFixed(1)} GB)`,
                  `- **Горячий кэш RAM (80/20)**: ~${mathResults.hotRamGb.toLocaleString()} GB в Redis кластере`,
                  `- **Сетевая полоса пропускания**: ~${mathResults.networkGbps.toFixed(2)} Gbps (~${(mathResults.networkGbps / 8).toFixed(2)} GB/s)`
                ].join('\n');
                onApplyCalculations(summary);
              }}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Вставить в решение</span>
            </button>
          )}

          <button
            type="button"
            onClick={onEvaluate}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Проверить мои прикидки</span>
          </button>
        </div>
      </div>

      {/* Quick Conversion Cheatsheet Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-700 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
          <span>Шпаргалка степеней 2 и 10 для мгновенного счета:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2¹⁰ ≈ 10³</span>
            <span>1 KB = 1000 Bytes (тысяча)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2²⁰ ≈ 10⁶</span>
            <span>1 MB = 1 000 000 (миллион)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">2³⁰ ≈ 10⁹</span>
            <span>1 GB = 1 000 000 000 (миллиард)</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-violet-700 font-bold block">86 400 сек</span>
            <span>≈ 10⁵ сек в сутках (~100k)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
