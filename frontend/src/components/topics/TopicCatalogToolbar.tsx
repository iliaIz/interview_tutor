/**
 * TopicCatalogToolbar.tsx
 * Presenter for TopicSelector hero banner, search bar, domain filter dropdown,
 * shuffle toggle, and view mode switcher.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import React, { useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Shuffle, FolderTree, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DomainDefinition } from '../../services/topics/TopicCatalogEngine';

interface TopicCatalogToolbarProps {
  totalTopics: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDomain: string;
  setSelectedDomain: (domainId: string) => void;
  domainOptions: Array<DomainDefinition & { count: number }>;
  activeDomainMeta: DomainDefinition & { count: number };
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  isGlobalShuffle: boolean;
  setIsGlobalShuffle: (shuffle: boolean) => void;
  viewMode: 'domains' | 'grid';
  setViewMode: (mode: 'domains' | 'grid') => void;
}

export const TopicCatalogToolbar: React.FC<TopicCatalogToolbarProps> = ({
  totalTopics,
  searchQuery,
  setSearchQuery,
  selectedDomain,
  setSelectedDomain,
  domainOptions,
  activeDomainMeta,
  isDropdownOpen,
  setIsDropdownOpen,
  isGlobalShuffle,
  setIsGlobalShuffle,
  viewMode,
  setViewMode
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsDropdownOpen]);

  // Keyboard shortcut '/' to focus search & 'Escape' to clear/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsDropdownOpen, setSearchQuery]);

  const ActiveDomainIcon = activeDomainMeta?.icon || FolderTree;

  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">
            📚 База Знаний Java & Spring
          </span>
          <span className="text-xs text-pastel-muted font-mono font-bold">
            {totalTopics} тем • 800+ вопросов
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
          Инженерная Теория & Собеседования
        </h1>
        <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
          Фундаментальные концепты, скрытые ловушки JVM, транзакции, многопоточность и Spring Internals с мгновенным переходом в блиц-тренажер.
        </p>
      </div>

      {/* SOTA Omni-Toolbar */}
      <div className="mt-5 pt-4 border-t border-pastel-border/60 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 relative z-30">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Поиск по 800+ вопросам, концептам, ловушкам JVM (нажмите /)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-14 py-2.5 bg-pastel-bg border border-pastel-border rounded-2xl text-xs text-pastel-text placeholder-pastel-muted/60 focus:outline-none focus:border-pastel-accentRose focus:bg-white transition shadow-2xs font-sans"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pastel-muted hover:text-pastel-text p-1 cursor-pointer"
              title="Очистить поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-mono text-pastel-muted">
              /
            </kbd>
          )}
        </div>

        {/* Controls Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Domain Dropdown Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition cursor-pointer select-none shadow-2xs ${
                selectedDomain !== 'all'
                  ? 'bg-purple-50 text-purple-900 border-purple-300 ring-2 ring-purple-200/50'
                  : 'bg-pastel-bg text-pastel-text border-pastel-border hover:bg-white hover:border-pastel-border/80'
              }`}
              title="Фильтр по инженерным доменам"
            >
              <ActiveDomainIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: activeDomainMeta.color }}
              />
              <span className="max-w-[140px] sm:max-w-[180px] truncate">
                {activeDomainMeta.title}
              </span>
              <span className="text-[10px] font-mono opacity-70">
                ({activeDomainMeta.count})
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-pastel-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-pastel-border shadow-xl p-1.5 z-50 divide-y divide-pastel-border/50"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-pastel-muted uppercase tracking-wider">
                    Инженерные разделы
                  </div>

                  <div className="py-1 space-y-0.5">
                    {domainOptions.map((opt) => {
                      const Icon = opt.icon || FolderTree;
                      const isSelected = selectedDomain === opt.id;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedDomain(opt.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-pastel-rose/40 text-pastel-accentRose font-bold'
                              : 'text-pastel-text hover:bg-pastel-bg'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${opt.color}15`, color: opt.color }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate">{opt.title}</span>
                          </div>

                          <span className="text-[11px] font-mono text-pastel-muted shrink-0 ml-2">
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDomain !== 'all' && (
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setSelectedDomain('all');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-center py-1.5 text-[11px] font-bold text-pastel-accentRose hover:bg-pastel-rose/30 rounded-xl transition cursor-pointer"
                      >
                        Сбросить фильтр (Все разделы)
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Random Shuffle Toggle */}
          <button
            onClick={() => setIsGlobalShuffle(!isGlobalShuffle)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isGlobalShuffle
                ? 'bg-purple-100 text-purple-900 border-purple-300'
                : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:text-pastel-text hover:bg-white'
            }`}
            title="Случайный порядок вопросов в блиц-опросах"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isGlobalShuffle ? 'text-purple-700 animate-spin-slow' : 'text-pastel-muted'}`} />
            <span className="hidden sm:inline">Рандом</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-pastel-bg p-1 rounded-2xl border border-pastel-border shadow-2xs">
            <button
              onClick={() => setViewMode('domains')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewMode === 'domains'
                  ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="Сгруппировать по доменам"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Домены</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="Компактная сетка"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сетка</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
