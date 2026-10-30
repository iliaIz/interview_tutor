import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { Timer, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const HrPacingTimerBar: React.FC = () => {
  const elapsedTurnSec = useHrSimulatorStore((state) => state.elapsedTurnSec);
  const pacingWindowStatus = useHrSimulatorStore((state) => state.pacingWindowStatus);

  const maxSec = 90;
  const progressPercent = Math.min(100, Math.max(0, (elapsedTurnSec / maxSec) * 100));
  const optimalStartPercent = (60 / maxSec) * 100; // ~66.6%
  const optimalEndPercent = (80 / maxSec) * 100;   // ~88.8%
  const target75Percent = (75 / maxSec) * 100;     // ~83.3%

  return (
    <div className="w-full bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Timer className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span>Тайминг ответа (SLA 60–80с)</span>
        </div>
        <div className="flex items-center gap-2">
          {pacingWindowStatus === 'optimal' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Оптимальный темп
            </span>
          ) : pacingWindowStatus === 'overflow' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
              <AlertTriangle className="w-3 h-3" /> Перебор времени (&gt;80с)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              Формирование мысли
            </span>
          )}
          <span className="font-mono font-bold text-slate-800 text-xs">
            {elapsedTurnSec}s / 90s
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        {/* Optimal Window Highlight (60-80s) */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-100/70 border-x border-emerald-300"
          style={{
            left: `${optimalStartPercent}%`,
            width: `${optimalEndPercent - optimalStartPercent}%`
          }}
          title="Целевое окно ответа (60–80 сек)"
        />

        {/* 75s Target Marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-600 z-10"
          style={{ left: `${target75Percent}%` }}
          title="Идеальный 75-секундный питч"
        />

        {/* Dynamic Progress Fill */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            pacingWindowStatus === 'optimal'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : pacingWindowStatus === 'overflow'
              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
              : 'bg-gradient-to-r from-indigo-500 to-sky-400'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
        <span>0s</span>
        <span className="text-emerald-700 font-semibold">60s (SLA Min)</span>
        <span className="text-emerald-600 font-bold">75s (Питч)</span>
        <span className="text-amber-700 font-semibold">80s (SLA Max)</span>
        <span className="text-rose-600">90s (Отсечка)</span>
      </div>
    </div>
  );
};
