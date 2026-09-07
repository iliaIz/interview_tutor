import React from 'react';
import { 
  Award, RotateCcw, BookOpen, ListChecks, ChevronUp, ChevronDown, 
  CheckCircle2, AlertTriangle, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { EvalRecord } from './QuizTypes';

interface QuizResultSummaryProps {
  selectedTopicName: string;
  records: EvalRecord[];
  expandedResultIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onRetryFailed: () => void;
  onStudyCurrentBatch: () => void;
  onGoToQuestionList: () => void;
  onGoToTopics: () => void;
}

export const QuizResultSummary: React.FC<QuizResultSummaryProps> = ({
  selectedTopicName,
  records,
  expandedResultIds,
  onToggleExpand,
  onRetryFailed,
  onStudyCurrentBatch,
  onGoToQuestionList,
  onGoToTopics
}) => {
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
              onClick={onRetryFailed}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Пересдать ошибки ({failedCount})
            </button>
          )}

          <button
            onClick={onStudyCurrentBatch}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-pastel-bg hover:bg-pastel-lavender/70 text-pastel-text border border-pastel-border rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-pastel-accentViolet" /> Изучить эти карточки
          </button>

          <button
            onClick={onGoToQuestionList}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-pastel-text text-white rounded-xl text-xs font-bold shadow-xs hover:bg-black transition cursor-pointer"
          >
            <ListChecks className="w-4 h-4" /> К списку вопросов темы
          </button>

          <button
            onClick={onGoToTopics}
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
                          onClick={() => onToggleExpand(rec.question.id)}
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
};
