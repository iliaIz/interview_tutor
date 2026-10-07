import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CodingChallenge, ChallengeCategory, ChallengeCompletionStatus } from '../../types/practice';
import {
  Code2,
  Layers,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowRight,
  Shield,
  Search,
  Loader2,
  Crown,
  FileCode,
  Filter,
  Terminal,
  Play,
  Bug,
  Database,
  Crosshair,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TRANSACTION_LAB_SCENARIOS } from '../../data/transactionLabCatalog';
import { getLocalDraft, removeLocalDraft } from '../../services/practiceDraftStorage';

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
  { id: 'fsm', name: 'State Machines & Retries (5)', badge: '🔄 Automata', icon: FlameIcon, match: ['order-state-machine', 'idempotent-account', 'circuit-breaker-state', 'sliding-window-rate-limiter', 'distributed-saga'] },
  { id: 'concurrency', name: 'Concurrency & Loom (5)', badge: '⚡ Loom & Races', icon: Zap, match: ['awaitility-polling', 'cyclic-barrier', 'threadmxbean-deadlock', 'virtual-thread-pinning', 'lockfree-ringbuffer'] },
  { id: 'archunit', name: 'ArchUnit & Slices (5)', badge: '🏛️ ArchUnit', icon: Layers, match: ['archunit-layer-isolation', 'archunit-enterprise-api-governance', 'archunit-transactional-integrity', 'spring-webmvc-problem-detail', 'jackson-financial-pan-masking'] },
];

function FlameIcon(props: any) {
  return <Sparkles {...props} />;
}

export const GRADE_CONFIG = [
  {
    id: 'Junior',
    name: 'Junior Foundation',
    badge: '🟢 Базовый уровень (L0)',
    subline: 'Скалярные ассерты, чистые функции, Clock-инжекция, AAA-паттерн',
    tagClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barColor: 'bg-emerald-500',
    bgHeader: 'from-emerald-50/80 via-teal-50/40 to-white'
  },
  {
    id: 'Middle',
    name: 'Middle Specialist',
    badge: '🟡 Продвинутый уровень (L1)',
    subline: 'Обратное тестирование, швы для легаси, Mockito 5, кэши с TTL, паттерны проектирования',
    tagClass: 'bg-blue-100 text-blue-800 border-blue-300',
    barColor: 'bg-blue-500',
    bgHeader: 'from-blue-50/80 via-sky-50/40 to-white'
  },
  {
    id: 'Senior',
    name: 'Senior Architect',
    badge: '🔴 Экспертный уровень (L2)',
    subline: 'Deadlock-Free Ledgers, Outbox, Concurrency, ArchUnit, FSM, Rate Limiters, Distributed Sagas',
    tagClass: 'bg-rose-100 text-rose-800 border-rose-300',
    barColor: 'bg-rose-500',
    bgHeader: 'from-rose-50/80 via-pink-50/40 to-white'
  },
  {
    id: 'Lead',
    name: 'Staff / Principal & High-Load',
    badge: '🟣 Системный уровень (L3)',
    subline: 'LMAX Disruptor Ring Buffer, Loom Carrier Pinning, Striped Counters, Non-blocking Algorithms',
    tagClass: 'bg-purple-100 text-purple-800 border-purple-300',
    barColor: 'bg-purple-500',
    bgHeader: 'from-purple-50/80 via-violet-50/40 to-white'
  }
];

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started';

