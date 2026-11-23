/**
 * CompanyTheoryHeader.tsx
 * Presenter for Company Theory Deck toolbar, search, and progress metrics.
 * SLA: <= 180 lines (Rule 8 compliant).
 */

import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface CompanyTheoryHeaderProps {
  companyName: string;
  totalCount: number;
  masteredCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedModule: string;
  setSelectedModule: (mod: string) => void;
  modules: string[];
  statusFilter: 'all' | 'unmastered' | 'mastered';
  setStatusFilter: (filter: 'all' | 'unmastered' | 'mastered') => void;
}

export const CompanyTheoryHeader: React.FC<CompanyTheoryHeaderProps> = ({
  companyName,
  totalCount,
  masteredCount,
  searchQuery,
  setSearchQuery,
  selectedModule,
  setSelectedModule,
  modules,
  statusFilter,
  setStatusFilter
}) => {
  const percentage = Math.round((masteredCount / (totalCount || 1)) * 100);

  return (
    <div className="space-y-6 font-sans">
      {/* Progress & Stats Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-600" /> Физика & Архитектура Собеседования
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Освоено: {masteredCount} из {totalCount} ({percentage}%)
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Senior Theory Deck: {companyName}
          </h3>
          <p className="text-xs text-slate-600">
            {totalCount} ключевых вопросов физического уровня (JVM, JMM, Spring, PostgreSQL, Kafka, ЦФА) с разбором байткода и красных флагов
          </p>
        </div>

        {/* Meter */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 self-start md:self-auto shrink-0">
          <div className="text-right">
            <span className="block text-2xl font-black text-slate-900 font-mono">
              {percentage}%
            </span>
            <span className="text-[10px] uppercase font-bold text-emerald-700">Прогресс теории</span>
          </div>
          <div className="w-20 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по вопросу, теме или байткод-инвариантам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-pastel-border/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-2 bg-white border border-pastel-border/80 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Все модули ({totalCount})</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="flex items-center bg-white border border-pastel-border/80 rounded-xl p-0.5 text-xs font-semibold">
            {(['all', 'unmastered', 'mastered'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === st
                    ? st === 'mastered'
                      ? 'bg-emerald-600 text-white'
                      : st === 'unmastered'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'Все' : st === 'unmastered' ? 'К изучению' : 'Освоено'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
