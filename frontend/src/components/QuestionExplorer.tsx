/**
 * QuestionExplorer.tsx
 * Decomposed question explorer view delegating to QuestionCatalogEngine & subcomponents.
 * Cognitive Bounding Limit: <= 250 lines (Rule 8 compliant).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, Question } from '../store/useAppStore';
import { BookOpen, Info } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { VoiceModal } from './VoiceModal';
import { AudioPlayoutManager } from '../services/AudioPlayoutManager';
import {
  QuestionCatalogEngine,
  QuestionWithStatus,
  FilterStatus
} from '../services/QuestionCatalogEngine';
import { QuestionCardItem } from './questions/QuestionCardItem';
import { QuestionExplorerActionDock } from './questions/QuestionExplorerActionDock';
import { QuestionExplorerHeader } from './questions/QuestionExplorerHeader';

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

  // Filtered list via pure QuestionCatalogEngine
  const filteredQuestions = useMemo(() => {
    return QuestionCatalogEngine.filterQuestions(questions, {
      searchQuery,
      statusFilter,
      evaluationsMap
    });
  }, [questions, statusFilter, searchQuery, evaluationsMap]);

  // Stats calculation via pure QuestionCatalogEngine
  const stats = useMemo(() => {
    return QuestionCatalogEngine.computeStats(questions, evaluationsMap);
  }, [questions, evaluationsMap]);

  // Synchronize dynamic topic progress into store for instant consistency on main catalog
  useEffect(() => {
    if (selectedTopicId && stats.total > 0) {
      syncTopicProgress(selectedTopicId, stats.completed, stats.percentage, stats.total);
    }
  }, [selectedTopicId, stats.completed, stats.percentage, stats.total, syncTopicProgress]);

  // Selection Handlers with Shift + Click
  const handleItemSelect = (qId: string, index: number, event: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = QuestionCatalogEngine.computeRangeSelection(
        filteredQuestions,
        lastSelectedIndexRef.current,
        index,
        prev,
        qId,
        event.shiftKey
      );
      lastSelectedIndexRef.current = index;
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const allFilteredIds = filteredQuestions.map((q) => q.id);
      const allAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allAreSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  };

  const handleSelectPreset = (preset: 'first5' | 'first10' | 'uncompleted' | 'all') => {
    const next = QuestionCatalogEngine.computePreset(preset, questions, filteredQuestions, evaluationsMap);
    setSelectedIds(next);
    lastSelectedIndexRef.current = null;
  };

  // Keyboard Shortcuts (Ctrl+A for select all, Escape to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
      } else if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        handleClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredQuestions, selectedIds]);

  // Launch Actions
  const handleStartStudy = (customQuestions?: QuestionWithStatus[]) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({ type: 'warning', title: 'Выберите вопросы', message: 'Пожалуйста, выберите хотя бы один вопрос.' });
      return;
    }
    startStudyWithQuestions(selectedTopicId!, selectedTopicName || 'Тема', targetQuestions);
  };

  const handleStartQuiz = (customQuestions?: QuestionWithStatus[]) => {
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({ type: 'warning', title: 'Выберите вопросы', message: 'Пожалуйста, выберите хотя бы один вопрос.' });
      return;
    }
    startQuizWithQuestions(selectedTopicId!, selectedTopicName || 'Тема', targetQuestions);
  };

  const handleStartVoice = (customQuestions?: QuestionWithStatus[], startIndex = 0) => {
    AudioPlayoutManager.warmup();
    const targetQuestions = customQuestions || questions.filter((q) => selectedIds.has(q.id));
    if (targetQuestions.length === 0) {
      showToast({ type: 'warning', title: 'Выберите вопросы', message: 'Пожалуйста, выберите хотя бы один вопрос.' });
      return;
    }
    setVoiceBatch(targetQuestions);
    setVoiceBatchIndex(startIndex);
    setIsVoiceOpen(true);
  };

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

  const toggleAnswer = (id: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllFilteredSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedIds.has(q.id));
  const isPartiallySelected = filteredQuestions.some((q) => selectedIds.has(q.id)) && !isAllFilteredSelected;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-pastel-accentRose/30 border-t-pastel-accentRose rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-pastel-muted">Загрузка вопросов по теме...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-4 sm:py-8 pb-32">
      <QuestionExplorerHeader
        selectedTopicName={selectedTopicName}
        topicMeta={topicMeta}
        stats={stats}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onBackToTopics={() => setView('topics')}
        isAllFilteredSelected={isAllFilteredSelected}
        isPartiallySelected={isPartiallySelected}
        filteredCount={filteredQuestions.length}
        selectedCount={selectedIds.size}
        onSelectAllFiltered={handleSelectAllFiltered}
        onSelectPreset={handleSelectPreset}
        onClearSelection={handleClearSelection}
      />

      <div className="flex items-center gap-2 mb-4 px-2 text-[11px] text-pastel-muted">
        <Info className="w-3.5 h-3.5 text-pastel-accentViolet shrink-0" />
        <span><strong>Подсказка:</strong> Зажмите <kbd className="px-1.5 py-0.5 bg-white border border-pastel-border rounded font-mono text-[10px]">Shift</kbd> при клике по чекбоксу для выделения диапазона.</span>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredQuestions.map((q, idx) => {
            const isSelected = selectedIds.has(q.id);
            const isExpanded = expandedAnswers.has(q.id);
            const status = QuestionCatalogEngine.getEffectiveStatus(q, evaluationsMap);

            return (
              <QuestionCardItem
                key={q.id}
                question={q}
                index={idx}
                isSelected={isSelected}
                isExpanded={isExpanded}
                status={status}
                evalItem={evaluationsMap[q.id]}
                onSelect={(e) => handleItemSelect(q.id, idx, e)}
                onToggleExpand={() => toggleAnswer(q.id)}
                onOpenReport={() => openReportModal({ ...evaluationsMap[q.id], questionText: q.question, referenceAnswer: q.answer })}
                onStartVoice={() => handleStartVoice([q])}
                onStartStudy={() => handleStartStudy([q])}
                onStartQuiz={() => handleStartQuiz([q])}
                onStartRecap={() => handleStartRecap([q])}
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
            {searchQuery ? `По запросу «${searchQuery}» ничего не найдено.` : 'Попробуйте сбросить фильтры.'}
          </p>
        </div>
      )}

      {/* Floating Batch Action Dock */}
      <QuestionExplorerActionDock
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
            if (selectedTopicId) fetchTopicEvaluations(selectedTopicId);
          }}
        />
      )}
    </div>
  );
};
