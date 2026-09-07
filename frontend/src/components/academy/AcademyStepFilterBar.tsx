import React from 'react';
import { 
  Search, ChevronsUpDown, ChevronUp, Flame, Database, Bug, 
  Code2, Layers, Terminal, BookOpen 
} from 'lucide-react';

export type StepFilterType = 'all' | 'uncompleted' | 'transactions' | 'testing_mutation' | 'lld' | 'hld' | 'triage' | 'theory';

export interface StepFilterCounts {
  total: number;
  uncompleted: number;
  transactions: number;
  testingMutation: number;
  lld: number;
  hld: number;
  triage: number;
  theory: number;
}

interface AcademyStepFilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterType: StepFilterType;
  setFilterType: (f: StepFilterType) => void;
  filterCounts: StepFilterCounts;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const AcademyStepFilterBar: React.FC<AcademyStepFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterCounts,
  onExpandAll,
  onCollapseAll
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white/90 border border-pastel-border shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по шагам, темам и Bar-Raiser концептам (например, Virtual Threads, JMM, MVCC)..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-pastel-bg/60 rounded-xl border border-pastel-border text-pastel-text placeholder-pastel-muted focus:outline-hidden focus:border-pastel-accentRose/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-pastel-muted hover:text-pastel-text p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Expand / Collapse All Accordions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExpandAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pastel-bg hover:bg-pastel-rose/30 text-pastel-muted hover:text-pastel-text border border-pastel-border transition cursor-pointer"
            title="Развернуть все майлстоуны"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span className="hidden sm:inline">Развернуть все</span>
          </button>
          <button
            onClick={onCollapseAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pastel-bg hover:bg-pastel-rose/30 text-pastel-muted hover:text-pastel-text border border-pastel-border transition cursor-pointer"
            title="Свернуть все майлстоуны"
          >
            <ChevronUp className="w-3.5 h-3.5 text-pastel-muted" />
            <span className="hidden sm:inline">Свернуть все</span>
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'all'
              ? 'bg-pastel-text text-white shadow-2xs'
              : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text border border-pastel-border/60'
          }`}
        >
          <span>Все шаги ({filterCounts.total})</span>
        </button>

        <button
          onClick={() => setFilterType('uncompleted')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'uncompleted'
              ? 'bg-pastel-accentRose text-white shadow-2xs'
              : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text border border-pastel-border/60'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-500" />
          <span>В фокусе ({filterCounts.uncompleted})</span>
        </button>

        {filterCounts.transactions > 0 && (
          <button
            onClick={() => setFilterType('transactions')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
              filterType === 'transactions'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>Транзакции ({filterCounts.transactions})</span>
          </button>
        )}

        {filterCounts.testingMutation > 0 && (
          <button
            onClick={() => setFilterType('testing_mutation')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
              filterType === 'testing_mutation'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Bug className="w-3 h-3" />
            <span>Мутации & Тесты ({filterCounts.testingMutation})</span>
          </button>
        )}

        <button
          onClick={() => setFilterType('lld')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'lld'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          <Code2 className="w-3 h-3" />
          <span>Кодинг LLD ({filterCounts.lld})</span>
        </button>

        <button
          onClick={() => setFilterType('hld')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'hld'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Архитектура HLD ({filterCounts.hld})</span>
        </button>

        <button
          onClick={() => setFilterType('triage')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'triage'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <Terminal className="w-3 h-3" />
          <span>Дампы & Триаж ({filterCounts.triage})</span>
        </button>

        <button
          onClick={() => setFilterType('theory')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filterType === 'theory'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <BookOpen className="w-3 h-3" />
          <span>Теория ({filterCounts.theory})</span>
        </button>
      </div>
    </div>
  );
};
