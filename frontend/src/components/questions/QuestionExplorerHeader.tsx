/**
 * QuestionExplorerHeader.tsx
 * Breadcrumbs, topic progress overview, and search/filter bar for QuestionExplorer.
 * Cognitive Bounding Limit: <= 180 lines (Rule 8 compliant).
 */

import React from 'react';
import { ArrowLeft, Search, Sparkles, X, CheckSquare, MinusSquare, Square } from 'lucide-react';
import { CatalogStats, FilterStatus } from '../../services/QuestionCatalogEngine';

export interface QuestionExplorerHeaderProps {
  selectedTopicName: string | null;
  topicMeta: any;
  stats: CatalogStats;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: FilterStatus;
  setStatusFilter: (f: FilterStatus) => void;
  onBackToTopics: () => void;
  isAllFilteredSelected: boolean;
  isPartiallySelected: boolean;
  filteredCount: number;
  selectedCount: number;
  onSelectAllFiltered: () => void;
  onSelectPreset: (preset: 'first5' | 'first10' | 'uncompleted' | 'all') => void;
  onClearSelection: () => void;
}

export const QuestionExplorerHeader: React.FC<QuestionExplorerHeaderProps> = ({
  selectedTopicName,
  topicMeta,
  stats,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onBackToTopics,
  isAllFilteredSelected,
  isPartiallySelected,
  filteredCount,
  selectedCount,
  onSelectAllFiltered,
  onSelectPreset,
  onClearSelection
}) => {
  return (
    <>
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToTopics}
            className="flex items-center gap-1.5 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Разделы
          </button>
          <span className="text-xs text-pastel-muted">/</span>
          <span className="text-xs font-bold text-pastel-text max-w-[200px] sm:max-w-md truncate">
            {selectedTopicName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 bg-pastel-lavender text-pastel-accentViolet rounded-full border border-pastel-accentViolet/20">
            {topicMeta?.category || 'Раздел'}
          </span>
          <span className="text-xs font-semibold px-3 py-1 bg-pastel-bg text-pastel-muted rounded-full border border-pastel-border">
            Всего {stats.total} вопросов
          </span>
        </div>
      </div>

      {/* Topic Title & Progress Overview Card */}
      <div className="bg-white rounded-3xl p-6 border border-pastel-border shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-pastel-accentRoseText mb-1">
              <Sparkles className="w-4 h-4" /> База вопросов темы
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-pastel-text">
              {selectedTopicName}
            </h1>
            {topicMeta?.description && (
              <p className="text-xs md:text-sm text-pastel-muted mt-1 max-w-2xl">
                {topicMeta.description}
              </p>
            )}
          </div>

          <div className="bg-pastel-bg/80 rounded-2xl p-4 border border-pastel-border/80 min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-semibold text-pastel-text mb-2">
              <span>Прогресс темы</span>
              <span className="text-pastel-accentViolet font-bold">{stats.percentage}%</span>
            </div>
            <div className="w-full bg-pastel-border h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
              <div className="bg-white rounded-lg py-1 border border-pastel-border/60">
                <span className="text-pastel-muted block">Изучено</span>
                <strong className="text-pastel-text font-bold">{stats.completed}</strong>
              </div>
              <div className="bg-emerald-50 rounded-lg py-1 border border-emerald-100 text-emerald-700">
                <span className="opacity-80 block">Освоено</span>
                <strong className="font-bold">{stats.mastered}</strong>
              </div>
              <div className="bg-white rounded-lg py-1 border border-pastel-border/60">
                <span className="text-pastel-muted block">Осталось</span>
                <strong className="text-pastel-text font-bold">{stats.uncompleted}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="bg-white rounded-2xl p-4 border border-pastel-border shadow-xs mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру (#5) или формулировке вопроса..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-pastel-bg/50 border border-pastel-border text-base sm:text-xs md:text-sm text-pastel-text placeholder-pastel-muted focus:outline-none focus:bg-white focus:ring-2 focus:ring-pastel-accentRose/30 focus:border-pastel-accentRose transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-pastel-muted hover:text-pastel-text p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {(['all', 'uncompleted', 'completed', 'mastered'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border shrink-0 cursor-pointer ${
                  statusFilter === f
                    ? 'bg-pastel-text text-white border-pastel-text shadow-xs'
                    : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
                }`}
              >
                {f === 'all' ? `Все (${stats.total})` : f === 'uncompleted' ? `Не начаты (${stats.uncompleted})` : f === 'completed' ? `В процессе (${stats.completed - stats.mastered})` : `Освоены (${stats.mastered})`}
              </button>
            ))}
          </div>
        </div>

        {/* Master Selection Row & Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pastel-border/60 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onSelectAllFiltered}
              className="flex items-center gap-2 font-semibold text-pastel-text hover:text-pastel-accentRose transition select-none cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-pastel-accentRose" />
              ) : isPartiallySelected ? (
                <MinusSquare className="w-4 h-4 text-pastel-accentRose" />
              ) : (
                <Square className="w-4 h-4 text-pastel-muted" />
              )}
              <span>{isAllFilteredSelected ? 'Снять всё' : `Выбрать все (${filteredCount})`}</span>
            </button>

            {selectedCount > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-pastel-accentRose/10 text-pastel-accentRoseText border border-pastel-accentRose/30">
                Выбрано: {selectedCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-pastel-muted flex-wrap">
            <span className="hidden md:inline text-pastel-muted/80">Быстрый выбор:</span>
            <button onClick={() => onSelectPreset('first5')} className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer">Первые 5</button>
            <button onClick={() => onSelectPreset('first10')} className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer">Первые 10</button>
            <button onClick={() => onSelectPreset('uncompleted')} className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-rose text-pastel-text transition border border-pastel-border/80 cursor-pointer">Все неизученные</button>
            {selectedCount > 0 && (
              <button onClick={onClearSelection} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition border border-rose-200 cursor-pointer">Сбросить</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
