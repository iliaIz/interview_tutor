import React from 'react';
import { Database, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { TransactionScenario } from '../../types/transactionLab';

interface TransactionScenarioSelectorProps {
  scenarios: TransactionScenario[];
  activeScenarioId: string;
  selectedLevel: 'all' | 'L0' | 'L1' | 'L2' | 'L3';
  onSelectLevel: (level: 'all' | 'L0' | 'L1' | 'L2' | 'L3') => void;
  onSelectScenario: (scenarioId: string) => void;
}

export const TransactionScenarioSelector: React.FC<TransactionScenarioSelectorProps> = ({
  scenarios,
  activeScenarioId,
  selectedLevel,
  onSelectLevel,
  onSelectScenario
}) => {
  const levels: Array<'all' | 'L0' | 'L1' | 'L2' | 'L3'> = ['all', 'L0', 'L1', 'L2', 'L3'];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/95 border border-slate-200/90 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-pastel-accentRose" />
          <h3 className="font-extrabold text-xs text-slate-800 tracking-wide uppercase">
            Каталог сценариев Spring Transactions
          </h3>
        </div>

        {/* Level filter tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {levels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => onSelectLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lvl === 'all' ? 'Все' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal scrollable scenario cards */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 touch-pan-x">
        {scenarios.map((sc) => {
          const isActive = sc.id === activeScenarioId;

          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => onSelectScenario(sc.id)}
              className={`flex flex-col p-2.5 rounded-xl border text-left transition-all shrink-0 min-w-[220px] max-w-[260px] cursor-pointer ${
                isActive
                  ? 'bg-rose-50/50 border-rose-300 shadow-xs ring-2 ring-rose-100'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                  {sc.level}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {sc.domain}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-800 truncate w-full">
                {sc.title}
              </div>
              <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                {sc.problemStatement}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
