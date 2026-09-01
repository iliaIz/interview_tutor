import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  Bug, Search, Sparkles, Flame, Target, ArrowRight, 
  ShieldAlert, Layers, Cpu, CheckCircle2, SlidersHorizontal,
  Activity, Zap, Compass, RefreshCw
} from 'lucide-react';
import { BugChallenge } from '../BugChallengeCard';
import { MemoryRadarDrawer } from '../MemoryRadarDrawer';

interface TopicCatalogItem {
  id: string;
  name: string;
  category: string;
  count: number;
  iconStr: string;
  description: string;
  tags: string[];
}

const TOPIC_CATALOG: TopicCatalogItem[] = [
  {
    id: 'core',
    name: 'Java Core & Collections',
    category: 'core',
    count: 15,
    iconStr: '☕',
    description: 'Коварные баги equals/hashCode, мутации ключей HashMap, ConcurrentModificationException и автобоксинг.',
    tags: ['HashMap', 'Equals/HashCode', 'Autoboxing', 'Generics']
  },
  {
    id: 'concurrency',
    name: 'Многопоточность & Virtual Threads',
    category: 'concurrency',
    count: 14,
    iconStr: '⚡',
    description: 'Deadlock, Race Conditions, Double-Checked Locking, ThreadLocal Leaks и Carrier Pinning на синхронизациях Loom.',
    tags: ['Loom 21+', 'Deadlock', 'ThreadLocal', 'Volatile', 'Locks']
  },
  {
    id: 'spring',
    name: 'Spring Boot & Transactions',
    category: 'spring',
    count: 12,
    iconStr: '🍃',
    description: 'Самовызовы @Transactional (AOP Bypass), утечки соединений HikariCP, Circular Dependencies и Dirty Context.',
    tags: ['@Transactional', 'AOP Proxies', 'HikariCP', 'Scopes']
  },
  {
    id: 'jpa',
    name: 'JPA & Hibernate ORM',
    category: 'data',
    count: 10,
    iconStr: '🗄️',
    description: 'N+1 Selects, Cartesian Product, MultipleBagFetchException, detached entity merges и L2 Cache Dirty Reads.',
    tags: ['N+1 Query', 'MultipleBagFetch', 'L2 Cache', 'Dirty Write']
  },
  {
    id: 'kafka',
    name: 'Kafka & Distributed Streams',
    category: 'distributed',
    count: 9,
    iconStr: '📨',
    description: 'Consumer Rebalance Storms, Out-of-Order Messages, At-Least-Once Duplications и Transactional Outbox сбои.',
    tags: ['Consumer Lag', 'Rebalance', 'Outbox', 'Idempotency']
  },
  {
    id: 'jvm',
    name: 'JVM Memory & Performance',
    category: 'performance',
    count: 10,
    iconStr: '💾',
    description: 'Metaspace OOM, ClassLoader Leaks, Off-Heap DirectBuffer утечки и катастрофический алгоритмический O(N²).',
    tags: ['Metaspace', 'OOM', 'GC STW', 'Off-Heap']
  }
];

