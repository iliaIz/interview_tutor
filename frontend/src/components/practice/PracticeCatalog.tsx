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
  Bug,
  Database,
  Crosshair,
  ChevronDown,
  ChevronUp,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TRANSACTION_LAB_SCENARIOS } from '../../data/transactionLabCatalog';

export type GradeLevel = 'all' | 'junior' | 'middle' | 'senior' | 'lead';

export interface GradeConfig {
  id: GradeLevel;
  label: string;
  badge: string;
  dotColor: string;
  colorClass: string;
  description: string;
}

export const GRADE_CONFIGS: Record<Exclude<GradeLevel, 'all'>, GradeConfig> = {
  junior: {
    id: 'junior',
    label: 'Junior',
    badge: '🟢 Junior',
    dotColor: 'bg-emerald-500',
    colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Базовые структуры данных, примитивы, чистые алгоритмы и юнит-тесты L0'
  },
  middle: {
    id: 'middle',
    label: 'Middle',
    badge: '🔵 Middle',
    dotColor: 'bg-blue-500',
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Транзакции, многопоточность, паттерны проектирования, моки Mockito 5'
  },
  senior: {
    id: 'senior',
    label: 'Senior',
    badge: '🔴 Senior',
    dotColor: 'bg-rose-500',
    colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Высоконагруженные распределенные примитивы, Loom, мутации L2-L3, FinTech'
  },
  lead: {
    id: 'lead',
    label: 'Lead / Staff',
    badge: '🟣 Lead',
    dotColor: 'bg-purple-500',
    colorClass: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Архитектура систем, распределенные саги, zero-allocation буферы, стейт-машины'
  }
};

export const normalizeGrade = (diff?: string): Exclude<GradeLevel, 'all'> => {
  const lower = (diff || '').toLowerCase().trim();
  if (lower === 'lead' || lower === 'staff' || lower === 'principal') return 'lead';
  if (lower === 'senior') return 'senior';
  if (lower === 'middle') return 'middle';
  return 'junior';
};

const CATEGORIES: { id: ChallengeCategory; name: string; icon: React.ComponentType<any>; badge?: string }[] = [
  { id: 'all', name: 'Все задачи', icon: Code2 },
  { id: 'spring_transactions', name: 'Spring Transactions Lab', icon: Database, badge: 'SOTA 2026' },
  { id: 'testing_mutation', name: 'Testing & Mutation', icon: Bug, badge: '42 Katas (L0-L3)' },
  { id: 'lld_bigtech', name: 'BigTech LLD', icon: Layers, badge: 'Яндекс/Озон' },
  { id: 'lld_fintech', name: 'FinTech & Ledger', icon: Crown, badge: 'Т-Банк/Stripe' },
  { id: 'lld_concurrency', name: 'Concurrency Lab', icon: Zap, badge: 'Loom/Threads' },
  { id: 'refactoring_kata', name: 'Refactoring Katas', icon: Shield },
  { id: 'java21_idioms', name: 'Java 21 Idioms', icon: Sparkles }
];

export const TESTING_ARCHETYPES = [
  { id: 'all', name: 'Все (42 каты)', badge: '🏆 Все уровни', icon: Sparkles, match: [] },
  { id: 'l0_primitives', name: '🟢 L0: Primitives (6)', badge: '🟢 База', icon: CheckCircle2, match: ['prim-01', 'prim-02', 'prim-03', 'prim-04', 'prim-05', 'prim-06'] },
  { id: 'l1_reverse', name: '🟡 L1: Reverse Testing (6)', badge: '🟡 Code Defenders', icon: Crosshair, match: ['rev-01', 'rev-02', 'rev-03', 'rev-04', 'rev-05', 'rev-06'] },
  { id: 'legacy', name: 'Legacy Seams (5)', badge: '✂️ Seams', icon: Shield, match: ['trip-service', 'gilded-rose', 'overloaded-constructor', 'legacy-invoice', 'legacy-tax'] },
  { id: 'junit5', name: 'JUnit 5 & Boundaries (5)', badge: '🧪 Deep JUnit', icon: Terminal, match: ['financial-tx', 'combinatorial-pricing', 'dynamic-rbac', 'nested-account', 'security-context'] },
  { id: 'mockito', name: 'Mockito 5 Verification (5)', badge: '🎭 Mockito 5', icon: CheckCircle2, match: ['audit-trail', 'async-event-captor', 'spy-do-return', 'resilient-retry', 'deterministic-time-uuid'] },
  { id: 'fsm', name: 'State Machines & Retries (5)', badge: '🔄 Automata', icon: Flame, match: ['order-state-machine', 'idempotent-account', 'circuit-breaker-state', 'sliding-window-rate-limiter', 'distributed-saga'] },
  { id: 'concurrency', name: 'Concurrency & Loom (5)', badge: '⚡ Loom & Races', icon: Zap, match: ['awaitility-polling', 'cyclic-barrier', 'threadmxbean-deadlock', 'virtual-thread-pinning', 'lockfree-ringbuffer'] },
  { id: 'archunit', name: 'ArchUnit & Slices (5)', badge: '🏛️ ArchUnit', icon: Layers, match: ['archunit-layer-isolation', 'archunit-enterprise-api-governance', 'archunit-transactional-integrity', 'spring-webmvc-problem-detail', 'jackson-financial-pan-masking'] },
];