export const PracticeCatalog: React.FC = () => {
  const { openPracticeChallenge, openTransactionLab, showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('practice_collapsed_grades') || '{}');
    } catch {
      return {};
    }
  });

  const toggleGrade = (gradeId: string) => {
    setCollapsedGrades(prev => {
      const next = { ...prev, [gradeId]: !prev[gradeId] };
      try {
        localStorage.setItem('practice_collapsed_grades', JSON.stringify(next));
      } catch {}
      return next;
    });
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

  // 1. Initial parse from URL query params (Deep Linking)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category') as ChallengeCategory;
    const stat = params.get('status') as StatusFilter;
    const task = params.get('task');
    if (cat && CATEGORIES.some(c => c.id === cat)) {
      setSelectedCategory(cat);
    }
    if (stat && ['all', 'completed', 'in_progress', 'not_started'].includes(stat)) {
      setStatusFilter(stat);
    }
    if (task) {
      setSelectedId(task);
    }
  }, []);

  // 2. Synchronize URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    } else {
      params.delete('category');
    }
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }
    if (selectedId) {
      params.set('task', selectedId);
    } else {
      params.delete('task');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedCategory, statusFilter, selectedId]);

  // Tasks belonging to active category (for true total counts and mastery meter)
  const categoryChallenges = useMemo(() => {
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

      if (selectedCategory === 'testing_mutation' && selectedArchetype !== 'all') {
        const arch = TESTING_ARCHETYPES.find(a => a.id === selectedArchetype);
        if (arch && arch.match.length > 0) {
          const normKey = (c.id + ' ' + (c.slug || '')).toLowerCase().replace(/_/g, '-');
          const matchesArch = arch.match.some(m => normKey.includes(m));
          if (!matchesArch) return false;
        }
      }

      return true;
    });
  }, [challenges, selectedCategory, selectedArchetype]);

  // Tasks filtered by search & status filter
  const filteredChallenges = useMemo(() => {
    return categoryChallenges.filter((c) => {
      // Status Filter
      if (statusFilter === 'completed' && c.status !== 'COMPLETED') return false;
      if (statusFilter === 'in_progress' && c.status !== 'IN_PROGRESS' && c.status !== 'FAILED') return false;
      if (statusFilter === 'not_started' && c.status && c.status !== 'NOT_STARTED') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (c.taskCode && c.taskCode.toLowerCase().includes(q)) ||
          c.title.toLowerCase().includes(q) ||
          (c.shortDescription && c.shortDescription.toLowerCase().includes(q)) ||
          (c.targetStack && c.targetStack.toLowerCase().includes(q)) ||
          c.difficulty.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [categoryChallenges, statusFilter, searchQuery]);

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

  // Grade-based Grouping (Variant A)
  const groupedSections = useMemo(() => {
    return GRADE_CONFIG.map(grade => {
      const allInGrade = categoryChallenges.filter(
        c => c.difficulty.toLowerCase() === grade.id.toLowerCase()
      );
      const items = filteredChallenges.filter(
        c => c.difficulty.toLowerCase() === grade.id.toLowerCase()
      );

      const completedCount = allInGrade.filter(c => c.status === 'COMPLETED').length;
      const inProgressCount = allInGrade.filter(c => c.status === 'IN_PROGRESS' || c.status === 'FAILED').length;
      const totalCount = allInGrade.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        grade,
        items,
        totalCount,
        completedCount,
        inProgressCount,
        progressPercent
      };
    }).filter(section => section.totalCount > 0);
  }, [categoryChallenges, filteredChallenges]);

  // Overall category statistics for mastery banner & filter chips
  const categoryStats = useMemo(() => {
    const total = categoryChallenges.length;
    const completed = categoryChallenges.filter(c => c.status === 'COMPLETED').length;
    const inProgress = categoryChallenges.filter(c => c.status === 'IN_PROGRESS' || c.status === 'FAILED').length;
    const notStarted = Math.max(0, total - completed - inProgress);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, notStarted, percent };
  }, [categoryChallenges]);

  const handleStartChallenge = async (challengeId: string) => {
    setOpeningId(challengeId);
    try {
      const res = await fetch(`/api/practice/challenges/${challengeId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();

      const localDraft = getLocalDraft(challengeId);
      const serverDraft = data.savedDraft;
      let effectiveDraft = null;
      let isRestored = false;

      if (localDraft && serverDraft && serverDraft.length > 0) {
        const serverEpoch = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        if (localDraft.updatedAt >= serverEpoch) {
          effectiveDraft = localDraft.files;
          isRestored = true;
        } else {
          effectiveDraft = serverDraft;
          isRestored = true;
        }
      } else if (localDraft && localDraft.files && localDraft.files.length > 0) {
        effectiveDraft = localDraft.files;
        isRestored = true;
      } else if (serverDraft && serverDraft.length > 0) {
        effectiveDraft = serverDraft;
        isRestored = true;
      }

      openPracticeChallenge(data.challenge, effectiveDraft);

      if (isRestored) {
        showToast({
          type: 'info',
          title: 'Черновик восстановлен',
          message: 'Восстановлен незавершенный код задачи.'
        });
      }
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

  const handleResetDraft = async (challengeId: string) => {
    if (!window.confirm('Вы уверены, что хотите сбросить воркспейс до исходного состояния? Все несохраненные изменения и черновики будут удалены.')) {
      return;
    }

    setResettingId(challengeId);
    try {
      removeLocalDraft(challengeId);
      const res = await fetch(`/api/practice/reset/${challengeId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast({
        type: 'success',
        title: 'Воркспейс сброшен',
        message: 'Черновик очищен. Задача возвращена в исходное состояние.'
      });
      await fetchChallenges();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Ошибка сброса',
        message: err?.message || 'Не удалось сбросить черновик задачи.'
      });
    } finally {
      setResettingId(null);
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
      {/* 1. Header Banner with Mastery Meter */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">
                ⚡ Machine Coding Studio
              </span>
              <span className="text-xs text-pastel-muted font-mono font-bold">
                {challenges.length} задач • Java 21 LTS
              </span>
              {categoryStats.total > 0 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  Прогресс: {categoryStats.completed}/{categoryStats.total} ({categoryStats.percent}%)
                </span>
              )}
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

        {/* Global Category Mastery Progress Bar */}
        {categoryStats.total > 0 && (
          <div className="mt-4 pt-3 border-t border-pastel-border/60 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-pastel-muted">
              <span>Освоение трека ({selectedCategory === 'all' ? 'Все категории' : selectedCategory})</span>
              <span className="font-bold text-pastel-text">{categoryStats.completed} из {categoryStats.total} решено</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                style={{ width: `${categoryStats.percent}%` }}
              />
            </div>
          </div>
        )}

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
                <span className="text-[11px] text-pastel-muted">42 каты (L0–L3)</span>
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
                <span className="text-[11px] text-pastel-muted">55 задач BigTech & FinTech</span>
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
              placeholder="Поиск (код TST-01, стек, имя)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-pastel-border rounded-xl text-xs text-pastel-text placeholder-pastel-muted focus:outline-none focus:border-pastel-accentRose transition"
            />
          </div>
        </div>

        {/* 3. Status Filter Tabs (Tri-State Filter) */}
        {selectedCategory !== 'spring_transactions' && (
          <div className="mt-4 pt-3 border-t border-pastel-border/60 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
            <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Статус:
            </span>

            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
              }`}
            >
              Все ({categoryStats.total})
            </button>

            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-pastel-bg text-emerald-700 hover:bg-white border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Решенные ({categoryStats.completed})</span>
            </button>

            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'in_progress'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-pastel-bg text-amber-700 hover:bg-white border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>В процессе ({categoryStats.inProgress})</span>
            </button>

            <button
              onClick={() => setStatusFilter('not_started')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'not_started'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text hover:bg-white border border-pastel-border/60'
              }`}
            >
              Не начатые ({categoryStats.notStarted})
            </button>
          </div>
        )}

        {/* Archetype Sub-Filter Chips for Testing & Mutation */}
        {selectedCategory === 'testing_mutation' && (
          <div className="mt-3 pt-3 border-t border-pastel-border/60 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-fade-in">
            <span className="text-[11px] font-bold text-pastel-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-500" />
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
      </div>

      {/* 4. MASTER-DETAIL SPLIT STUDIO LAYOUT (Variant A - SOTA 2026) */}
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
            По запросу «<strong className="text-pastel-text">{searchQuery || statusFilter}</strong>» ничего не найдено в каталоге задач.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить все фильтры
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Grade-based Sticky Sectioned List (Variant A - 5 cols / 42%) */}
          <div className="lg:col-span-5 space-y-6 max-h-[820px] overflow-y-auto pr-1 no-scrollbar">
            {groupedSections.map((section) => {
              const isCollapsed = Boolean(collapsedGrades[section.grade.id]);

              return (
                <div key={section.grade.id} className="space-y-2.5">
                  {/* Sticky Grade Section Header */}
                  <div
                    onClick={() => toggleGrade(section.grade.id)}
                    className={`sticky top-0 z-20 p-3.5 rounded-2xl border border-pastel-border/90 bg-gradient-to-r ${section.grade.bgHeader} shadow-xs backdrop-blur-md cursor-pointer select-none transition hover:border-pastel-accentRose/40 flex items-center justify-between gap-3`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${section.grade.tagClass}`}>
                          {section.grade.badge}
                        </span>
                        <h3 className="font-extrabold text-xs sm:text-sm text-pastel-text tracking-tight">
                          {section.grade.name}
                        </h3>
                        <span className="text-[11px] font-mono text-pastel-muted font-bold">
                          ({section.items.length}{section.items.length !== section.totalCount ? ` из ${section.totalCount}` : ''})
                        </span>
                      </div>
                      <p className="text-[10px] text-pastel-muted truncate mt-0.5 max-w-sm">
                        {section.grade.subline}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Section Micro-Meter */}
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="text-[10px] font-mono font-bold text-slate-700">
                          {section.completedCount}/{section.totalCount} решено
                        </span>
                        <div className="w-16 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${section.grade.barColor} transition-all duration-300 rounded-full`}
                            style={{ width: `${section.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Toggle section"
                        className="p-1 rounded-lg hover:bg-black/5 text-pastel-muted transition"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-pastel-text" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-pastel-text" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cards inside Section */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2.5"
                      >
                        {section.items.length === 0 ? (
                          <div className="p-4 rounded-xl bg-pastel-bg/50 border border-dashed border-pastel-border text-center text-xs text-pastel-muted">
                            Нет задач, соответствующих активному фильтру статуса в этом грейде.
                          </div>
                        ) : (
                          section.items.map((ch) => {
                            const isSelected = selectedId === ch.id;
                            const isCompleted = ch.status === 'COMPLETED';
                            const isInProgress = ch.status === 'IN_PROGRESS' || ch.status === 'FAILED';

                            // Status rail styling
                            const statusRailClass = isCompleted
                              ? 'border-l-4 border-l-emerald-500 bg-emerald-50/20'
                              : isInProgress
                              ? 'border-l-4 border-l-amber-400 bg-amber-50/20'
                              : 'border-l-4 border-l-transparent';

                            return (
                              <div
                                key={ch.id}
                                onClick={() => setSelectedId(ch.id)}
                                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 relative select-none ${statusRailClass} ${
                                  isSelected
                                    ? 'bg-white border-pastel-accentRose shadow-sm ring-2 ring-pastel-accentRose/30'
                                    : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-pastel-accentRose/40 shadow-2xs'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      {/* Task Code Tag */}
                                      <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs shrink-0">
                                        {ch.taskCode || ch.id}
                                      </kbd>

                                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${getDifficultyColor(ch.difficulty)}`}>
                                        {ch.difficulty}
                                      </span>

                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-pastel-bg text-pastel-muted border border-pastel-border truncate max-w-[140px]">
                                        {ch.badge}
                                      </span>
                                    </div>

                                    {/* Status Pill on Card */}
                                    {isCompleted ? (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>{ch.lastScore || 100}б</span>
                                      </span>
                                    ) : isInProgress ? (
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
                                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                        <span>В процессе</span>
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
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Right Column: Live Challenge Passport / Inspector (7 cols / 58%) */}
          {activeChallenge && (
            <div className="lg:col-span-7 bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 sticky top-20 self-start">
              {/* Header with Task Code, Title & Metadata */}
              <div className="space-y-2 pb-4 border-b border-pastel-border/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800 shadow-2xs">
                      {activeChallenge.taskCode || activeChallenge.id}
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

              {/* Dynamic Status Callout Banner */}
              {activeChallenge.status === 'COMPLETED' ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <span className="font-bold text-emerald-900 block text-xs">
                        Задача успешно решена на {activeChallenge.lastScore || 100} баллов
                      </span>
                      <span className="text-[11px] text-emerald-700 leading-snug block">
                        Решение прошло все верификации, тесты и архитектурные инварианты.
                      </span>
                    </div>
                  </div>
                </div>
              ) : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED' ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/80 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-amber-900 block text-xs truncate">
                        Воркспейс в процессе решения (черновик сохранен)
                      </span>
                      <span className="text-[11px] text-amber-700 leading-snug block">
                        Вы можете продолжить разработку или сбросить воркспейс до исходных файлов.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResetDraft(activeChallenge.id)}
                    disabled={resettingId === activeChallenge.id}
                    className="px-3 py-1.5 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                  >
                    {resettingId === activeChallenge.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Сбросить</span>
                  </button>
                </div>
              ) : null}

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
                    activeChallenge.status === 'COMPLETED'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                      : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED'
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:opacity-95'
                      : 'bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95'
                  }`}
                >
                  {openingId === activeChallenge.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Инициализация воркспейса...</span>
                    </>
                  ) : activeChallenge.status === 'COMPLETED' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Решить снова ({activeChallenge.lastScore || 100} баллов)</span>
                    </>
                  ) : activeChallenge.status === 'IN_PROGRESS' || activeChallenge.status === 'FAILED' ? (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Продолжить воркспейс в Арене (Enter)</span>
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
