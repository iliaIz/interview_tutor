import React from 'react';
import { 
  Play, Square, Flame, Activity, DollarSign, 
  ShieldCheck, AlertTriangle, Sparkles, RotateCcw, HelpCircle 
} from 'lucide-react';
import type { SimulationResponseMessage } from '../../../../workers/des/types/workerMessages';

export interface LiveTelemetryBarProps {
  isRunning: boolean;
  isChaosEnabled: boolean;
  onToggleChaos: () => void;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onResetSimulation: () => void;
  onOpenExplain: () => void;
  result: SimulationResponseMessage | null;
  targetRps: number;
  hasPredicted: boolean;
}

export const LiveTelemetryBar: React.FC<LiveTelemetryBarProps> = ({
  isRunning,
  isChaosEnabled,
  onToggleChaos,
  onStartSimulation,
  onStopSimulation,
  onResetSimulation,
  onOpenExplain,
  result,
  targetRps,
  hasPredicted
}) => {
  const summary = result?.summary;

  return (
    <div className="w-full bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4 shadow-xl shrink-0">
      {/* Controls: Play/Stop & Chaos Monkey */}
      <div className="flex items-center gap-2.5 shrink-0">
        {!isRunning ? (
          <button
            onClick={onStartSimulation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{result ? 'Повторить тест' : 'Запустить симуляцию'}</span>
          </button>
        ) : (
          <button
            onClick={onStopSimulation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Остановить</span>
          </button>
        )}

        <button
          onClick={onToggleChaos}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
            isChaosEnabled
              ? 'bg-rose-950/80 border-rose-600 text-rose-300 shadow-sm animate-pulse'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Chaos Monkey: инъекция сбоев сетевых линков и отказов узлов"
        >
          <Flame className={`w-3.5 h-3.5 ${isChaosEnabled ? 'text-rose-400' : 'text-slate-400'}`} />
          <span>Chaos Monkey</span>
        </button>

        {result && (
          <button
            onClick={onResetSimulation}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Сбросить телеметрию"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Telemetry Pills */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <div className="text-[11px]">
            <span className="text-slate-400">Target RPS: </span>
            <span className="font-mono font-bold text-white">{targetRps.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
          <div className="text-[11px]">
            <span className="text-slate-400">P99 Latency: </span>
            <span className={`font-mono font-bold ${
              !summary
                ? 'text-slate-400'
                : summary.system_p99_latency_ms > 100
                  ? 'text-rose-400'
                  : summary.system_p99_latency_ms > 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
            }`}>
              {summary ? `${summary.system_p99_latency_ms.toFixed(1)} ms` : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <div className="text-[11px]">
            <span className="text-slate-400">Availability: </span>
            <span className="font-mono font-bold text-slate-200">
              {summary ? `${summary.system_availability_nines.toFixed(3)}%` : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
          <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-[11px]">
            <span className="text-slate-400">FinOps TCO: </span>
            <span className="font-mono font-bold text-slate-200">
              {summary ? `$${Math.round(summary.total_monthly_cost_usd).toLocaleString()}/mo` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Step 3: Explain Button */}
      {result && hasPredicted && (
        <div className="shrink-0">
          <button
            onClick={onOpenExplain}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer animate-pulse"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Объяснить расхождения (Explain)</span>
          </button>
        </div>
      )}
    </div>
  );
};
