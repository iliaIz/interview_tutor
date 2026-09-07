import React from 'react';
import { Search, X, CheckSquare, Square, MinusSquare, Info } from 'lucide-react';

export type FilterStatus = 'all' | 'uncompleted' | 'completed' | 'mastered';

interface QuestionFilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: FilterStatus;
  setStatusFilter: (status: FilterStatus) => void;
  stats: {
    total: number;
    completed: number;
    mastered: number;
    uncompleted: number;
  };
  filteredCount: number;
  selectedCount: number;
  isAllFilteredSelected: boolean;
  isPartiallySelected: boolean;
  onSelectAllFiltered: () => void;
  onSelectPreset: (preset: 'first5' | 'first10' | 'uncompleted' | 'all') => void;
  onClearSelection: () => void;
}

export const QuestionFilterBar: React.FC<QuestionFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  stats,
  filteredCount,
  selectedCount,
  isAllFilteredSelected,
  isPartiallySelected,
  onSelectAllFiltered,
  onSelectPreset,
  onClearSelection
}) => {
  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-pastel-border shadow-xs mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
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

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-pastel-text text-white border-pastel-text shadow-xs'
                  : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
              }`}
            >
              Все ({stats.total})
            </button>

            <button
              onClick={() => setStatusFilter('uncompleted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'uncompleted'
                  ? 'bg-pastel-accentRose text-white border-pastel-accentRose shadow-xs'
                  : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
              }`}
            >
              Не начаты ({stats.uncompleted})
            </button>

            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-pastel-accentViolet text-white border-pastel-accentViolet shadow-xs'
                  : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
              }`}
            >
              В процессе ({stats.completed - stats.mastered})
            </button>

            <button
              onClick={() => setStatusFilter('mastered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'mastered'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-pastel-bg'
              }`}
            >
              Освоены ({stats.mastered})
            </button>
          </div>
        </div>

        {/* Master Selection Row & Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pastel-border/60 text-xs">
          <div className="flex items-center gap-3">
            {/* Master Checkbox */}
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
              <span>
                {isAllFilteredSelected
                  ? 'Снять всё'
                  : `Выбрать все (${filteredCount})`}
              </span>
            </button>

            {selectedCount > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-pastel-accentRose/10 text-pastel-accentRoseText border border-pastel-accentRose/30">
                Выбрано: {selectedCount}
              </span>
            )}
          </div>

          {/* Quick Selection Presets */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-pastel-muted flex-wrap">
            <span className="hidden md:inline text-pastel-muted/80">Быстрый выбор:</span>
            <button
              onClick={() => onSelectPreset('first5')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Первые 5
            </button>
            <button
              onClick={() => onSelectPreset('first10')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Первые 10
            </button>
            <button
              onClick={() => onSelectPreset('uncompleted')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-rose text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Все неизученные
            </button>
            {selectedCount > 0 && (
              <button
                onClick={onClearSelection}
                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition border border-rose-200 cursor-pointer"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Helpful Hint Bar */}
      <div className="flex items-center gap-2 mb-4 px-2 text-[11px] text-pastel-muted">
        <Info className="w-3.5 h-3.5 text-pastel-accentViolet shrink-0" />
        <span>
          <strong>Подсказка:</strong> Зажмите <kbd className="px-1.5 py-0.5 bg-white border border-pastel-border rounded font-mono text-[10px]">Shift</kbd> при клике по чекбоксу для выделения диапазона вопросов.
        </span>
      </div>
    </>
  );
};
