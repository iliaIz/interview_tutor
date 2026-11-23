import React from 'react';
import { SystemDesignScenario } from '../../../types/nextgen';
import { getLevelBadge, getPedagogicalModeBadge } from '../utils/scenarioLevel';
import { Activity, ArrowRight } from 'lucide-react';

export interface SystemDesignScenarioCardProps {
  scenario: SystemDesignScenario;
  isSelected: boolean;
  onSelect: (scenario: SystemDesignScenario) => void;
}

export const SystemDesignScenarioCard: React.FC<SystemDesignScenarioCardProps> = ({
  scenario,
  isSelected,
  onSelect
}) => {
  const levelBadge = getLevelBadge(scenario);
  const modeBadge = getPedagogicalModeBadge(scenario.pedagogical_mode);

  const peakRps = scenario.studio_2_simulation?.traffic_profile?.lambda_mean_rps
    ? `${scenario.studio_2_simulation.traffic_profile.lambda_mean_rps.toLocaleString()} RPS`
    : scenario.trafficProfile?.estimatedPeakRPS || 'N/A';

  const sla = scenario.studio_2_simulation?.slos?.availability_target_nines
    ? `${scenario.studio_2_simulation.slos.availability_target_nines}%`
    : scenario.trafficProfile?.slaAvailability || '99.99%';

  const p99 = scenario.studio_2_simulation?.slos?.p99_latency_max_ms
    ? `p99 ≤ ${scenario.studio_2_simulation.slos.p99_latency_max_ms}мс`
    : 'SLA p99';

  return (
    <div
      onClick={() => onSelect(scenario)}
      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${
        isSelected
          ? 'bg-white border-purple-400 shadow-sm ring-2 ring-purple-300/40'
          : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-purple-300 shadow-2xs'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${levelBadge.bg}`}>
              {levelBadge.label}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border truncate ${modeBadge.bg}`}>
              {modeBadge.label}
            </span>
          </div>

          <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1 shrink-0">
            <Activity className="w-3 h-3 text-emerald-600" />
            {peakRps}
          </span>
        </div>

        <h3 className={`font-bold text-xs sm:text-sm transition-colors ${isSelected ? 'text-purple-900' : 'text-pastel-text'}`}>
          {scenario.title}
        </h3>

        <p className="text-xs text-pastel-muted line-clamp-2 mt-1 leading-snug">
          {(scenario.subtitle || scenario.problem_statement || scenario.contextMarkdown || '').replace(/\\_/g, '_')}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-pastel-border/50 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-pastel-muted text-[10px]">
          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
            SLA {sla}
          </span>
          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
            {p99}
          </span>
        </div>

        <span className="font-bold text-pastel-accentViolet flex items-center gap-0.5 text-[10px]">
          <span>Обзор</span>
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};
