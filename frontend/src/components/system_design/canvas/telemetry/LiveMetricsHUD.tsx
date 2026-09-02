import React from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Play, 
  Pause, 
  Sliders, 
  TrendingUp, 
  Clock, 
  ShieldAlert 
} from 'lucide-react';
import { SimulationTelemetryFrame } from '../../../../types/systemDesignCanvas';

interface LiveMetricsHUDProps {
  telemetry: SimulationTelemetryFrame | null;
  inputRps: number;
  onSetInputRps: (rps: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const LiveMetricsHUD: React.FC<LiveMetricsHUDProps> = ({
  telemetry,
  inputRps,
  onSetInputRps,
  isPaused,
  onTogglePause
}) => {
  const globalInputRps = telemetry?.globalInputRps ?? inputRps;
  const globalProcessedRps = telemetry?.globalProcessedRps ?? 0;
  const p99 = telemetry?.globalP99LatencyMs ?? 0;
  const errorRate = telemetry?.globalErrorRate ?? 0;
  const antiPatterns = telemetry?.antiPatterns ?? [];

  return (
    <div className="absolute top-4 right-4 z-20 w-80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3.5 space-y-3 select-none">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            isPaused ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
          }`}>
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              DES Load Simulator
            </div>
            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
              60 FPS Web Worker • Erlang-C
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onTogglePause}
          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          title={isPaused ? 'Возобновить симуляцию' : 'Поставить на паузу'}
        >
          {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-amber-500" />}
        </button>
      </div>

      {/* Traffic Dial Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5" />
            Входящий трафик:
          </span>
          <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
            {inputRps.toLocaleString()} RPS
          </span>
        </div>
        <input
          type="range"
          min={100}
          max={20000}
          step={200}
          value={inputRps}
          onChange={(e) => onSetInputRps(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
        />
        <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-300 font-mono">
          <span>100 RPS</span>
          <span>5k RPS</span>
          <span>20k RPS</span>
        </div>
      </div>

      {/* Live Metric Cards Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-600 dark:text-slate-300">Throughput</div>
          <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5">
            {globalProcessedRps.toLocaleString()}
          </div>
          <div className="text-[8px] text-slate-600 dark:text-slate-300">RPS</div>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-600 dark:text-slate-300">p99 Latency</div>
          <div className={`font-mono font-bold text-xs mt-0.5 ${
            p99 > 500 ? 'text-rose-500' : p99 > 150 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {p99}
          </div>
          <div className="text-[8px] text-slate-600 dark:text-slate-300">мс</div>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-600 dark:text-slate-300">Error Rate</div>
          <div className={`font-mono font-bold text-xs mt-0.5 ${
            errorRate > 0.05 ? 'text-rose-500' : errorRate > 0 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {(errorRate * 100).toFixed(1)}%
          </div>
          <div className="text-[8px] text-slate-600 dark:text-slate-300">Ошибки</div>
        </div>
      </div>

      {/* Anti-Patterns & Bottlenecks Warning Banner */}
      {antiPatterns.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-semibold text-rose-500 flex items-center gap-1 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" />
            <span>Архитектурные дефекты ({antiPatterns.length}):</span>
          </div>

          <div className="max-h-28 overflow-y-auto space-y-1">
            {antiPatterns.map(ap => (
              <div 
                key={ap.id}
                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[10px]"
              >
                <div className="font-medium text-rose-700 dark:text-rose-300 leading-tight">
                  {ap.title}
                </div>
                <div className="text-slate-600 dark:text-slate-400 mt-0.5 text-[9px] leading-snug">
                  {ap.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
