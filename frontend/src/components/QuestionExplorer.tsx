import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppStore, Question } from '../store/useAppStore';
import {
  ArrowLeft,
  Search,
  BookOpen,
  Brain,
  Headphones,
  CheckSquare,
  Square,
  MinusSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  Award,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceModal } from './VoiceModal';
import { MarkdownRenderer } from './MarkdownRenderer';

interface QuestionWithStatus extends Question {
  isCompleted?: boolean;
  isMastered?: boolean;
}

type FilterStatus = 'all' | 'uncompleted' | 'completed' | 'mastered';

export const QuestionExplorer: React.FC = () => {
  const {
    selectedTopicId,
    selectedTopicName,
    setView,
    startStudyWithQuestions,
    startQuizWithQuestions,
    openRecapModal,
    showToast,
    evaluationsMap,
    openReportModal,
    fetchTopicEvaluations
  } = useAppStore();

  const [questions, setQuestions] = useState<QuestionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicMeta, setTopicMeta] = useState<any>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Voice Batch State
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceBatch, setVoiceBatch] = useState<Question[]>([]);
  const [voiceBatchIndex, setVoiceBatchIndex] = useState(0);

  // Expanded answers (for quick preview accordion)
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  // Fetch Questions for this Topic
  const fetchQuestions = async () => {
    if (!selectedTopicId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/topics/${selectedTopicId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setTopicMeta(data.meta || null);
      } else {
        showToast({
          type: 'error',
          title: 'Ошибка загрузки вопросов',
          message: 'Не удалось получить список вопросов с сервера.'
        });
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Сбой сети',
        message: e?.message || 'Проверьте соединение с сервером.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    if (selectedTopicId) {
      fetchTopicEvaluations(selectedTopicId);
    }
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, [selectedTopicId]);

  // Helper to compute effective question status from progress and evaluationsMap
  const getEffectiveStatus = useCallback((q: QuestionWithStatus) => {
    const evalItem = evaluationsMap[q.id];
    const evalScore = evalItem?.score !== undefined ? evalItem.score : -1;
    const isEvalPassed = evalItem?.isPassed || evalScore >= 70;

    const isMastered = q.isMastered || evalScore >= 90;
    const isCompleted = q.isCompleted || isEvalPassed || isMastered;

    return { isMastered, isCompleted, evalItem };
  }, [evaluationsMap]);

  // Filtered list
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const { isMastered, isCompleted } = getEffectiveStatus(q);

      // Status filter
      if (statusFilter === 'uncompleted' && isCompleted) return false;
      if (statusFilter === 'completed' && (!isCompleted || isMastered)) return false;
      if (statusFilter === 'mastered' && !isMastered) return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const numStr = String(q.num);
      const matchNum = numStr === query || `#${numStr}` === query;
      const matchText = q.question.toLowerCase().includes(query);
      const matchId = q.id.toLowerCase().includes(query);

      return matchNum || matchText || matchId;
    });
  }, [questions, statusFilter, searchQuery, getEffectiveStatus]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = questions.length;
    let completed = 0;
    let mastered = 0;

    questions.forEach((q) => {
      const { isMastered, isCompleted } = getEffectiveStatus(q);
      if (isCompleted) completed++;
      if (isMastered) mastered++;
    });

    const uncompleted = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, mastered, uncompleted, percentage };
  }, [questions, getEffectiveStatus]);

  // Selection Handlers with Shift + Click
  const handleItemSelect = (qId: string, index: number, event: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (event.shiftKey && lastSelectedIndexRef.current !== null) {
        // Range selection
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);

        // Determine if we should select or deselect based on the clicked item's current state
        const targetShouldBeSelected = !prev.has(qId);

        for (let i = start; i <= end; i++) {
          const item = filteredQuestions[i];
          if (item) {
            if (targetShouldBeSelected) {
              next.add(item.id);
            } else {
              next.delete(item.id);
            }
          }
        }
      } else {
        // Single toggle
        if (next.has(qId)) {
          next.delete(qId);
        } else {
          next.add(qId);
        }
      }

      lastSelectedIndexRef.current = index;
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const allFilteredIds = filteredQuestions.map((q) => q.id);
      const allAreSelected = allFilteredIds.every((id) => prev.has(id));

      if (allAreSelected) {
        // Deselect all currently filtered
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      } else {
        // Select all filtered
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  };

  const handleSelectPreset = (preset: 'first5' | 'first10' | 'uncompleted' | 'all') => {
    const next = new Set<string>();
    if (preset === 'first5') {
      filteredQuestions.slice(0, 5).forEach((q) => next.add(q.id));
    } else if (preset === 'first10') {
      filteredQuestions.slice(0, 10).forEach((q) => next.add(q.id));
    } else if (preset === 'uncompleted') {
      questions.filter((q) => !getEffectiveStatus(q).isCompleted).forEach((q) => next.add(q.id));
    } else if (preset === 'all') {
      questions.forEach((q) => next.add(q.id));
    }
    setSelectedIds(next);
    lastSelectedIndexRef.current = null;
  };

  // Keyboard Shortcuts (Ctrl+A for select all, Escape to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const next = new Set<string>(filteredQuestions.map((q) => q.id));
        setSelectedIds(next);
      } else if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        handleClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredQuestions, selectedIds]);

  // Launch Study with Selected Questions
  const handleStartStudy = (customQuestions?: QuestionWithStatus[]) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({
        type: 'warning',
        title: 'Выберите вопросы',
        message: 'Пожалуйста, выберите хотя бы один вопрос для начала изучения.'
      });
      return;
    }

    startStudyWithQuestions(selectedTopicId!, selectedTopicName || 'Тема', targetQuestions);
  };

  // Launch AI Quiz with Selected Questions
  const handleStartQuiz = (customQuestions?: QuestionWithStatus[]) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({
        type: 'warning',
        title: 'Выберите вопросы',
        message: 'Пожалуйста, выберите хотя бы один вопрос для проверки знаний.'
      });
      return;
    }

    startQuizWithQuestions(selectedTopicId!, selectedTopicName || 'Тема', targetQuestions);
  };

  // Launch Voice Interview with Selected Questions
  const handleStartVoice = (customQuestions?: QuestionWithStatus[], startIndex = 0) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({
        type: 'warning',
        title: 'Выберите вопросы',
        message: 'Пожалуйста, выберите хотя бы один вопрос для голосового собеседования.'
      });
      return;
    }

    setVoiceBatch(targetQuestions);
    setVoiceBatchIndex(startIndex);
    setIsVoiceOpen(true);
  };

  // Launch Audio Recap with Selected Questions
  const handleStartRecap = (customQuestions?: QuestionWithStatus[]) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) return;

    openRecapModal({
      questionIds: targetQuestions.map((q) => q.id),
      topicId: selectedTopicId || undefined,
      topicName: selectedTopicName || undefined,
      title: `Выборка из ${targetQuestions.length} вопросов (${selectedTopicName || 'Тема'})`
    });
  };

  // Toggle Accordion Answer Preview
  const toggleAnswer = (id: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => selectedIds.has(q.id));

  const isPartiallySelected =
    filteredQuestions.some((q) => selectedIds.has(q.id)) && !isAllFilteredSelected;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-pastel-accentRose/30 border-t-pastel-accentRose rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm font-semibold text-pastel-muted">Загрузка вопросов по теме...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-32">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <button
          onClick={() => setView('topics')}
          className="flex items-center gap-2 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Назад к темам
        </button>

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
            <div className="flex items-center gap-2 text-xs font-semibold text-pastel-accentRose mb-1">
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

          {/* Quick Progress Overview */}
          <div className="bg-pastel-bg/80 rounded-2xl p-4 border border-pastel-border/80 min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-semibold text-pastel-text mb-2">
              <span>Прогресс темы</span>
              <span className="text-pastel-accentViolet font-bold">{stats.percentage}%</span>
            </div>
            <div className="w-full bg-pastel-border h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.percentage}%` }}
              ></div>
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
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру (#5) или формулировке вопроса..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-pastel-bg/50 border border-pastel-border text-xs md:text-sm text-pastel-text placeholder-pastel-muted focus:outline-none focus:bg-white focus:ring-2 focus:ring-pastel-accentRose/30 focus:border-pastel-accentRose transition"
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
              onClick={handleSelectAllFiltered}
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
                  : `Выбрать все (${filteredQuestions.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-pastel-accentRose/10 text-pastel-accentRose border border-pastel-accentRose/20">
                Выбрано: {selectedIds.size}
              </span>
            )}
          </div>

          {/* Quick Selection Presets */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-pastel-muted flex-wrap">
            <span className="hidden md:inline text-pastel-muted/80">Быстрый выбор:</span>
            <button
              onClick={() => handleSelectPreset('first5')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Первые 5
            </button>
            <button
              onClick={() => handleSelectPreset('first10')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-lavender text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Первые 10
            </button>
            <button
              onClick={() => handleSelectPreset('uncompleted')}
              className="px-2.5 py-1 rounded-lg bg-pastel-bg hover:bg-pastel-rose text-pastel-text transition border border-pastel-border/80 cursor-pointer"
            >
              Все неизученные
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleClearSelection}
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

      {/* Questions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredQuestions.map((q, idx) => {
            const isSelected = selectedIds.has(q.id);
            const isExpanded = expandedAnswers.has(q.id);

            return (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.2) }}
                className={`card-content-visibility rounded-2xl border transition-all duration-200 bg-white ${
                  isSelected
                    ? 'border-pastel-accentRose/70 ring-2 ring-pastel-accentRose/20 shadow-md'
                    : 'border-pastel-border hover:border-pastel-muted/40 shadow-xs'
                }`}
              >

                <div className="p-4 flex items-start gap-3">
                  {/* Row Checkbox (with Shift-click handler) */}
                  <button
                    onClick={(e) => handleItemSelect(q.id, idx, e)}
                    className="mt-0.5 text-pastel-muted hover:text-pastel-accentRose transition shrink-0 cursor-pointer p-2 -m-1 rounded-xl focus:outline-hidden touch-manipulation flex items-center justify-center min-w-[36px] min-h-[36px]"
                    title="Выбрать вопрос (Shift + клик для диапазона)"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-pastel-accentRose fill-pastel-accentRose/10" />
                    ) : (
                      <Square className="w-5 h-5 text-pastel-border hover:text-pastel-muted" />
                    )}
                  </button>

                  {/* Question Number Badge */}
                  <div className="shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[38px] px-2 py-1 rounded-xl bg-pastel-lavender/70 text-pastel-accentViolet font-bold text-xs border border-pastel-accentViolet/20">
                      #{q.num}
                    </span>
                  </div>

                  {/* Question Main Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {/* Status Badges */}
                      {(() => {
                        const { isMastered, isCompleted } = getEffectiveStatus(q);
                        if (isMastered) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Освоен
                            </span>
                          );
                        }
                        if (isCompleted) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-pastel-accentViolet text-[10px] font-bold border border-pastel-accentViolet/20">
                              <Clock className="w-3 h-3" /> Изучен
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 text-[10px] font-medium border border-gray-200">
                            Не начат
                          </span>
                        );
                      })()}

                      <span className="text-[10px] text-pastel-muted font-mono">
                        {q.id}
                      </span>

                      {/* Evaluation Score Badge */}
                      {evaluationsMap[q.id] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReportModal({
                              ...evaluationsMap[q.id],
                              questionText: q.question,
                              referenceAnswer: q.answer
                            });
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition shadow-2xs cursor-pointer ${
                            evaluationsMap[q.id].isPassed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          }`}
                          title="Посмотреть подробный отчет интервьюера"
                        >
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>{evaluationsMap[q.id].score}/100</span>
                          <span>{evaluationsMap[q.id].mode === 'voice' ? '🎙️' : '⌨️'}</span>
                          <span className="text-[9px] underline ml-0.5">Отчёт</span>
                        </button>
                      )}
                    </div>

                    {/* Question Text */}
                    <h3
                      onClick={(e) => handleItemSelect(q.id, idx, e)}
                      className="text-sm md:text-base font-bold text-pastel-text leading-snug cursor-pointer select-none hover:text-pastel-accentRose transition-colors"
                    >
                      {q.question}
                    </h3>

                    {/* Accordion Toggle for Answer Preview */}
                    <div className="mt-2.5 flex items-center gap-3">
                      <button
                        onClick={() => toggleAnswer(q.id)}
                        className="text-xs font-semibold text-pastel-accentViolet hover:text-pastel-text transition flex items-center gap-1 py-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Скрыть эталонный ответ
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Посмотреть эталонный ответ
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expandable Answer Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 pt-3 border-t border-pastel-border/60 text-xs text-pastel-text/90 leading-relaxed bg-pastel-bg/60 p-3.5 rounded-xl"
                        >
                          <div className="text-[11px] font-bold uppercase tracking-wider text-pastel-muted mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-pastel-accentRose" /> Эталонный ответ:
                          </div>
                          <div className="mt-1">
                            <MarkdownRenderer content={q.answer} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Individual Row Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartVoice([q])}
                      title="Пройти голосовое собеседование по этому вопросу"
                      className="p-2 rounded-xl bg-pastel-rose/40 text-pastel-accentRose hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartStudy([q])}
                      title="Изучить только этот вопрос"
                      className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentRose hover:bg-pastel-rose transition cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartQuiz([q])}
                      title="Проверить знание этого вопроса с ИИ"
                      className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentViolet hover:bg-pastel-lavender transition cursor-pointer"
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartRecap([q])}
                      title="Сгенерировать AI-озвучку вопроса"
                      className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentRose hover:bg-pastel-rose transition cursor-pointer"
                    >
                      <Headphones className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-pastel-border mt-4">
          <BookOpen className="w-10 h-10 text-pastel-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-semibold text-pastel-text mb-1">Вопросы не найдены</h3>
          <p className="text-xs text-pastel-muted">
            Попробуйте сбросить поисковый фильтр или выбрать другую категорию статуса
          </p>
        </div>
      )}

      {/* Floating Batch Action Dock (Sticky Bottom Glassmorphism Bar) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 inset-x-0 mx-auto max-w-2xl px-4 z-40"
          >
            <div className="pastel-glass rounded-2xl p-3 shadow-2xl border border-white/80 flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl bg-white/95">
              {/* Selected Count Indicator */}
              <div className="flex items-center gap-2 pl-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pastel-accentRose animate-pulse"></span>
                <span className="text-xs font-bold text-pastel-text">
                  Выбрано: <strong className="text-pastel-accentRose text-sm">{selectedIds.size}</strong> вопр.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Voice Interview Selected */}
                <button
                  onClick={() => handleStartVoice()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition transform hover:scale-105 cursor-pointer"
                  title="Запустить непрерывное голосовое собеседование по выбранным вопросам"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Собеседование ({selectedIds.size})</span>
                </button>

                {/* Study Selected */}
                <button
                  onClick={() => handleStartStudy()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-pastel-border text-pastel-text rounded-xl text-xs font-bold shadow-xs hover:bg-pastel-card transition transform hover:scale-105 cursor-pointer"
                  title="Начать изучение выбранных карточек"
                >
                  <BookOpen className="w-3.5 h-3.5 text-pastel-accentRose" />
                  <span>Изучать ({selectedIds.size})</span>
                </button>

                {/* AI Quiz Selected */}
                <button
                  onClick={() => handleStartQuiz()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-pastel-text text-white rounded-xl text-xs font-bold shadow-sm hover:bg-black transition transform hover:scale-105 cursor-pointer"
                  title="Запустить проверку знаний с ИИ по выбранным вопросам"
                >
                  <Brain className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  <span>Квиз ({selectedIds.size})</span>
                </button>

                {/* Audio Podcast Selected */}
                <button
                  onClick={() => handleStartRecap()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 rounded-xl text-xs font-bold hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
                  title="Сгенерировать аудиоподкаст по выбранным вопросам"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">AI Аудио</span>
                </button>

                {/* Clear Selection */}
                <button
                  onClick={handleClearSelection}
                  className="p-2 text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg rounded-xl transition cursor-pointer"
                  title="Снять выбор (Escape)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Modal for Explorer */}
      {voiceBatch.length > 0 && (
        <VoiceModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          questionsBatch={voiceBatch}
          initialQuestionIndex={voiceBatchIndex}
          topic={selectedTopicName || 'Java & Spring Framework'}
          onIndexChange={(newIdx) => setVoiceBatchIndex(newIdx)}
          onEvaluationComplete={(evalData) => {
            if (selectedTopicId) {
              fetchTopicEvaluations(selectedTopicId);
            }
          }}
        />
      )}
    </div>
  );
};
