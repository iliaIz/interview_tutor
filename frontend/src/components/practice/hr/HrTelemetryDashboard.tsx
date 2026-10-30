import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { Activity, Gauge, AlertCircle, Sparkles, MessageSquareQuote } from 'lucide-react';

const PHASE_LABELS: Record<string, string> = {
  phase1_smalltalk: 'Знакомство',
  phase2_elevator_pitch: 'Elevator Pitch (75с)',
  phase3_work_format_and_rates: 'Формат и ожидания',
  phase4_deep_probe_conflict: 'Поведенческий кейс',
  phase5_wrap_up_and_feedback: 'Итоги и обратная связь'
};

export const HrTelemetryDashboard: React.FC = () => {
  const rollingWpm = useHrSimulatorStore((state) => state.rollingWpm);
  const pacingStatus = useHrSimulatorStore((state) => state.pacingStatus);
  const hesitationCount = useHrSimulatorStore((state) => state.hesitationCount);
  const fillerWordsSpotted = useHrSimulatorStore((state) => state.fillerWordsSpotted);
  const currentPhase = useHrSimulatorStore((state) => state.currentPhase);

  const getWpmColor = () => {
    if (pacingStatus === 'optimal') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (pacingStatus === 'too_fast') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-sky-700 bg-sky-50 border-sky-200';
  };

  const getWpmLabel = () => {
    if (pacingStatus === 'optimal') return '115–135 WPM (Эталон)';
    if (pacingStatus === 'too_fast') return 'Спешка (>140 WPM)';
    return 'Замедление (<110 WPM)';
  };

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
      {/* 1. Phase Tracker */}
      <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
          <Activity className="w-3 h-3 text-pastel-accentRose" />
          <span>Фаза</span>
        </div>
        <div className="text-xs font-bold text-slate-700 mt-1 truncate">
          {PHASE_LABELS[currentPhase] || currentPhase}
        </div>
      </div>

      {/* 2. Rolling WPM Meter */}
      <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-pastel-accentRose" />
            <span>Темп речи</span>
          </span>
          <span className="font-mono font-bold text-slate-600">{rollingWpm} wpm</span>
        </div>
        <div className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getWpmColor()}`}>
          {getWpmLabel()}
        </div>
      </div>

      {/* 3. Hesitations / Long Pauses */}
      <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-pastel-accentRose" />
            <span>Заминки</span>
          </span>
          <span className="font-mono font-bold text-slate-600">{hesitationCount}</span>
        </div>
        <div className="text-[11px] font-semibold text-slate-700 mt-1">
          {hesitationCount === 0 ? (
            <span className="text-emerald-600 flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" /> Без зависаний
            </span>
          ) : (
            <span className="text-amber-600">Паузы &gt; 2.5с</span>
          )}
        </div>
      </div>

      {/* 4. Filler Words Tracker */}
      <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <MessageSquareQuote className="w-3 h-3 text-pastel-accentRose" />
            <span>Паразиты</span>
          </span>
          <span className="font-mono font-bold text-slate-600">{fillerWordsSpotted.length}</span>
        </div>
        <div className="text-[11px] font-medium text-slate-600 mt-1 truncate">
          {fillerWordsSpotted.length === 0 ? (
            <span className="text-emerald-600 font-semibold">Чистая речь</span>
          ) : (
            <span className="text-rose-600 truncate" title={fillerWordsSpotted.join(', ')}>
              {fillerWordsSpotted.slice(0, 2).join(', ')}
              {fillerWordsSpotted.length > 2 ? '...' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
