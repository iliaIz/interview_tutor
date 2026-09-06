import React, { useState, useEffect } from 'react';
import { useAppStore, Question } from '../store/useAppStore';
import { VoiceModal } from './VoiceModal';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Mic,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  ListChecks,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerSuccessConfetti } from '../utils/confetti';
import { MarkdownRenderer } from './MarkdownRenderer';

interface EvalRecord {
  question: Question;
  userAnswer: string;
  score: number;
  isPassed: boolean;
  feedback: string;
  positivePoints?: string[];
  missingPoints?: string[];
}

export const ExamQuiz: React.FC = () => {
  const {
    currentBatch,
    currentQuestionIndex,
    setQuestionIndex,
    setView,
    selectedTopicName,
    selectedTopicId,
    updateTopicProgress,
    syncTopicProgress,
    showToast,
    systemHealth,
    openTopicQuestions,
    startStudyWithQuestions,
    startQuizWithQuestions,
    setQuestionEvaluation,
    setBatch
  } = useAppStore();

  const [isAutoHealing, setIsAutoHealing] = useState(false);

  // SOTA 2026 Auto-Healing: If quiz view reloads with empty batch but valid selectedTopicId, restore questions automatically
  useEffect(() => {
    if ((!currentBatch || currentBatch.length === 0) && selectedTopicId && !isAutoHealing) {
      setIsAutoHealing(true);
      fetch(`/api/topics/${selectedTopicId}/questions`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data) => {
          const allQuestions = data.questions || [];
          if (allQuestions.length > 0) {
            setBatch(allQuestions.slice(0, 10));
          }
        })
        .catch((err) => {
          console.warn('Auto-healing quiz batch failed:', err);
        })
        .finally(() => {
          setIsAutoHealing(false);
        });
    }
  }, [currentBatch, selectedTopicId, isAutoHealing, setBatch]);

  const [userAnswer, setUserAnswer] = useState('');
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // Completed Quiz Results State
  const [resultsHistory, setResultsHistory] = useState<Record<string, EvalRecord>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(new Set());

  if (isAutoHealing) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-pastel-accentViolet border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-pastel-muted">Восстановление вопросов квиза...</p>
      </div>
    );
  }

  if (!currentBatch || currentBatch.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-pastel-muted">Порция вопросов не найдена.</p>
        <button
          onClick={() => setView('topics')}
          className="mt-4 px-4 py-2 bg-white border border-pastel-border rounded-xl text-sm font-semibold cursor-pointer"
        >
          К выбору тем
        </button>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, currentQuestionIndex), currentBatch.length - 1);
  const currentQ = currentBatch[safeIndex];
  const isLast = safeIndex === currentBatch.length - 1;

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) {
      showToast({
        type: 'warning',
        title: 'Ответ пуст',
        message: 'Пожалуйста, введите ваш ответ или надиктуйте его голосом перед отправкой.'
      });
      return;
    }

    setLoadingEval(true);
    setEvalResult(null);

    try {
      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          topic: selectedTopicName || currentQ.topic,
          question: currentQ.question,
          referenceAnswer: currentQ.answer,
          userAnswer
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);

        const evalRecord = {
          id: currentQ.id,
          questionId: currentQ.id,
          topic: selectedTopicName || currentQ.topic,
          mode: 'text' as const,
          score: data.score ?? 0,
          isPassed: !!data.isPassed,
          positivePoints: data.positivePoints || [],
          missingPoints: data.missingPoints || [],
          feedback: data.feedback || '',
          userAnswer,
          questionText: currentQ.question,
          referenceAnswer: currentQ.answer
        };

        setQuestionEvaluation(currentQ.id, evalRecord);

        if ((data.score ?? 0) >= 80) {
          triggerSuccessConfetti();
        }

        // Save into results history
        setResultsHistory((prev) => ({
          ...prev,
          [currentQ.id]: {
            question: currentQ,
            userAnswer,
            score: data.score ?? 0,
            isPassed: !!data.isPassed,
            feedback: data.feedback || '',
            positivePoints: data.positivePoints || [],
            missingPoints: data.missingPoints || []
          }
        }));

        // Update progress in Zustand and server
        if (selectedTopicId) {
          if (data.progress) {
            syncTopicProgress(
              selectedTopicId,
              data.progress.completedCount,
              data.progress.percentage,
              data.progress.total
            );
          } else {
            updateTopicProgress(selectedTopicId, currentQ.id, data.isPassed, currentBatch.length);
          }

          await fetch(`/api/topics/${selectedTopicId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              completedIds: [currentQ.id],
              masteredIds: data.isPassed ? [currentQ.id] : [],
              lastQuestionId: currentQ.id
            })
          });
        }
      } else {
        const errText = await res.text();
        console.error('Error evaluating answer:', errText);
        showToast({
          type: 'error',
          title: 'Ошибка оценки ИИ',
          message: 'Сервер оценки не смог обработать ответ.',
          technicalDetails: `HTTP ${res.status}: ${errText}`
        });
      }
    } catch (err: any) {
      console.error('Error evaluating answer:', err);
      showToast({
        type: 'error',
        title: 'Сбой подключения к серверу оценки',
        message: err?.message || 'Не удалось связаться с бэкендом оценки.',
        technicalDetails: err?.stack || String(err)
      });
    } finally {
      setLoadingEval(false);
    }
  };

  const handleNext = () => {
    setUserAnswer('');
    setEvalResult(null);
    if (!isLast) {
      setQuestionIndex(safeIndex + 1);
    } else {
      setIsQuizCompleted(true);
    }
  };

  const handleRetryFailed = () => {
    const failedQuestions = currentBatch.filter((q) => {
      const rec = resultsHistory[q.id];
      return rec && !rec.isPassed;
    });

    if (failedQuestions.length > 0) {
      setResultsHistory({});
      setIsQuizCompleted(false);
      startQuizWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', failedQuestions);
    }
  };

  const handleStudyCurrentBatch = () => {
    startStudyWithQuestions(selectedTopicId || 'topic', selectedTopicName || 'Тема', currentBatch);
  };

  const handleGoToQuestionList = () => {
    if (selectedTopicId) {
      openTopicQuestions(selectedTopicId, selectedTopicName || 'Тема');
    } else {
      setView('topics');
    }
  };

  const toggleResultExpand = (id: string) => {
    setExpandedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Render Quiz Summary Scorecard
  if (isQuizCompleted) {
    const records = Object.values(resultsHistory);
    const totalTested = records.length;
    const passedCount = records.filter((r) => r.isPassed).length;
    const failedCount = totalTested - passedCount;
    const avgScore = totalTested > 0 ? Math.round(records.reduce((acc, r) => acc + r.score, 0) / totalTested) : 0;

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-md"
        >
          {/* Header Trophy Banner */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white mx-auto mb-4 shadow-md">
              <Award className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-pastel-lavender text-pastel-accentViolet rounded-full border border-pastel-accentViolet/20">
              {selectedTopicName}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-pastel-text mt-2">
              Итоги проверки знаний
            </h1>
            <p className="text-xs md:text-sm text-pastel-muted mt-1">
              Проверено вопросов: <strong>{totalTested}</strong>
            </p>
          </div>

          {/* Big Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            <div className="bg-pastel-bg/80 rounded-2xl p-4 text-center border border-pastel-border/60">
              <span className="text-xs font-semibold text-pastel-muted block mb-1">Средний балл</span>
              <span className="text-3xl font-extrabold text-pastel-accentViolet">{avgScore}%</span>
            </div>
            <div className="bg-emerald-50/80 rounded-2xl p-4 text-center border border-emerald-100 text-emerald-800">
              <span className="text-xs font-semibold block mb-1">Сдано успешно</span>
              <span className="text-3xl font-extrabold text-emerald-600">{passedCount}</span>
            </div>
            <div className="bg-rose-50/80 rounded-2xl p-4 text-center border border-rose-100 text-rose-800">
              <span className="text-xs font-semibold block mb-1">Требуют доработки</span>
              <span className="text-3xl font-extrabold text-rose-600">{failedCount}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 pt-2 border-t border-pastel-border/60">
            {failedCount > 0 && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Пересдать ошибки ({failedCount})
              </button>
            )}

            <button
              onClick={handleStudyCurrentBatch}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-pastel-bg hover:bg-pastel-lavender/70 text-pastel-text border border-pastel-border rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-pastel-accentViolet" /> Изучить эти карточки
            </button>

            <button
              onClick={handleGoToQuestionList}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-pastel-text text-white rounded-xl text-xs font-bold shadow-xs hover:bg-black transition cursor-pointer"
            >
              <ListChecks className="w-4 h-4" /> К списку вопросов темы
            </button>

            <button
              onClick={() => setView('topics')}
              className="px-4 py-2.5 text-pastel-muted hover:text-pastel-text text-xs font-semibold transition cursor-pointer"
            >
              Все темы
            </button>
          </div>

          {/* Detailed Question Score breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-pastel-muted mb-4">
              Детальный разбор ответов:
            </h3>

            <div className="space-y-3">
              {records.map((rec) => {
                const isExpanded = expandedResultIds.has(rec.question.id);

                return (
                  <div
                    key={rec.question.id}
                    className="rounded-2xl border border-pastel-border bg-pastel-bg/40 p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="min-w-[32px] px-2 py-0.5 rounded-lg bg-white border border-pastel-border text-center font-bold text-xs text-pastel-text">
                          #{rec.question.num}
                        </span>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-pastel-text leading-snug">
                            {rec.question.question}
                          </h4>

                          <button
                            onClick={() => toggleResultExpand(rec.question.id)}
                            className="mt-2 text-xs font-semibold text-pastel-accentViolet hover:text-pastel-text transition flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" /> Скрыть разбор
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" /> Посмотреть разбор ИИ и ответ
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border ${
                            rec.isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {rec.score}%
                        </span>
                        {rec.isPassed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                    </div>

                    {/* Expandable detailed scorecard */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 pt-3 border-t border-pastel-border/60 space-y-3 text-xs"
                        >
                          {/* User answer */}
                          <div className="bg-white p-3 rounded-xl border border-pastel-border">
                            <span className="font-bold text-pastel-muted block mb-1">Ваш ответ:</span>
                            <p className="text-pastel-text italic leading-relaxed">{rec.userAnswer}</p>
                          </div>

                          {/* AI Feedback */}
                          <div className="bg-white p-3 rounded-xl border border-pastel-border">
                            <span className="font-bold text-pastel-accentViolet block mb-1">Комментарий ИИ:</span>
                            <p className="text-pastel-text leading-relaxed">{rec.feedback}</p>
                          </div>

                          {rec.positivePoints && rec.positivePoints.length > 0 && (
                            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-emerald-900">
                              <span className="font-bold block mb-1">✓ Верно отмечено:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {rec.positivePoints.map((pt, i) => (
                                  <li key={i}>{pt}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {rec.missingPoints && rec.missingPoints.length > 0 && (
                            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100 text-amber-900">
                              <span className="font-bold block mb-1">⚠ Упущено:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {rec.missingPoints.map((pt, i) => (
                                  <li key={i}>{pt}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Reference answer */}
                          <div className="bg-white p-3.5 rounded-xl border border-pastel-border">
                            <span className="font-bold text-pastel-accentRose block mb-1 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" /> Эталонный ответ из базы:
                            </span>
                            <div className="mt-1">
                              <MarkdownRenderer content={rec.question.answer} compact />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active Question In-Progress View
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('study')}
            className="flex items-center gap-1.5 text-xs font-semibold text-pastel-muted hover:text-pastel-text transition bg-white px-3 py-1.5 rounded-xl border border-pastel-border shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Карточки
          </button>
          <button
            onClick={handleGoToQuestionList}
            className="text-xs font-medium text-pastel-muted hover:text-pastel-text transition px-2 py-1 cursor-pointer"
          >
            Список вопросов
          </button>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-pastel-rose text-pastel-accentRoseText rounded-full border border-pastel-accentRose/20">
          {selectedTopicName} — Проверка знания (ИИ)
        </span>

        <button
          onClick={() => setIsVoiceOpen(true)}
          disabled={!systemHealth.isAiReady}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition ${
            !systemHealth.isAiReady
              ? 'opacity-50 cursor-not-allowed bg-gray-400'
              : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-90 cursor-pointer'
          }`}
          title={!systemHealth.isAiReady ? "Инициализация AI Шлюза... Голосовой режим скоро станет доступен" : "Голосовой режим Live"}
        >
          {!systemHealth.isAiReady ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{!systemHealth.isAiReady ? 'AI Запуск...' : 'Голосовой режим Live'}</span>
        </button>
      </div>

      {/* Warmup alert if AI not ready */}
      {!systemHealth.isAiReady && (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          <div>
            <span className="font-semibold block">Инициализация AI Шлюза LiteLLM...</span>
            <p className="text-[11px] text-amber-800/80 mt-0.5">
              Модель оценки и голосовой режим станут доступны автоматически через несколько секунд.
            </p>
          </div>
        </div>
      )}

      {/* Main Question Card */}
      <motion.div
        key={currentQ.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 border border-pastel-border shadow-sm mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-pastel-accentViolet flex items-center gap-1.5">
            <Brain className="w-4 h-4" /> Вопрос {currentQuestionIndex + 1} из {currentBatch.length}
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-pastel-lavender/60 text-pastel-accentViolet rounded-md">
            #{currentQ.num}
          </span>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-pastel-text mb-6 leading-snug">
          {currentQ.question}
        </h2>

        {/* Text Area Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-pastel-muted uppercase tracking-wider mb-2">
            Сформулируйте ваш ответ своими словами:
          </label>
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (userAnswer.trim() && !loadingEval && systemHealth.isAiReady) {
                  handleEvaluate();
                }
              }
            }}
            disabled={loadingEval || !!evalResult}
            rows={5}
            placeholder="Напишите всё, что вы помните по этой теме... (Ctrl+Enter для быстрой отправки)"
            className="w-full p-4 rounded-2xl border border-pastel-border bg-pastel-bg/50 focus:bg-white focus:ring-2 focus:ring-pastel-accentViolet/30 focus:border-pastel-accentViolet outline-none text-sm transition resize-none"
          />
        </div>

        {/* Quick Voice / Tutor Action Bar */}
        {!evalResult && (
          <div className="mb-4 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-pastel-lavender/60 hover:bg-pastel-lavender border border-pastel-accentViolet/20 text-pastel-accentViolet font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Mic className="w-3.5 h-3.5 text-pastel-accentViolet" />
              <span>🎙️ Ответить устно / Пройти собеседование</span>
            </button>

            <div className="flex items-center gap-2 text-[11px] text-pastel-muted font-mono">
              <span className="hidden sm:inline">
                <kbd className="px-1.5 py-0.5 rounded bg-pastel-bg border border-pastel-border text-[10px] text-pastel-text">Ctrl+Enter</kbd>
              </span>
              <span>{userAnswer.length} символов</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!evalResult && (
          <button
            onClick={handleEvaluate}
            disabled={loadingEval || !userAnswer.trim() || !systemHealth.isAiReady}
            className={`w-full py-3.5 rounded-2xl text-white text-sm font-bold shadow-md transition flex items-center justify-center gap-2 ${
              !systemHealth.isAiReady
                ? 'opacity-60 cursor-not-allowed bg-gray-400'
                : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 disabled:opacity-50 cursor-pointer'
            }`}
            title={!systemHealth.isAiReady ? "Инициализация AI Шлюза..." : "Проверить ответ"}
          >
            {loadingEval ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Gemini анализирует ответ...
              </>
            ) : !systemHealth.isAiReady ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ожидание готовности AI Шлюза...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Проверить ответ через ИИ
              </>
            )}
          </button>
        )}

        {/* AI Result Scorecard */}
        {evalResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-6 rounded-2xl border border-pastel-border bg-pastel-bg/60 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {evalResult.isPassed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                )}
                <span className="font-bold text-base text-pastel-text">
                  {evalResult.isPassed ? 'Отличный ответ!' : 'Требует повторения'}
                </span>
              </div>
              <span className="text-xl font-extrabold text-pastel-accentViolet">
                {evalResult.score}%
              </span>
            </div>

            <p className="text-sm text-pastel-text leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-pastel-border/60">
              {evalResult.feedback}
            </p>

            {evalResult.positivePoints?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                  ✓ Что отвечено правильно:
                </h4>
                <ul className="list-disc list-inside text-xs text-pastel-text space-y-1">
                  {evalResult.positivePoints.map((pt: string, idx: number) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {evalResult.missingPoints?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                  ⚠ Упущенные детали и термины:
                </h4>
                <ul className="list-disc list-inside text-xs text-pastel-text space-y-1">
                  {evalResult.missingPoints.map((pt: string, idx: number) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action to proceed */}
            <div className="pt-2">
              <button
                onClick={handleNext}
                className="w-full py-3 rounded-xl bg-pastel-text text-white font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isLast ? 'Завершить проверку и посмотреть итоги 🎉' : 'Следующий вопрос'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Voice Modal with Continuous Batch Mode */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        questionId={currentQ.id}
        topic={selectedTopicName || currentQ.topic}
        currentQuestionText={currentQ.question}
        referenceAnswer={currentQ.answer}
        questionsBatch={currentBatch}
        initialQuestionIndex={safeIndex}
        onIndexChange={(newIdx) => {
          setQuestionIndex(newIdx);
          setEvalResult(null);
          setUserAnswer('');
        }}
        onEvaluationComplete={async (evalData) => {
          const evalQId = evalData.questionId || currentQ.id;
          const targetQuestion = currentBatch.find((q) => q.id === evalQId) || currentQ;

          setEvalResult(evalData);

          const evalRecord = {
            id: evalQId,
            questionId: evalQId,
            topic: selectedTopicName || targetQuestion.topic,
            mode: 'voice' as const,
            score: evalData.score ?? 0,
            isPassed: !!evalData.isPassed,
            positivePoints: evalData.positivePoints || [],
            missingPoints: evalData.missingPoints || [],
            feedback: evalData.feedback || '',
            userAnswer: evalData.userAnswer || 'Устный ответ через Gemini Live',
            audioMetrics: evalData.audioMetrics,
            questionText: targetQuestion.question,
            referenceAnswer: targetQuestion.answer
          };

          setQuestionEvaluation(evalQId, evalRecord);

          setResultsHistory((prev) => ({
            ...prev,
            [evalQId]: {
              question: targetQuestion,
              userAnswer: evalData.userAnswer || '🎙️ Устный ответ в Gemini Live',
              score: evalData.score ?? 0,
              isPassed: !!evalData.isPassed,
              feedback: evalData.feedback || '',
              positivePoints: evalData.positivePoints || [],
              missingPoints: evalData.missingPoints || []
            }
          }));

          if (selectedTopicId) {
            updateTopicProgress(selectedTopicId, evalQId, !!evalData.isPassed, currentBatch.length);

            await fetch(`/api/topics/${selectedTopicId}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                completedIds: [evalQId],
                masteredIds: evalData.isPassed ? [evalQId] : [],
                lastQuestionId: evalQId
              })
            });
          }
        }}
        onBatchComplete={(batchRes) => {
          setIsQuizCompleted(true);
        }}
      />
    </div>
  );
};
