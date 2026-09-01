import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Coffee,
  Boxes,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Leaf,
  ArrowLeftRight,
  Archive,
  GitFork,
  Database,
  Table,
  Link as LinkIcon,
  Activity,
  Server,
  Globe,
  Radio,
  CheckCircle2,
  FileText,
  Code2,
  Network,
  FileCode,
  Palette,
  BookOpen,
  Play,
  RotateCcw,
  Shuffle,
  Headphones,
  Search,
  Check,
  ListChecks,
  ChevronRight,
  ChevronDown,
  Bug,
  Crown,
  Trophy,
  Loader2,
  Clock,
  ArrowUpDown,
  TrendingUp,
  LayoutGrid,
  FolderTree
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_MAP: Record<string, any> = {
  'coffee': Coffee,
  'boxes': Boxes,
  'cpu': Cpu,
  'layers': Layers,
  'sparkles': Sparkles,
  'zap': Zap,
  'leaf': Leaf,
  'arrow-left-right': ArrowLeftRight,
  'archive': Archive,
  'git-fork': GitFork,
  'database': Database,
  'table': Table,
  'link': LinkIcon,
  'activity': Activity,
  'server': Server,
  'globe': Globe,
  'radio': Radio,
  'check-circle-2': CheckCircle2,
  'file-text': FileText,
  'code-2': Code2,
  'network': Network,
  'file-code': FileCode,
  'palette': Palette
};

const DOMAIN_ORDER = [
  { id: 'Core Java & JVM', title: 'Core Java & JVM Internals', icon: Coffee, color: '#E08E89', desc: 'Синтаксис, память, ООП, Collections, Generics, Lambdas & JVM' },
  { id: 'Architecture & Concurrency', title: 'Architecture, Concurrency & Loom', icon: Zap, color: '#8B78E6', desc: 'JMM, Threads, Locks, Virtual Threads, Patterns & I/O' },
  { id: 'Data & Storage', title: 'Databases, Storage & ACID', icon: Database, color: '#5A9E96', desc: 'PostgreSQL, SQL, Hibernate, JPA, Транзакции & Redis' },
  { id: 'Web & Enterprise', title: 'Spring Enterprise & Architecture', icon: Server, color: '#4F8A8B', desc: 'Spring Boot, IoC, Spring Data, Security & Microservices' },
  { id: 'Engineering & Tools', title: 'Engineering, Testing & Forensics', icon: Activity, color: '#D97706', desc: 'Kafka, CI/CD, Docker, Тестирование & JFR/GC Profiling' }
];

