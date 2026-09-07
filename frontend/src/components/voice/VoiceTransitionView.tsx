import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  FastForward,
  RotateCcw,
  Play,
  Pause,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { RubricScorecard } from './RubricScorecard';
import { EvaluationResult, DialogueTurn } from '../../types/voice';
import { InterviewConfig } from '../../types/interviewConfig';

export interface VoiceTransitionViewProps {
  evaluation: EvaluationResult;
  activeBatchIndex: number;
  totalQuestions: number;
  nextQuestionNum: number;
  countdown: number;
  isTransitionPaused: boolean;
  interviewConfig: InterviewConfig;
  dialogueTurns: DialogueTurn[];
  deepgramTranscript?: string;
  onAdvance: (nextIndex: number) => void;
  onRetry: () => void;
  onTogglePause: () => void;
  onFinishInterview: () => void;
  onConfigChange: (newConfig: InterviewConfig) => void;
}

export const VoiceTransitionView: React.FC<VoiceTransitionViewProps> = ({
  evaluation,
  activeBatchIndex,
  totalQuestions,
  nextQuestionNum,
  countdown,
  isTransitionPaused,
  interviewConfig,
  dialogueTurns,
  deepgramTranscript,
  onAdvance,
  onRetry,
  onTogglePause,
  onFinishInterview,
  onConfigChange
}) => {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const isAutoAdvance = interviewConfig.autoAdvance === true && (interviewConfig.transitionDelay ?? 5) > 0;
  const totalDelay = interviewConfig.transitionDelay ?? 5;

  return (
    <div className="my-3 space-y-3.5 overflow-y-auto max-h-[66vh] pr-1 modal-overscroll-contain">
      {/* Score Banner */}
      <div
        className={`p-4 rounded-3xl border flex items-center justify-between shadow-xs ${
          evaluation.isPassed
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            : 'bg-rose-50/90 border-rose-200 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xs ${
              evaluation.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {evaluation.score ?? 70}%
          </div>
          <div>
            <h4 className="font-bold text-sm">
              {evaluation.isPassed ? '🎉 Вопрос успешно зачтен!' : 'Требуется дополнительное повторение'}
            </h4>
            <p className="text-xs opacity-80">
              Вопрос {activeBatchIndex + 1} из {totalQuestions} пройден
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
            {evaluation.score ?? 70}/100
          </span>
          {(evaluation.score ?? 70) < 100 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 shadow-2xs">
              -{100 - (evaluation.score ?? 70)} б.
            </span>
          )}
        </div>
      </div>

      {/* Transition Control Card (Auto-Timer vs Manual Mode) */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-pastel-lavender/60 via-white to-pastel-rose/40 border border-pastel-border shadow-md space-y-3 text-center">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-accentViolet">
            <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
            <span>Следующий: Вопрос #{nextQuestionNum} из {totalQuestions}</span>
          </div>

          {/* Mode Selector Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextAuto = !isAutoAdvance;
              onConfigChange({
                ...interviewConfig,
                autoAdvance: nextAuto,
                transitionDelay: nextAuto ? (interviewConfig.transitionDelay || 5) : 0
              });
            }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-pastel-border text-slate-700 hover:bg-pastel-card transition flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Переключить между автоматическим и ручным переходом к вопросу"
          >
            <span>{isAutoAdvance ? '⚡ Автопереход: ВКЛ' : '✋ Ручной режим (без таймера)'}</span>
          </button>
        </div>

        {isAutoAdvance ? (
          <div className="space-y-2 py-1">
            <div className="text-2xl font-black text-pastel-text">
              {isTransitionPaused ? '⏸️ Таймер на паузе' : `Переход через ${countdown} сек...`}
            </div>

            {!isTransitionPaused && (
              <div className="w-full bg-pastel-border/60 h-2 rounded-full overflow-hidden p-0.5 max-w-md mx-auto">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(countdown / totalDelay) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet rounded-full"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-1">
            <p className="text-xs text-pastel-muted">
              Время не ограничено. Спокойно изучите разбор ответа ниже и нажмите кнопку, когда будете готовы.
            </p>
          </div>
        )}

        {/* Transition Action Buttons */}
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onAdvance(activeBatchIndex + 1)}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs shadow-sm hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Перейти к вопросу #{nextQuestionNum} ➔</span>
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 px-4 rounded-xl bg-white border border-pastel-border text-pastel-accentViolet font-bold text-xs hover:bg-pastel-lavender/30 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Пересдать этот же вопрос заново с чистого листа"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>🔄 Ответить заново</span>
          </button>

          {isAutoAdvance && (
            <button
              type="button"
              onClick={onTogglePause}
              className="py-2.5 px-4 rounded-xl bg-white border border-pastel-border text-pastel-text font-semibold text-xs hover:bg-pastel-card transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isTransitionPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600 fill-current" />
                  <span>Возобновить отсчет</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                  <span>Пауза таймера</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onFinishInterview}
            className="py-2.5 px-3.5 rounded-xl text-pastel-muted hover:text-pastel-text text-xs transition cursor-pointer"
          >
            Завершить интервью
          </button>
        </div>
      </div>

      {/* Detailed Feedback on Transition Screen */}
      {evaluation.positivePoints && evaluation.positivePoints.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
          <span className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Что раскрыто глубоко и точно:
          </span>
          <ul className="space-y-1 text-emerald-900 list-disc list-inside">
            {evaluation.positivePoints.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Explainable Rubric Scorecard (Criteria Ledger + Deductions + Upgrade Snippet) */}
      <RubricScorecard evaluation={evaluation} />

      {(evaluation.spokenFeedback || evaluation.feedback) && (
        <div className="p-3.5 rounded-2xl bg-pastel-card border border-pastel-border text-xs leading-relaxed text-pastel-text">
          <span className="font-bold text-pastel-accentViolet block mb-1">Резюме интервьюера:</span>
          <p>{evaluation.spokenFeedback || evaluation.feedback}</p>
        </div>
      )}

      {/* Expandable Dialogue Transcript */}
      {(deepgramTranscript || dialogueTurns.some((t) => t.role === 'ai' && t.text.length > 5)) && (
        <div className="rounded-2xl border border-pastel-border/70 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setIsTranscriptOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-pastel-card/80 hover:bg-pastel-rose/30 transition-colors text-xs font-bold text-pastel-text cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-pastel-accentViolet" />
              📜 Стенограмма ответа (Deepgram Nova-3)
            </span>
            {isTranscriptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isTranscriptOpen && (
            <div className="p-3 bg-white/70 space-y-2 max-h-48 overflow-y-auto">
              {deepgramTranscript && (
                <div className="text-[11px] text-pastel-text/90">
                  <span className="font-bold text-emerald-700 block text-[9px] mb-0.5">
                    Ваш ответ:
                  </span>
                  <p>{deepgramTranscript}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
