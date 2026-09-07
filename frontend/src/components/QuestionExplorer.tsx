import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppStore, Question } from '../store/useAppStore';
import { ArrowLeft, Sparkles, BookOpen } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { VoiceModal } from './VoiceModal';
import { QuestionFilterBar, FilterStatus } from './questions/QuestionFilterBar';
import { QuestionListItem, QuestionWithStatus } from './questions/QuestionListItem';
import { QuestionBatchActionDock } from './questions/QuestionBatchActionDock';

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
    fetchTopicEvaluations,
    syncTopicProgress,
    activeAudioJob
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

  // Synchronize dynamic topic progress into store for instant consistency on main catalog
  useEffect(() => {
    if (selectedTopicId && stats.total > 0) {
      syncTopicProgress(selectedTopicId, stats.completed, stats.percentage, stats.total);
    }
  }, [selectedTopicId, stats.completed, stats.percentage, stats.total, syncTopicProgress]);

  // Selection Handlers with Shift + Click
  const handleItemSelect = (qId: string, index: number, event: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (event.shiftKey && lastSelectedIndexRef.current !== null) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
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
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      } else {
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
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'a' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('topics')}
            className="flex items-center gap-1.5 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Разделы
          </button>
          <span className="text-xs text-pastel-muted">/</span>
          <span className="text-xs font-bold text-pastel-text max-w-[200px] sm:max-w-md truncate">
            {selectedTopicName}
          </span>
        </div>

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
            <div className="flex items-center gap-2 text-xs font-semibold text-pastel-accentRoseText mb-1">
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
      <QuestionFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        stats={stats}
        filteredCount={filteredQuestions.length}
        selectedCount={selectedIds.size}
        isAllFilteredSelected={isAllFilteredSelected}
        isPartiallySelected={isPartiallySelected}
        onSelectAllFiltered={handleSelectAllFiltered}
        onSelectPreset={handleSelectPreset}
        onClearSelection={handleClearSelection}
      />

      {/* Questions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredQuestions.map((q, idx) => {
            const { isMastered, isCompleted, evalItem } = getEffectiveStatus(q);
            const isSelected = selectedIds.has(q.id);
            const isExpanded = expandedAnswers.has(q.id);

            return (
              <QuestionListItem
                key={q.id}
                question={q}
                index={idx}
                isSelected={isSelected}
                isExpanded={isExpanded}
                isMastered={isMastered}
                isCompleted={isCompleted}
                evaluationItem={evalItem}
                onSelect={handleItemSelect}
                onToggleAnswer={toggleAnswer}
                onOpenReportModal={openReportModal}
                onStartVoice={handleStartVoice}
                onStartStudy={handleStartStudy}
                onStartQuiz={handleStartQuiz}
                onStartRecap={handleStartRecap}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-pastel-border mt-4 space-y-2">
          <BookOpen className="w-10 h-10 text-pastel-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-semibold text-pastel-text mb-1">Вопросы не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto">
            {searchQuery ? (
              <>По запросу «<strong className="text-pastel-text">{searchQuery}</strong>» ничего не найдено в этой категории.</>
            ) : (
              <>Попробуйте выбрать другую категорию статуса или сбросить фильтры.</>
            )}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Batch Action Dock */}
      <QuestionBatchActionDock
        selectedCount={selectedIds.size}
        activeAudioJob={Boolean(activeAudioJob)}
        onStartVoice={() => handleStartVoice()}
        onStartStudy={() => handleStartStudy()}
        onStartQuiz={() => handleStartQuiz()}
        onStartRecap={() => handleStartRecap()}
        onClearSelection={handleClearSelection}
      />

      {/* Voice Modal for Explorer */}
      {voiceBatch.length > 0 && (
        <VoiceModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          questionsBatch={voiceBatch}
          initialQuestionIndex={voiceBatchIndex}
          topic={selectedTopicName || 'Java & Spring Framework'}
          onIndexChange={(newIdx) => setVoiceBatchIndex(newIdx)}
          onEvaluationComplete={() => {
            if (selectedTopicId) {
              fetchTopicEvaluations(selectedTopicId);
            }
          }}
        />
      )}
    </div>
  );
};
