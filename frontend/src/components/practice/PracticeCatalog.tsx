import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CodingChallenge, ChallengeCategory } from '../../types/practice';
import {
  Code2,
  Cpu,
  Layers,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  Flame,
  ArrowRight,
  Shield,
  Search,
  Loader2,
  Crown,
  BookOpen,
  FileCode,
  Check,
  Award,
  Filter,
  Terminal,
  Play,
  Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES: { id: ChallengeCategory; name: string; icon: React.ComponentType<any>; badge?: string }[] = [
  { id: 'all', name: 'Все задачи', icon: Code2 },
  { id: 'testing_mutation', name: 'Testing & Mutation', icon: Bug, badge: 'Kill Mutants' },
  { id: 'lld_bigtech', name: 'BigTech LLD', icon: Layers, badge: 'Яндекс/Озон' },
  { id: 'lld_fintech', name: 'FinTech & Ledger', icon: Crown, badge: 'Т-Банк/Stripe' },
  { id: 'lld_concurrency', name: 'Concurrency Lab', icon: Zap, badge: 'Loom/Threads' },
  { id: 'refactoring_kata', name: 'Refactoring Katas', icon: Shield },
  { id: 'java21_idioms', name: 'Java 21 Idioms', icon: Sparkles }
];

export const PracticeCatalog: React.FC = () => {
  const { openPracticeChallenge, showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/practice/challenges', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChallenges(data);
          if (data.length > 0 && !selectedId) {
            setSelectedId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching practice challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        c.category === selectedCategory ||
        c.track === selectedCategory ||
        (selectedCategory === 'testing_mutation' && (c.track === 'testing_mutation' || c.challengeMode === 'write_the_tests' || (c.mutants && c.mutants.length > 0))) ||
        (selectedCategory === 'machine_coding' && (c.category === 'machine_coding' || c.track?.startsWith('lld')));
      const matchesSearch =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.shortDescription && c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.targetStack && c.targetStack.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [challenges, selectedCategory, searchQuery]);

  // Keep selectedId valid
  useEffect(() => {
    if (filteredChallenges.length > 0) {
      if (!selectedId || !filteredChallenges.some(c => c.id === selectedId)) {
        setSelectedId(filteredChallenges[0].id);
      }
    }
  }, [filteredChallenges, selectedId]);

  const activeChallenge = useMemo(() => {
    return challenges.find(c => c.id === selectedId) || filteredChallenges[0] || null;
  }, [challenges, selectedId, filteredChallenges]);

  const handleStartChallenge = async (challengeId: string) => {
    setOpeningId(challengeId);
    try {
      const res = await fetch(`/api/practice/challenges/${challengeId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      openPracticeChallenge(data.challenge, data.savedDraft);
    } catch (err: any) {
      console.error('Error loading challenge details:', err);
      showToast({
        type: 'error',
        title: 'Ошибка загрузки задачи',
        message: err?.message || 'Не удалось загрузить исходные файлы задачи.'
      });
    } finally {
      setOpeningId(null);
    }
  };

  // Keyboard navigation for power users (Up / Down / Enter)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }

    if (filteredChallenges.length === 0) return;

    const currentIndex = filteredChallenges.findIndex(c => c.id === selectedId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(currentIndex + 1, filteredChallenges.length - 1);
      setSelectedId(filteredChallenges[nextIdx].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(currentIndex - 1, 0);
      setSelectedId(filteredChallenges[prevIdx].id);
    } else if (e.key === 'Enter' && activeChallenge) {
      e.preventDefault();
      handleStartChallenge(activeChallenge.id);
    }
  }, [filteredChallenges, selectedId, activeChallenge]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getDifficultyColor = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'lead':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'senior':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'middle':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono text-pastel-muted">Загрузка каталога практических задач...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 font-sans animate-fade-in pb-24">
      {/* 1. Header Banner */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">
                ⚡ Machine Coding Studio
              </span>
              <span className="text-xs text-pastel-muted font-mono font-bold">
                {challenges.length} задач • Java 21 LTS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              Live-Coding, Katas & Machine Coding Arena
            </h1>
            <p className="text-xs sm:text-sm text-pastel-muted mt-1 max-w-2xl leading-relaxed">
              Проектируй LLD-архитектуру на Java 21, рефактори легаси-код через швы и тестируй виртуальные потоки Loom с мгновенным AI-ревью.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-pastel-bg border border-pastel-border text-xs text-pastel-muted font-mono shrink-0">
            <span>Навигация:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">↓</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-pastel-border text-[10px] font-bold text-pastel-text">Enter</kbd>
          </div>
        </div>

        {/* 2. Search & Category Filter Bar */}
        <div className="mt-5 pt-4 border-t border-pastel-border/60 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar touch-pan-x">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-pastel-text text-white shadow-xs'
                      : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по задачам, стеку..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
            />
          </div>
        </div>
      </div>

      {/* 3. MASTER-DETAIL SPLIT STUDIO LAYOUT (SOTA 2026) */}
      {filteredChallenges.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Code2 className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Задачи не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto leading-relaxed">
            По запросу «<strong className="text-pastel-text">{searchQuery || selectedCategory}</strong>» ничего не найдено в каталоге задач.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Master Challenges List (5 cols / 42%) */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[750px] overflow-y-auto pr-1 no-scrollbar">
          {filteredChallenges.map((ch) => {
            const isSelected = selectedId === ch.id;
            const isCompleted = ch.isCompleted;

            return (
              <div
                key={ch.id}
                onClick={() => setSelectedId(ch.id)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${
                  isSelected
                    ? 'bg-white border-pastel-accentRose shadow-sm ring-2 ring-pastel-accentRose/30'
                    : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-pastel-accentRose/40 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-pastel-bg text-pastel-muted border border-pastel-border truncate">
                        {ch.badge}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${getDifficultyColor(ch.difficulty)}`}>
                        {ch.difficulty}
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{ch.lastScore || 85}б</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-pastel-muted flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-pastel-accentViolet" />
                        <span>{ch.timeLimitMinutes}м</span>
                      </span>
                    )}
                  </div>

                  <h3 className={`font-bold text-xs sm:text-sm transition-colors ${isSelected ? 'text-pastel-accentRose' : 'text-pastel-text'}`}>
                    {ch.title}
                  </h3>

                  <p className="text-xs text-pastel-muted line-clamp-2 mt-1 leading-snug">
                    {ch.shortDescription}
                  </p>
                </div>

                {/* Footer stack chips */}
                <div className="flex items-center justify-between pt-2 border-t border-pastel-border/50 text-[11px]">
                  <span className="text-pastel-muted font-mono text-[10px] truncate max-w-[200px]">
                    🛠️ {ch.targetStack}
                  </span>
                  <span className="font-bold text-pastel-accentRose flex items-center gap-0.5 text-[10px]">
                    <span>Обзор</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Live Challenge Passport / Inspector (7 cols / 58%) */}
        {activeChallenge && (
          <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
            {/* Header with Title & Metadata */}
            <div className="space-y-2 pb-4 border-b border-pastel-border/60">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                    {activeChallenge.badge}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getDifficultyColor(activeChallenge.difficulty)}`}>
                    {activeChallenge.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono font-bold text-pastel-muted">
                  <Clock className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  <span>Лимит времени: {activeChallenge.timeLimitMinutes} минут</span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-pastel-text tracking-tight">
                {activeChallenge.title}
              </h2>

              <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
                {activeChallenge.shortDescription}
              </p>
            </div>

            {/* Architectural & Hard Invariants Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/60 to-pastel-bg border border-purple-200/80 space-y-2 text-xs">
              <h4 className="font-bold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Shield className="w-3.5 h-3.5 text-purple-700" />
                <span>Архитектурные требования (Hard Invariants)</span>
              </h4>
              <ul className="space-y-1 text-slate-700 font-sans list-disc pl-4 leading-relaxed">
                <li><strong>Временная виртуализация:</strong> Использовать только инжектированный <code className="text-purple-800 bg-purple-100/80 px-1 py-0.2 rounded font-mono">java.time.Clock</code> (запрет <code className="font-mono text-rose-700">System.currentTimeMillis()</code>).</li>
                <li><strong>Потокобезопасность:</strong> Поддержка параллельных запросов без гонок данных и блокировок несущих потоков (Virtual Threads Loom).</li>
                <li><strong>Чистота архитектуры:</strong> SOLID, нулевые утечки памяти, детерминированные тесты.</li>
              </ul>
            </div>

            {/* Target Tech Stack & Phases */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-pastel-bg p-3 rounded-xl border border-pastel-border">
                <span className="text-pastel-muted block text-[10px] uppercase font-bold">Стек & Примитивы</span>
                <span className="font-bold text-pastel-text text-[11px] truncate block mt-0.5">
                  {activeChallenge.targetStack}
                </span>
              </div>

              <div className="bg-pastel-bg p-3 rounded-xl border border-pastel-border">
                <span className="text-pastel-muted block text-[10px] uppercase font-bold">Формат сессии</span>
                <span className="font-bold text-pastel-accentRose text-[11px] block mt-0.5">
                  {activeChallenge.category === 'machine_coding' ? 'Phase 1 + Phase 2 (Burst)' : 'Single Session Kata'}
                </span>
              </div>
            </div>

            {/* Starter Files Preview */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-pastel-text block text-[11px] uppercase tracking-wider">
                📁 Стартовые файлы воркспейса:
              </span>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-emerald-400 border border-slate-800 flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> RateLimiter.java
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-blue-400 border border-slate-800 flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> SlidingWindow.java
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-purple-300 border border-slate-800 flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> ChallengeTest.java
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                onClick={() => handleStartChallenge(activeChallenge.id)}
                disabled={openingId === activeChallenge.id}
                className={`w-full py-3 px-5 rounded-2xl font-bold text-xs text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 touch-manipulation disabled:opacity-75 ${
                  activeChallenge.isCompleted
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                    : 'bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95'
                }`}
              >
                {openingId === activeChallenge.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Инициализация воркспейса...</span>
                  </>
                ) : activeChallenge.isCompleted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Решить снова ({activeChallenge.lastScore} баллов)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Открыть воркспейс в Арене (Enter)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
