import React from 'react';
import { SystemDesignScenario } from '../../../types/nextgen';
import { getLevelBadge } from '../utils/scenarioLevel';
import { Activity, Terminal, Cpu, Radio, Play } from 'lucide-react';

export interface SystemDesignScenarioDetailProps {
  scenario: SystemDesignScenario;
  onLaunchScenario: (scenario: SystemDesignScenario) => void;
  onStartVoiceBrief: (scenario: SystemDesignScenario) => void;
}

export const SystemDesignScenarioDetail: React.FC<SystemDesignScenarioDetailProps> = ({
  scenario,
  onLaunchScenario,
  onStartVoiceBrief
}) => {
  const levelBadge = getLevelBadge(scenario);

  return (
    <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
      {/* Header with Title & Category */}
      <div className="space-y-2 pb-4 border-b border-pastel-border/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${levelBadge.bg}`}>
              {levelBadge.label}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-pastel-accentViolet border border-purple-200">
              {scenario.archetype || scenario.category || 'Distributed Systems'}
            </span>
          </div>

          <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            SLA: {scenario.studio_2_simulation?.slos?.availability_target_nines || 99.99}%
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-pastel-text tracking-tight">
          {scenario.title}
        </h2>

        {scenario.subtitle && (
          <p className="text-xs font-semibold text-purple-800">
            {scenario.subtitle}
          </p>
        )}

        <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
          {(scenario.problem_statement || scenario.contextMarkdown || '').replace(/\\_/g, '_')}
        </p>
      </div>

      {/* Traffic Profile & SLA Grid */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-pastel-text uppercase tracking-wider block">
          📊 Профиль Нагрузки & Архитектурные Требования:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
            <span className="text-pastel-muted block text-[10px]">Входящий RPS</span>
            <span className="font-bold text-blue-600 text-[11px] mt-0.5 block">
              {scenario.studio_2_simulation?.traffic_profile?.lambda_mean_rps 
                ? `${scenario.studio_2_simulation.traffic_profile.lambda_mean_rps.toLocaleString()}` 
                : (scenario.trafficProfile?.estimatedPeakRPS || 'N/A')}
            </span>
          </div>
          <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
            <span className="text-pastel-muted block text-[10px]">Целевой p99</span>
            <span className="font-bold text-emerald-600 text-[11px] mt-0.5 block">
              {scenario.studio_2_simulation?.slos?.p99_latency_max_ms 
                ? `≤ ${scenario.studio_2_simulation.slos.p99_latency_max_ms} мс` 
                : '≤ 50 мс'}
            </span>
          </div>
          <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
            <span className="text-pastel-muted block text-[10px]">Паттерн</span>
            <span className="font-bold text-pastel-text text-[11px] mt-0.5 block">
              {scenario.studio_2_simulation?.traffic_profile?.pattern || 'POISSON'}
            </span>
          </div>
          <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
            <span className="text-pastel-muted block text-[10px]">Бюджет в месяц</span>
            <span className="font-bold text-pastel-accentViolet text-[11px] mt-0.5 block">
              {scenario.studio_2_simulation?.slos?.monthly_budget_max_usd 
                ? `$${scenario.studio_2_simulation.slos.monthly_budget_max_usd.toLocaleString()}` 
                : 'SLA'}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Scale Studios Supported Indicators */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-pastel-text uppercase tracking-wider block">
          🛠️ Доступные Режимы в MultiScaleCanvasHub:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            scenario.studio_1_runtime 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}>
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <div>
              <span className="font-bold block text-[11px]">Студия 1: Runtime</span>
              <span className="text-[10px]">{scenario.studio_1_runtime ? 'Forensics & Java 21' : 'Не требуется'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border bg-blue-50 border-blue-200 text-blue-900 text-xs flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <div>
              <span className="font-bold block text-[11px]">Студия 2: Topology</span>
              <span className="text-[10px]">DES Simulation & Invariants</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl border bg-purple-50 border-purple-200 text-purple-900 text-xs flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <div>
              <span className="font-bold block text-[11px]">Студия 3: Defense</span>
              <span className="text-[10px]">Voice Bar-Raiser</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          onClick={() => onLaunchScenario(scenario)}
          className="flex-1 py-3 px-5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Открыть Multi-Scale Studio (Enter)</span>
        </button>

        <button
          type="button"
          onClick={() => onStartVoiceBrief(scenario)}
          className="py-3 px-4 rounded-2xl font-bold text-xs bg-purple-50 hover:bg-purple-100 text-pastel-accentViolet border border-purple-200 transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95 shrink-0"
          title="Запустить голосовой вводный бриф сценария с AI-Тьютором"
        >
          <Radio className="w-4 h-4 animate-pulse text-pastel-accentViolet" />
          <span>Live Бриф с Тьютором</span>
        </button>
      </div>
    </div>
  );
};