export const TopicSelector: React.FC = () => {
  const {
    setView,
    setSelectedTopic,
    startStudyWithQuestions,
    shuffleMap,
    toggleShuffle,
    topicsProgress,
    resetTopicProgress,
    openRecapModal,
    openTopicQuestions,
    openTopicBugHunt,
    showToast,
    topicAccessMap
  } = useAppStore();

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'domains' | 'grid'>('domains');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все разделы');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<'mru' | 'default' | 'progress' | 'questions'>('default');
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [isGlobalShuffle, setIsGlobalShuffle] = useState(false);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
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

  const toggleDomainCollapse = (domainId: string) => {
    setCollapsedDomains(prev => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(topics.map(t => t.category).filter(Boolean)));
    return ['Все разделы', ...unique];
  }, [topics]);

  const filteredAndSortedTopics = useMemo(() => {
    const filtered = topics.filter((t) => {
      const matchesCategory =
        selectedCategory === 'Все разделы' || t.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'mru') {
        const aMeta = topicAccessMap?.[a.id];
        const bMeta = topicAccessMap?.[b.id];
        const aTime = aMeta?.lastAccessedAt || 0;
        const bTime = bMeta?.lastAccessedAt || 0;
        if (aTime && bTime) return bTime - aTime;
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
      }
      if (sortMode === 'progress') {
        const aProgress = topicsProgress[a.id]?.percentage || a.percentage || 0;
        const bProgress = topicsProgress[b.id]?.percentage || b.percentage || 0;
        return bProgress - aProgress;
      }
      if (sortMode === 'questions') {
        const aCount = a.questionCount || a.total || 0;
        const bCount = b.questionCount || b.total || 0;
        return bCount - aCount;
      }
      return 0;
    });
  }, [topics, selectedCategory, searchQuery, sortMode, topicAccessMap, topicsProgress]);

  // Group by Domain Hub
  const groupedDomains = useMemo(() => {
    const map = new Map<string, any[]>();
    
    // Initialize standard domains
    DOMAIN_ORDER.forEach(d => map.set(d.id, []));

    filteredAndSortedTopics.forEach(t => {
      const cat = t.category || 'Other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(t);
    });

    return Array.from(map.entries())
      .map(([domainId, topicList]) => {
        const meta = DOMAIN_ORDER.find(d => d.id === domainId) || {
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
  }, [filteredAndSortedTopics, topicsProgress]);

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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-pastel-muted">Загрузка Базы знаний...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in font-sans pb-24">
      {/* 1. Hero Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
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

          {/* View Switcher & Global Shuffle */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => setIsGlobalShuffle(!isGlobalShuffle)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition cursor-pointer ${
                isGlobalShuffle
                  ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:text-pastel-text'
              }`}
              title="Случайный порядок вопросов в блиц-опросах"
            >
              <Shuffle className={`w-3.5 h-3.5 ${isGlobalShuffle ? 'text-purple-700 animate-spin-slow' : 'text-pastel-muted'}`} />
              <span className="hidden sm:inline">Рандом</span>
            </button>

            <div className="flex items-center bg-pastel-bg p-1 rounded-2xl border border-pastel-border">
              <button
                onClick={() => setViewMode('domains')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'domains'
                    ? 'bg-white text-pastel-accentRose shadow-xs border border-pastel-border/60'
                    : 'text-pastel-muted hover:text-pastel-text'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Домены</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-pastel-accentRose shadow-xs border border-pastel-border/60'
                    : 'text-pastel-muted hover:text-pastel-text'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Сетка</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Search & Category Filters */}
        <div className="mt-5 pt-4 border-t border-pastel-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-pastel-text text-white shadow-xs'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск тем, концептов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
            />
          </div>
        </div>
      </div>

      {/* 3. DOMAIN HUB VIEW (Standard SOTA 2026) */}
      {viewMode === 'domains' ? (
        <div className="space-y-5">
          {groupedDomains.map((domain) => {
            const isCollapsed = Boolean(collapsedDomains[domain.id]);
            const DomainIcon = domain.icon || FolderTree;

            return (
              <div
                key={domain.id}
                className="bg-white/95 border border-pastel-border/80 rounded-3xl overflow-hidden shadow-xs transition-all duration-200"
              >
                {/* Domain Header Banner */}
                <div
                  onClick={() => toggleDomainCollapse(domain.id)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-gradient-to-r from-pastel-bg/60 via-white to-pastel-bg/40 cursor-pointer hover:bg-pastel-rose/20 transition select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: `${domain.color}20`, color: domain.color }}
                    >
                      <DomainIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-sm sm:text-base text-pastel-text truncate">
                          {domain.title}
                        </h2>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.2 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border">
                          {domain.topics.length} тем
                        </span>
                      </div>
                      <p className="text-xs text-pastel-muted truncate hidden sm:block">
                        {domain.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right Progress & Toggle */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-mono font-bold text-pastel-text">
                        {domain.totalCompleted} / {domain.totalQuestions} вопр.
                      </div>
                      <div className="w-24 h-1.5 bg-pastel-border rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet rounded-full transition-all duration-500"
                          style={{ width: `${domain.percentage}%` }}
                        />
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                      {domain.percentage}%
                    </span>

                    <button
                      className="w-8 h-8 rounded-full flex items-center justify-center text-pastel-muted hover:text-pastel-text transition"
                      aria-label="Свернуть домен"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transform transition-transform duration-200 ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Topics List Inside Domain */}
                {!isCollapsed && (
                  <div className="divide-y divide-pastel-border/60 border-t border-pastel-border/60">
                    {domain.topics.map((t) => {
                      const IconComponent = ICON_MAP[t.icon] || Coffee;
                      const progress = topicsProgress[t.id];
                      const completedCount = progress?.completedCount !== undefined ? progress.completedCount : (t.completedCount || 0);
                      const percentage = progress?.percentage !== undefined ? progress.percentage : (t.percentage || 0);
                      const isStarting = startingTopicId === t.id;
                      const isFullyMastered = percentage === 100;
                      const accessMeta = topicAccessMap?.[t.id];

                      return (
                        <div
                          key={t.id}
                          className="p-3.5 sm:p-4 hover:bg-pastel-bg/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          {/* Topic Details */}
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <div
                              onClick={() => openTopicQuestions(t.id, t.name)}
                              className="p-2.5 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer group-hover:scale-105 transition-transform"
                              style={{ backgroundColor: `${t.color}18`, color: t.color }}
                              title="Открыть список вопросов"
                            >
                              <IconComponent className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  onClick={() => openTopicQuestions(t.id, t.name)}
                                  className="font-bold text-xs sm:text-sm text-pastel-text hover:text-pastel-accentRose transition-colors cursor-pointer"
                                >
                                  {t.name}
                                </span>

                                {isFullyMastered ? (
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                                    <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" /> Mastered
                                  </span>
                                ) : percentage > 0 ? (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {percentage}%
                                  </span>
                                ) : null}

                                {accessMeta?.lastAccessedAt && (
                                  <span className="text-[9px] font-semibold text-pastel-accentViolet bg-pastel-lavender/50 px-1.5 py-0.2 rounded-full border border-pastel-accentViolet/20 hidden md:inline">
                                    Недавно
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-pastel-muted truncate mt-0.5 max-w-xl">
                                {t.description}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons: 2 Clear CTAs */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              onClick={() => openTopicQuestions(t.id, t.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRose border border-pastel-border transition cursor-pointer"
                              title="Просмотреть все вопросы по теме"
                            >
                              <span>{t.total} вопросов</span>
                            </button>

                            <button
                              onClick={() => handleStartTopic(t.id, t.name)}
                              disabled={isStarting}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95 touch-manipulation"
                            >
                              {isStarting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              <span>Блиц (10)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 4. COMPACT GRID VIEW (Alternative) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedTopics.map((t) => {
            const IconComponent = ICON_MAP[t.icon] || Coffee;
            const progress = topicsProgress[t.id];
            const percentage = progress?.percentage !== undefined ? progress.percentage : (t.percentage || 0);
            const isStarting = startingTopicId === t.id;

            return (
              <div
                key={t.id}
                className="bg-white/95 border border-pastel-border/80 hover:border-pastel-accentRose/40 rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border/60">
                      {t.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-pastel-text">
                      {percentage}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2.5 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${t.color}18`, color: t.color }}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-pastel-text truncate">{t.name}</h3>
                      <p className="text-xs text-pastel-muted">{t.total} вопросов</p>
                    </div>
                  </div>

                  <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-pastel-border/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openTopicQuestions(t.id, t.name)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose border border-pastel-border transition cursor-pointer text-center"
                  >
                    Банк вопросов
                  </button>

                  <button
                    onClick={() => handleStartTopic(t.id, t.name)}
                    disabled={isStarting}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white hover:opacity-95 transition shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Блиц</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