export const PracticeCatalog: React.FC = () => {
  const { openPracticeChallenge, openTransactionLab, showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('all');
  const [isGroupedByGrade, setIsGroupedByGrade] = useState<boolean>(false);
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({
    junior: true,
    middle: true,
    senior: true,
    lead: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const toggleGradeSection = (gradeKey: string) => {
    setExpandedGrades((prev) => ({
      ...prev,
      [gradeKey]: !prev[gradeKey]
    }));
  };

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

  // Stable canonical numbering map based on initial list order
  const challengeNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    challenges.forEach((ch, idx) => {
      map.set(ch.id, ch.taskNumber || idx + 1);
    });
    return map;
  }, [challenges]);

  // Overall grade statistics for counters
  const gradeStats = useMemo(() => {
    const stats: Record<GradeLevel, number> = {
      all: challenges.length,
      junior: 0,
      middle: 0,
      senior: 0,
      lead: 0
    };
    challenges.forEach((c) => {
      const g = normalizeGrade(c.difficulty);
      stats[g] = (stats[g] || 0) + 1;
    });
    return stats;
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const isMutationKata =
        c.track === 'testing_mutation' ||
        c.category === 'testing_mutation' ||
        c.challengeMode === 'write_the_tests' ||
        (c.mutants && c.mutants.length > 0);

      const matchesCategory =
        selectedCategory === 'all' ||
        c.category === selectedCategory ||
        c.track === selectedCategory ||
        (selectedCategory === 'testing_mutation' && isMutationKata) ||
        (selectedCategory === 'machine_coding' && (c.category === 'machine_coding' || c.track?.startsWith('lld')));

      if (!matchesCategory) return false;

      if (selectedGrade !== 'all') {
        const g = normalizeGrade(c.difficulty);
        if (g !== selectedGrade) return false;
      }

      if (selectedCategory === 'testing_mutation' && selectedArchetype !== 'all') {
        const arch = TESTING_ARCHETYPES.find(a => a.id === selectedArchetype);
        if (arch && arch.match.length > 0) {
          const normKey = (c.id + ' ' + (c.slug || '')).toLowerCase().replace(/_/g, '-');
          const matchesArch = arch.match.some(m => normKey.includes(m));
          if (!matchesArch) return false;
        }
      }

      const matchesSearch =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.shortDescription && c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.targetStack && c.targetStack.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [challenges, selectedCategory, selectedGrade, selectedArchetype, searchQuery]);

  // Grouped challenges for structured accordion view
  const groupedChallenges = useMemo(() => {
    const groups: Record<Exclude<GradeLevel, 'all'>, CodingChallenge[]> = {
      junior: [],
      middle: [],
      senior: [],
      lead: []
    };
    filteredChallenges.forEach((ch) => {
      const g = normalizeGrade(ch.difficulty);
      groups[g].push(ch);
    });
    return groups;
  }, [filteredChallenges]);

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
      const taskNum = data.challenge?.taskNumber || challengeNumberMap.get(challengeId) || 1;
      openPracticeChallenge({ ...data.challenge, taskNumber: taskNum }, data.savedDraft);
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

  const renderChallengeCard = (ch: CodingChallenge) => {
    const isSelected = selectedId === ch.id;
    const isCompleted = ch.isCompleted;
    const taskNum = ch.taskNumber || challengeNumberMap.get(ch.id) || 1;

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
              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900 text-pastel-accentRose border border-slate-700/60 shadow-2xs shrink-0">
                #{String(taskNum).padStart(2, '0')}
              </span>
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

        {/* Quick Arena Switcher Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-pastel-border/60">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('spring_transactions');
              setSelectedArchetype('all');
            }}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
              selectedCategory === 'spring_transactions'
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-xs'
                : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-pastel-text block group-hover:text-blue-700 transition">
                  Spring Transactions Lab
                </span>
                <span className="text-[11px] text-pastel-muted">16 сценариев L0–L3</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-blue-600 transition group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory('testing_mutation');
              setSelectedArchetype('all');
            }}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
              selectedCategory === 'testing_mutation'
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 shadow-xs'
                : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Bug className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-pastel-text block group-hover:text-emerald-700 transition">
                  Testing & Mutation Arena
                </span>
                <span className="text-[11px] text-pastel-muted">42 каты L0–L3</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-emerald-600 transition group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory('lld_bigtech');
              setSelectedArchetype('all');
            }}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between group ${
              selectedCategory === 'lld_bigtech' || selectedCategory === 'lld_fintech' || selectedCategory === 'lld_concurrency'
                ? 'bg-gradient-to-r from-purple-50 to-rose-50 border-purple-300 shadow-xs'
                : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-pastel-text block group-hover:text-purple-700 transition">
                  Machine Coding LLD
                </span>
                <span className="text-[11px] text-pastel-muted">35 задач BigTech & FinTech</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-pastel-muted group-hover:text-purple-600 transition group-hover:translate-x-0.5" />
          </button>
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
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedArchetype('all');
                  }}
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

        {/* Archetype Sub-Filter Chips for Testing & Mutation */}
        {selectedCategory === 'testing_mutation' && (
          <div className="mt-4 pt-3 border-t border-pastel-border/60 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
            <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3 text-rose-500" />
              Архетипы:
            </span>
            {TESTING_ARCHETYPES.map((arch) => {
              const ArchIcon = arch.icon;
              const isSelected = selectedArchetype === arch.id;
              return (
                <button
                  key={arch.id}
                  onClick={() => setSelectedArchetype(arch.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                  }`}
                >
                  <ArchIcon className="w-3.5 h-3.5" />
                  <span>{arch.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Grade Filter Pills & Grouping Toggle */}
        {selectedCategory !== 'spring_transactions' && (
          <div className="mt-3 pt-3 border-t border-pastel-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
            {/* Grade Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                Грейды:
              </span>
              <button
                type="button"
                onClick={() => setSelectedGrade('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selectedGrade === 'all'
                    ? 'bg-pastel-text text-white shadow-2xs'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                }`}
              >
                <span>Все грейды</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${selectedGrade === 'all' ? 'bg-white/20 text-white' : 'bg-pastel-card text-pastel-muted'}`}>
                  {gradeStats.all}
                </span>
              </button>
              {(['junior', 'middle', 'senior', 'lead'] as const).map((gradeKey) => {
                const cfg = GRADE_CONFIGS[gradeKey];
                const count = gradeStats[gradeKey];
                const isSelected = selectedGrade === gradeKey;
                return (
                  <button
                    key={gradeKey}
                    type="button"
                    onClick={() => setSelectedGrade(gradeKey)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-pastel-text text-white shadow-2xs'
                        : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                    <span>{cfg.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-pastel-card text-pastel-muted'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grouping Toggle */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsGroupedByGrade(!isGroupedByGrade)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  isGroupedByGrade
                    ? 'bg-purple-50 text-purple-800 border-purple-300 shadow-2xs ring-1 ring-purple-300/50'
                    : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/70'
                }`}
                title="Группировать задачи по уровням Junior / Middle / Senior / Lead"
              >
                <Layers className={`w-3.5 h-3.5 ${isGroupedByGrade ? 'text-purple-600' : 'text-pastel-muted'}`} />
                <span>Группировка по грейдам</span>
                {isGroupedByGrade && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. MASTER-DETAIL SPLIT STUDIO LAYOUT (SOTA 2026) */}
      {selectedCategory === 'spring_transactions' ? (
        <div className="space-y-4 animate-fade-in">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                  Explorable Systems Workbench
                </span>
                <span className="text-[10px] text-violet-200 font-mono">
                  {TRANSACTION_LAB_SCENARIOS.length} Канонических Сценариев (L0–L3)
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight">
                Spring Transaction Playground (@Transactional Lab)
              </h3>
              <p className="text-xs text-violet-100 leading-relaxed">
                Интерактивный симулятор физики транзакций Spring Framework: двухконтурный Flame Chart (AOP vs JDBC), обойма слотов HikariCP, теорема Вулдриджа под нагрузкой и Сократическая защита с ИИ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openTransactionLab()}
              className="py-2.5 px-5 rounded-2xl bg-white text-violet-900 font-extrabold text-xs shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Zap className="w-4 h-4 text-violet-600" />
              <span>Запустить лабораторию</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRANSACTION_LAB_SCENARIOS.map((sc, idx) => (
              <div
                key={sc.id}
                className="p-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-violet-300 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 font-bold border border-violet-200">
                        {sc.level}
                      </span>
                      <span>#{idx + 1} &bull; {sc.difficulty}</span>
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {sc.badge}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-violet-700 transition">
                    {sc.title}
                  </h4>
                  <div className="text-[11px] font-medium text-slate-500">{sc.domain}</div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {sc.problemStatement}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openTransactionLab(sc.id)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-violet-600 hover:text-white text-slate-800 font-bold text-xs border border-slate-200 group-hover:border-violet-600 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Исследовать кейс</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : filteredChallenges.length === 0 ? (
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
            {isGroupedByGrade ? (
              <div className="space-y-3">
                {(['junior', 'middle', 'senior', 'lead'] as const).map((gradeKey) => {
                  const list = groupedChallenges[gradeKey];
                  if (list.length === 0) return null;
                  const cfg = GRADE_CONFIGS[gradeKey];
                  const isExpanded = expandedGrades[gradeKey] ?? true;
                  const completedCount = list.filter((c) => c.isCompleted).length;

                  return (
                    <div
                      key={gradeKey}
                      className="rounded-2xl border border-pastel-border/80 bg-white/95 overflow-hidden shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGradeSection(gradeKey)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-pastel-bg/60 transition cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} shrink-0`} />
                          <span className="font-bold text-xs text-pastel-text">{cfg.label}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-pastel-bg text-pastel-muted border border-pastel-border">
                            {list.length}
                          </span>
                          {completedCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ {completedCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-pastel-muted">
                          <span className="text-[10px] text-pastel-muted hidden sm:inline max-w-[170px] truncate">
                            {cfg.description}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-2 border-t border-pastel-border/50 bg-pastel-bg/25">
                          {list.map(renderChallengeCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              filteredChallenges.map(renderChallengeCard)
            )}
          </div>

        {/* Right Column: Live Challenge Passport / Inspector (7 cols / 58%) */}
        {activeChallenge && (
          <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
            {/* Header with Title & Metadata */}
            <div className="space-y-2 pb-4 border-b border-pastel-border/60">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-900 text-pastel-accentRose border border-slate-700/60 shadow-2xs">
                    Задача #{String(activeChallenge.taskNumber || challengeNumberMap.get(activeChallenge.id) || 1).padStart(2, '0')}
                  </span>
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
            {activeChallenge.track === 'testing_mutation' || activeChallenge.category === 'testing_mutation' ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/70 to-pink-50/40 border border-rose-200/80 space-y-2 text-xs">
                <h4 className="font-bold text-rose-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Bug className="w-3.5 h-3.5 text-rose-700" />
                  <span>Инварианты мутационного тестирования (PITest SOTA)</span>
                </h4>
                <ul className="space-y-1 text-slate-700 font-sans list-disc pl-4 leading-relaxed">
                  <li><strong>PITest Gregor Mutators:</strong> В исходный код инжектируются 5 мутантов (границы условий, пропуск вызовов, инверсия логики).</li>
                  <li><strong>Killer Assertions:</strong> Ваш тест-сьют должен обнаружить и уничтожить 100% мутантов без ложных срабатываний.</li>
                  <li><strong>Суб-150мс JVM Sandbox:</strong> Чистые Java 21 тесты без медленных внешних контейнеров с мгновенной обратной связью.</li>
                </ul>
              </div>
            ) : (
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
            )}

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
