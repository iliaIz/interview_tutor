import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Search,
  ChevronDown,
  Shuffle,
  FolderTree,
  LayoutGrid,
  Loader2,
  Zap,
  Crown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailySmartReviewBanner } from './DailySmartReviewBanner';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { FsrsQueueItemDTO } from '../types/fsrs';
import { DOMAIN_DEFINITIONS, DomainMeta, ICON_MAP } from './topics/topicIconRegistry';
import { TopicDomainCard, DomainGroup } from './topics/TopicDomainCard';
import { TopicGridCard } from './topics/TopicGridCard';

export const TopicSelector: React.FC = () => {
  const {
    startStudyWithQuestions,
    shuffleMap,
    topicsProgress,
    syncTopicProgress,
    resetTopicProgress,
    openTopicQuestions,
    showToast,
    topicAccessMap
  } = useAppStore();

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'domains' | 'grid'>('domains');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [isGlobalShuffle, setIsGlobalShuffle] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
        if (Array.isArray(data)) {
          data.forEach((t: any) => {
            syncTopicProgress(t.id, t.completedCount || 0, t.percentage || 0, t.total || 0);
          });
        }
      }
    } catch (e) {
      console.error('Error fetching topics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut '/' to focus search & 'Escape' to clear/close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleDomainCollapse = (domainId: string) => {
    setCollapsedDomains(prev => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  };

  // Available domain list with dynamic counts
  const domainOptions = useMemo(() => {
    const dynamicCategories = Array.from(new Set(topics.map(t => t.category).filter(Boolean)));
    
    return DOMAIN_DEFINITIONS.map(def => {
      let count = 0;
      if (def.id === 'all') {
        count = topics.length;
      } else {
        count = topics.filter(t => t.category === def.id).length;
      }
      return {
        ...def,
        count
      };
    }).filter(d => d.id === 'all' || d.count > 0);
  }, [topics]);

  const activeDomainMeta = useMemo(() => {
    return domainOptions.find(d => d.id === selectedDomain) || domainOptions[0];
  }, [domainOptions, selectedDomain]);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesDomain = selectedDomain === 'all' || t.category === selectedDomain;
      const matchesSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [topics, selectedDomain, searchQuery]);

  // Group by Domain Hub
  const groupedDomains = useMemo(() => {
    const map = new Map<string, any[]>();
    
    // Ordered categories
    DOMAIN_DEFINITIONS.filter(d => d.id !== 'all').forEach(d => map.set(d.id, []));

    filteredTopics.forEach(t => {
      const cat = t.category || 'Other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(t);
    });

    return Array.from(map.entries())
      .map(([domainId, topicList]) => {
        const meta = DOMAIN_DEFINITIONS.find(d => d.id === domainId) || {
          id: domainId,
          title: domainId,
          icon: FolderTree,
          color: '#8B78E6',
          desc: 'Специализированные темы подготовки'
        };

        const totalQuestions = topicList.reduce((acc, t) => acc + (t.total || 0), 0);
        const totalCompleted = topicList.reduce((acc, t) => {
          const p = topicsProgress[t.id];
          return acc + (p?.completedCount !== undefined ? p.completedCount : (t.completedCount || 0));
        }, 0);
        const percentage = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

        return {
          ...meta,
          topics: topicList,
          totalQuestions,
          totalCompleted,
          percentage
        };
      })
      .filter(d => d.topics.length > 0);
  }, [filteredTopics, topicsProgress]);

  const handleStartTopic = async (topicId: string, topicName: string, reset: boolean = false) => {
    setStartingTopicId(topicId);

    if (reset) {
      resetTopicProgress(topicId);
      try {
        await fetch(`/api/topics/${topicId}/reset`, { method: 'POST' });
      } catch (e) {
        console.warn('Error resetting topic progress on backend:', e);
      }
    }

    try {
      const isShuffle = isGlobalShuffle || shuffleMap[topicId] || false;
      const res = await fetch(`/api/topics/${topicId}/questions`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const allQuestions = data.questions || [];

      if (!allQuestions || allQuestions.length === 0) {
        showToast({
          type: 'warning',
          title: 'Вопросы не найдены',
          message: `Для темы "${topicName}" пока нет доступных вопросов.`
        });
        return;
      }

      const progress = topicsProgress[topicId];
      const localCompletedSet = new Set(progress?.completedIds || []);

      let remainingQuestions = reset
        ? allQuestions
        : allQuestions.filter((q: any) => !q.isCompleted && !localCompletedSet.has(q.id));

      if (remainingQuestions.length === 0) {
        remainingQuestions = allQuestions;
      }

      if (isShuffle) {
        remainingQuestions = [...remainingQuestions].sort(() => Math.random() - 0.5);
      }

      const batchPortion = remainingQuestions.slice(0, 10);
      startStudyWithQuestions(topicId, topicName, batchPortion);
    } catch (e: any) {
      console.error('Error starting topic batch:', e);
      showToast({
        type: 'error',
        title: 'Ошибка загрузки вопросов',
        message: e?.message || 'Не удалось загрузить вопросы по выбранной теме.'
      });
    } finally {
      setStartingTopicId(null);
    }
  };

  const handleStartBlitzReview = (queueItems: FsrsQueueItemDTO[]) => {
    if (!queueItems || queueItems.length === 0) return;
    const questionsForStudy = queueItems.map((q, idx) => ({
      id: q.questionId,
      topic: q.topic,
      question: q.question,
      answer: q.answer,
      num: idx + 1
    }));
    startStudyWithQuestions('fsrs_blitz', '⚡ Блиц-повторение (FSRS-5)', questionsForStudy as any);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-pastel-muted">Загрузка Базы знаний...</p>
      </div>
    );
  }

  const ActiveDomainIcon = activeDomainMeta?.icon || FolderTree;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in font-sans pb-24">
      {/* 0. Daily Smart Review Banner (FSRS-5 SOTA) */}
      <DailySmartReviewBanner
        onStartBlitz={handleStartBlitzReview}
        onOpenRadar={() => setIsRadarOpen(true)}
      />

      {/* 1. Hero Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">
              📚 База Знаний Java & Spring
            </span>
            <span className="text-xs text-pastel-muted font-mono font-bold">
              {topics.length} тем • 800+ вопросов
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
            Инженерная Теория & Собеседования
          </h1>
          <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
            Фундаментальные концепты, скрытые ловушки JVM, транзакции, многопоточность и Spring Internals с мгновенным переходом в блиц-тренажер.
          </p>
        </div>

        {/* 2. SOTA 2026 OMNI-TOOLBAR (Zero Horizontal Congestion) */}
        <div className="mt-5 pt-4 border-t border-pastel-border/60 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 relative z-30">
          {/* Full-width Responsive Search Bar */}
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

      {/* Empty Search State */}
      {filteredTopics.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Search className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Темы не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto leading-relaxed">
            {searchQuery ? (
              <>По запросу «<strong className="text-pastel-text">{searchQuery}</strong>» ничего не найдено в разделе «{activeDomainMeta.title}».</>
            ) : (
              <>В выбранном разделе пока нет тем.</>
            )}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('all');
              }}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить фильтры (Esc)
            </button>
          </div>
        </div>
      ) : viewMode === 'domains' ? (
        <div className="space-y-5">
          {groupedDomains.map((domain) => (
            <TopicDomainCard
              key={domain.id}
              domain={domain as DomainGroup}
              isCollapsed={Boolean(collapsedDomains[domain.id])}
              onToggleCollapse={toggleDomainCollapse}
              topicsProgress={topicsProgress}
              startingTopicId={startingTopicId}
              topicAccessMap={topicAccessMap}
              onOpenTopicQuestions={openTopicQuestions}
              onStartTopic={handleStartTopic}
            />
          ))}
        </div>
      ) : (
        /* 4. COMPACT GRID VIEW (Alternative) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((t) => {
            const progress = topicsProgress[t.id];
            const percentage = progress?.percentage !== undefined ? progress.percentage : (t.percentage || 0);

            return (
              <TopicGridCard
                key={t.id}
                topic={t}
                percentage={percentage}
                isStarting={startingTopicId === t.id}
                onOpenQuestions={openTopicQuestions}
                onStartTopic={handleStartTopic}
              />
            );
          })}
        </div>
      )}

      {/* Memory Radar Drawer (FSRS-5 SOTA) */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={(topic) => {
          setSelectedDomain('all');
          setSearchQuery(topic);
        }}
        onStartBlitzWithQuestions={handleStartBlitzReview}
      />
    </div>
  );
};
