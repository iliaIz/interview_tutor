import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  Square,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  Mic,
  BookOpen,
  Brain,
  Headphones
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Question } from '../../store/useAppStore';

export interface QuestionWithStatus extends Question {
  isCompleted?: boolean;
  isMastered?: boolean;
}

interface QuestionListItemProps {
  question: QuestionWithStatus;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  isMastered: boolean;
  isCompleted: boolean;
  evaluationItem?: any;
  onSelect: (qId: string, index: number, event: React.MouseEvent) => void;
  onToggleAnswer: (qId: string) => void;
  onOpenReportModal: (evalData: any) => void;
  onStartVoice: (questions: QuestionWithStatus[]) => void;
  onStartStudy: (questions: QuestionWithStatus[]) => void;
  onStartQuiz: (questions: QuestionWithStatus[]) => void;
  onStartRecap: (questions: QuestionWithStatus[]) => void;
}

export const QuestionListItem: React.FC<QuestionListItemProps> = ({
  question: q,
  index: idx,
  isSelected,
  isExpanded,
  isMastered,
  isCompleted,
  evaluationItem,
  onSelect,
  onToggleAnswer,
  onOpenReportModal,
  onStartVoice,
  onStartStudy,
  onStartQuiz,
  onStartRecap
}) => {
  return (
    <motion.div
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
          onClick={(e) => onSelect(q.id, idx, e)}
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
            {isMastered ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Освоен
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-pastel-accentViolet text-[10px] font-bold border border-pastel-accentViolet/20">
                <Clock className="w-3 h-3" /> Изучен
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 text-[10px] font-medium border border-gray-200">
                Не начат
              </span>
            )}

            <span className="text-[10px] text-pastel-muted font-mono">
              {q.id}
            </span>

            {/* Evaluation Score Badge */}
            {evaluationItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReportModal({
                    ...evaluationItem,
                    questionText: q.question,
                    referenceAnswer: q.answer
                  });
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition shadow-2xs cursor-pointer ${
                  evaluationItem.isPassed
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
                title="Посмотреть подробный отчет интервьюера"
              >
                <Award className="w-3 h-3 text-emerald-600" />
                <span>{evaluationItem.score}/100</span>
                <span>{evaluationItem.mode === 'voice' ? '🎙️' : '⌨️'}</span>
                <span className="text-[9px] underline ml-0.5">Отчёт</span>
              </button>
            )}
          </div>

          {/* Question Text */}
          <h3
            onClick={(e) => onSelect(q.id, idx, e)}
            className="text-sm md:text-base font-bold text-pastel-text leading-snug cursor-pointer select-none hover:text-pastel-accentRose transition-colors"
          >
            {q.question}
          </h3>

          {/* Accordion Toggle for Answer Preview */}
          <div className="mt-2.5 flex items-center gap-3">
            <button
              onClick={() => onToggleAnswer(q.id)}
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
            onClick={() => onStartVoice([q])}
            title="Пройти голосовое собеседование по этому вопросу"
            className="p-2 rounded-xl bg-pastel-rose/40 text-pastel-accentRose hover:bg-pastel-accentRose hover:text-white transition cursor-pointer"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStartStudy([q])}
            title="Изучить только этот вопрос"
            className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentRose hover:bg-pastel-rose transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStartQuiz([q])}
            title="Проверить знание этого вопроса с ИИ"
            className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentViolet hover:bg-pastel-lavender transition cursor-pointer"
          >
            <Brain className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStartRecap([q])}
            title="Сгенерировать AI-озвучку вопроса"
            className="p-2 rounded-xl bg-pastel-bg text-pastel-muted hover:text-pastel-accentRose hover:bg-pastel-rose transition cursor-pointer"
          >
            <Headphones className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