export const BugHuntCatalog: React.FC = () => {
  const { openTopicBugHunt, cheatSheetBookmarks } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [savedChallenges, setSavedChallenges] = useState<BugChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);

  useEffect(() => {
    setLoadingChallenges(true);
    fetch('/api/tutor/saved-challenges', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then((data: BugChallenge[]) => {
        if (Array.isArray(data)) {
          setSavedChallenges(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChallenges(false));
  }, []);

  const totalChallenges = 70;
  const solvedCount = savedChallenges.filter(c => c.isSolved).length;

  const filteredTopics = TOPIC_CATALOG.filter(t => {
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                🐛 Production Incident Katas
              </span>
              <span className="text-xs text-pastel-muted font-mono">
                {totalChallenges} хардкорных дефектов & антипаттернов
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              Охота на Баги: 70 Продакшен-Кейсов
            </h1>
            <p className="text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
              Интерактивная арена расследования скрытых дефектов в Java 21, Spring Boot 3.4, Virtual Threads, JPA и Kafka с мгновенным AST-анализом и Сократовским AI-ментором.
            </p>
          </div>

          {/* Quick Launch Buttons & Memory Radar */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setIsRadarOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-pastel-bg border border-pastel-border hover:border-pastel-accentViolet text-xs font-bold text-pastel-text transition shadow-2xs cursor-pointer active:scale-95"
            >
              <Activity className="w-3.5 h-3.5 text-pastel-accentViolet" />
              <span>Радар пробелов</span>
            </button>

            <button
              onClick={() => openTopicBugHunt('core', 'Java Core & Spring Incidents')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white text-xs font-bold shadow-md shadow-pastel-accentRose/20 hover:opacity-95 transition cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Быстрая разминка</span>
            </button>
          </div>
        </div>

        {/* Search & Fast Filter Bar */}
        <div className="mt-6 pt-5 border-t border-pastel-border/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по багам (Deadlock, @Transactional, N+1, Loom Pinning, Kafka Lag, Metaspace)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-pastel-bg border border-pastel-border rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-none focus:border-pastel-accentRose font-sans transition shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* 3 Quick Launch Presets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div
          onClick={() => openTopicBugHunt('concurrency', 'Многопоточность & Loom 21+')}
          className="bg-white/95 border border-pastel-border/80 hover:border-amber-300 rounded-2xl p-4 shadow-2xs transition cursor-pointer flex items-start gap-3.5 group hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 group-hover:scale-105 transition">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wider block">Пресет #1</span>
            <h3 className="text-xs font-bold text-pastel-text group-hover:text-amber-700 transition">🎯 Полный охват темы</h3>
            <p className="text-[11px] text-pastel-muted mt-0.5 leading-snug">Методичный перебор 100% подтем без повторов до закрытия дефицитов</p>
          </div>
        </div>

        <div
          onClick={() => openTopicBugHunt('spring', 'Spring Boot 3.4 & Transactions')}
          className="bg-white/95 border border-pastel-border/80 hover:border-rose-300 rounded-2xl p-4 shadow-2xs transition cursor-pointer flex items-start gap-3.5 group hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 group-hover:scale-105 transition">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider block">Пресет #2</span>
            <h3 className="text-xs font-bold text-pastel-text group-hover:text-rose-700 transition">🔥 Senior Review (2 бага)</h3>
            <p className="text-[11px] text-pastel-muted mt-0.5 leading-snug">Хардкорный продакшен-класс с 2 скрытыми дефектами архитектуры</p>
          </div>
        </div>

        <div
          onClick={() => openTopicBugHunt('core', 'Java Core & Collections')}
          className="bg-white/95 border border-pastel-border/80 hover:border-purple-300 rounded-2xl p-4 shadow-2xs transition cursor-pointer flex items-start gap-3.5 group hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0 group-hover:scale-105 transition">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-purple-700 uppercase tracking-wider block">Пресет #3</span>
            <h3 className="text-xs font-bold text-pastel-text group-hover:text-purple-700 transition">🎲 Свободный поток</h3>
            <p className="text-[11px] text-pastel-muted mt-0.5 leading-snug">Бесконечный поток случайных багов для быстрой разминки перед интервью</p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1">
        {[
          { id: 'all', label: 'Все направления' },
          { id: 'core', label: '☕ Core & Collections' },
          { id: 'concurrency', label: '⚡ Concurrency & Loom' },
          { id: 'spring', label: '🍃 Spring Boot & AOP' },
          { id: 'data', label: '🗄️ JPA & Hibernate' },
          { id: 'distributed', label: '📨 Kafka & Streams' },
          { id: 'performance', label: '💾 JVM & Memory' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-pastel-text text-white shadow-2xs'
                : 'bg-white text-pastel-muted hover:text-pastel-text border border-pastel-border'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of 70 Katas Topic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTopics.map((topic) => (
          <div
            key={topic.id}
            onClick={() => openTopicBugHunt(topic.id, topic.name)}
            className="bg-white/95 border border-pastel-border/80 hover:border-pastel-accentRose/60 rounded-3xl p-5 shadow-2xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xl">{topic.iconStr}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                  {topic.count} кейсов
                </span>
              </div>

              <h2 className="text-base font-bold text-pastel-text group-hover:text-pastel-accentRose transition">
                {topic.name}
              </h2>

              <p className="text-xs text-pastel-muted mt-2 leading-relaxed line-clamp-3">
                {topic.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-pastel-border/60">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {topic.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-pastel-bg text-pastel-text/80 border border-pastel-border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-pastel-accentRose group-hover:translate-x-0.5 transition">
                <span>Войти в Арену</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onSelectTopicForPractice={(topic) => {
          setIsRadarOpen(false);
          openTopicBugHunt(topic, topic);
        }}
      />
    </div>
  );
};

export default BugHuntCatalog;
