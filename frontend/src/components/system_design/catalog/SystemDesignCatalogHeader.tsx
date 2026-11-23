import React from 'react';
import { Calculator, Search } from 'lucide-react';
import { LevelFilter } from '../utils/scenarioLevel';

export interface SystemDesignCatalogHeaderProps {
  totalScenarios: number;
  selectedLevel: LevelFilter;
  onSelectLevel: (level: LevelFilter) => void;
  levelCounts: { all: number; L3: number; L4: number; L5_L7: number };
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenMathCoach: () => void;
}

export const SystemDesignCatalogHeader: React.FC<SystemDesignCatalogHeaderProps> = ({
  totalScenarios,
  selectedLevel,
  onSelectLevel,
  levelCounts,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onOpenMathCoach
}) => {
  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-pastel-accentViolet border border-purple-200">
              🏛️ Multi-Scale Capability Arena (MSCA)
            </span>
            <span className="text-xs text-pastel-muted font-mono font-bold">
              {totalScenarios} канонических сценариев BigTech
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
            System Design & Архитектура Высоких Нагрузок
          </h1>
          <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
            Единый SSOT-каталог: алгоритмические микро-каты (L3), инженерная починка сбоев (L4), комбат-арены распределенных систем (L5–L7) с симулятором нагрузки и защитой перед Staff Bar-Raiser.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenMathCoach}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs hover:shadow-md transition active:scale-95 cursor-pointer"
            title="Открыть интерактивный тренажер Back-of-the-Envelope расчетов емкости"
          >
            <Calculator className="w-4 h-4" />
            <span>🧮 Math Coach: Расчеты на салфетке</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-md font-mono">10 кейсов</span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-pastel-bg border border-pastel-border text-xs text-pastel-muted font-mono shrink-0">
            <span>Навигация:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">Enter</kbd>
          </div>
        </div>
      </div>

      {/* Cognitive Ladder */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-xs">
        <button
          type="button"
          onClick={() => onSelectLevel('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedLevel === 'all'
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Все сценарии</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            selectedLevel === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/60 text-slate-600'
          }`}>
            {levelCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectLevel('L3')}
          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedLevel === 'L3'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>L3: Микро-примитивы</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            selectedLevel === 'L3' ? 'bg-emerald-700/80 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {levelCounts.L3}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectLevel('L4')}
          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedLevel === 'L4'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-amber-700 hover:bg-amber-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>L4: Устранение сбоев</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            selectedLevel === 'L4' ? 'bg-amber-700/80 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {levelCounts.L4}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectLevel('L5_L7')}
          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
            selectedLevel === 'L5_L7'
              ? 'bg-violet-600 text-white shadow-2xs'
              : 'text-violet-700 hover:bg-violet-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <span>L5–L7: Combat Arenas (Senior & Staff)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            selectedLevel === 'L5_L7' ? 'bg-violet-700/80 text-white' : 'bg-violet-100 text-violet-800'
          }`}>
            {levelCounts.L5_L7}
          </span>
        </button>
      </div>

      {/* Search & Category Filters */}
      <div className="mt-3 pt-3 border-t border-pastel-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-pastel-text text-white shadow-xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
              }`}
            >
              {cat === 'all' ? `Все архетипы (${totalScenarios})` : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по задачам, RPS, Kafka, Raft..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
          />
        </div>
      </div>
    </div>
  );
};
