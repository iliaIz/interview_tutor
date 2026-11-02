import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CodingChallenge, ChallengeCategory } from '../../types/practice';
import { Code2, ArrowRight, Zap, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TRANSACTION_LAB_SCENARIOS } from '../../data/transactionLabCatalog';
import { getLocalDraft, removeLocalDraft } from '../../services/practiceDraftStorage';
import {
  TESTING_ARCHETYPES,
  REFACTORING_ARCHETYPES,
  GRADE_CONFIG,
  StatusFilter,
  isChallengeInCategory,
  isChallengeInArchetype
} from './PracticeCatalogConstants';
import { PracticeCatalogHeader } from './PracticeCatalogHeader';
import { PracticeChallengeCard } from './PracticeChallengeCard';
import { PracticeChallengeInspector } from './PracticeChallengeInspector';

export const PracticeCatalog: React.FC = () => {
  const { openPracticeChallenge, openTransactionLab, showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/practice/challenges', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const loaded: CodingChallenge[] = Array.isArray(data) ? data : (data.challenges || []);
      setChallenges(loaded);

      if (loaded.length > 0 && !selectedId) {
        setSelectedId(loaded[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load challenges:', err);
      showToast({
        type: 'error',
        title: 'Ошибка каталога',
        message: 'Не удалось загрузить каталог практических задач.'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedId]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const toggleGrade = (gradeId: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [gradeId]: !prev[gradeId] }));
  };

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (!isChallengeInCategory(c, selectedCategory)) {
        return false;
      }

      if (!isChallengeInArchetype(c, selectedCategory, selectedArchetype)) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && c.status !== 'COMPLETED') return false;
        if (statusFilter === 'in_progress' && c.status !== 'IN_PROGRESS' && c.status !== 'FAILED') return false;
        if (statusFilter === 'not_started' && (c.status === 'COMPLETED' || c.status === 'IN_PROGRESS' || c.status === 'FAILED')) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = c.title.toLowerCase().includes(q);
        const inDesc = (c.shortDescription || '').toLowerCase().includes(q);
        const inStack = (c.targetStack || '').toLowerCase().includes(q);
        const inCode = (c.taskCode || c.id || '').toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inStack && !inCode) return false;
      }

      return true;
    });
  }, [challenges, selectedCategory, selectedArchetype, statusFilter, searchQuery]);

  useEffect(() => {
    if (filteredChallenges.length > 0) {
      const stillValid = filteredChallenges.some((c) => c.id === selectedId);
      if (!stillValid) {
        setSelectedId(filteredChallenges[0].id);
      }
    }
  }, [filteredChallenges, selectedId]);

  const activeChallenge = useMemo(() => {
    return filteredChallenges.find((c) => c.id === selectedId) || filteredChallenges[0] || null;
  }, [filteredChallenges, selectedId]);

  const categoryStats = useMemo(() => {
    const relevant = challenges.filter((c) => isChallengeInCategory(c, selectedCategory));
    const completed = relevant.filter((c) => c.status === 'COMPLETED').length;
    const inProgress = relevant.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'FAILED').length;
    const total = relevant.length;
    return {
      total,
      completed,
      inProgress,
      notStarted: total - completed - inProgress,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [challenges, selectedCategory]);

  const groupedSections = useMemo(() => {
    return GRADE_CONFIG.map((grade) => {
      const allForGrade = challenges.filter((c) => {
        if (!isChallengeInCategory(c, selectedCategory)) return false;
        return c.difficulty === grade.id;
      });
      const items = filteredChallenges.filter((c) => c.difficulty === grade.id);
      const completedCount = allForGrade.filter((c) => c.status === 'COMPLETED').length;
      const totalCount = allForGrade.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return { grade, items, completedCount, totalCount, progressPercent };
    }).filter((sec) => sec.items.length > 0);
  }, [challenges, filteredChallenges, selectedCategory]);

  const handleStartChallenge = async (challengeId: string) => {
    setOpeningId(challengeId);
    try {
      const res = await fetch(`/api/practice/challenges/${challengeId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const localDraft = getLocalDraft(challengeId);
      const serverDraft = data.savedDraft;
      const serverEpoch = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
      let effectiveDraft = null;
      let isRestored = false;

      // Discard stale local draft if challenge was updated on server after local draft was created
      if (localDraft && serverEpoch > 0 && localDraft.updatedAt < serverEpoch) {
        removeLocalDraft(challengeId);
      } else if (localDraft && serverDraft && serverDraft.length > 0) {
        effectiveDraft = localDraft.updatedAt >= serverEpoch ? localDraft.files : serverDraft;
        isRestored = true;
      } else if (localDraft?.files?.length) {
        effectiveDraft = localDraft.files;
        isRestored = true;
      } else if (serverDraft?.length) {
        effectiveDraft = serverDraft;
        isRestored = true;
      }

      // Invalidate draft if file paths do not match current challenge manifest
      const canonicalPaths = new Set(((data.challenge?.workspaceFiles) || []).map((f: any) => f.path));
      if (effectiveDraft && !effectiveDraft.some((df: any) => canonicalPaths.has(df.path))) {
        effectiveDraft = null;
        isRestored = false;
        removeLocalDraft(challengeId);
      }

      openPracticeChallenge(data.challenge, effectiveDraft);
      if (isRestored) {
        showToast({ type: 'info', title: 'Черновик восстановлен', message: 'Восстановлен незавершенный код задачи.' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Ошибка загрузки', message: err?.message || 'Не удалось загрузить задачу.' });
    } finally {
      setOpeningId(null);
    }
  };

  const handleResetDraft = async (challengeId: string) => {
    if (!window.confirm('Сбросить воркспейс до исходного состояния? Все изменения будут удалены.')) return;
    setResettingId(challengeId);
    try {
      removeLocalDraft(challengeId);
      await fetch(`/api/practice/reset/${challengeId}`, { method: 'POST', credentials: 'include' });
      showToast({ type: 'success', title: 'Воркспейс сброшен', message: 'Задача возвращена в исходное состояние.' });
      await fetchChallenges();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Ошибка сброса', message: err?.message || 'Не удалось сбросить черновик.' });
    } finally {
      setResettingId(null);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if (filteredChallenges.length === 0) return;
    const currentIndex = filteredChallenges.findIndex((c) => c.id === selectedId);
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
      {/* 1. Header Banner & Quick Filter Navigation */}
      <PracticeCatalogHeader
        challengesCount={challenges.length}
        categoryStats={categoryStats}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedArchetype('all');
        }}
        selectedArchetype={selectedArchetype}
        onSelectArchetype={setSelectedArchetype}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* 2. Split Catalog Content */}
      {selectedCategory === 'spring_transactions' ? (
        <div className="space-y-4 animate-fade-in">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h3 className="text-lg font-black tracking-tight">Spring Transaction Playground (@Transactional Lab)</h3>
              <p className="text-xs text-violet-100 leading-relaxed">
                Интерактивный симулятор физики транзакций Spring Framework: Flame Chart, слоты HikariCP и Сократическая защита с ИИ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openTransactionLab()}
              className="py-2.5 px-5 rounded-2xl bg-white text-violet-900 font-extrabold text-xs shadow-md hover:scale-[1.02] transition cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Zap className="w-4 h-4 text-violet-600" />
              <span>Запустить лабораторию</span>
            </button>
          </div>

          {filteredChallenges.length === 0 ? (
            <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
              <Code2 className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
              <h3 className="text-base font-bold text-pastel-text">Сценарии не найдены</h3>
              <p className="text-xs text-pastel-muted max-w-sm mx-auto">По запросу «{searchQuery || statusFilter}» ничего не найдено в лаборатории транзакций.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChallenges.map((sc, idx) => (
                <div key={sc.id} className="p-5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1} • {sc.difficulty}</span>
                      <div className="flex items-center gap-1.5">
                        {sc.isCompleted && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {sc.lastScore ? `${sc.lastScore}%` : 'Решено'}
                          </span>
                        )}
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{sc.badge}</span>
                      </div>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900">{sc.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-3">{sc.shortDescription}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTransactionLab(sc.id)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-violet-600 hover:text-white text-slate-800 font-bold text-xs border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Исследовать кейс</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Code2 className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Задачи не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto">По запросу «{searchQuery || statusFilter}» ничего не найдено.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-6 max-h-[820px] overflow-y-auto pr-1 no-scrollbar">
            {groupedSections.map((section) => {
              const isCollapsed = Boolean(collapsedGrades[section.grade.id]);
              return (
                <div key={section.grade.id} className="space-y-2.5">
                  <div
                    onClick={() => toggleGrade(section.grade.id)}
                    className={`sticky top-0 z-20 p-3.5 rounded-2xl border border-pastel-border/90 bg-gradient-to-r ${section.grade.bgHeader} shadow-xs backdrop-blur-md cursor-pointer select-none transition flex items-center justify-between gap-3`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${section.grade.tagClass}`}>{section.grade.badge}</span>
                        <h3 className="font-extrabold text-xs sm:text-sm text-pastel-text">{section.grade.name}</h3>
                        <span className="text-[11px] font-mono text-pastel-muted font-bold">({section.items.length})</span>
                      </div>
                      <p className="text-[10px] text-pastel-muted truncate mt-0.5">{section.grade.subline}</p>
                    </div>
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-pastel-text" /> : <ChevronDown className="w-4 h-4 text-pastel-text" />}
                  </div>

                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5">
                        {section.items.map((ch) => (
                          <PracticeChallengeCard
                            key={ch.id}
                            challenge={ch}
                            isSelected={selectedId === ch.id}
                            onSelect={() => setSelectedId(ch.id)}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {activeChallenge && (
            <PracticeChallengeInspector
              activeChallenge={activeChallenge}
              openingId={openingId}
              resettingId={resettingId}
              onStartChallenge={handleStartChallenge}
              onResetDraft={handleResetDraft}
            />
          )}
        </div>
      )}
    </div>
  );
};
